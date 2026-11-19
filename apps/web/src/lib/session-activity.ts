/**
 * Transactions submitted during this browser session, with their status.
 *
 * The store lives in memory and mirrors itself to `sessionStorage` when that
 * is available, so a reload keeps the list. Nothing here touches the network:
 * `trackSubmit` records what the app already submits, and `refreshPending`
 * asks an RPC server for the status of hashes that are still pending.
 */

export type SessionTxStatus = "pending" | "confirmed" | "failed";

export interface SessionTx {
  id: string;
  /** What the user did, e.g. "Withdraw". Plain text, never a contract error. */
  label: string;
  /** Known once the network accepts the transaction; `null` before that. */
  hash: string | null;
  status: SessionTxStatus;
  /** Milliseconds since the epoch. */
  submittedAt: number;
}

/** The slice of an RPC server the store needs to check a hash. */
export interface TxStatusSource {
  getTransaction(hash: string): Promise<{ status: string }>;
}

const STORAGE_KEY = "sororail.sessionActivity";
const MAX_ENTRIES = 50;
const STATUSES: readonly SessionTxStatus[] = ["pending", "confirmed", "failed"];

type Listener = () => void;

function isEntry(value: unknown): value is SessionTx {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry["id"] === "string" &&
    typeof entry["label"] === "string" &&
    (entry["hash"] === null || typeof entry["hash"] === "string") &&
    typeof entry["status"] === "string" &&
    STATUSES.includes(entry["status"] as SessionTxStatus) &&
    typeof entry["submittedAt"] === "number"
  );
}

function load(storage: Storage | null): readonly SessionTx[] {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, MAX_ENTRIES) : [];
  } catch {
    // Private windows and blocked storage can throw; the list just starts empty.
    return [];
  }
}

export class SessionActivityStore {
  #entries: readonly SessionTx[];
  readonly #storage: Storage | null;
  readonly #listeners = new Set<Listener>();
  #seq = 0;

  constructor(storage: Storage | null = null) {
    this.#storage = storage;
    this.#entries = load(storage);
  }

  /** Newest first. The same array is returned until something changes. */
  list = (): readonly SessionTx[] => this.#entries;

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  add(label: string, status: SessionTxStatus = "pending"): string {
    this.#seq += 1;
    const id = `${Date.now().toString(36)}-${this.#seq.toString(36)}`;
    const entry: SessionTx = { id, label, hash: null, status, submittedAt: Date.now() };
    this.#set([entry, ...this.#entries].slice(0, MAX_ENTRIES));
    return id;
  }

  update(id: string, patch: { hash?: string; status?: SessionTxStatus }): void {
    if (!this.#entries.some((entry) => entry.id === id)) return;
    this.#set(this.#entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  /** Checks every pending transaction that has a hash. Failures leave the entry pending. */
  async refreshPending(source: TxStatusSource): Promise<void> {
    for (const entry of this.#entries) {
      if (entry.status !== "pending" || entry.hash === null) continue;
      let response: { status: string };
      try {
        response = await source.getTransaction(entry.hash);
      } catch {
        continue;
      }
      if (response.status === "SUCCESS") this.update(entry.id, { status: "confirmed" });
      else if (response.status === "FAILED") this.update(entry.id, { status: "failed" });
    }
  }

  #set(entries: readonly SessionTx[]): void {
    this.#entries = entries;
    try {
      this.#storage?.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Quota or blocked storage: the in-memory list still works.
    }
    for (const listener of this.#listeners) listener();
  }
}

function browserSessionStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The app-wide store, shown by `SessionActivityPanel`. */
export const sessionActivity = new SessionActivityStore(browserSessionStorage());

/**
 * Records a submission around the call that already sends it. The entry is
 * `pending` until `send` resolves (the SDK resolves only once the transaction
 * is in a ledger), then `confirmed` with its hash; if `send` rejects it is
 * `failed`. The original result or error is passed through unchanged.
 */
export async function trackSubmit<T extends { hash: string }>(
  label: string,
  send: () => Promise<T>,
  store: SessionActivityStore = sessionActivity,
): Promise<T> {
  const id = store.add(label);
  try {
    const sent = await send();
    store.update(id, { hash: sent.hash, status: "confirmed" });
    return sent;
  } catch (error) {
    store.update(id, { status: "failed" });
    throw error;
  }
}
