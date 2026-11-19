"use client";

import { AddressBook } from "@/components/AddressBook";
import { Confirm } from "@/components/Confirm";
import { ContractLink } from "@/components/ContractLink";
import { ErrorNotice } from "@/components/Feedback";
import { Money } from "@/components/Money";
import { PayrollChunkProgress } from "@/components/PayrollChunkProgress";
import { PayrollPreview } from "@/components/PayrollPreview";
import { PayrollResults } from "@/components/PayrollResults";
import { usePayroll } from "@/hooks/usePayroll";
import { BATCH_PAYOUT_CONTRACT } from "@/lib/network";

export default function PayrollPage() {
  const payroll = usePayroll();
  const {
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
    valid,
    invalid,
    total,
    decimals,
    decimalsKnown,
    batches,
    preview,
    confirming,
    setConfirming,
    busy,
    sendError,
    setSendError,
    send,
    chunks,
    retryFrom,
    draft,
    restoreDraft,
  } = payroll;

  return (
    <div className="stack">
      <div>
        <h1>Payroll</h1>
        <p className="muted page-intro">
          Pay many recipients in contract-sized batches. Each batch is
          all-or-nothing: if any transfer fails, nobody in that batch is paid.
        </p>
      </div>

      {!address ? (
        <div className="card">
          <p className="small muted">Connect a wallet to run a payout.</p>
          <button type="button" className="button--primary" onClick={() => void connect()}>
            Connect wallet
          </button>
        </div>
      ) : null}

      <AddressBook entries={addressBook} onChange={setAddressBook} />

      <div className="card stack stack--tight">
        <h2 id="recipients-heading">Recipients</h2>
        <p className="small muted m-0">
          One per line: <code>account address, amount</code>. Lines starting
          with <code>#</code> are ignored. Paste below, or drop/upload a CSV
          file.
        </p>

        <div
          className={`dropzone${dragActive ? " dropzone--active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files?.[0];
            if (file) loadCsvFile(file);
          }}
        >
          <p className="small muted m-0">Drag a .csv file here, or</p>
          <label className="button" htmlFor="payroll-csv-file">
            Choose file
          </label>
          <button type="button" className="button" onClick={downloadTemplate}>
            Download template
          </button>
          <input
            id="payroll-csv-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) loadCsvFile(file);
              event.target.value = "";
            }}
          />
        </div>
        {fileError ? <p className="small text-danger m-0">{fileError}</p> : null}

        {draft.savedDraft && !csv ? (
          <div className="notice notice--info">
            <div className="notice__title">Restore your unsent payroll?</div>
            <div className="notice__detail">
              A draft from an earlier visit is saved in this browser only.
            </div>
            <div className="row">
              <button type="button" onClick={restoreDraft}>
                Restore draft
              </button>
              <button type="button" onClick={draft.clear}>
                Discard draft
              </button>
            </div>
          </div>
        ) : null}

        <label htmlFor="payroll-csv-textarea" className="sr-only">
          Payroll CSV data
        </label>
        <textarea
          id="payroll-csv-textarea"
          value={csv}
          onChange={(event) => editCsv(event.target.value)}
          placeholder={"# address,amount\nGABC…,12.50\nGDEF…,100"}
          spellCheck={false}
        />

        <PayrollPreview {...payroll} />

        <div className="spread">
          <div>
            <div className="label">Total</div>
            <Money value={total} size="lg" decimals={decimals ?? undefined} />
            <span className="small muted ml-md">
              {valid.length} recipient{valid.length === 1 ? "" : "s"}
              {invalid.length > 0 ? `, ${invalid.length} line(s) to fix` : ""}
            </span>
          </div>
          <div className="row">
            <button
              type="button"
              onClick={() => void preview()}
              disabled={!address || !decimalsKnown || !batches || valid.length === 0 || invalid.length > 0}
            >
              Check against chain
            </button>
            <button
              type="button"
              className="button--primary"
              onClick={() => setConfirming(true)}
              disabled={!signer || !decimalsKnown || !batches || valid.length === 0 || invalid.length > 0}
            >
              Pay {valid.length || ""}
            </button>
          </div>
        </div>

        <PayrollResults {...payroll} />
      </div>

      <p className="small muted">
        Batch payout contract{" "}
        <ContractLink className="addr" id={BATCH_PAYOUT_CONTRACT}>
          {BATCH_PAYOUT_CONTRACT}
        </ContractLink>
        . It is stateless and holds no funds, so this one deployment is shared
        by everybody.
      </p>

      {confirming ? (
        <Confirm
          title={`Pay ${valid.length} recipient${valid.length === 1 ? "" : "s"}`}
          lines={[
            { label: "Total", value: <Money value={total} decimals={decimals ?? undefined} /> },
            { label: "Recipients", value: valid.length },
            { label: "Transactions", value: batches?.length ?? 0 },
            {
              label: "Paid from",
              value: address ? <span className="addr">{address}</span> : "—",
            },
          ]}
          irreversible={
            (batches?.length ?? 0) > 1
              ? `The payments settle on chain and cannot be reversed. This is sent as ${batches?.length} separate transactions — each is all-or-nothing on its own, so an earlier batch stays paid even if a later one fails. Ensure your account balance covers the total amount.`
              : "The payments settle on chain and cannot be reversed. If any single transfer fails, the whole batch is rolled back and nobody is paid. Ensure your account balance covers the total amount."
          }
          confirmLabel={`Pay ${valid.length}`}
          busy={busy}
          error={
            sendError || chunks.length > 1 ? (
              <>
                <PayrollChunkProgress chunks={chunks} busy={busy} onRetry={(index) => void retryFrom(index)} />
                {sendError ? <ErrorNotice error={sendError} /> : null}
              </>
            ) : null
          }
          onConfirm={() => void send()}
          onCancel={() => {
            setConfirming(false);
            setSendError(null);
          }}
        />
      ) : null}
    </div>
  );
}
