import type { LearningResource } from '@/types/resource';

export const MAX_SAVED_COURSES = 25;
export const ERR_NO_AUTH_TOKEN = 'No authentication token available. Please try logging in again.';
export const ERR_SESSION_EXPIRED = 'Your session has expired. Please log in again.';
export const ERR_PERMISSION_DENIED = 'You don\'t have permission to view saved items.';

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

export interface SearchFilters {
  levels: string[];
  languages: string[];
  providers: string[];
}

export async function getSavedCourses(token: string): Promise<LearningResource[]> {
  if (!token) throw new Error(ERR_NO_AUTH_TOKEN);

  const response = await fetch(`${baseUrl}/api/v1/saved`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error(ERR_SESSION_EXPIRED);
    if (response.status === 403) throw new Error(ERR_PERMISSION_DENIED);
    throw new Error('Failed to fetch saved items. Please try again.');
  }

  const json: { data: LearningResource[] } = await response.json();
  return json.data ?? [];
}

// TODO F2: searchCourses is used by legacy components still being rebuilt.
// New code should use searchResources() from @/api/resources instead.
export async function searchCourses(query: string, filters?: SearchFilters) {
  const searchParams: Record<string, any> = { query };
  if (filters) {
    searchParams.filter = {
      ...(filters.levels?.length && { 'metadata.properties.course_level': filters.levels }),
      ...(filters.languages?.length && { 'metadata.properties.course_language': filters.languages }),
      ...(filters.providers?.length && { 'metadata.properties.course_provider': filters.providers }),
    };
  }

  const response = await fetch(`${baseUrl}/api/v1/courses/search?page=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(searchParams),
  });

  if (!response.ok) throw new Error('Search request failed');
  return response.json();
}

export async function addCourseToShortlist(token: string, courseId: string) {
  if (!token) throw new Error(ERR_NO_AUTH_TOKEN);

  const response = await fetch(`${baseUrl}/api/v1/saved/${encodeURIComponent(courseId)}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to save item');
  return response.json();
}

export async function removeCourseFromShortlist(token: string, courseId: string) {
  if (!token) throw new Error(ERR_NO_AUTH_TOKEN);

  const response = await fetch(`${baseUrl}/api/v1/saved/${encodeURIComponent(courseId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to remove item');
  return response.json();
}

export async function getCourseById(courseId: string) {
  if (!courseId) {
    throw new Error('Invalid course ID');
  }

  const response = await fetch(
    `${baseUrl}/api/v1/courses/details/${courseId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) throw new Error('Failed to get course');
  return response.json();
}