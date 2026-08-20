import type { BlockQuestionView } from '@campus-pubquiz/types';
import { QuestionDisplay } from '@/app/display/question-display';

interface BreakReviewScreenProps {
  question: BlockQuestionView;
  autoplayMedia?: boolean;
}

/**
 * Shown while the admin grades a just-locked block, stepping through its
 * questions one at a time via Previous/Advance — same layout as
 * question_open, minus the "teams answered" count (the block is already
 * closed to new answers) and minus the correct answer (not revealed yet).
 */
export function BreakReviewScreen({
  question,
  autoplayMedia,
}: BreakReviewScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
      <QuestionDisplay
        type={question.type}
        prompt={question.prompt}
        mediaUrl={question.mediaUrl}
        mediaStartSeconds={question.mediaStartSeconds}
        mediaEndSeconds={question.mediaEndSeconds}
        options={question.options}
        matchTargets={question.matchTargets}
        mediaTestIdPrefix="break"
        autoplayMedia={autoplayMedia}
      />
    </div>
  );
}
