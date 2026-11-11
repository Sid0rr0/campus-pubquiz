import { describe, expect, it } from 'vitest';
import { describeSideStandings, sideStandingsWinner } from '../side-standings';
import { leaderboardEntry } from './session-fixtures';

const SIDES = [
  { id: 'a', name: 'Engineering' },
  { id: 'b', name: 'Law' },
  { id: 'c', name: 'Arts' },
];

function standings(
  points: Record<number, number>,
  teamSides: Record<number, string>,
  extra: { countedTeamIds?: ReadonlySet<number>; sides?: typeof SIDES } = {},
) {
  return describeSideStandings({
    entries: Object.entries(points).map(([id, total]) =>
      leaderboardEntry(Number(id), `T${id}`, total),
    ),
    teamSides,
    sides: extra.sides ?? SIDES.slice(0, 2),
    countedTeamIds: extra.countedTeamIds,
  });
}

describe('describeSideStandings', () => {
  it('averages per team so uneven team counts do not win on headcount', () => {
    const { sides } = standings(
      { 1: 10, 2: 10, 3: 10, 4: 30 },
      { 1: 'a', 2: 'a', 3: 'a', 4: 'b' },
    );
    expect(sides).toEqual([
      {
        id: 'a',
        name: 'Engineering',
        colorIndex: 0,
        teamCount: 3,
        average: 10,
        share: 0.25,
        isLeading: false,
      },
      {
        id: 'b',
        name: 'Law',
        colorIndex: 1,
        teamCount: 1,
        average: 30,
        share: 0.75,
        isLeading: true,
      },
    ]);
  });

  it('floors a negative average for the share only', () => {
    const { sides } = standings({ 1: -4, 2: 6 }, { 1: 'a', 2: 'b' });
    expect(sides.map((side) => side.average)).toEqual([-4, 6]);
    expect(sides.map((side) => side.share)).toEqual([0, 1]);
  });

  it('splits evenly when every average is 0 or below', () => {
    const { sides, isTied } = standings({ 1: 0, 2: 0 }, { 1: 'a', 2: 'b' });
    expect(sides.map((side) => side.share)).toEqual([0.5, 0.5]);
    expect(isTied).toBe(true);
    expect(
      standings({ 1: -2, 2: -3 }, { 1: 'a', 2: 'b' }).sides.map(
        (side) => side.share,
      ),
    ).toEqual([0.5, 0.5]);
  });

  it('shows an empty side with no average and no share once others scored', () => {
    const { sides } = standings({ 1: 8 }, { 1: 'a' });
    expect(sides[1]).toMatchObject({
      teamCount: 0,
      average: null,
      share: 0,
      isLeading: false,
    });
    expect(sides[0]).toMatchObject({ share: 1, isLeading: true });
  });

  it('leaves out teams without a side, not counted, or not on the board', () => {
    const { sides } = standings(
      { 1: 10, 2: 50, 3: 90 },
      { 1: 'a', 2: 'a', 3: 'b', 4: 'b' },
      { countedTeamIds: new Set([1, 3]) },
    );
    expect(sides.map((side) => side.teamCount)).toEqual([1, 1]);
    expect(sides.map((side) => side.average)).toEqual([10, 90]);
  });

  it('names the leader and reports a tie only between leading sides', () => {
    const lead = standings({ 1: 5, 2: 3 }, { 1: 'a', 2: 'b' });
    expect(lead.isTied).toBe(false);
    const tied = standings(
      { 1: 5, 2: 5, 3: 1 },
      { 1: 'a', 2: 'b', 3: 'c' },
      { sides: SIDES },
    );
    expect(tied.sides.map((side) => side.isLeading)).toEqual([
      true,
      true,
      false,
    ]);
    expect(tied.isTied).toBe(true);
  });

  it('has no leader when no side has a counted team', () => {
    const none = standings({}, {});
    expect(none.sides.every((side) => !side.isLeading)).toBe(true);
    expect(none.isTied).toBe(false);
  });
});

describe('sideStandingsWinner', () => {
  it('names the single leading side', () => {
    const winner = sideStandingsWinner(
      standings({ 1: 5, 2: 9 }, { 1: 'a', 2: 'b' }),
    );
    expect(winner).toEqual({
      kind: 'side',
      side: expect.objectContaining({ id: 'b' }),
    });
  });

  it('reports a tie', () => {
    expect(
      sideStandingsWinner(standings({ 1: 5, 2: 5 }, { 1: 'a', 2: 'b' })),
    ).toEqual({ kind: 'tie' });
  });

  it('reports no winner when no team counts', () => {
    expect(sideStandingsWinner(standings({}, {}))).toEqual({ kind: 'none' });
  });
});
