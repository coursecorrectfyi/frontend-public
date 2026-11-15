// @vitest-environment node
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { config, middleware } from './middleware'

const request = (url: string, host = new URL(url).host) =>
  new NextRequest(url, { headers: { host } })

describe('middleware: www → apex redirect', () => {
  it('permanently redirects www to the apex domain over https, keeping path and query', async () => {
    const res = await middleware(request('https://www.coursecorrect.fyi/search?q=sql&x=1'))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://coursecorrect.fyi/search?q=sql&x=1')
  })

  it('redirects the bare www root', async () => {
    const res = await middleware(request('https://www.coursecorrect.fyi/'))
    expect(res.headers.get('location')).toBe('https://coursecorrect.fyi/')
  })

  it('keeps http for www.localhost during local development', async () => {
    const res = await middleware(request('http://www.localhost:3001/learn/a/b'))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('http://localhost:3001/learn/a/b')
  })

  it('lets apex-domain requests through untouched', async () => {
    const res = await middleware(request('https://coursecorrect.fyi/search?q=sql'))
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('lets requests without a Host header through', async () => {
    const res = await middleware(new NextRequest('https://coursecorrect.fyi/'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })
})

describe('middleware matcher', () => {
  // Next compiles the matcher into a regular expression anchored on the pathname.
  const matcher = new RegExp(`^${config.matcher[0]}$`)

  it.each(['/', '/search', '/learn/python/123', '/blog/post', '/sitemap.xml'])('runs for %s', path => {
    expect(matcher.test(path)).toBe(true)
  })

  it.each(['/api/auth/session', '/_next/static/chunk.js', '/_next/image', '/favicon.ico'])(
    'skips %s',
    path => {
      expect(matcher.test(path)).toBe(false)
    },
  )
})
