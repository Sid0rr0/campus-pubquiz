import { getTiedForFirst, type AdminStatePayload } from '@campus-pubquiz/types';
import { isYoutubeMediaUrl } from '@/app/display/question-display';

export interface AdminControls {
  canStartQuiz: boolean;
  canEndQuiz: boolean;
  canCloseSession: boolean;
  canReplayMedia: boolean;
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
    // currentQuestion (and with it its own media) is only populated while a
    // question is actually open on /display — see getCurrentQuestion.
    canReplayMedia:
      status === 'question_open' &&
      isYoutubeMediaUrl(view.currentQuestion?.mediaUrl),
    showAnswerStatus: status === 'question_open' || status === 'locking',
    tiedTeamNames: getTiedForFirst(leaderboard).map((entry) => entry.teamName),
  };
}
