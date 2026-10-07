/**
 * Admin-typed tiebreaker question for a "showdown" round — created once
 * two or more teams are tied for 1st place at `ended`. Participating teams
 * are never client-supplied: the server derives them from the leaderboard
 * via getTiedForFirst (shared/types/src/leaderboard-tiebreak.ts).
 */
export interface CreateShowdownRoundPayload {
  question: string;
  /** Numeric string, parsed like Question.answer for closest_guess. */
  answer: string;
  points: number;
}

export interface SubmitShowdownGuessPayload {
  showdownRoundId: number;
  teamId: number;
  value: string;
}

/** One participating team's showdown status, in seatIndex (reveal) order. */
export interface ActiveShowdownParticipant {
  teamId: number;
  teamName: string;
  /** Reveal order, 0..N-1 — fixed at round creation from leaderboard order. */
  seatIndex: number;
  /** Always present — status only, no value (mirrors answeredTeamIds). */
  hasGuessed: boolean;
  /** Present once showdownRevealStep >= seatIndex + 1. */
  guess?: string;
}

/** The in-progress/just-resolved showdown tiebreaker round — see StateSnapshotPayload.activeShowdown. */
export interface ActiveShowdownView {
  id: number;
  question: string;
  participants: ActiveShowdownParticipant[];
  /** Present once showdownRevealStep >= participants.length + 1 (final step). */
  answer?: string;
  /** null when isTie is true, or before the round is resolved. */
  winnerTeamId?: number | null;
  isTie?: boolean;
}
