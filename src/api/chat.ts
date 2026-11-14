const baseUrl = process.env.NEXT_PUBLIC_API_URL;

export enum CurrentPage {
  SEARCH_RESULT = 'SearchResult',
  SAVED_COURSES = 'SavedCourses',
  COURSE_DETAIL = 'CourseDetail',
  SUBJECT_PAGE = 'SubjectPage',
}

export interface ChatHistoryMessage {
  role: 'user' | 'bot';
  content: string;
}

export interface ChatRequest {
  message: string;
  chatId: string;
  pageContextIds: string[];
  currentPage: CurrentPage;
  searchTerm?: string;
  /** Prior turns in this conversation, oldest first, excluding the current message */
  history?: ChatHistoryMessage[];
}

export type ChatStreamChunk =
  | { type: 'delta'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'limit_reached'; message: string };

/**
 * Sends a chat message and returns an async generator that yields SSE chunks.
 *
 * @param request     - Chat payload (message, context IDs, page, search term)
 * @param accessToken - Backend JWT for signed-in users; null for anonymous
 * @param sessionId   - Anonymous session UUID (cc_session_id from localStorage);
 *                      always sent as X-Session-ID so the backend can enforce anonymous limits
 */
export async function* sendChatMessage(
  request: ChatRequest,
  accessToken: string | null,
  sessionId: string,
): AsyncGenerator<ChatStreamChunk> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Session-ID': sessionId,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${baseUrl}/api/v1/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (response.status === 429) {
    const data = await response.json().catch(() => ({ message: 'Daily limit reached.' }));
    yield { type: 'limit_reached', message: data.message ?? 'Daily limit reached.' };
    return;
  }

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
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
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        const chunk = JSON.parse(raw) as ChatStreamChunk;
        yield chunk;
        if (chunk.type === 'done') return;
      } catch {
        // Malformed SSE line — skip
      }
    }
  }
}
