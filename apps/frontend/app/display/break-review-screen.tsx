import type { ScreenViewProps } from '@/app/components/display-screen-view';
import { QuestionDisplay } from '@/app/display/question-display';

/**
 * Shown while the admin grades a just-locked block, stepping through its
 * questions one at a time via Previous/Advance — same layout as
 * question_open, minus the "teams answered" count (the block is already
 * closed to new answers) and minus the correct answer (not revealed yet).
 */
export function BreakReviewScreen({
  screen,
  settings,
  media,
}: ScreenViewProps<'break_review'>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
      <QuestionDisplay
        question={screen.question}
        mediaTestIdPrefix="break"
        autoplayMedia={settings.autoplayMedia}
        {...media}
      />
    </div>
  );
}
