"use client";

import {
  BatchPayoutClient,
  SigningError,
  type Payment,
  type Receipt,
} from "@sororail/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BATCH_PAYOUT_CONTRACT,
  NATIVE_TOKEN,
  NETWORK_PASSPHRASE,
  RPC_URL,
} from "@/lib/network";
import {
  parseCsv,
  removeCsvLines,
  splitPayrollPayments,
} from "@/lib/payroll";
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
  const [csv, setCsv] = useState("");
  const [cap, setCap] = useState<number | null>(null);
  const [capError, setCapError] = useState<unknown>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);
  const [results, setResults] = useState<{ hash: string; count: number }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const previewSeq = useRef(0);
  // The token's decimals, read from the token contract. Amounts are scaled by
  // this, so nothing can be sent until it is known (#138).
  const [decimals, setDecimals] = useState<number | null>(null);
  const [decimalsError, setDecimalsError] = useState<unknown>(null);

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
    };
    reader.onerror = () => setFileError("Could not read that file.");
    reader.readAsText(file);
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
  }, []);

  const client = useMemo(
    () =>
      new BatchPayoutClient({
        contractId: BATCH_PAYOUT_CONTRACT,
        rpcUrl: RPC_URL,
        networkPassphrase: NETWORK_PASSPHRASE,
        ...(address ? { publicKey: address } : {}),
      }),
    [address],
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
      if (seq === previewSeq.current) {
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
  }, [batches, client]);

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
    setBusy(true);
    setSendError(null);
    const sourceCsv = csv;
    let paidCount = 0;
    try {
      for (const chunk of batches) {
        const call = await client.execute({
          funder: address,
          token: NATIVE_TOKEN,
          recipients: chunk,
        });
        const result = await call.signAndSend(signer);
        paidCount += chunk.length;
        setResults((current) => [
          ...current,
          { hash: result.hash, count: result.result.count },
        ]);
        setCsv(
          removeCsvLines(
            sourceCsv,
            valid.slice(0, paidCount).map((line) => line.line),
          ),
        );
        setReceipt(null);
      }
      setConfirming(false);
      setCsv("");
      setReceipt(null);
    } catch (error) {
      setSendError(error);
    } finally {
      setBusy(false);
    }
  }

  return {
    address,
    signer,
    connect,
    csv,
    editCsv,
    loadCsvFile,
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
    previewError,
    preview,
    confirming,
    setConfirming,
    busy,
    sendError,
    setSendError,
    send,
    results,
  };
}

export type PayrollState = ReturnType<typeof usePayroll>;
