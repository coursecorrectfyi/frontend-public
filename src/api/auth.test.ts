import { describe, expect, it } from 'vitest'
import { makeBackendTokens } from '@/test/fixtures'
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
    await expect(firebaseLogin('bad')).rejects.toThrow('Invalid Firebase ID token')
  })

  it('rejects with a generic message when the error response is empty', async () => {
    mockApi('post', '/api/v1/auth/firebase/login', () => new Response(null, { status: 500 }))
    await expect(firebaseLogin('x')).rejects.toThrow('Firebase login failed')
  })
})
