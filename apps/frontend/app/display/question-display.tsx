import { getOptionLetter } from '@/app/lib/option-letters';

const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|m4a)(\?.*)?$/i;
const HTTP_URL_PATTERN = /^https?:\/\//i;

// Neither media_url nor answer_media_url is tied to the question's `type`
// (e.g. a free_text question can carry a photo or reveal one), so image vs.
// audio is inferred from the URL's file extension instead.
function isAudioUrl(url: string): boolean {
  return AUDIO_EXTENSION_PATTERN.test(url);
}

// media_url/answer_media_url come from an admin-imported spreadsheet, not a
// trusted author — restrict to http(s) so a malicious sheet can't slip in a
// data:/blob: payload that bloats or hangs the shared display.
function isHttpUrl(url: string): boolean {
  return HTTP_URL_PATTERN.test(url);
}

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
  const rawQuestionMediaUrl = isRevealing && answerMediaUrl ? undefined : mediaUrl;
  const questionMediaUrl =
    rawQuestionMediaUrl && isHttpUrl(rawQuestionMediaUrl) ? rawQuestionMediaUrl : undefined;
  const safeAnswerMediaUrl = answerMediaUrl && isHttpUrl(answerMediaUrl) ? answerMediaUrl : undefined;

  return (
    <>
      <h1 className="text-balance font-display text-4xl leading-snug">{prompt}</h1>
      {questionMediaUrl && !isAudioUrl(questionMediaUrl) && (
        // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
        <img
          data-testid={`${mediaTestIdPrefix}-image`}
          src={questionMediaUrl}
          alt="Question image"
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
                <span className={`font-display ${isCorrect ? 'text-green' : 'text-cyan'}`}>
                  {getOptionLetter(index)}
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
      {isRevealing && safeAnswerMediaUrl && !isAudioUrl(safeAnswerMediaUrl) && (
        // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
        <img
          data-testid={`${mediaTestIdPrefix}-answer-image`}
          src={safeAnswerMediaUrl}
          alt="Answer image"
          className="max-h-64 rounded-xl"
        />
      )}
      {isRevealing && safeAnswerMediaUrl && isAudioUrl(safeAnswerMediaUrl) && (
        <audio
          data-testid={`${mediaTestIdPrefix}-answer-audio`}
          src={safeAnswerMediaUrl}
          controls
          autoPlay
        />
      )}
    </>
  );
}
