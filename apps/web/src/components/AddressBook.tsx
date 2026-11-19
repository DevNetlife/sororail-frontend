"use client";

import { useState } from "react";

import {
  addAddressBookEntry,
  MAX_LABEL_LENGTH,
  removeAddressBookEntry,
  type AddressBookEntry,
} from "@/lib/addressBook";

export function AddressBook({
  entries,
  onChange,
}: {
  entries: AddressBookEntry[];
  onChange: (entries: AddressBookEntry[]) => void;
}) {
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card stack stack--tight">
      <h2 id="address-book-heading">Address book</h2>
      <p className="small muted m-0">
        Label recipients to recognise them in the payroll list. Labels are kept
        in this session only and are cleared when the page is reloaded.
      </p>
      <form
        className="stack stack--tight"
        onSubmit={(event) => {
          event.preventDefault();
          const result = addAddressBookEntry(entries, address, label);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setError(null);
          onChange(result.entries);
          setAddress("");
          setLabel("");
        }}
      >
        <label htmlFor="address-book-address">Account address</label>
        <input
          id="address-book-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <label htmlFor="address-book-label">Label</label>
        <input
          id="address-book-label"
          value={label}
          maxLength={MAX_LABEL_LENGTH}
          onChange={(event) => setLabel(event.target.value)}
          autoComplete="off"
        />
        <div>
          <button type="submit" className="button--primary">
            Add label
          </button>
        </div>
      </form>
      {error ? (
        <p className="small text-danger m-0" role="alert">
          {error}
        </p>
      ) : null}
      {entries.length === 0 ? (
        <p className="small muted m-0">No labels yet.</p>
      ) : (
        <ul className="stack stack--tight" aria-labelledby="address-book-heading">
          {entries.map((entry) => (
            <li key={entry.address}>
              <span>{entry.label}</span>{" "}
              <code className="small">{entry.address}</code>{" "}
              <button
                type="button"
                className="button"
                onClick={() => onChange(removeAddressBookEntry(entries, entry.address))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
