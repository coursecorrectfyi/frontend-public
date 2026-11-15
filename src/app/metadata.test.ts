// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { makeDomainDetail, makeResourceDetail, makeUuid } from '@/test/fixtures'
import { mockApi } from '@/test/msw'
import { generateMetadata as learnMetadata } from './learn/[slug]/[id]/page'
import { generateMetadata as searchMetadata } from './search/page'
import { generateMetadata as subjectMetadata } from './subjects/[slug]/page'

// Page <head> metadata: titles, descriptions and canonical URLs (SEO).

describe('/search metadata', () => {
  const meta = (q?: string) => searchMetadata({ searchParams: Promise.resolve(q === undefined ? {} : { q }) })

  it('names the query in the title and description', async () => {
    const m = await meta('machine learning')
    expect(m.title).toBe('Results for "machine learning" · CourseCorrect')
    expect(m.description).toContain('"machine learning"')
  })

  it('uses a canonical URL with the query encoded', async () => {
    const m = await meta('C++ & Rust')
    expect(m.alternates?.canonical).toBe('https://coursecorrect.fyi/search?q=C%2B%2B%20%26%20Rust')
  })

  it('falls back to a generic title without a query', async () => {
    const m = await meta()
    expect(m.title).toBe('Search Courses | CourseCorrect')
    expect(m.alternates?.canonical).toBe('https://coursecorrect.fyi/search')
  })
})

describe('/subjects/[slug] metadata', () => {
  const meta = (slug: string) => subjectMetadata({ params: Promise.resolve({ slug }) })

  it('uses the topic name and its meta description', async () => {
    mockApi('get', '/api/v1/subjects/:slug', makeDomainDetail({ name: 'Data Science', meta_description: 'Meta.', description: 'Long.' }))
    const m = await meta('data-science')
    expect(m.title).toBe('Data Science Courses | CourseCorrect')
    expect(m.description).toBe('Meta.')
    expect(m.alternates?.canonical).toBe('https://coursecorrect.fyi/subjects/data-science')
  })

  it('falls back to the description when there is no meta description', async () => {
    mockApi('get', '/api/v1/subjects/:slug', makeDomainDetail({ meta_description: null, description: 'Long.' }))
    expect((await meta('x')).description).toBe('Long.')
  })

  it('falls back to a generic title when the subject cannot be loaded', async () => {
    mockApi('get', '/api/v1/subjects/:slug', { error: 'Not found' }, { status: 404 })
    await expect(meta('nope')).resolves.toEqual({ title: 'CourseCorrect' })
  })
})

describe('/learn/[slug]/[id] metadata', () => {
  const meta = (slug: string, id: string) => learnMetadata({ params: Promise.resolve({ slug, id }) })

  it('uses the resource title and AI summary', async () => {
    const resource = makeResourceDetail({ title: 'Python for Everybody', ai_summary: 'Learn Python.' })
    mockApi('get', '/api/v1/resources/:id', resource)
    const m = await meta('python-for-everybody', resource.id)
    expect(m.title).toBe('Python for Everybody | CourseCorrect')
    expect(m.description).toBe('Learn Python.')
    expect(m.alternates?.canonical).toBe(`https://coursecorrect.fyi/learn/python-for-everybody/${resource.id}`)
  })

  it('omits the description when the resource has no summary', async () => {
    const resource = makeResourceDetail({ ai_summary: null })
    mockApi('get', '/api/v1/resources/:id', resource)
    expect((await meta('x', resource.id)).description).toBeUndefined()
  })

  it('falls back to a generic title when the resource cannot be loaded', async () => {
    mockApi('get', '/api/v1/resources/:id', { error: 'Not found' }, { status: 404 })
    await expect(meta('x', 'nope')).resolves.toEqual({ title: 'CourseCorrect' })
  })

  // Old links use a legacy Mongo id and/or a stale slug; the backend resolves them to the same resource.
  // Every variant must declare the one canonical URL (the page itself redirects there client-side).
  it.fails('KNOWN BUG (B8): declares the canonical slug and UUID, whatever URL was requested', async () => {
    const uuid = makeUuid()
    mockApi('get', '/api/v1/resources/:id', makeResourceDetail({ id: uuid, title: 'Python for Everybody' }))
    const m = await meta('old-slug', '5f1b2c3d4e5f6a7b8c9d0e1f')
    expect(m.alternates?.canonical).toBe(`https://coursecorrect.fyi/learn/python-for-everybody/${uuid}`)
  })
})
