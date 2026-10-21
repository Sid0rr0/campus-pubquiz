import { getBlockInPlay } from './block-in-play';
import { isGradedStatus, isQuestionOnAirStatus } from './game-state-groups';
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

/**
 * True while the prior standings (more than one team) have every team still
 * tied, e.g. everyone on 0 before the game's first block. Comparing ranks
 * against that tie would hand a dash to the new leader and a down arrow to
 * everyone else, so every team shows as having moved up onto the board.
 */
function isAllTied(priorStandings: LeaderboardEntry[]): boolean {
  return (
    priorStandings.length > 1 &&
    new Set(priorStandings.map((entry) => entry.totalPoints)).size === 1
  );
}

function rankTrend(currentRank: number, previousRank: number): RankTrend {
  if (currentRank < previousRank) return 'up';
  if (currentRank > previousRank) return 'down';
  return 'same';
}

/**
 * Rank movement of each shown team against the prior standings, in every
 * round. A team missing from them (it joined after they were taken) has none,
 * and so has every team when there are none (after a backend restart, until
 * the next block's first question opens).
 */
function describeTrends(
  { priorStandings }: SessionState,
  entries: LeaderboardEntry[],
): Record<number, RankTrend> {
  const isForcedUp = isAllTied(priorStandings);
  const previousRankByTeamId = new Map(
    rankTeams(priorStandings).map((team) => [team.teamId, team.rank]),
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

/** A question is on air and the leaderboard is not covering it: teams can see it and answer. */
function isQuestionBeingAnswered({ progress }: SessionState): boolean {
  return (
    isQuestionOnAirStatus(progress.status) && !progress.isLeaderboardVisible
  );
}

/** The question on air's id when it is the first question of the block in play, else null. */
function blockIdOpenedOnAir(session: SessionState): number | null {
  const { roundIndex, questionIndex } = session.progress;
  const [blockStart] = getBlockInPlay(
    session.seededGame.rounds,
    session.progress,
  );
  const isBlockStart =
    blockStart !== undefined &&
    blockStart.roundIndex === roundIndex &&
    blockStart.questionIndex === questionIndex;
  return isBlockStart ? blockStart.questionId : null;
}

/**
 * The session a write ends with, its prior standings brought up to date. The
 * write that first puts the block in play's first question in front of the
 * teams (on air, leaderboard hidden, from anything that wasn't, and not
 * stepping back into it out of a graded status) makes the leaderboard it
 * started from the prior standings, tagged with that block. Nothing scored in
 * the block has landed yet, so it is the board before the block. A later
 * question or round of the block, Previous and Advance back into its first
 * question, and a leaderboard toggle over it take nothing, since the prior
 * standings are already this block's. In a kahoot round every question is its
 * own block. Pure: the Session write applies it once per write, before the
 * new standings are read.
 */
export function withPriorStandings(
  started: SessionState,
  session: SessionState,
): SessionState {
  const isQuestionOpening =
    isQuestionBeingAnswered(session) &&
    !isQuestionBeingAnswered(started) &&
    !isGradedStatus(started.progress.status);
  if (!isQuestionOpening) return session;
  const blockId = blockIdOpenedOnAir(session);
  if (blockId === null || blockId === session.priorStandingsBlockId) {
    return session;
  }
  return {
    ...session,
    priorStandings: started.leaderboard,
    priorStandingsBlockId: blockId,
  };
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
