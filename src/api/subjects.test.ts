import { describe, expect, it, vi } from 'vitest'
import { limitResponse, makeDomainDetail, makeRateLimited, makeTopic } from '@/test/fixtures'
import { HttpResponse, http, mockApi, server } from '@/test/msw'
import { getSubjectBySlug, getSubjects } from './subjects'

// Contract: docs/backend-api.md → "Subjects".

describe('getSubjectBySlug', () => {
  it('fetches a subject by slug', async () => {
    const detail = makeDomainDetail({ slug: 'data-science' }, [makeTopic()])
    const calls = mockApi('get', '/api/v1/subjects/:slug', detail)

    await expect(getSubjectBySlug('data-science')).resolves.toEqual(detail)
    expect(calls[0].params.slug).toBe('data-science')
  })

  it('rejects an empty slug without calling the API', async () => {
    await expect(getSubjectBySlug('')).rejects.toThrow('Invalid slug')
  })

  it('rejects on 404 (unknown slug)', async () => {
    mockApi('get', '/api/v1/subjects/:slug', { error: 'Not found' }, { status: 404 })
    await expect(getSubjectBySlug('nope')).rejects.toThrow('Failed to get subject')
    await expect(getSubjectBySlug('nope')).rejects.toMatchObject({ name: 'ApiError', status: 404 })
  })

  it.each(['.', '..'])('refuses the slug %j without calling the API', async slug => {
    await expect(getSubjectBySlug(slug)).rejects.toThrow('Invalid path segment')
  })

  it('URL-encodes the slug so it cannot address another endpoint', async () => {
    const paths: string[] = []
    server.use(
      http.all('*', ({ request }) => {
        paths.push(new URL(request.url).pathname)
        return HttpResponse.json({ error: 'Not found' }, { status: 404 })
      }),
    )
    await getSubjectBySlug('../resources/x').catch(() => {})
    expect(paths).toEqual(['/api/v1/subjects/..%2Fresources%2Fx'])
  })
})

describe('getSubjects', () => {
  it('returns subjects, keeping the first of any with the same name', async () => {
    mockApi('get', '/api/v1/subjects', [
      makeTopic({ name: 'Python', slug: 'python' }),
      makeTopic({ name: 'SQL', slug: 'sql' }),
      makeTopic({ name: 'Python', slug: 'python-2' }),
    ])
    const subjects = await getSubjects()
    expect(subjects.map(s => [s.name, s.slug])).toEqual([
      ['Python', 'python'],
      ['SQL', 'sql'],
    ])
  })

  it('explains an HTTP failure, including the status', async () => {
    mockApi('get', '/api/v1/subjects', { error: 'x' }, { status: 503 })
    await expect(getSubjects()).rejects.toThrow('Failed to fetch subjects (503)')
    await expect(getSubjects()).rejects.toMatchObject({ name: 'ApiError', status: 503 })
  })

  it('passes on the backend message when rate limited', async () => {
    mockApi('get', '/api/v1/subjects', () => limitResponse(makeRateLimited()))
    await expect(getSubjects()).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      message: 'Too many requests. Please wait a moment and try again.',
    })
  })

  it('explains a network failure', async () => {
    server.use(http.get('http://api.test/api/v1/subjects', () => HttpResponse.error()))
    await expect(getSubjects()).rejects.toThrow('Could not reach backend at http://api.test/api/v1/subjects')
  })
})

describe('API base URL handling', () => {
  async function loadWithApiUrl(value: string | undefined) {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_API_URL', value)
    return import('./subjects')
  }

  it('tolerates a trailing slash in NEXT_PUBLIC_API_URL', async () => {
    const { getSubjectBySlug: fresh } = await loadWithApiUrl('http://api.test/')
    const calls = mockApi('get', '/api/v1/subjects/:slug', makeDomainDetail())
    await fresh('x')
    expect(calls[0].url.pathname).toBe('/api/v1/subjects/x')
  })

  it.each([undefined, 'undefined'])('fails with setup instructions when NEXT_PUBLIC_API_URL is %s', async value => {
    const { getSubjects: fresh } = await loadWithApiUrl(value)
    await expect(fresh()).rejects.toThrow('NEXT_PUBLIC_API_URL is not set')
  })
})
