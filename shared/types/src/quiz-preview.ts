import type { DisplayScreen } from './display-screen';
import {
  getBlockPositionForQuestion,
  isBreakPointQuestion,
} from './game-state-block-position';
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
export const QUIZ_PREVIEW_MODES = ['answer_after_question'] as const;
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
};

function displayScreenAt(
  session: SessionState,
  progress: GameProgress,
): DisplayScreen {
  return projectScreen({ ...session, progress }, SOCKET_ROOMS.DISPLAY).screen;
}

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

  const steps: QuizPreviewStep[] = [];
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
    steps,
  };
}
