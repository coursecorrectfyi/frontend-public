import type { BackendTokens } from '@/types/next-auth';
import type { NextAuthOptions, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { relayHeaders } from './server/relay';

/**
 * NextAuth configuration (used by app/api/auth/[...nextauth]/route.ts).
 *
 * Sign-in flow: the browser signs in with Firebase (Google popup), exchanges the Firebase ID token for
 * backend tokens (POST /api/v1/auth/firebase/login), then calls signIn('firebase-backend', ...) with them.
 * The backend tokens live in the NextAuth JWT and are refreshed via POST /api/v1/auth/refresh.
 * Refresh and logout run on this server for the visitor, so they carry the relay headers (src/lib/server/relay.ts).
 *
 * Kept out of the route file because Next.js route files may only export HTTP handlers,
 * and these callbacks need unit tests (src/lib/auth-options.test.ts).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'firebase-backend',
      name: 'Firebase + Backend',
      credentials: {
        token: { label: 'Token', type: 'text' },
        refreshToken: { label: 'Refresh Token', type: 'text' },
        tokenExpires: { label: 'Token Expires', type: 'text' },
        user: { label: 'User', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.refreshToken || !credentials?.user) {
          return null;
        }
        const backendTokens = {
          token: credentials.token,
          refreshToken: credentials.refreshToken,
          tokenExpires: Number(credentials.tokenExpires) || 0,
          user: JSON.parse(credentials.user) as BackendTokens['user'],
        };
        if (!isValidBackendTokens(backendTokens)) return null;
        return { id: backendTokens.user.id, ...backendTokens } as unknown as User | null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider === 'firebase-backend' && user) {
        account.backendTokens = user as unknown as BackendTokens;
        return true;
      }
      return true;
    },
    async session({ session, token }) {
      if (token?.backendTokens) {
        session.backendTokens = token.backendTokens;
      }
      return session;
    },
    async jwt({ token, account, trigger, user }) {
      if (account?.backendTokens && isValidBackendTokens(account.backendTokens)) {
        token.backendTokens = account.backendTokens;
      }
      // Credentials (Firebase): user is the return value of authorize (User-shaped, carries BackendTokens)
      const backendTokensFromUser = user as unknown as BackendTokens;
      if (user && typeof user === 'object' && isValidBackendTokens(backendTokensFromUser)) {
        token.backendTokens = backendTokensFromUser;
      }

      // Refresh the access token when it has expired (or is about to, within 60s), or when the client asks for a
      // fresh one (`update()`, see src/hooks/use-auth.ts).
      const shouldRefresh =
        token.backendTokens &&
        (trigger === "update" || Date.now() >= token.backendTokens.tokenExpires - 60_000);

      if (shouldRefresh) {
        const outcome = await refreshBackendTokens(token.backendTokens!);
        if (outcome.status === 'refreshed') token.backendTokens = outcome.tokens;
        else if (outcome.status === 'rejected') delete token.backendTokens; // signed out: see SessionGuard
        // 'unavailable': keep the tokens; the next session read tries again.
      }

      return token;
    }
  },
  events: {
    async signOut({ token }) {
      // Optionally notify backend about logout
      if (token?.backendTokens?.token) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/logout`, {
            method: 'POST',
            headers: {
              ...(await relayHeaders()),
              'Authorization': `Bearer ${token.backendTokens.token}`,
            },
          });
        } catch (error) {
          console.error('Failed to logout from backend:', error);
        }
      }
    },
  },
};

/**
 * Outcome of POST /api/v1/auth/refresh (docs/backend-api.md → "POST /api/v1/auth/refresh", "Conventions"):
 * - `refreshed`: new tokens (the user is kept: the endpoint sends no user).
 * - `rejected`: the refresh token is invalid or expired (401), or the answer is unusable: the user must sign in
 *   again.
 * - `unavailable`: a temporary problem (5xx, 429 rate limit, network). "Treat every 5xx as a temporary server
 *   problem, never as a reason to sign the user out": keep the tokens and try again on the next session read.
 */
export type RefreshOutcome =
  | { status: 'refreshed'; tokens: BackendTokens }
  | { status: 'rejected' }
  | { status: 'unavailable' };

export async function refreshBackendTokens(current: BackendTokens): Promise<RefreshOutcome> {
  // Outside the try: relay problems are not refresh failures.
  const relay = await relayHeaders();
  let response: Response;
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        ...relay,
        'Authorization': `Bearer ${current.refreshToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.warn('Token refresh: backend unreachable, keeping the session:', error);
    return { status: 'unavailable' };
  }

  if (response.status === 401) return { status: 'rejected' };
  if (!response.ok) {
    console.warn(`Token refresh: HTTP ${response.status}, keeping the session`);
    return { status: 'unavailable' };
  }

  const tokens: unknown = await response.json().catch(() => undefined);
  if (isValidBackendTokens(tokens)) return { status: 'refreshed', tokens };
  if (isValidRefreshResponse(tokens)) {
    return {
      status: 'refreshed',
      tokens: { ...current, token: tokens.token, refreshToken: tokens.refreshToken, tokenExpires: tokens.tokenExpires },
    };
  }
  console.error('Token refresh: unusable response, signing out');
  return { status: 'rejected' };
}

// Refresh endpoint returns { token, refreshToken, tokenExpires } without user
export function isValidRefreshResponse(data: any): data is Pick<BackendTokens, 'token' | 'refreshToken' | 'tokenExpires'> {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.refreshToken === 'string' &&
    typeof data.token === 'string' &&
    typeof data.tokenExpires === 'number'
  );
}

// Type guard to ensure backend response matches our expected type
export function isValidBackendTokens(data: any): data is BackendTokens {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.refreshToken === 'string' &&
    typeof data.token === 'string' &&
    typeof data.tokenExpires === 'number' &&
    typeof data.user === 'object' &&
    data.user !== null &&
    typeof data.user.id === 'string' &&
    (typeof data.user.email === 'string' || data.user.email === null) &&
    typeof data.user.provider === 'string' &&
    typeof data.user.socialId === 'string' &&
    (typeof data.user.firstName === 'string' || data.user.firstName === null) &&
    (typeof data.user.lastName === 'string' || data.user.lastName === null) &&
    typeof data.user.role === 'object' &&
    data.user.role !== null &&
    typeof data.user.role.id === 'number' &&
    typeof data.user.status === 'object' &&
    data.user.status !== null &&
    typeof data.user.status.id === 'number' &&
    (typeof data.user.createdAt === 'string' || data.user.createdAt instanceof Date) &&
    (typeof data.user.updatedAt === 'string' || data.user.updatedAt instanceof Date)
  );
}
