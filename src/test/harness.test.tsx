/**
 * Tests for the test harness itself: if these fail, no other test result can be trusted.
 */
import http from 'node:http'
import { screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { describe, expect, it } from 'vitest'
import * as firebaseLib from '@/lib/firebase'
import CustomModal from '@/layouts/CustomModal'
import { allowConsole, installConsoleGuard, uninstallConsoleGuard } from './console'
import { firebase } from './mocks/firebase'
import { mockSessionLoading, mockSignedIn } from './mocks/next-auth'
import { router, setPathname, setSearchParams } from './mocks/next-navigation'
import { apiUrl, http as mswHttp, HttpResponse, server, takeUnhandledRequests } from './msw'
import { renderHookWithProviders, renderWithProviders } from './render'
import { delta, done, sseResponse, sseResponseFromChunks } from './sse'

describe('network isolation', () => {
  it('answers requests that have a handler, with the real Request visible to the handler', async () => {
    let seen: { method: string; auth: string | null; body: unknown } | undefined
    server.use(
      mswHttp.post(apiUrl('/api/v1/echo'), async ({ request }) => {
        seen = {
          method: request.method,
          auth: request.headers.get('authorization'),
          body: await request.json(),
        }
        return HttpResponse.json({ ok: true })
      }),
    )

    const res = await fetch(apiUrl('/api/v1/echo'), {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
      body: JSON.stringify({ a: 1 }),
    })

    expect(await res.json()).toEqual({ ok: true })
    expect(seen).toEqual({ method: 'POST', auth: 'Bearer t', body: { a: 1 } })
  })

  // A failing request alone proves nothing (the sandbox may have no network). The witness is a REAL server on
  // localhost: if an unhandled request reached the network, this server would see it.
  async function withRealLocalServer(test: (url: string, hits: () => number) => Promise<void>) {
    let hits = 0
    const real = http.createServer((_req, res) => {
      hits++
      res.end('real server')
    })
    await new Promise<void>(resolve => real.listen(0, '127.0.0.1', resolve))
    const { port } = real.address() as { port: number }
    try {
      await test(`http://127.0.0.1:${port}`, () => hits)
    } finally {
      await new Promise(resolve => real.close(resolve))
    }
  }

  it('blocks fetch requests without a handler (they never reach the network) and records them', async () => {
    await withRealLocalServer(async (url, hits) => {
      await expect(fetch(`${url}/x`)).rejects.toThrow()
      expect(hits()).toBe(0)
      expect(takeUnhandledRequests()).toEqual([`GET ${url}/x`]) // afterEach turns this into a test failure
    })
  })

  it('blocks node:http requests without a handler too (used by the /blog proxy)', async () => {
    await withRealLocalServer(async (url, hits) => {
      const { port } = new URL(url)
      const error = await new Promise<Error>(resolve => {
        const req = http.request({ hostname: '127.0.0.1', port, path: '/blog/', method: 'GET' })
        req.on('error', resolve)
        req.on('response', () => resolve(new Error('unexpected response')))
        req.end()
      })
      expect(error.message).not.toBe('unexpected response')
      expect(hits()).toBe(0)
      expect(takeUnhandledRequests()).toEqual([`GET ${url}/blog/`])
    })
  })

  it('serves the fixed test API URL to app code', () => {
    expect(process.env.NEXT_PUBLIC_API_URL).toBe('http://api.test')
  })

  it('delivers sseResponseFromChunks chunks as separate reads (so chunk-boundary tests test boundaries)', async () => {
    server.use(mswHttp.post(apiUrl('/api/v1/chat'), () => sseResponseFromChunks(['aaa', 'bbb', 'ccc'])))
    const reader = (await fetch(apiUrl('/api/v1/chat'), { method: 'POST' })).body!.getReader()
    const reads: string[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      reads.push(new TextDecoder().decode(value))
    }
    expect(reads).toEqual(['aaa', 'bbb', 'ccc'])
  })

  it('streams SSE responses chunk by chunk', async () => {
    server.use(mswHttp.post(apiUrl('/api/v1/chat'), () => sseResponse([delta('Hi'), done()])))
    const res = await fetch(apiUrl('/api/v1/chat'), { method: 'POST' })
    expect(res.headers.get('content-type')).toBe('text/event-stream')
    expect(await res.text()).toBe('data: {"type":"delta","content":"Hi"}\n\ndata: {"type":"done"}\n\n')
  })
})

describe('console guard', () => {
  it('records unexpected console.error and swallows allowed ones', () => {
    allowConsole('error', /expected failure/)
    console.error('an expected failure happened')
    // Unexpected messages are also printed, so this line shows up in the test output on purpose.
    console.error('[harness self-test] this unexpected message is printed on purpose')
    // Re-install so this test itself does not fail in afterEach.
    expect(uninstallConsoleGuard()).toEqual([
      'console.error: [harness self-test] this unexpected message is printed on purpose',
    ])
    installConsoleGuard()
  })
})

describe('platform mocks', () => {
  it('next-auth/react reflects the session set by the test', () => {
    const { result, rerender } = renderHookWithProviders(() => useSession())
    expect(result.current.status).toBe('unauthenticated')

    mockSignedIn({ user: { id: 'u-42' } })
    rerender()
    expect(result.current.status).toBe('authenticated')
    expect(result.current.data?.backendTokens?.user.id).toBe('u-42')

    mockSessionLoading()
    rerender()
    expect(result.current.status).toBe('loading')
  })

  it('next/navigation is controllable and its router is a spy', () => {
    setPathname('/search')
    setSearchParams({ q: 'python' })
    const { result } = renderHookWithProviders(() => ({
      router: useRouter(),
      pathname: usePathname(),
      q: useSearchParams().get('q'),
    }))
    result.current.router.push('/saved')
    expect(result.current.pathname).toBe('/search')
    expect(result.current.q).toBe('python')
    expect(router.push).toHaveBeenCalledWith('/saved')
  })

  it('@/lib/firebase is replaced, so the Firebase SDK never initialises', async () => {
    firebase.signInWithGoogle.mockResolvedValueOnce('token-from-test')
    await expect(firebaseLib.signInWithGoogle()).resolves.toBe('token-from-test')
  })
})

describe('rendering', () => {
  it('renders with the real branding theme (theme extensions such as applyDarkStyles exist)', () => {
    renderWithProviders(
      <CustomModal open onClose={() => {}}>
        <p>inside the modal</p>
      </CustomModal>,
    )
    expect(screen.getByText('inside the modal')).toBeInTheDocument()
  })

  it('polyfills matchMedia (desktop by default)', () => {
    expect(window.matchMedia('(max-width: 899.95px)').matches).toBe(false)
  })
})
