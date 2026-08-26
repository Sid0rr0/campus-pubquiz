import { useState, type ReactNode, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import { AuthProvider } from '@/app/lib/use-auth';

/**
 * A fresh client per render. A shared one would leak one test's cached
 * sessions/users into the next.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // retry: false is load-bearing — with the default 3 retries and
      // exponential backoff, every rejection-path test would time out
      // instead of rendering its alert.
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export function QueryWrapper({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createTestQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/** For suites that need a real AuthProvider above the query client. */
export function QueryAuthWrapper({ children }: { children: ReactNode }) {
  return (
    <QueryWrapper>
      <AuthProvider>{children}</AuthProvider>
    </QueryWrapper>
  );
}

export function renderWithQuery(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  return render(ui, { wrapper: QueryWrapper, ...options });
}
