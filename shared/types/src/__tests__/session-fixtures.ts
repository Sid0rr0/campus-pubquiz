import type { GameProgress } from '../game-state';
import type { ClosestGuessRevealData, SeededQuestion } from '../question-views';
import type { LeaderboardEntry } from '../room-views';
import { DEFAULT_SESSION_SETTINGS } from '../session-settings';
import {
  freshSessionState,
  type SeededRound,
  type SessionState,
} from '../session-state';
import { lobby } from './game-state-fixtures';

/** A free_text question, the cheapest one to seed. */
export function freeTextQuestion(id: number): SeededQuestion {
  return {
    id,
    type: 'free_text',
    prompt: `Question ${id}`,
    options: [],
    points: 1,
    answer: `Answer ${id}`,
  } as unknown as SeededQuestion;
}

/** A closest_guess question whose answer is 55. */
export function closestGuessQuestion(id: number): SeededQuestion {
  return {
    ...freeTextQuestion(id),
    type: 'closest_guess',
    answer: '55',
  } as unknown as SeededQuestion;
}

/** A closest_guess reveal summary with submissions, as the settled session stores it. */
export const SUMMARY: ClosestGuessRevealData = {
  hasSubmissions: true,
  minGuess: '10',
  maxGuess: '90',
  closestGuesses: [{ teamName: 'Team A', value: '50' }],
};

/** A round of free_text questions with the given ids. */
export function round(
  id: number,
  questionIds: number[],
  overrides: Partial<SeededRound> = {},
): SeededRound {
  return {
    id,
    title: `Round ${id}`,
    breakAfter: true,
    questions: questionIds.map(freeTextQuestion),
    ...overrides,
  };
}

/** A session over `rounds` at `progress` (lobby defaults, overridable per field). */
export function sessionWith(
  rounds: SeededRound[],
  progress: Partial<GameProgress> = {},
  overrides: Partial<SessionState> = {},
): SessionState {
  return {
    ...freshSessionState(
      {
        quizId: 1,
        gameSessionId: 1,
        joinCode: 'ABCDEF',
        quizTitle: 'Test Quiz',
        customName: null,
        startedAt: new Date('2026-09-16T12:00:00.000Z'),
        rounds,
        settings: DEFAULT_SESSION_SETTINGS,
      },
      { ...lobby, ...progress },
    ),
    ...overrides,
  };
}

/** A leaderboard entry with no bonus or round points; rank and rankTo default to a lone place. */
export function leaderboardEntry(
  teamId: number,
  teamName: string,
  totalPoints: number,
  rank = teamId,
  rankTo = rank,
): LeaderboardEntry {
  return {
    teamId,
    teamName,
    totalPoints,
    rank,
    rankTo,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}
