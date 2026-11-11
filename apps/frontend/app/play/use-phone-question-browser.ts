import { useEffect, useState } from 'react';
import {
  isRevealQuestionStatus,
  type StateViewByRoom,
} from '@campus-pubquiz/types';
import {
  browsedQuestionAfterAutoAdvanceChange,
  selectPhoneQuestion,
} from '@/app/play/phone-question-selection';
import {
  readAutoAdvanceSetting,
  writeAutoAdvanceSetting,
} from '@/app/lib/player-settings-storage';

type PlayersView = StateViewByRoom['players'];
type SelectedQuestion = NonNullable<PlayersView['currentQuestion']>;
type RevealQuestion = PlayersView['revealQuestions'][number];

export interface PhoneQuestionNavigation {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

export interface PhoneQuestionBrowser {
  /** The question the block browser shows; null when the phone screen isn't `block` or nothing resolves. */
  selectedQuestion: SelectedQuestion | null;
  /** The selected question with its correct answer, during the reveal only. */
  revealQuestion: RevealQuestion | undefined;
  /** Set only with auto-advance off. */
  navigation: PhoneQuestionNavigation | undefined;
  /** The block's question ids, while the block browser is shown. */
  jumpableQuestionIds: Set<number>;
  selectQuestion: (questionId: number) => void;
  autoAdvanceEnabled: boolean;
  setAutoAdvance: (enabled: boolean) => void;
}

const NO_QUESTIONS: readonly never[] = [];

/**
 * Browsing on a team's phone: which question the block browser shows, the
 * team's tapped pick, the auto-advance setting and the snap-back bookkeeping.
 * Takes no view while the phone hasn't received one.
 */
export function usePhoneQuestionBrowser(
  view: PlayersView | null,
): PhoneQuestionBrowser {
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useAutoAdvanceSetting();
  // null = follow the question currently shown on the big screen.
  const [browsedQuestionId, selectQuestion] = useState<number | null>(null);
  const {
    currentQuestion,
    currentQuestionId,
    revealSyncKey,
    blockQuestions,
    onScreenQuestionId,
    isBlockScreen,
  } = browserInputsOf(view);
  // What selectPhoneQuestion compares against to spot a new question or
  // reveal step; synced during render after the call below.
  const [prevQuestionId, setPrevQuestionId] = useState(currentQuestionId);
  const [prevRevealSyncKey, setPrevRevealSyncKey] = useState(revealSyncKey);

  const {
    selectedQuestion: resolvedQuestion,
    previousQuestion,
    nextQuestion,
    browsedQuestionId: nextBrowsedQuestionId,
  } = selectPhoneQuestion({
    openedQuestions: blockQuestions,
    currentQuestion,
    onScreenQuestionId,
    browsedQuestionId,
    autoAdvanceEnabled,
    revealSyncKey,
    previousCurrentQuestionId: prevQuestionId,
    previousRevealSyncKey: prevRevealSyncKey,
  });
  // Adjusted during render rather than in an Effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (nextBrowsedQuestionId !== browsedQuestionId) {
    selectQuestion(nextBrowsedQuestionId);
  }
  if (currentQuestionId !== prevQuestionId) {
    setPrevQuestionId(currentQuestionId);
  }
  if (revealSyncKey !== prevRevealSyncKey) {
    setPrevRevealSyncKey(revealSyncKey);
  }

  function setAutoAdvance(enabled: boolean): void {
    writeAutoAdvanceSetting(enabled);
    setAutoAdvanceEnabled(enabled);
    selectQuestion(
      browsedQuestionAfterAutoAdvanceChange(enabled, browsedQuestionId),
    );
  }

  const selectedQuestion = isBlockScreen ? resolvedQuestion : null;
  const jumpableQuestionIds = selectedQuestion
    ? new Set(blockQuestions.map((question) => question.id))
    : new Set<number>();

  return {
    selectedQuestion,
    revealQuestion: revealQuestionOf(view, selectedQuestion),
    navigation: autoAdvanceEnabled
      ? undefined
      : browserNavigation(previousQuestion, nextQuestion, selectQuestion),
    jumpableQuestionIds,
    selectQuestion,
    autoAdvanceEnabled,
    setAutoAdvance,
  };
}

/**
 * Starts true (always-follow) and is corrected once localStorage is
 * readable post-mount, the same SSR-safe pattern as use-team-link.ts.
 */
function useAutoAdvanceSetting() {
  // Stryker disable next-line BooleanLiteral: equivalent — the effect below replaces the initial value before anything can read it
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  useEffect(
    () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoAdvanceEnabled(readAutoAdvanceSetting());
    },
    // Stryker disable next-line ArrayDeclaration: equivalent — a constant dependency is as stable as none
    [],
  );
  return [autoAdvanceEnabled, setAutoAdvanceEnabled] as const;
}

const NO_VIEW_INPUTS = {
  currentQuestion: null,
  currentQuestionId: null,
  revealSyncKey: null,
  blockQuestions: NO_QUESTIONS,
  onScreenQuestionId: null,
  // Stryker disable next-line BooleanLiteral: equivalent — with no view there are no block questions, so the jumpable set is empty either way
  isBlockScreen: false,
};

/** What the browser reads from the view; all empty before the first view. */
function browserInputsOf(view: PlayersView | null) {
  if (!view) return NO_VIEW_INPUTS;
  const { currentQuestion, phoneScreen, progress } = view;
  const isBlockScreen = phoneScreen.kind === 'block';
  return {
    currentQuestion,
    currentQuestionId: currentQuestion?.id ?? null,
    // Only changes while actively revealing (currentQuestionId stays null
    // throughout break/reveal), so this alone can key the reveal-walk sync.
    revealSyncKey: isRevealQuestionStatus(progress.status)
      ? progress.revealIndex
      : null,
    blockQuestions: view.blockQuestions,
    onScreenQuestionId: isBlockScreen ? phoneScreen.onScreenQuestionId : null,
    isBlockScreen,
  };
}

function revealQuestionOf(
  view: PlayersView | null,
  selectedQuestion: { id: number } | null,
) {
  // The phone's mode says it too: under the post-break leaderboard the status is a round intro, yet the graded block is revealed.
  const { phoneScreen } = view ?? {};
  const isRevealed =
    view &&
    (isRevealQuestionStatus(view.progress.status) ||
      (phoneScreen?.kind === 'block' && phoneScreen.mode === 'revealing'));
  return view && isRevealed && selectedQuestion
    ? view.revealQuestions.find(
        (question) => question.id === selectedQuestion.id,
      )
    : undefined;
}

function browserNavigation(
  previousQuestion: { id: number } | null,
  nextQuestion: { id: number } | null,
  selectQuestion: (id: number) => void,
) {
  return {
    canGoBack: previousQuestion !== null,
    canGoForward: nextQuestion !== null,
    onBack: () => {
      if (previousQuestion) {
        selectQuestion(previousQuestion.id);
      }
    },
    onForward: () => {
      if (nextQuestion) {
        selectQuestion(nextQuestion.id);
      }
    },
  };
}
