import type { BlockQuestionView } from '@campus-pubquiz/types';
import { QuestionDisplay } from '@/app/display/question-display';
import { TriviaHeader } from '@/app/display/trivia-header';

interface BreakScreenProps {
  /** The block question at the current reveal index — undefined before the first question is loaded. */
  blockQuestion: BlockQuestionView | undefined;
}

export function BreakScreen({ blockQuestion }: BreakScreenProps) {
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
        label={`ROUND ${blockQuestion.roundNumber}`}
        badge={`BREAK · QUESTION ${blockQuestion.questionNumberInRound}`}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
        <QuestionDisplay
          prompt={blockQuestion.prompt}
          mediaUrl={blockQuestion.mediaUrl}
          options={blockQuestion.options}
          mediaTestIdPrefix="break"
        />
        <p className="font-extrabold tracking-wide text-foreground/55">Grading in progress…</p>
      </div>
    </>
  );
}
