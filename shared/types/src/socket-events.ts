import type { GameAction, GameProgress } from './game-state';

export const SOCKET_EVENTS = {
  // server -> client
  STATE_SYNC: 'game:state_sync',
  STATE_UPDATED: 'game:state_updated',
  ANSWER_RECEIVED: 'game:answer_received',
  // client -> server
  ADMIN_ACTION: 'game:admin_action',
  SUBMIT_ANSWER: 'game:submit_answer',
  JOIN_PLAYERS: 'game:join_players',
} as const;

export const SOCKET_ROOMS = {
  DISPLAY: 'display',
  ADMIN: 'admin',
  PLAYERS: 'players',
} as const;

export type QuestionType = 'free_text' | 'multiple_choice' | 'picture' | 'audio';

export interface QuestionView {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  mediaUrl?: string;
  points: number;
}

export interface StateSnapshotPayload {
  progress: GameProgress;
  currentQuestion: QuestionView | null;
}

export interface AdminActionPayload {
  action: GameAction;
}

export interface SubmitAnswerPayload {
  questionId: string;
  teamId: string;
  value: string;
}

export interface AnswerReceivedPayload {
  questionId: string;
  teamId: string;
  teamName: string;
  value: string;
}

export interface JoinPlayersPayload {
  teamName: string;
  teamToken?: string;
}
