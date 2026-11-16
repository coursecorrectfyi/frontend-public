/**
 * Test data factories. Shapes follow docs/backend-api.md (the backend contract), so a test that
 * builds data with these factories is also a check that the frontend handles what the API sends.
 *
 * Every factory takes overrides; ids are unique per call unless overridden.
 */
import type { ApiErrorBody, LimitScope } from '@/api/errors'
import type { Subject, SubjectDetail, Topic } from '@/api/subjects'
import type { BackendTokens } from '@/types/next-auth'
import type {
  LearningResource,
  LearningResourceDetail,
  ResourceSearchResponse,
} from '@/types/resource'

let seq = 0
const next = () => ++seq

/** Deterministic UUID-shaped id: 00000000-0000-4000-8000-000000000001, ... */
export function makeUuid(n = next()): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

export function makeResource(overrides: Partial<LearningResource> = {}): LearningResource {
  const n = next()
  return {
    id: makeUuid(n),
    provider: 'coursera',
    resource_type: 'course',
    provider_type: 'mooc',
    title: `Python for Everybody ${n}`,
    ai_summary: 'Learn Python from scratch.',
    institution: 'University of Michigan',
    language: 'en',
    level: 'beginner',
    duration_hours: 20,
    rating: 4.5,
    num_ratings: 1234,
    is_free: false,
    has_certificate: true,
    is_self_paced: true,
    skills: ['Python', 'Programming'],
    career_paths: ['Software Developer'],
    url: `https://www.coursera.org/learn/python-${n}`,
    ...overrides,
  }
}

export function makeResourceDetail(
  overrides: Partial<LearningResourceDetail> = {},
): LearningResourceDetail {
  const base = makeResource(overrides)
  return {
    ...base,
    external_id: `ext-${base.id}`,
    legacy_mongo_id: null,
    ai_insights: null,
    ai_insights_updated_at: null,
    last_normalized_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeSearchResponse(
  overrides: Partial<ResourceSearchResponse> = {},
): ResourceSearchResponse {
  return {
    data: [makeResource(), makeResource()],
    next_cursor: null,
    vector_search: true,
    ...overrides,
  }
}

export function makeTopic(overrides: Partial<Topic> = {}): Topic {
  const n = next()
  return {
    id: makeUuid(n),
    name: `Topic ${n}`,
    slug: `topic-${n}`,
    description: 'A topic description.',
    meta_description: null,
    parent_id: null,
    sort_order: n,
    course_count: 10,
    ...overrides,
  }
}

/** Domain response: `{ topic, subtopics }` (GET /api/v1/subjects/:slug for a domain). */
export function makeDomainDetail(topic: Partial<Topic> = {}, subtopics: Topic[] = []): SubjectDetail {
  return { topic: makeTopic({ parent_id: null, ...topic }), subtopics }
}

/** Subtopic response: `{ topic, parent }` (GET /api/v1/subjects/:slug for a subtopic). */
export function makeSubtopicDetail(
  topic: Partial<Topic> = {},
  parent: { id?: string; name?: string; slug?: string } = {},
): SubjectDetail {
  const parentTopic = { id: makeUuid(), name: 'Data Science', slug: 'data-science', ...parent }
  return {
    topic: makeTopic({ parent_id: parentTopic.id, ...topic }),
    parent: parentTopic,
  }
}

export function makeSubject(overrides: Partial<Subject> = {}): Subject {
  const n = next()
  return { name: `Subject ${n}`, slug: `subject-${n}`, ...overrides }
}

export function makeBackendTokens(
  overrides: Partial<Omit<BackendTokens, 'user'>> & { user?: Partial<BackendTokens['user']> } = {},
): BackendTokens {
  const { user, ...rest } = overrides
  return {
    token: 'access-token',
    refreshToken: 'refresh-token',
    tokenExpires: Date.now() + 60 * 60 * 1000,
    ...rest,
    user: {
      id: 'user-1',
      email: 'ada@example.com',
      provider: 'google',
      socialId: 'google-123',
      firstName: 'Ada',
      lastName: 'Example',
      role: { id: 1 },
      status: { id: 1 },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...user,
    },
  }
}

// ── Error bodies (docs/backend-api.md → "Conventions", "429 responses", per-endpoint tables) ──────────────

/** Contract body of a 429 per-minute rate limit (any route). */
export function makeRateLimited(overrides: Partial<ApiErrorBody> = {}): ApiErrorBody & { retryAfter: number } {
  return {
    error: 'Too many requests',
    code: 'rate_limited',
    message: 'Too many requests. Please wait a moment and try again.',
    retryAfter: 3,
    limitReached: false,
    ...overrides,
  }
}

/** The user-facing `message` of each daily chat limit, verbatim from the contract. */
export const DAILY_LIMIT_MESSAGES: Record<LimitScope, string> = {
  user: "You've used all 10 of your daily questions. Your limit resets at midnight UTC.",
  signed_in_global: "Cora has reached today's limit for questions. Please try again after midnight UTC.",
  session: "You've used all 5 of your daily questions. Sign in to get 10 questions per day.",
  ip: 'Too many questions from your network today. Sign in to get 10 questions per day.',
  global: "Cora has reached today's limit for guest questions. Sign in to get 10 questions per day.",
}

/** Contract body of a 429 daily chat limit. `retryAfter` defaults to 6 h (seconds until midnight UTC). */
export function makeDailyLimit(
  scope: LimitScope = 'session',
  overrides: Partial<ApiErrorBody> = {},
): ApiErrorBody & { retryAfter: number } {
  return {
    error: 'Daily limit reached',
    code: 'daily_limit',
    message: DAILY_LIMIT_MESSAGES[scope],
    retryAfter: 6 * 60 * 60,
    limitReached: true,
    scope,
    ...overrides,
  }
}

/** Chat 503: switched off for everyone. */
export function makeChatUnavailable(): ApiErrorBody {
  return { error: 'Chat is unavailable', code: 'chat_unavailable', message: 'Cora is taking a break. Please try again later.' }
}

/** Chat 503: switched off for anonymous visitors. */
export function makeChatSignedInOnly(): ApiErrorBody {
  return {
    error: 'Chat is unavailable for guests',
    code: 'chat_signed_in_only',
    message: 'Cora is only available to signed-in users right now. Sign in to continue.',
  }
}

/** 413 body; `maxBytes` is 524,288 on the chat route and 16,384 elsewhere. */
export function makeBodyTooLarge(maxBytes = 524_288): ApiErrorBody {
  return { error: 'Request body too large', maxBytes }
}

/**
 * A 429 response as the API sends it: the body plus the matching `Retry-After` header. Use it as a responder,
 * so each request gets a fresh Response: `mockApi('get', path, () => limitResponse(makeRateLimited()))`.
 */
export function limitResponse(body: ApiErrorBody & { retryAfter: number }): Response {
  return Response.json(body, { status: 429, headers: { 'Retry-After': String(body.retryAfter) } })
}
