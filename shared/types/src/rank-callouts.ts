import { getBlockInPlay, getBlockRoundIndexes } from './block-in-play';
import { doubledRoundIdsOfTeam } from './doubled-rounds';
import { isGradedStatus } from './game-state-groups';
import { isShowingBlockResults } from './leaderboard-board';
import { ordinal } from './ordinal';
import { countPerfectRounds } from './perfect-rounds';
import { capLeaderboard } from './leaderboard-tiebreak';
import {
  isCurrentRoundQuickfire,
  isQuestionHiddenBehindQuickfireLeaderboard,
} from './quickfire-visibility';
import { rankTeams } from './ranking-rule';
import type { LeaderboardEntry } from './room-views';
import { nearestHalfPoint } from './score-math';
import type {
  PriorStandings,
  SeededRound,
  SessionState,
} from './session-state';

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
  /** The team has left or was kicked; set on block boards only. */
  hasLeft?: boolean;
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
  /** Between quickfire questions: the whole board at once, best first (current and next are null). */
  all?: RankCalloutGroup[];
}

const MINUS = '−';

function pointsText(points: number): string {
  return `${points} ${points === 1 ? 'point' : 'points'}`;
}

function gainOf(
  entry: LeaderboardEntry,
  previous: ReadonlyMap<number, LeaderboardEntry>,
): number {
  const before = previous.get(entry.teamId);
  return before === undefined
    ? 0
    : nearestHalfPoint(entry.totalPoints - before.totalPoints);
}

/** Every team on the board before the block is on the same total. */
function isAllTied(previous: LeaderboardEntry[]): boolean {
  return (
    previous.length > 1 &&
    new Set(previous.map((e) => e.totalPoints)).size === 1
  );
}

/** "Perfect round: Music 🔥", one line naming every perfect round of the block. `perfectByRound` is each round's title with the teams perfect in it, worked out once per board. */
function perfectRoundLine(
  teamId: number,
  perfectByRound: readonly {
    title: string;
    teamIds: ReadonlyMap<number, number>;
  }[],
): string[] {
  const titles = perfectByRound
    .filter(({ teamIds }) => teamIds.has(teamId))
    .map(({ title }) => `${title} \u{1F525}`);
  if (titles.length === 0) return [];
  return [
    `Perfect ${titles.length === 1 ? 'round' : 'rounds'}: ${titles.join(', ')}`,
  ];
}

/** The final board's "3 perfect rounds tonight". */
function perfectTonightLine(count: number): string[] {
  return count === 0
    ? []
    : [`${count} perfect ${count === 1 ? 'round' : 'rounds'} tonight`];
}

/** "Joker 2× on Sport": the block's rounds the team doubled. */
function jokerLine(
  jokers: SessionState['jokers'],
  powerUps: SessionState['funFactData']['powerUps'],
  teamId: number,
  blockRounds: readonly SeededRound[],
): string[] {
  const doubled = doubledRoundIdsOfTeam(jokers, powerUps, teamId);
  const titles = blockRounds
    .filter((round) => doubled.includes(round.id))
    .map((round) => round.title);
  return titles.length === 0 ? [] : [`Joker 2× on ${titles.join(', ')}`];
}

function movementLine(
  entry: LeaderboardEntry,
  previousRanks: ReadonlyMap<number, number>,
  isPreviousAllTied: boolean,
  isFirstBlock: boolean,
): string[] {
  const before = previousRanks.get(entry.teamId);
  if (before === undefined || isFirstBlock) return [];
  // Everyone was tied before: like the big screen's trends, every team moved up.
  if (isPreviousAllTied) return ['moved up'];
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
  if (entry.rank !== entry.rankTo) return [];
  const second = ranked.find((other) => other.rank > entry.rank);
  return second ? [`leads by ${entry.totalPoints - second.totalPoints}`] : [];
}

/**
 * The callouts of every team on a block's board, keyed by team id.
 *
 * @param ranked the board after the block (rankTeams order)
 * @param previous the board before the block: gains, movement and bonus are measured against it
 * @param blockFirstQuestionId the block, by its first question
 * @param isFinal the final board: whole-quiz perfect rounds, no block-only lines
 */
export function describeBlockCallouts(
  session: SessionState,
  blockFirstQuestionId: number,
  ranked: LeaderboardEntry[],
  previous: LeaderboardEntry[],
  isFinal = false,
): Map<number, string[]> {
  const { rounds } = session.seededGame;
  const blockRounds = getBlockRoundIndexes(rounds, blockFirstQuestionId).map(
    (index) => rounds[index],
  );
  const previousById = new Map(previous.map((e) => [e.teamId, e]));
  const previousRanks = new Map(
    rankTeams(previous).map((e) => [e.teamId, e.rank]),
  );
  const isPreviousAllTied = isAllTied(previous);
  const isFirstBlock =
    rounds.flatMap((r) => r.questions)[0]?.id === blockFirstQuestionId;
  const biggest = Math.max(0, ...ranked.map((e) => gainOf(e, previousById)));
  const { answers, powerUps } = session.funFactData;
  const wholeQuizPerfect = isFinal
    ? countPerfectRounds(rounds, answers)
    : new Map<number, number>();
  const perfectByRound = isFinal
    ? []
    : blockRounds.map((round) => ({
        title: round.title,
        teamIds: countPerfectRounds([round], answers),
      }));

  return new Map(
    ranked.map((entry) => {
      const gain = gainOf(entry, previousById);
      const blockOnly = (lines: string[]) => (isFinal ? [] : lines);
      return [
        entry.teamId,
        [
          ...(isFinal
            ? perfectTonightLine(wholeQuizPerfect.get(entry.teamId) ?? 0)
            : perfectRoundLine(entry.teamId, perfectByRound)),
          ...blockOnly(gain > 0 ? [`+${gain} this block`] : []),
          ...movementLine(
            entry,
            previousRanks,
            isPreviousAllTied,
            isFirstBlock,
          ),
          ...blockOnly(
            jokerLine(session.jokers, powerUps, entry.teamId, blockRounds),
          ),
          ...blockOnly(bonusLines(entry, previousById.get(entry.teamId))),
          ...gapLine(entry, ranked),
          ...blockOnly(
            biggest > 0 && gain === biggest ? ['biggest gain this block'] : [],
          ),
        ],
      ];
    }),
  );
}

function toGroup(
  rank: number,
  ranked: LeaderboardEntry[],
  callouts: Map<number, string[]>,
  leftTeamIds?: ReadonlySet<number>,
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
        ...(leftTeamIds?.has(teamId) ? { hasLeft: true } : {}),
      })),
  };
}

/** One block's board in the question browser's 🏆 marker. */
export interface BlockBoard {
  /** The block's last round: the marker sits after that round's break marker. */
  roundIndex: number;
  blockFirstQuestionId: number;
  /** The block has been reached (its first question opened); a later block has no board. */
  isReached: boolean;
  /** The last block: the final board, whole-quiz lines. */
  isFinal: boolean;
  /** The block in play while its answers are still ungraded: totals are not final. */
  isGradingUnfinished: boolean;
  /** This board is the one on the big screen now. */
  isOnAir: boolean;
  /** Bottom-up like the reveal; empty until reached. */
  groups: RankCalloutGroup[];
}

interface BlockUnit {
  firstRoundIndex: number;
  lastRoundIndex: number;
  firstQuestionId: number;
  questionIds: Set<number>;
}

/** A block ends at a round with a break, at a quickfire round (one board per round) and at the last round. A quiz never mixes pub and quickfire rounds (ADR 0005), so a plain round never sits directly before a quickfire round and these boundaries match the Block module's. */
function blockUnits(rounds: readonly SeededRound[]): BlockUnit[] {
  const units: BlockUnit[] = [];
  let start = 0;
  rounds.forEach((round, index) => {
    if (!round.quickfire && !round.breakAfter && index < rounds.length - 1)
      return;
    const questionIds = rounds
      .slice(start, index + 1)
      .flatMap((r) => r.questions.map(({ id }) => id));
    if (questionIds.length > 0) {
      units.push({
        firstRoundIndex: start,
        lastRoundIndex: index,
        firstQuestionId: questionIds[0],
        questionIds: new Set(questionIds),
      });
    }
    start = index + 1;
  });
  return units;
}

/**
 * Every team's entry as the board after block `unitIndex` stood: round points
 * up to the block's last round plus bonus awards recorded for that block or
 * earlier (awards with no known block count in the latest reached board only).
 * Teams that left join once they have points or an award.
 */
function entriesAfterBlock(
  session: SessionState,
  units: BlockUnit[],
  unitIndex: number,
  latestReached: number,
): LeaderboardEntry[] {
  const departedIds = new Set(session.departedTeams.map((t) => t.teamId));
  const teams = [
    ...session.leaderboard,
    ...session.departedTeams.map((t) => ({ ...t, rank: 0, rankTo: 0 })),
  ];
  const unitOfAward = (blockFirstQuestionId: number | null) => {
    const found = units.findIndex((u) =>
      u.questionIds.has(blockFirstQuestionId ?? -1),
    );
    return found < 0 ? latestReached : found;
  };
  return rankTeams(
    teams.flatMap((team) => {
      const roundPoints = team.roundPoints.slice(
        0,
        units[unitIndex].lastRoundIndex + 1,
      );
      const awards = session.funFactData.bonusAwards.filter(
        (a) =>
          a.teamId === team.teamId &&
          unitOfAward(a.blockFirstQuestionId) <= unitIndex,
      );
      const positiveBonusPoints = awards
        .filter((a) => a.points > 0)
        .reduce((sum, a) => sum + a.points, 0);
      const negativeBonusPoints = awards
        .filter((a) => a.points < 0)
        .reduce((sum, a) => sum + a.points, 0);
      const quizPoints = roundPoints.reduce((sum, r) => sum + r.points, 0);
      const tookPart =
        !departedIds.has(team.teamId) ||
        awards.length > 0 ||
        roundPoints.some((r) => r.points !== 0);
      return tookPart
        ? [
            {
              ...team,
              roundPoints,
              positiveBonusPoints,
              negativeBonusPoints,
              bonusPoints: positiveBonusPoints + negativeBonusPoints,
              totalPoints:
                quizPoints + positiveBonusPoints + negativeBonusPoints,
            },
          ]
        : [];
    }),
  );
}

/**
 * The board before block `unitIndex`, which its gains, movement and bonus are
 * measured against: the block before's board, or for the first block the same
 * teams all on 0 (the live board uses it too, so it never disagrees with the 🏆 board).
 */
function previousBoardOf(
  session: SessionState,
  units: BlockUnit[],
  unitIndex: number,
  latestReached: number,
): LeaderboardEntry[] {
  return unitIndex > 0
    ? entriesAfterBlock(session, units, unitIndex - 1, latestReached)
    : zeroedBoard(entriesAfterBlock(session, units, 0, latestReached));
}

/** The same teams with no points, all tied: the board before the first block. */
function zeroedBoard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.map((e) => ({
    ...e,
    totalPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    rank: 1,
    rankTo: entries.length,
  }));
}

/**
 * The 🏆 boards of the question browser: one per block (per round in a
 * quickfire quiz), each rebuilt from the per-round points and the bonus
 * awards. Blocks not reached yet carry no teams. Gains and movement compare
 * with the block before; the first block compares with everyone on 0.
 */
export function describeBlockBoards(session: SessionState): BlockBoard[] {
  const { rounds } = session.seededGame;
  const units = blockUnits(rounds);
  const reached = units.map((u) =>
    session.openedQuestionIds.includes(u.firstQuestionId),
  );
  const latestReached = reached.lastIndexOf(true);
  const live = describeLiveRankBoard(session);
  const liveBlockId = session.priorStandings?.blockFirstQuestionId;
  const leftIds = new Set(session.departedTeams.map((t) => t.teamId));
  // ungradedQuestionIds is only trusted once the block's grading statuses are reached.
  const isBlockInPlayUngraded =
    getBlockInPlay(session.seededGame.rounds, session.progress).length > 0 &&
    !isGradedStatus(session.progress.status);
  return units.map((unit, index) => {
    const isFinal = index === units.length - 1;
    const base = {
      roundIndex: unit.lastRoundIndex,
      blockFirstQuestionId: unit.firstQuestionId,
      isReached: reached[index],
      isFinal,
      isGradingUnfinished:
        index === latestReached &&
        (isBlockInPlayUngraded || session.ungradedQuestionIds.length > 0),
      isOnAir:
        live !== null &&
        live.all === undefined &&
        liveBlockId !== undefined &&
        unit.questionIds.has(liveBlockId),
    };
    if (!reached[index]) return { ...base, groups: [] };
    const ranked = entriesAfterBlock(session, units, index, latestReached);
    const callouts = describeBlockCallouts(
      session,
      unit.firstQuestionId,
      ranked,
      previousBoardOf(session, units, index, latestReached),
      isFinal,
    );
    const ranks = [...new Set(ranked.map((e) => e.rank))].reverse();
    return {
      ...base,
      groups: ranks.map((rank) => toGroup(rank, ranked, callouts, leftIds)),
    };
  });
}

/** The between-questions quickfire board: each team's gain since the previous question, nothing else. */
function describeGainCallouts(
  ranked: LeaderboardEntry[],
  previous: LeaderboardEntry[],
): Map<number, string[]> {
  const previousById = new Map(previous.map((e) => [e.teamId, e]));
  return new Map(
    ranked.map((entry) => {
      const gain = gainOf(entry, previousById);
      return [entry.teamId, gain > 0 ? [`+${gain}`] : []];
    }),
  );
}

/**
 * The callouts of the block just scored, measured the way its 🏆 board is:
 * after a quickfire round against the board before the whole round (the prior
 * standings only know its last question), and in the first block against
 * everyone on 0 (so a lobby bonus counts in its gain).
 */
function describeLiveBlockCallouts(
  session: SessionState,
  prior: PriorStandings,
  ranked: LeaderboardEntry[],
): Map<number, string[]> {
  const isFinal = session.progress.status === 'ended';
  const units = blockUnits(session.seededGame.rounds);
  const unitIndex = units.findIndex((u) =>
    u.questionIds.has(prior.blockFirstQuestionId),
  );
  if (unitIndex < 0) {
    return describeBlockCallouts(
      session,
      prior.blockFirstQuestionId,
      ranked,
      prior.board,
      isFinal,
    );
  }
  const unit = units[unitIndex];
  let previous = unitIndex === 0 ? zeroedBoard(prior.board) : prior.board;
  if (unit.firstQuestionId !== prior.blockFirstQuestionId) {
    const latestReached = units.findLastIndex((u) =>
      session.openedQuestionIds.includes(u.firstQuestionId),
    );
    previous = previousBoardOf(session, units, unitIndex, latestReached);
  }
  return describeBlockCallouts(
    session,
    unit.firstQuestionId,
    ranked,
    previous,
    isFinal,
  );
}

/**
 * The board on air with its callouts, or null when the leaderboard is not
 * showing a block's results. It follows the session's reveal count over the
 * same rank groups as the big screen: before the first Advance only the next
 * (lowest) group, after the winner only the current one. The board between
 * quickfire questions appears all at once, so it is the top teams in `all`
 * with no current/next split.
 */
export function describeLiveRankBoard(
  session: SessionState,
): LiveRankBoard | null {
  const { priorStandings, progress } = session;
  const isQuickfire = isCurrentRoundQuickfire(session);
  const isBetweenQuickfire =
    progress.status === 'question_open' &&
    isQuestionHiddenBehindQuickfireLeaderboard(session);
  if (
    !priorStandings ||
    !isShowingBlockResults(session, isBetweenQuickfire, isQuickfire)
  ) {
    return null;
  }
  const ranked = capLeaderboard(session.leaderboard, isQuickfire);
  const callouts = isBetweenQuickfire
    ? describeGainCallouts(ranked, priorStandings.board)
    : describeLiveBlockCallouts(session, priorStandings, ranked);
  if (isBetweenQuickfire) {
    const ranks = [...new Set(ranked.map((entry) => entry.rank))];
    return {
      current: null,
      next: null,
      all: ranks.map((rank) => toGroup(rank, ranked, callouts)),
    };
  }
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
