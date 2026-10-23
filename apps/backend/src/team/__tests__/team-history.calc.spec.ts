import type { TeamSessionRow } from '@campus-pubquiz/types';
import type { TeamResult } from '@/standings/session-result';
import { summarizeTeamHistory, teamHistoryOf } from '@/team/team-history.calc';

function row(totalPoints: number, maxPoints: number): TeamSessionRow {
  return {
    gameSessionId: 1,
    name: 'Night',
    playedAt: '2026-10-01T19:00:00.000Z',
    placing: 1,
    placingTo: 1,
    teamCount: 3,
    hasLeft: false,
    totalPoints,
    maxPoints,
    correctCount: 0,
    playerCount: null,
  };
}

describe('summarizeTeamHistory', () => {
  it('has nothing to average for a team with no sessions', () => {
    expect(summarizeTeamHistory([], 0)).toEqual({
      sessionsPlayed: 0,
      wins: 0,
      podiums: 0,
      bestPlacing: null,
      averagePlacing: null,
      averageSharePercent: null,
      averageTotalPoints: null,
      averagePlayerCount: null,
    });
  });

  it('counts podiums up to 3rd, takes the best placing and averages the rest', () => {
    const summary = summarizeTeamHistory(
      [
        { ...row(10, 20), placing: 4, playerCount: 3 },
        { ...row(20, 20), placing: 3, playerCount: null },
        { ...row(30, 20), placing: null, placingTo: null, playerCount: 5 },
        { ...row(0, 20), placing: 2, playerCount: 0 },
      ],
      1,
    );

    expect(summary).toEqual({
      sessionsPlayed: 4,
      wins: 1,
      podiums: 2,
      bestPlacing: 2,
      averagePlacing: 3,
      averageSharePercent: (50 + 100 + 100 + 0) / 4,
      averageTotalPoints: 15,
      averagePlayerCount: 8 / 3,
    });
  });

  it('leaves a night with no points to win out of the average share', () => {
    const summary = summarizeTeamHistory([row(0, 0), row(5, 10)], 0);

    expect(summary.averageSharePercent).toBe(50);
  });

  it('has no average share when no night had points to win', () => {
    expect(summarizeTeamHistory([row(0, 0)], 0).averageSharePercent).toBeNull();
  });
});

describe('teamHistoryOf', () => {
  const team = (teamId: number, overrides: Partial<TeamResult> = {}) => ({
    teamId,
    teamName: `T${teamId}`,
    placing: 2,
    placingTo: 3,
    hasLeft: false,
    totalPoints: 7,
    bonusPoints: 0,
    answerPoints: 7,
    answered: true,
    correctCount: 4,
    wonNight: false,
    isSessionWinner: false,
    ...overrides,
  });
  const session = (
    gameSessionId: number,
    teams: TeamResult[],
    playerCount: number | null = null,
  ) => ({
    gameSessionId,
    name: `Night ${gameSessionId}`,
    playedAt: '2026-10-01T19:00:00.000Z',
    playerCount,
    result: { teams, questions: [], participantCount: 6, maxPoints: 12 },
  });

  it('reads a row per session the team is in, in the order given, and counts nights won', () => {
    const { rows, nightsWon } = teamHistoryOf(1, [
      session(10, [team(2), team(1, { wonNight: true, placing: 1 })], 4),
      session(11, [team(3)]),
      session(12, [team(1)]),
    ]);

    expect(nightsWon).toBe(1);
    expect(rows).toEqual([
      {
        gameSessionId: 10,
        name: 'Night 10',
        playedAt: '2026-10-01T19:00:00.000Z',
        placing: 1,
        placingTo: 3,
        teamCount: 6,
        hasLeft: false,
        totalPoints: 7,
        maxPoints: 12,
        correctCount: 4,
        playerCount: 4,
      },
      expect.objectContaining({
        gameSessionId: 12,
        placing: 2,
        playerCount: null,
      }),
    ]);
  });

  it('carries a departed team through with no placing', () => {
    const { rows } = teamHistoryOf(1, [
      session(10, [team(1, { placing: null, placingTo: null, hasLeft: true })]),
    ]);

    expect(rows[0]).toMatchObject({
      placing: null,
      placingTo: null,
      hasLeft: true,
    });
  });
});

describe('summarizeTeamHistory share of points', () => {
  it('caps a night at 100% when a joker doubled the team past the quiz maximum', () => {
    // 10 raw points available; a perfect night with the joker round doubled scores 14.
    const summary = summarizeTeamHistory([row(14, 10), row(5, 10)], 1);

    expect(summary.averageSharePercent).toBe(75);
  });
});
