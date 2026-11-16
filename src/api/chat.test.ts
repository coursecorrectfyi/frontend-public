import { describe, expect, it } from 'vitest'
import { isDailyLimit, isRateLimited } from './errors'
import { limitResponse, makeChatSignedInOnly, makeChatUnavailable, makeDailyLimit, makeRateLimited } from '@/test/fixtures'
import { mockApi } from '@/test/msw'
import { controlledSse, delta, done, errorEvent, sseResponse, sseResponseFromChunks } from '@/test/sse'
import {
  capHistory,
  capPageContextIds,
  type ChatHistoryMessage,
  type ChatRequest,
  type ChatStreamChunk,
  CurrentPage,
  MAX_HISTORY_LENGTH,
  MAX_HISTORY_TURNS,
  MAX_PAGE_CONTEXT_IDS,
  MAX_TURN_LENGTH,
  sendChatMessage,
} from './chat'

// Contract: docs/backend-api.md → "POST /api/v1/chat".

const SESSION_ID = '3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f'

const request = (overrides: Partial<ChatRequest> = {}): ChatRequest => ({
  message: 'Which course should I take?',
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

  it('sends only fields the contract defines (no chatId)', async () => {
    const calls = mockApi('post', '/api/v1/chat', () => sseResponse([done()]))
    await collect(sendChatMessage(request(), null, SESSION_ID))
    expect(Object.keys(JSON.parse(calls[0].body)).sort()).toEqual(
      ['currentPage', 'history', 'message', 'pageContextIds', 'searchTerm'],
    )
  })

  it('keeps the body within the contract limits, whoever the caller is', async () => {
    const calls = mockApi('post', '/api/v1/chat', () => sseResponse([done()]))
    const history = Array.from({ length: 30 }, (_, i): ChatHistoryMessage => ({ role: i % 2 ? 'bot' : 'user', content: `t${i}` }))
    const ids = Array.from({ length: 60 }, (_, i) => `id-${i}`)
    await collect(sendChatMessage(request({ history, pageContextIds: ids }), null, SESSION_ID))
    const body = JSON.parse(calls[0].body)
    expect(body.history).toHaveLength(MAX_HISTORY_TURNS)
    expect(body.history[0]).toEqual({ role: 'user', content: 't10' })
    expect(body.pageContextIds).toEqual(ids.slice(0, MAX_PAGE_CONTEXT_IDS))
  })

  it('can be cancelled: aborting stops the request and the stream', async () => {
    let aborted = false
    const sse = controlledSse() // driven step by step: nothing left pending after the abort
    mockApi('post', '/api/v1/chat', req => {
      req.signal.addEventListener('abort', () => {
        aborted = true
      })
      return sse.response()
    })
    const controller = new AbortController()
    const stream = sendChatMessage(request(), null, SESSION_ID, controller.signal)
    sse.send(delta('a'))
    expect((await stream.next()).value).toEqual({ type: 'delta', content: 'a' })
    controller.abort()
    await expect(stream.next()).rejects.toMatchObject({ name: 'AbortError' })
    await expect.poll(() => aborted).toBe(true)
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

  it('handles a final event that is not followed by a newline', async () => {
    mockApi('post', '/api/v1/chat', () =>
      sseResponseFromChunks(['data: {"type":"delta","content":"a"}\n\n', 'data: {"type":"done"}']),
    )
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'a' },
      { type: 'done' },
    ])
  })

  it('handles a last delta without a newline when the stream ends without done', async () => {
    mockApi('post', '/api/v1/chat', () => sseResponseFromChunks(['data: {"type":"delta","content":"a"}\n\n', 'data: {"type":"delta","content":"b"}']))
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'a' },
      { type: 'delta', content: 'b' },
    ])
  })

  it('handles a final event split across chunks without a trailing newline', async () => {
    mockApi('post', '/api/v1/chat', () => sseResponseFromChunks(['data: {"type":"delta","content":"a"}\n\ndata: {"ty', 'pe":"done"}']))
    expect(await collect(sendChatMessage(request(), null, SESSION_ID))).toEqual([
      { type: 'delta', content: 'a' },
      { type: 'done' },
    ])
  })
})

describe('capHistory', () => {
  const turns = (n: number, content = (i: number) => `t${i}`): ChatHistoryMessage[] =>
    Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', content: content(i) }))

  it('keeps a short history as is', () => {
    const history = turns(4)
    expect(capHistory(history)).toEqual(history)
    expect(capHistory([])).toEqual([])
  })

  it(`keeps the most recent ${MAX_HISTORY_TURNS} turns`, () => {
    const capped = capHistory(turns(22))
    expect(capped).toHaveLength(MAX_HISTORY_TURNS)
    expect(capped.at(-1)?.content).toBe('t21')
    expect(capped[0]).toEqual({ role: 'user', content: 't2' })
  })

  it('starts with a user turn when older turns were dropped', () => {
    const capped = capHistory(turns(21)) // the 20 most recent start with a bot turn (t1)
    expect(capped[0]).toEqual({ role: 'user', content: 't2' })
    expect(capped).toHaveLength(19)
  })

  it('does not drop a leading bot turn when nothing was dropped', () => {
    const history: ChatHistoryMessage[] = [{ role: 'bot', content: 'hi' }, { role: 'user', content: 'q' }]
    expect(capHistory(history)).toEqual(history)
  })

  it(`cuts each turn to ${MAX_TURN_LENGTH.toLocaleString('en-US')} characters`, () => {
    const capped = capHistory([{ role: 'user', content: 'q' }, { role: 'bot', content: 'x'.repeat(MAX_TURN_LENGTH + 5) }])
    expect(capped[1].content).toHaveLength(MAX_TURN_LENGTH)
    expect(capped[0].content).toBe('q')
  })

  it(`drops the oldest turns to stay within ${MAX_HISTORY_LENGTH.toLocaleString('en-US')} characters in total`, () => {
    // 4 turns of 10,000 characters = 40,000: the oldest is dropped, then the leading bot turn.
    const capped = capHistory(turns(4, i => String(i).repeat(10_000)))
    expect(capped.map(t => t.content[0])).toEqual(['2', '3'])
    expect(capped[0].role).toBe('user')
    expect(capped.reduce((n, t) => n + t.content.length, 0)).toBeLessThanOrEqual(MAX_HISTORY_LENGTH)
  })

  it('keeps exactly the total limit', () => {
    const capped = capHistory(turns(4, () => 'x'.repeat(MAX_HISTORY_LENGTH / 4)))
    expect(capped).toHaveLength(4)
  })
})

describe('capPageContextIds', () => {
  it(`keeps the first ${MAX_PAGE_CONTEXT_IDS} distinct, non-empty ids, in order`, () => {
    const ids = ['a', 'b', 'a', '', ' ', ...Array.from({ length: 60 }, (_, i) => `r${i}`)]
    const capped = capPageContextIds(ids)
    expect(capped).toHaveLength(MAX_PAGE_CONTEXT_IDS)
    expect(capped.slice(0, 3)).toEqual(['a', 'b', 'r0'])
    expect(new Set(capped).size).toBe(capped.length)
  })
})

describe('sendChatMessage: errors', () => {
  it('throws a daily limit as an ApiError with the backend message, scope and wait', async () => {
    const body = makeDailyLimit('ip')
    mockApi('post', '/api/v1/chat', () => limitResponse(body))
    const error = await collect(sendChatMessage(request(), null, SESSION_ID)).catch(e => e)
    expect(isDailyLimit(error)).toBe(true)
    expect(error).toMatchObject({ status: 429, code: 'daily_limit', scope: 'ip', message: body.message, retryAfter: body.retryAfter })
  })

  it('throws a per-minute rate limit as a temporary ApiError, not a daily limit', async () => {
    mockApi('post', '/api/v1/chat', () => limitResponse(makeRateLimited({ retryAfter: 4 })))
    const error = await collect(sendChatMessage(request(), null, SESSION_ID)).catch(e => e)
    expect(isRateLimited(error)).toBe(true)
    expect(isDailyLimit(error)).toBe(false)
    expect(error).toMatchObject({ status: 429, retryAfter: 4, message: 'Too many requests. Please wait a moment and try again.' })
  })

  it('gives a 429 without a usable body a readable message (and treats it as temporary)', async () => {
    mockApi('post', '/api/v1/chat', () => new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '2' } }))
    const error = await collect(sendChatMessage(request(), null, SESSION_ID)).catch(e => e)
    expect(isRateLimited(error)).toBe(true)
    expect(error).toMatchObject({ retryAfter: 2, message: 'Too many requests. Please wait a moment and try again.' })
  })

  it('treats an old-style 429 ({ limitReached: true }, no code) as a daily limit', async () => {
    mockApi('post', '/api/v1/chat', { limitReached: true }, { status: 429 })
    expect(isDailyLimit(await collect(sendChatMessage(request(), null, SESSION_ID)).catch(e => e))).toBe(true)
  })

  it('gives a 503 without a message a readable one', async () => {
    mockApi('post', '/api/v1/chat', { error: 'Service Unavailable' }, { status: 503 })
    await expect(collect(sendChatMessage(request(), null, SESSION_ID))).rejects.toMatchObject({
      status: 503,
      message: 'Cora is unavailable right now. Please try again later.',
    })
  })

  it.each([401, 500, 502])('throws on HTTP %i', async status => {
    mockApi('post', '/api/v1/chat', { error: 'x' }, { status })
    await expect(collect(sendChatMessage(request(), null, SESSION_ID))).rejects.toThrow(
      `Chat request failed: ${status}`,
    )
  })

  it.each([
    ['chat_unavailable', makeChatUnavailable()],
    ['chat_signed_in_only', makeChatSignedInOnly()],
  ])('throws an ApiError with the code and the user-facing message for a 503 %s', async (code, body) => {
    mockApi('post', '/api/v1/chat', body, { status: 503 })
    await expect(collect(sendChatMessage(request(), null, SESSION_ID))).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      code,
      message: body.message,
    })
  })

  it('throws an ApiError that keeps the backend error and maxLength for a 400', async () => {
    mockApi('post', '/api/v1/chat', { error: 'message must be at most 4000 characters', maxLength: 4000 }, { status: 400 })
    await expect(collect(sendChatMessage(request(), null, SESSION_ID))).rejects.toMatchObject({
      status: 400,
      serverError: 'message must be at most 4000 characters',
      maxLength: 4000,
    })
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
  it('surfaces the backend message for a 400 (e.g. message too long)', async () => {
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

  it('surfaces a readable message for a 413 (request body too large)', async () => {
    mockApi('post', '/api/v1/chat', { error: 'Request body too large', maxBytes: 524288 }, { status: 413 })
    expect(await outcome(sendChatMessage(request(), null, SESSION_ID))).toMatch(/too large|too long/i)
  })
})
