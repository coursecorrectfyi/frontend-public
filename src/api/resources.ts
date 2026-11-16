import type {
  LearningResourceDetail,
  ResourceFilters,
  ResourceSearchResponse,
} from '@/types/resource'
import { isApiError, pathSegment, readApiError } from './errors'
import type { RequestOptions } from './request'

const baseUrl = process.env.NEXT_PUBLIC_API_URL

// ── Language display name → ISO 639-1 ────────────────────────────────────────
const LANGUAGE_TO_ISO: Record<string, string> = {
  English: 'en', Spanish: 'es', Portuguese: 'pt', Turkish: 'tr',
  French: 'fr', Arabic: 'ar', Japanese: 'ja', Chinese: 'zh',
  German: 'de', Korean: 'ko', Italian: 'it', Russian: 'ru',
  Hindi: 'hi', Indonesian: 'id', Polish: 'pl', Ukrainian: 'uk',
  Hebrew: 'he',
}

// ── Search ────────────────────────────────────────────────────────────────────

/** Throws `ApiError` on any non-2xx (e.g. 429 rate limit, 400 `Invalid cursor`). */
export async function searchResources(
  query: string,
  filters?: ResourceFilters,
  cursor?: string,
): Promise<ResourceSearchResponse> {
  const params = new URLSearchParams({ q: query, limit: '20' })
  if (cursor) params.set('cursor', cursor)

  filters?.levels?.forEach(l => params.append('level', l))
  filters?.providers?.forEach(p => params.append('provider', p.toLowerCase()))
  filters?.languages?.forEach(l => params.append('language', LANGUAGE_TO_ISO[l] ?? l))
  filters?.resource_types?.forEach(t => params.append('resource_type', t))
  if (filters?.sort) params.set('sort', filters.sort)
  if (filters?.is_free != null) params.set('is_free', String(filters.is_free))
  if (filters?.has_certificate != null) params.set('has_certificate', String(filters.has_certificate))

  const response = await fetch(`${baseUrl}/api/v1/resources/search?${params}`)
  if (!response.ok) throw await readApiError(response, 'Search request failed')
  return response.json()
}

/**
 * The cursor of a "Load more" no longer works (malformed, or made for another sort): 400 `Invalid cursor`.
 * Recover by loading the results again from the first page.
 */
export function isInvalidCursor(error: unknown): boolean {
  return isApiError(error) && error.status === 400 && error.serverError === 'Invalid cursor'
}

// ── Detail ────────────────────────────────────────────────────────────────────

/** `id`: the resource UUID (or a deprecated legacy Mongo id). Throws `ApiError` (404: unknown id). */
export async function getResourceById(id: string, options: RequestOptions = {}): Promise<LearningResourceDetail> {
  const response = await fetch(`${baseUrl}/api/v1/resources/${pathSegment(id)}`, { headers: options.headers })
  if (!response.ok) throw await readApiError(response, 'Failed to fetch resource')
  return response.json()
}
