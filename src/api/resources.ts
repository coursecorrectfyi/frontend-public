import type {
  LearningResource,
  LearningResourceDetail,
  ResourceFilters,
  ResourceSearchResponse,
} from '@/types/resource'

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
  if (!response.ok) throw new Error('Search request failed')
  return response.json()
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getResourceById(id: string): Promise<LearningResourceDetail> {
  const response = await fetch(`${baseUrl}/api/v1/resources/${id}`)
  if (!response.ok) throw new Error('Failed to fetch resource')
  return response.json()
}

// ── Saved resources ───────────────────────────────────────────────────────────

export async function getSavedResources(token: string): Promise<LearningResource[]> {
  const response = await fetch(`${baseUrl}/api/v1/saved`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('Failed to fetch saved resources')
  const json = await response.json()
  return json.data
}

export async function saveResource(token: string, resourceId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/saved/${resourceId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('Failed to save resource')
}

export async function unsaveResource(token: string, resourceId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/saved/${resourceId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('Failed to remove saved resource')
}
