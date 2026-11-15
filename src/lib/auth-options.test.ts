// @vitest-environment node
import type { Account, Session, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import type { CredentialsConfig } from 'next-auth/providers/credentials'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendTokens } from '@/types/next-auth'
import { allowConsole } from '@/test/console'
import { makeBackendTokens } from '@/test/fixtures'
import { HttpResponse, http, mockApi, server } from '@/test/msw'
import { authOptions, isValidBackendTokens, isValidRefreshResponse } from './auth-options'

const NOW = new Date('2026-03-01T12:00:00.000Z').getTime()
const HOUR = 60 * 60 * 1000

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

// ── Helpers that call the NextAuth callbacks the way NextAuth does ────────────

// NextAuth keeps the options passed to CredentialsProvider({...}) under `.options` and merges them at runtime.
const provider = authOptions.providers[0] as unknown as CredentialsConfig & {
  options: { id: string; authorize: CredentialsConfig['authorize'] }
}
const authorize = (credentials: Record<string, string> | undefined) =>
  provider.options.authorize(credentials as never, {} as never)

const jwt = (args: { token: JWT; user?: unknown; account?: Account | null; trigger?: 'signIn' | 'signUp' | 'update' }) =>
  authOptions.callbacks!.jwt!(args as never) as Promise<JWT>

const credentialsFor = (tokens: BackendTokens) => ({
  token: tokens.token,
  refreshToken: tokens.refreshToken,
  tokenExpires: String(tokens.tokenExpires),
  user: JSON.stringify(tokens.user),
})

// ── Configuration ─────────────────────────────────────────────────────────────

describe('authOptions', () => {
  it('uses a JWT session that lasts as long as the backend refresh token (7 days)', () => {
    expect(authOptions.session).toEqual({ strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 })
  })

  it('has a single credentials provider with the id the client signs in with', () => {
    expect(authOptions.providers).toHaveLength(1)
    expect(provider.type).toBe('credentials')
    expect(provider.options.id).toBe('firebase-backend')
  })
})

// ── authorize ─────────────────────────────────────────────────────────────────

describe('authorize (credentials from the browser after the Firebase login exchange)', () => {
  it('accepts valid backend tokens and returns them as the NextAuth user', async () => {
    const tokens = makeBackendTokens()
    const user = await authorize(credentialsFor(tokens))
    expect(user).toEqual({ id: tokens.user.id, ...tokens })
  })

  it('converts tokenExpires from the form string to a number (ms since epoch)', async () => {
    const tokens = makeBackendTokens({ tokenExpires: NOW + HOUR })
    const user = (await authorize(credentialsFor(tokens))) as unknown as BackendTokens
    expect(user.tokenExpires).toBe(NOW + HOUR)
  })

  it.each(['token', 'refreshToken', 'user'])('rejects credentials without %s', async field => {
    const credentials: Record<string, string> = credentialsFor(makeBackendTokens())
    delete credentials[field]
    await expect(authorize(credentials)).resolves.toBeNull()
  })

  it('rejects missing credentials', async () => {
    await expect(authorize(undefined)).resolves.toBeNull()
  })

  it('rejects a user object that does not match the backend contract', async () => {
    const credentials = credentialsFor(makeBackendTokens())
    credentials.user = JSON.stringify({ id: 'u1' }) // no email/provider/role/...
    await expect(authorize(credentials)).resolves.toBeNull()
  })

  it('does not sign in with a user that is not valid JSON', async () => {
    const credentials = { ...credentialsFor(makeBackendTokens()), user: '{not json' }
    const result = await authorize(credentials).catch(() => null)
    expect(result).toBeNull()
  })
})

// ── isValidBackendTokens / isValidRefreshResponse ────────────────────────────

describe('isValidBackendTokens', () => {
  it('accepts the login response shape from the contract', () => {
    expect(isValidBackendTokens(makeBackendTokens())).toBe(true)
  })

  it('accepts null email and names (Google accounts may not share them)', () => {
    expect(isValidBackendTokens(makeBackendTokens({ user: { email: null, firstName: null, lastName: null } }))).toBe(true)
  })

  it.each<[string, (t: BackendTokens) => unknown]>([
    ['null', () => null],
    ['a string', () => 'token'],
    ['tokenExpires as a string', t => ({ ...t, tokenExpires: String(t.tokenExpires) })],
    ['a missing refresh token', t => ({ ...t, refreshToken: undefined })],
    ['no user', t => ({ ...t, user: undefined })],
    ['a numeric user id', t => ({ ...t, user: { ...t.user, id: 1 } })],
    ['a missing socialId', t => ({ ...t, user: { ...t.user, socialId: undefined } })],
    ['a missing provider', t => ({ ...t, user: { ...t.user, provider: undefined } })],
    ['a role without an id', t => ({ ...t, user: { ...t.user, role: {} } })],
    ['a null status', t => ({ ...t, user: { ...t.user, status: null } })],
    ['a missing createdAt', t => ({ ...t, user: { ...t.user, createdAt: undefined } })],
  ])('rejects %s', (_label, build) => {
    expect(isValidBackendTokens(build(makeBackendTokens()))).toBe(false)
  })
})

describe('isValidRefreshResponse', () => {
  it('accepts { token, refreshToken, tokenExpires } (the refresh endpoint sends no user)', () => {
    expect(isValidRefreshResponse({ token: 'a', refreshToken: 'b', tokenExpires: 1 })).toBe(true)
  })

  it.each([null, {}, { error: 'Invalid or expired token' }, { token: 'a', refreshToken: 'b', tokenExpires: '1' }])(
    'rejects %j',
    data => {
      expect(isValidRefreshResponse(data)).toBe(false)
    },
  )
})

// ── signIn / session callbacks ────────────────────────────────────────────────

describe('signIn callback', () => {
  it('attaches the backend tokens to the account for the firebase-backend provider', async () => {
    const tokens = makeBackendTokens()
    const account = { provider: 'firebase-backend', type: 'credentials', providerAccountId: 'x' } as Account
    const allowed = await authOptions.callbacks!.signIn!({ user: tokens as unknown as User, account } as never)
    expect(allowed).toBe(true)
    expect(account.backendTokens).toBe(tokens)
  })
})

describe('session callback', () => {
  it('exposes the backend tokens to the client session', async () => {
    const tokens = makeBackendTokens()
    const session = { user: {}, expires: 'x' } as Session
    const result = await authOptions.callbacks!.session!({ session, token: { backendTokens: tokens } } as never)
    expect((result as Session).backendTokens).toBe(tokens)
  })

  it('leaves the session without tokens when the JWT has none (e.g. after a failed refresh)', async () => {
    const session = { user: {}, expires: 'x' } as Session
    const result = await authOptions.callbacks!.session!({ session, token: {} } as never)
    expect((result as Session).backendTokens).toBeUndefined()
  })
})

// ── jwt callback: storing and refreshing tokens ──────────────────────────────

describe('jwt callback', () => {
  it('stores the backend tokens from authorize() on sign-in, without refreshing fresh tokens', async () => {
    // No refresh handler: a refresh request would fail the test.
    const tokens = makeBackendTokens({ tokenExpires: NOW + HOUR })
    const user = await authorize(credentialsFor(tokens))
    const token = await jwt({ token: {}, user, trigger: 'signIn' })
    expect(token.backendTokens).toEqual({ id: tokens.user.id, ...tokens })
  })

  it('stores backend tokens attached to the account', async () => {
    const tokens = makeBackendTokens({ tokenExpires: NOW + HOUR })
    const token = await jwt({ token: {}, account: { backendTokens: tokens } as unknown as Account })
    expect(token.backendTokens).toBe(tokens)
  })

  it('leaves a JWT without backend tokens alone', async () => {
    await expect(jwt({ token: { sub: 'x' } })).resolves.toEqual({ sub: 'x' })
  })

  describe('refresh', () => {
    const refreshed = { token: 'new-access', refreshToken: 'new-refresh', tokenExpires: NOW + HOUR }

    it('refreshes an access token that expires within 60 seconds, keeping the user', async () => {
      const calls = mockApi('post', '/api/v1/auth/refresh', refreshed)
      const old = makeBackendTokens({ tokenExpires: NOW + 59_000 })

      const token = await jwt({ token: { backendTokens: old } })

      expect(calls).toHaveLength(1)
      expect(calls[0].headers.get('authorization')).toBe(`Bearer ${old.refreshToken}`)
      expect(token.backendTokens).toEqual({ ...old, ...refreshed })
    })

    it('does not refresh while the access token has more than 60 seconds left', async () => {
      const old = makeBackendTokens({ tokenExpires: NOW + 61_000 })
      await expect(jwt({ token: { backendTokens: old } })).resolves.toEqual({ backendTokens: old })
    })

    it('refreshes on an explicit session update, even if the token is still fresh', async () => {
      const calls = mockApi('post', '/api/v1/auth/refresh', refreshed)
      const old = makeBackendTokens({ tokenExpires: NOW + HOUR })
      const token = await jwt({ token: { backendTokens: old }, trigger: 'update' })
      expect(calls).toHaveLength(1)
      expect(token.backendTokens?.token).toBe('new-access')
    })

    it('accepts a refresh response that includes the user', async () => {
      const full = makeBackendTokens({ token: 'new-access', user: { firstName: 'Grace' } })
      mockApi('post', '/api/v1/auth/refresh', full)
      const token = await jwt({ token: { backendTokens: makeBackendTokens({ tokenExpires: NOW - 1 }) } })
      expect(token.backendTokens).toEqual(full)
    })

    it('drops the backend tokens when the refresh request cannot be made (network error)', async () => {
      allowConsole('error', 'Failed to refresh token')
      server.use(http.post('http://api.test/api/v1/auth/refresh', () => HttpResponse.error()))
      const token = await jwt({ token: { backendTokens: makeBackendTokens({ tokenExpires: NOW - 1 }) } })
      expect(token.backendTokens).toBeUndefined()
    })

    // The refresh token lasts 7 days; after that the backend answers 401 and the user must sign in again.
    it.fails('KNOWN BUG (B1): drops the backend tokens when the refresh is rejected (401)', async () => {
      mockApi('post', '/api/v1/auth/refresh', { error: 'Invalid or expired token' }, { status: 401 })
      const token = await jwt({ token: { backendTokens: makeBackendTokens({ tokenExpires: NOW - 1 }) } })
      expect(token.backendTokens).toBeUndefined()
    })

    it.fails('KNOWN BUG (B1): drops the backend tokens when the refresh response is not usable', async () => {
      mockApi('post', '/api/v1/auth/refresh', { unexpected: true })
      const token = await jwt({ token: { backendTokens: makeBackendTokens({ tokenExpires: NOW - 1 }) } })
      expect(token.backendTokens).toBeUndefined()
    })
  })
})

// ── signOut event ─────────────────────────────────────────────────────────────

describe('signOut event', () => {
  const signOut = (token: JWT) => authOptions.events!.signOut!({ token } as never)

  it('tells the backend (best effort) with the access token', async () => {
    const calls = mockApi('post', '/api/v1/auth/logout', { ok: true })
    await signOut({ backendTokens: makeBackendTokens({ token: 'access' }) })
    expect(calls).toHaveLength(1)
    expect(calls[0].headers.get('authorization')).toBe('Bearer access')
  })

  it('does not call the backend when there is no access token', async () => {
    await signOut({})
  })

  it('does not fail sign-out when the backend is unreachable', async () => {
    allowConsole('error', 'Failed to logout from backend')
    server.use(http.post('http://api.test/api/v1/auth/logout', () => HttpResponse.error()))
    await expect(signOut({ backendTokens: makeBackendTokens() })).resolves.toBeUndefined()
  })
})
