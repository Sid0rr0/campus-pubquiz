import {
  buildLeagueTable,
  leaguePointsFor,
  type TeamNight,
} from '@/league/league-table.calc';

let nextTeamId = 1;

function night(
  teamName: string,
  placing: number | null,
  overrides: Partial<TeamNight> = {},
): TeamNight {
  return {
    teamId: overrides.teamId ?? idOf(teamName),
    teamName,
    placing,
    answered: true,
    wonNight: placing === 1,
    ...overrides,
  };
}

const ids = new Map<string, number>();
function idOf(name: string): number {
  if (!ids.has(name)) ids.set(name, nextTeamId++);
  return ids.get(name)!;
}

describe('leaguePointsFor', () => {
  it.each([
    [1, 6],
    [2, 5],
    [3, 4],
    [4, 3],
    [5, 2],
    [6, 1],
    [20, 1],
  ])('placing %i earns %i points including participation', (placing, pts) => {
    expect(leaguePointsFor(night('A', placing))).toBe(pts);
  });

  it('gives a team that left only the participation point', () => {
    expect(leaguePointsFor(night('A', null))).toBe(1);
  });

  it('gives a team that answered nothing no points, whatever its placing', () => {
    expect(leaguePointsFor(night('A', 1, { answered: false }))).toBe(0);
    expect(leaguePointsFor(night('A', null, { answered: false }))).toBe(0);
  });
});

describe('buildLeagueTable', () => {
  it('is empty for a league with no nights', () => {
    expect(buildLeagueTable([])).toEqual([]);
  });

  it('sums points over nights and counts nights played and won', () => {
    const table = buildLeagueTable([
      night('Alpha', 1),
      night('Beta', 2),
      night('Alpha', 2),
      night('Beta', 1),
      night('Beta', 3),
    ]);

    expect(table).toEqual([
      expect.objectContaining({
        teamName: 'Beta',
        leaguePoints: 6 + 5 + 4,
        nightsPlayed: 3,
        nightsWon: 1,
        averagePlacing: 2,
        position: 1,
      }),
      expect.objectContaining({
        teamName: 'Alpha',
        leaguePoints: 6 + 5,
        nightsPlayed: 2,
        nightsWon: 1,
        averagePlacing: 1.5,
        position: 2,
      }),
    ]);
  });

  it('gives tied teams the full points of their shared place', () => {
    const table = buildLeagueTable([night('A', 2), night('B', 2)]);

    expect(table.map((row) => row.leaguePoints)).toEqual([5, 5]);
  });

  it('credits a night won to every team tied for first', () => {
    const table = buildLeagueTable([night('A', 1), night('B', 1)]);

    expect(table.map((row) => row.nightsWon)).toEqual([1, 1]);
  });

  it('counts a left team as played with the participation point and no placing', () => {
    const [row] = buildLeagueTable([night('A', null)]);

    expect(row).toMatchObject({
      leaguePoints: 1,
      nightsPlayed: 1,
      nightsWon: 0,
      averagePlacing: null,
    });
  });

  it('leaves out a team that never answered', () => {
    const table = buildLeagueTable([
      night('Ghost', 1, { answered: false }),
      night('Real', 2),
    ]);

    expect(table.map((row) => row.teamName)).toEqual(['Real']);
  });

  it('does not count a night nobody answered in towards nights played', () => {
    const [row] = buildLeagueTable([
      night('A', 3),
      night('A', 1, { answered: false }),
    ]);

    expect(row).toMatchObject({ nightsPlayed: 1, averagePlacing: 3 });
  });

  describe('tie-breaks', () => {
    it('splits equal points by more nights won', () => {
      // A: 6 + 1 (1st, then 9th) = 7 pts; B: 5 + 2 = 7 pts (2nd, 5th), no win.
      const table = buildLeagueTable([
        night('B', 2),
        night('B', 5),
        night('A', 1),
        night('A', 9),
      ]);

      expect(table.map((row) => [row.teamName, row.leaguePoints])).toEqual([
        ['A', 7],
        ['B', 7],
      ]);
      expect(table.map((row) => row.position)).toEqual([1, 2]);
    });

    it('then by better average placing', () => {
      const table = buildLeagueTable([
        // D: 2nd (5) + 8th (1) = 6 pts, average 5
        night('D', 2),
        night('D', 8),
        // C: 4th (3) + 4th (3) = 6 pts, average 4
        night('C', 4),
        night('C', 4),
      ]);

      expect(table.map((row) => [row.teamName, row.averagePlacing])).toEqual([
        ['C', 4],
        ['D', 5],
      ]);
      expect(table.map((row) => row.position)).toEqual([1, 2]);
    });

    it('compares the unrounded average, rounding only for display', () => {
      // Both: 4 nights, 4 points (nothing placed in the top 5), displayed 6.3.
      // X: 6th, 6th, 7th and one night left -> 6.333; Y: 6th, 6th, 6th, 7th -> 6.25.
      const table = buildLeagueTable([
        night('X', 6),
        night('X', 6),
        night('X', 7),
        night('X', null),
        night('Y', 6),
        night('Y', 6),
        night('Y', 6),
        night('Y', 7),
      ]);

      expect(table.map((row) => [row.teamName, row.averagePlacing])).toEqual([
        ['Y', 6.3],
        ['X', 6.3],
      ]);
      expect(table.map((row) => row.position)).toEqual([1, 2]);
    });

    it('ranks a team with no placing below one with the same record that placed', () => {
      // E: 1 night left = 1 pt; F: 7th = 1 pt with a placing.
      const table = buildLeagueTable([night('E', null), night('F', 7)]);

      expect(table.map((row) => row.teamName)).toEqual(['F', 'E']);
      expect(table.map((row) => row.position)).toEqual([1, 2]);
    });

    it('does not share a position when only the league points differ', () => {
      // Both average 6th and won no night; P has 2 points, Q has 1.
      const table = buildLeagueTable([
        night('Q', 6),
        night('P', 6),
        night('P', 6),
      ]);

      expect(table.map((row) => [row.teamName, row.position])).toEqual([
        ['P', 1],
        ['Q', 2],
      ]);
    });

    it('does not share a position when only the nights won differ', () => {
      // Both placed 1st once for 6 points, but only P is credited the night.
      const table = buildLeagueTable([
        night('Q', 1, { wonNight: false }),
        night('P', 1),
      ]);

      expect(table.map((row) => [row.teamName, row.position])).toEqual([
        ['P', 1],
        ['Q', 2],
      ]);
    });

    it('lists teams that both have no placing by name, whatever the input order', () => {
      const forwards = buildLeagueTable([
        night('Amy', null),
        night('Zed', null),
      ]);
      const backwards = buildLeagueTable([
        night('Zed', null),
        night('Amy', null),
      ]);

      expect(forwards.map((row) => row.teamName)).toEqual(['Amy', 'Zed']);
      expect(backwards.map((row) => row.teamName)).toEqual(['Amy', 'Zed']);
    });

    it('lists teams with the same name by team id', () => {
      const forwards = buildLeagueTable([
        night('Twin', 2, { teamId: 3 }),
        night('Twin', 2, { teamId: 9 }),
      ]);
      const backwards = buildLeagueTable([
        night('Twin', 2, { teamId: 9 }),
        night('Twin', 2, { teamId: 3 }),
      ]);

      expect(forwards.map((row) => row.teamId)).toEqual([3, 9]);
      expect(backwards.map((row) => row.teamId)).toEqual([3, 9]);
    });

    it('otherwise shares the position and lists by name', () => {
      const table = buildLeagueTable([
        night('Zed', 2),
        night('Amy', 2),
        night('Mid', 3),
      ]);

      expect(table.map((row) => [row.teamName, row.position])).toEqual([
        ['Amy', 1],
        ['Zed', 1],
        ['Mid', 3],
      ]);
    });
  });
});
