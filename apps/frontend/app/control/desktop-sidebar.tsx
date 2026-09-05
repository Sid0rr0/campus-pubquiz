import { NavigationButtons } from '@/app/control/navigation-buttons';
import { AdminActions } from '@/app/control/admin-actions';
import { BreakEndTimeControl } from '@/app/control/break-end-time-control';
import { ShowdownPanel } from '@/app/control/showdown-panel';
import { TeamsPanel } from '@/app/control/teams-panel';
import { SessionStatusPanel } from '@/app/control/session-status-panel';
import type { AdminSidebarProps } from '@/app/control/admin-sidebar-props';

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
  canCloseSession,
  isLeaderboardVisible,
  leaderboardRevealCount,
  leaderboardTeamCount,
  onAction,
  onCloseSession,
  teams,
  showAnswerStatus,
  answeredTeamIds,
  onKickTeam,
  breakEndsAt,
  onSetBreakEndTime,
  isLastQuestionBeforeBreak,
  activeShowdown,
  tiedTeamNames,
  isShowdownEligible,
  onCreateShowdownRound,
}: AdminSidebarProps) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto bg-foreground p-5 text-background md:sticky md:top-(--site-header-height) md:flex md:h-[calc(100vh-var(--site-header-height))]">
      <h1 className="font-display text-lg">Quiz Master</h1>
      <SessionStatusPanel
        progressStatus={progressStatus}
        roundIndex={roundIndex}
        questionIndex={questionIndex}
        joinCode={joinCode}
        activeQuizTitle={activeQuizTitle}
        connectionError={connectionError}
      />
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
          canCloseSession={canCloseSession}
          isLeaderboardVisible={isLeaderboardVisible}
          onAction={onAction}
          onCloseSession={onCloseSession}
        />
        <BreakEndTimeControl
          progressStatus={progressStatus}
          breakEndsAt={breakEndsAt}
          onSetBreakEndTime={onSetBreakEndTime}
          isLastQuestionBeforeBreak={isLastQuestionBeforeBreak}
        />
        <ShowdownPanel
          isEligible={isShowdownEligible}
          activeShowdown={activeShowdown}
          tiedTeamNames={tiedTeamNames}
          onCreateShowdownRound={onCreateShowdownRound}
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
