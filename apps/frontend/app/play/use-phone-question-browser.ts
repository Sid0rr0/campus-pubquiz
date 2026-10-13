import { useEffect, useState } from 'react';
import type { StateViewByRoom } from '@campus-pubquiz/types';
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
  // Starts true (always-follow) and is corrected once localStorage is
  // readable post-mount, the same SSR-safe pattern as use-team-link.ts.
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoAdvanceEnabled(readAutoAdvanceSetting());
  }, []);
  // null = follow the question currently shown on the big screen.
  const [browsedQuestionId, setBrowsedQuestionId] = useState<number | null>(
    null,
  );
  const currentQuestion = view?.currentQuestion ?? null;
  const currentQuestionId = currentQuestion?.id ?? null;
  // Only changes while actively revealing (currentQuestionId stays null
  // throughout break/reveal), so this alone can key the reveal-walk sync.
  const revealSyncKey =
    view?.progress.status === 'reveal' ? view.progress.revealIndex : null;
  // What selectPhoneQuestion compares against to spot a new question or
  // reveal step; synced during render after the call below.
  const [prevQuestionId, setPrevQuestionId] = useState(currentQuestionId);
  const [prevRevealSyncKey, setPrevRevealSyncKey] = useState(revealSyncKey);

  const phoneScreen = view?.phoneScreen;
  const blockQuestions = view?.blockQuestions ?? NO_QUESTIONS;
  const {
    selectedQuestion: browsedQuestion,
    previousQuestion,
    nextQuestion,
    browsedQuestionId: nextBrowsedQuestionId,
  } = selectPhoneQuestion({
    openedQuestions: blockQuestions,
    currentQuestion,
    onScreenQuestionId:
      phoneScreen?.kind === 'block' ? phoneScreen.onScreenQuestionId : null,
    browsedQuestionId,
    autoAdvanceEnabled,
    revealSyncKey,
    previousCurrentQuestionId: prevQuestionId,
    previousRevealSyncKey: prevRevealSyncKey,
  });
  // Adjusted during render rather than in an Effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (nextBrowsedQuestionId !== browsedQuestionId) {
    setBrowsedQuestionId(nextBrowsedQuestionId);
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
    setBrowsedQuestionId(
      browsedQuestionAfterAutoAdvanceChange(enabled, browsedQuestionId),
    );
  }

  const selectedQuestion =
    phoneScreen?.kind === 'block' ? browsedQuestion : null;
  const revealQuestion =
    view?.progress.status === 'reveal' && selectedQuestion
      ? view.revealQuestions.find(
          (question) => question.id === selectedQuestion.id,
        )
      : undefined;
  const jumpableQuestionIds = selectedQuestion
    ? new Set(blockQuestions.map((question) => question.id))
    : new Set<number>();

  return {
    selectedQuestion,
    revealQuestion,
    navigation: autoAdvanceEnabled
      ? undefined
      : {
          canGoBack: previousQuestion !== null,
          canGoForward: nextQuestion !== null,
          onBack: () => {
            if (previousQuestion) {
              setBrowsedQuestionId(previousQuestion.id);
            }
          },
          onForward: () => {
            if (nextQuestion) {
              setBrowsedQuestionId(nextQuestion.id);
            }
          },
        },
    jumpableQuestionIds,
    selectQuestion: setBrowsedQuestionId,
    autoAdvanceEnabled,
    setAutoAdvance,
  };
}
