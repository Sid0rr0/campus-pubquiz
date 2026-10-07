/**
 * Fixture builder for page tests: describe a small quiz and where the session
 * is, get back exactly the view a room would be sent.
 *
 *   const view = roomView(SOCKET_ROOMS.PLAYERS, {
 *     rounds: [{ questions: [{ prompt: 'Capital of France?' }] }],
 *     progress: { status: 'question_open' },
 *   });
 *
 * Everything is optional. Rounds default to one small round (two free_text
 * questions, break after); progress defaults to the lobby; every other field
 * comes from the shared fresh-session factory. The builder only produces
 * session state (`buildSessionState`); `roomView` runs the shared projection
 * (`projectScreen`) over it, so a view field is never set here by hand. Test
 * support only: production code never projects a view.
 */
import {
  freshSessionState,
  getGameContext,
  getTimedPhaseKey,
  LOBBY_PROGRESS,
  projectScreen,
  DEFAULT_SESSION_SETTINGS,
  type ActiveShowdownRoundState,
  type GameProgress,
  type LeaderboardEntry,
  type RevealQuestionView,
  type SeededRound,
  type SessionSettings,
  type SessionState,
  type SocketRoomName,
  type StateViewByRoom,
  type TeamRosterEntry,
} from '@campus-pubquiz/types';

export interface QuestionDescription extends Partial<RevealQuestionView> {
  /** Host-only note for this question (never reaches a view). */
  note?: string | null;
}

export interface RoundDescription {
  title?: string;
  breakAfter?: boolean;
  kahootMode?: boolean;
  category?: string;
  author?: string;
  questions?: QuestionDescription[];
}

/** A leaderboard row; rank is the position and the points split is zero unless given. */
export type LeaderboardDescription = Pick<
  LeaderboardEntry,
  'teamName' | 'totalPoints'
> &
  Partial<LeaderboardEntry>;

export interface SessionDescription {
  joinCode?: string;
  displayTextScale?: number;
  /** Ids of teams whose phone is connected (the roster's `isConnected`). */
  connectedTeamIds?: number[];
  rounds?: RoundDescription[];
  progress?: Partial<GameProgress>;
  teams?: TeamRosterEntry[];
  /**
   * The timed phase on screen: live since `startedAt`, or finished after
   * `elapsedMs`. Ignored when the status isn't timed.
   */
  phaseTimer?: { startedAt: number } | { elapsedMs: number };
  /** Ids of block questions that still have an ungraded answer. */
  ungradedQuestionIds?: number[];
  /** Team ids that have answered, keyed by question id. */
  answeredTeams?: Record<number, number[]>;
  /** Defaults the roster from its rows when `teams` is left out. */
  leaderboard?: LeaderboardDescription[];
  leaderboardRevealCount?: number;
  /** The closest_guess reveal sub-step on air (0-indexed); the phone is sent each step's stats and answer only once it is reached. */
  closestGuessRevealStep?: number;
  timers?: Partial<
    Pick<
      SessionState,
      'questionLockAt' | 'kahootQuestionEndsAt' | 'breakEndsAt'
    >
  >;
  showdown?: { round: ActiveShowdownRoundState; revealStep?: number };
  settings?: Partial<SessionSettings>;
}

const DEFAULT_ROUNDS: RoundDescription[] = [{ questions: [{}, {}] }];

function describeQuestions(
  rounds: RoundDescription[],
): { questions: RevealQuestionView[]; notes: Record<number, string | null> }[] {
  let nextId = 1;
  return rounds.map((round) => {
    const notes: Record<number, string | null> = {};
    const questions = (round.questions ?? []).map((description) => {
      const { note, ...view } = description;
      const id = view.id ?? nextId;
      nextId = Math.max(nextId, id) + 1;
      if (note !== undefined) notes[id] = note;
      return {
        type: 'free_text',
        prompt: `Question ${id}`,
        answer: `Answer ${id}`,
        points: 1,
        ...view,
        id,
      } satisfies RevealQuestionView;
    });
    return { questions, notes };
  });
}

/** Drops undefined entries so optional SeededRound fields stay absent rather than present-but-undefined. */
function definedOnly<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function buildRounds(descriptions: RoundDescription[]): SeededRound[] {
  const built = describeQuestions(descriptions);
  return descriptions.map((round, index) => ({
    id: index + 1,
    title: round.title ?? `Round ${index + 1}`,
    breakAfter: round.breakAfter ?? true,
    ...definedOnly({
      kahootMode: round.kahootMode,
      category: round.category,
      author: round.author,
    }),
    questions: built[index].questions,
    questionNotesById: built[index].notes,
  }));
}

function buildProgress(overrides: Partial<GameProgress> = {}): GameProgress {
  const questionIndex = overrides.questionIndex ?? 0;
  const isOpen =
    overrides.status === 'question_open' || overrides.status === 'locking';
  return {
    ...LOBBY_PROGRESS,
    questionIndex,
    // An open question has been opened, so it stays answerable.
    furthestOpenIndex: isOpen
      ? questionIndex
      : LOBBY_PROGRESS.furthestOpenIndex,
    ...overrides,
  };
}

function buildLeaderboard(rows: LeaderboardDescription[]): LeaderboardEntry[] {
  return rows.map((row, index) => ({
    teamId: index + 1,
    rank: index + 1,
    rankTo: index + 1,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
    ...row,
  }));
}

/** A closest_guess question's `closestGuess` stats are what its reveal walks through, so the session keeps them as its summary for that question. */
function closestGuessSummariesOf(rounds: SeededRound[]) {
  return Object.fromEntries(
    rounds
      .flatMap((round) => round.questions)
      .flatMap(({ id, closestGuess }) =>
        closestGuess ? [[id, closestGuess]] : [],
      ),
  );
}

function buildPhaseTimer(
  state: SessionState,
  phaseTimer: SessionDescription['phaseTimer'],
): Pick<SessionState, 'livePhaseKey' | 'phaseStartedAt' | 'phaseElapsedByKey'> {
  const key = getTimedPhaseKey(state.progress, getGameContext(state));
  if (phaseTimer === undefined || key === null) {
    return {
      livePhaseKey: state.livePhaseKey,
      phaseStartedAt: state.phaseStartedAt,
      phaseElapsedByKey: state.phaseElapsedByKey,
    };
  }
  if ('startedAt' in phaseTimer) {
    return {
      livePhaseKey: key,
      phaseStartedAt: phaseTimer.startedAt,
      phaseElapsedByKey: {},
    };
  }
  return {
    livePhaseKey: null,
    phaseStartedAt: null,
    phaseElapsedByKey: { [key]: phaseTimer.elapsedMs },
  };
}

/** Full session state for a partial description. */
export function buildSessionState(
  description: SessionDescription = {},
): SessionState {
  const rounds = buildRounds(description.rounds ?? DEFAULT_ROUNDS);
  const leaderboard = buildLeaderboard(description.leaderboard ?? []);
  const teams =
    description.teams ??
    leaderboard.map(({ teamId, teamName }) => ({ teamId, teamName }));
  const state: SessionState = {
    ...freshSessionState(
      {
        quizId: 1,
        gameSessionId: 1,
        joinCode: description.joinCode ?? 'ABCDEF',
        rounds,
        settings: { ...DEFAULT_SESSION_SETTINGS, ...description.settings },
      },
      buildProgress(description.progress),
    ),
    ...description.timers,
    ...(description.displayTextScale === undefined
      ? {}
      : { displayTextScale: description.displayTextScale }),
    connectedTeamSockets: Object.fromEntries(
      (description.connectedTeamIds ?? []).map((id) => [id, `socket-${id}`]),
    ),
    ungradedQuestionIds: description.ungradedQuestionIds ?? [],
    teams,
    leaderboard,
    leaderboardRevealCount: description.leaderboardRevealCount ?? 0,
    closestGuessRevealStep: description.closestGuessRevealStep ?? 0,
    closestGuessSummaries: closestGuessSummariesOf(rounds),
    answeredTeamIdsByQuestion: description.answeredTeams ?? {},
    activeShowdownRound: description.showdown?.round ?? null,
    showdownRevealStep: description.showdown?.revealStep ?? 0,
  };
  return { ...state, ...buildPhaseTimer(state, description.phaseTimer) };
}

/** The view `room` is sent for the described session — the shared projection, nothing hand-made. */
export function roomView<Room extends SocketRoomName>(
  room: Room,
  description: SessionDescription = {},
): StateViewByRoom[Room] {
  return projectScreen(buildSessionState(description), room);
}
