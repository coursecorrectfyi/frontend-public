/**
 * Network layer for tests.
 *
 * Every request made by the code under test (fetch, or node:http in server code) goes through MSW.
 * A request without a matching handler never reaches the network: it fails with a network error AND is recorded;
 * the global afterEach in setup.ts then fails the test, even if the app code swallowed the error.
 *
 * Add handlers per test with `server.use(http.get(apiUrl('/api/v1/...'), ...))`.
 * Handlers added with server.use() are removed after each test.
 */
import { setupServer } from 'msw/node'

import { delay, http, HttpResponse } from 'msw'

export { delay, http, HttpResponse }

/** Base URL the app is configured with in tests (see vitest.config.mts). */
export const API_URL = 'http://api.test'

/** Absolute URL on the test backend, e.g. apiUrl('/api/v1/subjects'). */
export const apiUrl = (path: string) => `${API_URL}${path}`

export const server = setupServer()

const unhandledRequests: string[] = []

function describeFrame(frame: unknown): string {
  const data = (frame as { data?: { request?: Request } })?.data
  const request = data?.request
  if (request && typeof request.url === 'string') return `${request.method} ${request.url}`
  return String((frame as { protocol?: string })?.protocol ?? 'unknown frame')
}

export function startServer() {
  server.listen({
    onUnhandledFrame({ frame }) {
      unhandledRequests.push(describeFrame(frame))
      // Throwing a Response makes MSW answer with it; Response.error() is a network error, so the request fails
      // WITHOUT reaching the network. (With a custom callback, MSW's `defaults.error()` only prints a message and
      // then lets the request through — verified against a real local server in harness.test.tsx.)
      throw Response.error()
    },
  })
}

/** Returns and clears the requests that had no handler since the last call. */
export function takeUnhandledRequests(): string[] {
  return unhandledRequests.splice(0)
}

export interface RecordedRequest {
  method: string
  url: URL
  headers: Headers
  params: Record<string, string | readonly string[] | undefined>
  /** Raw request body ('' when there is none). */
  body: string
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'
type Responder = (request: Request) => Response | Promise<Response>

/**
 * Mocks one endpoint of the test backend and records every request it receives.
 *
 *   const calls = mockApi('get', '/api/v1/saved', { data: [] })
 *   const calls = mockApi('post', '/api/v1/saved/:id', { ok: true }, { status: 404 })
 *   const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('Hi'), done()]))
 *   ...
 *   expect(calls[0].headers.get('authorization')).toBe('Bearer access-token')
 *
 * `reply` is sent as JSON unless it is a function returning a Response. `path` may also be an absolute URL.
 */
export function mockApi(method: Method, path: string, respond: Responder): RecordedRequest[]
export function mockApi(method: Method, path: string, json: unknown, init?: ResponseInit): RecordedRequest[]
export function mockApi(method: Method, path: string, reply: unknown, init?: ResponseInit): RecordedRequest[] {
  const calls: RecordedRequest[] = []
  const url = /^https?:\/\//.test(path) ? path : apiUrl(path)
  server.use(
    http[method](url, async ({ request, params }) => {
      calls.push({
        method: request.method,
        url: new URL(request.url),
        headers: request.headers,
        params: params as RecordedRequest['params'],
        body: await request.clone().text(),
      })
      return typeof reply === 'function'
        ? (reply as Responder)(request)
        : HttpResponse.json(reply as never, init)
    }),
  )
  return calls
}

/**
 * Holds a mocked response until the test releases it, to assert on in-between states (optimistic updates,
 * spinners) deterministically instead of racing a delay():
 *
 *   const gate = createGate()
 *   mockApi('delete', '/api/v1/saved/:id', async () => { await gate.wait(); return Response.json({ ok: true }) })
 *   ...assert the optimistic state...
 *   gate.open()
 */
export function createGate() {
  let open!: () => void
  const promise = new Promise<void>(resolve => {
    open = resolve
  })
  return { wait: () => promise, open }
}
