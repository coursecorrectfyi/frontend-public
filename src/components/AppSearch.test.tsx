import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { allowConsole } from '@/test/console'
import { makeTopic } from '@/test/fixtures'
import { mockApi } from '@/test/msw'
import { renderWithProviders } from '@/test/render'
import { navigateTo } from '@/utils/navigation'
import { openSearch } from '@/utils/search-events'
import AppSearch from './AppSearch'

// AppSearch: the search button (header, home, about) that opens a search box with subject suggestions
// and navigates to /search?q=... (a full page load).

vi.mock('@/utils/navigation', () => ({ navigateTo: vi.fn() }))

const WEEK = 7 * 24 * 60 * 60 * 1000
const subjects = [makeTopic({ name: 'Data Science', slug: 'data-science' }), makeTopic({ name: 'Python', slug: 'python' })]

beforeEach(() => {
  vi.mocked(navigateTo).mockReset()
})

async function renderSearch(props: Parameters<typeof AppSearch>[0] = { searchLabel: 'Try a new topic' }) {
  const calls = mockApi('get', '/api/v1/subjects', subjects)
  const utils = renderWithProviders(<AppSearch {...props} />)
  await act(async () => {})
  return { ...utils, calls }
}

async function openBox(user: Awaited<ReturnType<typeof renderSearch>>['user']) {
  await user.click(screen.getByText('Try a new topic').closest('button')!)
  return screen.findByPlaceholderText('Enter a topic to begin')
}

describe('AppSearch', () => {
  describe('button', () => {
    it('shows its label and the Ctrl+K shortcut', async () => {
      await renderSearch()
      const button = screen.getByText('Try a new topic').closest('button')!
      expect(button).toHaveTextContent('Ctrl+K')
    })

    it('shows ⌘K on macOS', async () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
      await renderSearch()
      expect(screen.getByText('Try a new topic').closest('button')).toHaveTextContent('⌘K')
    })

    it('hides the keyboard shortcut on phones and tablets', async () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile')
      await renderSearch()
      expect(screen.getByText('Try a new topic').closest('button')).not.toHaveTextContent('K')
    })

    it('falls back to "Search..." without a label', async () => {
      await renderSearch({})
      expect(screen.getByText('Search...')).toBeInTheDocument()
    })
  })

  describe('opening and closing', () => {
    it('opens the search box on click and focuses the input', async () => {
      const { user } = await renderSearch()
      const input = await openBox(user)
      await waitFor(() => expect(input).toHaveFocus())
    })

    it('toggles with Ctrl+K and ⌘K, and closes with Escape', async () => {
      await renderSearch()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      expect(await screen.findByPlaceholderText('Enter a topic to begin')).toBeInTheDocument()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      await waitFor(() => expect(screen.queryByPlaceholderText('Enter a topic to begin')).toBeNull())

      fireEvent.keyDown(window, { key: 'k', metaKey: true })
      expect(await screen.findByPlaceholderText('Enter a topic to begin')).toBeInTheDocument()
      fireEvent.keyDown(window, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByPlaceholderText('Enter a topic to begin')).toBeNull())
    })

    it('opens when another component asks for it (e.g. "Browse resources" on the saved page)', async () => {
      await renderSearch()
      act(() => openSearch())
      expect(await screen.findByPlaceholderText('Enter a topic to begin')).toBeInTheDocument()
    })

    it.fails('KNOWN BUG (B17): the search box spans the full modal width (style typo "100$")', async () => {
      const { user } = await renderSearch()
      const input = await openBox(user)
      expect(input.closest('.MuiStack-root')).toHaveStyle({ width: '100%' })
    })
  })

  describe('searching', () => {
    it('suggests subjects as the user types and searches the chosen one', async () => {
      const { user } = await renderSearch()
      const input = await openBox(user)
      await user.type(input, 'dat')
      await user.click(await screen.findByRole('option', { name: 'Data Science' }))

      expect(navigateTo).toHaveBeenCalledWith('/search?q=Data+Science')
      expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'search', search_term: 'Data Science' })])
    })

    it('searches free text on Enter, encoding each word', async () => {
      const { user } = await renderSearch()
      const input = await openBox(user)
      await user.type(input, '  C++ & machine   learning {Enter}')
      expect(navigateTo).toHaveBeenCalledWith('/search?q=C%2B%2B+%26+machine+learning')
    })

    it('does nothing for an empty search', async () => {
      const { user } = await renderSearch()
      const input = await openBox(user)
      await user.type(input, '   {Enter}')
      expect(navigateTo).not.toHaveBeenCalled()
      expect(window.dataLayer).toBeUndefined()
    })

    it('does not navigate twice for the same search (e.g. Enter after picking a suggestion)', async () => {
      const { user } = await renderSearch()
      const input = await openBox(user)
      await user.type(input, 'sql{Enter}')
      await user.type(input, '{Enter}')
      expect(navigateTo).toHaveBeenCalledTimes(1)
    })
  })

  describe('subject suggestions', () => {
    it('loads them once and caches them for the browser session', async () => {
      const { calls } = await renderSearch()
      expect(calls).toHaveLength(1)
      expect(JSON.parse(sessionStorage.getItem('subjects')!)).toEqual(subjects.map(s => expect.objectContaining({ name: s.name })))
      expect(Number(sessionStorage.getItem('subjects_timestamp'))).toBeGreaterThan(Date.now() - 60_000)
    })

    it('uses the cached subjects for up to a week', async () => {
      sessionStorage.setItem('subjects', JSON.stringify([{ name: 'Cached Topic', slug: 'cached' }]))
      sessionStorage.setItem('subjects_timestamp', String(Date.now() - WEEK + 60_000))
      const { user, calls } = await renderSearch()
      expect(calls).toHaveLength(0)
      const input = await openBox(user)
      await user.type(input, 'cach')
      expect(await screen.findByRole('option', { name: 'Cached Topic' })).toBeInTheDocument()
    })

    it('reloads subjects cached more than a week ago', async () => {
      sessionStorage.setItem('subjects', JSON.stringify([{ name: 'Old', slug: 'old' }]))
      sessionStorage.setItem('subjects_timestamp', String(Date.now() - WEEK - 60_000))
      const { calls } = await renderSearch()
      expect(calls).toHaveLength(1)
    })

    it('still allows free-text search when suggestions cannot be loaded', async () => {
      allowConsole('error', 'Failed to fetch subjects')
      mockApi('get', '/api/v1/subjects', { error: 'x' }, { status: 503 })
      const { user } = renderWithProviders(<AppSearch searchLabel="Try a new topic" />)
      await act(async () => {})
      const input = await openBox(user)
      await user.type(input, 'rust{Enter}')
      expect(navigateTo).toHaveBeenCalledWith('/search?q=rust')
    })
  })
})
