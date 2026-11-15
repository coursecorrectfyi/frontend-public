import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/msw'
import { delta, done, errorEvent, sseResponse, sseResponseFromChunks } from '@/test/sse'
import { type ChatRequest, type ChatStreamChunk, CurrentPage, sendChatMessage } from './chat'

// Contract: docs/backend-api.md → "POST /api/v1/chat".

const SESSION_ID = '3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f'

const request = (overrides: Partial<ChatRequest> = {}): ChatRequest => ({
  message: 'Which course should I take?',
  chatId: 'chat-1',
  pageContextIds: ['00000000-0000-4000-8000-000000000001'],
  currentPage: CurrentPage.SEARCH_RESULT,
  searchTerm: 'python',
  history: [
    { role: 'user', content: 'Hi' },
    { role: 'bot', content: 'Hello!' },
  ],
  ...overrides,
})

async function collect(stream: AsyncGenerator<ChatStreamChunk>): Promise<ChatStreamChunk[]> {
  const chunks: ChatStreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

/** What the user would end up seeing: either the streamed chunks or the error that was thrown. */
async function outcome(stream: AsyncGenerator<ChatStreamChunk>): Promise<string> {
  try {
    return JSON.stringify(await collect(stream))
  } catch (e) {
    return `thrown: ${(e as Error).message}`
  }
}

describe('sendChatMessage: request', () => {
  it('POSTs the payload as JSON to /api/v1/chat', async () => {
    const calls = mockApi('post', '/api/v1/chat', () => sseResponse([done()]))
    const payload = request()

    await collect(sendChatMessage(payload, null, SESSION_ID))

    expect(calls).toHaveLength(1)
    expect(calls[0].headers.get('content-type')).toBe('application/json')
    expect(JSON.parse(calls[0].body)).toEqual(payload)
  })

  it('identifies anonymous visitors with X-Session-ID only', async () => {
    const calls = mockApi('post', '/api/v1/chat', () => sseResponse([done()]))
    await collect(sendChatMessage(request(), null, SESSION_ID))
    expect(calls[0].headers.get('x-session-id')).toBe(SESSION_ID)
    expect(calls[0].headers.has('authorization')).toBe(false)
  })

  it('sends the access token for signed-in users, and the session id as a fallback', async () => {
    // Contract: "If both are sent, a valid token wins. If the token is invalid or expired, the session id is used."
    const calls = mockApi('post', '/api/v1/chat', () => sseResponse([done()]))
    await collect(sendChatMessage(request(), 'access-token', SESSION_ID))
    expect(calls[0].headers.get('authorization')).toBe('Bearer access-token')
    expect(calls[0].headers.get('x-session-id')).toBe(SESSION_ID)
  })

  it('sends pageContextIds, never the deprecated courseIds', async () => {
    const calls = mockApi('post', '/api/v1/chat', () => sseResponse([done()]))
    await collect(sendChatMessage(request(), null, SESSION_ID))
    const body = JSON.parse(calls[0].body)
    expect(body.pageContextIds).toEqual(['00000000-0000-4000-8000-000000000001'])
    expect(body).not.toHaveProperty('courseIds')
  })

  it('uses the page names the backend knows', () => {
    expect(Object.values(CurrentPage).sort()).toEqual(['CourseDetail', 'SavedCourses', 'SearchResult', 'SubjectPage'])
  })
})

describe('sendChatMessage: stream parsing', () => {
  it('yields delta events in order and finishes at done', async () => {
    mockApi('post', '/api/v1/chat', () => sseResponse([delta('Hel'), delta('lo'), done()]))
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'Hel' },
      { type: 'delta', content: 'lo' },
      { type: 'done' },
    ])
  })

  it('passes on the truncated flag of done', async () => {
    mockApi('post', '/api/v1/chat', () => sseResponse([delta('long answer'), done(true)]))
    const chunks = await collect(sendChatMessage(request(), null, SESSION_ID))
    expect(chunks.at(-1)).toEqual({ type: 'done', truncated: true })
  })

  it('stops reading after done, ignoring anything after it', async () => {
    mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done(), delta('ignored')]))
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'a' },
      { type: 'done' },
    ])
  })

  it('reassembles events split across network chunks, even mid-line', async () => {
    mockApi('post', '/api/v1/chat', () =>
      sseResponseFromChunks(['data: {"type":"del', 'ta","content":"Hello wor', 'ld"}\n', '\ndata: {"type":"done"}\n\n']),
    )
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'Hello world' },
      { type: 'done' },
    ])
  })

  it('reassembles multi-byte characters split across network chunks', async () => {
    const bytes = new TextEncoder().encode(`data: ${JSON.stringify(delta('Ünïcödé 👩‍💻 日本'))}\n\ndata: {"type":"done"}\n\n`)
    // Split inside the emoji's UTF-8 byte sequence.
    const splitAt = bytes.indexOf(0xf0) + 2
    mockApi('post', '/api/v1/chat', () => sseResponseFromChunks([bytes.slice(0, splitAt), bytes.slice(splitAt)]))
    const chunks = await collect(sendChatMessage(request(), null, SESSION_ID))
    expect(chunks[0]).toEqual({ type: 'delta', content: 'Ünïcödé 👩‍💻 日本' })
  })

  it('accepts CRLF line endings', async () => {
    mockApi('post', '/api/v1/chat', () =>
      sseResponseFromChunks(['data: {"type":"delta","content":"a"}\r\n\r\n', 'data: {"type":"done"}\r\n\r\n']),
    )
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'a' },
      { type: 'done' },
    ])
  })

  it('ignores comments, other SSE fields, blank data and malformed JSON', async () => {
    mockApi('post', '/api/v1/chat', () =>
      sseResponseFromChunks([
        ': keep-alive\n\n',
        'event: message\nid: 1\n',
        'data: \n\n',
        'data: {not json}\n\n',
        'data: {"type":"delta","content":"ok"}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    )
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'ok' },
      { type: 'done' },
    ])
  })

  it('yields error events (generation failed or timed out)', async () => {
    mockApi('post', '/api/v1/chat', () => sseResponse([delta('partial'), errorEvent('Generation timed out.')]))
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'partial' },
      { type: 'error', message: 'Generation timed out.' },
    ])
  })

  it('ends quietly when the stream closes without done (the caller decides what to show)', async () => {
    mockApi('post', '/api/v1/chat', () => sseResponse([delta('cut off')]))
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'cut off' },
    ])
  })

  it.fails('KNOWN BUG (B21): handles a final event that is not followed by a newline', async () => {
    mockApi('post', '/api/v1/chat', () =>
      sseResponseFromChunks(['data: {"type":"delta","content":"a"}\n\n', 'data: {"type":"done"}']),
    )
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'a' },
      { type: 'done' },
    ])
  })
})

describe('sendChatMessage: errors', () => {
  it('turns a 429 into a limit_reached chunk carrying the backend message', async () => {
    const message = 'Too many questions from your network today. Sign in to get 10 questions per day.'
    mockApi('post', '/api/v1/chat', { limitReached: true, message }, { status: 429, headers: { 'Retry-After': '3600' } })
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([{ type: 'limit_reached', message }])
  })

  it('falls back to a generic limit message when the 429 body is not JSON or has no message', async () => {
    mockApi('post', '/api/v1/chat', () => new Response('Too Many Requests', { status: 429 }))
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'limit_reached', message: 'Daily limit reached.' },
    ])

    mockApi('post', '/api/v1/chat', { limitReached: true }, { status: 429 })
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'limit_reached', message: 'Daily limit reached.' },
    ])
  })

  it.each([401, 500, 502])('throws on HTTP %i', async status => {
    mockApi('post', '/api/v1/chat', { error: 'x' }, { status })
    await expect(collect(sendChatMessage(request(), null, SESSION_ID))).rejects.toThrow(
      `Chat request failed: ${status}`,
    )
  })

  it('yields nothing for a 200 with an empty body (fetch gives an empty stream, not a null body)', async () => {
    mockApi('post', '/api/v1/chat', () => new Response(null, { status: 200 }))
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([])
  })

  it('throws for a success status that cannot carry a body (204)', async () => {
    mockApi('post', '/api/v1/chat', () => new Response(null, { status: 204 }))
    await expect(collect(sendChatMessage(request(), null, SESSION_ID))).rejects.toThrow('No response body')
  })

  // Contract: docs/backend-api.md → "POST /api/v1/chat", Responses: show `error` on 400.
  it.fails('KNOWN BUG (C2): surfaces the backend message for a 400 (e.g. message too long)', async () => {
    mockApi(
      'post',
      '/api/v1/chat',
      { error: 'message must be at most 4000 characters', maxLength: 4000 },
      { status: 400 },
    )
    expect(await outcome(sendChatMessage(request(), null, SESSION_ID))).toContain(
      'message must be at most 4000 characters',
    )
  })

  it.fails('KNOWN BUG (C2): surfaces a readable message for a 413 (request body too large)', async () => {
    mockApi('post', '/api/v1/chat', { error: 'Request body too large', maxBytes: 524288 }, { status: 413 })
    expect(await outcome(sendChatMessage(request(), null, SESSION_ID))).toMatch(/too large|too long/i)
  })
})
