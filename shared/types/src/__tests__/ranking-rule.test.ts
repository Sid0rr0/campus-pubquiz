import { describe, expect, it } from 'vitest';
import { compareTeamNames, getWinner, rankTeams } from '../ranking-rule';

function team(teamId: number, teamName: string, totalPoints: number) {
  return { teamId, teamName, totalPoints };
}

function summarize(entries: ReturnType<typeof team>[]) {
  return rankTeams(entries).map((row) => [row.teamName, row.rank, row.rankTo]);
}

describe('rankTeams', () => {
  it.each([
    ['no teams', [], []],
    ['a single team', [team(1, 'Alpha', 0)], [['Alpha', 1, 1]]],
    [
      'every team tied on zero',
      [team(1, 'Cat', 0), team(2, 'Ant', 0), team(3, 'Bee', 0)],
      [
        ['Ant', 1, 3],
        ['Bee', 1, 3],
        ['Cat', 1, 3],
      ],
    ],
    [
      'a tie for first',
      [team(1, 'B', 10), team(2, 'A', 10), team(3, 'C', 5)],
      [
        ['A', 1, 2],
        ['B', 1, 2],
        ['C', 3, 3],
      ],
    ],
    [
      'a three-way tie in the middle (next team is 5th)',
      [
        team(1, 'Top', 20),
        team(2, 'B', 10),
        team(3, 'C', 10),
        team(4, 'D', 10),
        team(5, 'Last', 1),
      ],
      [
        ['Top', 1, 1],
        ['B', 2, 4],
        ['C', 2, 4],
        ['D', 2, 4],
        ['Last', 5, 5],
      ],
    ],
    [
      'a tie at the bottom',
      [team(1, 'Top', 9), team(2, 'Y', 3), team(3, 'X', 3)],
      [
        ['Top', 1, 1],
        ['X', 2, 3],
        ['Y', 2, 3],
      ],
    ],
    [
      'negative totals from penalties',
      [team(1, 'Pen', -5), team(2, 'Zero', 0), team(3, 'Pen2', -5)],
      [
        ['Zero', 1, 1],
        ['Pen', 2, 3],
        ['Pen2', 2, 3],
      ],
    ],
  ])('%s', (_label, input, expected) => {
    expect(summarize(input)).toEqual(expected);
  });

  it('keeps the entry fields and does not mutate the input', () => {
    const input = [{ ...team(1, 'B', 1), extra: 'x' }, team(2, 'A', 2)];
    const snapshot = structuredClone(input);

    const result = rankTeams(input);

    expect(input).toEqual(snapshot);
    expect(result[1]).toMatchObject({ teamId: 1, extra: 'x', rank: 2 });
  });

  it('orders names differing by case, accents or digits the same way whatever the locale', () => {
    const names = ['b', 'B', 'é', 'e', 'E', 'team 10', 'team 2', 'Zed', 'ä'];
    const ordered = rankTeams(names.map((n, i) => team(i, n, 0))).map(
      (row) => row.teamName,
    );

    expect(ordered).toEqual([
      'B',
      'E',
      'Zed',
      'b',
      'e',
      'team 10',
      'team 2',
      'ä',
      'é',
    ]);
  });

  it('does not depend on String.prototype.localeCompare', () => {
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = () => {
      throw new Error('locale-dependent comparison used');
    };
    try {
      expect(() => rankTeams([team(1, 'é', 0), team(2, 'e', 0)])).not.toThrow();
    } finally {
      String.prototype.localeCompare = original;
    }
  });
});

describe('compareTeamNames', () => {
  it('is 0 for identical names', () => {
    expect(compareTeamNames('Alpha', 'Alpha')).toBe(0);
  });
});

describe('getWinner', () => {
  it('is undefined when there are no teams', () => {
    expect(getWinner([])).toBeUndefined();
  });

  it('is the clear leader when first place is not tied', () => {
    expect(getWinner([team(1, 'A', 1), team(2, 'B', 9)])?.teamId).toBe(2);
  });

  it('falls back to name order when first place is tied', () => {
    expect(getWinner([team(1, 'Zed', 5), team(2, 'Amy', 5)])?.teamId).toBe(2);
  });
});
