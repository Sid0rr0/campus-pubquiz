'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Cross2Icon, StarIcon } from '@radix-ui/react-icons';
import type { BonusCategory, TeamBonusAwardView } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { BonusProgressList } from '@/app/play/bonus-progress-list';

interface BonusProgressPanelProps {
  enabledCategories: BonusCategory[];
  maxAwardsPerCategory: Partial<Record<BonusCategory, number>>;
  myBonusAwards: TeamBonusAwardView[];
}

/**
 * Shows the bonus categories a team can be awarded (with what earns them and
 * how many times they've already been awarded), plus any custom bonus points
 * received. Mirrors AnsweredQuestionsPanel: a sticky sidebar on wider
 * screens, tucked behind a bottom-sheet drawer on mobile.
 */
export function BonusProgressPanel({
  enabledCategories,
  maxAwardsPerCategory,
  myBonusAwards,
}: BonusProgressPanelProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <section className="md:sticky md:top-5 md:w-80 md:shrink-0 md:self-start">
      <div className="hidden md:flex md:max-h-[calc(100vh-2.5rem)] md:flex-col md:gap-2">
        <h2 className="font-display text-lg text-magenta">Bonus points</h2>
        <div className="overflow-y-auto pr-1">
          <BonusProgressList
            enabledCategories={enabledCategories}
            maxAwardsPerCategory={maxAwardsPerCategory}
            myBonusAwards={myBonusAwards}
          />
        </div>
      </div>
      {/* Fixed to the viewport bottom on mobile (rather than sitting inline
          after Answer history) so it stays reachable without scrolling all
          the way down — the answer form and history drawer are the primary
          flow; bonus status is secondary but should still be one tap away. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-foreground/10 bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <Dialog.Root open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <Dialog.Trigger asChild>
            <Button
              type="button"
              variant="outline-muted"
              className="flex min-h-11 w-full items-center justify-center gap-2 text-sm"
            >
              <StarIcon aria-hidden="true" />
              Bonus points ({myBonusAwards.length})
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-background p-5">
              <div className="flex items-center justify-between">
                <Dialog.Title className="font-display text-lg text-magenta">
                  Bonus points
                </Dialog.Title>
                <Dialog.Close asChild>
                  <Button
                    type="button"
                    variant="icon"
                    size="icon-lg"
                    aria-label="Close bonus points"
                  >
                    <Cross2Icon aria-hidden="true" />
                  </Button>
                </Dialog.Close>
              </div>
              <BonusProgressList
                enabledCategories={enabledCategories}
                maxAwardsPerCategory={maxAwardsPerCategory}
                myBonusAwards={myBonusAwards}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </section>
  );
}
