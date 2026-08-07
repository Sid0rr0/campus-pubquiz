'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { Header } from '@/app/components/header';

/**
 * Shared top bar rendered once from the root layout — same "🍺 Trivia Night"
 * branding as display's TriviaHeader. Every page gets auth-aware nav on the
 * right (Login/Register when signed out, username + Log out — and Users for
 * admins — when signed in) except the home page, which keeps just the logo.
 *
 * Suppressed entirely on /display: that screen is audience-facing (no auth
 * nav belongs on the big screen) and already has its own per-status header
 * (TriviaHeader, with the round/question badge) for the screens that want
 * one — merging the two isn't simple since the round/question data lives in
 * DisplayPage's socket state, not anything the root layout has access to.
 */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname.startsWith('/display')) {
    return null;
  }
  return <SiteHeaderContent isHome={pathname === '/'} />;
}

function SiteHeaderContent({ isHome }: { isHome: boolean }) {
  const auth = useAuth();
  const router = useRouter();

  function handleLogout(): void {
    auth.logout();
    router.push('/');
  }

  return (
    <Header>
      {!isHome && (
        <nav className="flex items-center gap-4 text-sm font-extrabold tracking-wide">
          {auth.status === 'authenticated' && auth.user && (
            <>
              <span className="text-foreground/60">{auth.user.username}</span>
              {auth.user.role === 'admin' && (
                <Link href="/admin/users" className="underline">
                  Users
                </Link>
              )}
              <button type="button" onClick={handleLogout} className="underline">
                Log out
              </button>
            </>
          )}
          {auth.status === 'unauthenticated' && (
            <>
              <Link href="/login" className="underline">
                Log in
              </Link>
              <Link href="/register" className="underline">
                Register
              </Link>
            </>
          )}
        </nav>
      )}
    </Header>
  );
}
