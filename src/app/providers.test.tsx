import { useQueryClient } from '@tanstack/react-query'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useResourceDetail } from '@/hooks/use-resource-detail'
import { mockApi } from '@/test/msw'
import { Providers } from './providers'

// The app-wide providers (root layout): NextAuth session + TanStack Query with the app's defaults.

const wrapper = ({ children }: { children: ReactNode }) => <Providers>{children}</Providers>

describe('Providers', () => {
  it('renders the app inside the session and query providers', () => {
    render(<Providers><p>app</p></Providers>)
    expect(screen.getByText('app')).toBeInTheDocument()
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

  // B14: the "don't retry 401/403" rule never applies (API errors carry no status), and "not found" is retried too,
  // so a missing resource takes ~3 s to show its error.
  it.fails('KNOWN BUG (B14): does not retry when the resource does not exist (404)', async () => {
    const calls = mockApi('get', '/api/v1/resources/:id', { error: 'Not found' }, { status: 404 })
    const { result } = renderHook(() => useResourceDetail('missing'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(calls).toHaveLength(1)
  })

  it.fails('KNOWN BUG (B14): does not retry an unauthorised request (401)', async () => {
    const calls = mockApi('get', '/api/v1/resources/:id', { error: 'Invalid or expired token' }, { status: 401 })
    const { result } = renderHook(() => useResourceDetail('r1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(calls).toHaveLength(1)
  })
})
