import type { BlockRevealQuestionView } from '@campus-pubquiz/types';
import { QuestionDisplay } from '@/app/display/question-display';
import { TriviaHeader } from '@/app/display/trivia-header';

interface RevealScreenProps {
  revealQuestion: BlockRevealQuestionView;
}

export function RevealScreen({ revealQuestion }: RevealScreenProps) {
  return (
    <>
      <TriviaHeader
        label={`ROUND ${revealQuestion.roundNumber}`}
        badge={`REVEALING ANSWERS · QUESTION ${revealQuestion.questionNumberInRound}`}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
        <QuestionDisplay
          prompt={revealQuestion.prompt}
          mediaUrl={revealQuestion.mediaUrl}
          options={revealQuestion.options}
          correctAnswer={revealQuestion.answer}
          answerMediaUrl={revealQuestion.answerMediaUrl}
          mediaTestIdPrefix="reveal"
        />
      </div>
    </>
  );
}
