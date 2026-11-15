/**
 * Replacement for `@/lib/firebase` (installed globally in setup.ts) so the Firebase SDK is never
 * initialised in tests. lib/firebase.ts itself is tested in lib/firebase.test.ts with
 * `firebase/app` and `firebase/auth` mocked instead.
 *
 *   firebase.signInWithGoogle.mockResolvedValueOnce('id-token')
 *   firebase.signInWithGoogle.mockRejectedValueOnce(new Error('popup closed'))
 */
import { vi } from 'vitest'

export const firebase = {
  signInWithGoogle: vi.fn(async () => 'firebase-id-token'),
  signOutFirebase: vi.fn(async () => undefined),
  getFirebaseAuth: vi.fn(() => ({})),
}

export function resetFirebase() {
  firebase.signInWithGoogle.mockReset().mockResolvedValue('firebase-id-token')
  firebase.signOutFirebase.mockReset().mockResolvedValue(undefined)
  firebase.getFirebaseAuth.mockReset().mockReturnValue({})
}

/** Module factory used by vi.mock('@/lib/firebase', ...). */
export const firebaseModuleMock = {
  signInWithGoogle: () => firebase.signInWithGoogle(),
  signOutFirebase: () => firebase.signOutFirebase(),
  getFirebaseAuth: () => firebase.getFirebaseAuth(),
}
