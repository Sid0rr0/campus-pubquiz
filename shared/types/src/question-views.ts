import type { Margin } from './margin';
import type { QuestionType } from './question-types';

/**
 * Match only: how Scoring's scoreSubmission scores a submitted pairing.
 * `partial` (the default) splits `points` evenly across correctly paired
 * items, rounded (see scoring.ts). `all_or_nothing` instead
 * awards full points when every pair is correct, half points (rounded) when
 * exactly one pair is wrong, and zero otherwise.
 */
export type MatchScoringMode = 'partial' | 'all_or_nothing';

export interface QuestionView {
  id: number;
  type: QuestionType;
  prompt: string;
  /**
   * Multiple choice: the choices. Sort: the items, in the order shown to
   * players (not necessarily correct — see SeededQuestion.answer for
   * that). Match: the left-hand items, paired positionally with `answer` at
   * reveal (left[i] pairs with answer.split('|')[i]).
   */
  options?: string[];
  /** Match only: the right-hand items, in the order shown to players. */
  matchTargets?: string[];
  /** Match only: unset is resolved by the Answer key (answer-key.ts); readers go through it. */
  matchScoringMode?: MatchScoringMode;
  /** Number only: unset is resolved by the Answer key (answer-key.ts); readers go through it. */
  margin?: Margin;
  mediaUrl?: string;
  /** Clip range (seconds) into a YouTube mediaUrl — derived from the question's notes, ignored for non-YouTube media. */
  mediaStartSeconds?: number;
  mediaEndSeconds?: number;
  points: number;
}

/** A question as stored in the seeded game: the view plus its correct answer. Not a reveal view — it carries no reveal kind and no closest-guess stats. */
export interface SeededQuestion extends QuestionView {
  answer: string;
  /** Shown alongside the answer during reveal only — never sent before the question is revealed. */
  answerMediaUrl?: string;
}

/** How the screens reveal a revealed question; decided once by the Screen projection from the question type registry. */
export type RevealKind = 'answer' | 'closest_guess' | 'closest_guess_pending';

/**
 * closest_guess only — numeric-guess stats for the cumulative reveal sequence.
 * Present only on the closest_guess and closest_guess_pending reveal kinds.
 */
export interface ClosestGuessRevealData {
  /** False when zero teams submitted a guess — reveal collapses to the correct-answer step only. */
  hasSubmissions: boolean;
  /** Smallest submitted guess (step 1), as a string — undefined when !hasSubmissions. */
  minGuess?: string;
  /** Highest submitted guess (step 2) — undefined when !hasSubmissions. */
  maxGuess?: string;
  /**
   * Team(s) tied for closest (step 4), each with their OWN guessed value —
   * ties can be asymmetric (e.g. correct=100, guesses of 90 and 110 are
   * equally close but not equal), so this is not a single shared value.
   * Empty when !hasSubmissions.
   */
  closestGuesses: { teamName: string; value: string }[];
}

/** Where a question sits in the quiz, for headers on the block/reveal/break screens. */
export interface QuestionPosition {
  /** 1-based position of this question's round within the quiz. */
  roundNumber: number;
  /** 1-based position of this question within its round. */
  questionNumberInRound: number;
}

/** Title of the round a block/reveal question belongs to — a block can span multiple rounds, so this is carried per-question rather than once per snapshot. */
export interface QuestionRoundTitle {
  roundTitle: string;
}

export type BlockQuestionView = QuestionView &
  QuestionPosition &
  QuestionRoundTitle;
type BlockPlacement = QuestionPosition & QuestionRoundTitle;

/** The `answer` reveal kind: the question with its correct answer, laid out by its answer kind. No closest-guess stats. */
export type AnswerRevealView = SeededQuestion &
  BlockPlacement & { revealKind: 'answer' };

/** The `closest_guess` reveal kind: the question with its answer and the step-by-step closest-guess stats ("no submissions" stats when nobody guessed). */
export type ClosestGuessRevealView = SeededQuestion &
  BlockPlacement & {
    revealKind: 'closest_guess';
    closestGuess: ClosestGuessRevealData;
  };

/** What /display and the admin views receive for each revealed question. */
export type BlockRevealQuestionView = AnswerRevealView | ClosestGuessRevealView;

/** The `closest_guess_pending` reveal kind: a closest_guess question the big screen is revealing before its correct-answer step (3) is on air. No `answer` or `answerMediaUrl`; `closestGuess` carries only the stats shown so far. Only the players view sends one. */
export type PendingClosestGuessRevealView = BlockQuestionView & {
  revealKind: 'closest_guess_pending';
  closestGuess: ClosestGuessRevealData;
};

/** What the players view receives for each revealed question. */
export type PlayersRevealQuestionView =
  | BlockRevealQuestionView
  | PendingClosestGuessRevealView;

/** A not-yet-open question's position and its round's title — enough for a disabled picker slot labeled with the round it belongs to. */
export type UpcomingQuestionPosition = QuestionPosition & QuestionRoundTitle;
