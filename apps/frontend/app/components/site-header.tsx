'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { Header } from '@/app/components/header';
import { AccountMenuLinks } from '@/app/components/account-menu-links';

/**
 * Shared top bar rendered once from the root layout — same "🍺 Trivia Night"
 * branding as display's TriviaHeader. Signed-in admins get Sessions/Users/Log
 * out links on every page; signed-out visitors and non-admin moderators see
 * no nav at all (no header-driven login entry point — /login and /register
 * are reached directly).
 *
 * Suppressed entirely on /display: that screen is audience-facing (no auth
 * nav belongs on the big screen) and already has its own per-status header
 * (TriviaHeader, with the round/question badge) for the screens that want
 * one — merging the two isn't simple since the round/question data lives in
 * DisplayPage's socket state, not anything the root layout has access to.
 *
 * Also hidden below md on /admin itself: that page's own mobile drawer
 * (MobileAdminBar) already surfaces the same AccountMenuLinks, so a second
 * copy pinned above it would just eat screen space on a phone.
 */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname.startsWith('/display')) {
    return null;
  }
  return <SiteHeaderContent isHiddenOnMobile={pathname === '/admin'} />;
}

function SiteHeaderContent({
  isHiddenOnMobile,
}: {
  isHiddenOnMobile: boolean;
}) {
  const auth = useAuth();
  const router = useRouter();

  function handleLogout(): void {
    auth.logout();
    router.push('/');
  }

  return (
    <Header isHiddenOnMobile={isHiddenOnMobile}>
      <nav className="flex items-center gap-4 text-sm font-extrabold tracking-wide">
        {auth.status === 'authenticated' && auth.user && (
          <AccountMenuLinks user={auth.user} onLogout={handleLogout} />
        )}
      </nav>
    </Header>
  );
}
