import { stableHash } from './hash';

/**
 * Daily chat limits reached, remembered per identity until they reset.
 *
 * The backend enforces the limits; this only keeps the UI in step with it, so a visitor who hit a limit isn't
 * invited to type questions that would all be refused. Stored in localStorage, so it applies on every page and in
 * every tab, survives reloads and "New chat", and ends by itself at the time the backend gave (`retryAfter`).
 *
 * Only limits tied to exactly this identity lock the UI (HARD_LOCK_SCOPES). The others depend on things that can
 * change at any time (the network, everyone's usage, totals that operators can raise) and a refused request costs
 * nothing, so they are shown without locking.
 */

const STORAGE_KEY = 'cora_limits';

/** `user`: this signed-in user's daily questions. `session`: this browser's anonymous questions. */
export const HARD_LOCK_SCOPES: readonly string[] = ['user', 'session'];

export interface StoredLimit {
  /** The backend's message for the user, shown in the banner. */
  message: string;
  scope?: string;
  /** When the limit resets (ms since epoch). */
  until: number;
}

type LimitStore = Record<string, StoredLimit>;

/** Key of the identity a limit belongs to. Ids are hashed: no raw user or session id is stored. */
export function limitIdentityKey(identity: { userId?: string | null; sessionId: string }): string {
  return identity.userId ? `user:${stableHash(identity.userId)}` : `anon:${stableHash(identity.sessionId)}`;
}

/**
 * Whether a daily limit with this scope locks the UI. A missing scope (older responses: `limitReached` without
 * `scope`) was always a per-identity limit, so it locks. An unknown scope doesn't: a refused question costs nothing.
 */
export function locksUi(scope: string | undefined): boolean {
  return scope === undefined || HARD_LOCK_SCOPES.includes(scope);
}

/** The next midnight UTC after `now`: when daily limits reset if the backend gave no `retryAfter`. */
export function nextMidnightUtc(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

function isStoredLimit(value: unknown): value is StoredLimit {
  const v = value as StoredLimit;
  return typeof v === 'object' && v !== null && typeof v.message === 'string' && typeof v.until === 'number';
}

function readStore(): LimitStore {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isStoredLimit(v))) as LimitStore;
  } catch {
    return {}; // unreadable or unavailable storage: no remembered limits
  }
}

function writeStore(store: LimitStore): void {
  try {
    if (Object.keys(store).length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage unavailable: the limit then only lasts for this page, which is still correct, just less helpful.
  }
}

/** The identity's limit if it hasn't reset yet. Expired limits (of any identity) are removed on the way. */
export function readLimit(identityKey: string, now = Date.now()): StoredLimit | null {
  const store = readStore();
  const live = Object.fromEntries(Object.entries(store).filter(([, limit]) => limit.until > now));
  if (Object.keys(live).length !== Object.keys(store).length) writeStore(live);
  return live[identityKey] ?? null;
}

/** Remembers the identity's limit until `limit.until`. */
export function saveLimit(identityKey: string, limit: StoredLimit): void {
  writeStore({ ...readStore(), [identityKey]: limit });
}

/** Whether a `storage` event (another tab) may have changed the limits. */
export function isLimitStorageEvent(event: StorageEvent): boolean {
  return event.key === STORAGE_KEY || event.key === null; // null: the whole storage was cleared
}
