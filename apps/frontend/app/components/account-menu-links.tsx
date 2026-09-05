import Link from 'next/link';
import {
  ExitIcon,
  GearIcon,
  ListBulletIcon,
  PersonIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons';
import type { AuthUser } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface AccountMenuLinksProps {
  user: AuthUser;
  onLogout: () => void;
}

/** Username, the moderator Guide link, admin-only Sessions/Users/Teams links, and Log out — shared by the site header nav (desktop) and the mobile admin drawer (where the site header is hidden). Renders flat so each caller controls its own layout/sizing wrapper. */
export function AccountMenuLinks({ user, onLogout }: AccountMenuLinksProps) {
  return (
    <>
      <span className="text-magenta">{user.username}</span>
      <Link href="/admin/guide" className="flex items-center gap-1 underline">
        <QuestionMarkCircledIcon aria-hidden="true" />
        Guide
      </Link>
      {user.role === 'admin' && (
        <>
          <Link href="/sessions" className="flex items-center gap-1 underline">
            <ListBulletIcon aria-hidden="true" />
            Sessions
          </Link>

          <Link
            href="/admin/users"
            className="flex items-center gap-1 underline"
          >
            <GearIcon aria-hidden="true" />
            Users
          </Link>

          <Link
            href="/admin/teams"
            className="flex items-center gap-1 underline"
          >
            <PersonIcon aria-hidden="true" />
            Teams
          </Link>
        </>
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
