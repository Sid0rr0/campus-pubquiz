import {
  getTiedForFirst,
  isJoinOverlayAllowedStatus,
  isQuestionOnAirStatus,
  type AdminStatePayload,
} from '@campus-pubquiz/types';
import {
  isPausableMediaUrl,
  isVideoMediaUrl,
} from '@/app/display/question-display';

export interface AdminControls {
  canStartQuiz: boolean;
  canEndQuiz: boolean;
  canCloseSession: boolean;
  canToggleJoinOverlay: boolean;
  canReplayMedia: boolean;
  canPauseMedia: boolean;
  showAnswerStatus: boolean;
  tiedTeamNames: string[];
}

type AdminControlsView = Pick<
  AdminStatePayload,
  'progress' | 'currentQuestion' | 'leaderboard'
>;

/**
 * The quiz master's presentational "can I / should I show" controls, derived
 * from the admin view alone so /control and /remote can't drift apart.
 */
export function getAdminControls(view: AdminControlsView): AdminControls {
  const { status } = view.progress;
  const leaderboard = view.leaderboard ?? [];
  return {
    canStartQuiz: status === 'lobby',
    canEndQuiz: status !== 'ended',
    canCloseSession: status === 'ended',
    // Not in the lobby (it already shows the QR code) or once the quiz has ended.
    canToggleJoinOverlay: isJoinOverlayAllowedStatus(status),
    // currentQuestion (and with it its own media) is only populated while a
    // question is actually open on /display — see getCurrentQuestion.
    canReplayMedia:
      status === 'question_open' &&
      isVideoMediaUrl(view.currentQuestion?.mediaUrl),
    canPauseMedia:
      status === 'question_open' &&
      isPausableMediaUrl(view.currentQuestion?.mediaUrl),
    showAnswerStatus: isQuestionOnAirStatus(status),
    tiedTeamNames: getTiedForFirst(leaderboard).map((entry) => entry.teamName),
  };
}
