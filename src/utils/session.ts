const SESSION_ID_KEY = 'cc_session_id'

/**
 * Returns the anonymous session ID from localStorage, creating one if it doesn't exist.
 * Used as the identity for anonymous users in chat usage tracking and chatId derivation.
 * Returns an empty string during SSR (no localStorage).
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_ID_KEY, id)
  }
  return id
}
