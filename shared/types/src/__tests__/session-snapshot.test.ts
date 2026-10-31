import { describe, expect, it } from 'vitest';
import type { FunFactAnswer } from '../fun-facts';
import type { LeaderboardEntry } from '../room-views';
import {
  buildAdminFields,
  buildAdminQuestionContext,
  buildDisplayFields,
  buildPlayersFields,
  buildSnapshot,
  findQuestionOpenForAnswering,
  isBlockAnswerable,
  isJokerPickOpen,
} from '../session-snapshot';
import type { SessionState } from '../session-state';
import {
  freeText,
  progressAt,
  roundOf,
  sessionOver,
} from './session-progress-fixtures';

const NOW = 1_700_000_000_000;

// Round 0 (ids 1, 2) is a normal round; round 1 (ids 3, 4) is kahoot.
const rounds = [roundOf(10, [1, 2]), roundOf(20, [3, 4], { kahootMode: true })];

function standing(teamId: number): LeaderboardEntry {
  return {
    teamId,
    teamName: `Team ${teamId}`,
    totalPoints: 0,
    rank: 1,
    rankTo: 1,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}

function answer(
  questionId: number,
  teamId: number,
  verdict: FunFactAnswer['verdict'],
  pointsAwarded = 0,
): FunFactAnswer {
  return {
    questionId,
    teamId,
    teamName: `Team ${teamId}`,
    verdict,
    pointsAwarded,
    responseMs: null,
  };
}

describe('the phase timer on the admin view', () => {
  const open = progressAt('question_open', { furthestOpenIndex: 0 });

  it('has no timer on an untimed status', () => {
    const session = {
      ...sessionOver(rounds, progressAt('lobby')),
      livePhaseKey: 'q:0:0:0',
      phaseStartedAt: NOW,
    };

    expect(buildAdminFields(session)).toMatchObject({
      phaseStartedAt: null,
      phaseElapsedMs: null,
    });
  });

  it('ticks from the live start when the live phase is on screen', () => {
    const session = {
      ...sessionOver(rounds, open),
      livePhaseKey: 'q:0:0:0',
      phaseStartedAt: NOW,
      phaseElapsedByKey: { 'q:0:0:0': 1234 },
    };

    expect(buildAdminFields(session)).toMatchObject({
      phaseStartedAt: NOW,
      phaseElapsedMs: null,
    });
  });

  it('shows the banked time of a superseded phase, with no live start', () => {
    const session = {
      ...sessionOver(rounds, open),
      livePhaseKey: 'q:0:0:1',
      phaseStartedAt: NOW,
      phaseElapsedByKey: { 'q:0:0:0': 7000 },
    };

    expect(buildAdminFields(session)).toMatchObject({
      phaseStartedAt: null,
      phaseElapsedMs: 7000,
    });
  });

  it('has no elapsed time for a superseded phase with nothing banked', () => {
    const session = {
      ...sessionOver(rounds, open),
      livePhaseKey: 'q:0:0:1',
      phaseStartedAt: NOW,
    };

    expect(buildAdminFields(session)).toMatchObject({
      phaseStartedAt: null,
      phaseElapsedMs: null,
    });
  });
});

describe('the teams on the admin view', () => {
  const base = {
    ...sessionOver(rounds, progressAt('lobby'), { maxPlayersPerTeam: 6 }),
    teams: [
      { teamId: 1, teamName: 'Alpha' },
      { teamId: 2, teamName: 'Bravo' },
      { teamId: 3, teamName: 'Charlie' },
    ],
    playerCounts: { 1: 7, 2: 6 },
    connectedTeamSockets: { 2: 'socket-b' },
  };

  it('flags only a team above the player cap', () => {
    const teams = buildAdminFields(base).teams;

    expect(
      teams.map(({ teamName, playerCount, isOverPlayerCap }) => ({
        teamName,
        playerCount,
        isOverPlayerCap,
      })),
    ).toEqual([
      { teamName: 'Alpha', playerCount: 7, isOverPlayerCap: true },
      { teamName: 'Bravo', playerCount: 6, isOverPlayerCap: false },
      { teamName: 'Charlie', playerCount: null, isOverPlayerCap: false },
    ]);
  });

  it('says which teams have a device connected', () => {
    expect(
      buildAdminFields(base).teams.map((team) => team.isConnected),
    ).toEqual([false, true, false]);
  });

  it('names no joker for a team whose round is gone from the quiz', () => {
    const session = {
      ...base,
      jokers: {
        1: { roundId: 999, source: 'chosen' as const },
        2: { roundId: 20, source: 'chosen' as const },
      },
    };

    const [alpha, bravo] = buildAdminFields(session).teams;

    expect(alpha.joker).toBeNull();
    expect(bravo.joker).toEqual({
      roundId: 20,
      source: 'chosen',
      roundNumber: 2,
      roundTitle: 'Round 20',
    });
  });

  it('passes on the ungraded question ids', () => {
    expect(
      buildAdminFields({ ...base, ungradedQuestionIds: [1, 2] })
        .ungradedQuestionIds,
    ).toEqual([1, 2]);
  });
});

describe('the teams-correct count on the display view', () => {
  const reveal = progressAt('reveal', {
    questionIndex: 1,
    revealIndex: 1,
    furthestOpenIndex: 1,
  });
  const withBoard = (session: SessionState): SessionState => ({
    ...session,
    leaderboard: [1, 2, 3, 4].map(standing),
    funFactData: {
      bonusAwards: [],
      powerUps: [],
      answers: [
        answer(2, 1, 'correct', 2),
        answer(2, 2, 'partial', 1),
        answer(2, 3, 'incorrect'),
        answer(1, 4, 'correct', 2),
      ],
    },
  });

  it('counts the revealed question’s answers against every team on the leaderboard', () => {
    const session = withBoard(sessionOver(rounds, reveal));

    expect(buildDisplayFields(session).teamsCorrect).toEqual({
      correct: 1,
      partial: 1,
      teamCount: 4,
    });
  });

  it('is null outside a reveal', () => {
    const session = withBoard(
      sessionOver(rounds, { ...reveal, status: 'break' }),
    );

    expect(buildDisplayFields(session).teamsCorrect).toBeNull();
  });

  it('is null when the reveal index points past the block', () => {
    const session = withBoard(
      sessionOver(rounds, { ...reveal, revealIndex: 5 }),
    );

    expect(buildDisplayFields(session).teamsCorrect).toBeNull();
  });

  it('is null for a question type with no correct rate', () => {
    const session = withBoard(
      sessionOver(
        [
          roundOf(10, [], {
            questions: [
              freeText(1),
              freeText(2, { type: 'closest_guess', answer: '42' }),
            ],
          }),
        ],
        reveal,
      ),
    );

    expect(buildDisplayFields(session).teamsCorrect).toBeNull();
  });
});

describe('the power-up count on the display view', () => {
  const reveal = progressAt('reveal', {
    questionIndex: 1,
    revealIndex: 1,
    furthestOpenIndex: 1,
  });
  const bought = (teamId: number, questionId: number) => ({
    teamId,
    questionId,
    powerUp: 'fifty_fifty' as const,
    cost: 1,
  });
  const withPurchases = (session: SessionState): SessionState => ({
    ...session,
    funFactData: {
      answers: [],
      bonusAwards: [],
      powerUps: [bought(1, 2), bought(2, 2), bought(3, 1)],
    },
  });

  it('counts each power-up used on the revealed question, naming no team', () => {
    const fields = buildDisplayFields(
      withPurchases(sessionOver(rounds, reveal)),
    );

    expect(fields.powerUpCounts).toEqual([
      { powerUp: 'fifty_fifty', count: 2 },
    ]);
  });

  it('is empty when none was used on the revealed question', () => {
    const session = withPurchases(
      sessionOver(rounds, { ...reveal, questionIndex: 0, revealIndex: 0 }),
    );
    session.funFactData.powerUps = [bought(1, 2)];

    expect(buildDisplayFields(session).powerUpCounts).toEqual([]);
  });

  it('is empty outside a reveal', () => {
    const session = withPurchases(
      sessionOver(rounds, { ...reveal, status: 'break' }),
    );

    expect(buildDisplayFields(session).powerUpCounts).toEqual([]);
  });
});

describe('the coins on the admin view', () => {
  it('subtract what each team spent on power-ups', () => {
    const base = sessionOver(rounds, progressAt('lobby'), {
      powerUpsEnabled: true,
      startingCoins: 3,
    });
    const session: SessionState = {
      ...base,
      teams: [
        { teamId: 1, teamName: 'Alpha' },
        { teamId: 2, teamName: 'Bravo' },
      ],
      funFactData: {
        answers: [],
        bonusAwards: [],
        powerUps: [
          { teamId: 1, questionId: 1, powerUp: 'fifty_fifty', cost: 2 },
        ],
      },
    };

    expect(buildAdminFields(session).teams.map((team) => team.coins)).toEqual([
      1, 3,
    ]);
  });
});

describe('the display view fields', () => {
  it('names each round’s category and author, empty when it has none', () => {
    const session = sessionOver([
      roundOf(10, [1], { category: 'Music', author: 'Sam' }),
      roundOf(20, [2]),
    ]);

    expect(buildDisplayFields(session)).toMatchObject({
      roundCategories: ['Music', ''],
      roundAuthors: ['Sam', ''],
    });
  });

  it('carries the question and joker pick deadlines', () => {
    const session = {
      ...sessionOver(rounds),
      kahootQuestionEndsAt: NOW + 1,
      jokerPickEndsAt: NOW + 2,
    };

    expect(buildDisplayFields(session)).toMatchObject({
      kahootQuestionEndsAt: NOW + 1,
      jokerPickEndsAt: NOW + 2,
    });
  });
});

describe('the players view fields', () => {
  it('offers the pick only while the status is the joker pick', () => {
    const picking = {
      ...sessionOver(rounds, progressAt('joker_pick')),
      jokerPickEndsAt: NOW + 5,
    };

    expect(buildPlayersFields(picking).jokerPick).toMatchObject({
      endsAt: NOW + 5,
    });
    expect(
      buildPlayersFields({ ...picking, progress: progressAt('rules') })
        .jokerPick,
    ).toBeNull();
  });

  describe('the extra joker offer', () => {
    const offerAt = (status: 'lobby' | 'rules' | 'round_overview') =>
      buildPlayersFields(
        sessionOver(rounds, progressAt(status), { showRoundOverview: true }),
      ).extraJokerOffer;

    it.each(['lobby', 'rules'] as const)(
      'names the round by number alone while the overview has not aired (%s)',
      (status) => {
        expect(offerAt(status)).toEqual({
          roundId: 10,
          roundNumber: 1,
          title: '',
        });
      },
    );

    it('names the round by title once the overview is on air', () => {
      expect(offerAt('round_overview')).toEqual({
        roundId: 10,
        roundNumber: 1,
        title: 'Round 10',
      });
    });

    it('never names the round with the overview off', () => {
      const session = sessionOver(rounds, progressAt('round_overview'), {
        showRoundOverview: false,
      });

      expect(buildPlayersFields(session).extraJokerOffer?.title).toBe('');
    });
  });
});

describe('the snapshot', () => {
  it('says the current round is not kahoot when the round does not say', () => {
    expect(
      buildSnapshot(sessionOver(rounds, progressAt('question_open')))
        .isCurrentRoundKahoot,
    ).toBe(false);
  });

  it('says the current round is kahoot for a kahoot round', () => {
    expect(
      buildSnapshot(
        sessionOver(rounds, progressAt('question_open', { roundIndex: 1 })),
      ).isCurrentRoundKahoot,
    ).toBe(true);
  });
});

describe('isJokerPickOpen', () => {
  it('is open only on the pick with a deadline armed', () => {
    const picking = sessionOver(rounds, progressAt('joker_pick'));

    expect(isJokerPickOpen({ ...picking, jokerPickEndsAt: NOW })).toBe(true);
    expect(isJokerPickOpen({ ...picking, jokerPickEndsAt: null })).toBe(false);
    expect(
      isJokerPickOpen({
        ...picking,
        progress: progressAt('rules'),
        jokerPickEndsAt: NOW,
      }),
    ).toBe(false);
  });
});

describe('whether the block can be answered', () => {
  const answerable = (progress: ReturnType<typeof progressAt>) =>
    isBlockAnswerable(sessionOver(rounds, progress));

  it('is true while a question is open', () => {
    expect(
      answerable(progressAt('question_open', { furthestOpenIndex: 0 })),
    ).toBe(true);
  });

  it('is true on a round intro over questions already open', () => {
    expect(
      answerable(progressAt('round_intro', { furthestOpenIndex: 0 })),
    ).toBe(true);
  });

  it('is false before the first question of the block has opened', () => {
    expect(
      answerable(progressAt('question_open', { furthestOpenIndex: -1 })),
    ).toBe(false);
  });

  it('is false outside the answering statuses, though the block has questions', () => {
    expect(answerable(progressAt('break', { furthestOpenIndex: 1 }))).toBe(
      false,
    );
    expect(answerable(progressAt('lobby'))).toBe(false);
  });

  it('is false for a kahoot question still hidden behind the leaderboard', () => {
    expect(
      answerable(
        progressAt('question_open', {
          roundIndex: 1,
          furthestOpenIndex: 0,
          isLeaderboardVisible: true,
        }),
      ),
    ).toBe(false);
  });
});

describe('a kahoot question whose reveal already aired', () => {
  const backOnLocking = (questionIndex: number) => ({
    ...sessionOver(
      rounds,
      progressAt('locking', {
        roundIndex: 1,
        questionIndex,
        furthestOpenIndex: 0,
      }),
    ),
    revealedKahootQuestionIds: [3],
  });

  it('is no longer answerable once Previous reopens its locking countdown', () => {
    expect(isBlockAnswerable(backOnLocking(0))).toBe(false);
    expect(findQuestionOpenForAnswering(backOnLocking(0), 3)).toBeUndefined();
  });

  it('leaves the next kahoot question answerable', () => {
    expect(isBlockAnswerable(backOnLocking(1))).toBe(true);
    expect(findQuestionOpenForAnswering(backOnLocking(1), 4)?.id).toBe(4);
  });
});

describe('finding the question open for answering', () => {
  const open = (overrides = {}) =>
    sessionOver(
      rounds,
      progressAt('question_open', { furthestOpenIndex: 0, ...overrides }),
    );

  it('hands over the session’s copy of a question in the block', () => {
    expect(findQuestionOpenForAnswering(open(), 1)).toBe(
      rounds[0].questions[0],
    );
  });

  it('finds the question in whichever round the block reaches', () => {
    const session = sessionOver(
      [roundOf(10, [1], { breakAfter: false }), roundOf(20, [3, 4])],
      progressAt('question_open', { roundIndex: 1, furthestOpenIndex: 1 }),
    );

    expect(findQuestionOpenForAnswering(session, 3)?.id).toBe(3);
  });

  it('finds nothing for a question the block has not reached', () => {
    expect(findQuestionOpenForAnswering(open(), 2)).toBeUndefined();
    expect(findQuestionOpenForAnswering(open(), 3)).toBeUndefined();
    expect(findQuestionOpenForAnswering(open(), 999)).toBeUndefined();
  });

  it('finds nothing outside the answering statuses', () => {
    const session = sessionOver(
      rounds,
      progressAt('break', { furthestOpenIndex: 1 }),
    );

    expect(findQuestionOpenForAnswering(session, 1)).toBeUndefined();
  });

  it('finds nothing for a kahoot question hidden behind the leaderboard', () => {
    const session = sessionOver(
      rounds,
      progressAt('question_open', {
        roundIndex: 1,
        furthestOpenIndex: 0,
        isLeaderboardVisible: true,
      }),
    );

    expect(findQuestionOpenForAnswering(session, 3)).toBeUndefined();
  });
});

describe('the admin question context', () => {
  const quiz = [
    roundOf(10, [1, 2]),
    roundOf(20, [], {
      questions: [
        freeText(3),
        freeText(4, {
          type: 'match',
          options: ['a', 'b'],
          matchTargets: ['x', 'y'],
          mediaUrl: 'https://example.com/pic.png',
          answer: 'x|y',
          points: 5,
        }),
      ],
    }),
  ];

  it('gives the answer and the question’s place in the quiz', () => {
    expect(buildAdminQuestionContext(quiz, 4)).toStrictEqual({
      type: 'match',
      prompt: 'Question 4?',
      options: ['a', 'b'],
      matchTargets: ['x', 'y'],
      mediaUrl: 'https://example.com/pic.png',
      points: 5,
      correctAnswer: 'x|y',
      roundTitle: 'Round 20',
      roundNumber: 2,
      questionNumberInRound: 2,
      totalQuestionsInRound: 2,
    });
  });

  it('leaves out the options, match targets and media a question has none of', () => {
    expect(buildAdminQuestionContext(quiz, 1)).toStrictEqual({
      type: 'free_text',
      prompt: 'Question 1?',
      points: 2,
      correctAnswer: 'answer 1',
      roundTitle: 'Round 10',
      roundNumber: 1,
      questionNumberInRound: 1,
      totalQuestionsInRound: 2,
    });
  });

  it('is null for a question no round holds', () => {
    expect(buildAdminQuestionContext(quiz, 999)).toBeNull();
  });
});
