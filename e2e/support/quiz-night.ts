/**
 * What `fixtures/quiz-night.csv` holds, so specs name the questions they act on
 * and state the points they expect instead of re-deriving either from the file.
 * One block of two rounds, then a break.
 */
export const QUIZ_NIGHT = {
  roundOneTitle: 'Warm-up',
  roundTwoTitle: 'Name that tune',
  /** `free_text`: a team answering the key is graded at submit time; any other answer waits for the moderator. */
  freeText: {
    prompt: 'What is the capital of France?',
    key: 'Paris',
    points: 2,
    halfPoints: 1,
  },
  /** `multiple_choice`: auto-graded at submit time. */
  choice: {
    prompt: 'Which planet is known as the Red Planet?',
    right: 'Mars',
    wrong: 'Venus',
    points: 3,
  },
  /** `audio`: only checked for rendering. */
  audio: {
    prompt: 'Which band recorded the song you hear?',
    mediaUrl: 'https://example.invalid/e2e-clip.mp3',
  },
  roundCount: 2,
  questionCount: 3,
} as const;
