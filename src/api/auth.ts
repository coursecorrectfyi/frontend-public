import type { BackendTokens } from '@/types/next-auth';

const baseUrl = process.env.NEXT_PUBLIC_API_URL;

/**
 * Exchange Firebase ID token for backend JWT and user (runs first-login migration if needed).
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
    const text = await response.text();
    throw new Error(text || 'Firebase login failed');
  }

  const data = await response.json();
  return data as BackendTokens;
}
