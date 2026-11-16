import type { LearningResource } from '@/types/resource';
import { pathSegment, readApiError } from './errors';

export const MAX_SAVED_COURSES = 25;
export const ERR_NO_AUTH_TOKEN = 'No authentication token available. Please try logging in again.';
export const ERR_SESSION_EXPIRED = 'Your session has expired. Please log in again.';
export const ERR_PERMISSION_DENIED = 'You don\'t have permission to view saved items.';
/** 404 on save: the resource is unknown or no longer active (docs/backend-api.md → POST /api/v1/saved/:resourceId). */
export const ERR_ITEM_UNAVAILABLE = "This item is no longer available, so it can't be saved.";
export const ERR_SAVE_FAILED = 'Failed to save item';
export const ERR_REMOVE_FAILED = 'Failed to remove item';

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

export async function getSavedCourses(token: string): Promise<LearningResource[]> {
  if (!token) throw new Error(ERR_NO_AUTH_TOKEN);

  const response = await fetch(`${baseUrl}/api/v1/saved`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw await readApiError(response, () => {
      if (response.status === 401) return ERR_SESSION_EXPIRED;
      if (response.status === 403) return ERR_PERMISSION_DENIED;
      return 'Failed to fetch saved items. Please try again.';
    });
  }

  const json: { data: LearningResource[] } = await response.json();
  return json.data ?? [];
}

export async function addCourseToShortlist(token: string, courseId: string) {
  if (!token) throw new Error(ERR_NO_AUTH_TOKEN);

  const response = await fetch(`${baseUrl}/api/v1/saved/${pathSegment(courseId)}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  // A 429 carries the backend's own message (readApiError prefers it).
  if (!response.ok) {
    throw await readApiError(response, () => {
      if (response.status === 401) return ERR_SESSION_EXPIRED;
      if (response.status === 404) return ERR_ITEM_UNAVAILABLE;
      return ERR_SAVE_FAILED;
    });
  }
  return response.json();
}

export async function removeCourseFromShortlist(token: string, courseId: string) {
  if (!token) throw new Error(ERR_NO_AUTH_TOKEN);

  const response = await fetch(`${baseUrl}/api/v1/saved/${pathSegment(courseId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw await readApiError(response, () => (response.status === 401 ? ERR_SESSION_EXPIRED : ERR_REMOVE_FAILED));
  }
  return response.json();
}
