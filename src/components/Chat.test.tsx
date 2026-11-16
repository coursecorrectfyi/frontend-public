import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CurrentPage } from '@/api/chat'
import { useChatState } from '@/hooks/use-chat-state'
import { allowConsole } from '@/test/console'
import { firebase } from '@/test/mocks/firebase'
import {
  DAILY_LIMIT_MESSAGES,
  limitResponse,
  makeBackendTokens,
  makeChatSignedInOnly,
  makeDailyLimit,
  makeRateLimited,
} from '@/test/fixtures'
import { mockSessionLoading, mockSignedIn, nextAuth } from '@/test/mocks/next-auth'
import { router } from '@/test/mocks/next-navigation'
import { createGate, HttpResponse, mockApi } from '@/test/msw'
import { iconButton } from '@/test/pages'
import { renderWithProviders } from '@/test/render'
import { NETWORK_FAILURE, type SendOutcome } from '@/hooks/use-chat-state'
import { delta, done, sseResponse } from '@/test/sse'
import Chat, { DEFAULT_LIMIT_TEXT, LENGTH_COUNTER_FROM, lengthHint } from './Chat'

// Component-level tests for the Cora chat panel. (Each page's test covers it wired to that page.)

type Message = Parameters<typeof Chat>[0]['messages'][number]

const msg = (sender: 'user' | 'bot', content: string, extra: Partial<Message> = {}): Message => ({
  id: `${sender}-${content}`,
  sender,
  content,
  timestamp: new Date('2026-03-01T12:00:00Z'),
  ...extra,
})

function renderChat(props: Partial<Parameters<typeof Chat>[0]> = {}) {
  allowConsole('warn', 'disabled `button` child to the Tooltip') // B26
  const onSendMessage = vi.fn()
  const resetChat = vi.fn()
  const utils = renderWithProviders(
    <Chat
      messages={[]}
      onSendMessage={onSendMessage}
      isTyping={false}
      resetChat={resetChat}
      currentPage={CurrentPage.SEARCH_RESULT}
      searchTerm="python"
      {...props}
    />,
  )
  return { ...utils, onSendMessage, resetChat, input: () => screen.getByRole('textbox') }
}

describe('Chat', () => {
  describe('messages', () => {
    it('renders finished answers as Markdown', () => {
      renderChat({ messages: [msg('user', 'Which?'), msg('bot', 'Take **Python**.')] })
      expect(screen.getByText('Which?')).toBeInTheDocument()
      expect(screen.getByText('Python', { selector: 'strong' })).toBeInTheDocument()
    })

    it('renders an answer that is still streaming as plain text (half-written Markdown would flicker)', () => {
      // Complete Markdown mid-stream: shown as typed until the answer is done.
      renderChat({ messages: [msg('user', 'Which?'), msg('bot', 'Take **Python** and', { isStreaming: true })] })
      expect(screen.getByText(/Take \*\*Python\*\* and/)).toBeInTheDocument()
      expect(screen.queryByText('Python', { selector: 'strong' })).toBeNull()
    })

    it('shows the greeting and quick prompts only before the conversation starts', () => {
      const greeting = msg('bot', 'Hi, I am Cora.')
      const { rerender } = renderChat({ defaultMessage: greeting, defaultPrompts: ['Help me choose'] })
      expect(screen.getByText('Hi, I am Cora.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Help me choose' })).toBeInTheDocument()

      rerender(
        <Chat messages={[msg('user', 'q')]} defaultMessage={greeting} defaultPrompts={['Help me choose']}
          onSendMessage={vi.fn()} isTyping={false} resetChat={vi.fn()} currentPage={CurrentPage.SEARCH_RESULT} />,
      )
      expect(screen.queryByText('Hi, I am Cora.')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Help me choose' })).toBeNull()
    })

    it('shows that Cora is typing', () => {
      renderChat({ messages: [msg('user', 'q')], isTyping: true })
      expect(screen.getByText('Cora is typing...')).toBeInTheDocument()
    })
  })

  describe('sending', () => {
    it('sends the trimmed message with the page and search term, then clears the input', async () => {
      const { user, onSendMessage, input } = renderChat()
      await user.type(input(), '  Which one?  ')
      await user.click(iconButton('Send'))
      expect(onSendMessage).toHaveBeenCalledWith('Which one?', CurrentPage.SEARCH_RESULT, 'python')
      expect(input()).toHaveValue('')
    })

    it('sends with Enter and adds a new line with Shift+Enter', async () => {
      const { user, onSendMessage, input } = renderChat()
      await user.type(input(), 'line one{Shift>}{Enter}{/Shift}line two')
      expect(onSendMessage).not.toHaveBeenCalled()
      expect(input()).toHaveValue('line one\nline two')

      await user.keyboard('{Enter}')
      expect(onSendMessage).toHaveBeenCalledWith('line one\nline two', CurrentPage.SEARCH_RESULT, 'python')
    })

    it('cannot send an empty or whitespace-only message', async () => {
      const { user, onSendMessage, input } = renderChat()
      expect(iconButton('Send')).toBeDisabled()
      await user.type(input(), '   {Enter}')
      expect(iconButton('Send')).toBeDisabled()
      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('sends a quick prompt as the question', async () => {
      const { user, onSendMessage } = renderChat({ defaultPrompts: ['Help me choose'], currentPage: CurrentPage.SUBJECT_PAGE, searchTerm: 'Data' })
      await user.click(screen.getByRole('button', { name: 'Help me choose' }))
      expect(onSendMessage).toHaveBeenCalledWith('Help me choose', CurrentPage.SUBJECT_PAGE, 'Data')
    })

    it('links to the learning path and tracks the click', async () => {
      const { user } = renderChat({ defaultPrompts: ['Help me choose'] })
      await user.click(screen.getByRole('button', { name: 'Help me plan my learning' }))
      expect(router.push).toHaveBeenCalledWith('/get-learning-path')
      expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'learning_path_cta_click', source: 'chat' })])
    })

    it.fails('KNOWN BUG (B5): does not send another question while Cora is still answering', async () => {
      const { user, onSendMessage, input } = renderChat({ messages: [msg('user', 'first')], isTyping: true })
      await user.type(input(), 'second{Enter}')
      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it.fails('KNOWN BUG (B5): does not send another question while the answer is streaming', async () => {
      const { user, onSendMessage, input } = renderChat({
        messages: [msg('user', 'first'), msg('bot', 'partial', { isStreaming: true })],
      })
      await user.type(input(), 'second{Enter}')
      expect(onSendMessage).not.toHaveBeenCalled()
    })

    // Contract: docs/backend-api.md → "POST /api/v1/chat", Body (`message` limit).
    // Contract: `message` up to 4,000 characters after trimming; longer is refused with 400.
    describe('the 4,000-character limit', () => {
      it('shows how close a long message is to the limit', async () => {
        const { user, input } = renderChat()
        await user.click(input())
        await user.paste('x'.repeat(LENGTH_COUNTER_FROM - 1))
        expect(screen.queryByText(/\/ 4,000/)).toBeNull() // not for ordinary messages

        await user.type(input(), 'x')
        expect(screen.getByText(`${LENGTH_COUNTER_FROM.toLocaleString('en-US')} / 4,000`)).toBeInTheDocument()
        expect(input()).toHaveAccessibleDescription(`${LENGTH_COUNTER_FROM.toLocaleString('en-US')} / 4,000`)
      })

      it('never cuts a long paste: it stays whole, says how much to remove, and cannot be sent', async () => {
        const { user, onSendMessage, input } = renderChat()
        const long = `${'x'.repeat(3990)} the end of the question`
        await user.click(input())
        await user.paste(long)

        expect(input()).toHaveValue(long) // nothing lost
        expect(input()).toHaveAttribute('aria-invalid', 'true')
        const hint = `${long.length.toLocaleString('en-US')} / 4,000: too long to send. Remove ${long.length - 4000} characters.`
        expect(screen.getByText(hint)).toBeInTheDocument()
        expect(input()).toHaveAccessibleDescription(hint)
        expect(iconButton('Send')).toBeDisabled()
        await user.keyboard('{Enter}')
        expect(onSendMessage).not.toHaveBeenCalled()
      })

      it('can be sent again once shortened to the limit', async () => {
        const { user, onSendMessage, input } = renderChat()
        await user.click(input())
        await user.paste('x'.repeat(4001))
        expect(iconButton('Send')).toBeDisabled()
        await user.keyboard('{Backspace}')
        expect(screen.getByText('4,000 / 4,000')).toBeInTheDocument()
        expect(input()).toHaveAttribute('aria-invalid', 'false')
        await user.click(iconButton('Send'))
        expect(onSendMessage).toHaveBeenCalledWith('x'.repeat(4000), CurrentPage.SEARCH_RESULT, 'python')
      })

      it('does not count surrounding whitespace, like the backend', async () => {
        const { user, onSendMessage, input } = renderChat()
        await user.click(input())
        await user.paste(`   ${'x'.repeat(4000)}   `)
        expect(screen.getByText('4,000 / 4,000')).toBeInTheDocument()
        expect(iconButton('Send')).toBeEnabled()
        await user.keyboard('{Enter}')
        expect(onSendMessage).toHaveBeenCalledWith('x'.repeat(4000), CurrentPage.SEARCH_RESULT, 'python')
      })

      it.each([
        [LENGTH_COUNTER_FROM - 1, undefined],
        [LENGTH_COUNTER_FROM, '3,600 / 4,000'],
        [4000, '4,000 / 4,000'],
        [4001, '4,001 / 4,000: too long to send. Remove 1 character.'],
        [12_345, '12,345 / 4,000: too long to send. Remove 8,345 characters.'],
      ])('lengthHint(%i) → %j', (length, expected) => {
        expect(lengthHint(length)).toBe(expected)
      })
    })
  })

  describe('daily limit', () => {
    const limitOf = (scope: keyof typeof DAILY_LIMIT_MESSAGES) => ({ message: DAILY_LIMIT_MESSAGES[scope], scope, until: Date.now() + 3_600_000 })

    it("locks sending, shows the backend's message and offers Google sign-in to anonymous visitors", async () => {
      const { user, onSendMessage, input } = renderChat({ isLimitReached: true, limit: limitOf('session') })
      expect(input()).toHaveAttribute('readonly') // read-only, not disabled: text in it can still be copied
      expect(input()).toBeEnabled()
      expect(iconButton('Send')).toBeDisabled()
      expect(screen.getByText(DAILY_LIMIT_MESSAGES.session)).toBeInTheDocument()

      mockApi('post', '/api/v1/auth/firebase/login', makeBackendTokens())
      await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))
      await waitFor(() => expect(nextAuth.signIn).toHaveBeenCalledWith('firebase-backend', expect.anything()))
      expect(firebase.signInWithGoogle).toHaveBeenCalled()
      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it("does not offer sign-in for a signed-in user's own limit (signing in would not help)", () => {
      renderChat({ isLimitReached: true, limit: limitOf('user') })
      expect(screen.getByText(DAILY_LIMIT_MESSAGES.user)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull()
    })

    it('says so in the input instead of inviting a question', () => {
      const { input } = renderChat({ isLimitReached: true, limit: limitOf('session') })
      expect(input()).toHaveAttribute('placeholder', 'Daily question limit reached')
      expect(input()).not.toHaveAttribute('placeholder', expect.stringMatching(/reset/i))
    })

    it('does not offer sign-in to signed-in users', () => {
      mockSignedIn()
      renderChat({ isLimitReached: true, limit: limitOf('session') })
      expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull()
    })

    it('falls back to a neutral text without the backend message', () => {
      renderChat({ isLimitReached: true })
      expect(screen.getByText(DEFAULT_LIMIT_TEXT)).toBeInTheDocument()
      expect(screen.queryByText(/free questions/)).toBeNull()
    })

    it('ignores quick prompts while locked', async () => {
      const { user, onSendMessage } = renderChat({ isLimitReached: true, defaultPrompts: ['Help me choose'] })
      await user.click(screen.getByRole('button', { name: 'Help me choose' }))
      expect(onSendMessage).not.toHaveBeenCalled()
    })
  })

  describe('notices (why the last question was not sent)', () => {
    it('shows the notice as an alert that can be dismissed', async () => {
      const onDismissNotice = vi.fn()
      const { user } = renderChat({ notice: { kind: 'failed', message: NETWORK_FAILURE }, onDismissNotice })
      expect(screen.getByRole('alert')).toHaveTextContent(NETWORK_FAILURE)
      await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Close' }))
      expect(onDismissNotice).toHaveBeenCalled()
    })

    it('counts down a rate limit and blocks sending until it is over', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        const notice = { kind: 'rate_limited' as const, message: makeRateLimited().message!, retryAt: Date.now() + 3000 }
        const { user, onSendMessage, input } = renderChat({ notice, defaultPrompts: ['Help me choose'] })
        expect(screen.getByRole('alert')).toHaveTextContent(`${notice.message} You can ask again in 3 seconds.`)

        await user.type(input(), 'next question')
        expect(iconButton('Send')).toBeDisabled()
        await user.keyboard('{Enter}')
        await user.click(screen.getByRole('button', { name: 'Help me choose' }))
        expect(onSendMessage).not.toHaveBeenCalled()

        await act(async () => {
          vi.advanceTimersByTime(2000)
        })
        expect(screen.getByRole('alert')).toHaveTextContent('You can ask again in 1 second.')
      } finally {
        vi.useRealTimers()
      }
    })

    it('offers sign-in when chat is only switched off for guests', async () => {
      const body = makeChatSignedInOnly()
      const { user } = renderChat({ notice: { kind: 'unavailable', message: body.message!, signIn: true } })
      expect(screen.getByRole('alert')).toHaveTextContent(body.message!)
      mockApi('post', '/api/v1/auth/firebase/login', makeBackendTokens())
      await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Sign in with Google' }))
      await waitFor(() => expect(nextAuth.signIn).toHaveBeenCalled())
    })

    it('shows a daily limit that does not lock, with sign-in for guests and "Try again"', async () => {
      const { user, onSendMessage, input } = renderChat({
        notice: { kind: 'daily_limit', message: DAILY_LIMIT_MESSAGES.ip, scope: 'ip', signIn: true },
      })
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(DAILY_LIMIT_MESSAGES.ip)
      expect(within(alert).getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
      expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull() // nothing to send yet
      expect(input()).not.toHaveAttribute('readonly')

      await user.type(input(), 'my question')
      await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }))
      expect(onSendMessage).toHaveBeenCalledWith('my question', CurrentPage.SEARCH_RESULT, 'python')
    })

    it.each([
      ['a limit signing in does not lift', { signIn: false }, false],
      ['a signed-in user', { signIn: true }, true],
    ])('does not offer sign-in in a daily-limit notice for %s', (_label, extra, signedIn) => {
      if (signedIn) mockSignedIn()
      renderChat({ notice: { kind: 'daily_limit', message: 'limit', scope: 'signed_in_global', ...extra } })
      expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull()
    })

    it('does not offer sign-in when chat is switched off for everyone', () => {
      renderChat({ notice: { kind: 'unavailable', message: 'Cora is taking a break. Please try again later.', signIn: false } })
      expect(screen.getByRole('alert')).toHaveTextContent('Cora is taking a break.')
      expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull()
    })
  })

  describe('giving an unsent question back', () => {
    const notSent = (message: string): SendOutcome => ({ status: 'not_sent', message })

    it('puts a question that was not sent back into the input', async () => {
      const { user, onSendMessage, input } = renderChat()
      onSendMessage.mockResolvedValue(notSent('My long question'))
      await user.type(input(), 'My long question{Enter}')
      await waitFor(() => expect(input()).toHaveValue('My long question'))
    })

    it('keeps what was typed meanwhile, after the question', async () => {
      const gate = createGate()
      const { user, onSendMessage, input } = renderChat()
      onSendMessage.mockImplementation(async () => {
        await gate.wait()
        return notSent('first question')
      })
      await user.type(input(), 'first question{Enter}')
      await user.type(input(), 'second thought')
      await act(async () => gate.open())
      await waitFor(() => expect(input()).toHaveValue('first question\n\nsecond thought'))
    })

    it('leaves the input empty when the question was sent', async () => {
      const { user, onSendMessage, input } = renderChat()
      onSendMessage.mockResolvedValue({ status: 'sent' })
      await user.type(input(), 'q{Enter}')
      expect(input()).toHaveValue('')
    })

    it('puts a quick prompt that was not sent into the input', async () => {
      const { user, onSendMessage, input } = renderChat({ defaultPrompts: ['Help me choose'] })
      onSendMessage.mockResolvedValue(notSent('Help me choose'))
      await user.click(screen.getByRole('button', { name: 'Help me choose' }))
      await waitFor(() => expect(input()).toHaveValue('Help me choose'))
    })
  })

  describe('long conversations and reset', () => {
    it('suggests starting fresh after 15 messages', () => {
      const { rerender } = renderChat({ messageCount: 14 })
      expect(screen.queryByText(/Long conversation/)).toBeNull()
      rerender(<Chat messages={[]} messageCount={15} onSendMessage={vi.fn()} isTyping={false} resetChat={vi.fn()} currentPage={CurrentPage.SEARCH_RESULT} />)
      expect(screen.getByText('Long conversation? Starting fresh may give better results.')).toBeInTheDocument()
    })

    it('does not show the long-conversation hint over the limit banner', () => {
      renderChat({ messageCount: 20, isLimitReached: true })
      expect(screen.queryByText(/Long conversation/)).toBeNull()
    })

    it('"New chat" is only available once there is a conversation', () => {
      renderChat({ messages: [msg('user', 'q')] })
      expect(iconButton('RestartAlt')).toBeDisabled()
    })

    it('resets after confirmation', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { user, resetChat, input } = renderChat({ messages: [msg('user', 'q'), msg('bot', 'a')] })
      await user.type(input(), 'draft')
      await user.click(iconButton('RestartAlt'))
      expect(confirm).toHaveBeenCalledWith('Are you sure you want to reset this chat? All messages will be deleted.')
      expect(resetChat).toHaveBeenCalled()
      expect(input()).toHaveValue('')
      await waitFor(() => expect(input()).toHaveFocus()) // ready for the next question
    })

    it('keeps the conversation when the reset is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const { user, resetChat } = renderChat({ messages: [msg('user', 'q'), msg('bot', 'a')] })
      await user.click(iconButton('RestartAlt'))
      expect(resetChat).not.toHaveBeenCalled()
    })
  })

  it.fails('KNOWN BUG (B26): renders without MUI warnings (tooltip around the disabled "New chat" button)', () => {
    const warn = vi.spyOn(console, 'warn')
    renderChat()
    const tooltipWarnings = warn.mock.calls.filter(args => String(args[0]).includes('disabled `button` child'))
    expect(tooltipWarnings).toEqual([])
  })
})

// Chat wired to the real useChatState, for behaviour that spans both.
function ChatWithState() {
  const state = useChatState({ contextKey: 'search:python', pageContextIds: ['r1'] })
  return (
    <Chat
      messages={state.messages}
      onSendMessage={state.handleSendMessage}
      isTyping={state.isTyping}
      resetChat={state.resetChat}
      isLimitReached={state.isLimitReached}
      limit={state.limit}
      notice={state.notice}
      onDismissNotice={state.dismissNotice}
      messageCount={state.messageCount}
      currentPage={CurrentPage.SEARCH_RESULT}
      searchTerm="python"
    />
  )
}

describe('Chat with useChatState', () => {
  it('does not lose a message typed before the chat is ready (session still loading)', async () => {
    allowConsole('warn', 'disabled `button` child to the Tooltip') // B26
    mockSessionLoading()
    const { user } = renderWithProviders(<ChatWithState />)
    await user.type(screen.getByRole('textbox'), 'Hello Cora{Enter}')
    // Either still in the input (not sent yet) or shown in the conversation; today it vanishes.
    const kept = (screen.getByRole('textbox') as HTMLTextAreaElement).value === 'Hello Cora' || screen.queryByText('Hello Cora') !== null
    expect(kept).toBe(true)
  })

  // Contract: several daily limits, each with its own 429 message; "show the response message in the banner".
  it("the limit banner shows the backend reason for this session's limit, and the question comes back", async () => {
    allowConsole('warn', 'disabled `button` child to the Tooltip') // B26
    mockApi('post', '/api/v1/chat', () => limitResponse(makeDailyLimit('session')))
    const { user } = renderWithProviders(<ChatWithState />)
    await user.type(screen.getByRole('textbox'), 'first question{Enter}')
    expect(await screen.findByText(DAILY_LIMIT_MESSAGES.session)).toBeInTheDocument()
    expect(screen.queryByText(/You've used your free questions for today/)).toBeNull()
    expect(screen.getByRole('textbox')).toHaveValue('first question')
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
    expect(screen.queryByText('first question', { selector: 'p' })).toBeNull() // not left in the conversation
  })

  it('the network limit does not lock: the reason is shown and "Try again" sends the question again', async () => {
    allowConsole('warn', 'disabled `button` child to the Tooltip') // B26
    let attempt = 0
    const calls = mockApi('post', '/api/v1/chat', () =>
      ++attempt === 1 ? limitResponse(makeDailyLimit('ip')) : sseResponse([delta('Back on a new network.'), done()]),
    )
    const { user } = renderWithProviders(<ChatWithState />)
    await user.type(screen.getByRole('textbox'), 'first question{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(DAILY_LIMIT_MESSAGES.ip)
    expect(screen.getByRole('textbox')).toHaveValue('first question')
    expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly')

    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }))
    // waitFor + getByText, not findByText: the streaming text is replaced by the Markdown rendering when the answer
    // ends, so an element found mid-stream can be detached a moment later.
    await waitFor(() => expect(screen.getByText('Back on a new network.')).toBeInTheDocument())
    expect(JSON.parse(calls[1].body).message).toBe('first question')
  })

  it('a rate-limited question comes back with the wait, and goes out once it is over', async () => {
    allowConsole('warn', 'disabled `button` child to the Tooltip') // B26
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let attempt = 0
      const calls = mockApi('post', '/api/v1/chat', () =>
        ++attempt === 1 ? limitResponse(makeRateLimited({ retryAfter: 2 })) : sseResponse([delta('Here you go.'), done()]),
      )
      const { user } = renderWithProviders(<ChatWithState />, { userEventOptions: { advanceTimers: vi.advanceTimersByTime } })
      await user.type(screen.getByRole('textbox'), 'my question{Enter}')
      expect(await screen.findByRole('alert')).toHaveTextContent('You can ask again in 2 seconds.')
      expect(screen.getByRole('textbox')).toHaveValue('my question')
      expect(iconButton('Send')).toBeDisabled()

      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
      await user.click(iconButton('Send'))
      await waitFor(() => expect(screen.getByText('Here you go.')).toBeInTheDocument()) // see above: not findByText
      expect(calls).toHaveLength(2)
      expect(screen.getByRole('textbox')).toHaveValue('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('a question that could not reach Cora comes back, with the reason', async () => {
    allowConsole('warn', 'disabled `button` child to the Tooltip') // B26
    mockApi('post', '/api/v1/chat', () => HttpResponse.error())
    const { user } = renderWithProviders(<ChatWithState />)
    await user.type(screen.getByRole('textbox'), 'my question{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(NETWORK_FAILURE)
    expect(screen.getByRole('textbox')).toHaveValue('my question')
  })
})
