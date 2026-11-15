import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CurrentPage } from '@/api/chat'
import { mockSessionLoading, mockSignedIn, setSession } from '@/test/mocks/next-auth'
import { HttpResponse, http, mockApi, type RecordedRequest, server } from '@/test/msw'
import { renderHookWithProviders } from '@/test/render'
import { controlledSse, delta, done, errorEvent, sseResponse } from '@/test/sse'
import { useChatState } from './use-chat-state'

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

function send(result: { current: ReturnType<typeof useChatState> }, message = 'Which one?', page = CurrentPage.SEARCH_RESULT, term?: string) {
  return act(() => result.current.handleSendMessage(message, page, term))
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

      let sending!: Promise<void>
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

    it('ignores sends until the identity is resolved (no request while the session loads)', async () => {
      mockSessionLoading()
      const { result } = renderChat()
      await ready(result)
      await send(result) // no handler registered: a request would fail the test
      expect(result.current.messages).toEqual([])
    })
  })

  describe('failures', () => {
    it('shows the error message the backend streams', async () => {
      mockApi('post', '/api/v1/chat', () => sseResponse([errorEvent('Generation timed out.')]))
      const { result } = renderChat()
      await ready(result)
      await send(result)
      expect(result.current.isTyping).toBe(false)
      expect(result.current.messages.at(-1)).toMatchObject({ sender: 'bot', content: 'Generation timed out.' })
    })

    it('shows a generic apology when the request fails', async () => {
      server.use(http.post('http://api.test/api/v1/chat', () => HttpResponse.error()))
      const { result } = renderChat()
      await ready(result)
      await send(result)
      expect(result.current.isTyping).toBe(false)
      expect(result.current.messages.at(-1)).toMatchObject({
        sender: 'bot',
        content: 'Sorry, something went wrong. Please try again.',
      })
    })

    it('locks the chat when the daily limit is reached, showing the backend message', async () => {
      const message = "You've used all 5 of your daily questions. Sign in to get 10 questions per day."
      const calls = mockApi('post', '/api/v1/chat', { limitReached: true, message }, { status: 429 })
      const { result } = renderChat()
      await ready(result)

      await send(result)
      expect(result.current.isLimitReached).toBe(true)
      expect(result.current.messages.at(-1)).toMatchObject({ sender: 'bot', content: message })

      await send(result, 'another')
      expect(calls).toHaveLength(1)
    })

    it.fails('KNOWN BUG (B3): finishes the answer when the stream ends without a done event', async () => {
      // e.g. the connection drops mid-answer
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('partial answer')]))
      const { result } = renderChat()
      await ready(result)
      await send(result)
      expect(result.current.messages.at(-1)).toMatchObject({ content: 'partial answer', isStreaming: false })
      expect(storedChats()[0]?.messages).toHaveLength(2)
    })

    it.fails('KNOWN BUG (B3): clears the typing indicator when the answer ends without any text', async () => {
      mockApi('post', '/api/v1/chat', () => sseResponse([done()]))
      const { result } = renderChat()
      await ready(result)
      await send(result)
      expect(result.current.isTyping).toBe(false)
    })

    it.fails('KNOWN BUG (B4): an error after part of the answer does not duplicate the message or leave it streaming', async () => {
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('partial'), errorEvent('Generation timed out.')]))
      const { result } = renderChat()
      await ready(result)
      await send(result)
      const ids = result.current.messages.map(m => m.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(result.current.messages.filter(m => m.isStreaming)).toEqual([])
    })

    it.fails('KNOWN BUG (B23): gives every message a unique id, even when sent in the same millisecond', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'))
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const { result } = renderChat()
      await ready(result)
      await send(result, 'one')
      await send(result, 'two')
      const ids = result.current.messages.map(m => m.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
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

    it('does not reset the conversation while the backend tokens are briefly missing (token refresh)', async () => {
      const session = mockSignedIn({ user: { id: 'user-1' } })
      mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const { result, rerender } = renderChat()
      await ready(result)
      await send(result, 'question')

      setSession({ ...session, backendTokens: undefined }, 'authenticated')
      rerender({ contextKey: 'search:python', pageContextIds: ['r1', 'r2'] })
      await act(async () => {})
      expect(result.current.messages.map(m => m.content)).toEqual(['question', 'a'])
    })

    it('resetChat clears the conversation, the stored copy and the limit lock', async () => {
      mockApi('post', '/api/v1/chat', { limitReached: true, message: 'limit' }, { status: 429 })
      const { result } = renderChat()
      await ready(result)
      await send(result)
      expect(result.current.isLimitReached).toBe(true)

      act(() => result.current.resetChat())
      expect(result.current.messages).toEqual([])
      expect(result.current.isLimitReached).toBe(false)
      expect(storedChats()).toEqual([])
    })
  })

  // Contract: docs/backend-api.md → "POST /api/v1/chat", Body (`history` / `pageContextIds` limits) and closing the connection.
  describe('request size recommendations (C3)', () => {
    it.fails('KNOWN BUG (C3): sends at most the last 20 turns of history, starting with a user turn', async () => {
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const { result } = renderChat()
      await ready(result)
      for (let i = 0; i < 11; i++) await send(result, `q${i}`) // 22 turns
      await send(result, 'last')
      const history = body(calls.at(-1)!).history
      expect(history.length).toBeLessThanOrEqual(20)
      expect(history[0].role).toBe('user')
    })

    it.fails('KNOWN BUG (C3): sends at most 50 page context ids', async () => {
      const calls = mockApi('post', '/api/v1/chat', () => sseResponse([delta('a'), done()]))
      const ids = Array.from({ length: 60 }, (_, i) => `r${i}`)
      const { result } = renderChat({ contextKey: 'saved', pageContextIds: ids })
      await ready(result)
      await send(result)
      expect(body(calls[0]).pageContextIds.length).toBeLessThanOrEqual(50)
    })

    it.fails('KNOWN BUG (C3): stops the answer (aborts the request) when the chat is closed', async () => {
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
  })
})
