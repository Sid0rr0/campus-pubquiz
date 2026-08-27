import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM, type EntityManager } from '@mikro-orm/postgresql';
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
 * Spins up a fresh Postgres testcontainer + MikroORM instance for
 * ShowdownService integration tests, seeding a quiz/game-session before each
 * test and truncating game tables after each — same shape as
 * setupAnswerServiceTest (answer-service-test-utils.ts).
 */
export function setupShowdownServiceTest(): ShowdownServiceTestContext {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;
  const state = {} as ShowdownServiceTestState;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    orm = await MikroORM.init({
      clientUrl: container.getConnectionUri(),
      entities: ['./dist/db/entities/*.entity.js'],
      entitiesTs: ['./src/db/entities/*.entity.ts'],
      migrations: {
        path: './dist/db/migrations',
        pathTs: './src/db/migrations',
      },
    });
    await orm.getMigrator().up();
  }, 60_000);

  afterAll(async () => {
    await orm.close(true);
    await container.stop();
  });

  beforeEach(async () => {
    state.em = orm.em.fork();
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

  afterEach(async () => {
    await state.em
      .getConnection()
      .execute(
        'TRUNCATE showdown_round_teams, showdown_rounds, bonus_awards, game_session_teams, teams, game_sessions, quizzes CASCADE',
      );
  });

  async function insertTeam(name: string, token: string): Promise<Team> {
    const team = state.em.create(Team, { name, token, code: `code-${token}` });
    state.em.create(GameSessionTeam, { gameSession: state.session, team });
    await state.em.flush();
    return team;
  }

  return { state, insertTeam };
}
