import type { ScreenViewProps } from '@/app/components/display-screen-view';
import { BreakBonusList } from '@/app/display/break-bonus-list';
import { FunFactRotator } from '@/app/display/fun-fact-rotator';

/** "Back at 9:45 PM" — local time, no seconds. */
function formatBreakEndTime(breakEndsAt: number): string {
  return new Date(breakEndsAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Shown for the whole grading break — same round_intro-style treatment, but for "BREAK" instead of a round's name. Grading itself happens off-screen in the admin panel. */
export function BreakIntroScreen({
  screen,
  settings,
  quizStructure,
}: ScreenViewProps<'break_intro'>) {
  const {
    roundNumber,
    breakNumber,
    breakEndsAt,
    isFeedbackPromptShown,
    funFacts,
  } = screen;
  const { enabledBonusCategories } = settings;
  // No bonus list on the quiz's last break: bonuses have already closed.
  // Same rule BreakBonusList applies: "custom" has no explanation, so it alone draws nothing.
  const hasBonusList =
    !screen.isFinalBreak &&
    enabledBonusCategories.some((category) => category !== 'custom');
  const bonusList = hasBonusList ? (
    <BreakBonusList
      enabledCategories={enabledBonusCategories}
      quizStructure={quizStructure}
    />
  ) : null;
  // The bonus list holds its own column from the first frame, so a fun fact
  // arriving 30 seconds in (or a long one) grows the main column instead of
  // pushing the bonuses off screen.
  return (
    <div className="flex min-h-0 flex-1 items-center gap-16 px-16 py-10">
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-display-sm font-extrabold tracking-wide text-foreground/55">
          ROUND {roundNumber}
        </p>
        <h1 className="text-balance font-display text-display-6xl text-magenta">
          BREAK {breakNumber}
        </h1>
        {breakEndsAt != null && (
          <p className="font-display text-display-2xl">
            Back at {formatBreakEndTime(breakEndsAt)}
          </p>
        )}
        <FunFactRotator funFacts={funFacts} />
        {isFeedbackPromptShown && (
          <p className="font-display text-display-2xl text-magenta">
            Rate the rounds on your phone ★
          </p>
        )}
      </div>
      {bonusList && (
        <aside className="flex max-h-full w-[calc(34rem*var(--display-text-scale,1))] max-w-[40%] shrink-0 flex-col justify-center self-stretch">
          {bonusList}
        </aside>
      )}
    </div>
  );
}
