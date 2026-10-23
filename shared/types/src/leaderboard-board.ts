import { getBlockInPlay, getBlockRoundIndexes } from './block-in-play';
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
  const priorBoard = session.priorStandings?.board ?? [];
  if (priorBoard.length === 0) return undefined;
  const shownTeamIds = new Set(entries.map((entry) => entry.teamId));
  const priorTeamIds = new Set(priorBoard.map((entry) => entry.teamId));
  const fromPriorBoard = priorBoard.filter((entry) =>
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
function isAllTied(priorBoard: LeaderboardEntry[]): boolean {
  return (
    priorBoard.length > 1 &&
    new Set(priorBoard.map((entry) => entry.totalPoints)).size === 1
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
  const priorBoard = priorStandings?.board ?? [];
  const isForcedUp = isAllTied(priorBoard);
  const previousRankByTeamId = new Map(
    rankTeams(priorBoard).map((team) => [team.teamId, team.rank]),
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

/** The block in play's first question id when that first question is the one on air, else null. */
function firstQuestionIdOfBlockOnAir(session: SessionState): number | null {
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
  const blockFirstQuestionId = firstQuestionIdOfBlockOnAir(session);
  if (
    blockFirstQuestionId === null ||
    blockFirstQuestionId === session.priorStandings?.blockFirstQuestionId
  ) {
    return session;
  }
  return {
    ...session,
    priorStandings: { board: started.leaderboard, blockFirstQuestionId },
  };
}

/**
 * The shown teams whose joker round has a question in the block the prior
 * standings were taken for, i.e. the block just scored. Only while the
 * leaderboard is on air, so a pick never leaves the server early.
 */
function describeJokerTeamIds(
  session: SessionState,
  entries: LeaderboardEntry[],
): number[] {
  const blockFirstQuestionId = session.priorStandings?.blockFirstQuestionId;
  if (
    !session.progress.isLeaderboardVisible ||
    blockFirstQuestionId === undefined
  ) {
    return [];
  }
  const { rounds } = session.seededGame;
  const blockRoundIds = new Set(
    getBlockRoundIndexes(rounds, blockFirstQuestionId).map(
      (roundIndex) => rounds[roundIndex].id,
    ),
  );
  return entries
    .filter(({ teamId }) => {
      const joker = session.jokers[teamId];
      return joker !== undefined && blockRoundIds.has(joker.roundId);
    })
    .map(({ teamId }) => teamId);
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
  const jokerTeamIds = describeJokerTeamIds(session, entries);
  return {
    entries,
    ...(countUpBoard === undefined ? {} : { countUpBoard }),
    trends: describeTrends(session, entries),
    ...(jokerTeamIds.length === 0 ? {} : { jokerTeamIds }),
  };
}
