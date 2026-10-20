import Link from 'next/link';
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

/** The public league table link: in the nav for everyone, so a signed-in user gets it from AccountMenuLinks and everyone else from here. */
export function LeagueLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/league"
      onClick={onClick}
      className="flex items-center gap-1 underline"
    >
      <StarFilledIcon aria-hidden="true" />
      League
    </Link>
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
      <span className="text-magenta">{user.username}</span>
      <Link href="/guide" className="flex items-center gap-1 underline">
        <QuestionMarkCircledIcon aria-hidden="true" />
        Guide
      </Link>
      <Link href="/sessions" className="flex items-center gap-1 underline">
        <ListBulletIcon aria-hidden="true" />
        Sessions
      </Link>

      <Link href="/teams" className="flex items-center gap-1 underline">
        <PersonIcon aria-hidden="true" />
        Teams
      </Link>

      <Link href="/stats" className="flex items-center gap-1 underline">
        <BarChartIcon aria-hidden="true" />
        Stats
      </Link>

      <LeagueLink />

      {user.role === 'admin' && (
        <Link href="/leagues" className="flex items-center gap-1 underline">
          <StarIcon aria-hidden="true" />
          Manage leagues
        </Link>
      )}
      {user.role === 'admin' && (
        <Link href="/users" className="flex items-center gap-1 underline">
          <GearIcon aria-hidden="true" />
          Users
        </Link>
      )}
      <Button
        type="button"
        onClick={onLogout}
        className="flex items-center gap-1 underline"
      >
        <ExitIcon aria-hidden="true" />
        Log out
      </Button>
    </>
  );
}
