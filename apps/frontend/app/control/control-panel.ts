import type {
  AdminStatePayload,
  ControlAvailability,
} from '@campus-pubquiz/types';
import type { UseAdminGameResult } from '@/app/lib/use-admin-game';

/** The slice of the admin view the sidebars show, passed through unchanged. */
export type ControlPanelView = Pick<
  AdminStatePayload,
  | 'progress'
  | 'joinCode'
  | 'teams'
  | 'settableJokerRounds'
  | 'answeredTeamIds'
  | 'breakEndsAt'
  | 'displayTextScale'
  | 'isDisplaySoundMuted'
  | 'activeShowdown'
  | 'advanceStep'
  | 'previousState'
  | 'isShowdownEligible'
  | 'isLastQuestionBeforeBreak'
>;

/** The admin game hook's actions with their own (acknowledgement-returning) signatures, plus closing the session over REST. */
export type ControlPanelActions = Pick<
  UseAdminGameResult,
  | 'sendAction'
  | 'kickTeam'
  | 'setTeamPlayerCount'
  | 'setTeamJoker'
  | 'setBreakEndTime'
  | 'setDisplayTextScale'
  | 'setDisplaySoundMuted'
  | 'createShowdownRound'
> & { closeSession: () => void };

/** Everything DesktopSidebar and MobileAdminBar show — the two present the same quiz-master info and actions in different layouts. */
export interface ControlPanel {
  view: ControlPanelView;
  /** From the REST quiz list, not the socket. */
  quiz: { id: number | null; title: string | null };
  connectionError: string | null;
  controls: ControlAvailability;
  actions: ControlPanelActions;
}
