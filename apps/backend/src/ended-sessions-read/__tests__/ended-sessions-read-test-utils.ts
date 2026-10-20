import type { EntityManager } from '@mikro-orm/postgresql';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';

/** A real Ended-sessions read over the test database, for services that read past nights. */
export function buildEndedSessionsRead(em: EntityManager): EndedSessionsRead {
  return new EndedSessionsRead(
    em.getRepository<GameSessionTeam, GameSessionTeamRepository>(
      GameSessionTeam,
    ),
  );
}
