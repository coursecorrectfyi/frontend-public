// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { allowConsole } from '@/test/console'
import { HttpResponse, http, type RecordedRequest, server } from '@/test/msw'
import { MAX_REDIRECTS } from './constants'
import { DELETE, GET, OPTIONS, PATCH, POST, PUT } from './route'

// The /blog reverse proxy forwards to a WordPress host (NEXT_PUBLIC_HOSTINGER_IP) over plain HTTP.
// MSW intercepts node:http, so the "WordPress" below is a mock at http://203.0.113.10 (a TEST-NET address).

const WP_IP = '203.0.113.10'
const WP = `http://${WP_IP}`

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_HOSTINGER_IP', WP_IP)
  // The proxy logs every request and redirect it handles.
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

type Handler = (request: Request) => Response | Promise<Response>

/** Mocks the WordPress host; records every request it receives. */
function wordpress(handler: Handler = () => new HttpResponse('<html>ok</html>', { headers: { 'Content-Type': 'text/html' } })) {
  const calls: RecordedRequest[] = []
  server.use(
    http.all(`${WP}/*`, async ({ request, params }) => {
      calls.push({
        method: request.method,
        url: new URL(request.url),
        headers: request.headers,
        params: params as RecordedRequest['params'],
        body: await request.clone().text(),
      })
      return handler(request)
    }),
  )
  return calls
}

function proxy(
  path: string,
  { method = 'GET', headers = {}, body }: { method?: string; headers?: Record<string, string>; body?: string } = {},
) {
  const request = new NextRequest(`https://coursecorrect.fyi${path}`, {
    method,
    headers: { host: 'coursecorrect.fyi', ...headers },
    body,
  })
  const slug = new URL(request.url).pathname.split('/').slice(2).filter(Boolean)
  const handler = { GET, POST, PUT, DELETE, PATCH }[method as 'GET']
  return handler(request, { params: Promise.resolve({ slug: slug.length ? slug : undefined }) })
}

describe('configuration', () => {
  it('answers 500 without contacting anything when the WordPress host is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_HOSTINGER_IP', '')
    allowConsole('error', 'NEXT_PUBLIC_HOSTINGER_IP is not set')
    const res = await proxy('/blog/post')
    expect(res.status).toBe(500)
    const body = await res.text()
    expect(JSON.parse(body)).toEqual({ error: 'The blog is not available right now.' })
    expect(body).not.toMatch(/wordpress|proxy|HOSTINGER/i) // nothing about how the blog is served
  })
})

describe('proxying', () => {
  it('forwards /blog/... to WordPress with the public host name and returns its response', async () => {
    const calls = wordpress()
    const res = await proxy('/blog/my-post?utm_source=x', {
      headers: {
        'user-agent': 'TestBrowser/1.0',
        accept: 'text/html',
        'accept-language': 'en-GB',
        cookie: 'wp_session=abc',
        referer: 'https://google.com/',
        'x-forwarded-for': '198.51.100.7, 10.0.0.1',
      },
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>ok</html>')
    expect(res.headers.get('content-type')).toBe('text/html')

    expect(calls).toHaveLength(1)
    const upstream = calls[0]
    expect(upstream.url.pathname + upstream.url.search).toBe('/blog/my-post?utm_source=x')
    expect(upstream.headers.get('host')).toBe('coursecorrect.fyi')
    expect(upstream.headers.get('x-forwarded-proto')).toBe('https')
    expect(upstream.headers.get('x-forwarded-host')).toBe('coursecorrect.fyi')
    expect(upstream.headers.get('x-forwarded-for')).toBe('198.51.100.7, 10.0.0.1')
    expect(upstream.headers.get('x-real-ip')).toBe('198.51.100.7')
    expect(upstream.headers.get('user-agent')).toBe('TestBrowser/1.0')
    expect(upstream.headers.get('accept-language')).toBe('en-GB')
    expect(upstream.headers.get('cookie')).toBe('wp_session=abc')
    expect(upstream.headers.get('referer')).toBe('https://google.com/')
  })

  it('adds the trailing slash WordPress expects for the blog root', async () => {
    const calls = wordpress()
    await proxy('/blog')
    expect(calls[0].url.pathname).toBe('/blog/')
  })

  it('passes the upstream status through (e.g. 404)', async () => {
    wordpress(() => new HttpResponse('not found', { status: 404, headers: { 'Content-Type': 'text/html' } }))
    const res = await proxy('/blog/missing')
    expect(res.status).toBe(404)
  })

  it('returns binary bodies byte for byte', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10])
    wordpress(() => new HttpResponse(bytes, { headers: { 'Content-Type': 'image/png' } }))
    const res = await proxy('/blog/wp-content/uploads/a.png')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
    expect(res.headers.get('content-type')).toBe('image/png')
  })

  it('forwards the method and body of form posts (e.g. comments)', async () => {
    const calls = wordpress(() => new HttpResponse('thanks'))
    await proxy('/blog/wp-comments-post.php', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'comment=hi&post_id=1',
    })
    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers.get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(calls[0].body).toBe('comment=hi&post_id=1')
  })

  it.each(['PUT', 'DELETE', 'PATCH'])('also proxies %s', async method => {
    const calls = wordpress()
    await proxy('/blog/wp-json/x', { method })
    expect(calls[0].method).toBe(method)
  })
})

describe('response headers', () => {
  it('forwards caching and security headers from WordPress', async () => {
    wordpress(
      () =>
        new HttpResponse('x', {
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache',
            ETag: '"abc"',
            'Last-Modified': 'Sun, 01 Mar 2026 00:00:00 GMT',
            'X-Frame-Options': 'SAMEORIGIN',
            'Content-Security-Policy': "default-src 'self'",
            'X-Content-Type-Options': 'nosniff',
            'X-Powered-By': 'PHP/8', // not in the allow-list
          },
        }),
    )
    const res = await proxy('/blog/post')
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(res.headers.get('etag')).toBe('"abc"')
    expect(res.headers.get('last-modified')).toBe('Sun, 01 Mar 2026 00:00:00 GMT')
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(res.headers.get('content-security-policy')).toBe("default-src 'self'")
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-powered-by')).toBeNull()
  })

  it('defaults to HTML and one hour of caching when WordPress sets neither', async () => {
    // A byte body: a string body would make Response add "text/plain" by itself.
    wordpress(() => new Response(new TextEncoder().encode('x')))
    const res = await proxy('/blog/post')
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  it('allows cross-origin use of fonts and fixes their content type', async () => {
    wordpress(() => new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'application/octet-stream' } }))
    const res = await proxy('/blog/wp-content/themes/t/font.woff2')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('content-type')).toBe('font/woff2')
  })

  it.each([
    ['font.ttf', 'font/ttf'],
    ['font.woff', 'font/woff'],
    ['font.otf', 'font/otf'],
    ['font.eot', 'application/vnd.ms-fontobject'],
  ])('fixes the content type of %s', async (file, type) => {
    wordpress(() => new HttpResponse(new Uint8Array([1]), { headers: { 'Content-Type': 'application/octet-stream' } }))
    const res = await proxy(`/blog/wp-content/fonts/${file}`)
    expect(res.headers.get('content-type')).toBe(type)
  })

  it('keeps a font content type WordPress already set', async () => {
    wordpress(() => new HttpResponse(new Uint8Array([1]), { headers: { 'Content-Type': 'font/woff2' } }))
    const res = await proxy('/blog/wp-content/fonts/x.woff2')
    expect(res.headers.get('content-type')).toBe('font/woff2')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('passes a relative Location on a non-redirect response through unchanged (e.g. 201 Created)', async () => {
    wordpress(() => new HttpResponse('created', { status: 201, headers: { Location: '/blog/new-post/' } }))
    const res = await proxy('/blog/wp-json/wp/v2/posts', { method: 'POST', body: '{}' })
    expect(res.status).toBe(201)
    expect(res.headers.get('location')).toBe('/blog/new-post/')
  })

  it('answers CORS preflight requests', async () => {
    const res = await OPTIONS(new NextRequest('https://coursecorrect.fyi/blog/x', { method: 'OPTIONS' }), {
      params: Promise.resolve({ slug: ['x'] }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS')
  })
})

describe('redirects', () => {
  it('follows redirects to the public domain internally and returns the final page', async () => {
    const calls = wordpress(request =>
      new URL(request.url).pathname === '/blog/old-post'
        ? new HttpResponse(null, { status: 301, headers: { Location: 'https://coursecorrect.fyi/blog/new-post/' } })
        : new HttpResponse('new post', { headers: { 'Content-Type': 'text/html' } }),
    )
    const res = await proxy('/blog/old-post')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('new post')
    expect(calls.map(c => c.url.pathname)).toEqual(['/blog/old-post', '/blog/new-post/'])
  })

  it('passes redirects to other sites through to the browser', async () => {
    wordpress(() => new HttpResponse(null, { status: 302, headers: { Location: 'https://example.com/elsewhere' } }))
    const res = await proxy('/blog/out')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com/elsewhere')
  })

  it('rewrites redirects that point at the WordPress IP to the public https domain', async () => {
    wordpress(() => new HttpResponse(null, { status: 302, headers: { Location: `${WP}/blog/page/2/` } }))
    const res = await proxy('/blog/page/2')
    expect(res.headers.get('location')).toBe('https://coursecorrect.fyi/blog/page/2/')
  })
})

describe('errors and input validation', () => {
  it('answers 502 without revealing the WordPress origin when it is unreachable', async () => {
    allowConsole('error', '[Blog Proxy] Error')
    server.use(http.all(`${WP}/*`, () => HttpResponse.error()))
    const res = await proxy('/blog/post')
    expect(res.status).toBe(502)
    const body = await res.text()
    expect(JSON.parse(body)).toEqual({ error: 'Failed to load the blog. Please try again later.' })
    expect(body).not.toContain(WP_IP) // the origin's address (and error details) go to the server log only
    expect(body).not.toMatch(/wordpress|proxy/i) // nor what serves the blog
  })

  it('rejects paths that embed a URL scheme', async () => {
    allowConsole('error', 'Path contains URL scheme')
    const res = await proxy('/blog/http://evil.example/x')
    expect(res.status).toBe(400)
  })

  it('rejects error text that does not start with a blog path', async () => {
    allowConsole('error', '[Blog Proxy] Invalid path detected')
    const request = new NextRequest(`https://coursecorrect.fyi/blog/x`, { headers: { host: 'coursecorrect.fyi' } })
    Object.defineProperty(request, 'nextUrl', { value: new URL("https://coursecorrect.fyi/' from origin 'https://x'") })
    const res = await GET(request, { params: Promise.resolve({ slug: ['x'] }) })
    expect(res.status).toBe(400)
  })

  it('rejects paths outside /blog (the route is only mounted there, this guards misuse)', async () => {
    allowConsole('error', '[Blog Proxy] Rejected path')
    const request = new NextRequest('https://coursecorrect.fyi/wp-admin/', { headers: { host: 'coursecorrect.fyi' } })
    const res = await GET(request, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
  })

  it('strips browser error text that got appended to a blog URL', async () => {
    allowConsole('warn', 'Cleaned corrupted path')
    const calls = wordpress()
    await proxy(`/blog/post' from origin 'https://coursecorrect.fyi' has been blocked`)
    expect(calls[0].url.pathname).toBe('/blog/post')
  })
})

// ── Safety (B10, B11, B12) ──────────────────────────────────────────────────────

describe('path, redirect and cookie safety', () => {
  it('forwards percent-encoded paths unchanged (non-Latin slugs, spaces)', async () => {
    const calls = wordpress()
    const res = await proxy('/blog/%E6%97%A5%E6%9C%AC-post')
    expect(res.status).toBe(200)
    expect(calls.map(c => c.url.pathname)).toEqual(['/blog/%E6%97%A5%E6%9C%AC-post'])
    await proxy('/blog/my%20post')
    expect(calls[1].url.pathname).toBe('/blog/my%20post')
  })

  it('cannot be used to reach WordPress paths outside /blog via an encoded "../"', async () => {
    // `%2e%2e` is already normalised by the URL parser, but `..%2F` reaches the route; decoded, it would become a
    // real "../", which WordPress then resolves to /wp-login.php.
    allowConsole('error', '[Blog Proxy] Rejected path')
    const calls = wordpress()
    const res = await proxy('/blog/..%2Fwp-login.php')
    expect(res.status).toBe(400)
    expect(calls).toEqual([]) // rejected before any upstream call
  })

  it.each([
    ['an encoded slash', '/blog/a%2fb'],
    ['an encoded backslash', '/blog/..%5Cwp-login.php'],
    ['an encoded backslash (lower case)', '/blog/x%5c..%5cwp-admin'],
    ['malformed percent-encoding', '/blog/%E6%97'],
  ])('rejects %s without contacting WordPress', async (_label, path) => {
    allowConsole('error', '[Blog Proxy] Rejected path')
    const calls = wordpress()
    const res = await proxy(path)
    expect(res.status).toBe(400)
    expect(calls).toEqual([])
  })

  it.each(['/blog/../wp-login.php', '/blog/./x/../../wp-admin/', '/blog/%2e%2e/wp-login.php'])(
    'rejects the dot segments in %s, should a proxy in front ever pass them through unresolved',
    async pathname => {
      // The URL parser resolves dot segments before the route sees them, so fake a request that kept them.
      allowConsole('error', '[Blog Proxy] Rejected path')
      const calls = wordpress()
      const request = new NextRequest('https://coursecorrect.fyi/blog/x', { headers: { host: 'coursecorrect.fyi' } })
      Object.defineProperty(request, 'nextUrl', { value: { pathname, search: '' } })
      const res = await GET(request, { params: Promise.resolve({ slug: ['x'] }) })
      expect(res.status).toBe(400)
      expect(calls).toEqual([])
    },
  )

  it('stops following a redirect loop and hands the redirect to the browser', async () => {
    const calls = wordpress(() =>
      calls.length > 25
        ? new HttpResponse('escaped the loop') // safety valve so the test itself terminates
        : new HttpResponse(null, { status: 301, headers: { Location: 'https://coursecorrect.fyi/blog/loop/' } }),
    )
    const res = await proxy('/blog/loop')
    expect(calls).toHaveLength(1 + MAX_REDIRECTS)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://coursecorrect.fyi/blog/loop/')
  })

  it(`follows a chain of exactly ${MAX_REDIRECTS} redirects to the final page`, async () => {
    const calls = wordpress(request => {
      const hop = Number(new URL(request.url).pathname.match(/\/blog\/hop-(\d+)/)?.[1] ?? 0)
      return hop < MAX_REDIRECTS
        ? new HttpResponse(null, { status: 302, headers: { Location: `https://coursecorrect.fyi/blog/hop-${hop + 1}` } })
        : new HttpResponse('final', { headers: { 'Content-Type': 'text/html' } })
    })
    const res = await proxy('/blog/hop-0')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('final')
    expect(calls).toHaveLength(1 + MAX_REDIRECTS)
  })

  it('handles a relative Location header instead of crashing and hanging', async () => {
    // MSW delivers socket events asynchronously, so the proxy's exception would escape as an uncaught error
    // and abort the test run. This fake emits synchronously, so the exception can be captured.
    const thrown: unknown[] = []
    const { default: nodeHttp } = await import('http')
    const { EventEmitter } = await import('node:events')
    vi.spyOn(nodeHttp, 'request').mockImplementation(((options: { path: string }, onResponse: (res: unknown) => void) => {
      const req = Object.assign(new EventEmitter(), {
        write() {},
        end() {
          const res = Object.assign(new EventEmitter(), {
            statusCode: options.path === '/blog/old' ? 301 : 200,
            headers: options.path === '/blog/old' ? { location: '/blog/new/' } : { 'content-type': 'text/html' },
          })
          onResponse(res)
          try {
            res.emit('data', Buffer.from(options.path === '/blog/old' ? '' : 'new post'))
            res.emit('end')
          } catch (e) {
            thrown.push(e)
          }
        },
      })
      return req
    }) as never)

    const outcome = await Promise.race([
      proxy('/blog/old').then(async r => `${r.status} ${await r.text()}`),
      new Promise<string>(resolve => setTimeout(() => resolve('no response after 1s'), 1000)),
    ])

    expect(thrown).toEqual([])
    expect(outcome).toBe('200 new post')
  })

  it('forwards every Set-Cookie header, not only the first', async () => {
    wordpress(() => {
      const headers = new Headers({ 'Content-Type': 'text/html' })
      headers.append('Set-Cookie', 'a=1; Path=/')
      headers.append('Set-Cookie', 'b=2; Path=/')
      return new HttpResponse('x', { headers })
    })
    const res = await proxy('/blog/post')
    expect(res.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/'])
  })
})
