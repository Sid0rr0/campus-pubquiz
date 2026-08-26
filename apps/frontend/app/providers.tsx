'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const DEFAULT_GC_TIME_MS = 5 * 60_000;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Every read here is a small admin-tool GET that already renders its
        // own inline error. Retries would only delay that banner.
        retry: false,
        // staleTime 0 keeps today's semantics: mounting a screen fetches.
        // Session/quiz/user lists change while the operator is on another
        // page, so caching past a remount would be a regression.
        staleTime: 0,
        gcTime: DEFAULT_GC_TIME_MS,
        // Nothing refetches on focus/reconnect today. The admin page's
        // reconnect-driven refetch is keyed off the game socket's own
        // `reconnectedAt`, not the browser's online event.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // One client per component lifetime — `new QueryClient()` inline in the
  // render body would throw the cache away on every re-render. Every
  // consumer here is a 'use client' component talking to a separate
  // cookie-authenticated NestJS backend, so there's no server-side prefetch
  // to hydrate and no need for the browser-singleton split from Next's RSC
  // streaming guide.
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
