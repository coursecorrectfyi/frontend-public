/**
 * Controllable replacement for `next/navigation` (installed globally in setup.ts).
 *
 *   import { router, setPathname, setSearchParams } from '@/test/mocks/next-navigation'
 *   setSearchParams('q=python')
 *   ...
 *   expect(router.push).toHaveBeenCalledWith('/saved')
 */
import { vi } from 'vitest'

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

let pathname = '/'
let searchParams = new URLSearchParams()

export function setPathname(next: string) {
  pathname = next
}

export function setSearchParams(next: string | Record<string, string> | URLSearchParams) {
  searchParams = new URLSearchParams(next)
}

export function resetNavigation() {
  pathname = '/'
  searchParams = new URLSearchParams()
  Object.values(router).forEach(fn => fn.mockReset())
}

/** Module factory used by vi.mock('next/navigation', ...). */
export const nextNavigationMock = {
  useRouter: () => router,
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
  useParams: () => ({}),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}
