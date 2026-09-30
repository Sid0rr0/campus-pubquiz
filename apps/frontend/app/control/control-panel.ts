import type { AdminStatePayload } from '@campus-pubquiz/types';
import type { UseAdminGameResult } from '@/app/lib/use-admin-game';
import type { AdminControls } from '@/app/control/admin-controls';

/** The slice of the admin view the sidebars show, passed through unchanged. */
export type ControlPanelView = Pick<
  AdminStatePayload,
  | 'progress'
  | 'joinCode'
  | 'teams'
  | 'answeredTeamIds'
  | 'breakEndsAt'
  | 'displayTextScale'
  | 'activeShowdown'
  | 'leaderboardRevealCount'
  | 'canAdvance'
  | 'canGoToPreviousQuestion'
  | 'isShowdownEligible'
  | 'isLastQuestionBeforeBreak'
>;

/** The admin game hook's actions with their own (acknowledgement-returning) signatures, plus closing the session over REST. */
export type ControlPanelActions = Pick<
  UseAdminGameResult,
  | 'sendAction'
  | 'kickTeam'
  | 'setBreakEndTime'
  | 'setDisplayTextScale'
  | 'createShowdownRound'
> & { closeSession: () => void };

/** Everything DesktopSidebar and MobileAdminBar show — the two present the same quiz-master info and actions in different layouts. */
export interface ControlPanel {
  view: ControlPanelView;
  /** From the REST quiz list, not the socket. */
  quiz: { id: number | null; title: string | null };
  connectionError: string | null;
  controls: AdminControls;
  actions: ControlPanelActions;
}
