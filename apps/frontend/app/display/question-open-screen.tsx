import type { QuestionView } from '@campus-pubquiz/types';
import { QuestionDisplay } from '@/app/display/question-display';

interface QuestionOpenScreenProps {
  question: QuestionView;
  answeredCount: number;
  totalTeams: number;
  autoplayMedia?: boolean;
}

export function QuestionOpenScreen({
  question,
  answeredCount,
  totalTeams,
  autoplayMedia,
}: QuestionOpenScreenProps) {
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
        mediaTestIdPrefix="question"
        autoplayMedia={autoplayMedia}
      />
      {totalTeams > 0 && (
        <p className="font-extrabold tracking-wide text-foreground/55">
          {answeredCount} OF {totalTeams} TEAMS ANSWERED
        </p>
      )}
    </div>
  );
}
