import { WsException } from '@nestjs/websockets';
import { MikroORM, RequestContext } from '@mikro-orm/postgresql';
import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type GameAction,
  type ImportRoundPreview,
  type QuizDraftSaveResult,
  type QuestionType,
  type SessionSettings,
  type SocketRoomName,
  type AdminStatePayload,
  type StateViewByRoom,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { StandingsService } from '@/standings/standings.service';
import { BonusService } from '@/bonus/bonus.service';
import { FeedbackService } from '@/feedback/feedback.service';
import { Answer } from '@/db/entities/answer.entity';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { RoundRating } from '@/db/entities/round-rating.entity';
import { SessionFeedback } from '@/db/entities/session-feedback.entity';
import { ShowdownRound } from '@/db/entities/showdown-round.entity';
import { ShowdownRoundTeam } from '@/db/entities/showdown-round-team.entity';
import { Team } from '@/db/entities/team.entity';
import { useTestDatabase } from '@/test-db/test-database';
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { RoundRepository } from '@/db/repositories/round.repository';
import { RoundRatingRepository } from '@/db/repositories/round-rating.repository';
import { SessionFeedbackRepository } from '@/db/repositories/session-feedback.repository';
import { ShowdownRoundRepository } from '@/db/repositories/showdown-round.repository';
import { ShowdownRoundTeamRepository } from '@/db/repositories/showdown-round-team.repository';
import { TeamRepository } from '@/db/repositories/team.repository';
import { SeedService } from '@/db/seed.service';
import { GameGateway } from '@/game/game.gateway';
import { LiveEditService } from '@/game/live-edit/live-edit.service';
import { QuizService } from '@/quiz/quiz.service';
import { ManualTimerScheduler } from '@/game/__tests__/manual-timer-scheduler';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import { GameStateService } from '@/game/state/game-state.service';
import { SessionWrite } from '@/game/state/session-write';
import { BlockGradingService } from '@/game/state/block-grading.service';
import type { SessionWriteQueue } from '@/game/state/session-write-queue';
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

/** One of a session's phase timers (the question lock, or the kahoot question deadline), under test control. */
export interface PhaseTimerControl {
  isArmed: () => boolean;
  /** Epoch-ms the timer is due, or null when none is armed. */
  dueAt: () => number | null;
  /** Runs the expiry the real timer would run, then waits for the session to settle. Throws when nothing is armed. */
  fireNow: () => Promise<void>;
}

export interface RealStoreGateway extends PlayableQuiz {
  gateway: GameGateway;
  server: MockServer;
  answerService: AnswerService;
  standingsService: StandingsService;
  teamService: TeamService;
  bonusService: BonusService;
  feedbackService: FeedbackService;
  showdownService: ShowdownService;
  seedService: SeedService;
  quizService: QuizService;
  /** The Live edit module — saves a quiz's title and rounds the way the editor's save does. */
  liveEdit: LiveEditService;
  /** Saves the seeded quiz through the Live edit module (in its own request context) with `edit` applied to the stored draft's rounds; no `edit` saves it unchanged. */
  saveQuizEdit: (
    edit?: (rounds: ImportRoundPreview[]) => ImportRoundPreview[],
  ) => Promise<QuizDraftSaveResult>;
  /** Saves a corrected answer key (and/or points) for one question of the seeded quiz through the Live edit module. */
  saveAnswerKeyFix: (
    questionId: number,
    fix: { answer?: string; points?: number },
  ) => Promise<QuizDraftSaveResult>;
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
  /**
   * Resolves once every session write in flight for the seeded session has
   * finished (stored, refused or thrown) and the broadcasts sent at the end
   * of a write have been recorded. Use it instead of sleeping before
   * asserting on what a room was sent; to control the order of two writes,
   * pair it with `holdNextCall` (below) and await it after releasing.
   */
  settled: () => Promise<void>;
  /**
   * Call before sending the event under test: the returned promise resolves
   * once that event's session write is either waiting behind a write already
   * in flight (e.g. one held with `holdNextCall`) or has finished. Await it
   * before releasing the held call, in place of sleeping to let the second
   * event "get in". It pairs with a write already held in flight: if the
   * event is rejected before it queues a write, or finds the queue idle and
   * runs into the held call itself, the promise never resolves. Each call
   * covers one write, in the order writes reach the queue (any join code).
   */
  nextWriteWaiting: () => Promise<void>;
  /**
   * The auto-lock timer and the kahoot question timer of the seeded session
   * (or another by `joinCode`). Nothing waits in real time: read `isArmed` /
   * `dueAt`, or `fireNow` to expire one. Armed timers are cleared when the
   * test ends.
   */
  timers: (joinCode?: string) => {
    lock: PhaseTimerControl;
    kahoot: PhaseTimerControl;
  };
  /** Sends an admin action through the gateway (connecting an admin on first use) and returns the snapshot the admin room received for it. Throws whatever the gateway rejects with. */
  act: (action: GameAction) => Promise<AdminStatePayload>;
  /** The state view a freshly connecting client of `room` is handed as its STATE_SYNC — what a reconnect sees — for the seeded session, or another by `joinCode`. */
  resync: <Room extends SocketRoomName>(
    room: Room,
    joinCode?: string,
  ) => Promise<StateViewByRoom[Room]>;
  /** The quiz master's resync view (see `resync`) — the same room `act` returns the view of. */
  snapshot: (joinCode?: string) => Promise<AdminStatePayload>;
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
    payload: { mediaUrl: 'https://example.com/queen.mp3' },
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
 * Call inside a top-level `describe`: the database comes from useTestDatabase
 * (one container per run, game tables emptied after each test).
 */
export function setupRealStoreGatewayTest(): RealStoreHarness {
  let gateways: GameGateway[] = [];

  // Registered before useTestDatabase() so the gateways are destroyed before
  // its afterEach empties the tables (hooks run in definition order).
  afterEach(() => {
    // Armed lock/kahoot timers would otherwise fire into truncated tables
    // and keep the worker alive.
    gateways.forEach((gateway) => gateway.onModuleDestroy());
    gateways = [];
  });

  const db = useTestDatabase();

  async function seedPlayableQuiz(
    options: CreateGatewayOptions,
  ): Promise<PlayableQuiz> {
    const em = db.orm.em.fork();
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
    const { em } = db.orm;
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
      feedbackService: new FeedbackService(
        em.getRepository<RoundRating, RoundRatingRepository>(RoundRating),
        em.getRepository<SessionFeedback, SessionFeedbackRepository>(
          SessionFeedback,
        ),
      ),
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
      quizService: new QuizService(
        em.getRepository<Quiz, QuizRepository>(Quiz),
        em.getRepository<Round, RoundRepository>(Round),
        questions,
      ),
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
      db.orm,
      services.answerService,
      services.standingsService,
      services.showdownService,
      services.teamService,
      services.bonusService,
      services.feedbackService,
      new SessionWrite(services.standingsService),
      new BlockGradingService(services.answerService),
    );
    await gameState.onModuleInit();
    const nextWriteWaiting = watchNextWrite(gameState);
    const sessionService = createFakeSessionService();
    const lockScheduler = new ManualTimerScheduler();
    const kahootScheduler = new ManualTimerScheduler();
    const gateway = new GameGateway(
      gameState,
      services.answerService,
      asSessionService(sessionService),
      db.orm,
      { lock: lockScheduler, kahoot: kahootScheduler },
    );
    gateways.push(gateway);
    const liveEdit = new LiveEditService(
      services.quizService,
      gameState,
      gateway,
    );
    const saveQuizEdit = (
      edit: (rounds: ImportRoundPreview[]) => ImportRoundPreview[] = (rounds) =>
        rounds,
    ) =>
      RequestContext.create(db.orm.em, async () => {
        const draft = await services.quizService.findDraftById(quiz.quizId);
        if (!draft) throw new Error(`Quiz ${quiz.quizId} does not exist`);
        return liveEdit.save(quiz.quizId, {
          title: draft.title,
          rounds: edit(draft.rounds),
        });
      });
    // Nest runs this after every module's onModuleInit — i.e. after the
    // session store is loaded — so a restart re-arms its timers here.
    gateway.onApplicationBootstrap();
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
    const act = async (action: GameAction): Promise<AdminStatePayload> => {
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
      return latest.payload as AdminStatePayload;
    };

    const connectToRoom = async (
      room: SocketRoomName,
      joinCode: string,
    ): Promise<MockSocket> => {
      if (room === SOCKET_ROOMS.ADMIN) return connectAdmin(joinCode);
      if (room === SOCKET_ROOMS.PLAYERS)
        return connectPlayer(undefined, joinCode);
      const display = createMockSocket(
        SOCKET_ROOMS.DISPLAY,
        {},
        nextSocketId('display'),
        joinCode,
      );
      await gateway.handleConnection(asSocket(display));
      return display;
    };
    const resync = async <Room extends SocketRoomName>(
      room: Room,
      joinCode = quiz.joinCode,
    ): Promise<StateViewByRoom[Room]> => {
      const client = await connectToRoom(room, joinCode);
      const sync = client.emit.mock.calls.find(
        ([event]) => event === SOCKET_EVENTS.STATE_SYNC,
      ) as [string, StateViewByRoom[Room]] | undefined;
      if (!sync) throw new Error('A connecting client received no snapshot');
      return sync[1];
    };
    const snapshot = (joinCode = quiz.joinCode) =>
      resync(SOCKET_ROOMS.ADMIN, joinCode);

    const settled = async () => {
      await gameState.whenSessionWritesIdle(quiz.joinCode);
      // A macrotask turn: every microtask queued by the last write has run.
      await new Promise<void>((resolve) => setImmediate(resolve));
    };
    const controlTimer = (
      scheduler: ManualTimerScheduler,
      joinCode: string,
    ): PhaseTimerControl => ({
      isArmed: () => scheduler.isArmed(joinCode),
      dueAt: () => scheduler.dueAt(joinCode),
      fireNow: async () => {
        await scheduler.fire(joinCode);
        await settled();
      },
    });

    return {
      ...quiz,
      ...services,
      gateway,
      liveEdit,
      saveQuizEdit,
      saveAnswerKeyFix: (questionId, fix) =>
        saveQuizEdit((rounds) =>
          rounds.map((round) => ({
            ...round,
            questions: round.questions.map((question) =>
              question.questionId === questionId
                ? { ...question, ...fix }
                : question,
            ),
          })),
        ),
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
      inRequestContext: (work) => RequestContext.create(db.orm.em, work),
      nextWriteWaiting,
      settled,
      timers: (joinCode = quiz.joinCode) => ({
        lock: controlTimer(lockScheduler, joinCode),
        kahoot: controlTimer(kahootScheduler, joinCode),
      }),
      connectAdmin,
      connectPlayer,
      joinTeam,
      sessionService,
      orm: db.orm,
      openFirstQuestion,
      teams: [],
      act,
      resync,
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

type WriteWaiter = (outcome?: Promise<void>) => void;

// Wraps the game's session write queue so a test can learn when the next
// write handed to it is waiting its turn (one waiter per write, in order).
// The queue's chain is microtasks only, so one macrotask after the hand-over a
// write that hasn't started is blocked behind an earlier one; a write that has
// started runs to the end.
function watchNextWrite(gameState: GameStateService): () => Promise<void> {
  type Run = (
    joinCode: string,
    task: () => Promise<unknown>,
  ) => Promise<unknown>;
  const { sessionWrite } = gameState as unknown as {
    sessionWrite: { queue: SessionWriteQueue };
  };
  const { queue } = sessionWrite;
  const target = queue as unknown as { run: Run };
  const originalRun = target.run;
  const run: Run = (joinCode, task) =>
    Reflect.apply(originalRun, queue, [joinCode, task]);
  const waiters: WriteWaiter[] = [];
  target.run = (joinCode, task) => {
    const watching = waiters.shift();
    if (!watching) return run(joinCode, task);
    let hasStarted = false;
    const result = run(joinCode, () => {
      hasStarted = true;
      return task();
    });
    const finished = result.then(
      () => undefined,
      () => undefined,
    );
    setImmediate(() => watching(hasStarted ? finished : undefined));
    return result;
  };
  return () =>
    new Promise<void>((resolve) => {
      waiters.push(resolve as WriteWaiter);
    });
}

/**
 * Makes one call to `target[method]` reject with `error` without running it,
 * letting the `skipCalls` calls before it pass through for real. Only that one
 * call fails: the method is restored once it has been made.
 */
export function rejectNthCall<T extends object, K extends string & keyof T>(
  target: T,
  method: K,
  error: Error,
  skipCalls = 0,
): void {
  type AsyncMethod = (...args: unknown[]) => Promise<unknown>;
  const asyncTarget = target as unknown as Record<string, AsyncMethod>;
  const original = asyncTarget[method];
  let remainingSkips = skipCalls;
  asyncTarget[method] = (...args: unknown[]) => {
    if (remainingSkips > 0) {
      remainingSkips -= 1;
      return Reflect.apply(original, target, args);
    }
    asyncTarget[method] = original;
    return Promise.reject(error);
  };
}

export interface HeldCall {
  /** Resolves once the held call has been made and its real result computed. */
  started: Promise<void>;
  /** Lets the held call return the result it computed when it started. */
  release: () => void;
}

/**
 * Holds open the next call to `target[method]` — a database-facing
 * collaborator such as `game.standingsService.leaderboard`,
 * `game.progressRepository.save` or `game.answerService.submit` — so a spec
 * can force two events to overlap: start the first event, `await
 * held.started`, send the second, then `held.release()`.
 *
 * The call runs for real the moment it is made, so it sees the database as it
 * stood then; only its resolution waits for `release()`, which is what makes
 * its result stale by the time it lands. Only that one call is held — later
 * calls (and calls for other sessions) pass straight through, because the
 * method is restored the moment the held call is made.
 */
export function holdNextCall<T extends object, K extends string & keyof T>(
  target: T,
  method: K,
): HeldCall {
  type AsyncMethod = (...args: unknown[]) => Promise<unknown>;
  const asyncTarget = target as unknown as Record<string, AsyncMethod>;
  const original = asyncTarget[method];
  const callOriginal = (...args: unknown[]): Promise<unknown> =>
    Reflect.apply(original, target, args);
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => (markStarted = resolve));
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  asyncTarget[method] = async (...args: unknown[]) => {
    asyncTarget[method] = original;
    const result = callOriginal(...args);
    markStarted();
    const value = await result;
    await released;
    return value;
  };
  return { started, release };
}
