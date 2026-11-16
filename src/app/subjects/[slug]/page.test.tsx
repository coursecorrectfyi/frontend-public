import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeDomainDetail, makeResource, makeSearchResponse, makeSubtopicDetail, makeTopic } from '@/test/fixtures'
import { mockApi } from '@/test/msw'
import { allowKnownPageWarnings, expectMainLayout, renderPage } from '@/test/pages'
import { delta, done, sseResponse } from '@/test/sse'
import SubjectPage from './page'

// UI inventory: /subjects/[slug] — a subject header (domain or subtopic), its resources and the Cora chat panel.

beforeEach(() => {
  allowKnownPageWarnings()
})

const domain = makeDomainDetail(
  { name: 'Data Science', slug: 'data-science', description: 'Turn data into decisions.' },
  [makeTopic({ name: 'Pandas', slug: 'pandas' }), makeTopic({ name: 'Statistics', slug: 'statistics' })],
)
const subtopic = makeSubtopicDetail(
  { name: 'Pandas', slug: 'pandas', description: 'Dataframes in Python.' },
  { name: 'Data Science', slug: 'data-science' },
)

/** The breadcrumb <nav> (it has no accessible name, see B27), found by its link to the parent domain. */
function breadcrumb() {
  return screen.queryAllByRole('navigation').find(nav => within(nav).queryByRole('link', { name: 'Data Science' })) ?? null
}

async function renderSubject(slug: string) {
  return renderPage(await SubjectPage({ params: Promise.resolve({ slug }) }))
}

describe('subject page', () => {
  it('uses the main layout', async () => {
    mockApi('get', '/api/v1/subjects/:slug', domain)
    mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    await renderSubject('data-science')
    expectMainLayout()
  })

  it('shows a domain with its description and links to its subtopics', async () => {
    mockApi('get', '/api/v1/subjects/:slug', domain)
    mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    await renderSubject('data-science')

    expect(await screen.findByRole('heading', { level: 1, name: 'Data Science' })).toBeInTheDocument()
    expect(screen.getByText('Turn data into decisions.')).toBeInTheDocument()
    expect(screen.getByText('Explore within Data Science')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pandas' })).toHaveAttribute('href', '/subjects/pandas')
    expect(screen.getByRole('link', { name: 'Statistics' })).toHaveAttribute('href', '/subjects/statistics')
    expect(breadcrumb()).toBeNull()
  })

  it('shows a breadcrumb back to the parent domain on a subtopic', async () => {
    mockApi('get', '/api/v1/subjects/:slug', subtopic)
    mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    await renderSubject('pandas')

    expect(await screen.findByRole('heading', { level: 1, name: 'Pandas' })).toBeInTheDocument()
    expect(breadcrumb()).not.toBeNull()
    const crumbs = within(breadcrumb()!)
    expect(crumbs.getByRole('link', { name: 'Data Science' })).toHaveAttribute('href', '/subjects/data-science')
    expect(crumbs.getByText('Pandas')).toBeInTheDocument()
  })

  it.fails('KNOWN BUG (B7): the breadcrumb does not link to /subjects, which does not exist', async () => {
    mockApi('get', '/api/v1/subjects/:slug', subtopic)
    mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    await renderSubject('pandas')
    await screen.findByRole('heading', { level: 1, name: 'Pandas' })
    const links = within(breadcrumb()!).queryAllByRole('link').map(l => l.getAttribute('href'))
    expect(links).not.toContain('/subjects')
  })

  it('lists resources for the subject, searched by the topic name', async () => {
    mockApi('get', '/api/v1/subjects/:slug', domain)
    const search = mockApi('get', '/api/v1/resources/search', makeSearchResponse({ data: [makeResource({ title: 'Intro to Pandas' })] }))
    await renderSubject('data-science')

    expect(await screen.findByRole('link', { name: 'Intro to Pandas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Courses in\s+Data Science$/ })).toBeInTheDocument()
    await waitFor(() => expect(search.at(-1)!.url.searchParams.get('q')).toBe('Data Science'))
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveTextContent('Relevance')
  })

  it('says an unknown subject was not found, but still lists resources for the slug', async () => {
    mockApi('get', '/api/v1/subjects/:slug', { error: 'Not found' }, { status: 404 })
    const search = mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    await renderSubject('machine-learning')
    expect(await screen.findByText("We couldn't find this subject.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull() // the same request would fail again
    await waitFor(() => expect(search[0]?.url.searchParams.get('q')).toBe('machine learning'))
  })

  it('offers to try again when the subject fails to load for a temporary reason', async () => {
    let attempt = 0
    mockApi('get', '/api/v1/subjects/:slug', () =>
      ++attempt === 1 ? Response.json({ error: 'Internal server error' }, { status: 500 }) : Response.json(makeDomainDetail({ name: 'Machine Learning' })),
    )
    mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    const { user } = await renderSubject('machine-learning')
    expect(await screen.findByText('Failed to load subject details.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Machine Learning' })).toBeInTheDocument()
  })

  describe('Cora chat panel', () => {
    it('greets with the topic and asks about it with the subject context', async () => {
      mockApi('get', '/api/v1/subjects/:slug', domain)
      const resources = [makeResource(), makeResource()]
      mockApi('get', '/api/v1/resources/search', makeSearchResponse({ data: resources }))
      const chat = mockApi('post', '/api/v1/chat', () => sseResponse([delta('Start with Pandas.'), done()]))
      const { user } = await renderSubject('data-science')

      expect(await screen.findByText(/You're exploring Data Science/)).toBeInTheDocument()
      await screen.findByRole('link', { name: resources[0].title })
      await user.click(screen.getByRole('button', { name: 'Help me choose' }))

      await waitFor(() => expect(screen.getByText('Start with Pandas.')).toBeInTheDocument())
      expect(JSON.parse(chat[0].body)).toMatchObject({
        message: 'Help me choose',
        currentPage: 'SubjectPage',
        searchTerm: 'Data Science',
        pageContextIds: resources.map(r => r.id),
      })
    })
  })
})
