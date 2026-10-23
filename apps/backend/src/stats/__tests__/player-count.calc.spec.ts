import { summarisePlayerCounts } from '@/stats/player-count.calc';

describe('summarisePlayerCounts', () => {
  it('totals and averages the counts the teams gave, leaving skipped teams out', () => {
    expect(summarisePlayerCounts([3, null, 5, 4])).toEqual({
      total: 12,
      average: 4,
      reportedTeams: 3,
    });
  });

  it('keeps a fractional average', () => {
    expect(summarisePlayerCounts([2, 3])).toEqual({
      total: 5,
      average: 2.5,
      reportedTeams: 2,
    });
  });

  it('counts a team that reported zero players', () => {
    expect(summarisePlayerCounts([0, 4])).toEqual({
      total: 4,
      average: 2,
      reportedTeams: 2,
    });
  });

  it('has no average when no team gave a count', () => {
    expect(summarisePlayerCounts([null, null])).toEqual({
      total: 0,
      average: null,
      reportedTeams: 0,
    });
    expect(summarisePlayerCounts([])).toEqual({
      total: 0,
      average: null,
      reportedTeams: 0,
    });
  });
});
