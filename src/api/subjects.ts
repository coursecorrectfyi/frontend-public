import { pathSegment, readApiError } from './errors';
import type { RequestOptions } from './request';

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl(path: string): string {
  if (!baseUrl || baseUrl === 'undefined') {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not set. Set it in .env.local (e.g. http://localhost:3000) and ensure the backend is running.'
    );
  }
  return `${baseUrl.replace(/\/$/, '')}/api/v1${path}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  meta_description: string | null;
  parent_id: string | null;
  sort_order: number;
  course_count: number | null;
}

export interface TopicParent {
  id: string;
  name: string;
  slug: string;
}

/** Returned by GET /api/v1/subjects/:slug */
export interface SubjectDetail {
  topic: Topic;
  /** Present when topic is a domain (parent_id === null) */
  subtopics?: Topic[];
  /** Present when topic is a subtopic (parent_id !== null) */
  parent?: TopicParent | null;
}

export interface Subject {
  slug: string;
  name: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Throws `ApiError` on any non-2xx (404: unknown slug). */
export async function getSubjectBySlug(slug: string, options: RequestOptions = {}): Promise<SubjectDetail> {
  if (!slug) throw new Error('Invalid slug');
  const response = await fetch(getApiUrl(`/subjects/${pathSegment(slug)}`), { headers: options.headers });
  if (!response.ok) throw await readApiError(response, 'Failed to get subject');
  return response.json();
}

export async function getSubjects(options: RequestOptions = {}): Promise<Subject[]> {
  const url = getApiUrl('/subjects');
  let response: Response;
  try {
    response = await fetch(url, { headers: options.headers });
  } catch (err) {
    throw new Error(
      `Could not reach backend at ${url}. Is it running? (${err instanceof Error ? err.message : 'network error'})`
    );
  }

  if (!response.ok) {
    throw await readApiError(
      response,
      `Failed to fetch subjects (${response.status}). Is the backend running at ${baseUrl}?`,
    );
  }

  const subjects: Subject[] = await response.json();

  // Deduplicate by name
  const seen = new Map<string, Subject>();
  subjects.forEach(s => { if (!seen.has(s.name)) seen.set(s.name, s); });
  return Array.from(seen.values());
}
