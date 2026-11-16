'use client';

import { firebaseLogin } from '@/api/auth';
import { isApiError, isNetworkError } from '@/api/errors';
import { signInWithGoogle, signOutFirebase } from '@/lib/firebase';
import { trackUserSignIn } from '@/utils/analytics';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export const SIGN_IN_FAILED = 'Sign-in failed. Please try again.';
export const SIGN_IN_NETWORK = "Couldn't reach the server to sign you in. Check your connection and try again.";
export const SIGN_IN_POPUP_BLOCKED = 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
export const SIGN_IN_METHOD_NOT_SUPPORTED = "This sign-in method isn't supported. Please use another account.";
export const SIGN_IN_EMAIL_NOT_VERIFIED = 'Please verify your email address first (check your inbox), then sign in again.';

/** Firebase error codes that mean the user chose not to sign in: not an error worth a message. */
const USER_CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

function firebaseCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string') return code;
  const message = error instanceof Error ? error.message : '';
  return /auth\/[a-z-]+/.exec(message)?.[0];
}

/**
 * What to tell the user when sign-in failed, or null when there's nothing to say (they closed the popup).
 * Login refusals follow docs/backend-api.md → "POST /api/v1/auth/firebase/login".
 */
export function signInErrorMessage(error: unknown): string | null {
  const code = firebaseCode(error);
  if (code && USER_CANCELLED.includes(code)) return null;
  if (code === 'auth/popup-blocked') return SIGN_IN_POPUP_BLOCKED;
  if (code === 'auth/network-request-failed') return SIGN_IN_NETWORK;
  if (isApiError(error)) {
    if (error.code === 'provider_not_allowed') return SIGN_IN_METHOD_NOT_SUPPORTED;
    if (error.code === 'email_not_verified') return SIGN_IN_EMAIL_NOT_VERIFIED;
    if (error.status === 429) return error.message; // the backend's rate-limit message
    return SIGN_IN_FAILED;
  }
  if (isNetworkError(error)) return SIGN_IN_NETWORK;
  return SIGN_IN_FAILED;
}

export function useFirebaseSignIn() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithFirebase = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setError(null);
    let firebaseSignedIn = false;
    try {
      const idToken = await signInWithGoogle();
      firebaseSignedIn = true;
      const backendTokens = await firebaseLogin(idToken);
      const result = await signIn('firebase-backend', {
        redirect: false,
        token: backendTokens.token,
        refreshToken: backendTokens.refreshToken,
        tokenExpires: String(backendTokens.tokenExpires),
        user: JSON.stringify(backendTokens.user),
      });
      // With redirect: false, NextAuth reports a refused sign-in in the result instead of throwing.
      if (!result?.ok || result.error) throw new Error(`NextAuth sign-in refused: ${result?.error ?? 'no result'}`);
      trackUserSignIn(backendTokens.user.provider);
    } catch (err) {
      const message = signInErrorMessage(err);
      if (message) console.error('Firebase sign-in failed:', err);
      setError(message);
      // Signed in to Firebase but not to the app: don't leave a half-signed-in Firebase session behind.
      if (firebaseSignedIn) await signOutFirebase().catch(() => {});
    } finally {
      setSigningIn(false);
    }
  };

  return { signInWithFirebase, signingIn, error, clearError: () => setError(null) };
}
