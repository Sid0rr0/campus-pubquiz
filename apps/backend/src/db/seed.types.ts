import type {
  RevealQuestionView,
  SessionSettings,
} from '@campus-pubquiz/types';

export interface SeededRound {
  id: number;
  title: string;
  breakAfter: boolean;
  // Carries the correct answer internally so reveal can show it; only
  // GameStateService's answer-free QuestionView projections leave the process.
  questions: RevealQuestionView[];
  // Host-only notes, keyed by question id — deliberately a sibling of
  // `questions` rather than a field on each question object. Every
  // RevealQuestionView flows through toRevealQuestionViews' blind `{...question}`
  // spread into the broadcast snapshot; notes must never ride along. Optional
  // (like GameProgress.isMediaFullscreen) so the many existing SeededRound
  // literals across the test suite don't all need updating; undefined
  // behaves as "no notes for any question in this round".
  questionNotesById?: Record<number, string | null>;
}

export interface SeededGame {
  quizId: number;
  gameSessionId: number;
  joinCode: string;
  rounds: SeededRound[];
  settings: SessionSettings;
}

export interface CreatedGameSession {
  gameSessionId: number;
  joinCode: string;
}
