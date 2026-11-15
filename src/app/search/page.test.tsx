import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setMediaQueryMatcher } from '@/test/browser'
import { makeResource, makeSearchResponse } from '@/test/fixtures'
import { router, setSearchParams } from '@/test/mocks/next-navigation'
import { mockApi } from '@/test/msw'
import { allowKnownPageWarnings, expectMainLayout, iconButton, renderPage, settle } from '@/test/pages'
import { delta, done, sseResponse } from '@/test/sse'
import Search from './page'

// UI inventory: /search?q=… — results list, filters, sorting, pagination and the Cora chat panel.

beforeEach(() => {
  allowKnownPageWarnings()
  setSearchParams({ q: 'python' })
})

const python = makeResource({
  title: 'Python for Everybody',
  provider: 'coursera',
  institution: 'University of Michigan',
  resource_type: 'program',
  level: 'beginner',
  is_free: true,
  is_self_paced: true,
  has_certificate: true,
  duration_hours: 30,
  rating: 4.5,
  num_ratings: 12345,
  skills: ['Python', 'Data Structures', 'APIs', 'SQL', 'Web Scraping'],
  ai_summary: 'A gentle introduction to Python.',
  url: 'https://www.coursera.org/specializations/python',
})

function mockSearch(response = makeSearchResponse({ data: [python], next_cursor: null })) {
  return mockApi('get', '/api/v1/resources/search', response)
}

describe('search page', () => {
  it('uses the main layout', async () => {
    mockSearch()
    await renderPage(<Search />)
    expectMainLayout()
  })

  it('searches once, with the default filters (English), and titles the results with the query', async () => {
    const calls = mockSearch()
    await renderPage(<Search />)

    expect(await screen.findByText('Python for Everybody')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Results for\s+python$/ })).toBeInTheDocument() // &nbsp; in the markup
    expect(calls).toHaveLength(1)
    const params = calls[0].url.searchParams
    expect(params.get('q')).toBe('python')
    expect(params.getAll('language')).toEqual(['en'])
    expect(params.get('sort')).toBe('relevance')
    expect(screen.getByText('Course summaries are AI-generated.')).toBeInTheDocument()
  })

  describe('result card', () => {
    it('shows the resource facts', async () => {
      mockSearch()
      await renderPage(<Search />)
      const card = (await screen.findByRole('link', { name: 'Python for Everybody' })).closest('.MuiCard-root') as HTMLElement
      const c = within(card)

      expect(c.getByRole('link', { name: 'Python for Everybody' })).toHaveAttribute(
        'href',
        `/learn/python-for-everybody/${python.id}`,
      )
      for (const text of ['Program', 'Beginner', 'Self-paced', 'Free', 'coursera', 'University of Michigan',
        'A gentle introduction to Python.', '30 hours', 'Certificate', '(12,345)']) {
        expect(c.getByText(text)).toBeInTheDocument()
      }
      // Top four skills only.
      for (const skill of ['Python', 'Data Structures', 'APIs', 'SQL']) expect(c.getByText(skill)).toBeInTheDocument()
      expect(c.queryByText('Web Scraping')).toBeNull()
      expect(c.getByRole('img', { name: '4.5 Stars' })).toBeInTheDocument()
    })

    it('has Enroll (opens the provider in a new tab) and Save actions', async () => {
      mockSearch()
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      const { user } = await renderPage(<Search />)
      const card = (await screen.findByRole('link', { name: 'Python for Everybody' })).closest('.MuiCard-root') as HTMLElement

      // Found by text: the button's accessible name is the tooltip text, not "Enroll" (B27).
      await user.click(within(card).getByText('Enroll').closest('button')!)
      expect(open).toHaveBeenCalledWith(python.url, '_blank', 'noopener,noreferrer')
      expect(within(card).getByRole('button', { name: 'Sign in to save courses' })).toBeInTheDocument()
    })
  })

  it('offers six sort orders and re-searches when the order changes', async () => {
    const calls = mockSearch()
    const { user } = await renderPage(<Search />)
    await screen.findByText('Python for Everybody')

    await user.click(screen.getByRole('combobox'))
    const options = (await screen.findAllByRole('option')).map(o => o.textContent)
    expect(options).toEqual(['Relevance', 'Rating', 'Most Reviewed', 'Duration (short→long)', 'Duration (long→short)', 'Newest'])
    await user.click(screen.getByRole('option', { name: 'Rating' }))

    await waitFor(() => expect(calls.at(-1)!.url.searchParams.get('sort')).toBe('rating'))
  })

  describe('filters drawer', () => {
    it('has every filter group and option', async () => {
      mockSearch()
      const { user } = await renderPage(<Search />)
      await user.click(await screen.findByRole('button', { name: 'Filters' }))
      const drawer = within(screen.getByRole('presentation'))

      expect(drawer.getByRole('heading', { name: 'Filters' })).toBeInTheDocument()
      const groups = drawer.getAllByRole('heading').map(h => h.textContent)
      expect(groups).toEqual(['Filters', 'Level', 'Resource Type', 'Provider', 'Language', 'Price', 'Features'])

      const checkbox = (name: string) => drawer.getByLabelText(name)
      for (const name of ['Beginner', 'Intermediate', 'Advanced', 'All Levels',
        'Course', 'Program', 'Degree', 'Project', 'Certification', 'Code Along',
        'Coursera', 'edX', 'Udemy', 'DataCamp', 'Pluralsight', 'Free only', 'Includes certificate']) {
        expect(checkbox(name)).not.toBeChecked()
      }
      expect(checkbox('English')).toBeChecked() // preselected
      expect(drawer.getAllByRole('checkbox')).toHaveLength(4 + 6 + 5 + 17 + 2)
      expect(drawer.getByPlaceholderText('Search providers...')).toBeInTheDocument()
      expect(drawer.getByPlaceholderText('Search languages...')).toBeInTheDocument()
      expect(drawer.getByRole('button', { name: 'Apply' })).toBeDisabled()
      expect(iconButton('CloseOutlined', screen.getByRole('presentation'))).toBeInTheDocument()
    })

    it('searches with the applied filters and shows how many are active', async () => {
      const calls = mockSearch()
      const { user } = await renderPage(<Search />)
      await user.click(await screen.findByRole('button', { name: 'Filters' }))
      const drawer = within(screen.getByRole('presentation'))

      await user.click(drawer.getByLabelText('Beginner'))
      await user.click(drawer.getByLabelText('Code Along'))
      await user.click(drawer.getByLabelText('edX'))
      await user.click(drawer.getByLabelText('Free only'))
      await user.click(drawer.getByLabelText('Includes certificate'))
      await user.click(drawer.getByRole('button', { name: 'Apply' }))

      await waitFor(() => expect(calls).toHaveLength(2))
      const params = calls[1].url.searchParams
      expect(params.getAll('level')).toEqual(['beginner'])
      expect(params.getAll('resource_type')).toEqual(['code_along'])
      expect(params.getAll('provider')).toEqual(['edx'])
      expect(params.getAll('language')).toEqual(['en'])
      expect(params.get('is_free')).toBe('true')
      expect(params.get('has_certificate')).toBe('true')
      expect(screen.getByRole('button', { name: 'Filters 5' })).toBeInTheDocument()
    })

    it('narrows the provider and language lists with their search boxes', async () => {
      mockSearch()
      const { user } = await renderPage(<Search />)
      await user.click(await screen.findByRole('button', { name: 'Filters' }))
      const drawer = within(screen.getByRole('presentation'))

      await user.type(drawer.getByPlaceholderText('Search languages...'), 'span')
      expect(drawer.getByLabelText('Spanish')).toBeInTheDocument()
      expect(drawer.queryByLabelText('German')).toBeNull()
    })

    it('can clear all filters back to the defaults', async () => {
      mockSearch()
      const { user } = await renderPage(<Search />)
      await user.click(await screen.findByRole('button', { name: 'Filters' }))
      const drawer = within(screen.getByRole('presentation'))
      await user.click(drawer.getByLabelText('Advanced'))
      await user.click(drawer.getByRole('button', { name: 'Clear All' }))
      expect(drawer.getByLabelText('Advanced')).not.toBeChecked()
      expect(drawer.getByLabelText('English')).toBeChecked()
    })
  })

  it('loads the next page with the cursor and says when the end is reached', async () => {
    const page2 = makeResource({ title: 'Python Page Two' })
    const calls = mockApi('get', '/api/v1/resources/search', (req: Request) =>
      Response.json(
        new URL(req.url).searchParams.get('cursor') === 'c2'
          ? makeSearchResponse({ data: [page2], next_cursor: null })
          : makeSearchResponse({ data: [python], next_cursor: 'c2' }),
      ),
    )
    const { user } = await renderPage(<Search />)
    await user.click(await screen.findByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('Python Page Two')).toBeInTheDocument()
    expect(screen.getByText('Python for Everybody')).toBeInTheDocument()
    expect(calls[1].url.searchParams.get('cursor')).toBe('c2')
    expect(screen.getByText("You've reached the end of the results.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('shows an empty state when nothing matches', async () => {
    mockSearch(makeSearchResponse({ data: [] }))
    await renderPage(<Search />)
    expect(await screen.findByText('No results found')).toBeInTheDocument()
  })

  it('shows an error when the search fails', async () => {
    mockApi('get', '/api/v1/resources/search', { error: 'x' }, { status: 500 })
    await renderPage(<Search />)
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument()
  })

  describe('Cora chat panel', () => {
    it('greets with the results, offers quick prompts and a learning-path shortcut', async () => {
      mockSearch()
      const { user } = await renderPage(<Search />)
      expect(await screen.findByText(`You've got results for "python". Want me to help you pick the one that fits you best?`)).toBeInTheDocument()
      for (const prompt of ['Help me choose', "I'm a complete beginner — where do I start?", 'What jobs do these skills lead to?']) {
        expect(screen.getByRole('button', { name: prompt })).toBeInTheDocument()
      }
      expect(screen.getByRole('textbox', { name: '' })).toHaveAttribute('placeholder', 'Type your message...')
      expect(iconButton('Send')).toBeDisabled()
      expect(iconButton('RestartAlt')).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Help me plan my learning' }))
      expect(router.push).toHaveBeenCalledWith('/get-learning-path')
    })

    it('suggests rephrasing when there are no results', async () => {
      mockSearch(makeSearchResponse({ data: [] }))
      await renderPage(<Search />)
      expect(await screen.findByText(/I couldn't find resources for "python" either/)).toBeInTheDocument()
    })

    it('asks Cora about the results on the page and shows the streamed answer', async () => {
      mockSearch()
      const chat = mockApi('post', '/api/v1/chat', () => sseResponse([delta('Take **Python'), delta(' for Everybody**.'), done()]))
      const { user } = await renderPage(<Search />)
      await screen.findByText('Python for Everybody')

      await user.type(screen.getByPlaceholderText('Type your message...'), 'Which one?')
      await user.click(iconButton('Send'))

      // Rendered as Markdown once the answer is complete.
      expect(await screen.findByText('Python for Everybody', { selector: 'strong' })).toBeInTheDocument()
      expect(screen.getByText('Which one?')).toBeInTheDocument()
      const body = JSON.parse(chat[0].body)
      expect(body).toMatchObject({ message: 'Which one?', currentPage: 'SearchResult', searchTerm: 'python', pageContextIds: [python.id] })
    })
  })

  it('puts the chat behind a floating button on small screens', async () => {
    setMediaQueryMatcher(query => query.includes('max-width'))
    mockSearch()
    const { user } = await renderPage(<Search />)
    await screen.findByText('Python for Everybody')
    // The drawer keeps the chat mounted while closed (for smooth swiping), hidden from users.
    expect(screen.queryByRole('textbox', { name: '' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'chat' }))
    await settle()
    expect(screen.getByRole('textbox', { name: '' })).toHaveAttribute('placeholder', 'Type your message...')
  })
})
