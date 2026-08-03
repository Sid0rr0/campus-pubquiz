import type { BlockQuestionView, QuestionPosition } from '@campus-pubquiz/types';

export interface PickerSlot {
  key: string;
  questionNumberInRound: number;
  /** Null for a not-yet-open slot — rendered as a disabled placeholder. */
  question: BlockQuestionView | null;
}

export interface PickerRound {
  roundNumber: number;
  slots: PickerSlot[];
}

/** Groups the block's questions (plus the round's remaining upcoming slots, if any) by round, numbering each round's slots from 1 — so the whole round's shape is visible up front. */
export function buildPickerRounds(
  blockQuestions: BlockQuestionView[],
  upcomingQuestions: QuestionPosition[],
): PickerRound[] {
  const flatSlots: Array<PickerSlot & { roundNumber: number }> = blockQuestions.map((question) => ({
    key: `q-${question.id}`,
    roundNumber: question.roundNumber,
    questionNumberInRound: question.questionNumberInRound,
    question,
  }));
  for (const upcomingQuestion of upcomingQuestions) {
    flatSlots.push({
      key: `upcoming-${upcomingQuestion.roundNumber}-${upcomingQuestion.questionNumberInRound}`,
      roundNumber: upcomingQuestion.roundNumber,
      questionNumberInRound: upcomingQuestion.questionNumberInRound,
      question: null,
    });
  }

  const rounds: PickerRound[] = [];
  for (const slot of flatSlots) {
    const lastRound = rounds[rounds.length - 1];
    if (lastRound && lastRound.roundNumber === slot.roundNumber) {
      lastRound.slots.push(slot);
    } else {
      rounds.push({ roundNumber: slot.roundNumber, slots: [slot] });
    }
  }
  return rounds;
}

interface QuestionPickerProps {
  pickerRounds: PickerRound[];
  selectedQuestionId: BlockQuestionView['id'];
  myAnswers: Record<number, string>;
  onSelect: (questionId: BlockQuestionView['id']) => void;
}

export function QuestionPicker({ pickerRounds, selectedQuestionId, myAnswers, onSelect }: QuestionPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {pickerRounds.map((round) => (
        <div key={round.roundNumber} className="flex flex-wrap items-center gap-2">
          {pickerRounds.length > 1 && (
            <span className="text-xs font-extrabold tracking-wide text-foreground/45">R{round.roundNumber}</span>
          )}
          <nav aria-label={`Round ${round.roundNumber} questions`} className="flex flex-wrap gap-2">
            {round.slots.map((slot) => {
              if (!slot.question) {
                return (
                  <button
                    key={slot.key}
                    type="button"
                    disabled
                    aria-label={`Question ${slot.questionNumberInRound} (not open yet)`}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-dashed border-foreground/20 bg-white/40 font-extrabold text-foreground/30"
                  >
                    {slot.questionNumberInRound}
                  </button>
                );
              }
              const question = slot.question;
              const isAnswered = question.id in myAnswers;
              const isSelected = question.id === selectedQuestionId;
              return (
                <button
                  key={slot.key}
                  type="button"
                  aria-label={`Question ${slot.questionNumberInRound}${isAnswered ? ' (answered)' : ''}`}
                  onClick={() => onSelect(question.id)}
                  className={
                    isSelected
                      ? 'flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-magenta bg-white font-extrabold text-magenta'
                      : 'flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-foreground/30 bg-white font-extrabold'
                  }
                >
                  {slot.questionNumberInRound}
                  {isAnswered && <span aria-hidden="true" className="ml-1 text-green">✓</span>}
                </button>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}
