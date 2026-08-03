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
