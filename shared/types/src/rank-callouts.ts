import { getBlockRoundIndexes } from './block-in-play';
import { doubledRoundIdsOfTeam } from './doubled-rounds';
import { isShowingBlockResults } from './leaderboard-board';
import { ordinal } from './ordinal';
import { countPerfectRounds } from './perfect-rounds';
import { isCurrentRoundQuickfire } from './quickfire-visibility';
import { rankTeams } from './ranking-rule';
import type { LeaderboardEntry } from './room-views';
import { nearestHalfPoint } from './score-math';
import type { SeededRound, SessionState } from './session-state';

/**
 * Rank callouts: what the quiz master can say about a team as the leaderboard
 * reveals its rank, worked out from the night's results. Pure and read by the
 * admin view only; teams and the big screen never see them.
 *
 * `describeBlockCallouts` is the reusable core: any block's board (live, a
 * past block, a quickfire round) feeds it that block's ranked entries and the
 * board before the block. `describeLiveRankBoard` is the live entry point.
 */

/** A team on a callout board, with the lines to read out about it. */
export interface RankCalloutTeam {
  teamId: number;
  teamName: string;
  rank: number;
  rankTo: number;
  totalPoints: number;
  callouts: string[];
}

/** The teams sharing one rank (a tie reveals as one step on the big screen). */
export interface RankCalloutGroup {
  rank: number;
  teams: RankCalloutTeam[];
}

/** The leaderboard on air: the group the latest Advance revealed and the one the next Advance reveals. */
export interface LiveRankBoard {
  current: RankCalloutGroup | null;
  next: RankCalloutGroup | null;
}

const MINUS = '−';

function pointsText(points: number): string {
  return `${points} ${points === 1 ? 'point' : 'points'}`;
}

function gainOf(
  entry: LeaderboardEntry,
  previous: ReadonlyMap<number, LeaderboardEntry>,
): number | null {
  const before = previous.get(entry.teamId);
  return before === undefined
    ? null
    : nearestHalfPoint(entry.totalPoints - before.totalPoints);
}

/** "Perfect round: Music 🔥", one line naming every perfect round of the block. */
function perfectRoundLine(
  teamId: number,
  blockRounds: readonly SeededRound[],
  answers: Parameters<typeof countPerfectRounds>[1],
): string[] {
  const titles = blockRounds
    .filter((round) => countPerfectRounds([round], answers).has(teamId))
    .map((round) => `${round.title} \u{1F525}`);
  if (titles.length === 0) return [];
  return [
    `Perfect ${titles.length === 1 ? 'round' : 'rounds'}: ${titles.join(', ')}`,
  ];
}

function movementLine(
  entry: LeaderboardEntry,
  previousRanks: ReadonlyMap<number, number>,
  isPreviousAllTied: boolean,
): string[] {
  const before = previousRanks.get(entry.teamId);
  if (before === undefined || isPreviousAllTied) return [];
  if (entry.rank < before) return [`up from ${ordinal(before)}`];
  if (entry.rank > before) return [`down from ${ordinal(before)}`];
  return [`holds ${ordinal(entry.rank)}`];
}

function bonusLines(
  entry: LeaderboardEntry,
  before: LeaderboardEntry | undefined,
): string[] {
  const bonus = entry.positiveBonusPoints - (before?.positiveBonusPoints ?? 0);
  const penalty =
    entry.negativeBonusPoints - (before?.negativeBonusPoints ?? 0);
  return [
    ...(bonus > 0 ? [`+${bonus} bonus`] : []),
    ...(penalty < 0 ? [`${MINUS}${-penalty} penalty`] : []),
  ];
}

/** The gap to the group above, or the leader's margin; none for a lone team. */
function gapLine(
  entry: LeaderboardEntry,
  ranked: LeaderboardEntry[],
): string[] {
  const above = ranked.filter((other) => other.rank < entry.rank);
  if (above.length > 0) {
    const nearest = above.reduce((a, b) => (b.rank > a.rank ? b : a));
    return [
      `${pointsText(nearest.totalPoints - entry.totalPoints)} behind ${ordinal(nearest.rank)}`,
    ];
  }
  if (entry.rank !== entry.rankTo) return ['shares the lead'];
  const second = ranked.find((other) => other.rank > entry.rank);
  return second ? [`leads by ${entry.totalPoints - second.totalPoints}`] : [];
}

function tiedLine(
  entry: LeaderboardEntry,
  ranked: LeaderboardEntry[],
): string[] {
  const others = ranked
    .filter((o) => o.rank === entry.rank && o.teamId !== entry.teamId)
    .map((o) => o.teamName);
  return others.length === 0 ? [] : [`tied with ${others.join(', ')}`];
}

/**
 * The callouts of every team on a block's board, keyed by team id.
 *
 * @param ranked the board after the block (rankTeams order)
 * @param previous the board before the block: gains, movement and bonus are measured against it
 * @param blockFirstQuestionId the block, by its first question
 */
export function describeBlockCallouts(
  session: SessionState,
  blockFirstQuestionId: number,
  ranked: LeaderboardEntry[],
  previous: LeaderboardEntry[],
): Map<number, string[]> {
  const { rounds } = session.seededGame;
  const blockRounds = getBlockRoundIndexes(rounds, blockFirstQuestionId).map(
    (index) => rounds[index],
  );
  const blockRoundIds = new Set(blockRounds.map((round) => round.id));
  const previousById = new Map(previous.map((e) => [e.teamId, e]));
  const previousRanks = new Map(
    rankTeams(previous).map((e) => [e.teamId, e.rank]),
  );
  const isPreviousAllTied =
    previous.length > 1 &&
    new Set(previous.map((e) => e.totalPoints)).size === 1;
  const gains = new Map(ranked.map((e) => [e.teamId, gainOf(e, previousById)]));
  const biggest = Math.max(0, ...[...gains.values()].map((g) => g ?? 0));
  const { answers, powerUps } = session.funFactData;

  return new Map(
    ranked.map((entry) => {
      const gain = gains.get(entry.teamId) ?? 0;
      const jokerTitles = blockRounds
        .filter(
          (round) =>
            blockRoundIds.has(round.id) &&
            doubledRoundIdsOfTeam(
              session.jokers,
              powerUps,
              entry.teamId,
            ).includes(round.id),
        )
        .map((round) => round.title);
      return [
        entry.teamId,
        [
          ...perfectRoundLine(entry.teamId, blockRounds, answers),
          ...(gain > 0 ? [`+${gain} this block`] : []),
          ...movementLine(entry, previousRanks, isPreviousAllTied),
          ...(jokerTitles.length > 0
            ? [`Joker 2× on ${jokerTitles.join(', ')}`]
            : []),
          ...bonusLines(entry, previousById.get(entry.teamId)),
          ...gapLine(entry, ranked),
          ...tiedLine(entry, ranked),
          ...(biggest > 0 && gain === biggest
            ? ['biggest gain this block']
            : []),
        ],
      ];
    }),
  );
}

function toGroup(
  rank: number,
  ranked: LeaderboardEntry[],
  callouts: Map<number, string[]>,
): RankCalloutGroup {
  return {
    rank,
    teams: ranked
      .filter((entry) => entry.rank === rank)
      .map(({ teamId, teamName, rankTo, totalPoints }) => ({
        teamId,
        teamName,
        rank,
        rankTo,
        totalPoints,
        callouts: callouts.get(teamId) ?? [],
      })),
  };
}

/**
 * The board on air with its callouts, or null when the leaderboard is not
 * showing a block's results (quickfire and the final board are not covered
 * yet). It follows the session's reveal count over the same rank groups as the
 * big screen: before the first Advance only the next (lowest) group, after the
 * winner only the current one.
 */
export function describeLiveRankBoard(
  session: SessionState,
): LiveRankBoard | null {
  const { priorStandings, progress } = session;
  if (
    !priorStandings ||
    progress.status === 'ended' ||
    isCurrentRoundQuickfire(session) ||
    !isShowingBlockResults(session, false, false)
  ) {
    return null;
  }
  const ranked = rankTeams(session.leaderboard);
  const callouts = describeBlockCallouts(
    session,
    priorStandings.blockFirstQuestionId,
    ranked,
    priorStandings.board,
  );
  const ranks = [...new Set(ranked.map((entry) => entry.rank))].reverse();
  const shown = Math.min(
    Math.max(session.leaderboardRevealCount, 0),
    ranks.length,
  );
  const group = (index: number) =>
    index >= 0 && index < ranks.length
      ? toGroup(ranks[index], ranked, callouts)
      : null;
  return { current: group(shown - 1), next: group(shown) };
}
