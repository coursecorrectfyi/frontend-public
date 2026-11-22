import { describe, expect, it } from 'vitest'
import { makeDailyLimit, makeRateLimited } from '@/test/fixtures'
import { ApiError } from './errors'
import { MAX_AUTO_RETRY_AFTER_SECONDS, retryDelay, shouldRetry } from './retry-policy'

// The app-wide query retry policy (src/app/providers.tsx). `failureCount` = failures before this one.

const api = (status: number, body = {}, retryAfter?: number) => new ApiError(status, 'm', body, retryAfter)

describe('shouldRetry', () => {
  it.each([
    ['a 500', api(500)],
    ['a 503', api(503)],
    // "Load more" while the next page can't be ranked like the first; the contract says to retry the same request.
    ['a 503 search_unavailable', api(503, { error: 'Search is temporarily unavailable', code: 'search_unavailable' })],
    ['a network error', new TypeError('Failed to fetch')],
  ])('retries %s twice', (_label, error) => {
    expect([0, 1, 2].map(n => shouldRetry(n, error))).toEqual([true, true, false])
  })

  it.each([400, 401, 403, 404, 413])('never retries a %i', status => {
    expect(shouldRetry(0, api(status))).toBe(false)
  })

  it('retries a short rate limit once', () => {
    const e = api(429, makeRateLimited(), 2)
    expect([0, 1].map(n => shouldRetry(n, e))).toEqual([true, false])
  })

  it('leaves a long rate-limit wait to the user', () => {
    expect(shouldRetry(0, api(429, makeRateLimited(), MAX_AUTO_RETRY_AFTER_SECONDS))).toBe(true)
    expect(shouldRetry(0, api(429, makeRateLimited(), MAX_AUTO_RETRY_AFTER_SECONDS + 1))).toBe(false)
  })

  it('never retries a daily limit', () => {
    expect(shouldRetry(0, api(429, makeDailyLimit('session'), 60))).toBe(false)
    expect(shouldRetry(0, api(429, makeDailyLimit('session'), 1))).toBe(false)
  })

  it('does not retry other errors (bugs, invalid input refused before any request)', () => {
    expect(shouldRetry(0, new Error('Invalid path segment: ".."'))).toBe(false)
    expect(shouldRetry(0, new SyntaxError('Unexpected token'))).toBe(false)
  })
})

describe('retryDelay', () => {
  it('waits retryAfter seconds for a rate limit', () => {
    expect(retryDelay(0, api(429, makeRateLimited(), 3))).toBe(3000)
    expect(retryDelay(0, api(429, {}, undefined))).toBe(1000) // no Retry-After: 1 s
  })

  it('backs off exponentially otherwise (TanStack Query default), up to 30 s', () => {
    expect([0, 1, 2, 10].map(n => retryDelay(n, api(503)))).toEqual([1000, 2000, 4000, 30_000])
  })
})
