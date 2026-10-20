import {
  getTiedForFirst,
  isJoinOverlayAllowedStatus,
  isQuestionOnAirStatus,
  isVideoUrl,
  type AdminStatePayload,
} from '@campus-pubquiz/types';
import { isPausableMediaUrl } from '@/app/display/question-display';

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
  | 'progress'
  | 'currentQuestion'
  | 'leaderboard'
  | 'onAirScreen'
  | 'revealQuestions'
>;

/**
 * The media /display is playing right now, if any: the open question's own
 * media, or at reveal the media the reveal shows (the answer media, which
 * replaces the question's own, else the question's own). A closest-guess
 * reveal is left out: its answer media arrives mid-walk and the admin view
 * doesn't carry the walk's step.
 */
function getPlayingMediaUrl(view: AdminControlsView): string | undefined {
  const { status } = view.progress;
  if (status === 'question_open') {
    return view.currentQuestion?.mediaUrl;
  }
  const { onAirScreen } = view;
  if (status !== 'reveal' || onAirScreen.kind !== 'reveal') {
    return undefined;
  }
  const question = view.revealQuestions.find(
    ({ id }) => id === onAirScreen.questionId,
  );
  if (question?.revealKind !== 'answer') {
    return undefined;
  }
  return question.answerMediaUrl ?? question.mediaUrl;
}

/**
 * The quiz master's presentational "can I / should I show" controls, derived
 * from the admin view alone so /control and /remote can't drift apart.
 */
export function getAdminControls(view: AdminControlsView): AdminControls {
  const { status } = view.progress;
  const leaderboard = view.leaderboard ?? [];
  const playingMediaUrl = getPlayingMediaUrl(view);
  return {
    canStartQuiz: status === 'lobby',
    canEndQuiz: status !== 'ended',
    canCloseSession: status === 'ended',
    // Not in the lobby (it already shows the QR code) or once the quiz has ended.
    canToggleJoinOverlay: isJoinOverlayAllowedStatus(status),
    canReplayMedia: isVideoUrl(playingMediaUrl),
    canPauseMedia: isPausableMediaUrl(playingMediaUrl),
    showAnswerStatus: isQuestionOnAirStatus(status),
    tiedTeamNames: getTiedForFirst(leaderboard).map((entry) => entry.teamName),
  };
}
