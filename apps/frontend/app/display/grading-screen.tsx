import type { BlockQuestionView } from '@campus-pubquiz/types';
import { QuestionDisplay } from '@/app/display/question-display';
import { TriviaHeader } from '@/app/display/trivia-header';

interface GradingScreenProps {
  /** The block question at the current reveal index — undefined before the first question is loaded. */
  blockQuestion: BlockQuestionView | undefined;
}

export function GradingScreen({ blockQuestion }: GradingScreenProps) {
  if (!blockQuestion) {
    return (
      <div className="flex flex-1 items-center justify-center px-16 text-center">
        <h1 className="font-display text-4xl">Grading in progress…</h1>
      </div>
    );
  }

  return (
    <>
      <TriviaHeader
        label="GRADING"
        badge={`ROUND ${blockQuestion.roundNumber} · QUESTION ${blockQuestion.questionNumberInRound}`}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
        <QuestionDisplay
          prompt={blockQuestion.prompt}
          mediaUrl={blockQuestion.mediaUrl}
          options={blockQuestion.options}
          mediaTestIdPrefix="grading"
        />
        <p className="font-extrabold tracking-wide text-foreground/55">Grading in progress…</p>
      </div>
    </>
  );
}
