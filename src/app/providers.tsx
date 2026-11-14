'use client';

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
        retry: (failureCount, error) => {
          // Don't retry on 401/403 errors
          if (error instanceof Error && 'status' in error) {
            return ![401, 403].includes((error as any).status);
          }
          return failureCount < 2;
        },
      },
    },
  }));

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}