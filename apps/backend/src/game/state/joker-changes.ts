import {
  canChooseJoker,
  canSetJoker,
  drawJoker,
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
import { findTeamIdBySocketId } from '@/game/state/session-updates.util';
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
    const teamId = findTeamIdBySocketId(session, socketId);
    if (teamId === null) {
      throw new SessionRefusal('Join a team before picking a joker');
    }
    if (!isJokerPickOpen(session)) {
      throw new SessionRefusal('The joker pick is not open');
    }
    const pickableRoundIds = pickableRounds(
      session.seededGame.rounds,
      session.openedQuestionIds,
    ).map((round) => round.id);
    if (!canChooseJoker({ isPickOpen: true, pickableRoundIds }, roundId)) {
      throw new SessionRefusal(
        'That round cannot be your joker: it has already started',
      );
    }

    const joker: TeamJoker = { roundId, source: 'chosen' };
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
        shouldBroadcastDisplayState: true,
        jokerSyncs: jokerSyncsFor(session, [teamId], { [teamId]: joker }),
      },
      touchedScores: true,
    };
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
    const pickableRoundIds = pickableRounds(
      session.seededGame.rounds,
      session.openedQuestionIds,
    ).map((round) => round.id);
    const canSet = canSetJoker(
      {
        isEnabled: session.seededGame.settings.jokersEnabled,
        status: session.progress.status,
        pickableRoundIds,
      },
      roundId,
    );
    if (!canSet) {
      throw new SessionRefusal(
        'That round cannot be the joker: it has already started, or the joker pick has not opened',
      );
    }

    const joker: TeamJoker = { roundId, source: 'set_by_quiz_master' };
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
    const { gameSessionId, rounds } = session.seededGame;
    const stored = await this.jokerService.listForSession(gameSessionId);
    const roster = await this.teamService.listForSession(gameSessionId);
    const pickableRoundIds = pickableRounds(
      rounds,
      session.openedQuestionIds,
    ).map((round) => round.id);

    const jokers: Record<number, TeamJoker> = Object.fromEntries(stored);
    for (const { teamId } of roster) {
      if (jokers[teamId]) continue;
      const roundId = drawJoker(pickableRoundIds, this.random);
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

function jokerSyncsFor(
  session: SessionState,
  teamIds: readonly number[],
  jokers: Record<number, TeamJoker>,
): JokerSync[] {
  return connectedTeamSyncs(session, teamIds).map((sync) => ({
    ...sync,
    joker: jokers[sync.teamId] ?? null,
  }));
}
