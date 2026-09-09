import type {
  BlockQuestionView,
  UpcomingQuestionPosition,
} from '@campus-pubquiz/types';

export interface PickerSlot {
  key: string;
  questionNumberInRound: number;
  /** Null for a not-yet-open slot — rendered as a disabled placeholder. */
  question: BlockQuestionView | null;
}

export interface PickerRound {
  roundNumber: number;
  roundTitle: string;
  slots: PickerSlot[];
}

/** Groups the block's questions (plus every remaining round's upcoming slots up to the break, if any) by round, numbering each round's slots from 1 — so the whole block's shape is visible up front. */
export function buildPickerRounds(
  blockQuestions: BlockQuestionView[],
  upcomingQuestions: UpcomingQuestionPosition[],
): PickerRound[] {
  const flatSlots: Array<
    PickerSlot & { roundNumber: number; roundTitle: string }
  > = blockQuestions.map((question) => ({
    key: `q-${question.id}`,
    roundNumber: question.roundNumber,
    roundTitle: question.roundTitle,
    questionNumberInRound: question.questionNumberInRound,
    question,
  }));
  for (const upcomingQuestion of upcomingQuestions) {
    flatSlots.push({
      key: `upcoming-${upcomingQuestion.roundNumber}-${upcomingQuestion.questionNumberInRound}`,
      roundNumber: upcomingQuestion.roundNumber,
      roundTitle: upcomingQuestion.roundTitle,
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
      rounds.push({
        roundNumber: slot.roundNumber,
        roundTitle: slot.roundTitle,
        slots: [slot],
      });
    }
  }
  return rounds;
}
