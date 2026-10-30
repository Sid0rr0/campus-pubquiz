'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChartIcon,
  ExitIcon,
  GearIcon,
  ListBulletIcon,
  PersonIcon,
  QuestionMarkCircledIcon,
  StarFilledIcon,
  StarIcon,
} from '@radix-ui/react-icons';
import type { AuthUser } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

/** One nav entry, marked `aria-current` on its own route (and below it); `.nav-item` in globals.css styles it per container (`.site-nav` or `.drawer-nav`). */
function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const isCurrent = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      className="nav-item"
    >
      {children}
    </Link>
  );
}

/** The public league table link: in the nav for everyone, so a signed-in user gets it from AccountMenuLinks and everyone else from here. */
export function LeagueLink() {
  return (
    <NavLink href="/league">
      <StarFilledIcon aria-hidden="true" />
      League
    </NavLink>
  );
}

/** The public team page link: in the nav for everyone, beside League; the page asks for the team code when this device has none saved. */
export function MyTeamLink() {
  return (
    <NavLink href="/team">
      <PersonIcon aria-hidden="true" />
      My Team
    </NavLink>
  );
}

/** The public how-to-play link: signed-out nav only, since staff have the Guide and their nav is full. */
export function HowToPlayLink() {
  return (
    <NavLink href="/how-to-play">
      <QuestionMarkCircledIcon aria-hidden="true" />
      How to play
    </NavLink>
  );
}

interface AccountMenuLinksProps {
  user: AuthUser;
  onLogout: () => void;
}

/** Username, the moderator Guide link, Sessions/Teams/Stats links (admin and moderator), the admin-only Leagues and Users links, and Log out — shared by the site header nav (desktop) and the mobile admin drawer (where the site header is hidden). Renders flat so each caller controls its own layout/sizing wrapper. */
export function AccountMenuLinks({ user, onLogout }: AccountMenuLinksProps) {
  return (
    <>
      <span className="nav-user">{user.username}</span>
      <NavLink href="/guide">
        <QuestionMarkCircledIcon aria-hidden="true" />
        Guide
      </NavLink>
      <NavLink href="/sessions">
        <ListBulletIcon aria-hidden="true" />
        Sessions
      </NavLink>

      <NavLink href="/teams">
        <PersonIcon aria-hidden="true" />
        Teams
      </NavLink>

      <NavLink href="/stats">
        <BarChartIcon aria-hidden="true" />
        Stats
      </NavLink>

      <LeagueLink />

      <MyTeamLink />

      {user.role === 'admin' && (
        <NavLink href="/leagues">
          <StarIcon aria-hidden="true" />
          Manage leagues
        </NavLink>
      )}
      {user.role === 'admin' && (
        <NavLink href="/users">
          <GearIcon aria-hidden="true" />
          Users
        </NavLink>
      )}
      <Button type="button" onClick={onLogout} className="nav-item nav-logout">
        <ExitIcon aria-hidden="true" />
        Log out
      </Button>
    </>
  );
}
