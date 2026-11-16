'use client';

import type { BackendTokens } from '@/types/next-auth';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';

/** An access token expiring sooner than this is refreshed before use (the server also refreshes within 60 s). */
export const TOKEN_REFRESH_MARGIN_MS = 60_000;

export interface Auth {
  /** `loading` until NextAuth knows; `signed_in` only with backend tokens (see SessionGuard). */
  status: 'loading' | 'signed_in' | 'signed_out';
  isSignedIn: boolean;
  user: BackendTokens['user'] | null;
  userId: string | null;
  /**
   * An access token that is valid for at least another minute, or null when signed out. The access token lasts an
   * hour (docs/backend-api.md → login); a page left open longer would otherwise send an expired one, and the
   * backend would quietly treat a signed-in user as a guest (chat) or answer 401 (saved items).
   */
  getAccessToken: () => Promise<string | null>;
}

/**
 * The one definition of "signed in" for the app: a NextAuth session that carries backend tokens. A session
 * without them (the refresh token was rejected) counts as signed out, and SessionGuard ends it.
 */
export function useAuth(): Auth {
  const { data, status, update } = useSession();
  const tokens = status === 'authenticated' ? data?.backendTokens : undefined;

  const getAccessToken = useCallback(async () => {
    if (!tokens) return null;
    if (tokens.tokenExpires - Date.now() > TOKEN_REFRESH_MARGIN_MS) return tokens.token;
    try {
      // Re-runs the NextAuth jwt callback with trigger "update", which refreshes the backend tokens.
      const fresh = await update();
      return fresh?.backendTokens?.token ?? null;
    } catch {
      return tokens.token; // couldn't refresh now: the backend decides (a guest for chat, 401 for saved items)
    }
  }, [tokens, update]);

  return {
    status: status === 'loading' ? 'loading' : tokens ? 'signed_in' : 'signed_out',
    isSignedIn: !!tokens,
    user: tokens?.user ?? null,
    userId: tokens?.user?.id ?? null,
    getAccessToken,
  };
}
