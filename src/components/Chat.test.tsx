import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CurrentPage } from '@/api/chat'
import { useChatState } from '@/hooks/use-chat-state'
import { allowConsole } from '@/test/console'
import { firebase } from '@/test/mocks/firebase'
import { makeBackendTokens } from '@/test/fixtures'
import { mockSessionLoading, mockSignedIn, nextAuth } from '@/test/mocks/next-auth'
import { router } from '@/test/mocks/next-navigation'
import { mockApi } from '@/test/msw'
import { iconButton } from '@/test/pages'
import { renderWithProviders } from '@/test/render'
import Chat from './Chat'

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
    it.fails('KNOWN BUG (C2): limits the input to the 4,000 characters the backend accepts', () => {
      const { input } = renderChat()
      expect(input()).toHaveAttribute('maxlength', '4000')
    })
  })

  describe('daily limit', () => {
    it('locks the input and offers Google sign-in to anonymous visitors', async () => {
      const { user, onSendMessage, input } = renderChat({ messages: [msg('user', 'q'), msg('bot', 'limit')], isLimitReached: true })
      expect(input()).toBeDisabled()
      expect(input()).toHaveAttribute('placeholder', 'Reset chat to continue...')
      expect(screen.getByText(/Sign in for more, or come back tomorrow/)).toBeInTheDocument()

      mockApi('post', '/api/v1/auth/firebase/login', makeBackendTokens())
      await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))
      await waitFor(() => expect(nextAuth.signIn).toHaveBeenCalledWith('firebase-backend', expect.anything()))
      expect(firebase.signInWithGoogle).toHaveBeenCalled()
      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('does not offer sign-in to signed-in users', () => {
      mockSignedIn()
      renderChat({ messages: [msg('user', 'q'), msg('bot', 'limit')], isLimitReached: true })
      expect(screen.getByText(/Come back tomorrow/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull()
    })

    it('ignores quick prompts while locked', async () => {
      const { user, onSendMessage } = renderChat({ isLimitReached: true, defaultPrompts: ['Help me choose'] })
      await user.click(screen.getByRole('button', { name: 'Help me choose' }))
      expect(onSendMessage).not.toHaveBeenCalled()
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
      messageCount={state.messageCount}
      currentPage={CurrentPage.SEARCH_RESULT}
      searchTerm="python"
    />
  )
}

describe('Chat with useChatState', () => {
  it.fails('KNOWN BUG (B22): does not lose a message typed before the chat is ready (session still loading)', async () => {
    allowConsole('warn', 'disabled `button` child to the Tooltip') // B26
    mockSessionLoading()
    const { user } = renderWithProviders(<ChatWithState />)
    await user.type(screen.getByRole('textbox'), 'Hello Cora{Enter}')
    // Either still in the input (not sent yet) or shown in the conversation; today it vanishes.
    const kept = (screen.getByRole('textbox') as HTMLTextAreaElement).value === 'Hello Cora' || screen.queryByText('Hello Cora') !== null
    expect(kept).toBe(true)
  })

  // Contract: four different daily limits, each with its own 429 message; "show the response message in the banner".
  it.fails('KNOWN BUG (C1): the limit banner does not contradict the backend reason (e.g. the network limit)', async () => {
    allowConsole('warn', 'disabled `button` child to the Tooltip') // B26
    const message = 'Too many questions from your network today. Sign in to get 10 questions per day.'
    mockApi('post', '/api/v1/chat', { limitReached: true, message }, { status: 429 })
    const { user } = renderWithProviders(<ChatWithState />)
    await user.type(screen.getByRole('textbox'), 'first question{Enter}')
    await waitFor(() => expect(screen.getByRole('textbox')).toBeDisabled())
    expect(screen.queryByText(/You've used your free questions for today/)).toBeNull()
  })
})
