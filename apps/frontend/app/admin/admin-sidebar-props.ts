import type { GameAction, GameStatus, TeamView } from '@campus-pubquiz/types';

/** Shared by DesktopSidebar and MobileAdminBar — the two panels present the same quiz-master info and actions in different layouts. */
export interface AdminSidebarProps {
  progressStatus: GameStatus;
  roundIndex: number;
  questionIndex: number;
  joinCode: string;
  activeQuizTitle: string | null;
  connectionError: string | null;
  canStartQuiz: boolean;
  canGoToPreviousQuestion: boolean;
  canAdvance: boolean;
  canEndQuiz: boolean;
  canCloseSession: boolean;
  isLeaderboardVisible: boolean;
  leaderboardRevealCount: number;
  leaderboardTeamCount: number;
  onAction: (action: GameAction) => void;
  onCloseSession: () => void;
  teams: TeamView[];
  showAnswerStatus: boolean;
  answeredTeamIds: number[];
  onKickTeam: (teamId: number) => void;
}
