"use client";

import {
  BatchPayoutClient,
  SigningError,
  type Payment,
  type Receipt,
  type Signer,
} from "@sororail/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ChunkStatus } from "@/components/PayrollChunkProgress";
import { BATCH_PAYOUT_CONTRACT, NATIVE_TOKEN } from "@/lib/network";
import { useRpc } from "@/lib/rpc-provider";
import {
  buildPayrollTemplate,
  mergeDuplicateRows,
  parseCsv,
  removeCsvLines,
  splitPayrollPayments,
  type MergedAddress,
} from "@/lib/payroll";
import { usePayrollDraft } from "@/lib/payrollDraft";
import type { AddressBookEntry } from "@/lib/addressBook";
import { estimatePayrollFee, type PayrollFeeEstimate } from "@/lib/payroll-fee";
import { fetchTokenDecimals } from "@/lib/token";
import { useWallet } from "@/lib/wallet";

export const MAX_VISIBLE_VALID_ROWS = 200;

/**
 * Payroll state and actions: the CSV, its parsed lines and the values derived
 * from them, the on-chain recipient cap and token decimals, the preview and the
 * chunked execution. Extracted unchanged from `payroll/page.tsx` (#438); the page
 * only renders what this returns.
 */
export function usePayroll() {
  const { address, signer, connect } = useWallet();
  const { clientOptions } = useRpc();
  const [csv, setCsv] = useState("");
  const [cap, setCap] = useState<number | null>(null);
  const [capError, setCapError] = useState<unknown>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [feeEstimate, setFeeEstimate] = useState<PayrollFeeEstimate | null>(null);
  // The fee estimate belongs to the preview it was computed with.
  useEffect(() => {
    if (!receipt) setFeeEstimate(null);
  }, [receipt]);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);
  const [results, setResults] = useState<{ hash: string; count: number }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  // Session-only labels for recipients; never persisted (see lib/addressBook).
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const previewSeq = useRef(0);
  // The token's decimals, read from the token contract. Amounts are scaled by
  // this, so nothing can be sent until it is known (#138).
  const [decimals, setDecimals] = useState<number | null>(null);
  const [decimalsError, setDecimalsError] = useState<unknown>(null);
  // What the last "Merge duplicates" combined, shown until the CSV is edited (#420).
  const [mergeSummary, setMergeSummary] = useState<MergedAddress[] | null>(null);
  // Per-batch status of the current run, and the run's fixed inputs so a failed
  // batch can be retried against the same batches and source rows (#422).
  const [chunks, setChunks] = useState<ChunkStatus[]>([]);
  const run = useRef<{ batches: Payment[][]; sourceCsv: string; validLines: number[] } | null>(null);
  const draft = usePayrollDraft(csv);

  const loadCsvFile = useCallback((file: File) => {
    setFileError(null);
    if (!/\.csv$/i.test(file.name) && file.type && file.type !== "text/csv") {
      setFileError("Only .csv files are supported.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      previewSeq.current += 1;
      setCsv(typeof reader.result === "string" ? reader.result : "");
      setReceipt(null);
      setPreviewError(null);
      setResults([]);
      setMergeSummary(null);
      run.current = null;
      setChunks([]);
    };
    reader.onerror = () => setFileError("Could not read that file.");
    reader.readAsText(file);
  }, []);

  const downloadTemplate = useCallback(() => {
    const url = URL.createObjectURL(
      new Blob([buildPayrollTemplate()], { type: "text/csv" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "payroll-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, []);

  /** The textarea's change handler. */
  const editCsv = useCallback((text: string) => {
    previewSeq.current += 1;
    setCsv(text);
    setReceipt(null);
    setPreviewError(null);
    // A new batch starts here; earlier "Paid N recipients" notices no
    // longer describe what is on screen (#137).
    setResults([]);
    setMergeSummary(null);
    run.current = null;
    setChunks([]);
  }, []);

  const client = useMemo(
    () => new BatchPayoutClient(clientOptions(BATCH_PAYOUT_CONTRACT, address)),
    [clientOptions, address],
  );

  // Read the cap rather than hardcoding: it is derived from network resource
  // limits and can differ between deployments.
  useEffect(() => {
    if (!address) {
      setCap(null);
      setCapError(null);
      return;
    }
    let cancelled = false;
    setCap(null);
    setCapError(null);
    void client
      .maxRecipients()
      .then((value) => {
        if (!Number.isInteger(value) || value < 1) {
          throw new Error("The contract returned an invalid recipient limit.");
        }
        if (cancelled) return;
        setCap(value);
        setCapError(null);
      })
      .catch((error) => {
        if (!cancelled) {
          setCap(null);
          setCapError(error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, address]);

  // Read the token's decimals rather than assuming 7 (the decimals trap).
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setDecimals(null);
    setDecimalsError(null);
    void fetchTokenDecimals(NATIVE_TOKEN, address)
      .then((value) => {
        if (!cancelled) setDecimals(value);
      })
      .catch((error) => {
        if (!cancelled) setDecimalsError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Everything below derives from `parsed`, and a payroll can run to thousands
  // of lines, so each value is memoised: a keystroke in the textarea that
  // changes `csv` recomputes them once, and unrelated state changes (busy,
  // receipt, the confirm dialog) recompute nothing. `valid` in particular must
  // keep a stable identity, or `payments`, `duplicates` and `batches` would
  // all be rebuilt on every render regardless of their own memoisation.
  const parsed = useMemo(
    () => parseCsv(csv, decimals ?? undefined),
    [csv, decimals],
  );
  const invalid = useMemo(() => parsed.filter((line) => line.error), [parsed]);
  const valid = useMemo(() => parsed.filter((line) => !line.error), [parsed]);

  // Errors always render in full -- an operator needs to see every bad row to
  // fix their CSV. Valid rows are capped, since there is nothing left to do
  // with them but confirm the total, and thousands of DOM rows for a large
  // payroll would make every keystroke slow.
  const hiddenValidCount = Math.max(0, valid.length - MAX_VISIBLE_VALID_ROWS);
  const visible = useMemo(() => {
    const visibleValidLines = new Set(
      valid.slice(0, MAX_VISIBLE_VALID_ROWS).map((line) => line.line),
    );
    return parsed.filter(
      (line) => line.error || visibleValidLines.has(line.line),
    );
  }, [parsed, valid]);

  const payments = useMemo<Payment[]>(
    () => valid.map((line) => ({ to: line.to, amount: line.stroops! })),
    [valid],
  );

  const total = useMemo(
    () => payments.reduce((sum, payment) => sum + payment.amount, 0n),
    [payments],
  );

  // Duplicates are legitimate on chain -- two invoices for one contractor --
  // so this warns rather than blocks. Catching them here is exactly where the
  // contract expects the check to live. Check against all parsed lines (valid
  // and invalid), not just valid ones, to catch cases where the same address
  // appears in both a valid line and a line with a parsing error.
  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const repeated = new Set<string>();
    for (const line of parsed) {
      if (line.to && seen.has(line.to)) repeated.add(line.to);
      if (line.to) seen.add(line.to);
    }
    return [...repeated];
  }, [parsed]);

  const decimalsKnown = decimals !== null;

  const batches = useMemo(
    () => splitPayrollPayments(payments, cap),
    [payments, cap],
  );

  const preview = useCallback(async () => {
    if (!batches) {
      setPreviewError(
        new Error(
          "Cannot preview payouts until the contract recipient limit is verified.",
        ),
      );
      return;
    }
    if (batches.length === 0) return;
    const seq = ++previewSeq.current;
    setPreviewError(null);
    setReceipt(null);
    try {
      // Preview every chunk exactly as it will be submitted.
      const receipts: Receipt[] = [];
      for (const chunk of batches) {
        receipts.push(await client.preview(chunk));
      }
      // Each chunk is its own transaction: total their simulated fees (#424).
      const fee = address
        ? await estimatePayrollFee(batches, async (chunk) => {
            const call = await client.execute({ funder: address, token: NATIVE_TOKEN, recipients: chunk });
            return (await call.simulateWithResources()).resources.resourceFee;
          })
        : null;
      if (seq === previewSeq.current) {
        setFeeEstimate(fee);
        setReceipt({
          count: receipts.reduce((count, res) => count + res.count, 0),
          total: receipts.reduce((sum, res) => sum + res.total, 0n),
        });
      }
    } catch (error) {
      if (seq === previewSeq.current) {
        setPreviewError(error);
      }
    }
  }, [batches, client, address]);

  async function send() {
    if (!signer || !address) {
      setSendError(
        new SigningError("Wallet disconnected. Reconnect to continue."),
      );
      return;
    }
    if (!batches) {
      setSendError(
        new Error(
          "Cannot send payouts until the contract recipient limit is verified.",
        ),
      );
      return;
    }
    run.current = { batches, sourceCsv: csv, validLines: valid.map((line) => line.line) };
    setChunks(batches.map((chunk) => ({ count: chunk.length, state: "pending" })));
    await runFrom(0);
  }

  function setChunk(index: number, patch: Partial<ChunkStatus>) {
    setChunks((current) => current.map((chunk, i) => (i === index ? { ...chunk, ...patch } : chunk)));
  }

  /** Sends batches from `start` on; a retry of a failed batch resumes here (#422). */
  async function runFrom(start: number) {
    const current = run.current;
    if (!current) return;
    if (!signer || !address) {
      setSendError(
        new SigningError("Wallet disconnected. Reconnect to continue."),
      );
      return;
    }
    setBusy(true);
    setSendError(null);
    let index = start;
    try {
      for (; index < current.batches.length; index++) {
        const i = index;
        const chunk = current.batches[i]!;
        setChunk(i, { state: "pending", error: undefined });
        // Reports the moment the wallet has signed, before submission and confirmation.
        const tracked: Signer = {
          publicKey: signer.publicKey,
          signTransaction: async (xdr, options) => {
            const signed = await signer.signTransaction(xdr, options);
            setChunk(i, { state: "signed" });
            return signed;
          },
        };
        const call = await client.execute({
          funder: address,
          token: NATIVE_TOKEN,
          recipients: chunk,
        });
        const result = await call.signAndSend(tracked);
        setChunk(i, { state: "confirmed", hash: result.hash });
        const paidCount = current.batches
          .slice(0, i + 1)
          .reduce((count, batch) => count + batch.length, 0);
        setResults((existing) => [
          ...existing,
          { hash: result.hash, count: result.result.count },
        ]);
        setCsv(removeCsvLines(current.sourceCsv, current.validLines.slice(0, paidCount)));
        setReceipt(null);
      }
      setConfirming(false);
      setCsv("");
      setReceipt(null);
      run.current = null;
      draft.clear();
    } catch (error) {
      setChunk(index, {
        state: "failed",
        error: error instanceof Error ? error.message : undefined,
      });
      setSendError(error);
    } finally {
      setBusy(false);
    }
  }

  function mergeDuplicates() {
    const { text, merged } = mergeDuplicateRows(csv, decimals ?? undefined);
    previewSeq.current += 1;
    setCsv(text);
    setReceipt(null);
    setPreviewError(null);
    setResults([]);
    setMergeSummary(merged);
  }

  /** Puts a saved draft back in the editor (#421). */
  function restoreDraft() {
    editCsv(draft.savedDraft ?? "");
    draft.dismiss();
  }

  return {
    address,
    signer,
    connect,
    csv,
    editCsv,
    loadCsvFile,
    downloadTemplate,
    addressBook,
    setAddressBook,
    dragActive,
    setDragActive,
    fileError,
    parsed,
    visible,
    valid,
    invalid,
    hiddenValidCount,
    duplicates,
    total,
    decimals,
    decimalsKnown,
    decimalsError,
    cap,
    capError,
    payments,
    batches,
    receipt,
    feeEstimate,
    previewError,
    preview,
    confirming,
    setConfirming,
    busy,
    sendError,
    setSendError,
    send,
    results,
    mergeSummary,
    mergeDuplicates,
    chunks,
    retryFrom: runFrom,
    draft,
    restoreDraft,
  };
}

export type PayrollState = ReturnType<typeof usePayroll>;
