import type { GameProgress } from './game-state-types';
import type {
  ActiveShowdownView,
  BlockQuestionView,
  BlockRevealQuestionView,
  QuestionView,
} from './socket-events';

/**
 * The screen /display has on air, named once. The question or round a screen
 * is about is resolved here — progress.roundIndex stays pinned to the block's
 * last round throughout break and reveal, so the screens that follow the
 * reveal index carry the round/question they actually show.
 */
export type OnAirScreen =
  | { kind: 'lobby' }
  | { kind: 'rules' }
  | { kind: 'round_overview' }
  | { kind: 'round_title'; roundIndex: number }
  | {
      kind: 'question';
      roundIndex: number;
      questionIndex: number;
      questionId: number | null;
    }
  | {
      kind: 'locking';
      roundIndex: number;
      questionIndex: number;
      questionId: number | null;
    }
  | { kind: 'break_intro'; roundIndex: number }
  | { kind: 'break_review'; questionId: number }
  | {
      kind: 'break_round_title';
      roundIndex: number | null;
      questionId: number | null;
    }
  | {
      kind: 'reveal_intro';
      roundIndex: number | null;
      questionId: number | null;
    }
  | { kind: 'reveal'; roundIndex: number | null; questionId: number | null }
  | { kind: 'leaderboard' }
  | { kind: 'ended' }
  | { kind: 'showdown'; showdownId: number };

/** The header bar's content — any part may be absent, in which case that part isn't drawn. */
export interface HeaderContent {
  label?: string;
  title?: string;
  badge?: string;
}

/** What /display needs to know about the screen on air, derived from the core snapshot. */
export interface OnAirDescription {
  screen: OnAirScreen;
  /** Changes only when what's on screen changes, so the transition doesn't replay for e.g. a ticking answer count. */
  screenKey: string;
  header: HeaderContent;
}

/** The core snapshot fields the on-air screen is derived from. */
export interface OnAirInput {
  progress: GameProgress;
  roundTitle?: string;
  currentQuestion?: QuestionView | null;
  blockQuestions?: BlockQuestionView[];
  revealQuestions?: BlockRevealQuestionView[];
  closestGuessRevealStep?: number;
  activeShowdown?: Pick<ActiveShowdownView, 'id'> | null;
  showdownRevealStep?: number;
}

type RoundPosition = Pick<
  BlockQuestionView,
  'roundNumber' | 'questionNumberInRound' | 'roundTitle'
>;

function getHeader(
  input: OnAirInput,
  breakQuestion: RoundPosition | undefined,
  revealQuestion: RoundPosition | undefined,
): HeaderContent {
  const { progress } = input;
  switch (progress.status) {
    case 'question_open':
    case 'locking':
      return {
        label: `ROUND ${progress.roundIndex + 1}`,
        title: input.roundTitle ?? '',
        badge: `QUESTION ${progress.questionIndex + 1}`,
      };
    case 'break':
      if (breakQuestion === undefined) return {};
      return {
        label: `ROUND ${breakQuestion.roundNumber}`,
        title: breakQuestion.roundTitle,
        badge: `QUESTION ${breakQuestion.questionNumberInRound} (BREAK)`,
      };
    case 'reveal':
      if (revealQuestion === undefined) return {};
      return {
        label: `ROUND ${revealQuestion.roundNumber}`,
        title: revealQuestion.roundTitle,
        badge: `REVEALING ANSWERS · QUESTION ${revealQuestion.questionNumberInRound}`,
      };
    default:
      return {};
  }
}

function getScreen(
  input: OnAirInput,
  breakQuestion: BlockQuestionView | undefined,
  revealQuestion: BlockRevealQuestionView | undefined,
): OnAirScreen {
  const { progress } = input;
  if (progress.isLeaderboardVisible) return { kind: 'leaderboard' };

  const questionId = input.currentQuestion?.id ?? null;
  const revealRoundIndex = revealQuestion
    ? revealQuestion.roundNumber - 1
    : null;
  switch (progress.status) {
    case 'lobby':
    case 'rules':
    case 'round_overview':
      return { kind: progress.status };
    case 'round_intro':
      return { kind: 'round_title', roundIndex: progress.roundIndex };
    case 'question_open':
      return {
        kind: 'question',
        roundIndex: progress.roundIndex,
        questionIndex: progress.questionIndex,
        questionId,
      };
    case 'locking':
      return {
        kind: 'locking',
        roundIndex: progress.roundIndex,
        questionIndex: progress.questionIndex,
        questionId,
      };
    case 'break_intro':
      return { kind: 'break_intro', roundIndex: progress.roundIndex };
    case 'break':
      return breakQuestion
        ? { kind: 'break_review', questionId: breakQuestion.id }
        : { kind: 'break_intro', roundIndex: progress.roundIndex };
    case 'break_round_intro':
      return {
        kind: 'break_round_title',
        roundIndex: breakQuestion ? breakQuestion.roundNumber - 1 : null,
        questionId: breakQuestion?.id ?? null,
      };
    case 'reveal_intro':
      return {
        kind: 'reveal_intro',
        roundIndex: revealRoundIndex,
        questionId: revealQuestion?.id ?? null,
      };
    case 'reveal':
      return {
        kind: 'reveal',
        roundIndex: revealRoundIndex,
        questionId: revealQuestion?.id ?? null,
      };
    case 'ended':
      return input.activeShowdown
        ? { kind: 'showdown', showdownId: input.activeShowdown.id }
        : { kind: 'ended' };
  }
}

function getScreenKey(
  input: OnAirInput,
  revealQuestion: RoundPosition | undefined,
): string {
  const { progress } = input;
  if (progress.isLeaderboardVisible) return 'leaderboard';

  const revealPosition = `${revealQuestion?.roundNumber ?? 0}-${revealQuestion?.questionNumberInRound ?? 0}`;
  switch (progress.status) {
    case 'ended':
      return input.activeShowdown
        ? `ended-showdown-${input.activeShowdown.id}-${input.showdownRevealStep ?? 0}`
        : 'ended';
    case 'question_open':
    case 'locking':
      return `${progress.status}-${progress.roundIndex}-${progress.questionIndex}`;
    case 'round_intro':
      return `round_intro-${progress.roundIndex}`;
    case 'break_intro':
      return `break_intro-${progress.roundIndex}`;
    case 'break':
      return `break-${progress.roundIndex}-${progress.revealIndex}`;
    case 'break_round_intro':
      return `break_round_intro-${progress.revealIndex}`;
    case 'reveal_intro':
      return `reveal_intro-${revealPosition}`;
    case 'reveal':
      return `reveal-${revealPosition}-${input.closestGuessRevealStep ?? 0}`;
    default:
      return progress.status;
  }
}

/**
 * Names the screen on air and derives its transition key and header content.
 * The question under review during break and reveal is looked up by the
 * reveal index here, once, instead of by every page that draws it.
 */
export function describeOnAirScreen(input: OnAirInput): OnAirDescription {
  const breakQuestion = input.blockQuestions?.[input.progress.revealIndex];
  const revealQuestion = input.revealQuestions?.[input.progress.revealIndex];
  return {
    screen: getScreen(input, breakQuestion, revealQuestion),
    screenKey: getScreenKey(input, revealQuestion),
    header: getHeader(input, breakQuestion, revealQuestion),
  };
}

/** What the quiz master's question browser marks as on air, for /control. */
export interface AdminIndicators {
  /** The question on the big screen while one is shown (open, locking, break review, reveal), else null. */
  onDisplayQuestionId: number | null;
  /** The round whose title card is on the big screen (round intro, reveal intro, break round intro), else null. */
  titleCardRoundIndex: number | null;
  /** The round whose break indicator is lit — the block-ending round, for the whole of a break — else null. */
  breakRoundIndex: number | null;
}

/**
 * The indicators are about the content the session is on, not whether the
 * leaderboard happens to cover it: hiding the board resumes exactly there, so
 * they are read from the screen that would be on air without the board.
 */
export function describeAdminIndicators(input: OnAirInput): AdminIndicators {
  const { screen } = describeOnAirScreen({
    ...input,
    progress: { ...input.progress, isLeaderboardVisible: false },
  });
  switch (screen.kind) {
    case 'question':
    case 'locking':
    case 'reveal':
    case 'break_review':
      return {
        onDisplayQuestionId: screen.questionId,
        titleCardRoundIndex: null,
        breakRoundIndex:
          screen.kind === 'break_review' ? input.progress.roundIndex : null,
      };
    case 'round_title':
    case 'reveal_intro':
      return {
        onDisplayQuestionId: null,
        titleCardRoundIndex: screen.roundIndex,
        breakRoundIndex: null,
      };
    case 'break_round_title':
      return {
        onDisplayQuestionId: null,
        titleCardRoundIndex: screen.roundIndex,
        breakRoundIndex: input.progress.roundIndex,
      };
    case 'break_intro':
      return {
        onDisplayQuestionId: null,
        titleCardRoundIndex: null,
        breakRoundIndex: input.progress.roundIndex,
      };
    default:
      return {
        onDisplayQuestionId: null,
        titleCardRoundIndex: null,
        breakRoundIndex: null,
      };
  }
}
