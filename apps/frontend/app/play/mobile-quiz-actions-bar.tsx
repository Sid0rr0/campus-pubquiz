'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import {
  Cross2Icon,
  LightningBoltIcon,
  ListBulletIcon,
  StarIcon,
} from '@radix-ui/react-icons';
import type {
  BonusCategory,
  QuizStructureSummary,
  TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { AnsweredQuestionsList } from '@/app/play/answered-questions-list';
import { BonusProgressList } from '@/app/play/bonus-progress-list';
import {
  PowerUpsList,
  formatCoins,
  type PowerUpsListProps,
} from '@/app/play/power-ups-list';
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
  /** Null when the team has no shop (power-ups off and no coins) — omits that trigger entirely. */
  powerUps: PowerUpsListProps | null;
}

interface MobileDrawerTriggerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  icon: ReactNode;
  label: string;
  /** What sits beside the icon: a count or the coin balance, nothing at zero. */
  badge: ReactNode;
  /** The full name for screen readers and the drawer's title. */
  accessibleName: string;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

function MobileDrawerTrigger({
  isOpen,
  onOpenChange,
  icon,
  label,
  badge,
  accessibleName,
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
          aria-label={accessibleName}
          className="flex min-h-12 min-w-0 flex-1 basis-0 flex-col items-center justify-center py-1 text-xs tracking-wide"
        >
          <span className="flex items-center gap-1 tabular-nums">
            {icon}
            {badge}
          </span>
          {label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay fixed inset-0 z-30 bg-foreground/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="drawer-bottom fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col rounded-t-2xl bg-background"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
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
          <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Mobile-only bottom bar: the answer-history, power-ups and bonus-points drawer
 * triggers in equal thirds (history always, even empty), so each stays one tap
 * away without scrolling. Desktop renders each drawer as its own sticky sidebar instead (see
 * AnsweredQuestionsPanel/BonusProgressPanel).
 */
export function MobileQuizActionsBar({
  historyEntries,
  jumpableHistoryIds,
  onSelectHistoryQuestion,
  bonus,
  powerUps,
}: MobileQuizActionsBarProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBonusOpen, setIsBonusOpen] = useState(false);
  const [isPowerUpsOpen, setIsPowerUpsOpen] = useState(false);

  function handleHistorySelectQuestion(questionId: number): void {
    onSelectHistoryQuestion(questionId);
    setIsHistoryOpen(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-foreground/10 bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="flex gap-2">
        <MobileDrawerTrigger
          isOpen={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          icon={<ListBulletIcon aria-hidden="true" />}
          label="History"
          badge={historyEntries.length || null}
          accessibleName={`Answer history (${historyEntries.length})`}
          title="Answer history"
          closeLabel="Close answer history"
        >
          <AnsweredQuestionsList
            entries={historyEntries}
            jumpableIds={jumpableHistoryIds}
            onSelectQuestion={handleHistorySelectQuestion}
          />
        </MobileDrawerTrigger>
        {powerUps && (
          <MobileDrawerTrigger
            isOpen={isPowerUpsOpen}
            onOpenChange={setIsPowerUpsOpen}
            icon={<LightningBoltIcon aria-hidden="true" />}
            label="Power-ups"
            badge={
              <span className="font-black text-magenta">
                {formatCoins(powerUps.coins)}
              </span>
            }
            accessibleName={`Power-ups (${formatCoins(powerUps.coins)})`}
            title="Power-ups"
            closeLabel="Close power-ups"
          >
            <PowerUpsList
              {...powerUps}
              onActivated={() => setIsPowerUpsOpen(false)}
            />
          </MobileDrawerTrigger>
        )}
        {bonus && (
          <MobileDrawerTrigger
            isOpen={isBonusOpen}
            onOpenChange={setIsBonusOpen}
            icon={<StarIcon aria-hidden="true" />}
            label="Bonus"
            badge={bonus.myBonusAwards.length || null}
            accessibleName={`Bonus points (${bonus.myBonusAwards.length})`}
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
    </div>
  );
}
