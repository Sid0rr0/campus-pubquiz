'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Fires one toast per distinct error message. React Query v5 removed
 * `useQuery`'s `onError`, so a query whose read failure should surface as a
 * toast (rather than an inline alert) needs this instead.
 */
export function useToastOnError(message: string | null): void {
  useEffect(() => {
    if (!message) return;
    toast.error(message);
  }, [message]);
}
