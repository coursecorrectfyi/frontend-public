import { beforeEach, describe, expect, it, vi } from 'vitest'

// lib/firebase.ts is replaced by a mock everywhere else (src/test/setup.ts); here the real module is tested
// with the Firebase SDK itself mocked, so nothing is initialised and no network is used.
vi.unmock('@/lib/firebase')

const sdk = vi.hoisted(() => ({
  apps: [] as object[],
  initializeApp: vi.fn((config: object) => ({ name: '[DEFAULT]', config })),
  getApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getAuth: vi.fn((app: object) => ({ app })),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(async () => undefined),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider(this: object) {}),
}))

vi.mock('firebase/app', () => ({
  getApps: () => sdk.apps,
  getApp: sdk.getApp,
  initializeApp: (config: object) => {
    const app = sdk.initializeApp(config)
    sdk.apps.push(app)
    return app
  },
}))
vi.mock('firebase/auth', () => ({
  getAuth: sdk.getAuth,
  GoogleAuthProvider: sdk.GoogleAuthProvider,
  signInWithPopup: sdk.signInWithPopup,
  signOut: sdk.signOut,
}))

beforeEach(() => {
  sdk.apps.length = 0
  vi.resetModules()
})

const FIREBASE_ENV = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'example',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'example.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123:web:abc',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-TEST',
}

async function load() {
  for (const [k, v] of Object.entries(FIREBASE_ENV)) vi.stubEnv(k, v)
  return import('./firebase')
}

describe('lib/firebase', () => {
  it('initialises the Firebase app once, from the NEXT_PUBLIC_FIREBASE_* configuration', async () => {
    const { getFirebaseAuth } = await load()
    getFirebaseAuth()
    getFirebaseAuth()
    expect(sdk.initializeApp).toHaveBeenCalledTimes(1)
    expect(sdk.initializeApp).toHaveBeenCalledWith({
      apiKey: 'key',
      authDomain: 'example.firebaseapp.com',
      projectId: 'example',
      storageBucket: 'example.firebasestorage.app',
      messagingSenderId: '123',
      appId: '1:123:web:abc',
      measurementId: 'G-TEST',
    })
    expect(sdk.getApp).toHaveBeenCalledTimes(1)
  })

  it('signs in with the Google popup and returns the Firebase ID token', async () => {
    const getIdToken = vi.fn(async () => 'google-id-token')
    sdk.signInWithPopup.mockResolvedValueOnce({ user: { getIdToken } })
    const { signInWithGoogle } = await load()

    await expect(signInWithGoogle()).resolves.toBe('google-id-token')
    expect(sdk.signInWithPopup).toHaveBeenCalledWith(expect.anything(), expect.any(sdk.GoogleAuthProvider))
  })

  it('propagates popup failures (e.g. closed by the user)', async () => {
    sdk.signInWithPopup.mockRejectedValueOnce(new Error('auth/popup-closed-by-user'))
    const { signInWithGoogle } = await load()
    await expect(signInWithGoogle()).rejects.toThrow('auth/popup-closed-by-user')
  })

  it('signs out of Firebase', async () => {
    const { signOutFirebase } = await load()
    await signOutFirebase()
    expect(sdk.signOut).toHaveBeenCalledTimes(1)
  })
})
