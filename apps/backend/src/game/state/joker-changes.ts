import {
  canChooseJoker,
  canSetJoker,
  drawJoker,
  hasJokerPickOpened,
  isJokerPickOpen,
  pickableRounds,
  type PickJokerPayload,
  type SetTeamJokerPayload,
  type SessionState,
  type TeamJoker,
} from '@campus-pubquiz/types';
import { JokerService } from '@/joker/joker.service';
import { TeamService } from '@/team/team.service';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import type { SessionChange } from '@/game/state/session-write';
import { requireSeat } from '@/game/state/session-updates.util';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type JokerSync,
  type SessionOutcome,
} from '@/game/state/session-outcome';

/** A value in [0, 1) like `Math.random`; injected so a spec can make a draw deterministic. */
export type RandomSource = () => number;

/** Injection token for swapping the draw's random source; nothing provides it in production, so draws use `Math.random`. */
export const JOKER_RANDOM = Symbol('JOKER_RANDOM');

/** The jokers of a session once the pick closed, and the connected teams whose phones must be told theirs. */
export interface ClosedJokerPick {
  session: SessionState;
  jokerSyncs: JokerSync[];
}

/**
 * The joker change module: the team's pick during the joker pick, and the
 * close of the pick, which gives a drawn joker to every team without one.
 * Follows the pattern set out on SessionSettingsChanges. A refused pick is
 * thrown before anything is stored.
 */
export class JokerChanges {
  constructor(
    private readonly jokerService: JokerService,
    private readonly teamService: TeamService,
    private readonly random: RandomSource,
  ) {}

  /**
   * A team chooses `roundId` as its joker from `socketId`, replacing its
   * earlier choice (last write wins). Refused unless the socket owns a team,
   * the pick is open and the round has no opened question. Only the team's own
   * phones are told which round; the admin room and the big screen get a fresh
   * view of themselves (the big screen ticks the team off, never naming the
   * round), and the players room hears nothing.
   */
  async pick(
    session: SessionState,
    { roundId }: PickJokerPayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    const teamId = requireSeat(
      session,
      socketId,
      'Join a team before picking a joker',
    );
    if (!isJokerPickOpen(session)) {
      throw new SessionRefusal('The joker pick is not open');
    }
    const pickableRoundIds = pickableRoundIdsOf(session);
    if (!canChooseJoker({ isPickOpen: true, pickableRoundIds }, roundId)) {
      throw new SessionRefusal(
        'That round cannot be your joker: it has already started',
      );
    }
    await this.refuseDoubledRound(session, teamId, roundId);
    return await this.storeJoker(
      session,
      teamId,
      { roundId, source: 'chosen' },
      { shouldBroadcastDisplayState: true },
    );
  }

  /**
   * The quiz master gives a team `roundId` as its joker, whatever the team had.
   * Refused for a team not on the roster, when the session plays without
   * jokers, before the pick has opened, or for a round with an opened question.
   * The team's phones are told its new joker (a toast there, since it did not
   * pick it) and the admin room gets a fresh view of itself; the big screen and
   * the players room hear nothing. Moves standings once jokers double.
   */
  async setTeamJoker(
    session: SessionState,
    { teamId, roundId }: SetTeamJokerPayload,
  ): Promise<SessionChange<SessionOutcome>> {
    if (!session.teams.some((team) => team.teamId === teamId)) {
      throw new SessionRefusal(`Team ${teamId} is not in this session`);
    }
    const canSet = canSetJoker(
      {
        isEnabled: session.seededGame.settings.jokersEnabled,
        status: session.progress.status,
        pickableRoundIds: pickableRoundIdsOf(session),
      },
      roundId,
    );
    if (!canSet) {
      throw new SessionRefusal(
        'That round cannot be the joker: it has already started, or the joker pick has not opened',
      );
    }
    await this.refuseDoubledRound(session, teamId, roundId);
    return await this.storeJoker(
      session,
      teamId,
      { roundId, source: 'set_by_quiz_master' },
      {},
    );
  }

  /** Refuses a joker on a round the team bought an extra joker for: the two would not stack. */
  private async refuseDoubledRound(
    session: SessionState,
    teamId: number,
    roundId: number,
  ): Promise<void> {
    const extra = await this.jokerService.extraJokerRoundIds(
      session.seededGame.gameSessionId,
      teamId,
    );
    if (extra.includes(roundId)) {
      throw new SessionRefusal(
        'That round is already doubled by an extra joker',
      );
    }
  }

  /** The rounds a joker may be drawn for the team: those with no opened question and no extra joker. */
  private async drawableRoundIds(
    session: SessionState,
    teamId: number,
  ): Promise<number[]> {
    const extra = await this.jokerService.extraJokerRoundIds(
      session.seededGame.gameSessionId,
      teamId,
    );
    return pickableRoundIdsOf(session).filter((id) => !extra.includes(id));
  }

  /** Saves `joker` for the team, then tells its phones and refreshes the admin room (and the big screen when asked). */
  private async storeJoker(
    session: SessionState,
    teamId: number,
    joker: TeamJoker,
    broadcast: { shouldBroadcastDisplayState?: boolean },
  ): Promise<SessionChange<SessionOutcome>> {
    await this.jokerService.set(
      session.seededGame.gameSessionId,
      teamId,
      joker,
    );
    return {
      session: withJoker(session, teamId, joker),
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        shouldBroadcastState: false,
        shouldBroadcastAdminState: true,
        ...broadcast,
        jokerSyncs: jokerSyncsFor(session, [teamId], { [teamId]: joker }),
      },
      touchedScores: true,
    };
  }

  /**
   * Closes the pick `session` is leaving: every team on the roster without a
   * joker is given one drawn with equal chance among the rounds with no opened
   * question. Reads the stored jokers and roster, not the caches, so a team
   * that picked before a restart or has not rejoined since is neither
   * overwritten nor skipped. Every connected team is told its joker.
   */
  async closePick(session: SessionState): Promise<ClosedJokerPick> {
    const { gameSessionId } = session.seededGame;
    const stored = await this.jokerService.listForSession(gameSessionId);
    const roster = await this.teamService.listForSession(gameSessionId);

    const jokers: Record<number, TeamJoker> = Object.fromEntries(stored);
    for (const { teamId } of roster) {
      if (jokers[teamId]) continue;
      const roundId = drawJoker(
        await this.drawableRoundIds(session, teamId),
        this.random,
      );
      if (roundId === null) continue;
      const drawn: TeamJoker = { roundId, source: 'drawn' };
      await this.jokerService.set(gameSessionId, teamId, drawn);
      jokers[teamId] = drawn;
    }
    return {
      session: { ...session, jokers },
      jokerSyncs: jokerSyncsFor(
        session,
        roster.map(({ teamId }) => teamId),
        jokers,
      ),
    };
  }

  /**
   * Reopens the pick `session` is entering: drawn jokers are cleared so those
   * teams get a real chance to choose (a fresh draw follows if they still
   * don't), while chosen and quiz-master-set ones stay. Every connected team
   * whose drawn joker was cleared is told it has none.
   */
  async reopenPick(session: SessionState): Promise<ClosedJokerPick> {
    const clearedTeamIds = await this.jokerService.clearDrawn(
      session.seededGame.gameSessionId,
    );
    const cleared = new Set(clearedTeamIds);
    const jokers = Object.fromEntries(
      Object.entries(session.jokers).filter(
        ([teamId]) => !cleared.has(Number(teamId)),
      ),
    );
    return {
      session: { ...session, jokers },
      jokerSyncs: jokerSyncsFor(session, clearedTeamIds, jokers),
    };
  }

  /**
   * A team that joined after the pick closed and holds no joker is drawn one
   * from the rounds with no opened question. Returns the drawn joker, or null
   * when the team needs none: it holds one, the session plays without jokers,
   * the pick has not closed yet (it is drawn one when it does, or may still
   * choose), or no round is left to draw.
   */
  async drawForLateJoiner(
    session: SessionState,
    teamId: number,
    held: TeamJoker | null,
  ): Promise<TeamJoker | null> {
    const { status } = session.progress;
    const isPickClosed =
      hasJokerPickOpened(status) &&
      status !== 'joker_pick' &&
      status !== 'ended';
    if (held || !session.seededGame.settings.jokersEnabled || !isPickClosed) {
      return null;
    }
    const roundId = drawJoker(
      await this.drawableRoundIds(session, teamId),
      this.random,
    );
    if (roundId === null) return null;
    const drawn: TeamJoker = { roundId, source: 'drawn' };
    await this.jokerService.set(
      session.seededGame.gameSessionId,
      teamId,
      drawn,
    );
    return drawn;
  }

  /**
   * Keeps every team's joker on its round after a live edit reloaded the
   * quiz (`reloaded`; `started` is the session before the reload). A round
   * keeps its identity through its questions: the round now holding the
   * joker round's questions is the joker's round, whatever row or position it
   * sits on. A joker whose round is gone (none of its questions is left) is
   * drawn anew from the rounds with no opened question, and its team is told.
   * Done inside the live-edit save. Stored and cached jokers move together.
   */
  async followRoundsAfterEdit(
    started: SessionState,
    reloaded: SessionState,
  ): Promise<{ session: SessionState; jokerSyncs: JokerSync[] }> {
    const held = Object.entries(started.jokers);
    // Stryker disable next-line ConditionalExpression: a pure shortcut; without it the loop below runs zero times and returns the same syncs and an empty jokers cache
    if (held.length === 0) return { session: reloaded, jokerSyncs: [] };

    const { gameSessionId } = reloaded.seededGame;
    const pickableRoundIds = pickableRoundIdsOf(reloaded);
    const jokers: Record<number, TeamJoker> = {};
    const changedTeamIds: number[] = [];
    for (const [key, joker] of held) {
      const teamId = Number(key);
      const followed = roundNowHolding(started, reloaded, joker.roundId);
      const extra = await this.jokerService.extraJokerRoundIds(
        gameSessionId,
        teamId,
      );
      let next: TeamJoker | null = joker;
      if (followed === null || extra.includes(followed)) {
        // Gone, or moved onto a round the team doubles with an extra joker: draw anew.
        const roundId = drawJoker(
          pickableRoundIds.filter((id) => !extra.includes(id)),
          this.random,
        );
        next = roundId === null ? null : { roundId, source: 'drawn' };
      } else if (followed !== joker.roundId) {
        next = { ...joker, roundId: followed };
      }
      if (next !== null) jokers[teamId] = next;
      if (next === joker) continue;
      if (next !== null) {
        await this.jokerService.set(gameSessionId, teamId, next);
      }
      changedTeamIds.push(teamId);
    }
    return {
      session: { ...reloaded, jokers },
      jokerSyncs: jokerSyncsFor(reloaded, changedTeamIds, jokers),
    };
  }

  /** Every stored joker of the session by team id, for a session being placed. */
  async loadAll(gameSessionId: number): Promise<Record<number, TeamJoker>> {
    return Object.fromEntries(
      await this.jokerService.listForSession(gameSessionId),
    );
  }

  /** The team's stored joker, or null, for a team joining or rejoining. */
  async loadForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<TeamJoker | null> {
    return await this.jokerService.getForTeam(gameSessionId, teamId);
  }
}

/** The session with `teamId`'s joker cached; a null joker (none stored) leaves the cache as it was. */
export function withJoker(
  session: SessionState,
  teamId: number,
  joker: TeamJoker | null,
): SessionState {
  return joker === null
    ? session
    : { ...session, jokers: { ...session.jokers, [teamId]: joker } };
}

/** The ids of the session's rounds with no opened question. */
function pickableRoundIdsOf(session: SessionState): number[] {
  return pickableRounds(
    session.seededGame.rounds,
    session.openedQuestionIds,
  ).map((round) => round.id);
}

/**
 * The id of the round in `reloaded` that now holds most of the questions the
 * round `roundId` held in `started`, or null when none of them is left.
 */
function roundNowHolding(
  started: SessionState,
  reloaded: SessionState,
  roundId: number,
): number | null {
  const before = started.seededGame.rounds.find(
    (round) => round.id === roundId,
  );
  if (!before) return null;
  const questionIds = new Set(before.questions.map((question) => question.id));
  let best: { roundId: number; kept: number } | null = null;
  for (const round of reloaded.seededGame.rounds) {
    const kept = round.questions.filter((question) =>
      questionIds.has(question.id),
    ).length;
    if (kept > 0 && (best === null || kept > best.kept)) {
      best = { roundId: round.id, kept };
    }
  }
  return best?.roundId ?? null;
}

/** A sync per connected team of `teamIds`, telling it its joker in `jokers` (null when it has none). */
export function jokerSyncsFor(
  session: SessionState,
  teamIds: readonly number[],
  jokers: Record<number, TeamJoker>,
): JokerSync[] {
  return connectedTeamSyncs(session, teamIds).map((sync) => ({
    ...sync,
    joker: jokers[sync.teamId] ?? null,
  }));
}
