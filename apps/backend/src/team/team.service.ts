import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@/db/db.constants';
import { generateJoinCode } from '@/db/join-code.util';
import * as schema from '@/db/schema';

const UNIQUE_VIOLATION_CODE = '23505';

export class TeamNameTakenError extends Error {
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
  id: string;
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
  teamId: string;
  teamName: string;
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
    const trimmedName = teamName.trim();

    if (options.teamToken) {
      const [existing] = await this.db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.token, options.teamToken));
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

    const [existingByName] = await this.db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.name, trimmedName));

    if (existingByName) {
      const normalizedCode = options.teamCode?.trim().toUpperCase();
      if (!normalizedCode || normalizedCode !== existingByName.code) {
        throw new TeamCodeRequiredError(trimmedName);
      }
      await this.addToRoster(gameSessionId, existingByName.id);
      return this.toIdentity(existingByName);
    }

    try {
      const [team] = await this.db
        .insert(schema.teams)
        .values({
          name: trimmedName,
          token: randomUUID(),
          code: generateJoinCode(),
        })
        .returning();
      await this.addToRoster(gameSessionId, team.id);
      return this.toIdentity(team);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new TeamNameTakenError(trimmedName);
      }
      throw error;
    }
  }

  async listForSession(gameSessionId: string): Promise<TeamRosterEntry[]> {
    const rows = await this.db
      .select({ id: schema.teams.id, name: schema.teams.name })
      .from(schema.gameSessionTeams)
      .innerJoin(
        schema.teams,
        eq(schema.gameSessionTeams.teamId, schema.teams.id),
      )
      .where(eq(schema.gameSessionTeams.gameSessionId, gameSessionId))
      .orderBy(schema.gameSessionTeams.joinedAt);
    return rows.map((row) => ({ teamId: row.id, teamName: row.name }));
  }

  private async isOnRoster(
    gameSessionId: string,
    teamId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ teamId: schema.gameSessionTeams.teamId })
      .from(schema.gameSessionTeams)
      .where(
        and(
          eq(schema.gameSessionTeams.gameSessionId, gameSessionId),
          eq(schema.gameSessionTeams.teamId, teamId),
        ),
      );
    return Boolean(row);
  }

  private async addToRoster(
    gameSessionId: string,
    teamId: string,
  ): Promise<void> {
    await this.db
      .insert(schema.gameSessionTeams)
      .values({ gameSessionId, teamId })
      .onConflictDoNothing({
        target: [
          schema.gameSessionTeams.gameSessionId,
          schema.gameSessionTeams.teamId,
        ],
      });
  }

  private toIdentity(team: typeof schema.teams.$inferSelect): TeamIdentity {
    return { id: team.id, name: team.name, token: team.token, code: team.code };
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
