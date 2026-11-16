import { describe, expect, it } from 'vitest'
import { makeChatUnavailable, makeDailyLimit, makeRateLimited } from '@/test/fixtures'
import {
  ApiError,
  isApiError,
  isDailyLimit,
  isNetworkError,
  isNotFound,
  isRateLimited,
  isServerError,
  parseErrorBody,
  parseRetryAfterHeader,
  pathSegment,
  readApiError,
} from './errors'

// Contract: docs/backend-api.md → "Conventions" (error bodies) and "429 responses".

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

describe('readApiError', () => {
  it('keeps everything a 429 rate limit carries, with its user-facing message', async () => {
    const e = await readApiError(json(makeRateLimited({ retryAfter: 2 }), 429, { 'Retry-After': '2' }), 'fallback')
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toBeInstanceOf(Error)
    expect(e).toMatchObject({
      name: 'ApiError',
      status: 429,
      code: 'rate_limited',
      message: 'Too many requests. Please wait a moment and try again.',
      serverError: 'Too many requests',
      retryAfter: 2,
      limitReached: false,
    })
  })

  it('keeps the scope of a daily limit', async () => {
    const e = await readApiError(json(makeDailyLimit('ip'), 429), 'fallback')
    expect(e).toMatchObject({ code: 'daily_limit', scope: 'ip', limitReached: true })
    expect(e.message).toBe('Too many questions from your network today. Sign in to get 10 questions per day.')
  })

  it('uses the fallback text when the body has no user-facing message', async () => {
    const e = await readApiError(json({ error: 'Not found' }, 404), 'Failed to fetch resource')
    expect(e.message).toBe('Failed to fetch resource')
    expect(e.serverError).toBe('Not found')
    expect(e.status).toBe(404)
  })

  it('can build the fallback from the body (e.g. to show `error`)', async () => {
    const e = await readApiError(json({ error: 'Invalid Firebase ID token' }, 401), body => body.error ?? 'generic')
    expect(e.message).toBe('Invalid Firebase ID token')
  })

  it('keeps maxLength (chat 400) and maxBytes (413)', async () => {
    const tooLong = await readApiError(json({ error: 'message must be at most 4000 characters', maxLength: 4000 }, 400), 'x')
    expect(tooLong.maxLength).toBe(4000)
    const tooLarge = await readApiError(json({ error: 'Request body too large', maxBytes: 16384 }, 413), 'x')
    expect(tooLarge.maxBytes).toBe(16384)
  })

  it.each([
    ['an empty body', new Response(null, { status: 502 })],
    ['an HTML error page', new Response('<html>Bad gateway</html>', { status: 502 })],
    ['a JSON array', json(['x'], 502)],
    ['JSON null', json(null, 502)],
  ])('never throws on %s: it just carries the status and the fallback', async (_label, response) => {
    const e = await readApiError(response, 'Server problem')
    expect(e).toMatchObject({ status: 502, message: 'Server problem', code: undefined, retryAfter: undefined })
  })

  it('reads Retry-After from the header when the body has no retryAfter', async () => {
    const e = await readApiError(new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '7' } }), 'x')
    expect(e.retryAfter).toBe(7)
  })

  it("prefers the body's retryAfter over the header", async () => {
    const e = await readApiError(json(makeRateLimited({ retryAfter: 4 }), 429, { 'Retry-After': '9' }), 'x')
    expect(e.retryAfter).toBe(4)
  })

  it('ignores fields of the wrong type', async () => {
    const e = await readApiError(
      json({ error: 1, code: ['x'], message: '', retryAfter: '3', limitReached: 'yes', scope: null }, 429),
      'fallback',
    )
    expect(e).toMatchObject({ message: 'fallback', serverError: undefined, code: undefined, retryAfter: undefined })
    expect(e.limitReached).toBeUndefined()
    expect(e.scope).toBeUndefined()
  })
})

describe('parseErrorBody', () => {
  it('rejects negative and non-finite numbers', () => {
    expect(parseErrorBody({ retryAfter: -1, maxLength: Infinity })).toMatchObject({ retryAfter: undefined, maxLength: undefined })
  })
})

describe('parseRetryAfterHeader', () => {
  const NOW = Date.parse('2026-03-01T12:00:00Z')

  it.each([
    [null, undefined],
    ['', undefined],
    ['  5 ', 5],
    ['0', 0],
    ['soon', undefined],
    ['Sun, 01 Mar 2026 12:00:30 GMT', 30],
    ['Sun, 01 Mar 2026 11:00:00 GMT', 0], // in the past: no wait
  ])('%j → %j seconds', (value, expected) => {
    expect(parseRetryAfterHeader(value, NOW)).toBe(expected)
  })
})

describe('classification', () => {
  const error = (status: number, body = {}) => new ApiError(status, 'm', body)

  it('tells a temporary rate limit from a daily limit by code', () => {
    expect(isRateLimited(error(429, makeRateLimited()))).toBe(true)
    expect(isDailyLimit(error(429, makeRateLimited()))).toBe(false)
    expect(isDailyLimit(error(429, makeDailyLimit('user')))).toBe(true)
    expect(isRateLimited(error(429, makeDailyLimit('user')))).toBe(false)
  })

  it('falls back to limitReached only when a 429 has no code', () => {
    expect(isDailyLimit(error(429, { limitReached: true }))).toBe(true)
    expect(isRateLimited(error(429, {}))).toBe(true) // unknown 429: temporary
    // code wins over limitReached
    expect(isDailyLimit(error(429, { code: 'rate_limited', limitReached: true }))).toBe(false)
  })

  it('only calls 429s limits', () => {
    expect(isRateLimited(error(503, makeChatUnavailable()))).toBe(false)
    expect(isDailyLimit(error(400, { code: 'daily_limit' }))).toBe(false)
  })

  it('recognises not found, server errors and network errors', () => {
    expect(isNotFound(error(404))).toBe(true)
    expect(isNotFound(error(400))).toBe(false)
    expect(isServerError(error(500))).toBe(true)
    expect(isServerError(error(503))).toBe(true)
    expect(isServerError(error(499))).toBe(false)
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('x'))).toBe(false)
    expect(isApiError(new Error('x'))).toBe(false)
    expect(isNotFound(new Error('404'))).toBe(false)
  })
})

describe('pathSegment', () => {
  it.each([
    ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'],
    ['data-science', 'data-science'],
    ['../saved', '..%2Fsaved'],
    ['a/b?c#d', 'a%2Fb%3Fc%23d'],
    ['%2e%2e', '%252e%252e'], // encoded: no longer a dot segment
  ])('encodes %j as one segment', (value, expected) => {
    expect(pathSegment(value)).toBe(expected)
  })

  it.each(['', '.', '..'])('refuses %j (URL parsers would resolve it)', value => {
    expect(() => pathSegment(value)).toThrow('Invalid path segment')
  })
})
