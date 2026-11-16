'use client';

import { retryDelay, shouldRetry } from '@/api/retry-policy';
import SessionGuard from '@/components/auth/SessionGuard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
        gcTime: 10 * 60 * 1000, // Garbage collection time (formerly cacheTime)
        refetchOnWindowFocus: false, // Don't refetch on window focus
        // Network errors and 5xx: 2 retries; short rate limits: 1 retry after `retryAfter`; other 4xx: none.
        retry: shouldRetry,
        retryDelay,
      },
    },
  }));

  return (
    <SessionProvider>
      <SessionGuard />
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}