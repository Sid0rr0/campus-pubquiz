import type { GameAction, GameStatus, TeamView } from '@campus-pubquiz/types';

/** Shared by DesktopSidebar and MobileAdminBar — the two panels present the same quiz-master actions in different layouts. */
export interface AdminSidebarProps {
  progressStatus: GameStatus;
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
