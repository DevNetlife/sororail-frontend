"use client";

import { EscrowClient, StreamClient, VestingClient } from "@sororail/sdk";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ErrorNotice, SuccessNotice } from "@/components/Feedback";
import { useTokenMetadata, type TokenMetadataState } from "@/hooks/useTokenMetadata";
import { NATIVE_TOKEN } from "@/lib/network";
import { addPosition, looksLikeContractId, type PositionKind } from "@/lib/positions";
import { useRpc } from "@/lib/rpc-provider";
import { useWallet } from "@/lib/wallet";

const titles: Record<Exclude<PositionKind, "recurring">, string> = {
  stream: "Create a stream",
  vesting: "Create a grant",
  escrow: "Create an escrow",
};

export function CreatePositionForm({
  kind,
}: {
  kind: Exclude<PositionKind, "recurring">;
}) {
  const { address, signer } = useWallet();
  const { clientOptions } = useRpc();
  const [contractId, setContractId] = useState("");
  const [token, setToken] = useState<string>(NATIVE_TOKEN);
  const [counterparty, setCounterparty] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [cliff, setCliff] = useState("0");
  const [rate, setRate] = useState("");
  const [cancellable, setCancellable] = useState(true);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<{ hash: string; saved: boolean } | null>(null);
  // #408 — after a failed submit, focus lands on the first invalid field.
  const formRef = useRef<HTMLFormElement>(null);
  const [invalidSubmits, setInvalidSubmits] = useState(0);

  useEffect(() => {
    if (invalidSubmits === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [invalidSubmits]);

  // #412 — the native token is known; any other pasted contract is read for its symbol, name and decimals.
  const tokenTrimmed = token.trim();
  const customToken =
    tokenTrimmed !== NATIVE_TOKEN && looksLikeContractId(tokenTrimmed) ? tokenTrimmed : undefined;
  const tokenMetadata = useTokenMetadata(customToken);

  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  function validateFields(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!contractId.trim()) {
      errors.contractId = "Contract address is required.";
    } else if (!looksLikeContractId(contractId.trim())) {
      errors.contractId = "Enter the address of a deployed, uninitialized contract.";
    }

    if (!tokenTrimmed) {
      errors.token = "Token contract address is required.";
    } else if (!looksLikeContractId(tokenTrimmed)) {
      errors.token = "Enter a token contract address (starts with C).";
    } else if (customToken && tokenMetadata.status === "error") {
      errors.token = "That contract is not a token. Check the address.";
    } else if (customToken && tokenMetadata.status !== "ready") {
      errors.token = "Still reading the token. Try again in a moment.";
    }

    const counterpartyLabel = kind === "stream" ? "Recipient" : "Beneficiary";
    if (!counterparty.trim()) {
      errors.counterparty = `${counterpartyLabel} address is required.`;
    } else if (!/^G[A-Z2-7]{55}$/.test(counterparty.trim())) {
      errors.counterparty = `${counterpartyLabel} must be a valid Stellar account address.`;
    }

    if (kind === "escrow" && arbiter.trim() && !/^G[A-Z2-7]{55}$/.test(arbiter.trim())) {
      errors.arbiter = "Arbiter must be a valid Stellar account address.";
    }

    const amountKey = kind === "stream" ? "rate" : "amount";
    const amountLabel = kind === "stream" ? "Rate per second" : "Amount";
    const amountValue = (kind === "stream" ? rate : amount).trim();

    if (!amountValue) {
      errors[amountKey] = `${amountLabel} is required.`;
    } else if (amountValue.includes(".")) {
      const [, fraction = ""] = amountValue.split(".");
      if (fraction.length > 7) {
        errors[amountKey] = `${amountLabel} has too many decimal places (maximum 7).`;
      } else {
        errors[amountKey] = `${amountLabel} must be a whole number (stroops cannot have decimals).`;
      }
    } else if (!/^\d+$/.test(amountValue)) {
      errors[amountKey] = `${amountLabel} must be a whole number.`;
    } else if (BigInt(amountValue) <= 0n) {
      errors[amountKey] = `${amountLabel} must be greater than zero.`;
    }

    const durationLabel = kind === "escrow" ? "Seconds until deadline" : "Duration";
    const durationValue = duration.trim();
    if (!durationValue) {
      errors.duration = `${durationLabel} is required.`;
    } else if (!/^\d+$/.test(durationValue)) {
      errors.duration = `${durationLabel} must be a whole number.`;
    } else if (BigInt(durationValue) <= 0n) {
      errors.duration = `${durationLabel} must be greater than zero.`;
    }

    if (kind === "vesting") {
      const cliffValue = cliff.trim();
      if (!cliffValue) {
        errors.cliff = "Cliff is required.";
      } else if (!/^\d+$/.test(cliffValue)) {
        errors.cliff = "Cliff must be a whole number.";
      }
    }

    return errors;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setSuccess(null);

    const validationErrors = validateFields();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setInvalidSubmits((count) => count + 1);
      return;
    }
    setFieldErrors({});

    if (!address || !signer) {
      setError(new Error("Connect and fund a testnet wallet before creating a position."));
      return;
    }

    setBusy(true);
    try {
      const options = clientOptions(contractId.trim(), address);
      let call;
      if (kind === "stream") {
        const seconds = positiveInteger(duration, "Duration");
        call = await new StreamClient(options).create({
          sender: address,
          recipient: requiredAddress(counterparty, "Recipient"),
          token: tokenTrimmed,
          ratePerSecond: positiveInteger(rate, "Rate"),
          start: BigInt(Math.floor(Date.now() / 1000)),
          stop: BigInt(Math.floor(Date.now() / 1000)) + seconds,
          cancellable,
        });
      } else if (kind === "vesting") {
        const seconds = positiveInteger(duration, "Duration");
        const cliffSeconds = nonNegativeInteger(cliff, "Cliff");
        call = await new VestingClient(options).create({
          grantor: address,
          beneficiary: requiredAddress(counterparty, "Beneficiary"),
          token: tokenTrimmed,
          total: positiveInteger(amount, "Amount"),
          start: BigInt(Math.floor(Date.now() / 1000)),
          cliff: cliffSeconds,
          duration: seconds,
          revocable: cancellable,
        });
      } else {
        const now = BigInt(Math.floor(Date.now() / 1000));
        call = await new EscrowClient(options).init({
          depositor: address,
          beneficiary: requiredAddress(counterparty, "Beneficiary"),
          arbiter: arbiter.trim() || null,
          token: tokenTrimmed,
          amount: positiveInteger(amount, "Amount"),
          deadline: now + positiveInteger(duration, "Deadline offset"),
        });
      }

      const sent = await call.signAndSend(signer);
      const saved = addPosition(kind, contractId, label);
      setSuccess({ hash: sent.hash, saved });
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} className="card stack stack--tight" noValidate onSubmit={(event) => void submit(event)}>
      <h3>{titles[kind]}</h3>
      <p className="small muted m-0">
        Use a fresh, uninitialized contract instance. Deploy its WASM first; this form initializes the position and adds it to this browser. Contract deployment is not available here. Amounts and stream rates use stroops.
      </p>
      <Field
        label="Deployed contract address"
        value={contractId}
        onChange={(val) => {
          setContractId(val);
          clearFieldError("contractId");
        }}
        required
        error={fieldErrors.contractId}
      />
      <Field
        label="Token contract address"
        value={token}
        onChange={(val) => {
          setToken(val);
          clearFieldError("token");
        }}
        required
        error={fieldErrors.token}
      />
      <TokenPreview token={tokenTrimmed} state={tokenMetadata} />
      <Field
        label={kind === "stream" ? "Recipient address" : "Beneficiary address"}
        value={counterparty}
        onChange={(val) => {
          setCounterparty(val);
          clearFieldError("counterparty");
        }}
        required
        error={fieldErrors.counterparty}
      />
      {kind === "escrow" ? (
        <Field
          label="Arbiter address (optional)"
          value={arbiter}
          onChange={(val) => {
            setArbiter(val);
            clearFieldError("arbiter");
          }}
          error={fieldErrors.arbiter}
        />
      ) : null}
      {kind !== "stream" ? (
        <Field
          label="Amount (stroops)"
          value={amount}
          onChange={(val) => {
            setAmount(val);
            clearFieldError("amount");
          }}
          required
          inputMode="numeric"
          error={fieldErrors.amount}
        />
      ) : null}
      {kind === "stream" ? (
        <>
          <StreamRateCalculator
            onApply={(stroops) => {
              setRate(String(stroops));
              clearFieldError("rate");
            }}
          />
          <Field
            label="Rate per second (stroops)"
            value={rate}
            onChange={(val) => {
              setRate(val);
              clearFieldError("rate");
            }}
            required
            inputMode="numeric"
            error={fieldErrors.rate}
          />
        </>
      ) : null}
      <Field
        label={kind === "escrow" ? "Seconds until deadline" : "Duration (seconds)"}
        value={duration}
        onChange={(val) => {
          setDuration(val);
          clearFieldError("duration");
        }}
        required
        inputMode="numeric"
        error={fieldErrors.duration}
      />
      {kind === "vesting" ? (
        <Field
          label="Cliff (seconds)"
          value={cliff}
          onChange={(val) => {
            setCliff(val);
            clearFieldError("cliff");
          }}
          required
          inputMode="numeric"
          error={fieldErrors.cliff}
        />
      ) : null}
      {kind === "stream" || kind === "vesting" ? (
        <label className="row small"><input type="checkbox" checked={cancellable} onChange={(event) => setCancellable(event.target.checked)} />{kind === "stream" ? "Allow cancellation" : "Revocable grant"}</label>
      ) : null}
      <Field label="Name (optional)" value={label} onChange={setLabel} />
      {error ? <ErrorNotice error={error} /> : null}
      {success ? (
        <SuccessNotice hash={success.hash}>
          {success.saved ? "Position initialized and added to this browser." : `Position initialized, but the local list was unchanged. Track this contract address if it is not already listed: ${contractId.trim()}`}
        </SuccessNotice>
      ) : null}
      <button type="submit" className="button--primary" disabled={busy || !address}>
        {busy ? "Submitting…" : titles[kind]}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required = false,
  inputMode,
  error,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputMode?: "numeric";
  error?: string | null;
}) {
  const inputId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="field">
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
      />
      {error ? (
        <span id={`${inputId}-error`} className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/**
 * What the pasted token contract is (#412): symbol, name and decimals once read,
 * a loading line while reading, and a plain error for a contract that does not
 * answer the token interface. The native token needs no read.
 */
function TokenPreview({ token, state }: { token: string; state: TokenMetadataState }) {
  if (token === NATIVE_TOKEN) {
    return (
      <p className="small muted m-0" data-testid="token-preview">
        XLM · Stellar Lumens (native) · 7 decimals
      </p>
    );
  }
  if (state.status === "loading") {
    return (
      <p className="small muted m-0" role="status">
        Reading token details…
      </p>
    );
  }
  if (state.status === "ready") {
    const { symbol, name, decimals } = state.metadata;
    return (
      <p className="small muted m-0" data-testid="token-preview">
        {symbol} · {name} · {decimals} decimals
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="field__error m-0" role="alert">
        That contract does not answer symbol(), name() and decimals(), so it is not a token.
      </p>
    );
  }
  return null;
}

type RatePeriod = "hour" | "day" | "week" | "month" | "year";

const PERIOD_SECONDS: Record<RatePeriod, bigint> = {
  hour: 3600n,
  day: 86400n,
  week: 604800n,
  month: 2592000n,  // 30 days
  year: 31536000n,  // 365 days
};

/**
 * Helper that converts a human-friendly "X XLM per period" into stroops per
 * second and fills the rate field on demand (#413).
 */
function StreamRateCalculator({ onApply }: { onApply: (stroops: bigint) => void }) {
  const [xlm, setXlm] = useState("");
  const [period, setPeriod] = useState<RatePeriod>("day");

  const computed = (() => {
    const v = parseFloat(xlm);
    if (!xlm || isNaN(v) || v <= 0) return null;
    const stroopsTotal = BigInt(Math.round(v * 1e7));
    const seconds = PERIOD_SECONDS[period];
    const rate = stroopsTotal / seconds;
    return rate > 0n ? rate : null;
  })();

  return (
    <div
      className="stack stack--tight"
      style={{
        background: "var(--surface-sunken)",
        borderRadius: "var(--radius)",
        padding: "0.75rem",
      }}
    >
      <div className="small muted">Rate calculator</div>
      <div className="row" style={{ gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: "1 1 8rem", margin: 0 }}>
          <label className="label" htmlFor="calc-xlm">Amount (XLM)</label>
          <input
            id="calc-xlm"
            type="number"
            min="0"
            step="0.0000001"
            placeholder="e.g. 100"
            value={xlm}
            onChange={(e) => setXlm(e.target.value)}
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="calc-period">per</label>
          <select
            id="calc-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as RatePeriod)}
          >
            <option value="hour">Hour</option>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month (30d)</option>
            <option value="year">Year (365d)</option>
          </select>
        </div>
      </div>
      {computed !== null ? (
        <div className="row small" style={{ gap: "0.5rem", alignItems: "center" }}>
          <span className="muted">= </span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{String(computed)}</span>
          <span className="muted"> stroops/sec</span>
          <button
            type="button"
            className="button--primary"
            style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
            onClick={() => onApply(computed)}
          >
            Use
          </button>
        </div>
      ) : null}
    </div>
  );
}

function positiveInteger(value: string, name: string): bigint {
  const parsed = nonNegativeInteger(value, name);
  if (parsed <= 0n) throw new Error(`${name} must be greater than zero.`);
  return parsed;
}

function nonNegativeInteger(value: string, name: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number.`);
  return BigInt(value);
}

function requiredAddress(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^G[A-Z2-7]{55}$/.test(trimmed)) throw new Error(`${name} must be a valid Stellar account address.`);
  return trimmed;
}
