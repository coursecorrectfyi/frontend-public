/**
 * Errors from the CourseCorrect backend, as described in docs/backend-api.md ("Conventions", "429 responses").
 *
 * Every API client turns a non-2xx response into an `ApiError` (via `readApiError`), so callers can tell a
 * temporary rate limit from a daily limit, "not found" from a server problem, and show the backend's
 * user-facing `message` where the contract provides one. Network failures stay what `fetch` throws (a
 * `TypeError`); `isNetworkError` recognises them.
 */

/** `code` values the contract documents. Other strings may appear; treat them as unknown. */
export type ApiErrorCode =
  | 'rate_limited'
  | 'daily_limit'
  | 'chat_unavailable'
  | 'chat_signed_in_only'
  | 'provider_not_allowed'
  | 'email_not_verified'

/** `scope` of a daily chat limit (429 `daily_limit`). */
export type LimitScope = 'user' | 'session' | 'ip' | 'global' | 'signed_in_global'

/** The fields an error body may carry. Every field is optional: bodies are parsed defensively. */
export interface ApiErrorBody {
  error?: string
  code?: ApiErrorCode | (string & {})
  /** Text meant for the end user (429s, chat 503s). */
  message?: string
  /** Seconds until the request may be sent again (429s). */
  retryAfter?: number
  limitReached?: boolean
  scope?: LimitScope | (string & {})
  /** `message must be at most 4000 characters` (chat 400). */
  maxLength?: number
  /** `Request body too large` (413). */
  maxBytes?: number
}

export class ApiError extends Error {
  override readonly name = 'ApiError'
  /** HTTP status of the response. */
  readonly status: number
  /** Machine-readable `code` from the body, if any. */
  readonly code?: string
  /** The body's `error` text (not written for end users; `message` is). */
  readonly serverError?: string
  /** Seconds to wait before retrying: the body's `retryAfter`, else the `Retry-After` header. */
  readonly retryAfter?: number
  readonly scope?: string
  readonly limitReached?: boolean
  readonly maxLength?: number
  readonly maxBytes?: number

  constructor(status: number, message: string, body: ApiErrorBody = {}, retryAfter?: number) {
    super(message)
    this.status = status
    this.code = body.code
    this.serverError = body.error
    this.retryAfter = retryAfter
    this.scope = body.scope
    this.limitReached = body.limitReached
    this.maxLength = body.maxLength
    this.maxBytes = body.maxBytes
  }
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : undefined)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined)

/** Keeps only well-typed fields of a parsed JSON body; anything else (arrays, strings, null) gives `{}`. */
export function parseErrorBody(json: unknown): ApiErrorBody {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return {}
  const o = json as Record<string, unknown>
  return {
    error: str(o.error),
    code: str(o.code),
    message: str(o.message),
    retryAfter: num(o.retryAfter),
    limitReached: bool(o.limitReached),
    scope: str(o.scope),
    maxLength: num(o.maxLength),
    maxBytes: num(o.maxBytes),
  }
}

/** `Retry-After` as seconds: delta-seconds (what the API sends) or an HTTP date. */
export function parseRetryAfterHeader(value: string | null, now = Date.now()): number | undefined {
  if (value == null || value.trim() === '') return undefined
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const date = Date.parse(trimmed)
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - now) / 1000))
}

/**
 * Builds an `ApiError` from a failed response. Never throws: bodies that are empty, not JSON or oddly shaped
 * just carry less information.
 *
 * `message` is the body's user-facing `message` when there is one (e.g. on every 429), otherwise `fallback`
 * (a fixed text, or a function of the parsed body, e.g. to show the body's `error`).
 */
export async function readApiError(
  response: Response,
  fallback: string | ((body: ApiErrorBody) => string),
): Promise<ApiError> {
  let body: ApiErrorBody = {}
  try {
    const text = await response.text()
    if (text) body = parseErrorBody(JSON.parse(text))
  } catch {
    // Empty, unreadable or non-JSON body (e.g. an HTML error page from a proxy).
  }
  const retryAfter = body.retryAfter ?? parseRetryAfterHeader(response.headers.get('Retry-After'))
  const message = body.message ?? (typeof fallback === 'function' ? fallback(body) : fallback)
  return new ApiError(response.status, message, body, retryAfter)
}

// ── Classification ────────────────────────────────────────────────────────────

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError

/**
 * A daily chat limit: no more questions for this identity until midnight UTC. `code` decides; `limitReached`
 * (kept by the API for compatibility) is only used when a 429 has no `code`.
 */
export const isDailyLimit = (e: unknown): e is ApiError =>
  isApiError(e) && e.status === 429 && (e.code === 'daily_limit' || (e.code === undefined && e.limitReached === true))

/** A temporary (per-minute) rate limit: the same request succeeds after `retryAfter` seconds. */
export const isRateLimited = (e: unknown): e is ApiError => isApiError(e) && e.status === 429 && !isDailyLimit(e)

export const isNotFound = (e: unknown): e is ApiError => isApiError(e) && e.status === 404

/** Any 5xx: a temporary server problem ("never a reason to sign the user out"). */
export const isServerError = (e: unknown): e is ApiError => isApiError(e) && e.status >= 500

/** The request never got a response (offline, DNS, CORS, connection reset): `fetch` rejects with a TypeError. */
export const isNetworkError = (e: unknown): e is TypeError => e instanceof TypeError

// ── Paths ─────────────────────────────────────────────────────────────────────

/**
 * One URL path segment from an untrusted value (ids and slugs come from page URLs). Encoded so it can't add
 * segments, a query or a fragment. `.` and `..` survive encoding and URL parsers resolve them, so they're refused.
 */
export function pathSegment(value: string): string {
  if (value === '' || value === '.' || value === '..') throw new Error(`Invalid path segment: "${value}"`)
  return encodeURIComponent(value)
}
