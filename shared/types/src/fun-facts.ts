import { getLastPastBlockIds, getPastBlockIds } from './block-in-play';
import { BONUS_CATEGORIES, type BonusCategory } from './bonus';
import { formatAnswer, type Verdict } from './answer-kind';
import { answerCredit } from './question-correct-rate';
import { QUESTION_KINDS } from './question-kind';
import { compareTeamNames } from './ranking-rule';
import type { SessionState } from './session-state';

/** One submitted answer, as far as fun facts need it. */
export interface FunFactAnswer {
  questionId: number;
  teamId: number;
  teamName: string;
  /** Null while the answer is ungraded. */
  verdict: Verdict | null;
  pointsAwarded: number;
  /** Final submission time minus the question's open time; null when untracked. */
  responseMs: number | null;
}

/** One bonus award, as far as fun facts need it. */
export interface FunFactBonusAward {
  category: BonusCategory;
  points: number;
}

/**
 * The session's stored answers and bonus awards that fun facts are built
 * from. A cache filled with the standings (like verdictTallies), so the
 * display view stays synchronous.
 */
export interface FunFactData {
  answers: FunFactAnswer[];
  bonusAwards: FunFactBonusAward[];
}

/** The question a fun fact is about, as the big screen words it ("Round 2 · Q3"). */
export interface FunFactQuestion {
  questionId: number;
  roundNumber: number;
  questionNumberInRound: number;
  prompt: string;
  /**
   * The current answer key's correct answer, as people read it. Rounds can
   * repeat one prompt over different media, so the prompt alone may not say
   * which question this is.
   */
  answer: string;
}

/** How many positive bonus awards a category has received. */
export interface FunFactBonusCount {
  category: BonusCategory;
  count: number;
}

/**
 * A line of trivia about the session so far, as data: /display words it. It
 * is drawn only from revealed blocks or from figures that give no answer
 * away, never from the block in play.
 */
export type FunFact =
  | {
      kind: 'fastest_correct_answer';
      teamName: string;
      responseMs: number;
      question: FunFactQuestion;
    }
  | {
      kind: 'toughest_question';
      /** Share of the teams that got it right, 0-1 (partial credit counts by points). */
      correctRate: number;
      question: FunFactQuestion;
    }
  | {
      kind: 'room_split';
      /** Share of the teams that got it right, 0-1. */
      correctRate: number;
      question: FunFactQuestion;
    }
  | { kind: 'nobody_got_it'; question: FunFactQuestion }
  | { kind: 'clean_sweep'; teamNames: string[] }
  | { kind: 'bonus_awards_so_far'; counts: FunFactBonusCount[] };

const HALF = 0.5;

interface RevealedQuestion extends FunFactQuestion {
  isKahoot: boolean;
  /** A closest guess has one winner by design, so rates say nothing about it. */
  isClosestGuess: boolean;
  points: number;
}

function listQuestions(session: SessionState): RevealedQuestion[] {
  return session.seededGame.rounds.flatMap((round, roundIndex) =>
    round.questions.map((question, questionIndex) => ({
      questionId: question.id,
      roundNumber: roundIndex + 1,
      questionNumberInRound: questionIndex + 1,
      prompt: question.prompt,
      answer: formatAnswer(question.answer, question),
      isKahoot: round.kahootMode ?? false,
      isClosestGuess:
        QUESTION_KINDS[question.type].revealKind === 'closest_guess',
      points: question.points,
    })),
  );
}

/** First element with the smallest score; ties keep the earlier one. */
function pickLowest<T>(
  rows: readonly T[],
  score: (row: T) => number,
): T | null {
  return rows.reduce<T | null>(
    (best, row) => (best === null || score(row) < score(best) ? row : best),
    null,
  );
}

function toFunFactQuestion({
  questionId,
  roundNumber,
  questionNumberInRound,
  prompt,
  answer,
}: RevealedQuestion): FunFactQuestion {
  return { questionId, roundNumber, questionNumberInRound, prompt, answer };
}

function fastestCorrectAnswer(
  revealed: readonly RevealedQuestion[],
  answers: readonly FunFactAnswer[],
): FunFact | null {
  const kahootById = new Map(
    revealed.filter((q) => q.isKahoot).map((q) => [q.questionId, q]),
  );
  const timed = answers.filter(
    (a) =>
      a.verdict === 'correct' &&
      a.responseMs !== null &&
      kahootById.has(a.questionId),
  );
  const fastest = pickLowest(
    [...timed].sort((a, b) => compareTeamNames(a.teamName, b.teamName)),
    (a) => a.responseMs ?? Infinity,
  );
  if (fastest === null || fastest.responseMs === null) return null;
  return {
    kind: 'fastest_correct_answer',
    teamName: fastest.teamName,
    responseMs: fastest.responseMs,
    question: toFunFactQuestion(kahootById.get(fastest.questionId)!),
  };
}

interface QuestionOutcome {
  question: RevealedQuestion;
  correctRate: number;
  correctCount: number;
}

function outcomesOf(
  revealed: readonly RevealedQuestion[],
  answers: readonly FunFactAnswer[],
  teamCount: number,
): QuestionOutcome[] {
  return revealed.flatMap((question) => {
    if (question.isClosestGuess) return [];
    const own = answers.filter((a) => a.questionId === question.questionId);
    // Nobody answered: no data, so nothing to say about it.
    if (own.length === 0) return [];
    const credit = own.reduce(
      (sum, a) => sum + answerCredit(a, question.points),
      0,
    );
    return [
      {
        question,
        correctRate: teamCount > 0 ? credit / teamCount : 0,
        correctCount: own.filter((a) => a.verdict === 'correct').length,
      },
    ];
  });
}

function cleanSweep(
  session: SessionState,
  revealed: readonly RevealedQuestion[],
  answers: readonly FunFactAnswer[],
): FunFact | null {
  // Closest guesses don't count: only the closest team gets one right.
  const closestGuessIds = new Set(
    revealed.filter((q) => q.isClosestGuess).map((q) => q.questionId),
  );
  const blockIds = new Set(
    getLastPastBlockIds(session.seededGame.rounds, session.progress).filter(
      (id) => !closestGuessIds.has(id),
    ),
  );
  if (blockIds.size === 0) return null;
  const teamNames = new Map<number, string>();
  const correctCounts = new Map<number, number>();
  for (const a of answers) {
    if (!blockIds.has(a.questionId) || a.verdict !== 'correct') continue;
    teamNames.set(a.teamId, a.teamName);
    correctCounts.set(a.teamId, (correctCounts.get(a.teamId) ?? 0) + 1);
  }
  const names = [...correctCounts]
    .filter(([, count]) => count === blockIds.size)
    .map(([teamId]) => teamNames.get(teamId)!)
    .sort(compareTeamNames);
  return names.length === 0 ? null : { kind: 'clean_sweep', teamNames: names };
}

function bonusAwardsSoFar(
  data: FunFactData,
): Extract<FunFact, { kind: 'bonus_awards_so_far' }> | null {
  const counts = BONUS_CATEGORIES.map((category) => ({
    category,
    count: data.bonusAwards.filter(
      (award) => award.category === category && award.points > 0,
    ).length,
  })).filter(({ count }) => count > 0);
  return counts.length === 0 ? null : { kind: 'bonus_awards_so_far', counts };
}

/**
 * The fun facts for the break the session is in, in the order they rotate.
 * Pure, and the one place that decides what a fun fact may say: the facts
 * about questions read only blocks before the block in play (whose answers
 * stay hidden until its reveal); "bonus awards so far" is a count that gives
 * nothing away. Closest guess questions are left out of the rate-based facts
 * and the clean sweep. A fact with no data is skipped, so the first break
 * yields only the bonus awards (or nothing).
 */
export function describeFunFacts(session: SessionState): FunFact[] {
  const { answers } = session.funFactData;
  const pastIds = new Set(
    getPastBlockIds(session.seededGame.rounds, session.progress),
  );
  const revealed = listQuestions(session).filter((q) =>
    pastIds.has(q.questionId),
  );
  const revealedAnswers = answers.filter((a) => pastIds.has(a.questionId));
  const teamCount = session.leaderboard.length;
  const outcomes = outcomesOf(revealed, revealedAnswers, teamCount);

  const nobody = outcomes.find(({ correctCount }) => correctCount === 0);
  // A question nobody got right is the nobody-got-it fact's; never show it twice.
  const toughest = pickLowest(
    outcomes.filter(
      (outcome) =>
        outcome !== nobody &&
        outcome.correctRate > 0 &&
        outcome.correctRate < 1,
    ),
    ({ correctRate }) => correctRate,
  );
  const split = pickLowest(
    outcomes.filter(({ correctRate }) => correctRate > 0 && correctRate < 1),
    ({ correctRate }) => Math.abs(correctRate - HALF),
  );

  const facts: (FunFact | null)[] = [
    fastestCorrectAnswer(revealed, revealedAnswers),
    teamCount > 0 && toughest
      ? {
          kind: 'toughest_question',
          correctRate: toughest.correctRate,
          question: toFunFactQuestion(toughest.question),
        }
      : null,
    split
      ? {
          kind: 'room_split',
          correctRate: split.correctRate,
          question: toFunFactQuestion(split.question),
        }
      : null,
    nobody
      ? { kind: 'nobody_got_it', question: toFunFactQuestion(nobody.question) }
      : null,
    cleanSweep(session, revealed, revealedAnswers),
    bonusAwardsSoFar(session.funFactData),
  ];
  return facts.filter((fact): fact is FunFact => fact !== null);
}
