import { isApiError, isNetworkError, isRateLimited } from './errors'

/**
 * When TanStack Query retries a failed query (used as the app-wide default in src/app/providers.tsx).
 *
 * - Network errors and 5xx (temporary server problems): up to MAX_RETRIES retries, with backoff.
 * - 429 `rate_limited`: one retry after `retryAfter`, if that's short. A longer wait is left to the user.
 * - Daily limits and every other 4xx (404, 401, 400, ...): no retry. The same request would fail again.
 * - Anything else (a bug, an invalid id refused before any request): no retry.
 *
 * `failureCount` is the number of failures before this one (0 on the first failure).
 */
export const MAX_RETRIES = 2
export const MAX_AUTO_RETRY_AFTER_SECONDS = 10

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error)) {
    if (error.status === 429) {
      return isRateLimited(error) && failureCount < 1 && (error.retryAfter ?? 1) <= MAX_AUTO_RETRY_AFTER_SECONDS
    }
    return error.status >= 500 && failureCount < MAX_RETRIES
  }
  return isNetworkError(error) && failureCount < MAX_RETRIES
}

/** Milliseconds before the next attempt: `retryAfter` for rate limits, else TanStack Query's default backoff. */
export function retryDelay(failureCount: number, error: unknown): number {
  if (isRateLimited(error)) return (error.retryAfter ?? 1) * 1000
  return Math.min(1000 * 2 ** failureCount, 30_000)
}
