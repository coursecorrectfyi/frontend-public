import { BackendTokens } from '@/types/next-auth';
import NextAuth from 'next-auth';
import type { User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
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

      // Refresh the access token when it has expired (or is about to, within 60s)
      const shouldRefresh =
        token.backendTokens &&
        (trigger === "update" || Date.now() >= token.backendTokens.tokenExpires - 60_000);

      if (shouldRefresh) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.backendTokens!.refreshToken}`,
              'Content-Type': 'application/json',
            },
          });

          const tokens = await response.json();
          if (isValidBackendTokens(tokens)) {
            token.backendTokens = tokens;
          } else if (isValidRefreshResponse(tokens) && token.backendTokens?.user) {
            token.backendTokens = {
              ...token.backendTokens,
              token: tokens.token,
              refreshToken: tokens.refreshToken,
              tokenExpires: tokens.tokenExpires,
            };
          }
        } catch (error) {
          console.error('Failed to refresh token:', error);
          // Clear tokens on refresh failure so the user is prompted to re-login
          delete token.backendTokens;
        }
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
              'Authorization': `Bearer ${token.backendTokens.token}`,
            },
          });
        } catch (error) {
          console.error('Failed to logout from backend:', error);
        }
      }
    },
  },
});

// Refresh endpoint returns { token, refreshToken, tokenExpires } without user
function isValidRefreshResponse(data: any): data is Pick<BackendTokens, 'token' | 'refreshToken' | 'tokenExpires'> {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.refreshToken === 'string' &&
    typeof data.token === 'string' &&
    typeof data.tokenExpires === 'number'
  );
}

// Type guard to ensure backend response matches our expected type
function isValidBackendTokens(data: any): data is BackendTokens {
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

export { handler as GET, handler as POST };