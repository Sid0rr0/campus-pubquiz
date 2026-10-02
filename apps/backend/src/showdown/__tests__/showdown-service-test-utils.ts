import type { EntityManager } from '@mikro-orm/postgresql';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { ShowdownRound } from '@/db/entities/showdown-round.entity';
import { ShowdownRoundTeam } from '@/db/entities/showdown-round-team.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Team } from '@/db/entities/team.entity';
import { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { ShowdownRoundRepository } from '@/db/repositories/showdown-round.repository';
import { ShowdownRoundTeamRepository } from '@/db/repositories/showdown-round-team.repository';
import { BonusService } from '@/bonus/bonus.service';
import { ShowdownService } from '@/showdown/showdown.service';
import { useTestDatabase } from '@/test-db/test-database';

export interface ShowdownServiceTestState {
  em: EntityManager;
  showdownService: ShowdownService;
  bonusService: BonusService;
  session: GameSession;
}

export interface ShowdownServiceTestContext {
  state: ShowdownServiceTestState;
  insertTeam: (name: string, token: string) => Promise<Team>;
}

/**
 * Uses the shared test database (emptied after every test) for
 * ShowdownService integration tests, seeding a quiz/game-session before each
 * test — same shape as
 * setupAnswerServiceTest (answer-service-test-utils.ts).
 */
export function setupShowdownServiceTest(): ShowdownServiceTestContext {
  const db = useTestDatabase();
  const state = {} as ShowdownServiceTestState;

  beforeEach(async () => {
    state.em = db.orm.em.fork();
    state.bonusService = new BonusService(
      state.em.getRepository<BonusAward, BonusAwardRepository>(BonusAward),
      state.em.getRepository<GameSessionTeam, GameSessionTeamRepository>(
        GameSessionTeam,
      ),
    );
    state.showdownService = new ShowdownService(
      state.em.getRepository<ShowdownRound, ShowdownRoundRepository>(
        ShowdownRound,
      ),
      state.em.getRepository<ShowdownRoundTeam, ShowdownRoundTeamRepository>(
        ShowdownRoundTeam,
      ),
      state.bonusService,
    );
    const quiz = state.em.create(Quiz, { title: 'Showdown Test Quiz' });
    state.session = state.em.create(GameSession, {
      quiz,
      joinCode: 'ABCDEF',
    });
    await state.em.flush();
  });

  async function insertTeam(name: string, token: string): Promise<Team> {
    const team = state.em.create(Team, { name, token, code: `code-${token}` });
    state.em.create(GameSessionTeam, { gameSession: state.session, team });
    await state.em.flush();
    return team;
  }

  return { state, insertTeam };
}
