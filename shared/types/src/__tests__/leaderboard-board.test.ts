import { describe, expect, it } from 'vitest';
import type { GameProgress } from '../game-state';
import {
  describeLeaderboardBoard,
  withPriorStandings,
} from '../leaderboard-board';
import type { LeaderboardEntry } from '../room-views';
import type { SessionState } from '../session-state';
import { leaderboardEntry, round, sessionWith } from './session-fixtures';

// Block 1 spans rounds 1 and 2 (round 1 has no break), block 2 is round 3, and
// round 4 is a kahoot round where every question is its own block.
const ROUNDS = [
  round(1, [1, 2], { breakAfter: false }),
  round(2, [3]),
  round(3, [4]),
  round(4, [5, 6], { kahootMode: true }),
];

const KAHOOT_QUESTION: Partial<GameProgress> = {
  status: 'question_open',
  roundIndex: 3,
  questionIndex: 1,
  furthestOpenIndex: 0,
};

function board(...teams: [number, string, number][]): LeaderboardEntry[] {
  return teams.map(([teamId, name, points]) =>
    leaderboardEntry(teamId, name, points),
  );
}

function withBoard(
  progress: Partial<GameProgress>,
  leaderboard: LeaderboardEntry[],
  overrides: Partial<SessionState> = {},
): SessionState {
  return sessionWith(ROUNDS, progress, { leaderboard, ...overrides });
}

describe('describeLeaderboardBoard', () => {
  describe('entries', () => {
    it('lists every team, best first, outside a kahoot round', () => {
      const session = withBoard(
        {
          status: 'break',
          roundIndex: 1,
          questionIndex: 0,
          isLeaderboardVisible: true,
        },
        board(
          [1, 'A', 10],
          [2, 'B', 30],
          [3, 'C', 20],
          [4, 'D', 5],
          [5, 'E', 4],
          [6, 'F', 3],
        ),
      );

      expect(
        describeLeaderboardBoard(session).entries.map(
          (entry) => entry.teamName,
        ),
      ).toEqual(['B', 'C', 'A', 'D', 'E', 'F']);
    });

    it('keeps the top five in a kahoot round', () => {
      const session = withBoard(
        { ...KAHOOT_QUESTION, isLeaderboardVisible: true, status: 'reveal' },
        board(
          [1, 'A', 60],
          [2, 'B', 50],
          [3, 'C', 40],
          [4, 'D', 30],
          [5, 'E', 20],
          [6, 'F', 10],
        ),
      );

      expect(
        describeLeaderboardBoard(session).entries.map(
          (entry) => entry.teamName,
        ),
      ).toEqual(['A', 'B', 'C', 'D', 'E']);
    });
  });

  describe('trends', () => {
    const current = board([1, 'A', 50], [2, 'B', 40], [3, 'C', 30]);

    function trendsOf(
      prior: LeaderboardEntry[] | null,
      leaderboard = current,
    ): Record<number, string> {
      const session = withBoard(
        { status: 'break', roundIndex: 1, questionIndex: 0 },
        leaderboard,
        {
          priorStandings:
            prior === null ? null : { board: prior, blockFirstQuestionId: 1 },
        },
      );
      return describeLeaderboardBoard(session).trends;
    }

    it('marks teams that climbed, fell or held their place', () => {
      const prior = board([1, 'A', 30], [2, 'B', 40], [3, 'C', 10]);

      expect(trendsOf(prior)).toEqual({ 1: 'up', 2: 'down', 3: 'same' });
    });

    it('gives a team missing from the prior standings no trend', () => {
      const prior = board([1, 'A', 30], [2, 'B', 40]);

      expect(trendsOf(prior)).toEqual({ 1: 'up', 2: 'down' });
    });

    it('gives nobody a trend without prior standings', () => {
      expect(trendsOf(null)).toEqual({});
    });

    it('sends every team up when the prior standings had them all tied', () => {
      const prior = board([1, 'A', 0], [2, 'B', 0], [3, 'C', 0]);
      const afterOneQuestion = board([1, 'A', 5], [2, 'B', 0], [3, 'C', 0]);

      expect(trendsOf(prior, afterOneQuestion)).toEqual({
        1: 'up',
        2: 'up',
        3: 'up',
      });
    });

    it('does not treat a lone prior team as a tie', () => {
      const prior = board([1, 'A', 0]);
      const leaderboard = board([1, 'A', 0]);

      expect(trendsOf(prior, leaderboard)).toEqual({ 1: 'same' });
    });

    it('does not treat unequal prior totals as a tie', () => {
      const prior = board([1, 'A', 0], [2, 'B', 0], [3, 'C', 1]);
      const leaderboard = board([1, 'A', 0], [2, 'B', 0], [3, 'C', 1]);

      expect(trendsOf(prior, leaderboard)).toEqual({
        1: 'same',
        2: 'same',
        3: 'same',
      });
    });
  });

  describe('the count-up board', () => {
    // A..G; the top five once the kahoot cap applies are A, B, C, G, D.
    const current = board(
      [1, 'A', 50],
      [2, 'B', 40],
      [3, 'C', 30],
      [7, 'G', 25],
      [4, 'D', 20],
      [5, 'E', 10],
      [6, 'F', 5],
    );
    const prior = board([2, 'B', 40], [1, 'A', 30], [3, 'C', 10], [6, 'F', 5]);

    function boardAt(
      progress: Partial<GameProgress>,
      priorStandings: SessionState['priorStandings'] = {
        board: prior,
        blockFirstQuestionId: 5,
      },
    ) {
      return describeLeaderboardBoard(
        withBoard(progress, current, { priorStandings }),
      );
    }

    it('starts the shown teams from their prior totals, newcomers on zero', () => {
      const { countUpBoard } = boardAt({
        ...KAHOOT_QUESTION,
        isLeaderboardVisible: true,
      });

      expect(
        countUpBoard?.map(({ teamName, totalPoints, rank, rankTo }) => ({
          teamName,
          totalPoints,
          rank,
          rankTo,
        })),
      ).toEqual([
        { teamName: 'B', totalPoints: 40, rank: 1, rankTo: 1 },
        { teamName: 'A', totalPoints: 30, rank: 2, rankTo: 2 },
        { teamName: 'C', totalPoints: 10, rank: 3, rankTo: 3 },
        { teamName: 'D', totalPoints: 0, rank: 4, rankTo: 5 },
        { teamName: 'G', totalPoints: 0, rank: 4, rankTo: 5 },
      ]);
    });

    it('zeroes a newcomer completely', () => {
      const withBonus = board([1, 'A', 50]).map((entry) => ({
        ...entry,
        bonusPoints: 3,
        positiveBonusPoints: 4,
        negativeBonusPoints: -1,
        roundPoints: [{ roundTitle: 'Round 1', points: 50 }],
      })) as LeaderboardEntry[];
      const session = withBoard(
        { ...KAHOOT_QUESTION, isLeaderboardVisible: true },
        [...withBonus, ...board([2, 'B', 40])],
        {
          priorStandings: {
            board: board([2, 'B', 40]),
            blockFirstQuestionId: 5,
          },
        },
      );

      const newcomer = describeLeaderboardBoard(session).countUpBoard?.find(
        ({ teamId }) => teamId === 1,
      );

      expect(newcomer).toMatchObject({
        totalPoints: 0,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      });
    });

    it('is absent outside a kahoot round', () => {
      const result = describeLeaderboardBoard(
        withBoard(
          {
            status: 'question_open',
            roundIndex: 2,
            questionIndex: 0,
            furthestOpenIndex: 0,
            isLeaderboardVisible: true,
          },
          current,
          { priorStandings: { board: prior, blockFirstQuestionId: 4 } },
        ),
      );

      expect(result).not.toHaveProperty('countUpBoard');
    });

    it('is absent while the question is not hidden behind the leaderboard', () => {
      expect(
        boardAt({ ...KAHOOT_QUESTION, isLeaderboardVisible: false }),
      ).not.toHaveProperty('countUpBoard');
    });

    it('is absent once the question is locking', () => {
      expect(
        boardAt({
          ...KAHOOT_QUESTION,
          status: 'locking',
          isLeaderboardVisible: true,
        }),
      ).not.toHaveProperty('countUpBoard');
    });

    it('is absent without prior standings', () => {
      expect(
        boardAt({ ...KAHOOT_QUESTION, isLeaderboardVisible: true }, null),
      ).not.toHaveProperty('countUpBoard');
      expect(
        boardAt(
          { ...KAHOOT_QUESTION, isLeaderboardVisible: true },
          { board: [], blockFirstQuestionId: 5 },
        ),
      ).not.toHaveProperty('countUpBoard');
    });
  });

  describe('joker teams', () => {
    const teams = board([1, 'A', 50], [2, 'B', 40], [3, 'C', 30]);
    const onBlockOne = { board: teams, blockFirstQuestionId: 1 };
    // Round 2 belongs to block 1, round 3 to block 2.
    const jokers = {
      1: { roundId: 2, source: 'chosen' as const },
      2: { roundId: 3, source: 'chosen' as const },
    };
    const leaderboardOn: Partial<GameProgress> = {
      status: 'break_intro',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: true,
    };

    it('names the teams whose joker round is in the block just scored', () => {
      const result = describeLeaderboardBoard(
        withBoard(leaderboardOn, teams, { priorStandings: onBlockOne, jokers }),
      );

      expect(result.jokerTeamIds).toEqual([1]);
    });

    it('counts a joker on the block’s first round too', () => {
      const result = describeLeaderboardBoard(
        withBoard(leaderboardOn, teams, {
          priorStandings: onBlockOne,
          jokers: { 3: { roundId: 1, source: 'chosen' } },
        }),
      );

      expect(result.jokerTeamIds).toEqual([3]);
    });

    it('names nobody while the leaderboard is not on air', () => {
      const result = describeLeaderboardBoard(
        withBoard({ ...leaderboardOn, isLeaderboardVisible: false }, teams, {
          priorStandings: onBlockOne,
          jokers,
        }),
      );

      expect(result).not.toHaveProperty('jokerTeamIds');
    });

    it('names nobody without prior standings to say which block was scored', () => {
      const result = describeLeaderboardBoard(
        withBoard(leaderboardOn, teams, { priorStandings: null, jokers }),
      );

      expect(result).not.toHaveProperty('jokerTeamIds');
    });

    it('leaves the field out when no joker falls in the block', () => {
      const result = describeLeaderboardBoard(
        withBoard(leaderboardOn, teams, {
          priorStandings: onBlockOne,
          jokers: { 2: { roundId: 3, source: 'chosen' } },
        }),
      );

      expect(result).not.toHaveProperty('jokerTeamIds');
    });

    it('skips a joker team the kahoot cap leaves off the board', () => {
      const six = board(
        [1, 'A', 60],
        [2, 'B', 50],
        [3, 'C', 40],
        [4, 'D', 30],
        [5, 'E', 20],
        [6, 'F', 10],
      );
      const result = describeLeaderboardBoard(
        withBoard(
          { ...KAHOOT_QUESTION, status: 'reveal', isLeaderboardVisible: true },
          six,
          {
            priorStandings: { board: six, blockFirstQuestionId: 5 },
            jokers: {
              1: { roundId: 4, source: 'chosen' },
              6: { roundId: 4, source: 'chosen' },
            },
          },
        ),
      );

      expect(result.jokerTeamIds).toEqual([1]);
    });
  });
});

describe('withPriorStandings', () => {
  const standings = board([1, 'A', 10], [2, 'B', 5]);

  function opened(
    progress: Partial<GameProgress>,
    overrides: Partial<SessionState> = {},
  ): SessionState {
    return withBoard(progress, [], overrides);
  }

  const firstQuestionOpen: Partial<GameProgress> = {
    status: 'question_open',
    roundIndex: 0,
    questionIndex: 0,
    furthestOpenIndex: 0,
  };

  it('takes the leaderboard before the block when its first question goes on air', () => {
    const started = withBoard({ status: 'round_intro' }, standings);
    const session = opened(firstQuestionOpen);

    expect(withPriorStandings(started, session).priorStandings).toEqual({
      board: standings,
      blockFirstQuestionId: 1,
    });
  });

  it('tags the first question of a later block with its own id', () => {
    const started = withBoard(
      { status: 'round_intro', roundIndex: 2 },
      standings,
    );
    const session = opened({
      status: 'question_open',
      roundIndex: 2,
      questionIndex: 0,
      furthestOpenIndex: 0,
    });

    expect(withPriorStandings(started, session).priorStandings).toEqual({
      board: standings,
      blockFirstQuestionId: 4,
    });
  });

  it('treats every question of a kahoot round as its own block', () => {
    const started = withBoard(
      {
        status: 'question_open',
        roundIndex: 3,
        questionIndex: 1,
        furthestOpenIndex: 0,
        isLeaderboardVisible: true,
      },
      standings,
    );
    const session = opened({
      status: 'question_open',
      roundIndex: 3,
      questionIndex: 1,
      furthestOpenIndex: 0,
    });

    expect(withPriorStandings(started, session).priorStandings).toEqual({
      board: standings,
      blockFirstQuestionId: 6,
    });
  });

  it('takes nothing for a later question of the block', () => {
    const started = withBoard(
      { status: 'question_open', furthestOpenIndex: 0 },
      standings,
    );
    const session = opened({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      furthestOpenIndex: 1,
    });

    expect(withPriorStandings(started, session)).toBe(session);
  });

  it('takes nothing for the first question of a later round of a block that began earlier', () => {
    const started = withBoard({ status: 'round_intro' }, standings);
    const session = opened({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      furthestOpenIndex: 2,
    });

    expect(withPriorStandings(started, session)).toBe(session);
  });

  it('takes nothing when no question of the block has been reached', () => {
    const started = withBoard({ status: 'round_intro' }, standings);
    const session = opened({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      furthestOpenIndex: -1,
    });

    expect(withPriorStandings(started, session)).toBe(session);
  });

  it('takes nothing for a question that opens straight after a round intro but is not the first', () => {
    const started = withBoard({ status: 'round_intro' }, standings);
    const session = opened({
      status: 'locking',
      roundIndex: 0,
      questionIndex: 1,
      furthestOpenIndex: 1,
    });

    expect(withPriorStandings(started, session)).toBe(session);
  });

  it('takes nothing when the question was already on air', () => {
    const started = withBoard(firstQuestionOpen, standings);
    const session = opened({ ...firstQuestionOpen, status: 'locking' });

    expect(withPriorStandings(started, session)).toBe(session);
  });

  it('takes nothing when stepping back into the question out of a graded status', () => {
    const started = withBoard(
      { status: 'break', roundIndex: 1, questionIndex: 0 },
      standings,
    );
    const session = opened({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      furthestOpenIndex: 0,
    });

    expect(withPriorStandings(started, session)).toBe(session);
  });

  it('takes nothing while the leaderboard covers the question', () => {
    const started = withBoard({ status: 'round_intro' }, standings);
    const session = opened({
      ...firstQuestionOpen,
      isLeaderboardVisible: true,
    });

    expect(withPriorStandings(started, session)).toBe(session);
  });

  it('takes nothing when the session is not on a question', () => {
    const started = withBoard({ status: 'lobby' }, standings);
    const session = opened({ status: 'rules' });

    expect(withPriorStandings(started, session)).toBe(session);
  });

  it('keeps the standings already taken for the same block', () => {
    const kept = { board: board([9, 'Z', 1]), blockFirstQuestionId: 1 };
    const started = withBoard({ status: 'round_intro' }, standings);
    const session = opened(firstQuestionOpen, { priorStandings: kept });

    expect(withPriorStandings(started, session)).toBe(session);
  });

  it('replaces the standings of an earlier block', () => {
    const earlier = { board: board([9, 'Z', 1]), blockFirstQuestionId: 99 };
    const started = withBoard({ status: 'round_intro' }, standings);
    const session = opened(firstQuestionOpen, { priorStandings: earlier });

    expect(withPriorStandings(started, session).priorStandings).toEqual({
      board: standings,
      blockFirstQuestionId: 1,
    });
  });
});
