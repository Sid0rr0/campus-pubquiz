import { CheckIcon } from '@radix-ui/react-icons';
import type { BlockQuestionView } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import type { PickerRound } from '@/app/play/question-picker-slots';

interface QuestionPickerProps {
  pickerRounds: PickerRound[];
  /** The numbers of the rounds doubled for the team: their heading says so, even as the only round in the block. */
  doubledRoundNumbers: readonly number[];
  selectedQuestionId: BlockQuestionView['id'];
  myAnswers: Record<number, string>;
  onSelect: (questionId: BlockQuestionView['id']) => void;
}

export function QuestionPicker({
  pickerRounds,
  doubledRoundNumbers,
  selectedQuestionId,
  myAnswers,
  onSelect,
}: QuestionPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {pickerRounds.map((round) => (
        <div key={round.roundNumber} className="flex flex-col flex-wrap gap-2">
          {doubledRoundNumbers.includes(round.roundNumber) ? (
            <p className="w-fit rounded-full bg-yellow/25 px-2.5 py-0.5 text-xs font-extrabold tracking-wide">
              <span aria-hidden="true">🃏 </span>
              {round.roundTitle} · 2×
            </p>
          ) : (
            pickerRounds.length > 1 && (
              <p className="text-xs font-extrabold tracking-wide text-foreground/45">
                {round.roundTitle}
              </p>
            )
          )}
          <nav
            aria-label={`Round ${round.roundNumber} questions`}
            className="flex flex-wrap gap-2"
          >
            {round.slots.map((slot) => {
              if (!slot.question) {
                return (
                  <Button
                    key={slot.key}
                    type="button"
                    disabled
                    aria-label={`Question ${slot.questionNumberInRound} (not open yet)`}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-dashed border-foreground/20 bg-white/40 font-extrabold text-foreground/30"
                  >
                    {slot.questionNumberInRound}
                  </Button>
                );
              }
              const question = slot.question;
              const isAnswered = question.id in myAnswers;
              const isSelected = question.id === selectedQuestionId;
              return (
                <Button
                  key={slot.key}
                  type="button"
                  aria-label={`Question ${slot.questionNumberInRound}${isAnswered ? ' (answered)' : ''}`}
                  onClick={() => onSelect(question.id)}
                  className={
                    isSelected
                      ? 'flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-dark-blue bg-white font-extrabold text-dark-blue'
                      : 'flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-foreground/30 bg-white font-extrabold'
                  }
                >
                  {slot.questionNumberInRound}
                  {isAnswered && (
                    <CheckIcon aria-hidden="true" className="ml-1" />
                  )}
                </Button>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}
