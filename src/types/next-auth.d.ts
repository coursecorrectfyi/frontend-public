import 'next-auth';

interface BackendTokens {
  refreshToken: string;
  token: string;
  tokenExpires: number;
  user: {
    id: string;
    email: string | null;
    provider: string;
    socialId: string;
    firstName: string | null;
    lastName: string | null;
    role: {
      id: number;
    };
    status: {
      id: number;
    };
    createdAt: string;
    updatedAt: string;
  };
}

declare module 'next-auth' {
  interface Session {
    backendTokens?: BackendTokens;
  }

  interface Account {
    backendTokens?: BackendTokens;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    backendTokens?: BackendTokens;
  }
}
