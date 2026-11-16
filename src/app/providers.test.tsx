import { useQueryClient } from '@tanstack/react-query'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useResourceDetail } from '@/hooks/use-resource-detail'
import { limitResponse, makeRateLimited } from '@/test/fixtures'
import { nextAuth, setSession } from '@/test/mocks/next-auth'
import { HttpResponse, http, mockApi, server } from '@/test/msw'
import { Providers } from './providers'

// The app-wide providers (root layout): NextAuth session + TanStack Query with the app's defaults.

const wrapper = ({ children }: { children: ReactNode }) => <Providers>{children}</Providers>

describe('Providers', () => {
  it('renders the app inside the session and query providers', () => {
    render(<Providers><p>app</p></Providers>)
    expect(screen.getByText('app')).toBeInTheDocument()
  })

  it('ends a session that lost its backend tokens (SessionGuard is mounted)', async () => {
    setSession({ user: {}, expires: '2999-01-01T00:00:00.000Z' }, 'authenticated')
    render(<Providers><p>app</p></Providers>)
    await waitFor(() => expect(nextAuth.signOut).toHaveBeenCalledWith({ redirect: false }))
  })

  it('caches data for 5 minutes, keeps it 10, and does not refetch on window focus', () => {
    const { result } = renderHook(() => useQueryClient(), { wrapper })
    const queries = result.current.getDefaultOptions().queries!
    expect(queries.staleTime).toBe(5 * 60 * 1000)
    expect(queries.gcTime).toBe(10 * 60 * 1000)
    expect(queries.refetchOnWindowFocus).toBe(false)
  })

  it('retries a failing request twice (three attempts in total)', async () => {
    const calls = mockApi('get', '/api/v1/resources/:id', { error: 'x' }, { status: 503 })
    const { result } = renderHook(() => useResourceDetail('r1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(calls).toHaveLength(3)
  })

  it('retries when the request could not be made at all (network error)', async () => {
    let attempts = 0
    server.use(
      http.get('http://api.test/api/v1/resources/:id', () => {
        attempts++
        return HttpResponse.error()
      }),
    )
    const { result } = renderHook(() => useResourceDetail('r1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(attempts).toBe(3)
  })

  // The full matrix is in src/api/retry-policy.test.ts; these check the policy is what the app uses.
  it('does not retry when the resource does not exist (404)', async () => {
    const calls = mockApi('get', '/api/v1/resources/:id', { error: 'Not found' }, { status: 404 })
    const { result } = renderHook(() => useResourceDetail('missing'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(calls).toHaveLength(1)
  })

  it('does not retry an unauthorised request (401)', async () => {
    const calls = mockApi('get', '/api/v1/resources/:id', { error: 'Invalid or expired token' }, { status: 401 })
    const { result } = renderHook(() => useResourceDetail('r1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(calls).toHaveLength(1)
  })

  it('retries a short rate limit once, after the time the backend asks for', async () => {
    const times: number[] = []
    const calls = mockApi('get', '/api/v1/resources/:id', () => {
      times.push(Date.now())
      return limitResponse(makeRateLimited({ retryAfter: 1 }))
    })
    const { result } = renderHook(() => useResourceDetail('r1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(calls).toHaveLength(2)
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(950) // ~1 s, not the 1 s/2 s backoff used for 5xx
    expect(result.current.error).toMatchObject({ status: 429, code: 'rate_limited' })
  })

  it('does not retry a rate limit with a long wait', async () => {
    const calls = mockApi('get', '/api/v1/resources/:id', () => limitResponse(makeRateLimited({ retryAfter: 60 })))
    const { result } = renderHook(() => useResourceDetail('r1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(calls).toHaveLength(1)
  })
})
