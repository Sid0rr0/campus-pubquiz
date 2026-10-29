'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { usePlayerMenu } from '@/app/lib/player-menu-context';
import { Header } from '@/app/components/header';
import {
  AccountMenuLinks,
  LeagueLink,
  MyTeamLink,
} from '@/app/components/account-menu-links';
import { MobileHeaderMenu } from '@/app/components/mobile-header-menu';

/**
 * Shared top bar rendered once from the root layout — same "🍺 Trivia Night"
 * branding as display's TriviaHeader. Signed-in admins/moderators get
 * Guide/Sessions/Teams/Log out links on every page (Users is admin-only),
 * inline on wide screens or behind a hamburger drawer below xl (md when
 * signed out, whose nav is just two links); /play publishes
 * its team's code/Log out into the same drawer via PlayerMenuProvider, since
 * useTeamLink lives route-locally on that page and has no other way to reach
 * this layout-level component. Everyone, signed in or not, gets the public
 * League link (inline, and in the drawer); signed-out visitors get nothing
 * else (no header-driven login entry point — /login and /register are
 * reached directly).
 *
 * Suppressed entirely on /display: that screen is audience-facing (no auth
 * nav belongs on the big screen) and already has its own per-status header
 * (TriviaHeader, with the round/question badge) for the screens that want
 * one — merging the two isn't simple since the round/question data lives in
 * DisplayPage's socket state, not anything the root layout has access to.
 *
 * Also hidden below md on /control itself: that page's own mobile drawer
 * (MobileAdminBar) already surfaces the same AccountMenuLinks, so a second
 * copy pinned above it would just eat screen space on a phone.
 */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname.startsWith('/display')) {
    return null;
  }
  return <SiteHeaderContent isHiddenOnMobile={pathname === '/control'} />;
}

function SiteHeaderContent({
  isHiddenOnMobile,
}: {
  isHiddenOnMobile: boolean;
}) {
  const auth = useAuth();
  const router = useRouter();
  const playerMenu = usePlayerMenu();
  const accountUser =
    auth.status === 'authenticated' && auth.user ? auth.user : null;

  function handleLogout(): void {
    auth.logout();
    router.push('/');
  }

  return (
    <Header isHiddenOnMobile={isHiddenOnMobile}>
      {/* The full staff nav needs ~1200px, so signed-in users keep the drawer up to xl. */}
      <nav
        className={`site-nav hidden items-center gap-1 text-sm tracking-wide ${accountUser ? 'xl:flex' : 'md:flex'}`}
      >
        {accountUser ? (
          <AccountMenuLinks user={accountUser} onLogout={handleLogout} />
        ) : (
          <>
            <LeagueLink />
            <MyTeamLink />
          </>
        )}
      </nav>
      <div className={accountUser ? 'xl:hidden' : 'md:hidden'}>
        <MobileHeaderMenu
          accountUser={accountUser}
          onAccountLogout={handleLogout}
          playerMenu={playerMenu}
        />
      </div>
    </Header>
  );
}
