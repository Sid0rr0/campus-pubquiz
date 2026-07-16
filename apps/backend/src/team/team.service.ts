import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@/db/db.constants';
import * as schema from '@/db/schema';

const UNIQUE_VIOLATION_CODE = '23505';

export class TeamNameTakenError extends Error {
  constructor(teamName: string) {
    super(`Team name "${teamName}" is already taken in this session`);
    this.name = 'TeamNameTakenError';
  }
}

export interface TeamIdentity {
  id: string;
  name: string;
  token: string;
}

@Injectable()
export class TeamService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async join(
    gameSessionId: string,
    teamName: string,
    existingToken?: string,
  ): Promise<TeamIdentity> {
    if (existingToken) {
      const [existing] = await this.db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.token, existingToken));
      if (existing) {
        return { id: existing.id, name: existing.name, token: existing.token };
      }
    }

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
