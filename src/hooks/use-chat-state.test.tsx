import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CurrentPage, MAX_MESSAGE_LENGTH } from '@/api/chat'
import {
  DAILY_LIMIT_MESSAGES,
  limitResponse,
  makeBackendTokens,
  makeBodyTooLarge,
  makeChatSignedInOnly,
  makeChatUnavailable,
  makeDailyLimit,
  makeRateLimited,
} from '@/test/fixtures'
import { mockSessionLoading, mockSignedIn, mockSignedOut, nextAuth, setSession } from '@/test/mocks/next-auth'
import { HttpResponse, mockApi, type RecordedRequest } from '@/test/msw'
import { renderHookWithProviders } from '@/test/render'
import { controlledSse, delta, done, errorEvent, sseResponse } from '@/test/sse'
import {
  CUT_OFF,
  GENERIC_FAILURE,
  NETWORK_FAILURE,
  NO_ANSWER,
  type SendOutcome,
  TOO_LARGE,
  TOO_LONG,
  useChatState,
} from './use-chat-state'

// useChatState: conversation state for the Cora panel — identity, per-context history in localStorage,
// streaming answers, daily limits. Contract: docs/backend-api.md → "POST /api/v1/chat".

const DAY = 24 * 60 * 60 * 1000
const SESSION_ID = '3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f'

afterEach(() => {
  vi.useRealTimers()
})

type Props = { pageContextIds?: string[]; contextKey?: string }

function renderChat(initial: Props = { contextKey: 'search:python', pageContextIds: ['r1', 'r2'] }) {
  return renderHookWithProviders((props: Props) => useChatState(props), { initialProps: initial })
}

async function ready(result: { current: ReturnType<typeof useChatState> }) {
  // The hook resolves identity in an effect; sends before that are ignored.
  await waitFor(() => expect(result.current).toBeDefined())
  await act(async () => {})
}

/** Sends like the chat does and returns the outcome (`sent`, `not_sent` with the question, or `ignored`). */
async function send(result: { current: ReturnType<typeof useChatState> }, message = 'Which one?', page = CurrentPage.SEARCH_RESULT, term?: string) {
  let outcome: SendOutcome | undefined
  await act(async () => {
    outcome = await result.current.handleSendMessage(message, page, term)
  })
  return outcome
}

const storedChats = () =>
  Object.keys(localStorage)
    .filter(k => k.startsWith('chat_'))
    .map(k => ({ key: k, ...JSON.parse(localStorage.getItem(k)!) }))

const body = (call: RecordedRequest) => JSON.parse(call.body)

describe('useChatState', () => {
  describe('sending a message', () => {
    it('shows the question immediately and the typing indicator until the first words arrive', async () => {
      const stream = controlledSse()
      mockApi('post', '/api/v1/chat', () => stream.response())
      const { result } = renderChat()
      await ready(result)

      let sending!: Promise<unknown>
      act(() => {
        sending = result.current.handleSendMessage('Which one?', CurrentPage.SEARCH_RESULT, 'python')
      })
      await waitFor(() => expect(result.current.isTyping).toBe(true))
      expect(result.current.messages).toEqual([expect.objectContaining({ sender: 'user', content: 'Which one?' })])

      stream.send(delta('Take '))
      await waitFor(() => expect(result.current.isTyping).toBe(false))
      expect(result.current.messages.at(-1)).toMatchObject({ sender: 'bot', content: 'Take ', isStreaming: true })

      stream.send(delta('the first.'))
      await waitFor(() => expect(result.current.messages.at(-1)?.content).toBe('Take the first.'))

      stream.send(done())
      stream.close()
      await act(() => sending)
      expect(result.current.messages.at(-1)).toMatchObject({ content: 'Take the first.', isStreaming: false })
      expect(result.current.messageCount).toBe(2)
    })

    it('sends the question with the page context, the search term and the anonymous session id', async () => {
      localStorage.setItem('cc_session_id', SESSION_ID)
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('ok'), done()]))
      const { result } = renderChat({ contextKey: 'search:python', pageContextIds: ['r1', 'r2'] })
      await ready(result)

      await send(result, 'Which one?', CurrentPage.SEARCH_RESULT, 'python')

      expect(calls[0].headers.get('x-session-id')).toBe(SESSION_ID)
      expect(calls[0].headers.has('authorization')).toBe(false)
      expect(body(calls[0])).toMatchObject({
        message: 'Which one?',
        pageContextIds: ['r1', 'r2'],
        currentPage: 'SearchResult',
        searchTerm: 'python',
        history: [],
      })
    })

    it('sends the access token for signed-in users', async () => {
      mockSignedIn({ token: 'access-123' })
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('ok'), done()]))
      const { result } = renderChat()
      await ready(result)
      await send(result)
      expect(calls[0].headers.get('authorization')).toBe('Bearer access-123')
    })

    it('refreshes an access token about to expire before sending, so a signed-in user is not treated as a guest', async () => {
      const session = mockSignedIn({ token: 'about-to-expire', tokenExpires: Date.now() + 30_000 })
      nextAuth.update.mockResolvedValueOnce({ ...session, backendTokens: makeBackendTokens({ token: 'fresh' }) })
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('ok'), done()]))
      const { result } = renderChat()
      await ready(result)
      await send(result)
      expect(calls[0].headers.get('authorization')).toBe('Bearer fresh')
    })

    it('sends the earlier turns as history, oldest first, excluding the new question', async () => {
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('answer'), done()]))
      const { result } = renderChat()
      await ready(result)

      await send(result, 'first')
      await send(result, 'second')

      expect(body(calls[1]).history).toEqual([
        { role: 'user', content: 'first' },
        { role: 'bot', content: 'answer' },
      ])
      expect(body(calls[1]).message).toBe('second')
    })

    it('sends nothing until the identity is resolved, and gives the question back (session still loading)', async () => {
      mockSessionLoading()
      const { result } = renderChat()
      await ready(result)
      // no handler registered: a request would fail the test
      expect(await send(result)).toEqual({ status: 'not_sent', message: 'Which one?' })
      expect(result.current.messages).toEqual([])
    })
  })

  describe('failures before any answer: the question is given back, nothing is stored', () => {
    /** Sends one question that fails; checks what every such failure has in common and returns the hook. */
    async function failedSend(respond: Parameters<typeof mockApi>[2]) {
      const calls = mockApi('post', '/api/v1/chat', respond as never)
      const hook = renderChat()
      await ready(hook.result)
      const outcome = await send(hook.result, 'My long, carefully written question')
      expect(outcome).toEqual({ status: 'not_sent', message: 'My long, carefully written question' })
      expect(hook.result.current.messages).toEqual([]) // the question left the conversation (it's back in the input)
      expect(hook.result.current.isTyping).toBe(false)
      expect(storedChats()).toEqual([])
      return { ...hook, calls }
    }

    it('shows the error message the backend streams (no answer text: the question was not counted)', async () => {
      const { result } = await failedSend(() => sseResponse([errorEvent('Generation timed out.')]))
      expect(result.current.notice).toEqual({ kind: 'failed', message: 'Generation timed out.' })
    })

    it('says the connection failed when the request could not be made', async () => {
      const { result } = await failedSend(() => HttpResponse.error())
      expect(result.current.notice).toEqual({ kind: 'failed', message: NETWORK_FAILURE })
    })

    it('apologises for a server error', async () => {
      const { result } = await failedSend(() => Response.json({ error: 'Internal server error' }, { status: 500 }))
      expect(result.current.notice).toEqual({ kind: 'failed', message: GENERIC_FAILURE })
    })

    it('explains a message the backend found too long (400)', async () => {
      const { result } = await failedSend(() =>
        Response.json({ error: 'message must be at most 4000 characters', maxLength: 4000 }, { status: 400 }),
      )
      expect(result.current.notice).toEqual({ kind: 'failed', message: TOO_LONG })
    })

    it('explains a request that was too large (413)', async () => {
      const { result } = await failedSend(() => Response.json(makeBodyTooLarge(), { status: 413 }))
      expect(result.current.notice).toEqual({ kind: 'failed', message: TOO_LARGE })
    })

    it.each([
      ['chat_unavailable', makeChatUnavailable(), false],
      ['chat_signed_in_only', makeChatSignedInOnly(), true],
    ])('shows the backend message when chat is switched off (503 %s)', async (_code, body, signIn) => {
      const { result } = await failedSend(() => Response.json(body, { status: 503 }))
      expect(result.current.notice).toEqual({ kind: 'unavailable', message: body.message, signIn })
      expect(result.current.isLimitReached).toBe(false)
    })

    it('treats a per-minute rate limit as a short wait, not a lock', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
      const { result, calls } = await failedSend(() => limitResponse(makeRateLimited({ retryAfter: 3 })))
      expect(result.current.notice).toMatchObject({
        kind: 'rate_limited',
        message: 'Too many requests. Please wait a moment and try again.',
      })
      const wait = (result.current.notice as { retryAt: number }).retryAt - Date.now()
      expect(wait).toBeGreaterThan(2500) // retryAfter: 3 s
      expect(wait).toBeLessThanOrEqual(3000)
      expect(result.current.isLimitReached).toBe(false)

      expect(await send(result, 'too soon')).toEqual({ status: 'not_sent', message: 'too soon' }) // nothing sent during the wait
      expect(calls).toHaveLength(1)

      await act(async () => {
        vi.advanceTimersByTime(3000)
      })
      expect(result.current.notice).toBeNull() // the wait is over
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('ok'), done()]))
      expect(await send(result, 'now')).toEqual({ status: 'sent' })
    })

    it('locks the chat on a daily limit of this session, keeping the backend message, scope and reset time', async () => {
      const before = Date.now()
      const { result, calls } = await failedSend(() => limitResponse(makeDailyLimit('session', { retryAfter: 3600 })))
      expect(result.current.isLimitReached).toBe(true)
      expect(result.current.limit).toMatchObject({ message: DAILY_LIMIT_MESSAGES.session, scope: 'session' })
      expect(result.current.limit!.until).toBeGreaterThanOrEqual(before + 3600_000)
      expect(result.current.limit!.until).toBeLessThanOrEqual(Date.now() + 3600_000)
      expect(result.current.notice).toBeNull() // the banner says it all

      expect(await send(result, 'another')).toEqual({ status: 'not_sent', message: 'another' })
      expect(calls).toHaveLength(1)
    })

    it('says Cora did not answer when the answer ends without any text', async () => {
      // (was B3: "Cora is typing..." stayed on forever)
      const { result } = await failedSend(() => sseResponse([done()]))
      expect(result.current.notice).toEqual({ kind: 'failed', message: NO_ANSWER })
    })

    it('apologises when the stream ends before any text arrives', async () => {
      const { result } = await failedSend(() => sseResponse([]))
      expect(result.current.notice).toEqual({ kind: 'failed', message: GENERIC_FAILURE })
    })

    it('clears the notice when the next question goes out', async () => {
      const { result } = await failedSend(() => HttpResponse.error())
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('ok'), done()]))
      await send(result, 'again')
      expect(result.current.notice).toBeNull()
    })

    it('can dismiss the notice', async () => {
      const { result } = await failedSend(() => HttpResponse.error())
      act(() => result.current.dismissNotice())
      expect(result.current.notice).toBeNull()
    })

    it('keeps earlier turns of the conversation when a new question fails', async () => {
      let attempt = 0
      mockApi('post', '/api/v1/chat', () => (++attempt === 1 ? sseResponse([delta('answer'), done()]) : HttpResponse.error()))
      const { result } = renderChat()
      await ready(result)
      await send(result, 'first')
      expect(await send(result, 'second')).toEqual({ status: 'not_sent', message: 'second' })
      expect(result.current.messages.map(m => m.content)).toEqual(['first', 'answer'])
      expect(storedChats()[0].messages.map((m: { content: string }) => m.content)).toEqual(['first', 'answer'])
    })
  })

  describe('daily limits: remembered per identity until they reset', () => {
    const limitsStored = () => JSON.parse(localStorage.getItem('cora_limits') ?? '{}')

    async function hitLimit(scope: Parameters<typeof makeDailyLimit>[0], hook = renderChat(), overrides = {}) {
      const calls = mockApi('post', '/api/v1/chat', () => limitResponse(makeDailyLimit(scope, overrides)))
      await ready(hook.result)
      await send(hook.result, 'q')
      return { ...hook, calls }
    }

    it('keeps the lock after a reload, in other conversations and after "New chat"', async () => {
      const first = await hitLimit('session')
      expect(first.result.current.isLimitReached).toBe(true)
      act(() => first.result.current.resetChat())
      expect(first.result.current.isLimitReached).toBe(true) // "New chat" does not lift it
      first.rerender({ contextKey: 'subject:data-science', pageContextIds: [] })
      await waitFor(() => expect(first.result.current.limit?.message).toBe(DAILY_LIMIT_MESSAGES.session))
      first.unmount()

      const reloaded = renderChat({ contextKey: 'saved', pageContextIds: [] })
      await waitFor(() => expect(reloaded.result.current.isLimitReached).toBe(true))
      expect(reloaded.result.current.limit?.message).toBe(DAILY_LIMIT_MESSAGES.session)
      // No request: a question can't even be sent.
      expect(await send(reloaded.result, 'another')).toEqual({ status: 'not_sent', message: 'another' })
    })

    it('belongs to the identity: signing in lifts a guest limit, signing out brings it back', async () => {
      const hook = await hitLimit('session')
      expect(hook.result.current.isLimitReached).toBe(true)

      mockSignedIn({ user: { id: 'user-1' } })
      hook.rerender({ contextKey: 'search:python', pageContextIds: ['r1', 'r2'] })
      await waitFor(() => expect(hook.result.current.isLimitReached).toBe(false))

      mockSignedOut()
      hook.rerender({ contextKey: 'search:python', pageContextIds: ['r1', 'r2'] })
      await waitFor(() => expect(hook.result.current.isLimitReached).toBe(true))
    })

    it("keeps a user's limit for that user only, across sign-out and sign-in", async () => {
      mockSignedIn({ user: { id: 'user-1' } })
      const hook = await hitLimit('user')
      expect(hook.result.current.limit?.message).toBe(DAILY_LIMIT_MESSAGES.user)

      mockSignedOut()
      hook.rerender({ contextKey: 'search:python', pageContextIds: [] })
      await waitFor(() => expect(hook.result.current.isLimitReached).toBe(false)) // guests have their own limits

      mockSignedIn({ user: { id: 'user-2' } })
      hook.rerender({ contextKey: 'search:python', pageContextIds: [] })
      await waitFor(() => expect(hook.result.current.isLimitReached).toBe(false)) // another user

      mockSignedIn({ user: { id: 'user-1' } })
      hook.rerender({ contextKey: 'search:python', pageContextIds: [] })
      await waitFor(() => expect(hook.result.current.isLimitReached).toBe(true)) // the same user again
    })

    it('stores the limit under a hashed identity, not the raw ids', async () => {
      mockSignedIn({ user: { id: 'firebase-uid-123' } })
      await hitLimit('user')
      const raw = localStorage.getItem('cora_limits')!
      expect(raw).not.toContain('firebase-uid-123')
      expect(Object.keys(limitsStored())).toEqual([expect.stringMatching(/^user:[0-9a-z]+$/)])
    })

    it('ends by itself when the limit resets, without a reload', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
      const hook = await hitLimit('session', undefined, { retryAfter: 60 })
      expect(hook.result.current.isLimitReached).toBe(true)
      await act(async () => {
        vi.advanceTimersByTime(60_000)
      })
      expect(hook.result.current.isLimitReached).toBe(false)
      expect(localStorage.getItem('cora_limits')).toBeNull() // pruned
    })

    it('lasts until midnight UTC when the backend gives no wait time', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-03-01T21:30:00Z'))
      mockApi('post', '/api/v1/chat', () => Response.json(makeDailyLimit('session', { retryAfter: undefined }), { status: 429 }))
      const { result } = renderChat()
      await ready(result)
      await send(result)
      expect(new Date(result.current.limit!.until).toISOString()).toBe('2026-03-02T00:00:00.000Z')
    })

    it('follows a limit reached in another tab', async () => {
      const first = await hitLimit('session')
      const stored = localStorage.getItem('cora_limits')!
      first.unmount()
      localStorage.removeItem('cora_limits')

      const other = renderChat({ contextKey: 'saved', pageContextIds: [] })
      await ready(other.result)
      expect(other.result.current.isLimitReached).toBe(false)
      // The other tab writes the limit; this tab is told through a storage event.
      localStorage.setItem('cora_limits', stored)
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: 'cora_limits' }))
      })
      expect(other.result.current.isLimitReached).toBe(true)
    })

    it.each(['ip', 'global', 'signed_in_global'] as const)(
      'does not lock for the %s limit: shows it, gives the question back, stores nothing, allows trying again',
      async scope => {
        const hook = await hitLimit(scope)
        expect(hook.result.current.isLimitReached).toBe(false)
        expect(hook.result.current.notice).toEqual({
          kind: 'daily_limit',
          message: DAILY_LIMIT_MESSAGES[scope],
          scope,
          signIn: scope !== 'signed_in_global', // guests can sign in to get their own limit
        })
        expect(localStorage.getItem('cora_limits')).toBeNull()

        mockApi('post', '/api/v1/chat', () => sseResponse([delta('ok'), done()]))
        expect(await send(hook.result, 'again')).toEqual({ status: 'sent' })
      },
    )
  })

  describe('failures after part of the answer: the part is kept, the reason shown', () => {
    it('finishes the answer when the stream ends without a done event', async () => {
      // e.g. the connection drops mid-answer (was B3)
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('partial answer')]))
      const { result } = renderChat()
      await ready(result)
      expect(await send(result)).toEqual({ status: 'sent' })
      expect(result.current.messages.at(-1)).toMatchObject({ content: 'partial answer', isStreaming: false })
      expect(storedChats()[0]?.messages).toHaveLength(2)
      expect(result.current.notice).toEqual({ kind: 'failed', message: CUT_OFF })
      expect(result.current.isTyping).toBe(false)
    })

    it('an error after part of the answer does not duplicate the message or leave it streaming', async () => {
      // (was B4)
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('partial'), errorEvent('Generation timed out.')]))
      const { result } = renderChat()
      await ready(result)
      await send(result)
      const ids = result.current.messages.map(m => m.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(result.current.messages.filter(m => m.isStreaming)).toEqual([])
      expect(result.current.messages.map(m => m.content)).toEqual(['Which one?', 'partial'])
      expect(result.current.notice).toEqual({ kind: 'failed', message: 'Generation timed out.' })
      expect(storedChats()[0].messages).toHaveLength(2)
    })

    it('keeps the part when the connection fails mid-answer', async () => {
      const stream = controlledSse()
      mockApi('post', '/api/v1/chat', () => stream.response())
      const { result } = renderChat()
      await ready(result)
      let sending!: Promise<unknown>
      act(() => {
        sending = result.current.handleSendMessage('q', CurrentPage.SEARCH_RESULT)
      })
      stream.send(delta('half an answer'))
      await waitFor(() => expect(result.current.messages.at(-1)?.content).toBe('half an answer'))
      stream.fail()
      await act(() => sending)
      expect(result.current.messages.at(-1)).toMatchObject({ content: 'half an answer', isStreaming: false })
      expect(result.current.notice).toEqual({ kind: 'failed', message: CUT_OFF })
    })
  })

  it('gives every message a unique id, even when sent in the same millisecond', async () => {
    // (was B23)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'))
    mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
    const { result } = renderChat()
    await ready(result)
    await send(result, 'one')
    await send(result, 'two')
    const ids = result.current.messages.map(m => m.id)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(ids.length)
  })

  describe('persistence', () => {
    it('saves the conversation to localStorage and restores it on the next visit', async () => {
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('answer'), done()]))
      const first = renderChat()
      await ready(first.result)
      await send(first.result, 'question')
      first.unmount()

      expect(storedChats()).toHaveLength(1)
      const second = renderChat()
      await waitFor(() => expect(second.result.current.messages.map(m => m.content)).toEqual(['question', 'answer']))
      expect(second.result.current.messages.every(m => m.timestamp instanceof Date && !m.isStreaming)).toBe(true)
    })

    it('never restores a message in the streaming state', async () => {
      // A conversation can be stored mid-answer (e.g. an error event after partial text, see B4).
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const first = renderChat()
      await ready(first.result)
      await send(first.result)
      first.unmount()
      const [chat] = storedChats()
      const messages = chat.messages.map((m: object) => ({ ...m, isStreaming: true }))
      localStorage.setItem(chat.key, JSON.stringify({ ...chat, key: undefined, messages }))

      const second = renderChat()
      await waitFor(() => expect(second.result.current.messages).toHaveLength(2))
      expect(second.result.current.messages.map(m => m.isStreaming)).toEqual([false, false])
    })

    it('keeps the original creation time as the conversation grows', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'))
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const { result } = renderChat()
      await ready(result)
      await send(result, 'one')
      const createdAt = storedChats()[0].createdAt

      vi.setSystemTime(new Date('2026-03-01T13:00:00.000Z'))
      await send(result, 'two')
      expect(storedChats()[0].createdAt).toBe(createdAt)
      expect(storedChats()[0].lastUpdatedAt).toBe(new Date('2026-03-01T13:00:00.000Z').getTime())
    })

    it('forgets conversations older than three days', async () => {
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const first = renderChat()
      await ready(first.result)
      await send(first.result)
      first.unmount()
      const [chat] = storedChats()
      localStorage.setItem(chat.key, JSON.stringify({ ...chat, key: undefined, createdAt: Date.now() - 3 * DAY - 1000 }))

      const second = renderChat()
      await ready(second.result)
      expect(second.result.current.messages).toEqual([])
      expect(localStorage.getItem(chat.key)).toBeNull()
    })

    it('starts fresh when the stored conversation is corrupted', async () => {
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const first = renderChat()
      await ready(first.result)
      await send(first.result)
      first.unmount()
      localStorage.setItem(storedChats()[0].key, '{not json')

      const second = renderChat()
      await ready(second.result)
      expect(second.result.current.messages).toEqual([])
    })

    it('keeps a separate conversation per page context', async () => {
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('about python'), done()]))
      const { result, rerender } = renderChat({ contextKey: 'search:python' })
      await ready(result)
      await send(result, 'python?')

      rerender({ contextKey: 'search:sql' })
      await waitFor(() => expect(result.current.messages).toEqual([]))

      rerender({ contextKey: 'search:python' })
      await waitFor(() => expect(result.current.messages.map(m => m.content)).toEqual(['python?', 'about python']))
    })

    it('keeps signed-in conversations separate from anonymous ones and per user', async () => {
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const anon = renderChat()
      await ready(anon.result)
      await send(anon.result, 'anonymous question')
      anon.unmount()

      mockSignedIn({ user: { id: 'user-1' } })
      const signedIn = renderChat()
      await ready(signedIn.result)
      expect(signedIn.result.current.messages).toEqual([])
      await send(signedIn.result, 'user-1 question')
      signedIn.unmount()

      mockSignedIn({ user: { id: 'user-2' } })
      const other = renderChat()
      await ready(other.result)
      expect(other.result.current.messages).toEqual([])
      expect(storedChats()).toHaveLength(2)
    })

    // Backend tokens are never briefly missing: the refresh happens inside the session read. A session without them
    // has ended (refresh token rejected, B1), and SessionGuard signs it out. (An earlier version waited here.)
    it('treats a session whose backend tokens are gone as signed out: the guest conversation is shown', async () => {
      const session = mockSignedIn({ user: { id: 'user-1' } })
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const { result, rerender } = renderChat()
      await ready(result)
      await send(result, 'question')
      expect(result.current.messages.map(m => m.content)).toEqual(['question', 'a'])

      setSession({ ...session, backendTokens: undefined }, 'authenticated')
      rerender({ contextKey: 'search:python', pageContextIds: ['r1', 'r2'] })
      await waitFor(() => expect(result.current.messages).toEqual([])) // the guest's conversation for this page
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('b'), done()]))
      await send(result, 'as a guest')
      expect(calls[0].headers.has('authorization')).toBe(false)
    })

    it('resetChat clears the conversation and its stored copy, but not the daily limit (it belongs to the identity)', async () => {
      let attempt = 0
      mockApi('post', '/api/v1/chat', () =>
        ++attempt === 1 ? sseResponse([delta('answer'), done()]) : limitResponse(makeDailyLimit('session')),
      )
      const { result } = renderChat()
      await ready(result)
      await send(result, 'first') // answered: stored
      await send(result, 'second') // daily limit
      expect(storedChats()).toHaveLength(1)
      expect(result.current.isLimitReached).toBe(true)

      act(() => result.current.resetChat())
      expect(result.current.messages).toEqual([])
      expect(result.current.isLimitReached).toBe(true)
      expect(storedChats()).toEqual([])
    })
  })

  // Contract: docs/backend-api.md → "POST /api/v1/chat", Body (`history` / `pageContextIds` limits) and closing the connection.
  describe('request limits and cancellation', () => {
    it('sends at most the last 20 turns of history, starting with a user turn', async () => {
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const { result } = renderChat()
      await ready(result)
      for (let i = 0; i < 11; i++) await send(result, `q${i}`) // 22 turns
      await send(result, 'last')
      const history = body(calls.at(-1)!).history
      expect(history.length).toBeLessThanOrEqual(20)
      expect(history[0].role).toBe('user')
    })

    it('sends at most 50 page context ids', async () => {
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const ids = Array.from({ length: 60 }, (_, i) => `r${i}`)
      const { result } = renderChat({ contextKey: 'saved', pageContextIds: ids })
      await ready(result)
      await send(result)
      expect(body(calls[0]).pageContextIds.length).toBeLessThanOrEqual(50)
    })

    it('stops the answer (aborts the request) when the chat is closed', async () => {
      let aborted = false
      mockApi('post', '/api/v1/chat', request => {
        request.signal.addEventListener('abort', () => {
          aborted = true
        })
        return controlledSse().response() // never finishes
      })
      const { result, unmount } = renderChat()
      await ready(result)
      act(() => {
        void result.current.handleSendMessage('q', CurrentPage.SEARCH_RESULT)
      })
      await waitFor(() => expect(result.current.isTyping).toBe(true))
      unmount()
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(aborted).toBe(true)
    })

    /** A chat waiting for an answer that never comes; resolves once the request is in flight. */
    async function waitingForAnswer(initial?: Props) {
      const state = { aborted: false }
      const calls = mockApi('post', '/api/v1/chat', request => {
        request.signal.addEventListener('abort', () => {
          state.aborted = true
        })
        return controlledSse().response()
      })
      const hook = renderChat(initial)
      await ready(hook.result)
      let sending!: Promise<unknown>
      act(() => {
        sending = hook.result.current.handleSendMessage('q', CurrentPage.SEARCH_RESULT)
      })
      await waitFor(() => expect(hook.result.current.isTyping).toBe(true))
      return { ...hook, state, calls, sending }
    }

    it('stops the answer on "New chat", without reporting an error', async () => {
      const { result, state, sending } = await waitingForAnswer()
      act(() => result.current.resetChat())
      await act(() => sending)
      expect(state.aborted).toBe(true)
      expect(result.current.isTyping).toBe(false)
      expect(result.current.messages).toEqual([])
      expect(result.current.notice).toBeNull() // a deliberate stop is not a failure
      expect(storedChats()).toEqual([])
    })

    it('stops the answer when switching to another conversation, which stays clean', async () => {
      const { result, rerender, state, sending } = await waitingForAnswer({ contextKey: 'search:python', pageContextIds: ['r1'] })
      rerender({ contextKey: 'search:sql', pageContextIds: ['r2'] })
      await act(() => sending)
      expect(state.aborted).toBe(true)
      expect(result.current.isTyping).toBe(false)
      expect(result.current.messages).toEqual([])
      expect(result.current.notice).toBeNull()
      // Back in the python conversation: the stopped exchange was never saved (a conversation is stored when an
      // answer ends), and no error message was added for it.
      rerender({ contextKey: 'search:python', pageContextIds: ['r1'] })
      await waitFor(() => expect(result.current.messages.map(m => m.content)).toEqual([]))
    })

    it('does not send a message over the limit, and gives it back (the input blocks it anyway)', async () => {
      const { result } = renderChat()
      await ready(result)
      const long = 'x'.repeat(MAX_MESSAGE_LENGTH + 1)
      // no handler registered: a request would fail the test
      expect(await send(result, long)).toEqual({ status: 'not_sent', message: long })
      expect(result.current.messages).toEqual([])
    })

    it('ignores an empty message', async () => {
      const { result } = renderChat()
      await ready(result)
      expect(await send(result, '   ')).toEqual({ status: 'ignored' })
    })

    it('sends a message of exactly the limit (surrounding whitespace does not count)', async () => {
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('ok'), done()]))
      const { result } = renderChat()
      await ready(result)
      await send(result, `  ${'x'.repeat(MAX_MESSAGE_LENGTH)}  `)
      expect(calls).toHaveLength(1)
    })

    it('does not send the conversation key (chatId): it is local, not part of the contract', async () => {
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('ok'), done()]))
      const { result } = renderChat()
      await ready(result)
      await send(result)
      expect(body(calls[0])).not.toHaveProperty('chatId')
    })
  })

  describe('history hygiene', () => {
    it('sends only real turns: a question that failed before any answer is not part of the history', async () => {
      let attempt = 0
      const calls = mockApi('post', '/api/v1/chat', () =>
        ++attempt === 1 ? Response.json({ error: 'x' }, { status: 500 }) : sseResponse([delta('ok'), done()]),
      )
      const { result } = renderChat()
      await ready(result)
      await send(result, 'first')
      await send(result, 'second')
      expect(body(calls[1]).history).toEqual([])
    })

    it('never sends a failure text as one of Cora\'s turns (after a partial answer, across a reload)', async () => {
      let attempt = 0
      const calls = mockApi('post', '/api/v1/chat', () =>
        ++attempt === 1 ? sseResponse([delta('partial'), errorEvent('Generation timed out.')]) : sseResponse([delta('ok'), done()]),
      )
      const first = renderChat()
      await ready(first.result)
      await send(first.result, 'first')
      first.unmount()

      const second = renderChat()
      await waitFor(() => expect(second.result.current.messages).toHaveLength(2))
      await send(second.result, 'second')
      expect(body(calls[1]).history).toEqual([
        { role: 'user', content: 'first' },
        { role: 'bot', content: 'partial' },
      ])
    })
  })
})
