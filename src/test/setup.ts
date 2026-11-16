/**
 * Global test setup (runs before every test file, in both jsdom and node environments).
 *
 * - Module mocks for the platform boundaries: next/navigation, next/image, next/script,
 *   next-auth/react and @/lib/firebase. Control them via src/test/mocks/*.
 * - MSW server: no request leaves the process; unhandled requests fail the test.
 * - Console guard: unexpected console.error/warn fail the test (see src/test/console.ts).
 * - State reset between tests: DOM, storage, GTM dataLayer, session, router, Firebase.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { installBrowserPolyfills } from './browser'
import { installConsoleGuard, uninstallConsoleGuard } from './console'
import { resetFirebase } from './mocks/firebase'
import { resetSession } from './mocks/next-auth'
import { resetNavigation } from './mocks/next-navigation'
import { freshConnectionPool, server, startServer, takeUnhandledRequests } from './msw'

vi.mock('next/navigation', async () => (await import('./mocks/next-navigation')).nextNavigationMock)
vi.mock('next-auth/react', async () => (await import('./mocks/next-auth')).nextAuthReactMock)
vi.mock('@/lib/firebase', async () => (await import('./mocks/firebase')).firebaseModuleMock)

// next/image needs the Next.js image loader; a plain <img> keeps src/alt assertable.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, ...rest } = props
    // Next-only props that are not valid <img> attributes.
    delete rest.priority
    delete rest.fill
    return createElement('img', {
      src: typeof src === 'object' && src !== null ? (src as { src: string }).src : src,
      ...rest,
    })
  },
}))

// next/script injects scripts through the Next.js runtime; render a plain <script> instead.
vi.mock('next/script', () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props }
    delete rest.strategy // Next-only prop
    return createElement('script', rest)
  },
}))

const isBrowserEnv = typeof window !== 'undefined'

// Tell React it runs under a test runner, so state updates are batched with act() and "not wrapped in act"
// warnings are meaningful. React Testing Library only sets this through *global* beforeAll/afterAll hooks,
// and this suite does not enable Vitest globals.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeAll(() => {
  startServer()
})

beforeEach(async () => {
  // Connections from the previous test (e.g. an aborted request still closing) can't affect this one.
  await freshConnectionPool()
  if (isBrowserEnv) installBrowserPolyfills()
  installConsoleGuard()
})

// Problems left by `it.fails` tests (known bugs). Throwing in afterEach would count as the test's *expected*
// failure and hide the problem, so they are reported for the whole file in afterAll instead.
const problemsInKnownBugTests: string[] = []

afterEach(context => {
  // Restore stubbed globals first: a test may have stubbed `window` away to simulate server rendering.
  // (vitest's unstubGlobals option would only do this after this hook.)
  vi.unstubAllGlobals()
  if (isBrowserEnv) {
    cleanup()
    window.localStorage.clear()
    window.sessionStorage.clear()
    delete (window as { dataLayer?: unknown }).dataLayer
  }
  server.resetHandlers()
  resetSession()
  resetNavigation()
  resetFirebase()

  const unhandled = takeUnhandledRequests()
  const consoleProblems = uninstallConsoleGuard()
  const problems = [
    ...unhandled.map(r => `Unhandled network request (add an MSW handler): ${r}`),
    ...consoleProblems,
  ]
  if (problems.length === 0) return
  if (context.task.fails) {
    problemsInKnownBugTests.push(`"${context.task.name}":\n    - ${problems.join('\n    - ')}`)
    return
  }
  throw new Error(`Test left problems behind:\n  - ${problems.join('\n  - ')}`)
})

afterAll(() => {
  server.close()
  if (problemsInKnownBugTests.length > 0) {
    throw new Error(
      'Known-bug (it.fails) tests left problems behind; it.fails would otherwise hide them:\n  ' +
        problemsInKnownBugTests.splice(0).join('\n  '),
    )
  }
})
