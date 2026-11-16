import { CurrentPage, MAX_MESSAGE_LENGTH, sendChatMessage } from '@/api/chat';
import { isApiError, isDailyLimit, isNetworkError, isRateLimited } from '@/api/errors';
import { isLimitStorageEvent, limitIdentityKey, locksUi, nextMidnightUtc, readLimit, saveLimit } from '@/utils/chat-limits';
import { stableHash } from '@/utils/hash';
import { getOrCreateSessionId, randomUuid } from '@/utils/session';
import { useAuth } from './use-auth';
import { useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  /** True while the bot message is still receiving streaming chunks */
  isStreaming?: boolean;
}

/**
 * Why the last question could not be sent or answered in full, shown next to the input until the next send (or
 * dismissed). Never part of the conversation: the conversation (and the `history` sent to Cora) holds real turns only.
 * - `rate_limited`: temporary; sending is possible again at `retryAt` (ms since epoch).
 * - `unavailable`: chat is switched off (503); `signIn` when it is only off for guests (`chat_signed_in_only`).
 * - `failed`: anything else (network, server error, rejected input, no answer).
 */
export type ChatNotice =
  | { kind: 'rate_limited'; message: string; retryAt: number }
  | { kind: 'unavailable'; message: string; signIn: boolean }
  /** A daily limit that doesn't lock (network, everyone's totals): trying again is allowed. */
  | { kind: 'daily_limit'; message: string; scope?: string; signIn: boolean }
  | { kind: 'failed'; message: string };

/**
 * A daily limit that locks this identity (scopes `user`, `session`): the backend's message for the user, its
 * scope, and when it resets. Remembered across pages, tabs and reloads (src/utils/chat-limits.ts).
 */
export interface ChatLimit {
  message: string;
  scope?: string;
  until: number;
}

/** Daily-limit scopes of anonymous visitors: signing in lifts them (signed-in users have their own limits). */
export const GUEST_SCOPES: readonly string[] = ['session', 'ip', 'global'];

/**
 * - `sent`: (part of) an answer is in the conversation.
 * - `not_sent`: nothing was answered (or nothing could be sent yet); `message` is the question, to give back.
 * - `ignored`: nothing to do (empty message), or stopped on purpose (chat closed, "New chat", other conversation).
 */
export type SendOutcome = { status: 'sent' } | { status: 'not_sent'; message: string } | { status: 'ignored' };

const SENT: SendOutcome = { status: 'sent' };
const IGNORED: SendOutcome = { status: 'ignored' };

export const GENERIC_FAILURE = 'Sorry, something went wrong. Please try again.';
export const NETWORK_FAILURE = "Couldn't reach Cora. Check your connection and try again.";
export const TOO_LONG = 'That message is too long for Cora (4,000 characters at most). Shorten it and try again.';
export const TOO_LARGE = 'That message is too large to send. Try a shorter message, or start a new chat.';
export const NO_ANSWER = "Cora didn't answer that one. Please try again.";
export const CUT_OFF = 'The answer was cut off before Cora finished. Ask again to get the rest.';

/** The notice for a request that failed before any answer (daily limits are handled separately). */
function noticeFor(error: unknown): ChatNotice {
  if (isRateLimited(error)) {
    return { kind: 'rate_limited', message: error.message, retryAt: Date.now() + (error.retryAfter ?? 5) * 1000 };
  }
  if (isApiError(error) && error.status === 503) {
    return { kind: 'unavailable', message: error.message, signIn: error.code === 'chat_signed_in_only' };
  }
  if (isApiError(error) && error.status === 400 && error.maxLength !== undefined) return { kind: 'failed', message: TOO_LONG };
  if (isApiError(error) && error.status === 413) return { kind: 'failed', message: TOO_LARGE };
  if (isNetworkError(error)) return { kind: 'failed', message: NETWORK_FAILURE };
  return { kind: 'failed', message: GENERIC_FAILURE };
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

/**
 * Deterministic, collision-resistant ID from userId + contextKey. Not cryptographic. Only used as the local storage
 * key of a conversation; the backend never sees it.
 */
function deriveChatId(userId: string, contextKey: string): string {
  return stableHash(`${userId}:${contextKey}`);
}

const SESSION_MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days

export function useChatState({ pageContextIds = [], contextKey = 'default' }: UseChatStateProps) {
  const { status: authStatus, userId: signedInUserId, getAccessToken } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [limit, setLimit] = useState<ChatLimit | null>(null);
  const [notice, setNotice] = useState<ChatNotice | null>(null);
  const [chatId, setChatId] = useState<string>('');
  // Whose daily limit applies: `user:<hash>` or `anon:<hash>` (limits belong to identities, not conversations).
  const [limitKey, setLimitKey] = useState<string>('');

  // Track session ID for anonymous users — initialised once on client
  const sessionIdRef = useRef<string>('');
  const isClientRef = useRef(false);

  // The request being answered, so it can be stopped: closing the chat (unmount), "New chat" and switching to
  // another conversation abort it, which also stops the answer on the server.
  const requestRef = useRef<AbortController | null>(null);
  const abortCurrentRequest = () => {
    requestRef.current?.abort();
    requestRef.current = null;
  };
  useEffect(() => abortCurrentRequest, []);

  // ── Resolve identity ────────────────────────────────────────────────────────
  //
  // Firebase UID for signed-in users (session.backendTokens.user.id).
  // Anonymous session UUID for everyone else, including a session whose tokens are gone (useAuth: signed out).
  // We wait until auth status is resolved (not 'loading') before initialising.

  useEffect(() => {
    if (isClientRef.current) return;
    isClientRef.current = true;
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  useEffect(() => {
    if (!isClientRef.current || authStatus === 'loading') return;

    const userId = signedInUserId ?? (sessionIdRef.current || getOrCreateSessionId());

    const id = deriveChatId(userId, contextKey);
    abortCurrentRequest(); // an answer still streaming belongs to the previous conversation
    setIsTyping(false);
    setChatId(id);
    loadSession(id);

    // The daily limit of the identity now using the chat (another identity's limit is kept, not applied).
    const identityKey = limitIdentityKey({
      userId: signedInUserId,
      sessionId: sessionIdRef.current || getOrCreateSessionId(),
    });
    setLimitKey(identityKey);
    setLimit(readLimit(identityKey));
  }, [authStatus, signedInUserId, contextKey]);

  // ── Session persistence ─────────────────────────────────────────────────────

  function loadSession(id: string) {
    // Always clear first — if no session exists for this id, the chat should
    // be empty, not show the previous context's messages.
    setMessages([]);
    setNotice(null);
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

  /**
   * Sends a question and streams the answer into the conversation.
   *
   * A failure before any answer text (rate limit, daily limit, chat switched off, rejected input, network, an error
   * event with no text) removes the question from the conversation, stores nothing, shows a notice (or the limit
   * banner), and returns `{ status: 'not_sent', message }` so the caller can give the question back to the user.
   * A failure after part of the answer keeps and stores that part, and shows the error as a notice.
   */
  const handleSendMessage = async (
    message: string,
    currentPage: CurrentPage,
    searchTerm?: string,
  ): Promise<SendOutcome> => {
    if (!message.trim()) return IGNORED;
    // Can't be sent now: identity still resolving (session loading), daily limit reached, rate limited (a request
    // would only be refused again), or too long (the backend answers 400). Nothing is sent; the text is given back.
    const rateLimited = notice?.kind === 'rate_limited' && Date.now() < notice.retryAt;
    if (!chatId || limit || rateLimited || message.trim().length > MAX_MESSAGE_LENGTH) {
      return { status: 'not_sent', message };
    }

    const conversationId = chatId;
    const userMsg: ChatMessage = { id: randomUuid(), content: message, sender: 'user', timestamp: new Date() };
    const botMsgId = randomUuid();

    setNotice(null);
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    const sessionId = sessionIdRef.current || getOrCreateSessionId();

    // Capture history before the new user message is added to state.
    // messages at this point still reflects the prior turns only (failures are notices, never messages).
    // sendChatMessage caps it to the contract's limits.
    const history = messages.map(m => ({ role: m.sender, content: m.content }));

    abortCurrentRequest();
    const controller = new AbortController();
    requestRef.current = controller;

    let fullContent = '';

    /** Nothing of an answer arrived: take the question back out of the conversation and report why. */
    const notSent = (why: ChatNotice | null): SendOutcome => {
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
      if (why) setNotice(why);
      return { status: 'not_sent', message };
    };

    /** Part of an answer arrived: keep and store it (no longer streaming); say why it ended early, if it did. */
    const finishAnswer = (errorText?: string): SendOutcome => {
      setMessages(prev => {
        const final = prev.map(m => (m.id === botMsgId ? { ...m, isStreaming: false } : m));
        persistSession(conversationId, final);
        return final;
      });
      if (errorText) setNotice({ kind: 'failed', message: errorText });
      return SENT;
    };

    try {
      // Signed in: a token valid for at least another minute (refreshed first if needed), so the backend doesn't
      // quietly treat the user as a guest. Guests: null, identified by the session id.
      const accessToken = await getAccessToken();
      const stream = sendChatMessage(
        {
          message,
          pageContextIds,
          currentPage,
          searchTerm,
          history,
        },
        accessToken,
        sessionId,
        controller.signal,
      );

      for await (const chunk of stream) {
        if (chunk.type === 'delta') {
          const isFirst = fullContent === '';
          fullContent += chunk.content;
          if (isFirst) {
            setIsTyping(false);
            setMessages(prev => [
              ...prev,
              { id: botMsgId, content: fullContent, sender: 'bot', timestamp: new Date(), isStreaming: true },
            ]);
          } else {
            const content = fullContent;
            setMessages(prev => prev.map(m => (m.id === botMsgId ? { ...m, content } : m)));
          }
        } else if (chunk.type === 'error') {
          // "If no delta arrived, the question wasn't counted": the user can simply send it again.
          if (!fullContent) return notSent({ kind: 'failed', message: chunk.message || GENERIC_FAILURE });
          return finishAnswer(chunk.message || GENERIC_FAILURE);
        } else if (chunk.type === 'done') {
          if (!fullContent) return notSent({ kind: 'failed', message: NO_ANSWER });
          return finishAnswer();
        }
      }

      // The stream ended without `done` (e.g. the connection dropped).
      if (!fullContent) return notSent({ kind: 'failed', message: GENERIC_FAILURE });
      return finishAnswer(CUT_OFF);
    } catch (error) {
      // Stopped on purpose (chat closed, "New chat", other conversation): not a failure, and the conversation it
      // belonged to is no longer shown.
      if (controller.signal.aborted) return IGNORED;
      if (fullContent) return finishAnswer(CUT_OFF);
      if (isDailyLimit(error)) {
        const signIn = error.scope === undefined || GUEST_SCOPES.includes(error.scope);
        if (!locksUi(error.scope)) {
          // Not tied to this identity alone (network, everyone's totals): say so, but let the user try again.
          return notSent({ kind: 'daily_limit', message: error.message, scope: error.scope, signIn });
        }
        const until = error.retryAfter !== undefined ? Date.now() + error.retryAfter * 1000 : nextMidnightUtc();
        const reached: ChatLimit = { message: error.message, scope: error.scope, until };
        saveLimit(limitKey, reached);
        setLimit(reached);
        return notSent(null);
      }
      return notSent(noticeFor(error));
    } finally {
      setIsTyping(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  // ── Reset ───────────────────────────────────────────────────────────────────

  const resetChat = () => {
    if (!chatId) return;
    abortCurrentRequest();
    setIsTyping(false);
    setMessages([]);
    setNotice(null); // the daily limit stays: it belongs to the identity, not to this conversation
    localStorage.removeItem(`chat_${chatId}`);
  };

  // The limit ends by itself when it resets, without a reload.
  useEffect(() => {
    if (!limit) return;
    const timer = setTimeout(() => setLimit(readLimit(limitKey)), Math.max(0, limit.until - Date.now()));
    return () => clearTimeout(timer);
  }, [limit, limitKey]);

  // A limit reached in another tab applies here too (and one that reset there, is gone here).
  useEffect(() => {
    if (!limitKey) return;
    const onStorage = (event: StorageEvent) => {
      if (isLimitStorageEvent(event)) setLimit(readLimit(limitKey));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [limitKey]);

  // A rate-limit notice goes away by itself when the wait is over (sending is possible again).
  useEffect(() => {
    if (notice?.kind !== 'rate_limited') return;
    const timer = setTimeout(() => setNotice(current => (current === notice ? null : current)), Math.max(0, notice.retryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [notice]);

  return {
    messages,
    isTyping,
    isLimitReached: limit !== null,
    limit,
    notice,
    dismissNotice: () => setNotice(null),
    handleSendMessage,
    resetChat,
    messageCount: messages.length,
  };
}
