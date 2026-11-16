import type { BackendTokens } from '@/types/next-auth';
import { readApiError } from './errors';

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

/**
 * Exchange Firebase ID token for backend JWT and user (runs first-login migration if needed).
 * Throws `ApiError`: `code` tells `provider_not_allowed` / `email_not_verified` (403) apart; the message is the
 * backend's text (e.g. "Invalid Firebase ID token").
 */
export async function firebaseLogin(idToken: string): Promise<BackendTokens> {
  const response = await fetch(`${baseUrl}/api/v1/auth/firebase/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw await readApiError(response, body => body.error ?? 'Firebase login failed');
  }

  const data = await response.json();
  return data as BackendTokens;
}
