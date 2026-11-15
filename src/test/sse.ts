/**
 * Helpers for the chat Server-Sent Events stream (POST /api/v1/chat).
 *
 *   // Whole answer at once, one network chunk per event:
 *   server.use(http.post(apiUrl('/api/v1/chat'), () => sseResponse([delta('Hi'), done()])))
 *
 *   // Arbitrary chunk boundaries (e.g. split in the middle of a line):
 *   sseResponseFromChunks(['data: {"type":"del', 'ta","content":"Hi"}\n\n'])
 *
 *   // Stream you drive from the test (to assert on in-progress UI):
 *   const stream = controlledSse()
 *   server.use(http.post(apiUrl('/api/v1/chat'), () => stream.response()))
 *   stream.send(delta('Hel')); ...; stream.send(done()); stream.close()
 */

export type ChatEvent =
  | { type: 'delta'; content: string }
  | { type: 'done'; truncated?: boolean }
  | { type: 'error'; message: string }

export const delta = (content: string): ChatEvent => ({ type: 'delta', content })
export const done = (truncated?: boolean): ChatEvent =>
  truncated ? { type: 'done', truncated } : { type: 'done' }
export const errorEvent = (message: string): ChatEvent => ({ type: 'error', message })

/** One SSE event as the backend writes it: `data: <json>\n\n`. */
export const sseLine = (event: ChatEvent | string) =>
  `data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`

const SSE_HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }

/**
 * Streams `chunks` as separate network reads. Each chunk is released in its own macrotask: chunks enqueued
 * together are merged by the fetch/MSW pipeline into a single read, and the test would never see a boundary.
 * Strings are UTF-8 encoded; pass Uint8Array chunks to split inside a multi-byte character.
 */
export function sseResponseFromChunks(chunks: Array<string | Uint8Array>, init: ResponseInit = {}): Response {
  const encoder = new TextEncoder()
  const queue = [...chunks]
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      await new Promise(resolve => setTimeout(resolve, 0))
      const next = queue.shift()
      if (next === undefined) controller.close()
      else controller.enqueue(typeof next === 'string' ? encoder.encode(next) : next)
    },
  })
  return new Response(body, { status: 200, headers: SSE_HEADERS, ...init })
}

export function sseResponse(events: Array<ChatEvent | string>, init: ResponseInit = {}): Response {
  return sseResponseFromChunks(events.map(sseLine), init)
}

export function controlledSse() {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    response: () => new Response(body, { status: 200, headers: SSE_HEADERS }),
    send: (event: ChatEvent | string) => controller.enqueue(encoder.encode(sseLine(event))),
    sendRaw: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
    fail: (reason: unknown = new Error('connection reset')) => controller.error(reason),
  }
}
