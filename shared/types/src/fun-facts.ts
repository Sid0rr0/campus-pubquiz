import { getLastPastBlockIds, getPastBlockIds } from './block-in-play';
import { BONUS_CATEGORIES, type BonusCategory } from './bonus';
import { formatAnswer, type Verdict } from './answer-kind';
import { jokerRoundPoints } from './joker';
import type { PowerUpId } from './power-ups';
import { hasMeaningfulCorrectRate } from './question-correct-rate';
import { questionOutcome } from './question-outcome';
import type { QuestionType } from './question-types';
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

/** One power-up purchase, as far as the live views need it: the reveal's power-up count and each team's coins. */
export interface FunFactPowerUp {
  teamId: number;
  powerUp: PowerUpId;
  /** The question it was bought for; null for a round power-up. */
  questionId: number | null;
  cost: number;
}

/**
 * The session's stored answers, bonus awards and power-up purchases that fun
 * facts are built from, and the reveal's teams-correct and power-up counts read
 * it too. A cache filled with the standings, so the display view stays
 * synchronous.
 */
export interface FunFactData {
  answers: FunFactAnswer[];
  bonusAwards: FunFactBonusAward[];
  powerUps: FunFactPowerUp[];
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
  | {
      kind: 'joker_favourite_round';
      roundNumber: number;
      roundTitle: string;
      /** How many teams have this round as their joker. */
      teamCount: number;
    }
  | { kind: 'joker_snubbed_round'; roundNumber: number; roundTitle: string }
  | { kind: 'joker_drawn_count'; teamCount: number }
  | {
      kind: 'best_joker';
      teamName: string;
      roundNumber: number;
      roundTitle: string;
      /** The points the joker added: the team's raw points in the round. */
      extraPoints: number;
    }
  | {
      kind: 'joker_backfired';
      teamName: string;
      roundNumber: number;
      roundTitle: string;
    }
  | { kind: 'bonus_awards_so_far'; counts: FunFactBonusCount[] };

const HALF = 0.5;

interface RevealedQuestion extends FunFactQuestion {
  isKahoot: boolean;
  type: QuestionType;
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
      type: question.type,
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
  const timed = answers.flatMap((a) =>
    a.verdict === 'correct' &&
    a.responseMs !== null &&
    kahootById.has(a.questionId)
      ? [{ ...a, responseMs: a.responseMs }]
      : [],
  );
  const fastest = pickLowest(
    timed.sort((a, b) => compareTeamNames(a.teamName, b.teamName)),
    (a) => a.responseMs,
  );
  if (fastest === null) return null;
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
    // A type with no correct rate (one winner by design) says nothing in rates.
    if (!hasMeaningfulCorrectRate(question.type)) return [];
    const own = answers.filter((a) => a.questionId === question.questionId);
    // Nobody answered: no data, so nothing to say about it.
    if (own.length === 0) return [];
    const outcome = questionOutcome(question, own, teamCount);
    return [
      {
        question,
        // An empty roster has no rate; read it as 0 as before.
        correctRate: outcome.correctRate ?? 0,
        correctCount: outcome.correctCount,
      },
    ];
  });
}

function cleanSweep(
  session: SessionState,
  revealed: readonly RevealedQuestion[],
  answers: readonly FunFactAnswer[],
): FunFact | null {
  // Types with no correct rate don't count: only the closest team gets a
  // closest guess right.
  const noRateIds = new Set(
    revealed
      .filter((q) => !hasMeaningfulCorrectRate(q.type))
      .map((q) => q.questionId),
  );
  const blockIds = new Set(
    getLastPastBlockIds(session.seededGame.rounds, session.progress).filter(
      (id) => !noRateIds.has(id),
    ),
  );
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

interface JokerRound {
  roundId: number;
  roundNumber: number;
  roundTitle: string;
}

/**
 * The joker facts, in order. The first three count jokers only and name no
 * team; the last two name a team and read only joker rounds whose questions
 * are all revealed, so no pick leaks before its leaderboard. Empty when the
 * session plays without jokers.
 */
function jokerFacts(
  session: SessionState,
  answers: readonly FunFactAnswer[],
  pastIds: ReadonlySet<number>,
): (FunFact | null)[] {
  if (!session.seededGame.settings.jokersEnabled) return [];
  const rounds = session.seededGame.rounds.map((round, index) => ({
    roundId: round.id,
    roundNumber: index + 1,
    roundTitle: round.title,
    questionIds: round.questions.map((question) => question.id),
  }));
  const roundById = new Map(rounds.map((round) => [round.roundId, round]));
  // Only teams on the roster (the leaderboard) with a joker on a round that exists.
  const holders = [...session.leaderboard]
    .sort((a, b) => compareTeamNames(a.teamName, b.teamName))
    .flatMap((team) => {
      const joker = session.jokers[team.teamId];
      const round = joker && roundById.get(joker.roundId);
      return joker && round ? [{ team, joker, round }] : [];
    });
  if (holders.length === 0) return [];

  const teamsPerRound = new Map<number, number>();
  for (const { round } of holders) {
    teamsPerRound.set(
      round.roundId,
      (teamsPerRound.get(round.roundId) ?? 0) + 1,
    );
  }
  const toJokerRound = ({
    roundNumber,
    roundTitle,
  }: JokerRound): Pick<JokerRound, 'roundNumber' | 'roundTitle'> => ({
    roundNumber,
    roundTitle,
  });

  const facts: (FunFact | null)[] = [];
  // Rounds are in quiz order, so a tie goes to the earlier round.
  const favourite = pickLowest(
    rounds,
    (r) => -(teamsPerRound.get(r.roundId) ?? 0),
  );
  facts.push(
    favourite && teamsPerRound.has(favourite.roundId)
      ? {
          kind: 'joker_favourite_round',
          roundNumber: favourite.roundNumber,
          roundTitle: favourite.roundTitle,
          teamCount: teamsPerRound.get(favourite.roundId)!,
        }
      : null,
  );
  const snubbed = rounds.find((r) => !teamsPerRound.has(r.roundId));
  facts.push(
    snubbed
      ? {
          kind: 'joker_snubbed_round',
          roundNumber: snubbed.roundNumber,
          roundTitle: snubbed.roundTitle,
        }
      : null,
  );
  const drawn = holders.filter(({ joker }) => joker.source === 'drawn').length;
  facts.push(
    drawn > 0 ? { kind: 'joker_drawn_count', teamCount: drawn } : null,
  );

  const revealedRounds = rounds.filter((r) =>
    r.questionIds.every((id) => pastIds.has(id)),
  );
  const rawPoints = (teamId: number, questionIds: readonly number[]) =>
    answers
      .filter((a) => a.teamId === teamId && questionIds.includes(a.questionId))
      .reduce((sum, a) => sum + a.pointsAwarded, 0);
  const revealedJokers = holders.filter(({ round }) =>
    revealedRounds.includes(round),
  );

  const best = pickLowest(
    revealedJokers.map(({ team, round }) => ({
      team,
      round,
      extra:
        jokerRoundPoints(rawPoints(team.teamId, round.questionIds)) -
        rawPoints(team.teamId, round.questionIds),
    })),
    ({ extra }) => -extra,
  );
  facts.push(
    best && best.extra > 0
      ? {
          kind: 'best_joker',
          teamName: best.team.teamName,
          ...toJokerRound(best.round),
          extraPoints: best.extra,
        }
      : null,
  );

  // Backfired: the joker round, as it counts, scored less than every other revealed round.
  const backfired = revealedJokers.find(({ team, round }) => {
    const others = revealedRounds.filter((r) => r !== round);
    const jokerPoints = jokerRoundPoints(
      rawPoints(team.teamId, round.questionIds),
    );
    return (
      others.length > 0 &&
      others.every(
        (other) => rawPoints(team.teamId, other.questionIds) > jokerPoints,
      )
    );
  });
  facts.push(
    backfired
      ? {
          kind: 'joker_backfired',
          teamName: backfired.team.teamName,
          ...toJokerRound(backfired.round),
        }
      : null,
  );
  return facts;
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
  // Every fact reads answers only through the revealed questions or rounds,
  // so the block in play's answers need no filter of their own.
  const teamCount = session.leaderboard.length;
  const outcomes = outcomesOf(revealed, answers, teamCount);

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
    fastestCorrectAnswer(revealed, answers),
    toughest
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
    cleanSweep(session, revealed, answers),
    ...jokerFacts(session, answers, pastIds),
    bonusAwardsSoFar(session.funFactData),
  ];
  return facts.filter((fact): fact is FunFact => fact !== null);
}
