import { WsException } from '@nestjs/websockets';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { MikroORM, RequestContext } from '@mikro-orm/postgresql';
import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type GameAction,
  type QuestionType,
  type SessionSettings,
  type SocketRoomName,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { StandingsService } from '@/standings/standings.service';
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
  type MockSessionService,
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

/** One question of a custom quiz; `payload` carries options / matchTargets / mediaUrl / answerMediaUrl like the imported column. */
export interface QuizQuestionSpec {
  type: QuestionType;
  prompt: string;
  answer: string;
  points?: number;
  /** Host-only note shown on /remote. */
  notes?: string;
  payload?: Record<string, unknown>;
}

export interface QuizRoundSpec {
  title: string;
  breakAfter?: boolean;
  kahootMode?: boolean;
  questions: QuizQuestionSpec[];
}

/** Host-only note on the first question of TWO_ROUND_QUIZ — never allowed into a broadcast. */
export const TWO_ROUND_QUIZ_HOST_NOTE = 'Remind teams: EU capitals only.';

/**
 * Two rounds, four questions: round 1 (no break) then round 2 (breakAfter),
 * so one block spans both rounds. Covers a note, question media and answer
 * media, for specs about progression, reveal and what a snapshot exposes.
 */
export const TWO_ROUND_QUIZ: QuizRoundSpec[] = [
  {
    title: 'General Knowledge',
    questions: [
      {
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 2,
        notes: TWO_ROUND_QUIZ_HOST_NOTE,
        payload: { options: ['Paris', 'London', 'Berlin', 'Rome'] },
      },
      {
        type: 'free_text',
        prompt: 'Name the largest planet in the solar system.',
        answer: 'Jupiter',
        points: 2,
      },
    ],
  },
  {
    title: 'Landmarks & Flags',
    breakAfter: true,
    questions: [
      {
        type: 'free_text',
        prompt: 'Which landmark is shown?',
        answer: 'Eiffel Tower',
        points: 3,
        payload: { mediaUrl: 'https://example.com/landmark.jpg' },
      },
      {
        type: 'free_text',
        prompt: 'Name this flag.',
        answer: 'France',
        points: 3,
        payload: { answerMediaUrl: 'https://example.com/france-flag.jpg' },
      },
    ],
  },
];

export interface SeededRoundIds {
  id: number;
  questionIds: number[];
}

export interface PlayableQuiz {
  quizId: number;
  gameSessionId: number;
  joinCode: string;
  /** The default quiz's questions by kind. Reading it on a quiz seeded from `rounds` throws — use `rounds` there. */
  questionIds: SeededQuestionIds;
  /** Every seeded round with its question ids, in quiz order. */
  rounds: SeededRoundIds[];
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
  /** What JOIN_ACCEPTED handed the phone — a second device rejoins the team with either. */
  teamToken: string;
  teamCode: string;
}

export interface RealStoreGateway extends PlayableQuiz {
  gateway: GameGateway;
  server: MockServer;
  answerService: AnswerService;
  standingsService: StandingsService;
  teamService: TeamService;
  bonusService: BonusService;
  showdownService: ShowdownService;
  seedService: SeedService;
  progressRepository: GameProgressRepository;
  /** Every room emit since the last clearEmits(), in emit order. */
  roomEmits: () => readonly RoomEmit[];
  /** Payloads of one event emitted to one room (of this session) since the last clearEmits(), in emit order. */
  payloadsTo: <T>(room: SocketRoomName, event: string) => T[];
  /** Forgets captured room emits and per-socket emits sent so far. */
  clearEmits: () => void;
  /** Runs `work` in its own request context, for a test that calls a service directly the way a REST controller would. */
  inRequestContext: <T>(work: () => Promise<T>) => Promise<T>;
  /** Connects an admin socket (valid session cookie) to the seeded session, or to another session by `joinCode`. */
  connectAdmin: (joinCode?: string) => Promise<MockSocket>;
  /** Connects a players-room socket without joining a team (`id` defaults to the next `player-N`; `joinCode` defaults to the seeded session). */
  connectPlayer: (id?: string, joinCode?: string) => Promise<MockSocket>;
  /** Connects a players-room socket and joins it as `teamName`, to the seeded session or another by `joinCode`. */
  joinTeam: (teamName: string, joinCode?: string) => Promise<JoinedTeam>;
  /** The ORM the stores run on, for a test that builds its own module over them. */
  orm: MikroORM;
  /** The fake session service behind admin logins, for a test that needs a different user (e.g. a moderator). */
  sessionService: MockSessionService;
  /** Admin START_QUIZ, then ADVANCE past the rules screen and round intro to the first question. */
  openFirstQuestion: (admin: MockSocket) => Promise<void>;
  /** The teams joined by createGateway({ teamNames }), in the same order. */
  teams: JoinedTeam[];
  /**
   * The Live session module, for the calls REST controllers make (create /
   * close a session, update settings) — game events go through the gateway.
   */
  gameState: GameStateService;
  /** Sends an admin action through the gateway (connecting an admin on first use) and returns the snapshot the admin room received for it. Throws whatever the gateway rejects with. */
  act: (action: GameAction) => Promise<StateSnapshotPayload>;
  /** The snapshot a freshly connecting client is handed — what a reconnect sees — for the seeded session, or another by `joinCode`. */
  snapshot: (joinCode?: string) => Promise<StateSnapshotPayload>;
  /** Rebuilds the module and gateway over the same database, as a backend restart would: progress and timers come back from persistence, sockets and connected teams do not. */
  restart: () => Promise<RealStoreGateway>;
}

export interface CreateGatewayOptions {
  /** Teams to join right after seeding; more can be joined later with joinTeam(). */
  teamNames?: string[];
  /** Join code for the seeded session; defaults to REAL_STORE_JOIN_CODE. Lets one test build two independent gateways. */
  joinCode?: string;
  /** Makes the seeded round a kahootMode round. */
  kahootMode?: boolean;
  /** Seeds these rounds instead of the default single playable round (`kahootMode` is ignored). */
  rounds?: QuizRoundSpec[];
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

const QUESTION_KINDS = Object.keys(
  PLAYABLE_QUESTIONS,
) as (keyof SeededQuestionIds)[];

function defaultQuestionIds(questions: { id: number }[]): SeededQuestionIds {
  return Object.fromEntries(
    QUESTION_KINDS.map((kind, index) => [kind, questions[index].id]),
  ) as unknown as SeededQuestionIds;
}

// A custom quiz has no "the multiple-choice question", so reading one fails
// loudly instead of yielding an id that belongs to nothing.
function unavailableQuestionIds(): SeededQuestionIds {
  const ids = {};
  for (const kind of QUESTION_KINDS) {
    Object.defineProperty(ids, kind, {
      get: () => {
        throw new Error(
          `questionIds.${kind} only exists on the default quiz — use rounds`,
        );
      },
    });
  }
  return ids as SeededQuestionIds;
}

/**
 * Gateway test harness backed by the real answer, team, bonus, showdown,
 * seed and game-progress modules on a Postgres testcontainer — the only way
 * to test through the gateway, because a fake store that returns the same
 * data on every call can't reveal a missing cache refresh.
 *
 * Call inside a top-level `describe`: one container per spec file, game
 * tables truncated after each test, same shape as setupAnswerServiceTest.
 */
export function setupRealStoreGatewayTest(): RealStoreHarness {
  let container: StartedPostgreSqlContainer;
  let orm: MikroORM;
  let gateways: GameGateway[] = [];

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
    // Armed lock/kahoot timers would otherwise fire into truncated tables
    // and keep the worker alive.
    gateways.forEach((gateway) => gateway.onModuleDestroy());
    gateways = [];
    await orm.em.getConnection().execute(TRUNCATE_GAME_TABLES);
  });

  async function seedPlayableQuiz(
    options: CreateGatewayOptions,
  ): Promise<PlayableQuiz> {
    const em = orm.em.fork();
    const quiz = em.create(Quiz, { title: 'Real Store Quiz' });
    const isDefaultQuiz = options.rounds === undefined;
    const roundSpecs: QuizRoundSpec[] = options.rounds ?? [
      {
        title: 'Round 1',
        breakAfter: true,
        kahootMode: options.kahootMode ?? false,
        questions: Object.values(PLAYABLE_QUESTIONS),
      },
    ];
    const rounds = roundSpecs.map((spec, orderIndex) => {
      const round = em.create(Round, {
        quiz,
        title: spec.title,
        orderIndex,
        breakAfter: spec.breakAfter ?? false,
        kahootMode: spec.kahootMode ?? false,
      });
      const questions = spec.questions.map((question, questionIndex) =>
        em.create(Question, {
          round,
          orderIndex: questionIndex,
          type: question.type,
          prompt: question.prompt,
          answer: question.answer,
          points: question.points ?? 1,
          notes: question.notes,
          payload: question.payload ?? {},
        }),
      );
      return { round, questions };
    });
    const session = em.create(GameSession, {
      quiz,
      joinCode: options.joinCode ?? REAL_STORE_JOIN_CODE,
      settings: { ...DEFAULT_SESSION_SETTINGS, ...options.settings },
    });
    await em.flush();
    const questionIds = isDefaultQuiz
      ? defaultQuestionIds(rounds[0].questions)
      : unavailableQuestionIds();
    return {
      quizId: quiz.id,
      gameSessionId: session.id,
      joinCode: session.joinCode,
      questionIds,
      rounds: rounds.map(({ round, questions }) => ({
        id: round.id,
        questionIds: questions.map((question) => question.id),
      })),
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
        questions,
      ),
      standingsService: new StandingsService(sessionTeams),
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
    const game = await assemble(quiz);
    for (const teamName of options.teamNames ?? []) {
      game.teams.push(await game.joinTeam(teamName));
    }
    return game;
  }

  // Builds the module and gateway over the database as it stands — the
  // first boot of a freshly seeded quiz, or a restart over the same one.
  async function assemble(quiz: PlayableQuiz): Promise<RealStoreGateway> {
    const services = buildServices();
    const gameState = new GameStateService(
      services.seedService,
      services.progressRepository,
      orm,
      services.answerService,
      services.standingsService,
      services.showdownService,
    );
    await gameState.onModuleInit();
    const sessionService = createFakeSessionService();
    const gateway = new GameGateway(
      gameState,
      services.teamService,
      services.answerService,
      services.bonusService,
      asSessionService(sessionService),
      orm,
      services.showdownService,
    );
    gateways.push(gateway);
    const server = createMockServer();
    gateway.server = asServer(server);
    const emits = captureRoomEmits(server);

    let socketCount = 0;
    const nextSocketId = (prefix: string) => `${prefix}-${socketCount++}`;

    const connectAdmin = async (joinCode = quiz.joinCode) => {
      const admin = createMockSocket(
        SOCKET_ROOMS.ADMIN,
        { token: TEST_SESSION_TOKEN },
        nextSocketId('admin'),
        joinCode,
      );
      await gateway.handleConnection(asSocket(admin));
      server.sockets.sockets.set(admin.id, admin);
      return admin;
    };

    const connectPlayer = async (
      id?: string,
      joinCode = quiz.joinCode,
    ): Promise<MockSocket> => {
      const socket = createMockSocket(
        SOCKET_ROOMS.PLAYERS,
        {},
        id ?? nextSocketId('player'),
        joinCode,
      );
      await gateway.handleConnection(asSocket(socket));
      server.sockets.sockets.set(socket.id, socket);
      return socket;
    };

    const joinTeam = async (
      teamName: string,
      joinCode = quiz.joinCode,
    ): Promise<JoinedTeam> => {
      const socket = await connectPlayer(undefined, joinCode);
      await gateway.handleJoinPlayers(asSocket(socket), {
        teamName,
        joinCode,
      });
      const accepted = socket.emit.mock.calls.find(
        ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
      ) as
        | [string, { teamId: number; teamToken: string; teamCode: string }]
        | undefined;
      if (!accepted) {
        throw new Error(`Team "${teamName}" was not accepted into the session`);
      }
      const { teamId, teamToken, teamCode } = accepted[1];
      return { socket, teamId, teamToken, teamCode };
    };

    const openFirstQuestion = async (admin: MockSocket) => {
      const adminSocket = asSocket(admin);
      await gateway.handleAdminAction(adminSocket, { action: 'START_QUIZ' });
      await gateway.handleAdminAction(adminSocket, { action: 'ADVANCE' }); // -> round_intro
      await gateway.handleAdminAction(adminSocket, { action: 'ADVANCE' }); // -> first question
    };

    let actingAdmin: MockSocket | undefined;
    const act = async (action: GameAction): Promise<StateSnapshotPayload> => {
      actingAdmin ??= await connectAdmin();
      const emitsBefore = emits.length;
      const ack = await gateway.handleAdminAction(asSocket(actingAdmin), {
        action,
      });
      // Specs that drive the game through `act` want a rejected action to fail loudly.
      if (!ack.success) throw new WsException(ack.error);
      const adminRoom = sessionRoom(quiz.joinCode, SOCKET_ROOMS.ADMIN);
      const received = emits
        .slice(emitsBefore)
        .filter(
          (emit) =>
            emit.rooms.includes(adminRoom) &&
            emit.event === SOCKET_EVENTS.STATE_UPDATED,
        );
      const latest = received[received.length - 1];
      if (!latest) throw new Error(`${action} pushed no state snapshot`);
      return latest.payload as StateSnapshotPayload;
    };

    const snapshot = async (
      joinCode = quiz.joinCode,
    ): Promise<StateSnapshotPayload> => {
      const display = createMockSocket(
        SOCKET_ROOMS.DISPLAY,
        {},
        nextSocketId('display'),
        joinCode,
      );
      await gateway.handleConnection(asSocket(display));
      const sync = display.emit.mock.calls.find(
        ([event]) => event === SOCKET_EVENTS.STATE_SYNC,
      ) as [string, StateSnapshotPayload] | undefined;
      if (!sync) throw new Error('A connecting client received no snapshot');
      return sync[1];
    };

    return {
      ...quiz,
      ...services,
      gateway,
      server,
      gameState,
      roomEmits: () => emits,
      payloadsTo: <T>(room: SocketRoomName, event: string) => {
        const fullRoom = sessionRoom(quiz.joinCode, room);
        return emits
          .filter(
            (emit) => emit.rooms.includes(fullRoom) && emit.event === event,
          )
          .map((emit) => emit.payload as T);
      },
      clearEmits: () => {
        emits.length = 0;
        server.sockets.sockets.forEach((socket) => socket.emit.mockClear());
      },
      inRequestContext: (work) => RequestContext.create(orm.em, work),
      connectAdmin,
      connectPlayer,
      joinTeam,
      sessionService,
      orm,
      openFirstQuestion,
      teams: [],
      act,
      snapshot,
      restart: () => assemble(quiz),
    };
  }

  return { createGateway };
}

/** Opens the default quiz's first question and has each team answer it correctly (2 points each), so those teams tie on the board. */
export async function tieOnFirstQuestion(
  game: RealStoreGateway,
  teams: JoinedTeam[],
): Promise<void> {
  await game.act('START_QUIZ');
  await game.act('ADVANCE'); // -> round_intro
  await game.act('ADVANCE'); // -> first question
  for (const { socket, teamId } of teams) {
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId: game.questionIds.multipleChoice,
      teamId,
      value: 'Paris',
    });
  }
}

// Fakes only Date: timers, microtasks and I/O scheduling stay real, so the
// Postgres-backed stores keep working while a test pins and moves "now".
const ALL_BUT_DATE: FakeableAPI[] = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
];

/** Pins Date.now() at `iso` without touching any timer; undo with restoreClock(). */
export function freezeClockAt(iso: string): void {
  jest.useFakeTimers({ doNotFake: ALL_BUT_DATE, now: new Date(iso).getTime() });
}

/** Moves the pinned clock forward; no pending timer fires. */
export function advanceClockBy(milliseconds: number): void {
  jest.setSystemTime(Date.now() + milliseconds);
}

export function restoreClock(): void {
  jest.useRealTimers();
}
