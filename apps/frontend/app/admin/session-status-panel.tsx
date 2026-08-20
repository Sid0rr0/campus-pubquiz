import Link from 'next/link';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import type { GameStatus } from '@campus-pubquiz/types';
import { CopyButton } from '@/app/components/copy-button';

interface SessionStatusPanelProps {
  progressStatus: GameStatus;
  roundIndex: number;
  questionIndex: number;
  joinCode: string;
  activeQuizTitle: string | null;
  connectionError: string | null;
}

/** round_intro/break_round_intro/reveal_intro show a round's title card instead of a question; break_intro/break show a break card — R/Q there is the last question the round played, not what's actually on screen. */
function getDisplayCardMarker(progressStatus: GameStatus): 'T' | 'B' | null {
  switch (progressStatus) {
    case 'round_intro':
    case 'break_round_intro':
    case 'reveal_intro':
      return 'T';
    case 'break_intro':
    case 'break':
      return 'B';
    default:
      return null;
  }
}

/** Connection error, quiz title/join code, live status, and display position — shared by DesktopSidebar and MobileAdminBar. */
export function SessionStatusPanel({
  progressStatus,
  roundIndex,
  questionIndex,
  joinCode,
  activeQuizTitle,
  connectionError,
}: SessionStatusPanelProps) {
  const displayCardMarker = getDisplayCardMarker(progressStatus);
  return (
    <div className="flex flex-col gap-2">
      {connectionError && (
        <p role="alert" className="font-extrabold text-magenta">
          {connectionError}
        </p>
      )}
      {activeQuizTitle && (
        <p className="text-sm font-bold">
          Quiz: {activeQuizTitle}{' '}
          <span className="inline-flex items-center gap-1 text-magenta">
            {joinCode} {joinCode && <CopyButton value={joinCode} />}
          </span>
        </p>
      )}
      <p className="text-sm font-bold">Status: {progressStatus}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Display: R{roundIndex + 1}Q{questionIndex + 1}
          {displayCardMarker && (
            <span
              title={
                displayCardMarker === 'T'
                  ? 'Showing a round title card'
                  : 'Showing a break card'
              }
              className="text-magenta"
            >
              {' '}
              ({displayCardMarker})
            </span>
          )}
        </span>
        <Link
          href={`/display?code=${joinCode}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-extrabold underline"
        >
          <ExternalLinkIcon aria-hidden="true" />
          Open display
        </Link>
      </div>
    </div>
  );
}
