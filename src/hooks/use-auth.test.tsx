import { act } from '@testing-library/react'
import type { Session } from 'next-auth'
import { describe, expect, it } from 'vitest'
import { makeBackendTokens } from '@/test/fixtures'
import { mockSessionLoading, mockSignedIn, nextAuth, setSession } from '@/test/mocks/next-auth'
import { renderHookWithProviders } from '@/test/render'
import { TOKEN_REFRESH_MARGIN_MS, useAuth } from './use-auth'

// useAuth: the one definition of "signed in", and access tokens that are fresh when used.

const renderAuth = () => renderHookWithProviders(() => useAuth())

async function tokenFrom(result: { current: ReturnType<typeof useAuth> }) {
  let token: string | null = null
  await act(async () => {
    token = await result.current.getAccessToken()
  })
  return token
}

describe('useAuth', () => {
  it('is loading while NextAuth resolves the session', () => {
    mockSessionLoading()
    expect(renderAuth().result.current).toMatchObject({ status: 'loading', isSignedIn: false, userId: null })
  })

  it('is signed out without a session, and has no token', async () => {
    const { result } = renderAuth()
    expect(result.current).toMatchObject({ status: 'signed_out', isSignedIn: false, user: null })
    expect(await tokenFrom(result)).toBeNull()
  })

  it('is signed in with backend tokens, and exposes the backend user', () => {
    const session = mockSignedIn({ user: { id: 'user-1' } })
    expect(renderAuth().result.current).toMatchObject({
      status: 'signed_in',
      isSignedIn: true,
      userId: 'user-1',
      user: session.backendTokens!.user,
    })
  })

  it('treats an authenticated session without backend tokens as signed out (the session has ended)', async () => {
    setSession({ user: {}, expires: '2999-01-01T00:00:00.000Z' }, 'authenticated')
    const { result } = renderAuth()
    expect(result.current).toMatchObject({ status: 'signed_out', isSignedIn: false, userId: null })
    expect(await tokenFrom(result)).toBeNull()
  })

  describe('getAccessToken', () => {
    it('returns the current token while it is valid for more than a minute, without refreshing', async () => {
      mockSignedIn({ token: 'current', tokenExpires: Date.now() + TOKEN_REFRESH_MARGIN_MS + 5000 })
      expect(await tokenFrom(renderAuth().result)).toBe('current')
      expect(nextAuth.update).not.toHaveBeenCalled()
    })

    it.each([
      ['expires within a minute', 30_000],
      ['has already expired', -1000],
    ])('refreshes first when the token %s (a page left open over an hour)', async (_label, inMs) => {
      const session = mockSignedIn({ token: 'old', tokenExpires: Date.now() + inMs })
      const refreshed: Session = { ...session, backendTokens: makeBackendTokens({ token: 'fresh' }) }
      nextAuth.update.mockResolvedValueOnce(refreshed)
      expect(await tokenFrom(renderAuth().result)).toBe('fresh')
      expect(nextAuth.update).toHaveBeenCalledTimes(1)
    })

    it('returns null when the refresh ended the session (refresh token rejected)', async () => {
      const session = mockSignedIn({ token: 'old', tokenExpires: Date.now() - 1000 })
      nextAuth.update.mockResolvedValueOnce({ ...session, backendTokens: undefined })
      expect(await tokenFrom(renderAuth().result)).toBeNull()
    })

    it('falls back to the current token when the refresh cannot be made now', async () => {
      mockSignedIn({ token: 'old', tokenExpires: Date.now() - 1000 })
      nextAuth.update.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      expect(await tokenFrom(renderAuth().result)).toBe('old')
    })
  })
})
