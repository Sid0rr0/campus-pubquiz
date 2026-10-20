import Link from 'next/link';
import {
  ArrowRightIcon,
  Cross2Icon,
  ExternalLinkIcon,
  EyeOpenIcon,
} from '@radix-ui/react-icons';
import type { ActiveSessionSummary } from '@campus-pubquiz/types';
import { quizPreviewHref } from '@/app/lib/quiz-preview-position';
import { Button } from '@/app/components/button';
import { CopyButton } from '@/app/components/copy-button';

interface RunningSessionsListProps {
  sessions: ActiveSessionSummary[];
  onClose: (joinCode: string) => void;
  onOpenSession: (joinCode: string) => void;
}

/** One row per running session with its Close (ended only), Remote and Control actions, or an empty message when none are running. */
export function RunningSessionsList({
  sessions,
  onClose,
  onOpenSession,
}: RunningSessionsListProps) {
  return (
    <>
      {sessions.length === 0 && (
        <p className="text-sm text-foreground/55">No sessions running yet.</p>
      )}
      <ul className="flex flex-col gap-2">
        {sessions.map((session) => (
          <li
            key={session.joinCode}
            className="flex items-center justify-between gap-3 rounded-xl border border-foreground/15 bg-white px-4 py-3"
          >
            <div className="flex flex-col">
              <span className="font-extrabold">{session.name}</span>
              <span className="flex items-center gap-1 text-xs text-foreground/55">
                {session.status} · {session.teamCount} teams ·{' '}
                {session.joinCode}
                <CopyButton value={session.joinCode} />· Started{' '}
                {new Date(session.startedAt).toLocaleString()}
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              {session.status === 'ended' && (
                <Button
                  type="button"
                  variant="outline-muted"
                  size="md"
                  onClick={() => onClose(session.joinCode)}
                >
                  <Cross2Icon aria-hidden="true" />
                  Close
                </Button>
              )}
              {session.status === 'lobby' && (
                <Link
                  href={quizPreviewHref(session.quizId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-foreground/30 px-4 text-sm font-extrabold"
                >
                  <EyeOpenIcon aria-hidden="true" />
                  Preview
                </Link>
              )}
              <Link
                href={`/remote?code=${session.joinCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-foreground/30 px-4 text-sm font-extrabold"
              >
                <ExternalLinkIcon aria-hidden="true" />
                Remote
              </Link>
              <Button
                type="button"
                variant="solid-flat"
                size="md"
                onClick={() => onOpenSession(session.joinCode)}
              >
                <ArrowRightIcon aria-hidden="true" />
                Control
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
