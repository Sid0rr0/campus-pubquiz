import type { ClosestGuessRevealData } from '@campus-pubquiz/types';
import { AnswerMedia } from '@/app/display/question-display';

interface ClosestGuessRevealScreenProps {
  prompt: string;
  /** 0-4, ignored when !closestGuess.hasSubmissions (always shows the question + correct answer together). */
  step: number;
  correctAnswer: string;
  answerMediaUrl?: string;
  closestGuess: ClosestGuessRevealData;
  mediaTestIdPrefix: string;
  autoplayMedia?: boolean;
}

// Shared by /display and /play so both surfaces build up the same reveal in
// lockstep, driven by the admin's ADVANCE/PREVIOUS presses. Cumulative, not
// exclusive: step 1 adds the smallest guess and it stays on screen as step 2
// adds the highest guess, then step 3 adds the correct answer, then step 4
// adds the closest team(s) — nothing already shown is ever replaced.
export function ClosestGuessRevealScreen({
  prompt,
  step,
  correctAnswer,
  answerMediaUrl,
  closestGuess,
  mediaTestIdPrefix,
  autoplayMedia,
}: ClosestGuessRevealScreenProps) {
  const { hasSubmissions } = closestGuess;
  const showSmallest = hasSubmissions && step >= 1;
  const showHighest = hasSubmissions && step >= 2;
  // Nobody submitted a guess — show the question + correct answer together
  // immediately (mirrors every other type's single-shot reveal, see
  // GameStateService.getRevealStepCount) rather than waiting on a step that
  // will never arrive.
  const showCorrect = !hasSubmissions || step >= 3;
  const showClosest = hasSubmissions && step >= 4;

  return (
    <>
      <h1 className="text-balance font-display text-4xl leading-snug">
        {prompt}
      </h1>
      {showSmallest && (
        <p className="font-display text-lg text-cyan">
          <span className="font-body text-sm font-extrabold text-foreground/55">
            SMALLEST GUESS{' '}
          </span>
          {closestGuess.minGuess}
        </p>
      )}
      {showHighest && (
        <p className="font-display text-lg text-cyan">
          <span className="font-body text-sm font-extrabold text-foreground/55">
            HIGHEST GUESS{' '}
          </span>
          {closestGuess.maxGuess}
        </p>
      )}
      {showCorrect && (
        <>
          <p className="font-display text-lg text-green">
            <span className="font-body text-sm font-extrabold text-foreground/55">
              ANSWER{' '}
            </span>
            {correctAnswer}
          </p>
          <AnswerMedia
            url={answerMediaUrl}
            mediaTestIdPrefix={mediaTestIdPrefix}
            autoplayMedia={autoplayMedia}
          />
        </>
      )}
      {showClosest && (
        <ul className="flex w-full max-w-xl flex-col gap-3 text-left">
          {closestGuess.closestGuesses.map((guess, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-3 rounded-xl border-2 border-green bg-white px-5 py-3 text-xl font-bold text-foreground"
            >
              <span>{guess.teamName}</span>
              <span aria-hidden="true" className="text-green">
                ✓
              </span>
              <span>{guess.value}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
