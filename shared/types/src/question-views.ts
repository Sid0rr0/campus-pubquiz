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
   * players (not necessarily correct — see RevealQuestionView.answer for
   * that). Match: the left-hand items, paired positionally with `answer` at
   * reveal (left[i] pairs with answer.split('|')[i]).
   */
  options?: string[];
  /** Match only: the right-hand items, in the order shown to players. */
  matchTargets?: string[];
  /** Match only: undefined behaves as 'partial'. */
  matchScoringMode?: MatchScoringMode;
  mediaUrl?: string;
  /** Clip range (seconds) into a YouTube mediaUrl — derived from the question's notes, ignored for non-YouTube media. */
  mediaStartSeconds?: number;
  mediaEndSeconds?: number;
  points: number;
}

export interface RevealQuestionView extends QuestionView {
  answer: string;
  /** Shown alongside the answer during reveal only — never sent before the question is revealed. */
  answerMediaUrl?: string;
  /** closest_guess only — undefined for every other type. */
  closestGuess?: ClosestGuessRevealData;
}

/**
 * closest_guess only — numeric-guess stats for the cumulative reveal sequence.
 * Present on RevealQuestionView only when the question's type is
 * 'closest_guess'; undefined for every other type.
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
export type BlockRevealQuestionView = RevealQuestionView &
  QuestionPosition &
  QuestionRoundTitle;

/** A closest_guess question the big screen is revealing step by step, before its correct-answer step (3) is on air: no `answer`, and `closestGuess` carries only the stats shown so far. Only the players view sends one. */
export type PendingClosestGuessRevealView = BlockQuestionView & {
  closestGuess: ClosestGuessRevealData;
};

/** A not-yet-open question's position and its round's title — enough for a disabled picker slot labeled with the round it belongs to. */
export type UpcomingQuestionPosition = QuestionPosition & QuestionRoundTitle;
