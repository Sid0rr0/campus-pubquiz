import type { EntityManager } from '@mikro-orm/postgresql';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';
import { StandingsService } from '@/standings/standings.service';

/** A real StandingsService over the real Ended-sessions read, for Postgres specs. */
export function buildStandingsService(em: EntityManager): StandingsService {
  const gameSessionTeams = em.getRepository<
    GameSessionTeam,
    GameSessionTeamRepository
  >(GameSessionTeam);
  return new StandingsService(
    gameSessionTeams,
    new EndedSessionsRead(gameSessionTeams),
  );
}
