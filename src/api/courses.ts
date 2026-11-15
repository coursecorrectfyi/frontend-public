import type { LearningResource } from '@/types/resource';

export const MAX_SAVED_COURSES = 25;
export const ERR_NO_AUTH_TOKEN = 'No authentication token available. Please try logging in again.';
export const ERR_SESSION_EXPIRED = 'Your session has expired. Please log in again.';
export const ERR_PERMISSION_DENIED = 'You don\'t have permission to view saved items.';

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

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
