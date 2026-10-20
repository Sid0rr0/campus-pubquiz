import type { QuestionView } from '@campus-pubquiz/types';
import { QuestionDisplay } from '@/app/display/question-display';
import { QuestionLockCountdown } from '@/app/display/question-lock-countdown';

interface QuestionOpenScreenProps {
  question: QuestionView;
  /** The live answered count; left out, its line keeps its place but draws empty. */
  teamCounts?: { answeredCount: number; totalTeams: number };
  autoplayMedia?: boolean;
  isFullscreen?: boolean;
  mediaReplayToken?: number;
  isMediaPaused?: boolean;
  /** Epoch-ms deadline when a kahootMode question auto-locks, or null/undefined when no timer is armed. */
  kahootQuestionEndsAt?: number | null;
}

export function QuestionOpenScreen({
  question,
  teamCounts,
  autoplayMedia,
  isFullscreen,
  mediaReplayToken,
  isMediaPaused,
  kahootQuestionEndsAt,
}: QuestionOpenScreenProps) {
  const countClassName =
    'pt-8 text-display-2xl font-extrabold tracking-wide text-foreground/55';
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
          question={question}
          mediaTestIdPrefix="question"
          autoplayMedia={autoplayMedia}
          isFullscreen={isFullscreen}
          mediaReplayToken={mediaReplayToken}
          isMediaPaused={isMediaPaused}
        />
      </div>
      {teamCounts === undefined ? (
        <p aria-hidden className={`${countClassName} invisible`}>
          &nbsp;
        </p>
      ) : (
        teamCounts.totalTeams > 0 && (
          <p className={countClassName}>
            {teamCounts.answeredCount} OF {teamCounts.totalTeams} TEAMS ANSWERED
          </p>
        )
      )}
    </div>
  );
}
