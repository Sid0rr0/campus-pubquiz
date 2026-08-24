import type {
  BonusCategory,
  QuizStructureSummary,
} from '@campus-pubquiz/types';
import { BreakBonusList } from '@/app/display/break-bonus-list';

interface BreakIntroScreenProps {
  roundNumber: number;
  /** 1-based ordinal of this break (1 for the quiz's first, 2 for its second, …) — shown as "BREAK N". */
  breakNumber: number;
  /** This session's enabled bonus categories — passed through to BreakBonusList to show what teams can still go earn while grading happens off-screen. */
  enabledBonusCategories?: BonusCategory[];
  /** Epoch-ms time the admin expects the break to end, or null/undefined when unset — shown as "Back at HH:MM" underneath BREAK. */
  breakEndsAt?: number | null;
  /** Passed through to BreakBonusList's "can be earned until the end of break X" caption. */
  quizStructure: QuizStructureSummary;
  /** False on the quiz's last break — bonuses have already closed by then, so there's nothing left to show as available. */
  showBonusList: boolean;
}

/** "Back at 9:45 PM" — local time, no seconds. */
function formatBreakEndTime(breakEndsAt: number): string {
  return new Date(breakEndsAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Shown for the whole grading break — same round_intro-style treatment, but for "BREAK" instead of a round's name. Grading itself happens off-screen in the admin panel. */
export function BreakIntroScreen({
  roundNumber,
  breakNumber,
  enabledBonusCategories = [],
  breakEndsAt,
  quizStructure,
  showBonusList,
}: BreakIntroScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 py-10 text-center">
      <p className="text-sm font-extrabold tracking-wide text-foreground/55">
        ROUND {roundNumber}
      </p>
      <h1 className="text-balance font-display text-6xl text-magenta">
        BREAK {breakNumber}
      </h1>
      {breakEndsAt != null && (
        <p className="font-display text-2xl">
          Back at {formatBreakEndTime(breakEndsAt)}
        </p>
      )}
      {showBonusList && (
        <BreakBonusList
          enabledCategories={enabledBonusCategories}
          quizStructure={quizStructure}
        />
      )}
    </div>
  );
}
