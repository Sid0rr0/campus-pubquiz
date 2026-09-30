import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM } from '@mikro-orm/postgresql';
import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type QuestionType,
  type SessionSettings,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { BonusService } from '@/bonus/bonus.service';
import { Answer } from '@/db/entities/answer.entity';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { ShowdownRound } from '@/db/entities/showdown-round.entity';
import { ShowdownRoundTeam } from '@/db/entities/showdown-round-team.entity';
import { Team } from '@/db/entities/team.entity';
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { RoundRepository } from '@/db/repositories/round.repository';
import { ShowdownRoundRepository } from '@/db/repositories/showdown-round.repository';
import { ShowdownRoundTeamRepository } from '@/db/repositories/showdown-round-team.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import { SeedService } from '@/db/seed.service';
import { GameGateway } from '@/game/game.gateway';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import { GameStateService } from '@/game/state/game-state.service';
import { ShowdownService } from '@/showdown/showdown.service';
import { TeamService } from '@/team/team.service';
import {
  TEST_SESSION_TOKEN,
  asServer,
  asSessionService,
  asSocket,
  createFakeSessionService,
  createMockServer,
  createMockSocket,
  type MockServer,
  type MockSocket,
} from '@/game/__tests__/test-utils';

export const REAL_STORE_JOIN_CODE = 'REALST';

const TRUNCATE_GAME_TABLES =
  'TRUNCATE showdown_round_teams, showdown_rounds, bonus_awards, answers, game_session_teams, teams, game_sessions, questions, rounds, quizzes CASCADE';

export interface SeededQuestionIds {
  multipleChoice: number;
  freeText: number;
  closestGuess: number;
  match: number;
  /** Human-graded, so its answers stay ungraded until the admin grades them. */
  audio: number;
}

export interface PlayableQuiz {
  quizId: number;
  gameSessionId: number;
  joinCode: string;
  questionIds: SeededQuestionIds;
}

/** An emit captured from the mock server, with every room it was addressed to (`to(a).to(b).emit(...)` reaches both). */
export interface RoomEmit {
  rooms: string[];
  event: string;
  payload: unknown;
}

export interface JoinedTeam {
  socket: MockSocket;
  teamId: number;
}

export interface RealStoreGateway extends PlayableQuiz {
  gateway: GameGateway;
  server: MockServer;
  answerService: AnswerService;
  teamService: TeamService;
  bonusService: BonusService;
  showdownService: ShowdownService;
  /** Every room emit since the last clearEmits(), in emit order. */
  roomEmits: () => readonly RoomEmit[];
  /** Forgets captured room emits and per-socket emits sent so far. */
  clearEmits: () => void;
  /** Connects an admin socket (valid session cookie) to the seeded session. */
  connectAdmin: () => Promise<MockSocket>;
  /** Connects a players-room socket and joins it as `teamName`. */
  joinTeam: (teamName: string) => Promise<JoinedTeam>;
  /** Admin START_QUIZ, then ADVANCE past the rules screen and round intro to the first question. */
  openFirstQuestion: (admin: MockSocket) => Promise<void>;
  /** The teams joined by createGateway({ teamNames }), in the same order. */
  teams: JoinedTeam[];
}

export interface CreateGatewayOptions {
  /** Teams to join right after seeding; more can be joined later with joinTeam(). */
  teamNames?: string[];
  /** Join code for the seeded session; defaults to REAL_STORE_JOIN_CODE. Lets one test build two independent gateways. */
  joinCode?: string;
  /** Makes the seeded round a kahootMode round. */
  kahootMode?: boolean;
  /** Overrides on top of DEFAULT_SESSION_SETTINGS (e.g. a 1s lockGraceSeconds so a timer fires within a test). */
  settings?: Partial<SessionSettings>;
}

export interface RealStoreHarness {
  /** Seeds a fresh playable quiz + session, builds a gateway over the real stores, loads it, and joins any requested teams — one call. */
  createGateway: (options?: CreateGatewayOptions) => Promise<RealStoreGateway>;
}

interface SeedQuestion {
  type: QuestionType;
  prompt: string;
  answer: string;
  points: number;
  payload?: Record<string, unknown>;
}

// One breakAfter round so the game can reach break/reveal. multiple_choice
// comes first so the smoke path reaches an auto-graded question immediately.
const PLAYABLE_QUESTIONS: Record<keyof SeededQuestionIds, SeedQuestion> = {
  multipleChoice: {
    type: 'multiple_choice',
    prompt: 'Capital of France?',
    answer: 'Paris',
    points: 2,
    payload: { options: ['Paris', 'London', 'Berlin', 'Rome'] },
  },
  freeText: {
    type: 'free_text',
    prompt: 'Largest planet?',
    answer: 'Jupiter',
    points: 2,
  },
  closestGuess: {
    type: 'closest_guess',
    prompt: 'How many bones in an adult human body?',
    answer: '206',
    points: 3,
  },
  match: {
    type: 'match',
    prompt: 'Match countries to capitals',
    // Pipe-joined right-hand targets in left-hand order (see answer.service.ts).
    answer: 'Paris|Rome',
    points: 2,
    payload: {
      options: ['France', 'Italy'],
      matchTargets: ['Rome', 'Paris'],
    },
  },
  audio: {
    type: 'audio',
    prompt: 'Which band is this?',
    answer: 'Queen',
    points: 2,
  },
};

/**
 * Gateway test harness backed by the real answer, team, bonus, showdown,
 * seed and game-progress modules on a Postgres testcontainer — the
 * counterpart to createTestGateway() in test-utils.ts, whose fake answer
 * store returns the same data on every call and so can't reveal a missing
 * cache refresh.
 *
 * Call inside a top-level `describe`: one container per spec file, game
 * tables truncated after each test, same shape as setupAnswerServiceTest.
 */
export function setupRealStoreGatewayTest(): RealStoreHarness {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;

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

  afterEach(async () => {
    await orm.em.getConnection().execute(TRUNCATE_GAME_TABLES);
  });

  async function seedPlayableQuiz(
    options: CreateGatewayOptions,
  ): Promise<PlayableQuiz> {
    const em = orm.em.fork();
    const quiz = em.create(Quiz, { title: 'Real Store Quiz' });
    const round = em.create(Round, {
      quiz,
      title: 'Round 1',
      orderIndex: 0,
      breakAfter: true,
      kahootMode: options.kahootMode ?? false,
    });
    const [multipleChoice, freeText, closestGuess, match, audio] =
      Object.values(PLAYABLE_QUESTIONS).map((seed, orderIndex) =>
        em.create(Question, { round, orderIndex, ...seed }),
      );
    const session = em.create(GameSession, {
      quiz,
      joinCode: options.joinCode ?? REAL_STORE_JOIN_CODE,
      settings: { ...DEFAULT_SESSION_SETTINGS, ...options.settings },
    });
    await em.flush();
    return {
      quizId: quiz.id,
      gameSessionId: session.id,
      joinCode: session.joinCode,
      questionIds: {
        multipleChoice: multipleChoice.id,
        freeText: freeText.id,
        closestGuess: closestGuess.id,
        match: match.id,
        audio: audio.id,
      },
    };
  }

  // Repositories come from the global em, so the gateway's
  // @CreateRequestContext() handlers give each call its own forked em —
  // the way the running app resolves them.
  function buildServices() {
    const { em } = orm;
    const sessionTeams = em.getRepository<
      GameSessionTeam,
      GameSessionTeamRepository
    >(GameSessionTeam);
    const sessions = em.getRepository<GameSession, GameSessionRepository>(
      GameSession,
    );
    const teams = em.getRepository<Team, TeamRepository>(Team);
    const questions = em.getRepository<Question, QuestionRepository>(Question);
    const bonusService = new BonusService(
      em.getRepository<BonusAward, BonusAwardRepository>(BonusAward),
      sessionTeams,
    );
    return {
      answerService: new AnswerService(
        em.getRepository<Answer, AnswerRepository>(Answer),
        teams,
        sessionTeams,
        questions,
      ),
      teamService: new TeamService(teams, sessions, sessionTeams),
      bonusService,
      showdownService: new ShowdownService(
        em.getRepository<ShowdownRound, ShowdownRoundRepository>(ShowdownRound),
        em.getRepository<ShowdownRoundTeam, ShowdownRoundTeamRepository>(
          ShowdownRoundTeam,
        ),
        bonusService,
      ),
      seedService: new SeedService(
        em.getRepository<Quiz, QuizRepository>(Quiz),
        em.getRepository<Round, RoundRepository>(Round),
        questions,
        sessions,
      ),
      progressRepository: new GameProgressRepository(sessions),
    };
  }

  // Captures emits in order: the gateway emits via
  // server.to(a).to(b).emit(event, payload), so `to` accumulates rooms until
  // the next `emit` consumes them.
  function captureRoomEmits(server: MockServer): RoomEmit[] {
    const emits: RoomEmit[] = [];
    let pendingRooms: string[] = [];
    server.to.mockImplementation((room: string) => {
      pendingRooms = [...pendingRooms, room];
      return server;
    });
    server.emit.mockImplementation((event: string, payload: unknown) => {
      emits.push({ rooms: pendingRooms, event, payload });
      pendingRooms = [];
      return true;
    });
    return emits;
  }

  async function createGateway(
    options: CreateGatewayOptions = {},
  ): Promise<RealStoreGateway> {
    const quiz = await seedPlayableQuiz(options);
    const services = buildServices();
    const gameState = new GameStateService(
      services.seedService,
      services.progressRepository,
      orm,
      services.answerService,
      services.showdownService,
    );
    await gameState.onModuleInit();
    const gateway = new GameGateway(
      gameState,
      services.teamService,
      services.answerService,
      services.bonusService,
      asSessionService(createFakeSessionService()),
      orm,
      services.showdownService,
    );
    const server = createMockServer();
    gateway.server = asServer(server);
    const emits = captureRoomEmits(server);

    let socketCount = 0;
    const nextSocketId = (prefix: string) => `${prefix}-${socketCount++}`;

    const connectAdmin = async () => {
      const admin = createMockSocket(
        SOCKET_ROOMS.ADMIN,
        { token: TEST_SESSION_TOKEN },
        nextSocketId('admin'),
        quiz.joinCode,
      );
      await gateway.handleConnection(asSocket(admin));
      server.sockets.sockets.set(admin.id, admin);
      return admin;
    };

    const joinTeam = async (teamName: string): Promise<JoinedTeam> => {
      const socket = createMockSocket(
        SOCKET_ROOMS.PLAYERS,
        {},
        nextSocketId('player'),
        quiz.joinCode,
      );
      await gateway.handleConnection(asSocket(socket));
      server.sockets.sockets.set(socket.id, socket);
      await gateway.handleJoinPlayers(asSocket(socket), {
        teamName,
        joinCode: quiz.joinCode,
      });
      const accepted = socket.emit.mock.calls.find(
        ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
      ) as [string, { teamId: number }] | undefined;
      if (!accepted) {
        throw new Error(`Team "${teamName}" was not accepted into the session`);
      }
      return { socket, teamId: accepted[1].teamId };
    };

    const openFirstQuestion = async (admin: MockSocket) => {
      const adminSocket = asSocket(admin);
      await gateway.handleAdminAction(adminSocket, { action: 'START_QUIZ' });
      await gateway.handleAdminAction(adminSocket, { action: 'ADVANCE' }); // -> round_intro
      await gateway.handleAdminAction(adminSocket, { action: 'ADVANCE' }); // -> first question
    };

    const teams: JoinedTeam[] = [];
    for (const teamName of options.teamNames ?? []) {
      teams.push(await joinTeam(teamName));
    }

    return {
      ...quiz,
      ...services,
      gateway,
      server,
      roomEmits: () => emits,
      clearEmits: () => {
        emits.length = 0;
        server.sockets.sockets.forEach((socket) => socket.emit.mockClear());
      },
      connectAdmin,
      joinTeam,
      openFirstQuestion,
      teams,
    };
  }

  return { createGateway };
}
