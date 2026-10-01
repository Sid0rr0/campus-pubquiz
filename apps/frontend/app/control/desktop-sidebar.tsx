import { NavigationButtons } from '@/app/control/navigation-buttons';
import { AdminActions } from '@/app/control/admin-actions';
import { BreakEndTimeControl } from '@/app/control/break-end-time-control';
import { DisplayTextScaleControl } from '@/app/control/display-text-scale-control';
import { EditQuizLink } from '@/app/control/edit-quiz-link';
import { ShowdownPanel } from '@/app/control/showdown-panel';
import { TeamsPanel } from '@/app/control/teams-panel';
import { SessionStatusPanel } from '@/app/control/session-status-panel';
import type { ControlPanel } from '@/app/control/control-panel';

/** Always-visible quiz master panel — desktop only (the mobile drawer covers the same actions via MobileAdminBar). */
export function DesktopSidebar({ panel }: { panel: ControlPanel }) {
  const { view, quiz, connectionError, controls, actions } = panel;
  const { progress } = view;
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto bg-foreground p-5 text-background md:sticky md:top-(--site-header-height) md:flex md:h-[calc(100vh-var(--site-header-height))]">
      <h1 className="font-display text-lg">Quiz Master</h1>
      <SessionStatusPanel
        progressStatus={progress.status}
        roundIndex={progress.roundIndex}
        questionIndex={progress.questionIndex}
        joinCode={view.joinCode}
        activeQuizTitle={quiz.title}
        connectionError={connectionError}
      />
      <div className="flex flex-col gap-2">
        <NavigationButtons
          progressStatus={progress.status}
          advanceStep={view.advanceStep}
          previousState={view.previousState}
          onAction={actions.sendAction}
        />
        <AdminActions
          canStartQuiz={controls.canStartQuiz}
          canEndQuiz={controls.canEndQuiz}
          canCloseSession={controls.canCloseSession}
          isLeaderboardVisible={progress.isLeaderboardVisible}
          isMediaFullscreen={progress.isMediaFullscreen ?? false}
          canReplayMedia={controls.canReplayMedia}
          onAction={actions.sendAction}
          onCloseSession={actions.closeSession}
        />
        <BreakEndTimeControl
          progressStatus={progress.status}
          breakEndsAt={view.breakEndsAt}
          onSetBreakEndTime={actions.setBreakEndTime}
          isLastQuestionBeforeBreak={view.isLastQuestionBeforeBreak}
        />
        <DisplayTextScaleControl
          displayTextScale={view.displayTextScale}
          onSetDisplayTextScale={actions.setDisplayTextScale}
        />
        <EditQuizLink quizId={quiz.id} />
        <ShowdownPanel
          isEligible={view.isShowdownEligible}
          activeShowdown={view.activeShowdown}
          tiedTeamNames={controls.tiedTeamNames}
          onCreateShowdownRound={actions.createShowdownRound}
        />
      </div>
      <TeamsPanel
        teams={view.teams}
        showAnswerStatus={controls.showAnswerStatus}
        answeredTeamIds={view.answeredTeamIds}
        onKickTeam={actions.kickTeam}
        className="mt-auto border-t border-background/20 pt-4"
      />
    </aside>
  );
}
