import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  LeagueFields,
  LeaguesListedPayload,
  LeagueView,
} from '@campus-pubquiz/types';
import { sessionDisplayName } from '@/ended-sessions-read/session-display-name';
import { GameSession } from '@/db/entities/game-session.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import type { GameSessionRepository } from '@/db/repositories/game-session.repository';
import type { LeagueRepository } from '@/db/repositories/league.repository';
import type { LeagueSessionRepository } from '@/db/repositories/league-session.repository';
import { isCurrentLeague, venueToday } from '@/league/venue-date';

export class LeagueNotFoundError extends Error {
  constructor(id: number) {
    super(`League ${id} does not exist`);
  }
}

export class SessionNotFoundError extends Error {
  constructor(id: number | string) {
    super(`Session ${id} does not exist`);
  }
}

export class SessionNotEndedError extends Error {
  constructor(id: number) {
    super(`Session ${id} has not ended: only ended sessions can be added`);
  }
}

export class SessionEndedError extends Error {
  constructor(joinCode: string) {
    super(`Session ${joinCode} has ended: its leagues can no longer be ticked`);
  }
}

/** Some ticked league does not exist, or is no longer current and the session is not already in it. */
export class InvalidLeagueIdsError extends Error {
  constructor(ids: number[]) {
    super(`Not a current league: ${ids.join(', ')}`);
  }
}

/** The admin's order: higher `sortOrder` first, ties newest first. */
export const LEAGUE_ORDER = {
  sortOrder: 'desc',
  startsOn: 'desc',
  id: 'desc',
} as const;

export interface ListLeaguesOptions {
  /** Keep only leagues whose end date is today (at the venue) or later. */
  current?: boolean;
  now?: Date;
}

@Injectable()
export class LeagueService {
  constructor(
    @InjectRepository(League) private readonly leagues: LeagueRepository,
    @InjectRepository(LeagueSession)
    private readonly memberships: LeagueSessionRepository,
    @InjectRepository(GameSession)
    private readonly gameSessions: GameSessionRepository,
  ) {}

  async list({
    current = false,
    now = new Date(),
  }: ListLeaguesOptions): Promise<LeaguesListedPayload> {
    const today = venueToday(now);
    const leagues = await this.leagues.find(
      current ? { endsOn: { $gte: today } } : {},
      { orderBy: LEAGUE_ORDER },
    );
    const items: LeagueView[] = [];
    for (const league of leagues) {
      items.push(await this.view(league, today));
    }
    return { items };
  }

  /** A new league goes to the top of the order. */
  async create(fields: LeagueFields): Promise<LeagueView> {
    const [top] = await this.leagues.find(
      {},
      { orderBy: { sortOrder: 'desc' }, limit: 1 },
    );
    const league = this.leagues.create({
      ...fields,
      sortOrder: (top?.sortOrder ?? 0) + 1,
    });
    await this.em().flush();
    return this.view(league, venueToday(new Date()));
  }

  /** Swaps the league with its neighbour in the admin order; at either end it stays put. */
  async move(id: number, direction: 'up' | 'down'): Promise<void> {
    const ordered = await this.leagues.find({}, { orderBy: LEAGUE_ORDER });
    const index = ordered.findIndex((league) => league.id === id);
    if (index === -1) throw new LeagueNotFoundError(id);
    const target = index + (direction === 'up' ? -1 : 1);
    if (target < 0 || target >= ordered.length) return;
    // Re-number the whole list so equal sort orders can never make a swap a no-op.
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);
    ordered.forEach((league, position) => {
      league.sortOrder = ordered.length - position;
    });
    await this.em().flush();
  }

  async update(id: number, fields: LeagueFields): Promise<LeagueView> {
    const league = await this.requireLeague(id);
    Object.assign(league, fields);
    await this.em().flush();
    return this.view(league, venueToday(new Date()));
  }

  /** Removes the league and, by cascade, only its memberships: never a session. */
  async remove(id: number): Promise<void> {
    const league = await this.requireLeague(id);
    await this.em().removeAndFlush(league);
  }

  /** Adds an ended session to a league, current or not; adding it again changes nothing. */
  async addSession(leagueId: number, gameSessionId: number): Promise<void> {
    const league = await this.requireLeague(leagueId);
    const session = await this.gameSessions.findOne({ id: gameSessionId });
    if (!session) throw new SessionNotFoundError(gameSessionId);
    if (session.status !== 'ended') throw new SessionNotEndedError(session.id);
    const existing = await this.memberships.findOne({
      league: league.id,
      gameSession: session.id,
    });
    if (existing) return;
    this.memberships.create({ league, gameSession: session });
    await this.em().flush();
  }

  /** Removing a session that is not in the league is a no-op. */
  async removeSession(leagueId: number, gameSessionId: number): Promise<void> {
    await this.requireLeague(leagueId);
    await this.memberships.nativeDelete({
      league: leagueId,
      gameSession: gameSessionId,
    });
  }

  /** Checks ticked ids for a session that does not exist yet: each must be a current league. */
  async assertAssignable(
    leagueIds: number[],
    now: Date = new Date(),
  ): Promise<void> {
    await this.assertTickable(leagueIds, new Set(), now);
  }

  /**
   * Replaces the leagues a live session counts towards. Every id must be an
   * existing current league (one the session is already in may stay); a
   * session that has ended is refused. Nothing is written when any id is bad.
   */
  async setSessionLeagues(
    joinCode: string,
    leagueIds: number[],
    now: Date = new Date(),
  ): Promise<void> {
    const { session, current, alreadyIn, wanted } = await this.checkSession(
      joinCode,
      leagueIds,
      now,
    );
    const em = this.em();
    for (const row of current) {
      if (!wanted.includes(row.league.id)) em.remove(row);
    }
    for (const id of wanted) {
      if (!alreadyIn.has(id)) {
        this.memberships.create({
          league: em.getReference(League, id),
          gameSession: session,
        });
      }
    }
    await em.flush();
  }

  /** The checks of `setSessionLeagues`, without writing: for a caller that must know the write will be accepted first. */
  async assertSessionAssignable(
    joinCode: string,
    leagueIds: number[],
    now: Date = new Date(),
  ): Promise<void> {
    await this.checkSession(joinCode, leagueIds, now);
  }

  private async checkSession(joinCode: string, leagueIds: number[], now: Date) {
    const session = await this.gameSessions.findOne({ joinCode });
    if (!session) throw new SessionNotFoundError(joinCode);
    if (session.status === 'ended') throw new SessionEndedError(joinCode);
    const wanted = [...new Set(leagueIds)];
    const current = await this.memberships.find({ gameSession: session.id });
    const alreadyIn = new Set(current.map((row) => row.league.id));
    await this.assertTickable(wanted, alreadyIn, now);
    return { session, current, alreadyIn, wanted };
  }

  private async assertTickable(
    leagueIds: number[],
    alreadyIn: ReadonlySet<number>,
    now: Date,
  ): Promise<void> {
    const wanted = [...new Set(leagueIds)];
    if (wanted.length === 0) return;
    const today = venueToday(now);
    const found = await this.leagues.find({ id: { $in: wanted } });
    const tickable = new Set(
      found
        .filter(
          (league) =>
            isCurrentLeague(league.endsOn, today) || alreadyIn.has(league.id),
        )
        .map((league) => league.id),
    );
    const bad = wanted.filter((id) => !tickable.has(id));
    if (bad.length > 0) throw new InvalidLeagueIdsError(bad);
  }

  private em() {
    return this.leagues.getEntityManager();
  }

  private async requireLeague(id: number): Promise<League> {
    const league = await this.leagues.findOne({ id });
    if (!league) throw new LeagueNotFoundError(id);
    return league;
  }

  private async view(league: League, today: string): Promise<LeagueView> {
    const rows = await this.memberships.find(
      { league: league.id },
      {
        populate: ['gameSession.quiz'],
        orderBy: { gameSession: { id: 'asc' } },
      },
    );
    return {
      id: league.id,
      name: league.name,
      startsOn: league.startsOn,
      endsOn: league.endsOn,
      current: isCurrentLeague(league.endsOn, today),
      sessions: rows.map(({ gameSession }) => ({
        gameSessionId: gameSession.id,
        joinCode: gameSession.joinCode,
        name: sessionDisplayName(gameSession.name, gameSession.quiz.title),
        playedAt: gameSession.createdAt.toISOString(),
      })),
    };
  }
}
