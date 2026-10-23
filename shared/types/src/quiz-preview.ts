import type { DisplayScreen } from './display-screen';
import {
  getBlockPositionForQuestion,
  isBreakPointQuestion,
} from './game-state-block-position';
import { previewMove } from './dry-run-press';
import { nextPressAction } from './move-plan';
import type { OnAirScreen } from './on-air-screen';
import { getHostOnlyText } from './round-note';
import type { QuizStructureSummary } from './game-state-structure';
import type { GameProgress } from './game-state-types';
import { projectScreen } from './screen-projection';
import {
  DEFAULT_SESSION_SETTINGS,
  type SessionSettings,
} from './session-settings';
import {
  freshSessionState,
  getGameContext,
  LOBBY_PROGRESS,
  type SeededRound,
  type SessionState,
} from './session-state';
import { SOCKET_ROOMS } from './socket-events';

/** The orders a Quiz preview can show its screens in. */
export const QUIZ_PREVIEW_MODES = ['answer_after_question', 'night'] as const;
export type QuizPreviewMode = (typeof QUIZ_PREVIEW_MODES)[number];
export const DEFAULT_QUIZ_PREVIEW_MODE: QuizPreviewMode =
  'answer_after_question';

/** One screen of a Quiz preview, with where it sits in the quiz. */
export interface QuizPreviewStep {
  screen: DisplayScreen;
  /** The round the screen belongs to. */
  roundIndex: number;
  /** The question the screen shows, or null on a round's title card. */
  questionIndex: number | null;
  /** Whether a block ends after this step (the last question's answer closes its block). */
  isBlockEnd: boolean;
  /** The text the room never sees for this step, shown in the host-only panel. */
  hostOnly: QuizPreviewHostOnly;
}

/** The host-only text of one step; null where there is none. */
export interface QuizPreviewHostOnly {
  /** The round's note on its title card and reveal intro, unless the step's frame already draws it. */
  roundNote: string | null;
  /** The note of the question the step shows. */
  questionNote: string | null;
}

/** A step before its host-only text is attached; it keeps the On-air screen its progress puts on air. */
type BareStep = Omit<QuizPreviewStep, 'hostOnly'> & { onAir: OnAirScreen };

function nonEmpty(text: string | null | undefined): string | null {
  return text && text.trim() !== '' ? text : null;
}

/**
 * The On-air screen a session shows, with its round index mapped to the full
 * quiz's when the session was built without some of the quiz's rounds.
 */
function onAirScreenOf(
  session: SessionState,
  toFullRound?: readonly number[],
): OnAirScreen {
  const { onAirScreen } = projectScreen(session, SOCKET_ROOMS.ADMIN);
  if (
    !toFullRound ||
    !('roundIndex' in onAirScreen) ||
    onAirScreen.roundIndex === null
  )
    return onAirScreen;
  return { ...onAirScreen, roundIndex: toFullRound[onAirScreen.roundIndex] };
}

/** The On-air screen a session shows when put at a progress. */
function onAirScreenAt(
  session: SessionState,
  progress: GameProgress,
  toFullRound?: readonly number[],
): OnAirScreen {
  return onAirScreenOf({ ...session, progress }, toFullRound);
}

/**
 * Attaches each step's host-only text: what the shared rule gives its On-air
 * screen, minus a round note the step's frame already draws.
 */
function withHostOnly(
  steps: BareStep[],
  rounds: readonly SeededRound[],
): QuizPreviewStep[] {
  return steps.map(({ onAir, ...step }) => {
    const text = getHostOnlyText(rounds, onAir);
    const isNoteDrawn =
      step.screen.kind === 'round_title' && nonEmpty(step.screen.note) !== null;
    return {
      ...step,
      hostOnly: {
        roundNote: isNoteDrawn ? null : nonEmpty(text.roundNote),
        questionNote: nonEmpty(text.questionNotes),
      },
    };
  });
}

/** What every preview screen reads about the quiz itself. */
export interface QuizPreviewContext {
  settings: SessionSettings;
  quizStructure: QuizStructureSummary;
  roundTitles: string[];
  roundCategories: string[];
  roundAuthors: string[];
}

/** A Quiz preview: the quiz-level context and its screens in order. */
export interface QuizPreview {
  mode: QuizPreviewMode;
  quiz: QuizPreviewContext;
  steps: QuizPreviewStep[];
}

/** What `GET /quizzes/:id/preview` answers with. */
export type QuizPreviewPayload = QuizPreview;

/** Options of a Quiz preview. */
export interface QuizPreviewOptions {
  /** Preview a night played with jokers: the "like the night" order gets the joker pick after the overview. */
  withJokers?: boolean;
}

const PREVIEW_SETTINGS: SessionSettings = {
  ...DEFAULT_SESSION_SETTINGS,
  funFactsEnabled: false,
  // The night order opens on the overview; a session only does when its settings ask.
  showRoundOverview: true,
};

function displayScreenAt(
  session: SessionState,
  progress: GameProgress,
): DisplayScreen {
  return projectScreen({ ...session, progress }, SOCKET_ROOMS.DISPLAY).screen;
}

/** The screen kinds the "like the night" order keeps; every other kind needs a live session. */
const NIGHT_SCREEN_KINDS: readonly DisplayScreen['kind'][] = [
  'round_overview',
  'joker_pick',
  'round_title',
  'question',
  'break_intro',
  'reveal_intro',
  'reveal',
];

/** The fixed time the walk presses at; no screen the preview keeps reads a deadline. */
const PREVIEW_PRESS_TIME = 0;

/** Safety stop for the dry run; a real quiz ends long before. */
const MAX_NIGHT_PRESSES = 5000;

/**
 * The Quiz preview: a team-less, in-memory session is put at each screen the
 * preview shows and the screen comes from the display projection, so a preview
 * can't draw anything `/display` wouldn't. Pure; nothing is stored.
 */
export function buildQuizPreview(
  rounds: readonly SeededRound[],
  mode: QuizPreviewMode,
  options: QuizPreviewOptions = {},
): QuizPreview {
  const fullSession = freshSessionState({
    quizId: 0,
    gameSessionId: 0,
    // Stryker disable next-line StringLiteral: no kept screen or quiz context carries the join code
    joinCode: '',
    // Stryker disable next-line StringLiteral: no kept screen or quiz context carries the quiz title
    quizTitle: '',
    customName: null,
    startedAt: new Date(0),
    rounds: [...rounds],
    settings: {
      ...PREVIEW_SETTINGS,
      jokersEnabled: options.withJokers === true,
    },
  });
  const overview = projectScreen(fullSession, SOCKET_ROOMS.DISPLAY);
  return {
    mode,
    quiz: {
      settings: overview.settings,
      quizStructure: overview.quizStructure,
      roundTitles: overview.roundTitles,
      roundCategories: overview.roundCategories,
      roundAuthors: overview.roundAuthors,
    },
    steps: withHostOnly(
      mode === 'night'
        ? buildNightSteps(fullSession)
        : buildAnswerAfterQuestionSteps(fullSession, rounds),
      rounds,
    ),
  };
}

/** Where each question sits, by its seeded id. */
function questionPositions(rounds: readonly SeededRound[]) {
  const positions = new Map<
    number,
    { roundIndex: number; questionIndex: number }
  >();
  rounds.forEach((round, roundIndex) =>
    round.questions.forEach((question, questionIndex) =>
      positions.set(question.id, { roundIndex, questionIndex }),
    ),
  );
  return positions;
}

/**
 * The order the room sees: the shared dry-run press (Move plan and Settle
 * step) is walked (Start quiz, then Advance until nothing moves; no grading
 * writes, nothing saved) and only the screens with quiz content are kept.
 */
function buildNightSteps(fullSession: SessionState): BareStep[] {
  const { rounds } = fullSession.seededGame;
  // A quiz with no rounds has nothing to show, not even an overview of nothing.
  if (rounds.length === 0) return [];

  // The joker pick lists every round of the quiz, empty ones too, and runs no
  // timer: the walk's session has neither all the rounds nor a clock.
  const jokerPickScreen = displayScreenAt(fullSession, {
    ...LOBBY_PROGRESS,
    status: 'joker_pick',
  });

  // The real Advance plan can't place a round with no questions, so the dry
  // run walks a session without such rounds. Their title cards are put back
  // in front of the next round's, and the walked rounds' numbers are mapped
  // back to their place in the full quiz.
  const placed = rounds.flatMap((round, index) =>
    round.questions.length > 0 ? [index] : [],
  );
  const emptyRounds = rounds.flatMap((round, index) =>
    round.questions.length === 0 ? [index] : [],
  );
  const walked: BareStep[] =
    placed.length === 0
      ? [
          {
            screen: { kind: 'round_overview' },
            onAir: { kind: 'round_overview' },
            roundIndex: 0,
            questionIndex: null,
            // Stryker disable next-line BooleanLiteral: the block-end pass below overwrites every night step's flag
            isBlockEnd: false,
          },
          ...(fullSession.seededGame.settings.jokersEnabled
            ? [
                {
                  screen: jokerPickScreen,
                  onAir: { kind: 'joker_pick' } as const,
                  roundIndex: 0,
                  questionIndex: null,
                  // Stryker disable next-line BooleanLiteral: the block-end pass below overwrites every night step's flag
                  isBlockEnd: false,
                },
              ]
            : []),
        ]
      : walkNightSteps(
          freshSessionState({
            ...fullSession.seededGame,
            rounds: placed.map((index) => rounds[index]),
          }),
          placed,
          questionPositions(rounds),
        );

  const steps: BareStep[] = [];
  let nextEmpty = 0;
  const pushEmptyTitlesBefore = (roundIndex: number) => {
    while (
      // Stryker disable next-line ConditionalExpression,EqualityOperator: past the end the next line reads undefined, and `undefined < n` is false anyway
      nextEmpty < emptyRounds.length &&
      // Stryker disable next-line EqualityOperator: an empty round never shares an index with a walked round, and every one is below rounds.length
      emptyRounds[nextEmpty] < roundIndex
    ) {
      steps.push(emptyRoundTitle(fullSession, emptyRounds[nextEmpty]));
      nextEmpty += 1;
    }
  };
  for (const step of walked) {
    if (step.screen.kind === 'round_title')
      pushEmptyTitlesBefore(step.roundIndex);
    steps.push(
      step.screen.kind === 'joker_pick'
        ? { ...step, screen: jokerPickScreen }
        : step,
    );
  }
  pushEmptyTitlesBefore(rounds.length);

  // A block ends at its last reveal: the next screen is neither another
  // reveal nor the next round's reveal title card.
  const continuesReveals = (step: BareStep | undefined) =>
    step?.screen.kind === 'reveal' || step?.screen.kind === 'reveal_intro';
  return steps.map((step, index) => ({
    ...step,
    isBlockEnd:
      step.screen.kind === 'reveal' && !continuesReveals(steps[index + 1]),
  }));
}

/** The title card of a round with no questions, as the full quiz numbers it. */
function emptyRoundTitle(
  fullSession: SessionState,
  roundIndex: number,
): BareStep {
  const progress: GameProgress = {
    ...LOBBY_PROGRESS,
    status: 'round_intro',
    roundIndex,
  };
  return {
    screen: displayScreenAt(fullSession, progress),
    onAir: onAirScreenAt(fullSession, progress),
    roundIndex,
    questionIndex: null,
    // Stryker disable next-line BooleanLiteral: the block-end pass in buildNightSteps overwrites every night step's flag
    isBlockEnd: false,
  };
}

/** Dry-runs Advance over a session whose rounds all have questions; `placed` maps its round indexes back to the full quiz. */
function walkNightSteps(
  start: SessionState,
  placed: readonly number[],
  positions: ReturnType<typeof questionPositions>,
): BareStep[] {
  const steps: BareStep[] = [];
  let session = start;
  // Stryker disable next-line EqualityOperator,AssignmentOperator: only the safety stop reads this counter; a real quiz ends the walk by break long before it
  for (let press = 0; press <= MAX_NIGHT_PRESSES; press += 1) {
    const { screen } = projectScreen(session, SOCKET_ROOMS.DISPLAY);
    if (NIGHT_SCREEN_KINDS.includes(screen.kind)) {
      steps.push({
        ...nightStep(
          renumberRounds(screen, placed),
          placed[session.progress.roundIndex],
          positions,
        ),
        onAir: onAirScreenOf(session, placed),
      });
    }
    const next = pressNext(session);
    if (!next) break;
    session = next;
  }
  return steps;
}

/** The screen with its round numbers mapped from the walked session's rounds to the full quiz's. */
function renumberRounds(
  screen: DisplayScreen,
  placed: readonly number[],
): DisplayScreen {
  const numberOf = (walkedNumber: number) => placed[walkedNumber - 1] + 1;
  switch (screen.kind) {
    case 'round_title':
    case 'break_intro':
    case 'reveal_intro':
      return { ...screen, roundNumber: numberOf(screen.roundNumber) };
    case 'reveal':
      return {
        ...screen,
        question: {
          ...screen.question,
          roundNumber: numberOf(screen.question.roundNumber),
        },
      };
    default:
      return screen;
  }
}

/** The session after the next press, by the shared dry-run press, or null when a press would move nothing (the end of the quiz). Nothing is graded or saved. */
function pressNext(session: SessionState): SessionState | null {
  const { step, session: next } = previewMove(
    session,
    nextPressAction(session),
    PREVIEW_PRESS_TIME,
  );
  switch (step.kind) {
    case 'showdown_waiting':
    case 'grading_pending':
    case 'blocked':
      return null;
    case 'transition':
    case 'leaderboard_reveal':
    case 'leaderboard_hide':
    case 'join_overlay_hide':
    case 'reveal_step':
      return next;
    default: {
      const unhandled: never = step;
      return unhandled;
    }
  }
}

function nightStep(
  screen: DisplayScreen,
  roundIndex: number,
  positions: ReturnType<typeof questionPositions>,
): Omit<BareStep, 'onAir'> {
  switch (screen.kind) {
    case 'question':
    case 'reveal': {
      const position = positions.get(screen.question.id) ?? {
        roundIndex,
        questionIndex: null,
      };
      // Stryker disable next-line BooleanLiteral: the block-end pass in buildNightSteps overwrites every night step's flag
      return { screen, ...position, isBlockEnd: false };
    }
    case 'reveal_intro':
      return {
        screen,
        roundIndex: screen.roundNumber - 1,
        questionIndex: null,
        // Stryker disable next-line BooleanLiteral: the block-end pass in buildNightSteps overwrites every night step's flag
        isBlockEnd: false,
      };
    case 'break_intro':
      // The feedback prompt belongs to the live final break, not to content.
      return {
        screen: { ...screen, isFeedbackPromptShown: false },
        roundIndex,
        questionIndex: null,
        // Stryker disable next-line BooleanLiteral: the block-end pass in buildNightSteps overwrites every night step's flag
        isBlockEnd: false,
      };
    default:
      // Stryker disable next-line BooleanLiteral: the block-end pass in buildNightSteps overwrites every night step's flag
      return { screen, roundIndex, questionIndex: null, isBlockEnd: false };
  }
}

function buildAnswerAfterQuestionSteps(
  fullSession: SessionState,
  rounds: readonly SeededRound[],
): BareStep[] {
  // The block helpers can't place a round with no questions, so questions are
  // placed in a session without such rounds; title cards come from the full one.
  const questionRoundIndexes = rounds.flatMap((round, index) =>
    round.questions.length > 0 ? [index] : [],
  );
  const questionSession = freshSessionState({
    ...fullSession.seededGame,
    rounds: questionRoundIndexes.map((index) => rounds[index]),
  });
  const context = getGameContext(questionSession);

  const steps: BareStep[] = [];
  rounds.forEach((round, roundIndex) => {
    const introProgress: GameProgress = {
      ...LOBBY_PROGRESS,
      status: 'round_intro',
      roundIndex,
    };
    steps.push({
      screen: displayScreenAt(fullSession, introProgress),
      onAir: onAirScreenAt(fullSession, introProgress),
      roundIndex,
      questionIndex: null,
      isBlockEnd: false,
    });

    const placedRoundIndex = questionRoundIndexes.indexOf(roundIndex);
    round.questions.forEach((_, questionIndex) => {
      const isLastQuestion =
        placedRoundIndex === questionRoundIndexes.length - 1 &&
        questionIndex === round.questions.length - 1;
      const isBlockEnd =
        isLastQuestion ||
        isBreakPointQuestion(placedRoundIndex, questionIndex, context);
      const at = { roundIndex: placedRoundIndex, questionIndex };
      const openProgress: GameProgress = {
        ...LOBBY_PROGRESS,
        ...at,
        status: 'question_open',
      };
      const revealProgress: GameProgress = {
        ...LOBBY_PROGRESS,
        ...at,
        status: 'reveal',
        revealIndex: getBlockPositionForQuestion(
          placedRoundIndex,
          questionIndex,
          context,
        ),
      };
      steps.push(
        {
          screen: displayScreenAt(questionSession, openProgress),
          onAir: onAirScreenAt(
            questionSession,
            openProgress,
            questionRoundIndexes,
          ),
          roundIndex,
          questionIndex,
          isBlockEnd: false,
        },
        {
          screen: displayScreenAt(questionSession, revealProgress),
          onAir: onAirScreenAt(
            questionSession,
            revealProgress,
            questionRoundIndexes,
          ),
          roundIndex,
          questionIndex,
          isBlockEnd,
        },
      );
    });
  });

  return steps;
}
