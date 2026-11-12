import { getBlockInPlay, getBlockRoundIndexes } from './block-in-play';
import { doubledRoundIdsOfTeam } from './doubled-rounds';
import { countPerfectRounds } from './perfect-rounds';
import { isGradedStatus, isQuestionOnAirStatus } from './game-state-groups';
import {
  isCurrentRoundQuickfire,
  isQuestionHiddenBehindQuickfireLeaderboard,
} from './quickfire-visibility';
import { capLeaderboard } from './leaderboard-tiebreak';
import { rankTeams } from './ranking-rule';
import { nearestHalfPoint } from './score-math';
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
 * standings are already this block's. In a quickfire round every question is its
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
 * The shown teams whose joker round, or a round they bought an extra joker for,
 * has a question in the block the prior standings were taken for, i.e. the
 * block just scored. Only while the
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
    .filter(({ teamId }) =>
      doubledRoundIdsOfTeam(
        session.jokers,
        session.funFactData.powerUps,
        teamId,
      ).some((roundId) => blockRoundIds.has(roundId)),
    )
    .map(({ teamId }) => teamId);
}

/**
 * Whether the board shows a block's results: from the prior standings' block
 * starting its results (its reveal_intro; with Early answer reveal, leaving its
 * break, which lands on the next block's fresh round intro) until the next
 * block's first question opens, plus the final board. In a quickfire round
 * only the between-questions board counts. A leaderboard brought up while a
 * block is answered, locked or in break is not.
 */
function isShowingBlockResults(
  { progress, priorStandings }: SessionState,
  isBetweenQuickfireQuestions: boolean,
  isQuickfire: boolean,
): boolean {
  // No prior standings (after a backend restart) means nothing to gain from.
  if (!progress.isLeaderboardVisible || !priorStandings) return false;
  if (progress.status === 'ended') return true;
  // The board after a quickfire round's last question is the next round's fresh round intro.
  const isFreshRoundIntro =
    progress.status === 'round_intro' && progress.furthestOpenIndex < 0;
  if (isQuickfire) return isBetweenQuickfireQuestions || isFreshRoundIntro;
  return (
    progress.status === 'reveal_intro' ||
    progress.status === 'reveal' ||
    isFreshRoundIntro
  );
}

/**
 * How many rounds of the prior standings' block each shown team had a Perfect
 * round in; teams with 0 are left out.
 */
function describePerfectRounds(
  session: SessionState,
  entries: LeaderboardEntry[],
): Record<number, number> {
  const { priorStandings, seededGame, funFactData } = session;
  if (!priorStandings) return {};
  const { rounds } = seededGame;
  const counts = countPerfectRounds(
    getBlockRoundIndexes(rounds, priorStandings.blockFirstQuestionId).map(
      (roundIndex) => rounds[roundIndex],
    ),
    funFactData.answers,
  );
  return Object.fromEntries(
    entries.flatMap(({ teamId }) => {
      const count = counts.get(teamId);
      return count === undefined ? [] : [[teamId, count]];
    }),
  );
}

/**
 * What each shown team gained against the prior standings, to the nearest half
 * point. A team missing from them, or on exactly 0, is left out.
 */
function describePointsGained(
  { priorStandings }: SessionState,
  entries: LeaderboardEntry[],
): Record<number, number> {
  const priorTotals = new Map(
    (priorStandings?.board ?? []).map((entry) => [
      entry.teamId,
      entry.totalPoints,
    ]),
  );
  return Object.fromEntries(
    entries.flatMap(({ teamId, totalPoints }) => {
      const prior = priorTotals.get(teamId);
      const gained =
        prior === undefined ? 0 : nearestHalfPoint(totalPoints - prior);
      return gained === 0 ? [] : [[teamId, gained]];
    }),
  );
}

/**
 * The leaderboard the big screen draws, decided once on the server: the
 * entries (capped for a quickfire round), the board to count up from (only for
 * the between-questions quickfire board, where the next question is already open
 * underneath), and each team's trend.
 */
export function describeLeaderboardBoard(
  session: SessionState,
): LeaderboardBoard {
  const isQuickfire = isCurrentRoundQuickfire(session);
  const entries = capLeaderboard(session.leaderboard, isQuickfire);
  const isBetweenQuickfireQuestions =
    session.progress.status === 'question_open' &&
    isQuestionHiddenBehindQuickfireLeaderboard(session);
  const countUpBoard = isBetweenQuickfireQuestions
    ? describeCountUpBoard(session, entries)
    : undefined;
  const jokerTeamIds = describeJokerTeamIds(session, entries);
  const isShowingResults = isShowingBlockResults(
    session,
    isBetweenQuickfireQuestions,
    isQuickfire,
  );
  const pointsGained = isShowingResults
    ? describePointsGained(session, entries)
    : undefined;
  const perfectRounds =
    isShowingResults && session.progress.status !== 'ended'
      ? describePerfectRounds(session, entries)
      : undefined;
  return {
    entries,
    ...(countUpBoard === undefined ? {} : { countUpBoard }),
    trends: describeTrends(session, entries),
    ...(jokerTeamIds.length === 0 ? {} : { jokerTeamIds }),
    ...(pointsGained === undefined ? {} : { pointsGained }),
    ...(perfectRounds === undefined ? {} : { perfectRounds }),
  };
}
