'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useAdminGame,
  type UseAdminGameResult,
} from '@/app/lib/use-admin-game';
import { useAuth, type UseAuthResult } from '@/app/lib/use-auth';

export type AdminSessionRoute = '/control' | '/remote';

export interface UseAdminSessionResult extends UseAdminGameResult {
  auth: UseAuthResult;
  /** The URL's ?code=, or null when absent. */
  sessionCode: string | null;
  /** True until the page can render anything real: the auth check is running (or about to bounce to /login), or there is no session code (about to bounce to /sessions). */
  isLoading: boolean;
}

/**
 * How /control and /remote attach to a session: gates on auth, connects to
 * the URL's ?code=, keeps the URL on the connected session, and bounces to
 * the session picker when there is nothing (or nothing valid) to connect to.
 */
export function useAdminSession(
  route: AdminSessionRoute,
): UseAdminSessionResult {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get('code');
  const isAuthenticated = auth.status === 'authenticated';

  // The code the socket actually connects with. Only adopts `sessionCode`
  // (the URL's ?code=) when it points at a session the socket doesn't
  // already know about — a deep link, a freshly picked session, or a
  // manual URL edit to a different session — so a snapshot that already
  // matches the current session never forces a pointless full socket
  // reconnect (and briefly hides already-correct data behind the
  // "Connecting…" screen).
  const [connectJoinCode, setConnectJoinCode] = useState<string | null>(
    sessionCode,
  );

  const game = useAdminGame(
    isAuthenticated && Boolean(connectJoinCode),
    connectJoinCode ?? undefined,
  );
  const { snapshot, connectionError } = game;
  const connectedJoinCode = snapshot?.joinCode;

  // Adjusted during render rather than in an Effect, keyed off sessionCode.
  // Compares against `connectedJoinCode` (plain state, not a ref) since refs
  // can't be read during render.
  const [prevSessionCode, setPrevSessionCode] = useState(sessionCode);
  if (sessionCode !== prevSessionCode) {
    setPrevSessionCode(sessionCode);
    if (sessionCode && sessionCode !== connectedJoinCode) {
      setConnectJoinCode(sessionCode);
    }
  }

  useEffect(() => {
    // Keeps the URL's ?code= in sync with whatever session the socket is
    // actually connected to, so a refresh lands back in the same session
    // instead of falling through to the picker screen. Pure URL
    // bookkeeping — `connectJoinCode` above deliberately doesn't treat this
    // as a new session to connect to.
    if (snapshot && snapshot.joinCode !== sessionCode) {
      router.replace(`${route}?code=${snapshot.joinCode}`);
    }
  }, [snapshot, sessionCode, router, route]);

  useEffect(() => {
    // The session picker (list + start) lives at /sessions — a page without
    // a ?code= just bounces there instead of rendering it inline.
    if (isAuthenticated && !sessionCode) {
      router.replace('/sessions');
    }
  }, [isAuthenticated, sessionCode, router]);

  useEffect(() => {
    // Only bounces back to the picker for a session that never connected in
    // the first place (e.g. an unknown/invalid ?code=) — handleConnection
    // disconnects before ever sending STATE_SYNC in that case, so snapshot
    // stays null. Once a snapshot exists, a later connection problem renders
    // inline via the connectionError banner instead of redirecting away.
    if (sessionCode && connectionError && !snapshot) {
      router.replace('/sessions');
    }
  }, [sessionCode, connectionError, snapshot, router]);

  useEffect(() => {
    // Login/register/pending-approval live at /login and /register —
    // anyone landing here without a session bounces there.
    if (auth.status === 'unauthenticated' || auth.status === 'pending') {
      router.replace('/login');
    }
  }, [auth.status, router]);

  const isLoading = !isAuthenticated || !sessionCode;

  return { ...game, auth, sessionCode, isLoading };
}
