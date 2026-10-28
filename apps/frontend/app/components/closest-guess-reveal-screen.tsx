import type {
  ClosestGuessRevealData,
  ClosestGuessRevealView,
  PendingClosestGuessRevealView,
} from '@campus-pubquiz/types';
import { AnswerMedia } from '@/app/display/question-display';
import { EntranceItem, EntranceLine } from '@/app/display/reveal-entrance';

interface ClosestGuessRevealScreenProps {
  prompt: string;
  /** Present once the answer step is on air (the `closest_guess` Reveal kind). */
  correctAnswer?: string;
  answerMediaUrl?: string;
  /** The reveal clip of a YouTube `answerMediaUrl`. */
  revealStartSeconds?: number;
  revealEndSeconds?: number;
  closestGuess: ClosestGuessRevealData;
  mediaTestIdPrefix: string;
  autoplayMedia?: boolean;
  /** The big-screen mute — silences the answer media. Left off on the phone. */
  isDisplaySoundMuted?: boolean;
  /** The big screen's reveal: each step line slides in as it arrives. Left off on the phone. */
  hasEntrance?: boolean;
}

/** The answer props for a closest-guess reveal question: only the `closest_guess` kind carries the answer; `closest_guess_pending` has none yet. */
export function closestGuessAnswerProps(
  question: ClosestGuessRevealView | PendingClosestGuessRevealView,
): Pick<
  ClosestGuessRevealScreenProps,
  'correctAnswer' | 'answerMediaUrl' | 'revealStartSeconds' | 'revealEndSeconds'
> {
  return question.revealKind === 'closest_guess'
    ? {
        correctAnswer: question.answer,
        answerMediaUrl: question.answerMediaUrl,
        revealStartSeconds: question.revealStartSeconds,
        revealEndSeconds: question.revealEndSeconds,
      }
    : {};
}

// Shared by /display and /play. Draws exactly the lines it is sent: the
// server trims the on-air question to its reveal step (the Closest-guess
// reveal module), so this screen never sees a step number.
export function ClosestGuessRevealScreen({
  prompt,
  correctAnswer,
  answerMediaUrl,
  revealStartSeconds,
  revealEndSeconds,
  closestGuess,
  mediaTestIdPrefix,
  autoplayMedia,
  isDisplaySoundMuted,
  hasEntrance,
}: ClosestGuessRevealScreenProps) {
  const { minGuess, maxGuess, closestGuesses } = closestGuess;
  const showCorrect = correctAnswer !== undefined;

  return (
    <>
      <h1 className="text-balance font-display text-display-4xl leading-snug">
        {prompt}
      </h1>
      {minGuess !== undefined && (
        <EntranceLine
          hasEntrance={hasEntrance}
          kind="arrive"
          className="font-display text-display-lg text-cyan"
        >
          <span className="font-body text-display-sm font-extrabold text-foreground/55">
            SMALLEST GUESS{' '}
          </span>
          {minGuess}
        </EntranceLine>
      )}
      {maxGuess !== undefined && (
        <EntranceLine
          hasEntrance={hasEntrance}
          kind="arrive"
          className="font-display text-display-lg text-cyan"
        >
          <span className="font-body text-display-sm font-extrabold text-foreground/55">
            HIGHEST GUESS{' '}
          </span>
          {maxGuess}
        </EntranceLine>
      )}
      {showCorrect && (
        <>
          <EntranceLine
            hasEntrance={hasEntrance}
            kind="arrive"
            className="font-display text-display-lg text-green"
          >
            <span className="font-body text-display-sm font-extrabold text-foreground/55">
              ANSWER{' '}
            </span>
            {correctAnswer}
          </EntranceLine>
          <AnswerMedia
            url={answerMediaUrl}
            mediaTestIdPrefix={mediaTestIdPrefix}
            autoplayMedia={autoplayMedia}
            startSeconds={revealStartSeconds}
            endSeconds={revealEndSeconds}
            isDisplaySoundMuted={isDisplaySoundMuted}
          />
        </>
      )}
      {closestGuesses !== undefined && closestGuesses.length > 0 && (
        <ul className="flex w-full max-w-[calc(56rem*var(--display-text-scale,1))] flex-col gap-3 text-left">
          {closestGuesses.map((guess, index) => (
            <EntranceItem
              key={index}
              hasEntrance={hasEntrance}
              kind="arrive"
              className="flex items-center justify-between gap-3 rounded-xl border-2 border-green bg-white px-5 py-3 text-display-xl font-bold text-foreground"
            >
              <span>{guess.teamName}</span>
              <span aria-hidden="true" className="text-green">
                ✓
              </span>
              <span>{guess.value}</span>
            </EntranceItem>
          ))}
        </ul>
      )}
    </>
  );
}
