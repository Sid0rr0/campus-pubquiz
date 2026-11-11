import type { GameAction } from '@campus-pubquiz/types';
import { AdminActions } from '@/app/control/admin-actions';
import { BreakEndTimeControl } from '@/app/control/break-end-time-control';
import type { ControlPanel } from '@/app/control/control-panel';
import { DisplayTextScaleControl } from '@/app/control/display-text-scale-control';
import { EditQuizLink } from '@/app/control/edit-quiz-link';
import { ShowdownPanel } from '@/app/control/showdown-panel';
import { TeamsPanel } from '@/app/control/teams-panel';

interface PanelControlsProps {
  panel: ControlPanel;
  /** Defaults to sending the action; the mobile drawer also closes itself. */
  onAction?: (action: GameAction) => void;
  /** Defaults to closing the session; the mobile drawer also closes itself. */
  onCloseSession?: () => void;
}

/** The quiz master's action buttons and settings, in the order both the sidebar and the drawer show them. */
export function PanelControls({
  panel,
  onAction,
  onCloseSession,
}: PanelControlsProps) {
  const { view, quiz, controls, actions } = panel;
  const { progress } = view;
  return (
    <>
      <AdminActions
        canStartQuiz={controls.canStartQuiz}
        canEndQuiz={controls.canEndQuiz}
        canCloseSession={controls.canCloseSession}
        canToggleJoinOverlay={controls.canToggleJoinOverlay}
        isLeaderboardVisible={progress.isLeaderboardVisible}
        isJoinOverlayVisible={progress.isJoinOverlayVisible}
        isMediaFullscreen={progress.isMediaFullscreen ?? false}
        canReplayMedia={controls.canReplayMedia}
        canPauseMedia={controls.canPauseMedia}
        isMediaPaused={progress.isMediaPaused ?? false}
        isDisplaySoundMuted={view.isDisplaySoundMuted}
        onSetDisplaySoundMuted={actions.setDisplaySoundMuted}
        onAction={onAction ?? actions.sendAction}
        onCloseSession={onCloseSession ?? actions.closeSession}
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
    </>
  );
}

/** The teams table pinned to the bottom of the sidebar and the drawer. */
export function PanelTeams({ panel }: { panel: ControlPanel }) {
  const { view, controls, actions } = panel;
  return (
    <TeamsPanel
      teams={view.teams}
      showAnswerStatus={controls.showAnswerStatus}
      answeredTeamIds={view.answeredTeamIds}
      onKickTeam={actions.kickTeam}
      onSetPlayerCount={actions.setTeamPlayerCount}
      jokerRounds={view.settableJokerRounds}
      onSetJoker={actions.setTeamJoker}
      onSetSide={actions.setTeamSide}
      isJokerPick={view.progress.status === 'joker_pick'}
      sides={view.settings.versusEnabled ? view.settings.versusSides : []}
      className="mt-auto border-t border-background/20 pt-4"
    />
  );
}
