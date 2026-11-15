import { act, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { allowConsole } from '@/test/console'
import { makeBackendTokens } from '@/test/fixtures'
import { firebase } from '@/test/mocks/firebase'
import { nextAuth } from '@/test/mocks/next-auth'
import { createGate, mockApi } from '@/test/msw'
import { renderHookWithProviders } from '@/test/render'
import { useFirebaseSignIn } from './use-firebase-sign-in'

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
})
