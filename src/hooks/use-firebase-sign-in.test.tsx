import { act, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { allowConsole } from '@/test/console'
import { makeBackendTokens } from '@/test/fixtures'
import { firebase } from '@/test/mocks/firebase'
import { nextAuth } from '@/test/mocks/next-auth'
import { createGate, mockApi } from '@/test/msw'
import { renderHookWithProviders } from '@/test/render'
import { ApiError } from '@/api/errors'
import { limitResponse, makeRateLimited } from '@/test/fixtures'
import {
  SIGN_IN_EMAIL_NOT_VERIFIED,
  SIGN_IN_FAILED,
  SIGN_IN_METHOD_NOT_SUPPORTED,
  SIGN_IN_NETWORK,
  SIGN_IN_POPUP_BLOCKED,
  signInErrorMessage,
  useFirebaseSignIn,
} from './use-firebase-sign-in'

// Sign-in flow: Google popup (Firebase) → exchange the Firebase ID token for backend tokens →
// NextAuth session (credentials provider 'firebase-backend').

describe('useFirebaseSignIn', () => {
  it('signs in with Google, exchanges the token with the backend and starts the NextAuth session', async () => {
    const tokens = makeBackendTokens({ tokenExpires: 1_800_000_000_000 })
    firebase.signInWithGoogle.mockResolvedValueOnce('google-id-token')
    const login = mockApi('post', '/api/v1/auth/firebase/login', tokens)
    const { result } = renderHookWithProviders(() => useFirebaseSignIn())

    await act(() => result.current.signInWithFirebase())

    expect(JSON.parse(login[0].body)).toEqual({ idToken: 'google-id-token' })
    expect(nextAuth.signIn).toHaveBeenCalledWith('firebase-backend', {
      redirect: false, // stay on the page
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      tokenExpires: '1800000000000',
      user: JSON.stringify(tokens.user),
    })
    expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'user_sign_in', method: 'google' })])
    expect(result.current.signingIn).toBe(false)
  })

  it('reports signing-in while the flow runs and ignores repeated clicks', async () => {
    const gate = createGate()
    const login = mockApi('post', '/api/v1/auth/firebase/login', async () => {
      await gate.wait()
      return Response.json(makeBackendTokens())
    })
    const { result } = renderHookWithProviders(() => useFirebaseSignIn())

    let first!: Promise<void>
    act(() => {
      first = result.current.signInWithFirebase()
    })
    await waitFor(() => expect(result.current.signingIn).toBe(true))
    await act(() => result.current.signInWithFirebase()) // second click while busy

    gate.open()
    await act(() => first)
    expect(firebase.signInWithGoogle).toHaveBeenCalledTimes(1)
    expect(login).toHaveLength(1)
    expect(result.current.signingIn).toBe(false)
  })

  it('gives up quietly when the popup is closed', async () => {
    allowConsole('error', 'Firebase sign-in failed')
    firebase.signInWithGoogle.mockRejectedValueOnce(new Error('auth/popup-closed-by-user'))
    const { result } = renderHookWithProviders(() => useFirebaseSignIn())

    await act(() => result.current.signInWithFirebase()) // no login handler: a request would fail the test

    expect(nextAuth.signIn).not.toHaveBeenCalled()
    expect(window.dataLayer).toBeUndefined()
    expect(result.current.signingIn).toBe(false)
  })

  it('does not start a session when the backend rejects the token', async () => {
    allowConsole('error', 'Firebase sign-in failed')
    mockApi('post', '/api/v1/auth/firebase/login', { error: 'Invalid Firebase ID token' }, { status: 401 })
    const { result } = renderHookWithProviders(() => useFirebaseSignIn())
    await act(() => result.current.signInWithFirebase())
    expect(nextAuth.signIn).not.toHaveBeenCalled()
    expect(result.current.signingIn).toBe(false)
  })

  // Contract: docs/backend-api.md → "POST /api/v1/auth/firebase/login" (403 codes, 429).
  describe('telling the user why sign-in failed', () => {
    async function failedSignIn(respond: Parameters<typeof mockApi>[2], init?: ResponseInit) {
      allowConsole('error', 'Firebase sign-in failed')
      mockApi('post', '/api/v1/auth/firebase/login', respond as never, init)
      const hook = renderHookWithProviders(() => useFirebaseSignIn())
      await act(() => hook.result.current.signInWithFirebase())
      expect(nextAuth.signIn).not.toHaveBeenCalled()
      expect(window.dataLayer).toBeUndefined() // no sign-in tracked
      // Firebase accepted the user but the app did not: no half-signed-in Firebase session is left behind.
      expect(firebase.signOutFirebase).toHaveBeenCalled()
      return hook
    }

    it('explains a sign-in method the backend does not accept (403 provider_not_allowed)', async () => {
      const { result } = await failedSignIn({ error: 'This sign-in method is not supported', code: 'provider_not_allowed' }, { status: 403 })
      expect(result.current.error).toBe(SIGN_IN_METHOD_NOT_SUPPORTED)
    })

    it('asks to verify the email address first (403 email_not_verified)', async () => {
      const { result } = await failedSignIn({ error: 'Verify your email address before signing in', code: 'email_not_verified' }, { status: 403 })
      expect(result.current.error).toBe(SIGN_IN_EMAIL_NOT_VERIFIED)
    })

    it("shows the backend's message when logins are rate limited (429)", async () => {
      const { result } = await failedSignIn(() => limitResponse(makeRateLimited()))
      expect(result.current.error).toBe('Too many requests. Please wait a moment and try again.')
    })

    it('says sign-in failed for other refusals', async () => {
      const { result } = await failedSignIn({ error: 'Invalid Firebase ID token' }, { status: 401 })
      expect(result.current.error).toBe(SIGN_IN_FAILED)
    })

    it('can clear the message, and clears it on the next attempt', async () => {
      const { result } = await failedSignIn({ error: 'x' }, { status: 500 })
      act(() => result.current.clearError())
      expect(result.current.error).toBeNull()
    })

    it('reports a refused NextAuth sign-in instead of tracking a success', async () => {
      allowConsole('error', 'Firebase sign-in failed')
      mockApi('post', '/api/v1/auth/firebase/login', makeBackendTokens())
      nextAuth.signIn.mockResolvedValueOnce({ ok: false, error: 'CredentialsSignin', status: 401, url: null } as never)
      const { result } = renderHookWithProviders(() => useFirebaseSignIn())
      await act(() => result.current.signInWithFirebase())
      expect(result.current.error).toBe(SIGN_IN_FAILED)
      expect(window.dataLayer).toBeUndefined()
      expect(firebase.signOutFirebase).toHaveBeenCalled()
    })

    it('says nothing when the user closes the popup (their choice), and does not sign out of Firebase', async () => {
      firebase.signInWithGoogle.mockRejectedValueOnce(Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), { code: 'auth/popup-closed-by-user' }))
      const { result } = renderHookWithProviders(() => useFirebaseSignIn())
      await act(() => result.current.signInWithFirebase())
      expect(result.current.error).toBeNull()
      expect(firebase.signOutFirebase).not.toHaveBeenCalled()
    })

    it('explains a blocked popup', async () => {
      allowConsole('error', 'Firebase sign-in failed')
      firebase.signInWithGoogle.mockRejectedValueOnce(Object.assign(new Error('blocked'), { code: 'auth/popup-blocked' }))
      const { result } = renderHookWithProviders(() => useFirebaseSignIn())
      await act(() => result.current.signInWithFirebase())
      expect(result.current.error).toBe(SIGN_IN_POPUP_BLOCKED)
    })
  })

  it('tracks the actual sign-in method the backend reports', async () => {
    mockApi('post', '/api/v1/auth/firebase/login', makeBackendTokens({ user: { provider: 'github' } }))
    const { result } = renderHookWithProviders(() => useFirebaseSignIn())
    await act(() => result.current.signInWithFirebase())
    expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'user_sign_in', method: 'github' })])
  })
})

describe('signInErrorMessage', () => {
  it.each<[string, unknown, string | null]>([
    ['popup closed (code)', Object.assign(new Error('x'), { code: 'auth/popup-closed-by-user' }), null],
    ['popup closed (message only)', new Error('auth/popup-closed-by-user'), null],
    ['cancelled popup request', Object.assign(new Error('x'), { code: 'auth/cancelled-popup-request' }), null],
    ['popup blocked', Object.assign(new Error('x'), { code: 'auth/popup-blocked' }), SIGN_IN_POPUP_BLOCKED],
    ['Firebase network failure', Object.assign(new Error('x'), { code: 'auth/network-request-failed' }), SIGN_IN_NETWORK],
    ['backend unreachable', new TypeError('Failed to fetch'), SIGN_IN_NETWORK],
    ['provider_not_allowed', new ApiError(403, 'x', { code: 'provider_not_allowed' }), SIGN_IN_METHOD_NOT_SUPPORTED],
    ['email_not_verified', new ApiError(403, 'x', { code: 'email_not_verified' }), SIGN_IN_EMAIL_NOT_VERIFIED],
    ['rate limited', new ApiError(429, 'Too many requests. Please wait a moment and try again.', { code: 'rate_limited' }), 'Too many requests. Please wait a moment and try again.'],
    ['server error', new ApiError(500, 'Firebase login failed'), SIGN_IN_FAILED],
    ['anything else', new Error('boom'), SIGN_IN_FAILED],
  ])('%s', (_label, error, expected) => {
    expect(signInErrorMessage(error)).toBe(expected)
  })
})
