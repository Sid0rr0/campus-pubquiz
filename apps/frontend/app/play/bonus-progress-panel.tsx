import type {
  BonusCategory,
  QuizStructureSummary,
  TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { BonusProgressList } from '@/app/play/bonus-progress-list';

interface BonusProgressPanelProps {
  enabledCategories: BonusCategory[];
  maxAwardsPerCategory: Partial<Record<BonusCategory, number>>;
  myBonusAwards: TeamBonusAwardView[];
  /** Drives the "can be earned until the end of break X" caption's break number. */
  quizStructure: QuizStructureSummary;
  /** False while showing the quiz's last break — bonuses have already closed by then, so there's nothing left to show as available. */
  showAvailability: boolean;
}

/**
 * Shows the bonus categories a team can be awarded (with what earns them and
 * how many times they've already been awarded), plus any custom bonus points
 * received. Sits as a sticky sidebar next to AnsweredQuestionsPanel on wider
 * screens. On mobile this is reached through MobileQuizActionsBar's drawer
 * trigger instead, to save space on the phone-sized /play layout.
 */
export function BonusProgressPanel({
  enabledCategories,
  maxAwardsPerCategory,
  myBonusAwards,
  quizStructure,
  showAvailability,
}: BonusProgressPanelProps) {
  return (
    <section className="hidden md:sticky md:top-5 md:flex md:max-h-[calc(100vh-2.5rem)] md:w-80 md:shrink-0 md:flex-col md:gap-2 md:self-start">
      <h2 className="font-display text-lg text-magenta">Bonus points</h2>
      <div className="overflow-y-auto pr-1">
        <BonusProgressList
          enabledCategories={enabledCategories}
          maxAwardsPerCategory={maxAwardsPerCategory}
          myBonusAwards={myBonusAwards}
          quizStructure={quizStructure}
          showAvailability={showAvailability}
        />
      </div>
    </section>
  );
}
