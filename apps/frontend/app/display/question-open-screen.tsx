import type { QuestionView } from '@campus-pubquiz/types';
import { QuestionDisplay } from '@/app/display/question-display';

interface QuestionOpenScreenProps {
  question: QuestionView;
  answeredCount: number;
  totalTeams: number;
  autoplayMedia?: boolean;
  isFullscreen?: boolean;
}

export function QuestionOpenScreen({
  question,
  answeredCount,
  totalTeams,
  autoplayMedia,
  isFullscreen,
}: QuestionOpenScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
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
      />
      {totalTeams > 0 && (
        <p className="text-[calc(1rem*var(--display-text-scale,1))] font-extrabold tracking-wide text-foreground/55">
          {answeredCount} OF {totalTeams} TEAMS ANSWERED
        </p>
      )}
    </div>
  );
}
