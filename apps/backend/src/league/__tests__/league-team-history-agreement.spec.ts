import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { buildLeagueTable, teamNightsOf } from '@/league/league-table.calc';
import { sessionResult } from '@/standings/session-result';
import type {
  DepartedTeam,
  SessionStandings,
} from '@/standings/standings.service';
import { summarizeTeamHistory, teamHistoryOf } from '@/team/team-history.calc';

function ranked(
  teamId: number,
  teamName: string,
  totalPoints: number,
  rank: number,
  rankTo = rank,
): LeaderboardEntry {
  return {
    teamId,
    teamName,
    totalPoints,
    rank,
    rankTo,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}

function departed(
  teamId: number,
  teamName: string,
  totalPoints: number,
): DepartedTeam {
  return {
    teamId,
    teamName,
    totalPoints,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}

function standingsOf(
  leaderboard: LeaderboardEntry[],
  left: DepartedTeam[] = [],
): SessionStandings {
  return {
    leaderboard,
    departed: left,
    participantCount: leaderboard.length + left.length,
    winner: leaderboard[0],
  };
}

const answered = (teamId: number) => ({
  questionId: 1,
  teamId,
  verdict: 'correct' as const,
  pointsAwarded: 1,
});

// Night 1: Alpha and Beta tie for first (Alpha is the session winner), Gamma
// is 3rd, Delta left. Night 2: Beta wins alone, Alpha is 2nd.
const night1 = sessionResult({
  standings: standingsOf(
    [
      ranked(1, 'Alpha', 5, 1, 2),
      ranked(2, 'Beta', 5, 1, 2),
      ranked(3, 'Gamma', 2, 3),
    ],
    [departed(4, 'Delta', 3)],
  ),
  questions: [{ id: 1, roundId: 1, type: 'free_text', points: 1 }],
  answers: [answered(1), answered(2), answered(3), answered(4)],
});
const night2 = sessionResult({
  standings: standingsOf([ranked(2, 'Beta', 4, 1), ranked(1, 'Alpha', 3, 2)]),
  questions: [{ id: 1, roundId: 1, type: 'free_text', points: 1 }],
  answers: [answered(1), answered(2)],
});

const sessions = [night1, night2].map((result, index) => ({
  gameSessionId: index + 1,
  name: `Night ${index + 1}`,
  playedAt: new Date(2026, 0, index + 1).toISOString(),
  result,
  playerCount: null,
}));

describe('the league and the team page agree on a night', () => {
  const leagueRows = buildLeagueTable(
    [night1, night2].flatMap((result) => teamNightsOf(result)),
  );

  it.each([
    [1, 'Alpha'],
    [2, 'Beta'],
    [3, 'Gamma'],
    [4, 'Delta'],
  ])('team %i (%s): nights won equal wins, placings match', (teamId) => {
    const history = teamHistoryOf(teamId, sessions);
    const summary = summarizeTeamHistory(history.rows, history.nightsWon);
    const leagueRow = leagueRows.find((r) => r.teamId === teamId)!;

    expect(leagueRow.nightsWon).toBe(summary.wins);
    expect(leagueRow.averagePlacing).toBe(summary.averagePlacing);
  });

  it('counts a tie for first as a win for both tied teams', () => {
    const wins = (teamId: number) => {
      const history = teamHistoryOf(teamId, sessions);
      return summarizeTeamHistory(history.rows, history.nightsWon).wins;
    };
    expect(wins(1)).toBe(1);
    expect(wins(2)).toBe(2);
    expect(wins(3)).toBe(0);
  });

  it('gives a team that left no win and no placing on both', () => {
    const history = teamHistoryOf(4, sessions);
    expect(history.rows.map((r) => r.placing)).toEqual([null]);
    expect(summarizeTeamHistory(history.rows, history.nightsWon).wins).toBe(0);
    expect(leagueRows.find((r) => r.teamId === 4)).toEqual(
      expect.objectContaining({ nightsWon: 0, averagePlacing: null }),
    );
  });
});
