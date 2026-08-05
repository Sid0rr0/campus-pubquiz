import Link from 'next/link';
import { NavigationButtons } from '@/app/admin/navigation-buttons';
import { AdminActions } from '@/app/admin/admin-actions';
import { TeamsPanel } from '@/app/admin/teams-panel';
import type { AdminSidebarProps } from '@/app/admin/admin-sidebar-props';

interface DesktopSidebarProps extends AdminSidebarProps {
  roundIndex: number;
  questionIndex: number;
}

/** Always-visible quiz master panel — desktop only (the mobile drawer covers the same actions via MobileAdminBar). */
export function DesktopSidebar({
  progressStatus,
  roundIndex,
  questionIndex,
  joinCode,
  activeQuizTitle,
  connectionError,
  canStartQuiz,
  canGoToPreviousQuestion,
  canAdvance,
  canEndQuiz,
  isLeaderboardVisible,
  leaderboardRevealCount,
  leaderboardTeamCount,
  onAction,
  teams,
  showAnswerStatus,
  answeredTeamIds,
  onKickTeam,
  onAwardBonus,
}: DesktopSidebarProps) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-5 bg-foreground p-5 text-background md:flex">
      <h1 className="font-display text-lg">Quiz Master</h1>
      <span>
        Display: R{roundIndex + 1}Q{questionIndex + 1}
      </span>
      {connectionError && (
        <p role="alert" className="font-extrabold text-magenta">
          {connectionError}
        </p>
      )}
      {activeQuizTitle && <p className="text-sm font-bold">Quiz: {activeQuizTitle}</p>}
      <p className="text-sm font-bold">
        Status: {progressStatus} ({joinCode})
      </p>
      <div className="flex gap-3 text-xs font-extrabold underline">
        <Link href={`/display?code=${joinCode}`} target="_blank" rel="noopener noreferrer">
          Open display
        </Link>
        <Link href="/admin">Switch session</Link>
      </div>
      <div className="flex flex-col gap-2">
        <NavigationButtons
          progressStatus={progressStatus}
          canGoToPreviousQuestion={canGoToPreviousQuestion}
          canAdvance={canAdvance}
          isLeaderboardVisible={isLeaderboardVisible}
          leaderboardRevealCount={leaderboardRevealCount}
          leaderboardTeamCount={leaderboardTeamCount}
          onAction={onAction}
        />
        <AdminActions
          canStartQuiz={canStartQuiz}
          canEndQuiz={canEndQuiz}
          isLeaderboardVisible={isLeaderboardVisible}
          onAction={onAction}
        />
      </div>
      <TeamsPanel
        teams={teams}
        showAnswerStatus={showAnswerStatus}
        answeredTeamIds={answeredTeamIds}
        onKickTeam={onKickTeam}
        onAwardBonus={onAwardBonus}
        className="mt-auto border-t border-background/20 pt-4"
      />
    </aside>
  );
}
