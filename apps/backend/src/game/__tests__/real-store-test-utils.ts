import { Global, Module, type DynamicModule } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { WsException } from '@nestjs/websockets';
import { MikroORM, RequestContext } from '@mikro-orm/postgresql';
import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type GameAction,
  type GameStatus,
  type ImportRoundPreview,
  type Margin,
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
import { PlayerCountService } from '@/player-count/player-count.service';
import { GameSession } from '@/db/entities/game-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { useTestDatabase } from '@/test-db/test-database';
import { createTestDatabaseModule } from '@/test-db/test-database.module';
import { SessionService } from '@/auth/session.service';
import { SeedService } from '@/db/seed.service';
import { GameGateway } from '@/game/game.gateway';
import { SessionBroadcaster } from '@/game/socket/session-broadcaster';
import { GameModule } from '@/game/game.module';
import { LiveEditService } from '@/game/live-edit/live-edit.service';
import { LiveSessionRest } from '@/game/rest/live-session-rest.service';
import { LeagueTableService } from '@/league/league-table.service';
import { LeagueService } from '@/league/league.service';
import { QuizService } from '@/quiz/quiz.service';
import { QuizPreviewService } from '@/quiz/quiz-preview.service';
import { ManualTimerScheduler } from '@/game/__tests__/manual-timer-scheduler';
import {
  PHASE_TIMER_SCHEDULERS,
  type PhaseTimerSchedulers,
} from '@/game/socket/phase-timers';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import { GameStateService } from '@/game/state/game-state.service';
import { SessionWrite } from '@/game/state/session-write';
import { WRITE_GATE, type WriteStep } from '@/game/state/write-gate';
import {
  TestWriteGate,
  type GateFilter,
  type HeldWrite,
} from '@/game/__tests__/test-write-gate';
import { ShowdownService } from '@/showdown/showdown.service';
import { TeamService } from '@/team/team.service';
import {
  TEST_SESSION_TOKEN,
  asServer,
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
  /** Host-only round note shown on /remote while the round's intro is on air. */
  note?: string;
  /** Whether the round note also shows on the big screen. */
  showNoteOnScreen?: boolean;
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
  /** Everything pushed to clients goes through it; the mock server is attached to it. */
  broadcaster: SessionBroadcaster;
  server: MockServer;
  /** The Session write behind the game state service — for a spec that drives a write directly instead of casting to a private field. */
  sessionWrite: SessionWrite;
  /**
   * Forces an overlap at a named step of the Session write, in the module's own
   * terms: holds the next write to reach `step` (for `joinCode` when given).
   * Start the first event, `await held.reached`, send the second, then
   * `held.release()`. Later writes pass through. Steps: `hold` (a Live edit
   * hold owns its queues, before its task runs), `change` (the change has
   * returned, nothing is stored yet), `standings` (just before the live results
   * read; a write that opts out never reaches it). Outstanding holds are
   * released when the test ends, and a hold no write reached fails the test.
   */
  holdAt: (step: WriteStep, filter?: GateFilter) => HeldWrite;
  /**
   * Call before sending the event under test: resolves when the next write is
   * handed to the Session write (for `joinCode` when given). The queue is
   * first-in first-out, so a write queued while another is held is waiting
   * behind it: await this before releasing the held write.
   */
  nextQueued: (filter?: GateFilter) => Promise<void>;
  answerService: AnswerService;
  standingsService: StandingsService;
  leagueTableService: LeagueTableService;
  leagueService: LeagueService;
  teamService: TeamService;
  bonusService: BonusService;
  feedbackService: FeedbackService;
  playerCountService: PlayerCountService;
  showdownService: ShowdownService;
  seedService: SeedService;
  quizService: QuizService;
  /** The Quiz preview read, over the same stores — call it inside `inRequestContext`. */
  quizPreviewService: QuizPreviewService;
  /** The Live edit module — saves a quiz's title and rounds the way the editor's save does. */
  liveEdit: LiveEditService;
  /** The REST entry — the module every REST route calls; drive a route's method through it the way a controller does (inside `inRequestContext`). */
  rest: LiveSessionRest;
  /** Saves the seeded quiz through the Live edit module (in its own request context) with `edit` applied to the stored draft's rounds; no `edit` saves it unchanged. */
  saveQuizEdit: (
    edit?: (rounds: ImportRoundPreview[]) => ImportRoundPreview[],
  ) => Promise<QuizDraftSaveResult>;
  /** Saves a corrected answer key (and/or points) for one question of the seeded quiz through the Live edit module. */
  saveAnswerKeyFix: (
    questionId: number,
    fix: { answer?: string; points?: number; margin?: Margin },
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
   * asserting on what a room was sent. Never await it while a write is held
   * with `holdAt`: it waits for that write too, so it would hang until the
   * hold is released. To force an ordering, use `holdAt` + `nextQueued` +
   * `letOthersRun` and `settled` only after `held.release()`.
   */
  settled: () => Promise<void>;
  /**
   * Forcing an overlap, in full: `const held = game.holdAt('change')`, start
   * the first event, `await held.reached`, then `const waiting =
   * game.nextQueued()`, send the second event and `await waiting`. Now call
   * this, then `held.release()`.
   *
   * It lets a write that is not held run as far as it can, for the moment
   * between `await waiting` and `held.release()`. `settled` cannot do this:
   * it waits for the held write. A queued write runs nothing here, so a write
   * that overtakes the held one (the queue broken) has finished by the time
   * the spec releases, and the spec's ordering assertion fails. It sleeps on
   * macrotask turns, never on the clock.
   */
  letOthersRun: () => Promise<void>;
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
    type: 'free_text',
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

/** The one provider the Game module leaves to its host: the phase timers' schedulers (nothing provides them in production). */
function phaseTimerSchedulersModule(
  schedulers: PhaseTimerSchedulers,
): DynamicModule {
  @Global()
  @Module({
    providers: [{ provide: PHASE_TIMER_SCHEDULERS, useValue: schedulers }],
    exports: [PHASE_TIMER_SCHEDULERS],
  })
  class PhaseTimerSchedulersModule {}

  return { module: PhaseTimerSchedulersModule };
}

/** Provides the Session write's Write gate, which production leaves unprovided (the pass-through gate is used). */
function writeGateModule(gate: TestWriteGate): DynamicModule {
  @Global()
  @Module({
    providers: [{ provide: WRITE_GATE, useValue: gate }],
    exports: [WRITE_GATE],
  })
  class WriteGateModule {}

  return { module: WriteGateModule };
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
  let modules: TestingModule[] = [];
  let gates: TestWriteGate[] = [];

  // Registered before useTestDatabase() so the modules are closed before its
  // afterEach empties the tables (hooks run in definition order).
  afterEach(async () => {
    // Held writes are let go first so closing never waits on one; a hold that
    // no write reached fails the test instead of hanging it.
    const finishing = gates;
    gates = [];
    const unreached = finishing
      .map((gate) => gate.finish())
      .filter((message): message is string => message !== undefined);
    // Closing runs module destroy, which clears armed lock/kahoot timers that
    // would otherwise fire into truncated tables and keep the worker alive.
    // It never closes the worker's ORM: the test database module only hands
    // that ORM out.
    const closing = modules;
    modules = [];
    await Promise.all(closing.map((module) => module.close()));
    if (unreached.length > 0) throw new Error(unreached.join('\n'));
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
        note: spec.note,
        showNoteOnScreen: spec.showNoteOnScreen ?? false,
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
    const sessionService = createFakeSessionService();
    const lockScheduler = new ManualTimerScheduler();
    const kahootScheduler = new ManualTimerScheduler();
    const gate = new TestWriteGate();
    gates.push(gate);
    // Nest runs module init (the session store loads), then application
    // bootstrap (timers re-arm), the way the app boots.
    const moduleRef = await Test.createTestingModule({
      imports: [
        GameModule,
        createTestDatabaseModule(db.orm),
        phaseTimerSchedulersModule({
          lock: lockScheduler,
          kahoot: kahootScheduler,
        }),
        writeGateModule(gate),
      ],
    })
      .overrideProvider(SessionService)
      .useValue(sessionService)
      .compile();
    modules.push(moduleRef);
    await moduleRef.init();
    const gateway = moduleRef.get(GameGateway);
    const broadcaster = moduleRef.get(SessionBroadcaster);
    const gameState = moduleRef.get(GameStateService);
    const liveEdit = moduleRef.get(LiveEditService);
    const rest = moduleRef.get(LiveSessionRest);
    const services = {
      answerService: moduleRef.get(AnswerService),
      standingsService: moduleRef.get(StandingsService),
      leagueTableService: moduleRef.get(LeagueTableService),
      leagueService: moduleRef.get(LeagueService),
      teamService: moduleRef.get(TeamService),
      bonusService: moduleRef.get(BonusService),
      feedbackService: moduleRef.get(FeedbackService),
      playerCountService: moduleRef.get(PlayerCountService),
      showdownService: moduleRef.get(ShowdownService),
      seedService: moduleRef.get(SeedService),
      progressRepository: moduleRef.get(GameProgressRepository),
      quizService: moduleRef.get(QuizService),
      quizPreviewService: moduleRef.get(QuizPreviewService),
    };
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
    const server = createMockServer();
    // Nest hands the server to the gateway, then calls its init hook.
    gateway.server = asServer(server);
    gateway.afterInit(gateway.server);
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
    const letOthersRun = async () => {
      // A write's database work takes dozens of macrotask turns to finish;
      // too few and a write that overtook the held one is still mid-flight.
      for (let turn = 0; turn < 100; turn++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
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
      broadcaster,
      sessionWrite: moduleRef.get(SessionWrite),
      holdAt: (step, filter) => gate.holdAt(step, filter),
      nextQueued: (filter) => gate.nextQueued(filter),
      liveEdit,
      rest,
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
      settled,
      letOthersRun,
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

/** A multiple-choice question worth 10 points, answered 'Paris'; vary its prompt for each question a quiz needs. */
export const CAPITAL_QUESTION = {
  type: 'multiple_choice' as const,
  prompt: 'Capital of France?',
  answer: 'Paris',
  points: 10,
  payload: { options: ['Paris', 'London'] },
};

/** Presses Advance until the session reaches `status`. */
export async function advanceUntil(
  game: RealStoreGateway,
  status: GameStatus,
): Promise<void> {
  while (game.sessionWrite.read(game.joinCode).progress.status !== status) {
    await game.act('ADVANCE');
  }
}

/** Presses Advance through the block in play until the board after its reveal is up. */
export async function advanceToBlockBoard(
  game: RealStoreGateway,
): Promise<void> {
  while (!game.sessionWrite.read(game.joinCode).progress.isLeaderboardVisible) {
    await game.act('ADVANCE');
  }
}

/** A seeded question by its place in the quiz; the first round by default. */
export interface QuestionPlace {
  roundIndex?: number;
  questionIndex?: number;
}

function questionIdAt(
  game: RealStoreGateway,
  { roundIndex = 0, questionIndex = 0 }: QuestionPlace,
): number {
  return game.rounds[roundIndex].questionIds[questionIndex];
}

/** The team at `teamIndex` submits `value` to the question at `place`. */
export async function submitAnswer(
  game: RealStoreGateway,
  teamIndex: number,
  value: string,
  place: QuestionPlace = {},
): Promise<void> {
  const { socket, teamId } = game.teams[teamIndex];
  await game.gateway.handleSubmitAnswer(asSocket(socket), {
    questionId: questionIdAt(game, place),
    teamId,
    value,
  });
}

/** Each team (by index) submits its value to the question at `place`. */
export async function submitAnswers(
  game: RealStoreGateway,
  values: string[],
  place: QuestionPlace = {},
): Promise<void> {
  for (const [teamIndex, value] of values.entries()) {
    await submitAnswer(game, teamIndex, value, place);
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
