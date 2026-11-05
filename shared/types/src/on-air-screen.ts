import {
  isBreakStatus,
  isRevealingStatus,
  type RevealingStatus,
} from './game-state-groups';
import type { GameProgress, GameStatus } from './game-state-types';
import type {
  BlockQuestionView,
  BlockRevealQuestionView,
  QuestionView,
} from './question-views';
import type { SessionSettings } from './session-settings';
import type { ActiveShowdownView } from './showdown';

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
  | { kind: 'joker_pick' }
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
  | { kind: 'break_intro'; roundIndex: number; isFeedbackPromptShown: boolean }
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
  | { kind: 'join_overlay' }
  | { kind: 'ended'; isFeedbackPromptShown: boolean }
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
  /** Read for the big screen's feedback prompt; absent reads as feedback off. */
  settings?: Pick<SessionSettings, 'collectFeedback'>;
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

function questionScreen(
  input: OnAirInput,
  kind: 'question' | 'locking',
): OnAirScreen {
  const { progress } = input;
  return {
    kind,
    roundIndex: progress.roundIndex,
    questionIndex: progress.questionIndex,
    questionId: input.currentQuestion?.id ?? null,
  };
}

function breakScreen(
  input: OnAirInput,
  breakQuestion: BlockQuestionView | undefined,
): OnAirScreen {
  const { progress } = input;
  if (progress.status === 'break_round_intro') {
    return {
      kind: 'break_round_title',
      roundIndex: breakQuestion ? breakQuestion.roundNumber - 1 : null,
      questionId: breakQuestion?.id ?? null,
    };
  }
  if (progress.status === 'break' && breakQuestion) {
    return { kind: 'break_review', questionId: breakQuestion.id };
  }
  return {
    kind: 'break_intro',
    roundIndex: progress.roundIndex,
    isFeedbackPromptShown: input.settings?.collectFeedback ?? false,
  };
}

function revealScreen(
  kind: 'reveal_intro' | 'reveal',
  revealQuestion: BlockRevealQuestionView | undefined,
): OnAirScreen {
  return {
    kind,
    roundIndex: revealQuestion ? revealQuestion.roundNumber - 1 : null,
    questionId: revealQuestion?.id ?? null,
  };
}

function endedScreen(input: OnAirInput): OnAirScreen {
  return input.activeShowdown
    ? { kind: 'showdown', showdownId: input.activeShowdown.id }
    : {
        kind: 'ended',
        isFeedbackPromptShown: input.settings?.collectFeedback ?? false,
      };
}

function getScreen(
  input: OnAirInput,
  breakQuestion: BlockQuestionView | undefined,
  revealQuestion: BlockRevealQuestionView | undefined,
): OnAirScreen {
  const { progress } = input;
  if (progress.isLeaderboardVisible) return { kind: 'leaderboard' };
  if (progress.isJoinOverlayVisible) return { kind: 'join_overlay' };
  const { status } = progress;
  if (isBreakStatus(status)) return breakScreen(input, breakQuestion);
  if (isRevealingStatus(status)) return revealScreen(status, revealQuestion);
  switch (status) {
    case 'round_intro':
      return { kind: 'round_title', roundIndex: progress.roundIndex };
    case 'question_open':
      return questionScreen(input, 'question');
    case 'locking':
      return questionScreen(input, 'locking');
    case 'ended':
      return endedScreen(input);
    default:
      return { kind: status };
  }
}

function endedScreenKey(input: OnAirInput): string {
  return input.activeShowdown
    ? `ended-showdown-${input.activeShowdown.id}-${input.showdownRevealStep ?? 0}`
    : 'ended';
}

function revealScreenKey(
  input: OnAirInput,
  status: RevealingStatus,
  revealQuestion: RoundPosition | undefined,
): string {
  const position = `${revealQuestion?.roundNumber ?? 0}-${revealQuestion?.questionNumberInRound ?? 0}`;
  return status === 'reveal'
    ? `reveal-${position}-${input.closestGuessRevealStep ?? 0}`
    : `reveal_intro-${position}`;
}

function getScreenKey(
  input: OnAirInput,
  revealQuestion: RoundPosition | undefined,
): string {
  const { progress } = input;
  if (progress.isLeaderboardVisible) return 'leaderboard';
  if (progress.isJoinOverlayVisible) return 'join_overlay';
  return statusScreenKey(input, revealQuestion);
}

function statusScreenKey(
  input: OnAirInput,
  revealQuestion: RoundPosition | undefined,
): string {
  const { progress } = input;
  const { status } = progress;
  if (isRevealingStatus(status)) {
    return revealScreenKey(input, status, revealQuestion);
  }
  switch (status) {
    case 'ended':
      return endedScreenKey(input);
    case 'question_open':
    case 'locking':
      return `${status}-${progress.roundIndex}-${progress.questionIndex}`;
    case 'round_intro':
    case 'break_intro':
      return `${status}-${progress.roundIndex}`;
    case 'break':
      return `break-${progress.roundIndex}-${progress.revealIndex}`;
    case 'break_round_intro':
      return `break_round_intro-${progress.revealIndex}`;
    default:
      return status;
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

const PRE_QUIZ_SCREENS = 4;
const ROUND_SPAN = 1_000;
const REGION_SPAN = 10_000;
/** Regions of one question's slot, in the order the quiz walks them. */
const REGION = {
  roundIntro: 0,
  question: 1,
  locking: 2,
  breakReview: 3,
  breakIntro: 4,
  reveal: 5,
} as const;
const REGIONS = 6;
/** The ended screen is the highest position: nothing comes after it, so END_QUIZ grows from anywhere. */
const ENDED_POSITION = Number.MAX_SAFE_INTEGER;

/** A title card (even step) comes just before the answer it introduces (odd step). */
function walkStep(revealIndex: number, isCardOnAir: boolean): number {
  return revealIndex * 2 + (isCardOnAir ? 0 : 1);
}

const PRE_QUIZ_POSITION: Partial<Record<GameStatus, number>> = {
  lobby: 0,
  rules: 1,
  round_overview: 2,
  joker_pick: 3,
  ended: ENDED_POSITION,
};

/** Each in-quiz status's region, and whether its walk step is a title card (else null: no walk). */
const IN_QUIZ_REGION: Partial<
  Record<GameStatus, { region: number; isCard: boolean | null }>
> = {
  round_intro: { region: REGION.roundIntro, isCard: null },
  question_open: { region: REGION.question, isCard: null },
  locking: { region: REGION.locking, isCard: null },
  break: { region: REGION.breakReview, isCard: false },
  break_round_intro: { region: REGION.breakReview, isCard: true },
  break_intro: { region: REGION.breakIntro, isCard: null },
  reveal_intro: { region: REGION.reveal, isCard: true },
  reveal: { region: REGION.reveal, isCard: false },
};

/**
 * One number that orders the On-air screens of a quiz: it grows on every
 * forward move (START_QUIZ, ADVANCE, END_QUIZ) that changes the screen under
 * any overlay and falls on every PREVIOUS that does. Overlays, rank, showdown
 * and closest-guess steps and media actions don't move it, because it reads
 * only the progress fields that name the screen. Break and reveal keep the
 * block's last round and question while `revealIndex` walks, so (round,
 * question) orders the slots, the region orders a slot's stages, and the step
 * orders the title cards and answers within a walk. The screen key only says
 * the screen changed; this says which way.
 */
export function screenPositionOf(progress: GameProgress): number {
  const { status, roundIndex, questionIndex, revealIndex } = progress;
  const preQuiz = PRE_QUIZ_POSITION[status];
  if (preQuiz !== undefined) return preQuiz;
  const { region, isCard } = IN_QUIZ_REGION[status]!;
  const slot =
    (roundIndex * ROUND_SPAN + (status === 'round_intro' ? 0 : questionIndex)) *
    REGIONS *
    REGION_SPAN;
  const step = isCard === null ? 0 : walkStep(revealIndex, isCard);
  return PRE_QUIZ_SCREENS + slot + region * REGION_SPAN + step;
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
    progress: {
      ...input.progress,
      isLeaderboardVisible: false,
      isJoinOverlayVisible: false,
    },
  });
  return {
    onDisplayQuestionId: onDisplayQuestionIdOf(screen),
    titleCardRoundIndex: titleCardRoundIndexOf(screen),
    breakRoundIndex: BREAK_LIT_SCREENS.has(screen.kind)
      ? input.progress.roundIndex
      : null,
  };
}

const BREAK_LIT_SCREENS: ReadonlySet<OnAirScreen['kind']> = new Set([
  'break_review',
  'break_round_title',
  'break_intro',
]);

function onDisplayQuestionIdOf(screen: OnAirScreen): number | null {
  switch (screen.kind) {
    case 'question':
    case 'locking':
    case 'reveal':
    case 'break_review':
      return screen.questionId;
    default:
      return null;
  }
}

function titleCardRoundIndexOf(screen: OnAirScreen): number | null {
  switch (screen.kind) {
    case 'round_title':
    case 'reveal_intro':
    case 'break_round_title':
      return screen.roundIndex;
    default:
      return null;
  }
}

/**
 * What the block browser does: `answering` while the block is answerable,
 * `locked` in break and break review, `revealing` from the reveal intro
 * through reveal.
 */
export type BlockMode = 'answering' | 'locked' | 'revealing';

function blockModeOf(input: PlayersScreenInput): BlockMode {
  if (input.isAnswerable) return 'answering';
  if (isBreakStatus(input.progress.status)) return 'locked';
  if (isRevealingStatus(input.progress.status)) return 'revealing';
  return 'answering';
}

/**
 * The screen a team's phone shows, named once by the server. The players
 * room is one broadcast for every team, so which team a phone belongs to is
 * not here: on `showdown_guessing` the phone picks the guess form or the
 * "Tiebreaker in progress" message from its own team id.
 */
export type PhoneScreen =
  | { kind: 'leaderboard' }
  /** The block browser; carries its mode and the question the big screen is revealing (else null) for the phone to follow. */
  | { kind: 'block'; mode: BlockMode; onScreenQuestionId: number | null }
  | { kind: 'lobby' }
  | { kind: 'rules' }
  | { kind: 'round_overview' }
  /** The joker pick: `isOpen` while teams may still choose, false once it has closed (the phone then shows the result). */
  | { kind: 'joker_pick'; isOpen: boolean }
  /** A round's title card; `roundNumber` is the 1-based position of that round in the quiz, so a phone can tell whether it is the team's joker round. */
  | { kind: 'round_title'; title: string; roundNumber: number }
  | { kind: 'ended' }
  | { kind: 'showdown_guessing' }
  | { kind: 'showdown_reveal' };

/**
 * The one rule for "the showdown accepts guesses": the round is the one named,
 * it is not resolved, and the reveal has not started (step 0). The phone's
 * showdown_guessing screen and the server's guard both follow it, so a phone
 * never shows the guess form for a guess the server refuses.
 */
export function isShowdownAcceptingGuesses(
  activeRound: { id: number; resolved: boolean } | null,
  roundId: number,
  revealStep: number,
): boolean {
  return (
    activeRound !== null &&
    activeRound.id === roundId &&
    !activeRound.resolved &&
    revealStep === 0
  );
}

/** What a team's phone is told about its screen. */
export interface PlayersScreenFields {
  phoneScreen: PhoneScreen;
}

/** The core snapshot plus the one server-only fact the phone screen needs. */
export interface PlayersScreenInput extends OnAirInput {
  /** Whether the current block can be answered right now (false for a kahoot question hidden behind the board). */
  isAnswerable: boolean;
  /** Whether the active showdown round has been decided (false when there is none). */
  isShowdownResolved: boolean;
  /** Whether the joker pick is open for choosing right now (false outside the pick). */
  isJokerPickOpen: boolean;
}

function roundTitleCardOf(
  questions:
    | readonly Pick<BlockQuestionView, 'id' | 'roundTitle' | 'roundNumber'>[]
    | undefined,
  questionId: number | null,
): { title: string; roundNumber: number } | null {
  const question = questions?.find((candidate) => candidate.id === questionId);
  return question
    ? { title: question.roundTitle, roundNumber: question.roundNumber }
    : null;
}

/**
 * First match wins: the board over a block nobody can answer, then a block
 * teams can answer or review, then the pre-game screens, title cards and the
 * end. Past the leaderboard it reads the content the session is on, not
 * whether the board covers it.
 */
export function describePlayersScreen(
  input: PlayersScreenInput,
): PlayersScreenFields {
  return { phoneScreen: getPhoneScreen(input) };
}

function getPhoneScreen(input: PlayersScreenInput): PhoneScreen {
  if (input.progress.isLeaderboardVisible && !input.isAnswerable) {
    return { kind: 'leaderboard' };
  }
  const mode = blockModeOf(input);
  if (input.isAnswerable) {
    return { kind: 'block', mode, onScreenQuestionId: null };
  }

  const { screen } = describeOnAirScreen({
    ...input,
    progress: {
      ...input.progress,
      isLeaderboardVisible: false,
      isJoinOverlayVisible: false,
    },
  });
  return phoneScreenUnderBoard(input, screen, mode);
}

type PassThroughScreen = Extract<
  OnAirScreen,
  { kind: 'lobby' | 'rules' | 'round_overview' | 'ended' }
>;
const PASS_THROUGH_KINDS: ReadonlySet<OnAirScreen['kind']> = new Set([
  'lobby',
  'rules',
  'round_overview',
  'ended',
]);
function isPassThroughScreen(screen: OnAirScreen): screen is PassThroughScreen {
  return PASS_THROUGH_KINDS.has(screen.kind);
}

/** The phone screen for the content on air, read as if the board weren't covering it. */
function phoneScreenUnderBoard(
  input: PlayersScreenInput,
  screen: OnAirScreen,
  mode: BlockMode,
): PhoneScreen {
  if (isPassThroughScreen(screen)) return { kind: screen.kind };
  switch (screen.kind) {
    case 'joker_pick':
      return { kind: 'joker_pick', isOpen: input.isJokerPickOpen };
    case 'round_title':
      return {
        kind: 'round_title',
        title: input.roundTitle ?? '',
        roundNumber: screen.roundIndex + 1,
      };
    case 'reveal':
      return { kind: 'block', mode, onScreenQuestionId: screen.questionId };
    case 'reveal_intro':
    case 'break_round_title':
      return walkTitleCardPhoneScreen(input, screen, mode);
    case 'showdown':
      return showdownPhoneScreen(input, screen.showdownId);
    default:
      return { kind: 'block', mode, onScreenQuestionId: null };
  }
}

function walkTitleCardPhoneScreen(
  input: PlayersScreenInput,
  screen: Extract<OnAirScreen, { kind: 'reveal_intro' | 'break_round_title' }>,
  mode: BlockMode,
): PhoneScreen {
  const card = roundTitleCardOf(
    screen.kind === 'reveal_intro'
      ? input.revealQuestions
      : input.blockQuestions,
    screen.questionId,
  );
  return card === null
    ? { kind: 'block', mode, onScreenQuestionId: null }
    : { kind: 'round_title', ...card };
}

function showdownPhoneScreen(
  input: PlayersScreenInput,
  showdownId: number,
): PhoneScreen {
  return {
    kind: isShowdownAcceptingGuesses(
      { id: showdownId, resolved: input.isShowdownResolved },
      showdownId,
      input.showdownRevealStep ?? 0,
    )
      ? 'showdown_guessing'
      : 'showdown_reveal',
  };
}

/** A round a team can be asked to rate. */
export interface RatableRound {
  id: number;
  title: string;
}

/**
 * What the players room is offered to rate right now, shared by every phone:
 * the break card with the rounds of the block that just locked, or the final
 * form with every round of the quiz. Null when nothing is open for rating.
 * The phone draws from this and never decides for itself.
 */
export type FeedbackField = {
  kind: 'break_card' | 'final_form';
  rounds: RatableRound[];
} | null;

/**
 * The one rule for which rounds are open for rating: nothing when the
 * session doesn't collect feedback, otherwise the current block's
 * rounds while the session is in a break status, every round at `ended`
 * unless a showdown is still being played, nothing otherwise. The players
 * view's feedback field is this, and the server accepts a rating only for a
 * round it lists, so the two cannot disagree.
 */
export function describeFeedback(input: {
  progress: Pick<GameProgress, 'status'>;
  /** The session's `collectFeedback` setting; when off, nothing is open for rating. */
  isFeedbackCollected: boolean;
  /** Whether a showdown round has been created and not yet decided. */
  isShowdownBeingPlayed: boolean;
  /** The rounds of the block the session is on, in quiz order; only read in a break status. */
  blockRounds: () => readonly RatableRound[];
  /** Every round of the quiz in order, kahoot rounds included; only read at `ended`. */
  allRounds: () => readonly RatableRound[];
}): FeedbackField {
  const { status } = input.progress;
  if (!input.isFeedbackCollected) return null;
  if (isBreakStatus(status)) {
    return { kind: 'break_card', rounds: [...input.blockRounds()] };
  }
  if (status === 'ended' && !input.isShowdownBeingPlayed) {
    return { kind: 'final_form', rounds: [...input.allRounds()] };
  }
  return null;
}
