import type { OpenedQuestionEntry } from '@/app/play/opened-questions';

export type VerdictCardTone = 'correct' | 'partial' | 'incorrect' | 'none';

export interface VerdictCardContent {
  text: string;
  tone: VerdictCardTone;
  /** Only a correct answer buzzes the phone. */
  shouldVibrate: boolean;
}

/** The text colour each tone is drawn in, shared by the verdict card and the block browser's "Your answer". */
export const VERDICT_TONE_TEXT_CLASS: Record<VerdictCardTone, string> = {
  correct: 'text-green',
  partial: 'text-cyan',
  incorrect: 'text-magenta',
  none: 'text-foreground/65',
};

type VerdictCardSource = Pick<
  OpenedQuestionEntry,
  'myAnswer' | 'pointsAwarded' | 'verdict'
>;

/** What the verdict card says about one revealed question: "✓ Correct +2", "Close! +3" (a partial verdict, with its actual points), "✗ +0", or a neutral "No answer". */
export function describeVerdictCard({
  myAnswer,
  pointsAwarded,
  verdict,
}: VerdictCardSource): VerdictCardContent {
  if (myAnswer === null) {
    return { text: 'No answer', tone: 'none', shouldVibrate: false };
  }
  const points = `+${pointsAwarded ?? 0}`;
  if (verdict === 'correct') {
    return {
      text: `✓ Correct ${points}`,
      tone: 'correct',
      shouldVibrate: true,
    };
  }
  if (verdict === 'partial') {
    return { text: `Close! ${points}`, tone: 'partial', shouldVibrate: false };
  }
  return { text: `✗ ${points}`, tone: 'incorrect', shouldVibrate: false };
}
