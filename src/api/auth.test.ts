import { describe, expect, it } from 'vitest'
import { limitResponse, makeBackendTokens, makeRateLimited } from '@/test/fixtures'
import { mockApi } from '@/test/msw'
import { firebaseLogin } from './auth'

// Contract: docs/backend-api.md → "POST /api/v1/auth/firebase/login".

describe('firebaseLogin', () => {
  it('exchanges a Firebase ID token for backend tokens', async () => {
    const tokens = makeBackendTokens()
    const calls = mockApi('post', '/api/v1/auth/firebase/login', tokens)

    await expect(firebaseLogin('firebase-id-token')).resolves.toEqual(tokens)

    expect(calls[0].headers.get('content-type')).toBe('application/json')
    expect(JSON.parse(calls[0].body)).toEqual({ idToken: 'firebase-id-token' })
  })

  it('rejects with the backend error text on 401', async () => {
    mockApi('post', '/api/v1/auth/firebase/login', { error: 'Invalid Firebase ID token' }, { status: 401 })
    await expect(firebaseLogin('bad')).rejects.toMatchObject({ name: 'ApiError', status: 401, message: 'Invalid Firebase ID token' })
  })

  it.each([
    ['provider_not_allowed', 'This sign-in method is not supported'],
    ['email_not_verified', 'Verify your email address before signing in'],
  ])('keeps the 403 code %s so the UI can explain it', async (code, error) => {
    mockApi('post', '/api/v1/auth/firebase/login', { error, code }, { status: 403 })
    await expect(firebaseLogin('x')).rejects.toMatchObject({ status: 403, code, message: error })
  })

  it('passes on the backend message when logins are rate limited', async () => {
    mockApi('post', '/api/v1/auth/firebase/login', () => limitResponse(makeRateLimited()))
    await expect(firebaseLogin('x')).rejects.toMatchObject({
      status: 429,
      message: 'Too many requests. Please wait a moment and try again.',
    })
  })

  it('rejects with a generic message when the error response is empty', async () => {
    mockApi('post', '/api/v1/auth/firebase/login', () => new Response(null, { status: 500 }))
    await expect(firebaseLogin('x')).rejects.toThrow('Firebase login failed')
  })
})
