'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Cross2Icon, ListBulletIcon, StarIcon } from '@radix-ui/react-icons';
import type {
  BonusCategory,
  QuizStructureSummary,
  TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { AnsweredQuestionsList } from '@/app/play/answered-questions-list';
import { BonusProgressList } from '@/app/play/bonus-progress-list';
import type { OpenedQuestionEntry } from '@/app/play/opened-questions';

interface BonusBarProps {
  enabledCategories: BonusCategory[];
  maxAwardsPerCategory: Partial<Record<BonusCategory, number>>;
  myBonusAwards: TeamBonusAwardView[];
  quizStructure: QuizStructureSummary;
  showAvailability: boolean;
}

interface MobileQuizActionsBarProps {
  historyEntries: OpenedQuestionEntry[];
  jumpableHistoryIds: Set<number>;
  onSelectHistoryQuestion: (questionId: number) => void;
  /** Null when the quiz has no bonus categories enabled — omits that trigger entirely. */
  bonus: BonusBarProps | null;
  /** The team's joker round, or null while it has none — omits the chip entirely. */
  joker: JokerChipProps | null;
}

/** The team's joker round as the chip names it: the round's number and title. */
export interface JokerChipProps {
  roundNumber: number;
  roundTitle: string;
}

interface MobileDrawerTriggerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  icon: ReactNode;
  label: string;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

function MobileDrawerTrigger({
  isOpen,
  onOpenChange,
  icon,
  label,
  title,
  closeLabel,
  children,
}: MobileDrawerTriggerProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline-muted"
          className="flex min-h-11 flex-1 items-center justify-center gap-1 text-sm"
        >
          {icon}
          {label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-background p-5">
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-display text-lg text-magenta">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="icon"
                size="icon-lg"
                aria-label={closeLabel}
              >
                <Cross2Icon aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Mobile-only bottom bar holding the answer-history, joker and bonus-points
 * drawer triggers side by side (history on the left, bonus on the right, the
 * joker chip between them when the team has one), so each stays one tap away
 * without scrolling. Desktop renders each as its
 * own sticky sidebar instead (see AnsweredQuestionsPanel/BonusProgressPanel).
 */
export function MobileQuizActionsBar({
  historyEntries,
  jumpableHistoryIds,
  onSelectHistoryQuestion,
  bonus,
  joker,
}: MobileQuizActionsBarProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBonusOpen, setIsBonusOpen] = useState(false);
  const [isJokerOpen, setIsJokerOpen] = useState(false);
  const hasHistory = historyEntries.length > 0;

  if (!hasHistory && !bonus && !joker) {
    return null;
  }

  function handleHistorySelectQuestion(questionId: number): void {
    onSelectHistoryQuestion(questionId);
    setIsHistoryOpen(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t-2 border-foreground/10 bg-background px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      {hasHistory && (
        <MobileDrawerTrigger
          isOpen={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          icon={<ListBulletIcon aria-hidden="true" />}
          label={`Answer history (${historyEntries.length})`}
          title="Answer history"
          closeLabel="Close answer history"
        >
          <AnsweredQuestionsList
            entries={historyEntries}
            jumpableIds={jumpableHistoryIds}
            onSelectQuestion={handleHistorySelectQuestion}
          />
        </MobileDrawerTrigger>
      )}
      {joker && (
        <MobileDrawerTrigger
          isOpen={isJokerOpen}
          onOpenChange={setIsJokerOpen}
          icon={null}
          label={`🃏 R${joker.roundNumber}`}
          title="Your joker"
          closeLabel="Close joker"
        >
          <p className="text-lg font-bold">
            {`Round ${joker.roundNumber} — ${joker.roundTitle} scores double`}
          </p>
        </MobileDrawerTrigger>
      )}
      {bonus && (
        <MobileDrawerTrigger
          isOpen={isBonusOpen}
          onOpenChange={setIsBonusOpen}
          icon={<StarIcon aria-hidden="true" />}
          label={`Bonus points (${bonus.myBonusAwards.length})`}
          title="Bonus points"
          closeLabel="Close bonus points"
        >
          <BonusProgressList
            enabledCategories={bonus.enabledCategories}
            maxAwardsPerCategory={bonus.maxAwardsPerCategory}
            myBonusAwards={bonus.myBonusAwards}
            quizStructure={bonus.quizStructure}
            showAvailability={bonus.showAvailability}
          />
        </MobileDrawerTrigger>
      )}
    </div>
  );
}
