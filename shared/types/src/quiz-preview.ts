import type { DisplayScreen } from './display-screen';
import {
  getBlockPositionForQuestion,
  isBreakPointQuestion,
} from './game-state-block-position';
import { planNextPress } from './move-plan';
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
  /** The round's note, on its title card, when the round doesn't show it on the big screen. */
  roundNote: string | null;
  /** The note of the question the step shows. */
  questionNote: string | null;
}

/** A step before its host-only text is attached. */
type BareStep = Omit<QuizPreviewStep, 'hostOnly'>;

function nonEmpty(text: string | null | undefined): string | null {
  return text && text.trim() !== '' ? text : null;
}

/** Attaches each step's host-only text from the round and question it sits at. */
function withHostOnly(
  steps: BareStep[],
  rounds: readonly SeededRound[],
): QuizPreviewStep[] {
  return steps.map((step) => {
    const round = rounds[step.roundIndex];
    const isTitleCard = step.screen.kind === 'round_title';
    const questionId =
      step.questionIndex === null
        ? undefined
        : round?.questions[step.questionIndex]?.id;
    return {
      ...step,
      hostOnly: {
        roundNote:
          isTitleCard && !round?.showNoteOnScreen
            ? nonEmpty(round?.note)
            : null,
        questionNote:
          questionId === undefined
            ? null
            : nonEmpty(round?.questionNotesById?.[questionId]),
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
  'round_title',
  'question',
  'break_intro',
  'reveal_intro',
  'reveal',
];

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
): QuizPreview {
  const fullSession = freshSessionState({
    quizId: 0,
    gameSessionId: 0,
    joinCode: '',
    rounds: [...rounds],
    settings: PREVIEW_SETTINGS,
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
 * The order the room sees: the real Advance plan is walked as a dry run
 * (Start quiz, then Advance until nothing moves; no grading writes, nothing
 * saved) and only the screens with quiz content are kept.
 */
function buildNightSteps(fullSession: SessionState): BareStep[] {
  const { rounds } = fullSession.seededGame;
  // A quiz with no rounds has nothing to show, not even an overview of nothing.
  if (rounds.length === 0) return [];

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
            roundIndex: 0,
            questionIndex: null,
            isBlockEnd: false,
          },
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
      nextEmpty < emptyRounds.length &&
      emptyRounds[nextEmpty] < roundIndex
    ) {
      steps.push(emptyRoundTitle(fullSession, emptyRounds[nextEmpty]));
      nextEmpty += 1;
    }
  };
  for (const step of walked) {
    if (step.screen.kind === 'round_title')
      pushEmptyTitlesBefore(step.roundIndex);
    steps.push(step);
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
  return {
    screen: displayScreenAt(fullSession, {
      ...LOBBY_PROGRESS,
      status: 'round_intro',
      roundIndex,
    }),
    roundIndex,
    questionIndex: null,
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
  for (let press = 0; press <= MAX_NIGHT_PRESSES; press += 1) {
    const { screen } = projectScreen(session, SOCKET_ROOMS.DISPLAY);
    if (NIGHT_SCREEN_KINDS.includes(screen.kind)) {
      steps.push(
        nightStep(
          renumberRounds(screen, placed),
          placed[session.progress.roundIndex],
          positions,
        ),
      );
    }
    const next = dryRunPress(session);
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

/** The session after the next Advance press, or null when a press would move nothing (the end of the quiz). Nothing is graded or saved. */
function dryRunPress(session: SessionState): SessionState | null {
  const move = planNextPress(session);
  switch (move.kind) {
    case 'transition':
    case 'leaderboard_hide':
    case 'join_overlay_hide':
      return { ...session, progress: move.progress };
    case 'leaderboard_reveal':
      return {
        ...session,
        leaderboardRevealCount: session.leaderboardRevealCount + 1,
      };
    case 'closest_guess_step':
      return move.session;
    case 'showdown_step':
    case 'showdown_waiting':
    case 'grading_pending':
    case 'blocked':
      return null;
  }
}

function nightStep(
  screen: DisplayScreen,
  roundIndex: number,
  positions: ReturnType<typeof questionPositions>,
): BareStep {
  switch (screen.kind) {
    case 'question':
    case 'reveal': {
      const position = positions.get(screen.question.id) ?? {
        roundIndex,
        questionIndex: null,
      };
      return { screen, ...position, isBlockEnd: false };
    }
    case 'reveal_intro':
      return {
        screen,
        roundIndex: screen.roundNumber - 1,
        questionIndex: null,
        isBlockEnd: false,
      };
    case 'break_intro':
      // The feedback prompt belongs to the live final break, not to content.
      return {
        screen: { ...screen, isFeedbackPromptShown: false },
        roundIndex,
        questionIndex: null,
        isBlockEnd: false,
      };
    default:
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
    steps.push({
      screen: displayScreenAt(fullSession, {
        ...LOBBY_PROGRESS,
        status: 'round_intro',
        roundIndex,
      }),
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
      steps.push(
        {
          screen: displayScreenAt(questionSession, {
            ...LOBBY_PROGRESS,
            ...at,
            status: 'question_open',
          }),
          roundIndex,
          questionIndex,
          isBlockEnd: false,
        },
        {
          screen: displayScreenAt(questionSession, {
            ...LOBBY_PROGRESS,
            ...at,
            status: 'reveal',
            revealIndex: getBlockPositionForQuestion(
              placedRoundIndex,
              questionIndex,
              context,
            ),
          }),
          roundIndex,
          questionIndex,
          isBlockEnd,
        },
      );
    });
  });

  return steps;
}
