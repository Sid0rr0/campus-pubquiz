import type { TeamSessionRow } from '@campus-pubquiz/types';
import { summarizeTeamHistory } from '@/team/team-history.calc';

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

describe('summarizeTeamHistory share of points', () => {
  it('caps a night at 100% when a joker doubled the team past the quiz maximum', () => {
    // 10 raw points available; a perfect night with the joker round doubled scores 14.
    const summary = summarizeTeamHistory([row(14, 10), row(5, 10)], 1);

    expect(summary.averageSharePercent).toBe(75);
  });
});
