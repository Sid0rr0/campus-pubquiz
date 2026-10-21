import { getBlockInPlay } from './block-in-play';
import {
  isCurrentRoundKahoot,
  isQuestionHiddenBehindKahootLeaderboard,
} from './kahoot-visibility';
import { capLeaderboard } from './leaderboard-tiebreak';
import { rankTeams } from './ranking-rule';
import type {
  LeaderboardBoard,
  LeaderboardEntry,
  RankTrend,
} from './room-views';
import type { SessionState } from './session-state';

/** The trend basis: the board a team's rank is compared against, and whether it is a real prior board. */
interface TrendBasis {
  board: LeaderboardEntry[];
  /** False for the round-backed-out approximation. */
  isPriorBoard: boolean;
}

function zeroedOut(entry: LeaderboardEntry): LeaderboardEntry {
  return {
    ...entry,
    totalPoints: 0,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}

/**
 * The board the between-questions leaderboard counts up from: the teams that
 * will be on screen once it settles (the capped entries, chosen by final
 * standing) on their prior totals, in prior order. A team with no prior record
 * starts from 0. Absent when the session has no prior standings (after a
 * backend restart) — the board then simply draws settled.
 */
function describeCountUpBoard(
  session: SessionState,
  entries: LeaderboardEntry[],
): LeaderboardEntry[] | undefined {
  if (session.priorStandings.length === 0) return undefined;
  const shownTeamIds = new Set(entries.map((entry) => entry.teamId));
  const priorTeamIds = new Set(
    session.priorStandings.map((entry) => entry.teamId),
  );
  const fromPriorBoard = session.priorStandings.filter((entry) =>
    shownTeamIds.has(entry.teamId),
  );
  const newcomers = entries
    .filter((entry) => !priorTeamIds.has(entry.teamId))
    .map(zeroedOut);
  return rankTeams([...fromPriorBoard, ...newcomers]);
}

/** The rounds the board's latest scoring came from: every round of the block in play (graded and revealed together), and always the current round. */
function roundIndexesOfLatestScoring(session: SessionState): Set<number> {
  const blockRoundIndexes = getBlockInPlay(
    session.seededGame.rounds,
    session.progress,
  ).map(({ roundIndex }) => roundIndex);
  return new Set([...blockRoundIndexes, session.progress.roundIndex]);
}

/** This team's cumulative total with just those rounds' points removed. */
function totalBeforeRounds(
  entry: LeaderboardEntry,
  roundIndexes: Set<number>,
): number {
  const removed = [...roundIndexes].reduce(
    (sum, roundIndex) => sum + (entry.roundPoints[roundIndex]?.points ?? 0),
    0,
  );
  return entry.totalPoints - removed;
}

/**
 * The board to compare ranks against: the prior standings in a kahoot round
 * (a round can span several questions, so backing the round out would net out
 * more than the last one), otherwise the standings with the points of the
 * whole block in play backed out (a block can span several rounds, all scored
 * together at its break).
 */
function describeTrendBasis(session: SessionState): TrendBasis {
  if (isCurrentRoundKahoot(session) && session.priorStandings.length > 0) {
    return { board: session.priorStandings, isPriorBoard: true };
  }
  const roundIndexes = roundIndexesOfLatestScoring(session);
  return {
    board: session.leaderboard.map((entry) => ({
      ...entry,
      totalPoints: totalBeforeRounds(entry, roundIndexes),
    })),
    isPriorBoard: false,
  };
}

/**
 * True while a real prior board (more than one team) has every team still
 * tied, e.g. everyone on 0 before the game's first kahoot question. Comparing
 * ranks against that tie would hand a dash to the new leader and a down arrow
 * to everyone else, so every team shows as having moved up onto the board.
 */
function isAllTiedPriorBoard({ board, isPriorBoard }: TrendBasis): boolean {
  return (
    isPriorBoard &&
    board.length > 1 &&
    new Set(board.map((entry) => entry.totalPoints)).size === 1
  );
}

function rankTrend(currentRank: number, previousRank: number): RankTrend {
  if (currentRank < previousRank) return 'up';
  if (currentRank > previousRank) return 'down';
  return 'same';
}

/** Rank movement of each shown team against the trend basis; a team missing from the basis has none. */
function describeTrends(
  session: SessionState,
  entries: LeaderboardEntry[],
): Record<number, RankTrend> {
  const basis = describeTrendBasis(session);
  const isForcedUp = isAllTiedPriorBoard(basis);
  const previousRankByTeamId = new Map(
    rankTeams(basis.board).map((team) => [team.teamId, team.rank]),
  );
  return Object.fromEntries(
    entries.flatMap((entry) => {
      const previousRank = previousRankByTeamId.get(entry.teamId);
      if (previousRank === undefined) return [];
      return [
        [entry.teamId, isForcedUp ? 'up' : rankTrend(entry.rank, previousRank)],
      ];
    }),
  );
}

/**
 * The leaderboard the big screen draws, decided once on the server: the
 * entries (capped for a kahoot round), the board to count up from (only for
 * the between-questions kahoot board, where the next question is already open
 * underneath), and each team's trend.
 */
export function describeLeaderboardBoard(
  session: SessionState,
): LeaderboardBoard {
  const entries = capLeaderboard(
    session.leaderboard,
    isCurrentRoundKahoot(session),
  );
  const isBetweenKahootQuestions =
    session.progress.status === 'question_open' &&
    isQuestionHiddenBehindKahootLeaderboard(session);
  const countUpBoard = isBetweenKahootQuestions
    ? describeCountUpBoard(session, entries)
    : undefined;
  return {
    entries,
    ...(countUpBoard === undefined ? {} : { countUpBoard }),
    trends: describeTrends(session, entries),
  };
}
