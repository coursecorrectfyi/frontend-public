// @vitest-environment node
import { DynamicServerError } from 'next/dist/client/components/hooks-server-context'
import { headers } from 'next/headers'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { relayHeaders, visitorIpFrom } from './relay'

// Contract: docs/backend-api.md → "Calls from a server on a visitor's behalf".

vi.mock('next/headers', () => ({ headers: vi.fn() }))

const SECRET = 'relay-secret-for-tests'

function incoming(forwardedFor?: string) {
  vi.mocked(headers).mockResolvedValue(
    new Headers(forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor }) as never,
  )
}

beforeEach(() => {
  vi.mocked(headers).mockReset()
})

describe('visitorIpFrom', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    // The last entry is the one our platform appended; earlier ones come from the client and are ignored.
    ['1.1.1.1, 203.0.113.7', '203.0.113.7'],
    ['evil, 8.8.8.8,203.0.113.7 ', '203.0.113.7'],
    ['2001:db8::1', '2001:db8::1'],
    ['10.0.0.1, 2001:db8:85a3::8a2e:370:7334', '2001:db8:85a3::8a2e:370:7334'],
    ['::ffff:203.0.113.7', '::ffff:203.0.113.7'],
  ])('%j → %j', (header, expected) => {
    expect(visitorIpFrom(header)).toBe(expected)
  })

  it.each([
    [undefined],
    [null],
    [''],
    [' '],
    ['203.0.113.7, '], // empty last entry: don't fall back to a client-written one
    ['203.0.113.7:443'], // port
    ['[2001:db8::1]'], // brackets
    ['fe80::1%eth0'], // zone id
    ['unknown'],
    ['203.0.113.7 203.0.113.8'], // two addresses in one entry
    ['999.1.1.1'],
  ])('refuses %j (not exactly one IP address)', header => {
    expect(visitorIpFrom(header)).toBeUndefined()
  })
})

describe('relayHeaders', () => {
  it('sends the secret and the visitor address taken from the last X-Forwarded-For entry', async () => {
    vi.stubEnv('API_RELAY_SECRET', SECRET)
    incoming('6.6.6.6, 203.0.113.7')
    await expect(relayHeaders()).resolves.toEqual({ 'X-Relay-Secret': SECRET, 'X-Visitor-IP': '203.0.113.7' })
  })

  it('sends nothing, and does not read the request, when no secret is configured', async () => {
    vi.stubEnv('API_RELAY_SECRET', '')
    incoming('203.0.113.7')
    await expect(relayHeaders()).resolves.toEqual({})
    vi.stubEnv('API_RELAY_SECRET', '   ')
    await expect(relayHeaders()).resolves.toEqual({})
    expect(headers).not.toHaveBeenCalled()
  })

  it('trims the configured secret', async () => {
    vi.stubEnv('API_RELAY_SECRET', `  ${SECRET}\n`)
    incoming('203.0.113.7')
    await expect(relayHeaders()).resolves.toMatchObject({ 'X-Relay-Secret': SECRET })
  })

  it.each([[undefined], ['not-an-ip'], ['203.0.113.7, ']])(
    'sends nothing when the visitor address is unusable (X-Forwarded-For %j): the secret is never sent alone',
    async header => {
      vi.stubEnv('API_RELAY_SECRET', SECRET)
      incoming(header)
      await expect(relayHeaders()).resolves.toEqual({})
    },
  )

  it('ignores an X-Visitor-IP header sent by the browser', async () => {
    vi.stubEnv('API_RELAY_SECRET', SECRET)
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-visitor-ip': '6.6.6.6', 'x-forwarded-for': '203.0.113.7' }) as never,
    )
    await expect(relayHeaders()).resolves.toMatchObject({ 'X-Visitor-IP': '203.0.113.7' })
  })

  it('sends nothing when called outside a request (e.g. at build time)', async () => {
    vi.stubEnv('API_RELAY_SECRET', SECRET)
    vi.mocked(headers).mockRejectedValue(new Error('`headers` was called outside a request scope.'))
    await expect(relayHeaders()).resolves.toEqual({})
  })

  it("lets Next.js's own signals through (a static prerender must become a per-request render)", async () => {
    vi.stubEnv('API_RELAY_SECRET', SECRET)
    const signal = new DynamicServerError('Route used `headers()`')
    vi.mocked(headers).mockRejectedValue(signal)
    await expect(relayHeaders()).rejects.toBe(signal)
  })
})
