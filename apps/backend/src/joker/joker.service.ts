import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { JokerSource, TeamJoker } from '@campus-pubquiz/types';
import { SessionTeamJoker } from '@/db/entities/session-team-joker.entity';
import { SessionTeamJokerRepository } from '@/db/repositories/session-team-joker.repository';

interface SessionTeamJokerRow {
  teamId: number;
  roundId: number;
  source: JokerSource;
}

/** The round each team doubles in a session: one row per team per session, last write wins. */
@Injectable()
export class JokerService {
  constructor(
    @InjectRepository(SessionTeamJoker)
    private readonly jokers: SessionTeamJokerRepository,
  ) {}

  /** Saves the team's joker, replacing any earlier one. */
  async set(
    gameSessionId: number,
    teamId: number,
    joker: TeamJoker,
  ): Promise<void> {
    // An upsert skips the entity's timestamp hooks, so they are set here.
    const now = new Date();
    await this.jokers.upsert(
      {
        gameSession: gameSessionId,
        team: teamId,
        round: joker.roundId,
        source: joker.source,
        createdAt: now,
        updatedAt: now,
      },
      {
        onConflictFields: ['gameSession', 'team'],
        onConflictMergeFields: ['round', 'source', 'updatedAt'],
      },
    );
  }

  /** The joker the team holds this session, or null when it has none. */
  async getForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<TeamJoker | null> {
    const row = await this.jokers.findForTeam(gameSessionId, teamId);
    return row ? { roundId: row.round.id, source: row.source } : null;
  }

  /** Every team's joker in the session, by team id. Read from the jokers table, not the roster, so a kicked team keeps its joker. */
  async listForSession(gameSessionId: number): Promise<Map<number, TeamJoker>> {
    const rows = (await this.jokers
      .getKnex()('session_team_jokers')
      .where('game_session_id', gameSessionId)
      .select(
        'team_id as teamId',
        'round_id as roundId',
        'source',
      )) as SessionTeamJokerRow[];
    return new Map(
      rows.map((row) => [
        row.teamId,
        { roundId: row.roundId, source: row.source },
      ]),
    );
  }
}
