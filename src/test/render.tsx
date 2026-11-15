/**
 * Render helpers that provide what the app's root layout provides:
 * the real branding theme (BrandingThemeProvider) and a TanStack Query client.
 *
 *   const { user, queryClient } = renderWithProviders(<ResourceCard resource={r} />)
 *   await user.click(screen.getByRole('button', { name: /enroll/i }))
 *
 * Session, router and Firebase are module mocks controlled through src/test/mocks/*.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderOptions,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import BrandingThemeProvider from '@/theme/BrandingThemeProvider'

/**
 * A QueryClient suited to tests: no retries (a failing request fails immediately) and no garbage
 * collection timers left running after the test.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
}

function makeWrapper(queryClient: QueryClient) {
  return function Providers({ children }: { children: ReactNode }) {
    return (
      <BrandingThemeProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </BrandingThemeProvider>
    )
  }
}

interface ProviderOptions {
  queryClient?: QueryClient
  /** Options passed to userEvent.setup(), e.g. { advanceTimers: vi.advanceTimersByTime }. */
  userEventOptions?: Parameters<typeof userEvent.setup>[0]
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), userEventOptions, ...options }: ProviderOptions &
    Omit<RenderOptions, 'wrapper'> = {},
) {
  const user = userEvent.setup(userEventOptions)
  return { user, queryClient, ...render(ui, { wrapper: makeWrapper(queryClient), ...options }) }
}

export function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  {
    queryClient = createTestQueryClient(),
    ...options
  }: { queryClient?: QueryClient } & Omit<RenderHookOptions<Props>, 'wrapper'> = {},
) {
  return { queryClient, ...renderHook(hook, { wrapper: makeWrapper(queryClient), ...options }) }
}
