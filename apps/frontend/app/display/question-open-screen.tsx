import type { QuestionView } from '@campus-pubquiz/types';
import { QuestionDisplay } from '@/app/display/question-display';
import { QuestionLockCountdown } from '@/app/display/question-lock-countdown';

interface QuestionOpenScreenProps {
  question: QuestionView;
  answeredCount: number;
  totalTeams: number;
  autoplayMedia?: boolean;
  isFullscreen?: boolean;
  mediaReplayToken?: number;
  /** Epoch-ms deadline when a kahootMode question auto-locks, or null/undefined when no timer is armed. */
  kahootQuestionEndsAt?: number | null;
}

export function QuestionOpenScreen({
  question,
  answeredCount,
  totalTeams,
  autoplayMedia,
  isFullscreen,
  mediaReplayToken,
  kahootQuestionEndsAt,
}: QuestionOpenScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-16 py-8 text-center">
      {kahootQuestionEndsAt != null && (
        <QuestionLockCountdown
          key={`kahoot-ring-${kahootQuestionEndsAt}`}
          lockAt={kahootQuestionEndsAt}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8">
        <QuestionDisplay
          type={question.type}
          prompt={question.prompt}
          mediaUrl={question.mediaUrl}
          mediaStartSeconds={question.mediaStartSeconds}
          mediaEndSeconds={question.mediaEndSeconds}
          options={question.options}
          matchTargets={question.matchTargets}
          mediaTestIdPrefix="question"
          autoplayMedia={autoplayMedia}
          isFullscreen={isFullscreen}
          mediaReplayToken={mediaReplayToken}
        />
      </div>
      {totalTeams > 0 && (
        <p className="pt-8 text-[calc(1rem*var(--display-text-scale,1))] font-extrabold tracking-wide text-foreground/55">
          {answeredCount} OF {totalTeams} TEAMS ANSWERED
        </p>
      )}
    </div>
  );
}
