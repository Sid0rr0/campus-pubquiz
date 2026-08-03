const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|m4a)(\?.*)?$/i;

// Neither media_url nor answer_media_url is tied to the question's `type`
// (e.g. a free_text question can carry a photo or reveal one), so image vs.
// audio is inferred from the URL's file extension instead.
function isAudioUrl(url: string): boolean {
  return AUDIO_EXTENSION_PATTERN.test(url);
}

const OPTION_ACCENT_CLASSES = ['text-cyan', 'text-magenta', 'text-green', 'text-orange'];
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

interface QuestionDisplayProps {
  prompt: string;
  mediaUrl?: string;
  options?: string[];
  /** When set (reveal only), highlights the matching option and shows an answer line. */
  correctAnswer?: string;
  /** Shown alongside the answer during reveal only — independent of the question's own media. */
  answerMediaUrl?: string;
  mediaTestIdPrefix: string;
}

// Shared by question_open and reveal so the big screen shows each question
// the same way it was originally asked, just with the answer added back in.
export function QuestionDisplay({
  prompt,
  mediaUrl,
  options,
  correctAnswer,
  answerMediaUrl,
  mediaTestIdPrefix,
}: QuestionDisplayProps) {
  // On reveal, answer_media_url (when set) replaces the question's own
  // media_url rather than showing both — e.g. a picture round's image gives
  // way to whatever the answer_media_url shows instead.
  const isRevealing = correctAnswer !== undefined;
  const questionMediaUrl = isRevealing && answerMediaUrl ? undefined : mediaUrl;

  return (
    <>
      <h1 className="text-balance font-display text-4xl leading-snug">{prompt}</h1>
      {questionMediaUrl && !isAudioUrl(questionMediaUrl) && (
        // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
        <img
          data-testid={`${mediaTestIdPrefix}-image`}
          src={questionMediaUrl}
          alt=""
          className="max-h-64 rounded-xl"
        />
      )}
      {questionMediaUrl && isAudioUrl(questionMediaUrl) && (
        <audio
          data-testid={`${mediaTestIdPrefix}-audio`}
          src={questionMediaUrl}
          controls
          autoPlay
        />
      )}
      {options && (
        <ul className="grid w-full max-w-3xl grid-cols-2 gap-4">
          {options.map((option, index) => {
            const isCorrect = correctAnswer !== undefined && option === correctAnswer;
            return (
              <li
                key={index}
                className={`flex items-center gap-3 rounded-xl border-2 bg-white px-5 py-3 text-left text-xl font-bold ${
                  isCorrect ? 'border-green' : 'border-foreground/30'
                }`}
              >
                <span
                  className={`font-display ${
                    isCorrect
                      ? 'text-green'
                      : OPTION_ACCENT_CLASSES[index % OPTION_ACCENT_CLASSES.length]
                  }`}
                >
                  {OPTION_LETTERS[index % OPTION_LETTERS.length]}
                </span>
                <span className="text-foreground">{option}</span>
                {isCorrect && (
                  <span aria-hidden="true" className="ml-auto text-green">
                    ✓
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {isRevealing && (
        <p className="font-display text-lg text-green">
          <span className="font-body text-sm font-extrabold text-foreground/55">ANSWER </span>
          {correctAnswer}
        </p>
      )}
      {isRevealing && answerMediaUrl && !isAudioUrl(answerMediaUrl) && (
        // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
        <img
          data-testid={`${mediaTestIdPrefix}-answer-image`}
          src={answerMediaUrl}
          alt=""
          className="max-h-64 rounded-xl"
        />
      )}
      {isRevealing && answerMediaUrl && isAudioUrl(answerMediaUrl) && (
        <audio
          data-testid={`${mediaTestIdPrefix}-answer-audio`}
          src={answerMediaUrl}
          controls
          autoPlay
        />
      )}
    </>
  );
}
