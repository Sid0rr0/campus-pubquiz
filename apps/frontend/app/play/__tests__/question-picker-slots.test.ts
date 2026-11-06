import { describe, expect, it } from 'vitest';
import type { BlockQuestionView } from '@campus-pubquiz/types';
import { buildPickerRounds } from '@/app/play/question-picker-slots';

const opened = {
  id: 7,
  roundNumber: 1,
  roundTitle: 'One',
  questionNumberInRound: 1,
} as BlockQuestionView;

describe('buildPickerRounds', () => {
  it('keys each slot by what it is, so an opened and an upcoming slot never collide', () => {
    const [first, second] = buildPickerRounds(
      [opened],
      [
        { roundNumber: 1, roundTitle: 'One', questionNumberInRound: 2 },
        { roundNumber: 2, roundTitle: 'Two', questionNumberInRound: 1 },
      ],
    );

    expect(first.slots.map((slot) => slot.key)).toEqual([
      'q-7',
      'upcoming-1-2',
    ]);
    expect(second.slots.map((slot) => slot.key)).toEqual(['upcoming-2-1']);
  });
});
