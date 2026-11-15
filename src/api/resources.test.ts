import { describe, expect, it } from 'vitest'
import { makeResourceDetail, makeSearchResponse } from '@/test/fixtures'
import { HttpResponse, http, mockApi, server } from '@/test/msw'
import { getResourceById, searchResources } from './resources'

// Contract: docs/backend-api.md → "GET /api/v1/resources/search" and "GET /api/v1/resources/:id".

describe('searchResources', () => {
  it('sends the query with a page size of 20 and returns the response as is', async () => {
    const body = makeSearchResponse({ next_cursor: 'c2', vector_search: false })
    const calls = mockApi('get', '/api/v1/resources/search', body)

    await expect(searchResources('machine learning')).resolves.toEqual(body)

    expect(calls).toHaveLength(1)
    expect(calls[0].url.searchParams.get('q')).toBe('machine learning')
    expect(calls[0].url.searchParams.get('limit')).toBe('20')
    expect(calls[0].url.searchParams.has('cursor')).toBe(false)
    expect(calls[0].url.searchParams.has('sort')).toBe(false)
  })

  it('sends the cursor from the previous page unchanged', async () => {
    const calls = mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    await searchResources('sql', undefined, 'opaque+cursor/==')
    expect(calls[0].url.searchParams.get('cursor')).toBe('opaque+cursor/==')
  })

  it('repeats multi-value filters as separate query parameters', async () => {
    const calls = mockApi('get', '/api/v1/resources/search', makeSearchResponse())

    await searchResources('python', {
      levels: ['beginner', 'all_levels'],
      providers: ['Coursera', 'edX'],
      resource_types: ['course', 'code_along'],
      sort: 'rating',
    })

    const params = calls[0].url.searchParams
    expect(params.getAll('level')).toEqual(['beginner', 'all_levels'])
    expect(params.getAll('provider')).toEqual(['coursera', 'edx']) // API provider ids are lower case
    expect(params.getAll('resource_type')).toEqual(['course', 'code_along'])
    expect(params.get('sort')).toBe('rating')
  })

  it('sends languages as ISO 639-1 codes, accepting display names or codes', async () => {
    const calls = mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    await searchResources('python', { languages: ['English', 'Hebrew', 'pt'] })
    expect(calls[0].url.searchParams.getAll('language')).toEqual(['en', 'he', 'pt'])
  })

  it('sends boolean filters as "true"/"false" only when set', async () => {
    const calls = mockApi('get', '/api/v1/resources/search', makeSearchResponse())

    await searchResources('a', { is_free: true, has_certificate: false })
    await searchResources('a', {})

    expect(calls[0].url.searchParams.get('is_free')).toBe('true')
    expect(calls[0].url.searchParams.get('has_certificate')).toBe('false')
    expect(calls[1].url.searchParams.has('is_free')).toBe(false)
    expect(calls[1].url.searchParams.has('has_certificate')).toBe(false)
  })

  it('encodes user input safely in the query string', async () => {
    const calls = mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    await searchResources('C++ & C# / "quotes"')
    expect(calls[0].url.searchParams.get('q')).toBe('C++ & C# / "quotes"')
    expect(calls[0].url.searchParams.getAll('limit')).toEqual(['20']) // no parameter injection via "&"
  })

  it.each([400, 500, 503])('rejects when the API answers %i', async status => {
    mockApi('get', '/api/v1/resources/search', { error: 'nope' }, { status })
    await expect(searchResources('x')).rejects.toThrow('Search request failed')
  })
})

describe('getResourceById', () => {
  it('fetches one resource by id', async () => {
    const resource = makeResourceDetail()
    const calls = mockApi('get', '/api/v1/resources/:id', resource)

    await expect(getResourceById(resource.id)).resolves.toEqual(resource)
    expect(calls[0].params.id).toBe(resource.id)
  })

  it('rejects on 404 (unknown, malformed or inactive id)', async () => {
    mockApi('get', '/api/v1/resources/:id', { error: 'Not found' }, { status: 404 })
    await expect(getResourceById('nope')).rejects.toThrow('Failed to fetch resource')
  })

  it.fails('KNOWN BUG (B13): URL-encodes the id so it cannot address another endpoint', async () => {
    // The id comes from the page URL (/learn/:slug/:id). Unencoded, "../saved" is resolved by the URL parser
    // and the request goes to GET /api/v1/saved instead.
    const paths: string[] = []
    server.use(
      http.all('*', ({ request }) => {
        paths.push(new URL(request.url).pathname)
        return HttpResponse.json({ error: 'Not found' }, { status: 404 })
      }),
    )
    await getResourceById('../saved').catch(() => {})
    expect(paths).toEqual(['/api/v1/resources/..%2Fsaved'])
  })
})
