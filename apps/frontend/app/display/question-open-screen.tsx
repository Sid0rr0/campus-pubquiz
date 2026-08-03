import type { QuestionView } from '@campus-pubquiz/types';
import { QuestionDisplay } from '@/app/display/question-display';
import { TriviaHeader } from '@/app/display/trivia-header';

interface QuestionOpenScreenProps {
  roundNumber: number;
  questionNumber: number;
  question: QuestionView;
  answeredCount: number;
  totalTeams: number;
}

export function QuestionOpenScreen({
  roundNumber,
  questionNumber,
  question,
  answeredCount,
  totalTeams,
}: QuestionOpenScreenProps) {
  return (
    <>
      <TriviaHeader label={`ROUND ${roundNumber}`} badge={`QUESTION ${questionNumber}`} />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
        <QuestionDisplay
          prompt={question.prompt}
          mediaUrl={question.mediaUrl}
          options={question.options}
          mediaTestIdPrefix="question"
        />
        {totalTeams > 0 && (
          <p className="font-extrabold tracking-wide text-foreground/55">
            {answeredCount} OF {totalTeams} TEAMS ANSWERED
          </p>
        )}
      </div>
    </>
  );
}
