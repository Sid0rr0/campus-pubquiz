import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Team } from '@/db/entities/team.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import { generateJoinCode } from '@/db/join-code.util';

class TeamNameTakenError extends Error {
  constructor(teamName: string) {
    super(`Team name "${teamName}" is already taken`);
    this.name = 'TeamNameTakenError';
  }
}

export class TeamCodeRequiredError extends Error {
  constructor(teamName: string) {
    super(
      `Team name "${teamName}" is already registered — enter its team code to play as this team, or choose a different name`,
    );
    this.name = 'TeamCodeRequiredError';
  }
}

export class InvalidJoinCodeError extends Error {
  constructor() {
    super('Invalid game code — check the code on the screen and try again');
    this.name = 'InvalidJoinCodeError';
  }
}

export interface TeamIdentity {
  id: number;
  name: string;
  token: string;
  code: string;
}

export interface JoinOptions {
  teamToken?: string;
  teamCode?: string;
  joinCode?: string;
}

/** DB-only roster shape — live connection state is layered on by GameStateService. */
export interface TeamRosterEntry {
  teamId: number;
  teamName: string;
}

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team) private readonly teams: TeamRepository,
    @InjectRepository(GameSession)
    private readonly gameSessions: GameSessionRepository,
    @InjectRepository(GameSessionTeam)
    private readonly gameSessionTeams: GameSessionTeamRepository,
  ) {}

  async join(
    gameSessionId: number,
    teamName: string,
    options: JoinOptions = {},
  ): Promise<TeamIdentity> {
    const trimmedName = teamName.trim();

    if (options.teamToken) {
      const existing = await this.teams.findOne({ token: options.teamToken });
      if (existing) {
        if (await this.isOnRoster(gameSessionId, existing.id)) {
          return this.toIdentity(existing);
        }
        // The token proves who they are, but entering a *new* event still
        // requires that event's own join code.
        await this.assertJoinCodeMatches(gameSessionId, options.joinCode);
        await this.addToRoster(gameSessionId, existing.id);
        return this.toIdentity(existing);
      }
    }

    await this.assertJoinCodeMatches(gameSessionId, options.joinCode);

    const existingByName = await this.teams.findOne({ name: trimmedName });

    if (existingByName) {
      const normalizedCode = options.teamCode?.trim().toUpperCase();
      if (!normalizedCode || normalizedCode !== existingByName.code) {
        throw new TeamCodeRequiredError(trimmedName);
      }
      await this.addToRoster(gameSessionId, existingByName.id);
      return this.toIdentity(existingByName);
    }

    try {
      const team = this.teams.create({
        name: trimmedName,
        token: randomUUID(),
        code: generateJoinCode(),
      });
      await this.teams.getEntityManager().persistAndFlush(team);
      await this.addToRoster(gameSessionId, team.id);
      return this.toIdentity(team);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new TeamNameTakenError(trimmedName);
      }
      throw error;
    }
  }

  async listForSession(gameSessionId: number): Promise<TeamRosterEntry[]> {
    const rows = await this.gameSessionTeams.find(
      { gameSession: gameSessionId },
      { populate: ['team'], orderBy: { createdAt: 'asc' } },
    );
    return rows.map((row) => ({
      teamId: row.team.id,
      teamName: row.team.name,
    }));
  }

  private async isOnRoster(
    gameSessionId: number,
    teamId: number,
  ): Promise<boolean> {
    const row = await this.gameSessionTeams.findOne({
      gameSession: gameSessionId,
      team: teamId,
    });
    return Boolean(row);
  }

  private async addToRoster(
    gameSessionId: number,
    teamId: number,
  ): Promise<void> {
    // upsert() issues a raw INSERT ... ON CONFLICT, bypassing the
    // @Property({ onCreate/onUpdate }) hooks on TimestampedEntity — set the
    // timestamps explicitly or the not-null columns get sent as null.
    const now = new Date();
    await this.gameSessionTeams.upsert(
      {
        gameSession: gameSessionId,
        team: teamId,
        createdAt: now,
        updatedAt: now,
      },
      { onConflictFields: ['gameSession', 'team'], onConflictAction: 'ignore' },
    );
  }

  private toIdentity(team: Team): TeamIdentity {
    return { id: team.id, name: team.name, token: team.token, code: team.code };
  }

  private async assertJoinCodeMatches(
    gameSessionId: number,
    joinCode: string | undefined,
  ): Promise<void> {
    const normalized = joinCode?.trim().toUpperCase();
    if (!normalized) {
      throw new InvalidJoinCodeError();
    }
    const session = await this.gameSessions.findOne(gameSessionId, {
      fields: ['joinCode'],
    });
    if (!session || session.joinCode !== normalized) {
      throw new InvalidJoinCodeError();
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof UniqueConstraintViolationException;
  }
}
