import { readApiError } from './errors';

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

export enum CurrentPage {
  SEARCH_RESULT = 'SearchResult',
  SAVED_COURSES = 'SavedCourses',
  COURSE_DETAIL = 'CourseDetail',
  SUBJECT_PAGE = 'SubjectPage',
}

// ── Request limits (docs/backend-api.md → "POST /api/v1/chat", Body) ──────────
// The backend drops or cuts anything beyond these (and answers 400 for a longer message), so there is no point in
// sending more. Lengths are JavaScript string lengths (UTF-16 code units), as in the contract.

/** `message`, after trimming surrounding whitespace. Longer: 400. */
export const MAX_MESSAGE_LENGTH = 4000;
/** Most recent `history` turns kept. */
export const MAX_HISTORY_TURNS = 20;
/** Characters per `history` turn. */
export const MAX_TURN_LENGTH = 16_000;
/** Characters across all `history` turns. */
export const MAX_HISTORY_LENGTH = 32_000;
/** Distinct `pageContextIds`. */
export const MAX_PAGE_CONTEXT_IDS = 50;

export interface ChatHistoryMessage {
  role: 'user' | 'bot';
  content: string;
}

export interface ChatRequest {
  message: string;
  pageContextIds: string[];
  currentPage: CurrentPage;
  searchTerm?: string;
  /** Prior turns in this conversation, oldest first, excluding the current message */
  history?: ChatHistoryMessage[];
}

export type ChatStreamChunk =
  | { type: 'delta'; content: string }
  | { type: 'done'; truncated?: boolean }
  | { type: 'error'; message: string };

/**
 * Text of a failed chat request when the body has no user-facing `message` (429s and 503s normally carry one).
 * 400 and 413 keep the backend's `error` (e.g. "message must be at most 4000 characters").
 */
function chatErrorText(status: number, error: string | undefined): string {
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status === 503) return 'Cora is unavailable right now. Please try again later.';
  if ((status === 400 || status === 413) && error) return error;
  return `Chat request failed: ${status}`;
}

/**
 * `history` as the backend would keep it: the most recent MAX_HISTORY_TURNS turns, each cut to MAX_TURN_LENGTH,
 * at most MAX_HISTORY_LENGTH characters in total (oldest turns dropped first). If older turns were dropped, the
 * kept turns start with a `user` turn.
 */
export function capHistory(history: ChatHistoryMessage[]): ChatHistoryMessage[] {
  let turns = history
    .slice(-MAX_HISTORY_TURNS)
    .map(turn => (turn.content.length > MAX_TURN_LENGTH ? { ...turn, content: turn.content.slice(0, MAX_TURN_LENGTH) } : turn));

  let total = turns.reduce((sum, turn) => sum + turn.content.length, 0);
  while (total > MAX_HISTORY_LENGTH) {
    total -= turns[0].content.length;
    turns = turns.slice(1);
  }

  if (turns.length < history.length) {
    const firstUser = turns.findIndex(turn => turn.role === 'user');
    turns = firstUser === -1 ? [] : turns.slice(firstUser);
  }
  return turns;
}

/** The first MAX_PAGE_CONTEXT_IDS distinct, non-empty ids, in order. */
export function capPageContextIds(ids: string[]): string[] {
  return [...new Set(ids.filter(id => typeof id === 'string' && id.trim() !== ''))].slice(0, MAX_PAGE_CONTEXT_IDS);
}

/** One SSE line → the event it carries, or undefined (comments, other fields, blank or malformed data). */
function parseSseLine(line: string): ChatStreamChunk | undefined {
  if (!line.startsWith('data: ')) return undefined;
  const raw = line.slice(6).trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as ChatStreamChunk;
  } catch {
    return undefined; // Malformed SSE line — skip
  }
}

/**
 * Sends a chat message and returns an async generator that yields SSE chunks.
 *
 * The body is kept within the contract's limits (history and page context are capped here, whoever the caller is).
 * Aborting `signal` cancels the request, which also stops the answer on the server; the generator then throws the
 * abort error, like `fetch`.
 *
 * Every non-2xx response throws an `ApiError` (see src/api/errors.ts): `isRateLimited` / `isDailyLimit` tell the
 * two 429s apart, `code` the two 503s (`chat_unavailable`, `chat_signed_in_only`), `maxLength`/`maxBytes` the 400
 * and 413 for oversized input.
 *
 * @param request     - Chat payload (message, context IDs, page, search term)
 * @param accessToken - Backend JWT for signed-in users; null for anonymous
 * @param sessionId   - Anonymous session UUID (cc_session_id from localStorage);
 *                      always sent as X-Session-ID so the backend can enforce anonymous limits
 * @param signal      - Optional AbortSignal to cancel the request and the stream
 */
export async function* sendChatMessage(
  request: ChatRequest,
  accessToken: string | null,
  sessionId: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamChunk> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Session-ID': sessionId,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const body: ChatRequest = {
    ...request,
    pageContextIds: capPageContextIds(request.pageContextIds),
    ...(request.history ? { history: capHistory(request.history) } : {}),
  };

  const response = await fetch(`${baseUrl}/api/v1/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw await readApiError(response, body => chatErrorText(response.status, body.error));
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const chunk = parseSseLine(line);
      if (!chunk) continue;
      yield chunk;
      if (chunk.type === 'done') return;
    }
  }

  // The stream ended: whatever is left is a last line without a trailing newline (B21).
  buffer += decoder.decode();
  for (const line of buffer.split('\n')) {
    const chunk = parseSseLine(line);
    if (!chunk) continue;
    yield chunk;
    if (chunk.type === 'done') return;
  }
}
