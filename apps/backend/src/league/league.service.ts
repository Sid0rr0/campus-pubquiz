import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  LeagueFields,
  LeaguesListedPayload,
  LeagueView,
} from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import type { GameSessionRepository } from '@/db/repositories/game-session.repository';
import type { LeagueRepository } from '@/db/repositories/league.repository';
import type { LeagueSessionRepository } from '@/db/repositories/league-session.repository';
import { venueToday } from '@/league/venue-date';

export class LeagueNotFoundError extends Error {
  constructor(id: number) {
    super(`League ${id} does not exist`);
  }
}

export class SessionNotFoundError extends Error {
  constructor(id: number) {
    super(`Session ${id} does not exist`);
  }
}

export class SessionNotEndedError extends Error {
  constructor(id: number) {
    super(`Session ${id} has not ended: only ended sessions can be added`);
  }
}

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
      { orderBy: { startsOn: 'desc', id: 'desc' } },
    );
    const items: LeagueView[] = [];
    for (const league of leagues) {
      items.push(await this.view(league, today));
    }
    return { items };
  }

  async create(fields: LeagueFields): Promise<LeagueView> {
    const league = this.leagues.create(fields);
    await this.em().flush();
    return this.view(league, venueToday(new Date()));
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
      current: league.endsOn >= today,
      sessions: rows.map(({ gameSession }) => ({
        gameSessionId: gameSession.id,
        joinCode: gameSession.joinCode,
        name: gameSession.name ?? gameSession.quiz.title,
        playedAt: gameSession.createdAt.toISOString(),
      })),
    };
  }
}
