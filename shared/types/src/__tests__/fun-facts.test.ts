import { describe, expect, it } from 'vitest';
import {
  describeFunFacts,
  type FunFactAnswer,
  type FunFactData,
} from '../fun-facts';
import type { GameProgress } from '../game-state-types';
import type { DisplayStatePayload, LeaderboardEntry } from '../room-views';
import { projectScreen } from '../screen-projection';
import { SOCKET_ROOMS } from '../socket-events';
import {
  freshSessionState,
  type SeededRound,
  type SessionState,
} from '../session-state';
import { DEFAULT_SESSION_SETTINGS } from '../session-settings';

const TEAM_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

interface RoundSpec {
  title: string;
  questionCount: number;
  isKahoot?: boolean;
  /** Ids (as numbered across the rounds) of questions that are closest_guess. */
  closestGuessIds?: number[];
}

/** Question ids run 1, 2, 3… across the rounds; every round ends a block (breakAfter). */
function roundsOf(specs: RoundSpec[]): SeededRound[] {
  let nextId = 1;
  return specs.map((spec, roundIndex) => ({
    id: roundIndex + 1,
    title: spec.title,
    breakAfter: true,
    kahootMode: spec.isKahoot ?? false,
    questions: Array.from({ length: spec.questionCount }, () => {
      const id = nextId++;
      return {
        id,
        type: spec.closestGuessIds?.includes(id)
          ? ('closest_guess' as const)
          : ('free_text' as const),
        prompt: `Question ${id}?`,
        answer: `Answer ${id}`,
        points: 1000,
      };
    }),
  }));
}

function leaderboardOf(names: string[]): LeaderboardEntry[] {
  return names.map((teamName, index) => ({
    teamId: index + 1,
    teamName,
    totalPoints: 0,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
    rank: index + 1,
    rankTo: index + 1,
  }));
}

/** teamIndex is 0-based into TEAM_NAMES. */
function answer(
  questionId: number,
  teamIndex: number,
  verdict: FunFactAnswer['verdict'],
  extra: Partial<FunFactAnswer> = {},
): FunFactAnswer {
  return {
    questionId,
    teamId: teamIndex + 1,
    teamName: TEAM_NAMES[teamIndex],
    verdict,
    pointsAwarded: verdict === 'correct' ? 1000 : 0,
    responseMs: null,
    ...extra,
  };
}

function breakProgress(
  roundIndex: number,
  questionIndex: number,
): GameProgress {
  return {
    status: 'break',
    roundIndex,
    questionIndex,
    isLeaderboardVisible: false,
    isJoinOverlayVisible: false,
    revealIndex: 0,
    furthestOpenIndex: questionIndex,
  };
}

function sessionOf(
  specs: RoundSpec[],
  progress: GameProgress,
  data: Partial<FunFactData>,
): SessionState {
  return {
    ...freshSessionState(
      {
        quizId: 1,
        gameSessionId: 1,
        joinCode: 'ABCDEF',
        rounds: roundsOf(specs),
        settings: DEFAULT_SESSION_SETTINGS,
      },
      progress,
    ),
    leaderboard: leaderboardOf(TEAM_NAMES),
    funFactData: { answers: [], bonusAwards: [], ...data },
  };
}

const THREE_ROUNDS: RoundSpec[] = [
  { title: 'One', questionCount: 2 },
  { title: 'Two', questionCount: 2 },
  { title: 'Three', questionCount: 2 },
];

/** Break after round 2: round 1 (questions 1-2) is revealed, round 2 (questions 3-4) is the block in play. */
const AFTER_ROUND_TWO = breakProgress(1, 1);

function kinds(session: SessionState): string[] {
  return describeFunFacts(session).map((fact) => fact.kind);
}

describe('describeFunFacts', () => {
  it('yields nothing when there is no data at all', () => {
    expect(
      describeFunFacts(sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {})),
    ).toEqual([]);
  });

  describe('fastest correct answer', () => {
    const kahootRounds: RoundSpec[] = [
      { title: 'Warm-up', questionCount: 1 },
      { title: 'Buzzer', questionCount: 2, isKahoot: true },
      { title: 'Finale', questionCount: 1 },
    ];
    // Break after the first kahoot question: question 2 is revealed? No — it is the block in play.
    // Break after the second kahoot question (round 1, question 1): question 2 (kahoot) is revealed.
    const afterSecondKahoot = breakProgress(1, 1);

    it('names the quickest correct kahoot answer with its time and question', () => {
      const session = sessionOf(kahootRounds, afterSecondKahoot, {
        answers: [
          answer(2, 0, 'correct', { responseMs: 4200 }),
          answer(2, 1, 'correct', { responseMs: 2300 }),
          answer(2, 2, 'incorrect', { responseMs: 900 }),
        ],
      });

      expect(describeFunFacts(session)[0]).toEqual({
        kind: 'fastest_correct_answer',
        teamName: 'Bravo',
        responseMs: 2300,
        question: {
          questionId: 2,
          roundNumber: 2,
          questionNumberInRound: 1,
          prompt: 'Question 2?',
          answer: 'Answer 2',
        },
      });
    });

    it('breaks a time tie in the leaderboard name order (capitals before lowercase)', () => {
      const session = sessionOf(kahootRounds, afterSecondKahoot, {
        answers: [
          answer(2, 0, 'correct', { responseMs: 2000, teamName: 'apple' }),
          answer(2, 1, 'correct', { responseMs: 2000, teamName: 'Zed' }),
        ],
      });

      expect(describeFunFacts(session)[0]).toMatchObject({
        kind: 'fastest_correct_answer',
        teamName: 'Zed',
      });
    });

    it('ignores response times on questions that are not kahoot', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [answer(1, 0, 'correct', { responseMs: 1500 })],
      });

      expect(kinds(session)).not.toContain('fastest_correct_answer');
    });

    it('ignores a round that does not say whether it is kahoot', () => {
      const session = sessionOf(kahootRounds, afterSecondKahoot, {
        answers: [answer(1, 0, 'correct', { responseMs: 2000 })],
      });
      delete session.seededGame.rounds[0].kahootMode;

      expect(kinds(session)).not.toContain('fastest_correct_answer');
    });

    it('is skipped when no correct kahoot answer has a time', () => {
      const session = sessionOf(kahootRounds, afterSecondKahoot, {
        answers: [
          answer(2, 0, 'correct', { responseMs: null }),
          answer(2, 1, 'incorrect', { responseMs: 800 }),
        ],
      });

      expect(kinds(session)).not.toContain('fastest_correct_answer');
    });
  });

  describe('toughest question', () => {
    it('picks the revealed question with the lowest correct rate, with its number and text', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [
          answer(1, 0, 'correct'),
          answer(1, 1, 'correct'),
          answer(1, 2, 'correct'),
          answer(1, 3, 'incorrect'),
          answer(2, 0, 'correct'),
          answer(2, 1, 'incorrect'),
          answer(2, 2, 'incorrect'),
          answer(2, 3, 'incorrect'),
        ],
      });

      const toughest = describeFunFacts(session).find(
        (fact) => fact.kind === 'toughest_question',
      );
      expect(toughest).toEqual({
        kind: 'toughest_question',
        correctRate: 0.25,
        question: {
          questionId: 2,
          roundNumber: 1,
          questionNumberInRound: 2,
          prompt: 'Question 2?',
          answer: 'Answer 2',
        },
      });
    });

    it('counts a partial answer as its share of the question points', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [
          answer(1, 0, 'correct'),
          answer(1, 1, 'partial', { pointsAwarded: 500 }),
          answer(1, 2, 'incorrect'),
          answer(1, 3, 'incorrect'),
          answer(2, 0, 'correct'),
          answer(2, 1, 'correct'),
          answer(2, 2, 'correct'),
          answer(2, 3, 'correct'),
        ],
      });

      const toughest = describeFunFacts(session).find(
        (fact) => fact.kind === 'toughest_question',
      );
      expect(toughest).toMatchObject({ correctRate: 0.375 });
    });

    it('words the answer the way the screens show it', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [
          answer(1, 0, 'correct'),
          answer(1, 1, 'incorrect'),
          answer(2, 0, 'correct'),
          answer(2, 1, 'correct'),
        ],
      });
      session.seededGame.rounds[0].questions[0] = {
        ...session.seededGame.rounds[0].questions[0],
        type: 'sort',
        answer: 'Mercury|Venus|Earth',
      };

      const toughest = describeFunFacts(session).find(
        (fact) => fact.kind === 'toughest_question',
      );
      expect(toughest).toMatchObject({
        question: { questionId: 1, answer: 'Mercury → Venus → Earth' },
      });
    });

    it('leaves a partial-credit question nobody fully got right to nobody-got-it', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [
          answer(1, 0, 'partial', { pointsAwarded: 500 }),
          answer(1, 1, 'incorrect'),
          answer(2, 0, 'correct'),
          answer(2, 1, 'incorrect'),
        ],
      });

      const facts = describeFunFacts(session);
      expect(facts.find((f) => f.kind === 'nobody_got_it')).toMatchObject({
        question: { questionId: 1 },
      });
      expect(facts.find((f) => f.kind === 'toughest_question')).toMatchObject({
        question: { questionId: 2 },
      });
    });

    it('leaves a question nobody got right to the nobody-got-it fact', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [
          answer(1, 0, 'correct'),
          answer(1, 1, 'incorrect'),
          answer(2, 0, 'incorrect'),
          answer(2, 1, 'incorrect'),
        ],
      });

      const facts = describeFunFacts(session);
      const toughest = facts.find((fact) => fact.kind === 'toughest_question');
      const nobody = facts.find((fact) => fact.kind === 'nobody_got_it');
      expect(toughest).toMatchObject({ question: { questionId: 1 } });
      expect(nobody).toMatchObject({ question: { questionId: 2 } });
    });

    it('is skipped when the only hard question is one nobody got right', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [
          ...[0, 1, 2, 3].map((team) => answer(1, team, 'correct')),
          ...[0, 1, 2, 3].map((team) => answer(2, team, 'incorrect')),
        ],
      });

      expect(kinds(session)).not.toContain('toughest_question');
      expect(kinds(session)).toContain('nobody_got_it');
    });

    it('is skipped when every revealed question was answered wrongly by everyone', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [0, 1, 2, 3].flatMap((team) => [
          answer(1, team, 'incorrect'),
          answer(2, team, 'incorrect'),
        ]),
      });

      expect(kinds(session)).not.toContain('toughest_question');
    });

    it('is skipped for an empty roster', () => {
      const session = {
        ...sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
          answers: [answer(1, 0, 'correct'), answer(2, 1, 'incorrect')],
        }),
        leaderboard: [],
      };

      expect(kinds(session)).not.toContain('toughest_question');
    });

    it('is skipped when every revealed question was answered correctly by everyone', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [0, 1, 2, 3].flatMap((team) => [
          answer(1, team, 'correct'),
          answer(2, team, 'correct'),
        ]),
      });

      expect(kinds(session)).not.toContain('toughest_question');
    });
  });

  describe('room split', () => {
    it('picks the question whose correct rate is closest to one half', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [
          answer(1, 0, 'correct'),
          answer(1, 1, 'correct'),
          answer(1, 2, 'correct'),
          answer(1, 3, 'incorrect'),
          answer(2, 0, 'correct'),
          answer(2, 1, 'correct'),
          answer(2, 2, 'incorrect'),
          answer(2, 3, 'incorrect'),
        ],
      });

      const split = describeFunFacts(session).find(
        (fact) => fact.kind === 'room_split',
      );
      expect(split).toMatchObject({
        kind: 'room_split',
        correctRate: 0.5,
        question: { questionId: 2 },
      });
    });

    it('prefers a rate of one half over a lower one, whichever question comes first', () => {
      const answers = [
        answer(1, 0, 'correct'),
        answer(1, 1, 'incorrect'),
        answer(1, 2, 'incorrect'),
        answer(1, 3, 'incorrect'),
        answer(2, 0, 'correct'),
        answer(2, 1, 'correct'),
        answer(2, 2, 'incorrect'),
        answer(2, 3, 'incorrect'),
      ];

      const split = describeFunFacts(
        sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, { answers }),
      ).find((fact) => fact.kind === 'room_split');
      expect(split).toMatchObject({
        correctRate: 0.5,
        question: { questionId: 2 },
      });
    });

    it('is skipped when no question was split (all or nothing)', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [
          ...[0, 1, 2, 3].map((team) => answer(1, team, 'correct')),
          ...[0, 1, 2, 3].map((team) => answer(2, team, 'incorrect')),
        ],
      });

      expect(kinds(session)).not.toContain('room_split');
    });
  });

  describe('nobody got it', () => {
    it('names a revealed question with no correct answer', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [
          answer(1, 0, 'correct'),
          answer(1, 1, 'incorrect'),
          answer(2, 0, 'incorrect'),
          answer(2, 1, 'incorrect'),
        ],
      });

      const nobody = describeFunFacts(session).find(
        (fact) => fact.kind === 'nobody_got_it',
      );
      expect(nobody).toMatchObject({
        kind: 'nobody_got_it',
        question: { questionId: 2 },
      });
    });

    it('skips a question nobody answered at all, as there is nothing to say about it', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [answer(1, 0, 'correct')],
      });

      expect(kinds(session)).not.toContain('nobody_got_it');
    });

    it('is skipped when every revealed question had a correct answer', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [answer(1, 0, 'correct'), answer(2, 1, 'correct')],
      });

      expect(kinds(session)).not.toContain('nobody_got_it');
    });
  });

  describe('clean sweep', () => {
    it('lists the teams that got every question of the last revealed block fully correct', () => {
      const session = sessionOf(THREE_ROUNDS, breakProgress(2, 1), {
        answers: [
          // Round 2 (questions 3-4) is the last revealed block; round 1 doesn't count.
          answer(1, 2, 'incorrect'),
          answer(3, 0, 'correct'),
          answer(4, 0, 'correct'),
          answer(3, 1, 'correct'),
          answer(4, 1, 'partial', { pointsAwarded: 500 }),
          answer(3, 2, 'correct'),
          answer(4, 2, 'correct'),
          answer(3, 3, 'incorrect'),
        ],
      });

      const sweep = describeFunFacts(session).find(
        (fact) => fact.kind === 'clean_sweep',
      );
      expect(sweep).toEqual({
        kind: 'clean_sweep',
        teamNames: ['Alpha', 'Charlie'],
      });
    });

    it('lists the swept teams in the leaderboard name order (capitals before lowercase)', () => {
      const session = sessionOf(THREE_ROUNDS, breakProgress(2, 1), {
        answers: [
          answer(3, 0, 'correct', { teamName: 'apple' }),
          answer(4, 0, 'correct', { teamName: 'apple' }),
          answer(3, 1, 'correct', { teamName: 'Zed' }),
          answer(4, 1, 'correct', { teamName: 'Zed' }),
        ],
      });

      const sweep = describeFunFacts(session).find(
        (fact) => fact.kind === 'clean_sweep',
      );
      expect(sweep).toEqual({
        kind: 'clean_sweep',
        teamNames: ['Zed', 'apple'],
      });
    });

    it('is skipped when no team swept the block', () => {
      const session = sessionOf(THREE_ROUNDS, breakProgress(2, 1), {
        answers: [answer(3, 0, 'correct'), answer(4, 0, 'incorrect')],
      });

      expect(kinds(session)).not.toContain('clean_sweep');
    });
  });

  describe('closest guess questions', () => {
    // Question 1 is a closest guess (one winner by design); question 2 is ordinary.
    const rounds: RoundSpec[] = [
      { title: 'One', questionCount: 2, closestGuessIds: [1] },
      { title: 'Two', questionCount: 2 },
      { title: 'Three', questionCount: 2 },
    ];

    it('never appear in the rate-based facts, even with a single correct team', () => {
      const session = sessionOf(rounds, AFTER_ROUND_TWO, {
        answers: [
          answer(1, 0, 'correct'),
          answer(1, 1, 'incorrect'),
          answer(1, 2, 'incorrect'),
          answer(1, 3, 'incorrect'),
          answer(2, 0, 'correct'),
          answer(2, 1, 'correct'),
          answer(2, 2, 'correct'),
          answer(2, 3, 'incorrect'),
        ],
      });

      const rated = describeFunFacts(session).flatMap((fact) =>
        fact.kind === 'toughest_question' || fact.kind === 'room_split'
          ? [fact.question.questionId]
          : [],
      );
      expect(rated).not.toContain(1);
      expect(rated).toEqual([2, 2]);
    });

    it('is never the nobody-got-it question', () => {
      const session = sessionOf(rounds, AFTER_ROUND_TWO, {
        answers: [
          answer(1, 0, 'incorrect'),
          answer(1, 1, 'incorrect'),
          answer(2, 0, 'correct'),
        ],
      });

      expect(kinds(session)).not.toContain('nobody_got_it');
    });

    it('does not make a lone closest-guess winner a clean sweep', () => {
      const session = sessionOf(
        [
          { title: 'One', questionCount: 1, closestGuessIds: [1] },
          { title: 'Two', questionCount: 1 },
        ],
        breakProgress(1, 0),
        { answers: [answer(1, 0, 'correct'), answer(1, 1, 'incorrect')] },
      );

      expect(kinds(session)).not.toContain('clean_sweep');
    });

    it('is left out of a clean sweep: the other questions of the block decide it', () => {
      const session = sessionOf(
        [
          { title: 'One', questionCount: 2, closestGuessIds: [1] },
          { title: 'Two', questionCount: 1 },
        ],
        breakProgress(1, 0),
        {
          answers: [
            answer(1, 0, 'correct'),
            answer(1, 1, 'incorrect'),
            answer(2, 0, 'correct'),
            answer(2, 1, 'correct'),
          ],
        },
      );

      expect(
        describeFunFacts(session).find((f) => f.kind === 'clean_sweep'),
      ).toEqual({ kind: 'clean_sweep', teamNames: ['Alpha', 'Bravo'] });
    });
  });

  describe('bonus awards so far', () => {
    it('counts positive awards per category in category order', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        bonusAwards: [
          { category: 'selfie', points: 100 },
          { category: 'shot', points: 100 },
          { category: 'selfie', points: 100 },
          { category: 'shot', points: -100 },
          { category: 'custom', points: 0 },
        ],
      });

      expect(describeFunFacts(session)).toContainEqual({
        kind: 'bonus_awards_so_far',
        counts: [
          { category: 'shot', count: 1 },
          { category: 'selfie', count: 2 },
        ],
      });
    });

    it('is skipped when no award was positive', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        bonusAwards: [{ category: 'shot', points: -100 }],
      });

      expect(kinds(session)).not.toContain('bonus_awards_so_far');
    });
  });

  describe('joker facts', () => {
    function withJokers(
      session: SessionState,
      jokers: SessionState['jokers'],
      isOn = true,
    ): SessionState {
      return {
        ...session,
        seededGame: {
          ...session.seededGame,
          settings: {
            ...session.seededGame.settings,
            showRoundOverview: isOn,
            jokersEnabled: isOn,
          },
        },
        jokers,
      };
    }

    const jokers: SessionState['jokers'] = {
      1: { roundId: 1, source: 'chosen' },
      2: { roundId: 1, source: 'chosen' },
      3: { roundId: 2, source: 'drawn' },
      4: { roundId: 1, source: 'chosen' },
    };

    it('names the favourite round, a snubbed round and the drawn count without any team, from the first break', () => {
      const session = withJokers(
        sessionOf(THREE_ROUNDS, breakProgress(0, 1), {}),
        jokers,
      );

      expect(describeFunFacts(session)).toEqual([
        {
          kind: 'joker_favourite_round',
          roundNumber: 1,
          roundTitle: 'One',
          teamCount: 3,
        },
        { kind: 'joker_snubbed_round', roundNumber: 3, roundTitle: 'Three' },
        { kind: 'joker_drawn_count', teamCount: 1 },
      ]);
    });

    it('breaks a favourite tie towards the earlier round', () => {
      const session = withJokers(
        sessionOf(THREE_ROUNDS, breakProgress(0, 1), {}),
        {
          1: { roundId: 2, source: 'chosen' },
          2: { roundId: 1, source: 'chosen' },
        },
      );

      expect(describeFunFacts(session)[0]).toMatchObject({
        kind: 'joker_favourite_round',
        roundNumber: 1,
      });
    });

    it('skips the snubbed round when every round is someone’s joker and the drawn count at 0', () => {
      const session = withJokers(
        sessionOf(THREE_ROUNDS, breakProgress(0, 1), {}),
        {
          1: { roundId: 1, source: 'chosen' },
          2: { roundId: 2, source: 'chosen' },
          3: { roundId: 3, source: 'set_by_quiz_master' },
        },
      );

      expect(kinds(session)).toEqual(['joker_favourite_round']);
    });

    it('says nothing without any joker', () => {
      expect(
        kinds(withJokers(sessionOf(THREE_ROUNDS, breakProgress(0, 1), {}), {})),
      ).toEqual([]);
    });

    it('says nothing when Jokers is off, even if jokers are stored', () => {
      const session = withJokers(
        sessionOf(THREE_ROUNDS, breakProgress(0, 1), {}),
        jokers,
        false,
      );

      expect(kinds(session)).toEqual([]);
    });

    it('ignores a joker of a team that has left the roster', () => {
      const session = withJokers(
        sessionOf(THREE_ROUNDS, breakProgress(0, 1), {}),
        {
          99: { roundId: 3, source: 'drawn' },
          1: { roundId: 1, source: 'chosen' },
        },
      );

      expect(kinds(session)).toEqual([
        'joker_favourite_round',
        'joker_snubbed_round',
      ]);
      expect(describeFunFacts(session)[1]).toMatchObject({ roundNumber: 2 });
    });

    it('names the best joker by its extra points, using revealed rounds only', () => {
      const session = withJokers(
        sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
          answers: [
            answer(1, 0, 'correct'),
            answer(2, 0, 'correct'),
            answer(1, 1, 'correct'),
            // Round 2 is the block in play: team 3's joker there stays secret.
            answer(3, 2, 'correct'),
            answer(4, 2, 'correct'),
          ],
        }),
        jokers,
      );

      expect(
        describeFunFacts(session).find((fact) => fact.kind === 'best_joker'),
      ).toEqual({
        kind: 'best_joker',
        teamName: 'Alpha',
        roundNumber: 1,
        roundTitle: 'One',
        extraPoints: 2000,
      });
    });

    it('breaks a best-joker tie in leaderboard name order and skips it with no extra points', () => {
      const tied = withJokers(
        sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
          answers: [answer(1, 1, 'correct'), answer(1, 0, 'correct')],
        }),
        jokers,
      );
      expect(
        describeFunFacts(tied).find((fact) => fact.kind === 'best_joker'),
      ).toMatchObject({ teamName: 'Alpha', extraPoints: 1000 });

      const flopped = withJokers(
        sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
          answers: [answer(1, 0, 'incorrect')],
        }),
        jokers,
      );
      expect(kinds(flopped)).not.toContain('best_joker');
    });

    it('names a team whose revealed joker round was its lowest-scoring round', () => {
      const session = withJokers(
        sessionOf(THREE_ROUNDS, breakProgress(2, 1), {
          answers: [
            // Alpha: joker round 1 scored well. Bravo: joker round 1 scored 0 against 1000 in round 2.
            answer(1, 0, 'correct'),
            answer(1, 1, 'incorrect'),
            answer(3, 1, 'correct'),
          ],
        }),
        jokers,
      );

      expect(
        describeFunFacts(session).find(
          (fact) => fact.kind === 'joker_backfired',
        ),
      ).toEqual({
        kind: 'joker_backfired',
        teamName: 'Bravo',
        roundNumber: 1,
        roundTitle: 'One',
      });
    });

    it('does not call a joker a backfire before a second round is revealed or while it is not the lowest', () => {
      const firstRevealed = withJokers(
        sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
          answers: [answer(1, 1, 'incorrect')],
        }),
        jokers,
      );
      expect(kinds(firstRevealed)).not.toContain('joker_backfired');

      const fine = withJokers(
        sessionOf(THREE_ROUNDS, breakProgress(2, 1), {
          answers: [answer(1, 0, 'correct'), answer(3, 0, 'correct')],
        }),
        { 1: { roundId: 1, source: 'chosen' } },
      );
      expect(kinds(fine)).not.toContain('joker_backfired');
    });

    it('breaks a best-joker tie by name order, not by the leaderboard order', () => {
      const session = withJokers(
        sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
          answers: [answer(1, 0, 'correct'), answer(1, 1, 'correct')],
        }),
        jokers,
      );
      session.leaderboard = leaderboardOf(TEAM_NAMES).reverse();

      expect(
        describeFunFacts(session).find((fact) => fact.kind === 'best_joker'),
      ).toMatchObject({ teamName: 'Alpha' });
    });

    it('leaves a joker on a round only partly revealed out of the best joker', () => {
      const session = withJokers(
        sessionOf(
          [
            { title: 'Warm-up', questionCount: 1 },
            { title: 'Buzzer', questionCount: 2, isKahoot: true },
            { title: 'Finale', questionCount: 1 },
          ],
          breakProgress(1, 1),
          { answers: [answer(2, 0, 'correct')] },
        ),
        { 1: { roundId: 2, source: 'chosen' } },
      );

      expect(kinds(session)).not.toContain('best_joker');
    });

    it('does not call a joker on a round still hidden a backfire', () => {
      const session = withJokers(
        sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
          answers: [answer(1, 2, 'correct')],
        }),
        { 3: { roundId: 2, source: 'chosen' } },
      );

      expect(kinds(session)).not.toContain('joker_backfired');
    });

    it('needs the joker round to score below every other revealed round, not just one', () => {
      const session = withJokers(
        sessionOf(
          [
            { title: 'One', questionCount: 1 },
            { title: 'Two', questionCount: 1 },
            { title: 'Three', questionCount: 1 },
            { title: 'Four', questionCount: 1 },
          ],
          breakProgress(3, 0),
          {
            // Bravo's joker round (1) scored 0: above round 3 never, equal to it.
            answers: [
              answer(1, 1, 'incorrect'),
              answer(2, 1, 'correct'),
              answer(3, 1, 'incorrect'),
            ],
          },
        ),
        { 2: { roundId: 1, source: 'chosen' } },
      );

      expect(kinds(session)).not.toContain('joker_backfired');
    });

    it('puts the joker facts after the existing facts and before the bonus awards', () => {
      const session = withJokers(
        sessionOf(THREE_ROUNDS, breakProgress(2, 1), {
          answers: [
            answer(1, 0, 'correct'),
            answer(1, 1, 'incorrect'),
            answer(2, 0, 'incorrect'),
            answer(2, 1, 'incorrect'),
            answer(3, 1, 'correct'),
            answer(4, 1, 'correct'),
          ],
          bonusAwards: [{ category: 'shot', points: 100 }],
        }),
        jokers,
      );

      expect(kinds(session)).toEqual([
        'toughest_question',
        'room_split',
        'nobody_got_it',
        'clean_sweep',
        'joker_favourite_round',
        'joker_snubbed_round',
        'joker_drawn_count',
        'best_joker',
        'joker_backfired',
        'bonus_awards_so_far',
      ]);
    });
  });

  describe('the block in play', () => {
    it('never contributes: a question nobody got right in it does not appear', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, {
        answers: [
          answer(1, 0, 'correct'),
          answer(2, 0, 'correct'),
          // Questions 3-4 are the block in play: nobody got them right.
          answer(3, 0, 'incorrect', { responseMs: 100 }),
          answer(4, 0, 'incorrect'),
        ],
      });

      const facts = describeFunFacts(session);
      const questionIds = facts.flatMap((fact) =>
        'question' in fact ? [fact.question.questionId] : [],
      );
      expect(questionIds.filter((id) => id >= 3)).toEqual([]);
      expect(kinds(session)).not.toContain('nobody_got_it');
    });
  });

  describe('the first break', () => {
    it('yields only bonus awards so far, and nothing without a positive award', () => {
      const noAwards = sessionOf(THREE_ROUNDS, breakProgress(0, 1), {
        answers: [answer(1, 0, 'correct'), answer(2, 1, 'incorrect')],
      });
      expect(describeFunFacts(noAwards)).toEqual([]);

      const session = sessionOf(THREE_ROUNDS, breakProgress(0, 1), {
        answers: [
          answer(1, 0, 'correct', { responseMs: 1000 }),
          answer(2, 0, 'correct'),
          answer(2, 1, 'incorrect'),
        ],
        bonusAwards: [{ category: 'shot', points: 100 }],
      });

      expect(describeFunFacts(session)).toEqual([
        {
          kind: 'bonus_awards_so_far',
          counts: [{ category: 'shot', count: 1 }],
        },
      ]);
    });
  });

  describe('the display view', () => {
    /** The facts the big screen's break screen carries; none on any other screen. */
    function funFactsOn(view: DisplayStatePayload) {
      return view.screen.kind === 'break_intro' ? view.screen.funFacts : [];
    }

    const data: Partial<FunFactData> = {
      answers: [answer(1, 0, 'correct'), answer(2, 1, 'incorrect')],
    };

    it('carries the facts on the break screen', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, data);
      const onBreak = {
        ...session,
        progress: { ...session.progress, status: 'break_intro' as const },
      };

      const view = projectScreen(onBreak, SOCKET_ROOMS.DISPLAY);

      expect(view.screen).toMatchObject({
        kind: 'break_intro',
        funFacts: describeFunFacts(onBreak),
      });
      expect(funFactsOn(view).length).toBeGreaterThan(0);
    });

    it.each(['lobby', 'question_open', 'break', 'reveal', 'ended'] as const)(
      'is empty on the %s screen',
      (status) => {
        const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, data);
        const elsewhere = {
          ...session,
          progress: { ...session.progress, status },
        };

        expect(
          funFactsOn(projectScreen(elsewhere, SOCKET_ROOMS.DISPLAY)),
        ).toEqual([]);
      },
    );

    it('is empty while the leaderboard covers the break screen', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, data);
      const covered = {
        ...session,
        progress: { ...session.progress, isLeaderboardVisible: true },
      };

      expect(funFactsOn(projectScreen(covered, SOCKET_ROOMS.DISPLAY))).toEqual(
        [],
      );
    });

    it('is not on the players or admin views', () => {
      const session = sessionOf(THREE_ROUNDS, AFTER_ROUND_TWO, data);

      expect(projectScreen(session, SOCKET_ROOMS.PLAYERS)).not.toHaveProperty(
        'funFacts',
      );
      expect(projectScreen(session, SOCKET_ROOMS.ADMIN)).not.toHaveProperty(
        'funFacts',
      );
    });
  });

  it('orders the facts as the spec lists them', () => {
    const session = sessionOf(THREE_ROUNDS, breakProgress(2, 1), {
      answers: [
        answer(1, 0, 'correct'),
        answer(1, 1, 'incorrect'),
        answer(2, 0, 'incorrect'),
        answer(2, 1, 'incorrect'),
        answer(3, 0, 'correct'),
        answer(4, 0, 'correct'),
      ],
      bonusAwards: [{ category: 'shot', points: 100 }],
    });

    expect(kinds(session)).toEqual([
      'toughest_question',
      'room_split',
      'nobody_got_it',
      'clean_sweep',
      'bonus_awards_so_far',
    ]);
  });
});
