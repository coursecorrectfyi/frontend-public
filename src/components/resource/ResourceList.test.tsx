import { screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useSearchResources } from '@/hooks/use-search-resources'
import type { ResourceFilters } from '@/types/resource'
import { limitResponse, makeRateLimited, makeResource, makeSearchResponse } from '@/test/fixtures'
import { createGate, mockApi } from '@/test/msw'
import { renderWithProviders } from '@/test/render'
import ResourceList, { LOAD_MORE_FAILED, RESULTS_CHANGED, SEARCH_FAILED } from './ResourceList'

// ResourceList wired to the real search hook, as the search and subject pages use it.

function Harness({ query = 'python', track = false, onChange = vi.fn() }: { query?: string; track?: boolean; onChange?: (f: ResourceFilters) => void }) {
  const [filters, setFilters] = useState<ResourceFilters>({})
  const [ready, setReady] = useState(false)
  const queryResult = useSearchResources(query, filters, ready)
  return (
    <ResourceList
      query={query}
      onFiltersChange={f => {
        onChange(f)
        setFilters(f)
        setReady(true)
      }}
      queryResult={queryResult}
      trackSearchOutcome={track}
    />
  )
}

function renderList(props: Parameters<typeof Harness>[0] = {}) {
  const onChange = vi.fn()
  return { ...renderWithProviders(<Harness onChange={onChange} {...props} />), onChange }
}

const DEFAULTS: ResourceFilters = { levels: [], providers: [], languages: ['en'], resource_types: [], sort: 'relevance' }

async function openDrawer(user: ReturnType<typeof renderList>['user']) {
  await user.click(await screen.findByRole('button', { name: /^Filters/ }))
  return within(screen.getByRole('presentation'))
}

describe('ResourceList', () => {
  it('starts with English only, sorted by relevance', async () => {
    mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    const { onChange } = renderList()
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(DEFAULTS))
  })

  it('shows skeletons while the first page loads', async () => {
    const gate = createGate()
    mockApi('get', '/api/v1/resources/search', async () => {
      await gate.wait()
      return Response.json(makeSearchResponse())
    })
    const { container } = renderList()
    await waitFor(() => expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(5))
    gate.open()
    await waitFor(() => expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(0))
  })

  it('titles an empty query "all courses"', () => {
    renderList({ query: '' })
    expect(screen.getByRole('heading', { name: /all courses/ })).toBeInTheDocument()
  })

  describe('filters', () => {
    it('translates the drawer choices into API values', async () => {
      const calls = mockApi('get', '/api/v1/resources/search', makeSearchResponse())
      const { user, onChange } = renderList()
      const drawer = await openDrawer(user)
      for (const name of ['All Levels', 'Degree', 'DataCamp', 'Hebrew']) await user.click(drawer.getByLabelText(name))
      await user.click(drawer.getByRole('button', { name: 'Apply' }))

      expect(onChange).toHaveBeenLastCalledWith({
        ...DEFAULTS,
        levels: ['all_levels'],
        resource_types: ['degree'],
        providers: ['datacamp'],
        languages: ['en', 'he'],
      })
      await waitFor(() => expect(calls.at(-1)!.url.searchParams.getAll('language')).toEqual(['en', 'he']))
    })

    it('searches every language when English is unticked', async () => {
      mockApi('get', '/api/v1/resources/search', makeSearchResponse())
      const { user, onChange } = renderList()
      const drawer = await openDrawer(user)
      await user.click(drawer.getByLabelText('English'))
      await user.click(drawer.getByRole('button', { name: 'Apply' }))
      expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULTS, languages: [] })
    })

    it('only enables Apply when something changed, and then reads "Update"', async () => {
      mockApi('get', '/api/v1/resources/search', makeSearchResponse())
      const { user } = renderList()
      let drawer = await openDrawer(user)
      expect(drawer.getByRole('button', { name: 'Apply' })).toBeDisabled()
      await user.click(drawer.getByLabelText('Advanced'))
      await user.click(drawer.getByLabelText('Advanced'))
      expect(drawer.getByRole('button', { name: 'Apply' })).toBeDisabled() // back to the applied state
      await user.click(drawer.getByLabelText('Advanced'))
      await user.click(drawer.getByRole('button', { name: 'Apply' }))

      drawer = await openDrawer(user)
      expect(drawer.getByRole('button', { name: 'Update' })).toBeDisabled()
    })

    it('discards unapplied changes when the drawer is closed', async () => {
      mockApi('get', '/api/v1/resources/search', makeSearchResponse())
      const { user, onChange } = renderList()
      let drawer = await openDrawer(user)
      await user.click(drawer.getByLabelText('Project'))
      await user.click(drawer.getByTestId('CloseOutlinedIcon').closest('button')!)
      expect(onChange).toHaveBeenCalledTimes(1) // only the initial defaults

      drawer = await openDrawer(user)
      expect(drawer.getByLabelText('Project')).not.toBeChecked()
    })

    it('closes the drawer with Escape', async () => {
      mockApi('get', '/api/v1/resources/search', makeSearchResponse())
      const { user } = renderList()
      await openDrawer(user)
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Filters' })).toBeNull())
    })

    it('counts active filters on the button, not counting the default English', async () => {
      mockApi('get', '/api/v1/resources/search', makeSearchResponse())
      const { user } = renderList()
      expect(await screen.findByRole('button', { name: 'Filters' })).toBeInTheDocument()
      const drawer = await openDrawer(user)
      for (const name of ['Beginner', 'Spanish', 'Free only']) await user.click(drawer.getByLabelText(name))
      await user.click(drawer.getByRole('button', { name: 'Apply' }))
      expect(await screen.findByRole('button', { name: 'Filters 3' })).toBeInTheDocument()
    })

    it('keeps the applied filters when the sort order changes', async () => {
      mockApi('get', '/api/v1/resources/search', makeSearchResponse())
      const { user, onChange } = renderList()
      const drawer = await openDrawer(user)
      await user.click(drawer.getByLabelText('Includes certificate'))
      await user.click(drawer.getByRole('button', { name: 'Apply' }))

      await user.click(screen.getByRole('combobox'))
      await user.click(await screen.findByRole('option', { name: 'Newest' }))
      expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULTS, has_certificate: true, sort: 'newest' })
    })
  })

  describe('search analytics (search page only)', () => {
    it('reports the loaded results once per query, with the result count and search mode', async () => {
      mockApi('get', '/api/v1/resources/search', makeSearchResponse({ data: [makeResource(), makeResource()], vector_search: false }))
      const { user } = renderList({ track: true })
      await screen.findAllByRole('link')
      await waitFor(() =>
        expect(window.dataLayer).toEqual([
          expect.objectContaining({ event: 'search_results_loaded', search_term: 'python', result_count: 2, has_results: true, vector_search: false }),
        ]),
      )
      // Re-sorting the same query is not a new search.
      await user.click(screen.getByRole('combobox'))
      await user.click(await screen.findByRole('option', { name: 'Rating' }))
      await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Rating'))
      expect(window.dataLayer.filter((e: { event: string }) => e.event === 'search_results_loaded')).toHaveLength(1)
    })

    it('reports a failed search', async () => {
      mockApi('get', '/api/v1/resources/search', { error: 'x' }, { status: 500 })
      renderList({ track: true })
      await waitFor(() =>
        expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'search_error', search_term: 'python', error_message: 'Search request failed' })]),
      )
    })

    it('reports nothing where tracking is off (e.g. subject pages)', async () => {
      mockApi('get', '/api/v1/resources/search', makeSearchResponse())
      renderList({ track: false })
      await screen.findAllByRole('link')
      expect(window.dataLayer).toBeUndefined()
    })
  })

  describe('failures', () => {
    const first = () => makeResource({ title: 'First page result' })

    it('keeps the loaded results when "Load more" fails, and can try again', async () => {
      // (was B9: the results were replaced by an error)
      const results = first()
      let attempts = 0
      mockApi('get', '/api/v1/resources/search', (req: Request) => {
        if (!new URL(req.url).searchParams.get('cursor')) return Response.json(makeSearchResponse({ data: [results], next_cursor: 'c2' }))
        return ++attempts === 1
          ? Response.json({ error: 'Internal server error' }, { status: 500 })
          : Response.json(makeSearchResponse({ data: [makeResource({ title: 'Second page result' })], next_cursor: null }))
      })
      const { user } = renderList()
      await user.click(await screen.findByRole('button', { name: 'Load more' }))
      expect(await screen.findByText(LOAD_MORE_FAILED)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'First page result' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByRole('link', { name: 'Second page result' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'First page result' })).toBeInTheDocument()
    })

    it("shows the backend's message when \"Load more\" is rate limited, and keeps the results", async () => {
      mockApi('get', '/api/v1/resources/search', (req: Request) =>
        new URL(req.url).searchParams.get('cursor')
          ? limitResponse(makeRateLimited({ retryAfter: 30 }))
          : Response.json(makeSearchResponse({ data: [first()], next_cursor: 'c2' })),
      )
      const { user } = renderList()
      await user.click(await screen.findByRole('button', { name: 'Load more' }))
      expect(await screen.findByText('Too many requests. Please wait a moment and try again.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'First page result' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('reloads from the first page when the cursor is no longer valid (400 "Invalid cursor")', async () => {
      let firstPageLoads = 0
      const calls = mockApi('get', '/api/v1/resources/search', (req: Request) => {
        if (new URL(req.url).searchParams.get('cursor')) return Response.json({ error: 'Invalid cursor' }, { status: 400 })
        firstPageLoads++
        return Response.json(makeSearchResponse({ data: [makeResource({ title: `Load ${firstPageLoads}` })], next_cursor: 'c2' }))
      })
      const { user } = renderList()
      await user.click(await screen.findByRole('button', { name: 'Load more' }))
      expect(await screen.findByText(RESULTS_CHANGED)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Load 1' })).toBeInTheDocument() // still shown meanwhile

      await user.click(screen.getByRole('button', { name: 'Reload results' }))
      expect(await screen.findByRole('link', { name: 'Load 2' })).toBeInTheDocument()
      expect(calls.at(-1)!.url.searchParams.has('cursor')).toBe(false) // from the first page again
    })

    it("shows the backend's message when the search is rate limited, and tries again on request", async () => {
      let attempt = 0
      mockApi('get', '/api/v1/resources/search', () =>
        ++attempt === 1 ? limitResponse(makeRateLimited({ retryAfter: 30 })) : Response.json(makeSearchResponse({ data: [first()] })),
      )
      const { user } = renderList()
      expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please wait a moment and try again.')
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByRole('link', { name: 'First page result' })).toBeInTheDocument()
    })

    it('says the search failed, without a retry that would fail the same way (400)', async () => {
      mockApi('get', '/api/v1/resources/search', { error: 'Invalid level: "expert"' }, { status: 400 })
      renderList()
      expect(await screen.findByRole('alert')).toHaveTextContent(SEARCH_FAILED)
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    })
  })

  it('does not search for a blank query (the backend requires q)', async () => {
    // No handler registered: a request would fail the test.
    renderList({ query: '   ' })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('searches the trimmed query', async () => {
    const calls = mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    renderList({ query: '  python  ' })
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].url.searchParams.get('q')).toBe('python')
  })
})
