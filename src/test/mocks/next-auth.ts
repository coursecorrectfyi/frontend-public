/**
 * Controllable replacement for `next-auth/react` (installed globally in setup.ts).
 * The real client would call /api/auth/session; tests set the session state directly.
 *
 *   mockSignedIn()                       // authenticated, default backend tokens
 *   mockSignedIn({ user: { id: 'u2' } }) // override parts of the backend user
 *   mockSignedOut()
 *   mockSessionLoading()
 *   setSession({ user: {}, expires: '…' }, 'authenticated')   // anything else
 *   expect(nextAuth.signIn).toHaveBeenCalledWith('firebase-backend', expect.anything())
 */
import type { Session } from 'next-auth'
import { createElement, Fragment, type ReactNode } from 'react'
import { vi } from 'vitest'
import type { BackendTokens } from '@/types/next-auth'
import { makeBackendTokens } from '../fixtures'

type Status = 'authenticated' | 'unauthenticated' | 'loading'

let state: { data: Session | null; status: Status } = { data: null, status: 'unauthenticated' }

export const nextAuth = {
  signIn: vi.fn(async () => ({ ok: true, error: null, status: 200, url: null })),
  signOut: vi.fn(async () => undefined),
  update: vi.fn(async () => state.data),
}

export function mockSignedIn(
  overrides: Partial<Omit<BackendTokens, 'user'>> & { user?: Partial<BackendTokens['user']> } = {},
): Session {
  const backendTokens = makeBackendTokens(overrides)
  // Mirrors what NextAuth actually produces for this app: the credentials provider does not set
  // name/email/image, so session.user is an object with no fields (see B15 in docs/testing.md).
  const session: Session = {
    user: {},
    expires: '2999-01-01T00:00:00.000Z',
    backendTokens,
  }
  state = { data: session, status: 'authenticated' }
  return session
}

/** Any other session state, e.g. authenticated while backend tokens are briefly missing during a refresh. */
export function setSession(data: Session | null, status: Status) {
  state = { data, status }
}

export function mockSignedOut() {
  state = { data: null, status: 'unauthenticated' }
}

export function mockSessionLoading() {
  state = { data: null, status: 'loading' }
}

export function resetSession() {
  mockSignedOut()
  Object.values(nextAuth).forEach(fn => fn.mockClear())
}

/** Module factory used by vi.mock('next-auth/react', ...). */
export const nextAuthReactMock = {
  useSession: () => ({ ...state, update: nextAuth.update }),
  signIn: (...args: unknown[]) => (nextAuth.signIn as (...a: unknown[]) => unknown)(...args),
  signOut: (...args: unknown[]) => (nextAuth.signOut as (...a: unknown[]) => unknown)(...args),
  getSession: async () => state.data,
  SessionProvider: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
}
