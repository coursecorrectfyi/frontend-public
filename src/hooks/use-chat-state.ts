import { CurrentPage, sendChatMessage } from '@/api/chat';
import { getOrCreateSessionId } from '@/utils/session';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  /** True while the bot message is still receiving streaming chunks */
  isStreaming?: boolean;
}

interface ChatSession {
  chatId: string;
  messages: ChatMessage[];
  createdAt: number;
  lastUpdatedAt: number;
}

interface UseChatStateProps {
  pageContextIds?: string[];
  /**
   * Scopes the chat history to this context. Changing contextKey loads a
   * different conversation from localStorage (or starts fresh).
   *
   * Convention:
   *   Search:   "search:<query>"
   *   Subject:  "subject:<slug>"
   *   Saved:    "saved"
   *   Resource: "resource:<id>"
   */
  contextKey?: string;
}

/** Deterministic, collision-resistant ID from userId + contextKey. Not cryptographic. */
function deriveChatId(userId: string, contextKey: string): string {
  const str = `${userId}:${contextKey}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
}

const SESSION_MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days

export function useChatState({ pageContextIds = [], contextKey = 'default' }: UseChatStateProps) {
  const { data: authSession, status } = useSession();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [chatId, setChatId] = useState<string>('');

  // Track session ID for anonymous users — initialised once on client
  const sessionIdRef = useRef<string>('');
  const isClientRef = useRef(false);

  // ── Resolve identity ────────────────────────────────────────────────────────
  //
  // Firebase UID for signed-in users (session.backendTokens.user.id).
  // Anonymous session UUID for everyone else.
  // We wait until auth status is resolved (not 'loading') before initialising.

  useEffect(() => {
    if (isClientRef.current) return;
    isClientRef.current = true;
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  useEffect(() => {
    if (!isClientRef.current || status === 'loading') return;

    // For authenticated users, wait until we actually have the UID.
    // Without this guard, a token refresh that temporarily clears backendTokens
    // would fall through to sessionId, producing a different chatId and a
    // phantom "reset" of the conversation.
    if (status === 'authenticated' && !authSession?.backendTokens?.user?.id) return;

    const userId =
      status === 'authenticated' && authSession?.backendTokens?.user?.id
        ? authSession.backendTokens.user.id
        : sessionIdRef.current || getOrCreateSessionId();

    const id = deriveChatId(userId, contextKey);
    setChatId(id);
    loadSession(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, authSession?.backendTokens?.user?.id, contextKey]);

  // ── Session persistence ─────────────────────────────────────────────────────

  function loadSession(id: string) {
    // Always clear first — if no session exists for this id, the chat should
    // be empty, not show the previous context's messages.
    setMessages([]);
    setIsLimitReached(false);
    try {
      const raw = localStorage.getItem(`chat_${id}`);
      if (!raw) return;
      const parsed: ChatSession = JSON.parse(raw);
      if (Date.now() - parsed.createdAt > SESSION_MAX_AGE) {
        localStorage.removeItem(`chat_${id}`);
        return;
      }
      const restored = parsed.messages.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp),
        isStreaming: false, // never restore a streaming state
      }));
      setMessages(restored);
      setIsLimitReached(false);
    } catch {
      // Malformed session — ignore
    }
  }

  function persistSession(id: string, msgs: ChatMessage[]) {
    const session: ChatSession = {
      chatId: id,
      messages: msgs,
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
    // Preserve original createdAt if session already exists
    try {
      const existing = localStorage.getItem(`chat_${id}`);
      if (existing) {
        const parsed: ChatSession = JSON.parse(existing);
        session.createdAt = parsed.createdAt;
      }
    } catch { /* ignore */ }
    localStorage.setItem(`chat_${id}`, JSON.stringify(session));
  }

  // ── Send message ────────────────────────────────────────────────────────────

  const handleSendMessage = async (
    message: string,
    currentPage: CurrentPage,
    searchTerm?: string,
  ) => {
    if (isLimitReached || !chatId) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      content: message,
      sender: 'user',
      timestamp: new Date(),
    };

    const botMsgId = (Date.now() + 1).toString();

    // Add user message immediately
    setMessages(prev => {
      const updated = [...prev, userMsg];
      return updated;
    });
    setIsTyping(true);

    const accessToken = authSession?.backendTokens?.token ?? null;
    const sessionId = sessionIdRef.current || getOrCreateSessionId();

    // Capture history before the new user message is added to state.
    // messages at this point still reflects the prior turns only.
    const history = messages.map(m => ({ role: m.sender, content: m.content }));

    try {
      const stream = sendChatMessage(
        {
          message,
          chatId,
          pageContextIds,
          currentPage,
          searchTerm,
          history,
        },
        accessToken,
        sessionId,
      );

      let isFirstChunk = true;
      let fullContent = '';

      for await (const chunk of stream) {
        if (chunk.type === 'limit_reached') {
          setIsTyping(false);
          setIsLimitReached(true);
          const limitMsg: ChatMessage = {
            id: botMsgId,
            content: chunk.message,
            sender: 'bot',
            timestamp: new Date(),
          };
          setMessages(prev => {
            const final = [...prev, limitMsg];
            persistSession(chatId, final);
            return final;
          });
          return;
        }

        if (chunk.type === 'error') {
          setIsTyping(false);
          const errMsg: ChatMessage = {
            id: botMsgId,
            content: chunk.message || 'Sorry, something went wrong. Please try again.',
            sender: 'bot',
            timestamp: new Date(),
          };
          setMessages(prev => {
            const final = [...prev, errMsg];
            persistSession(chatId, final);
            return final;
          });
          return;
        }

        if (chunk.type === 'delta') {
          fullContent += chunk.content;

          if (isFirstChunk) {
            isFirstChunk = false;
            setIsTyping(false);
            setMessages(prev => [
              ...prev,
              {
                id: botMsgId,
                content: fullContent,
                sender: 'bot',
                timestamp: new Date(),
                isStreaming: true,
              },
            ]);
          } else {
            setMessages(prev =>
              prev.map(m => m.id === botMsgId ? { ...m, content: fullContent } : m),
            );
          }
        }

        if (chunk.type === 'done') {
          setMessages(prev => {
            const final = prev.map(m =>
              m.id === botMsgId ? { ...m, isStreaming: false } : m,
            );
            persistSession(chatId, final);
            return final;
          });
        }
      }
    } catch {
      setIsTyping(false);
      const errMsg: ChatMessage = {
        id: botMsgId,
        content: 'Sorry, something went wrong. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => {
        const final = [...prev, errMsg];
        persistSession(chatId, final);
        return final;
      });
    }
  };

  // ── Reset ───────────────────────────────────────────────────────────────────

  const resetChat = () => {
    if (!chatId) return;
    setMessages([]);
    setIsLimitReached(false);
    localStorage.removeItem(`chat_${chatId}`);
  };

  return {
    messages,
    isTyping,
    isLimitReached,
    handleSendMessage,
    resetChat,
    messageCount: messages.length,
  };
}
