import type { GameAction, GameStatus, TeamView } from '@campus-pubquiz/types';
import { NavigationButtons } from '@/app/admin/navigation-buttons';
import { AdminActions } from '@/app/admin/admin-actions';
import { TeamsPanel } from '@/app/admin/teams-panel';

interface DesktopSidebarProps {
  progressStatus: GameStatus;
  roundIndex: number;
  questionIndex: number;
  joinCode: string;
  activeQuizTitle: string | null;
  connectionError: string | null;
  canStartQuiz: boolean;
  canGoToPreviousQuestion: boolean;
  canAdvance: boolean;
  canFinishGrading: boolean;
  canEndQuiz: boolean;
  isLeaderboardVisible: boolean;
  leaderboardRevealCount: number;
  leaderboardTeamCount: number;
  onAction: (action: GameAction) => void;
  teams: TeamView[];
  showAnswerStatus: boolean;
  answeredTeamIds: number[];
  onKickTeam: (teamId: number) => void;
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
  canFinishGrading,
  canEndQuiz,
  isLeaderboardVisible,
  leaderboardRevealCount,
  leaderboardTeamCount,
  onAction,
  teams,
  showAnswerStatus,
  answeredTeamIds,
  onKickTeam,
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
          canFinishGrading={canFinishGrading}
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
        className="mt-auto border-t border-background/20 pt-4"
      />
    </aside>
  );
}
