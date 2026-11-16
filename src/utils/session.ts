const SESSION_ID_KEY = 'cc_session_id'

/** Any-case UUID, as the backend accepts for X-Session-ID (docs/backend-api.md → "POST /api/v1/chat", Identity). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID.test(value)
}

/**
 * A random UUID v4. `crypto.randomUUID` only exists in secure contexts (https, localhost); `getRandomValues`
 * exists everywhere, so it is the fallback (e.g. the dev server opened through a LAN address over http).
 */
export function randomUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Used when localStorage is unavailable (disabled, or throws), so the id at least stays the same for the page. */
let inMemoryId: string | undefined

/**
 * Returns the anonymous session ID (one UUID per browser, kept in localStorage and reused), creating one if there
 * is none. A stored value that is not a UUID is replaced: the backend answers 400 to it.
 * Used as the identity for anonymous users in chat usage tracking and chatId derivation.
 * Returns an empty string during SSR (no localStorage).
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''

  let stored: string | null = null
  try {
    stored = localStorage.getItem(SESSION_ID_KEY)
  } catch {
    // Storage unavailable: fall through to the in-memory id.
  }
  if (stored && isUuid(stored.trim())) return stored.trim()

  const id = inMemoryId ?? randomUuid()
  try {
    localStorage.setItem(SESSION_ID_KEY, id)
    inMemoryId = undefined
  } catch {
    inMemoryId = id
  }
  return id
}
