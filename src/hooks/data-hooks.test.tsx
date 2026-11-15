import { QueryClient } from '@tanstack/react-query'
import { act, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ResourceFilters } from '@/types/resource'
import { makeDomainDetail, makeResource, makeResourceDetail, makeSearchResponse } from '@/test/fixtures'
import { createGate, mockApi } from '@/test/msw'
import { renderHookWithProviders } from '@/test/render'
import { useGetSubject } from './use-get-subject'
import { useResourceDetail } from './use-resource-detail'
import { flattenPages, useSearchResources } from './use-search-resources'

// The TanStack Query hooks that read resources and subjects.

/** A client that WOULD retry, to prove a hook turns retries off itself. */
const retryingClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1, gcTime: Infinity } } })

const english: ResourceFilters = { languages: ['en'], sort: 'relevance' }

describe('useSearchResources', () => {
  it('waits until the filters are ready (no request with incomplete filters)', async () => {
    const { result } = renderHookWithProviders(() => useSearchResources('python', english, false))
    await act(async () => {})
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('does not search without a query', async () => {
    const { result } = renderHookWithProviders(() => useSearchResources('', english, true))
    await act(async () => {})
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('loads the first page, then the next one with the cursor, until there is no cursor', async () => {
    const [a, b] = [makeResource(), makeResource()]
    const calls = mockApi('get', '/api/v1/resources/search', (req: Request) =>
      Response.json(
        new URL(req.url).searchParams.get('cursor') === 'c2'
          ? makeSearchResponse({ data: [b], next_cursor: null })
          : makeSearchResponse({ data: [a], next_cursor: 'c2' }),
      ),
    )
    const { result } = renderHookWithProviders(() => useSearchResources('python', english, true))

    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    expect(flattenPages(result.current.data)).toEqual([a])

    await act(() => result.current.fetchNextPage())
    await waitFor(() => expect(flattenPages(result.current.data)).toEqual([a, b]))
    expect(result.current.hasNextPage).toBe(false)
    expect(calls.map(c => c.url.searchParams.get('cursor'))).toEqual([null, 'c2'])
    expect(calls[0].url.searchParams.getAll('language')).toEqual(['en'])
  })

  it('keeps showing the previous results while new filters load', async () => {
    const [old, fresh] = [makeResource({ title: 'old' }), makeResource({ title: 'fresh' })]
    const gate = createGate()
    mockApi('get', '/api/v1/resources/search', async (req: Request) => {
      if (new URL(req.url).searchParams.get('is_free') === 'true') {
        await gate.wait()
        return Response.json(makeSearchResponse({ data: [fresh] }))
      }
      return Response.json(makeSearchResponse({ data: [old] }))
    })
    const { result, rerender } = renderHookWithProviders(
      ({ filters }: { filters: ResourceFilters }) => useSearchResources('python', filters, true),
      { initialProps: { filters: english } },
    )
    await waitFor(() => expect(flattenPages(result.current.data)).toEqual([old]))

    rerender({ filters: { ...english, is_free: true } })
    await waitFor(() => expect(result.current.isFetching).toBe(true))
    expect(result.current.isPlaceholderData).toBe(true)
    expect(flattenPages(result.current.data)).toEqual([old]) // no flash of an empty list

    gate.open()
    await waitFor(() => expect(flattenPages(result.current.data)).toEqual([fresh]))
  })

  it('flattenPages returns [] before anything has loaded', () => {
    expect(flattenPages(undefined)).toEqual([])
  })
})

describe('useResourceDetail', () => {
  it('does nothing without an id', async () => {
    const { result } = renderHookWithProviders(() => useResourceDetail(''))
    await act(async () => {})
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('loads the resource by id', async () => {
    const resource = makeResourceDetail()
    const calls = mockApi('get', '/api/v1/resources/:id', resource)
    const { result } = renderHookWithProviders(() => useResourceDetail(resource.id))
    await waitFor(() => expect(result.current.data).toEqual(resource))
    expect(calls[0].params.id).toBe(resource.id)
  })
})

describe('useGetSubject', () => {
  it('does nothing without a slug', async () => {
    const { result } = renderHookWithProviders(() => useGetSubject(''))
    await act(async () => {})
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('loads the subject by slug', async () => {
    const detail = makeDomainDetail({ slug: 'data-science' })
    mockApi('get', '/api/v1/subjects/:slug', detail)
    const { result } = renderHookWithProviders(() => useGetSubject('data-science'))
    await waitFor(() => expect(result.current.data).toEqual(detail))
  })

  it('does not retry an unknown slug', async () => {
    const calls = mockApi('get', '/api/v1/subjects/:slug', { error: 'Not found' }, { status: 404 })
    const { result } = renderHookWithProviders(() => useGetSubject('nope'), { queryClient: retryingClient() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(calls).toHaveLength(1)
  })
})
