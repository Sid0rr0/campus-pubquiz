import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { TeamView } from '@campus-pubquiz/types';
import { DRIZZLE } from '@/db/db.constants';
import * as schema from '@/db/schema';

const UNIQUE_VIOLATION_CODE = '23505';

export class TeamNameTakenError extends Error {
  constructor(teamName: string) {
    super(`Team name "${teamName}" is already taken in this session`);
    this.name = 'TeamNameTakenError';
  }
}

export class InvalidJoinCodeError extends Error {
  constructor() {
    super('Invalid game code — check the code on the screen and try again');
    this.name = 'InvalidJoinCodeError';
  }
}

export interface TeamIdentity {
  id: string;
  name: string;
  token: string;
}

export interface JoinOptions {
  teamToken?: string;
  joinCode?: string;
}

@Injectable()
export class TeamService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async join(
    gameSessionId: string,
    teamName: string,
    options: JoinOptions = {},
  ): Promise<TeamIdentity> {
    if (options.teamToken) {
      const [existing] = await this.db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.token, options.teamToken));
      // A token from another (older) session must not resurrect that team
      // here; fall through and register a fresh team in this session.
      if (existing && existing.gameSessionId === gameSessionId) {
        return { id: existing.id, name: existing.name, token: existing.token };
      }
    }

    await this.assertJoinCodeMatches(gameSessionId, options.joinCode);

    try {
      const [team] = await this.db
        .insert(schema.teams)
        .values({ gameSessionId, name: teamName, token: randomUUID() })
        .returning();
      return { id: team.id, name: team.name, token: team.token };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new TeamNameTakenError(teamName);
      }
      throw error;
    }
  }

  async listForSession(gameSessionId: string): Promise<TeamView[]> {
    const rows = await this.db
      .select({ id: schema.teams.id, name: schema.teams.name })
      .from(schema.teams)
      .where(eq(schema.teams.gameSessionId, gameSessionId))
      .orderBy(schema.teams.createdAt);
    return rows.map((row) => ({ teamId: row.id, teamName: row.name }));
  }

  private async assertJoinCodeMatches(
    gameSessionId: string,
    joinCode: string | undefined,
  ): Promise<void> {
    const normalized = joinCode?.trim().toUpperCase();
    if (!normalized) {
      throw new InvalidJoinCodeError();
    }
    const [session] = await this.db
      .select({ joinCode: schema.gameSessions.joinCode })
      .from(schema.gameSessions)
      .where(eq(schema.gameSessions.id, gameSessionId));
    if (!session || session.joinCode !== normalized) {
      throw new InvalidJoinCodeError();
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return this.getPgErrorCode(error) === UNIQUE_VIOLATION_CODE;
  }

  private getPgErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null) {
      return undefined;
    }
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    if ('cause' in error) {
      return this.getPgErrorCode(error.cause);
    }
    return undefined;
  }
}
