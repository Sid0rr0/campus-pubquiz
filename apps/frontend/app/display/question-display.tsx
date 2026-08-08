import {
  extractYoutubeVideoId,
  splitPipeList,
  type QuestionType,
} from '@campus-pubquiz/types';
import { getOptionLetter } from '@/app/lib/option-letters';

const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|m4a)(\?.*)?$/i;
const HTTP_URL_PATTERN = /^https?:\/\//i;

// Neither media_url nor answer_media_url is tied to the question's `type`
// (e.g. a free_text question can carry a photo or reveal one), so image vs.
// audio vs. YouTube is inferred from the URL itself instead.
function isAudioUrl(url: string): boolean {
  return AUDIO_EXTENSION_PATTERN.test(url);
}

// media_url/answer_media_url come from an admin-imported spreadsheet, not a
// trusted author — restrict to http(s) so a malicious sheet can't slip in a
// data:/blob: payload that bloats or hangs the shared display.
function isHttpUrl(url: string): boolean {
  return HTTP_URL_PATTERN.test(url);
}

function buildYoutubeEmbedSrc(
  videoId: string,
  startSeconds?: number,
  endSeconds?: number,
): string {
  const params = new URLSearchParams({
    autoplay: '1',
    controls: '0',
    modestbranding: '1',
  });
  if (startSeconds !== undefined) params.set('start', String(startSeconds));
  if (endSeconds !== undefined) params.set('end', String(endSeconds));
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

interface QuestionDisplayProps {
  type: QuestionType;
  prompt: string;
  mediaUrl?: string;
  /** Clip range (seconds) into a YouTube mediaUrl — ignored for non-YouTube media and for answerMediaUrl. */
  mediaStartSeconds?: number;
  mediaEndSeconds?: number;
  options?: string[];
  /** Match only: the right-hand items, in the order shown to players. */
  matchTargets?: string[];
  /** When set (reveal only), highlights the matching option and shows an answer line. */
  correctAnswer?: string;
  /** Shown alongside the answer during reveal only — independent of the question's own media. */
  answerMediaUrl?: string;
  mediaTestIdPrefix: string;
}

// Shared by question_open and reveal so the big screen shows each question
// the same way it was originally asked, just with the answer added back in.
export function QuestionDisplay({
  type,
  prompt,
  mediaUrl,
  mediaStartSeconds,
  mediaEndSeconds,
  options,
  matchTargets,
  correctAnswer,
  answerMediaUrl,
  mediaTestIdPrefix,
}: QuestionDisplayProps) {
  // On reveal, answer_media_url (when set) replaces the question's own
  // media_url rather than showing both — e.g. a picture round's image gives
  // way to whatever the answer_media_url shows instead.
  const isRevealing = correctAnswer !== undefined;
  const isSort = type === 'sort';
  const isMatch = type === 'match';
  const sortCorrectOrder =
    isSort && isRevealing && correctAnswer
      ? splitPipeList(correctAnswer)
      : undefined;
  const matchCorrectRights =
    isMatch && isRevealing && correctAnswer
      ? splitPipeList(correctAnswer)
      : undefined;
  const rawQuestionMediaUrl =
    isRevealing && answerMediaUrl ? undefined : mediaUrl;
  const questionMediaUrl =
    rawQuestionMediaUrl && isHttpUrl(rawQuestionMediaUrl)
      ? rawQuestionMediaUrl
      : undefined;
  const safeAnswerMediaUrl =
    answerMediaUrl && isHttpUrl(answerMediaUrl) ? answerMediaUrl : undefined;
  const questionYoutubeId = questionMediaUrl
    ? extractYoutubeVideoId(questionMediaUrl)
    : undefined;
  const answerYoutubeId = safeAnswerMediaUrl
    ? extractYoutubeVideoId(safeAnswerMediaUrl)
    : undefined;

  return (
    <>
      <h1 className="text-balance font-display text-4xl leading-snug">
        {prompt}
      </h1>
      {questionMediaUrl && questionYoutubeId && (
        <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-xl">
          <iframe
            data-testid={`${mediaTestIdPrefix}-youtube`}
            src={buildYoutubeEmbedSrc(
              questionYoutubeId,
              mediaStartSeconds,
              mediaEndSeconds,
            )}
            title="Question video"
            className="absolute inset-x-0 top-[-12%] h-[112%] w-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}
      {questionMediaUrl &&
        !questionYoutubeId &&
        !isAudioUrl(questionMediaUrl) && (
          // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
          <img
            data-testid={`${mediaTestIdPrefix}-image`}
            src={questionMediaUrl}
            alt="Question image"
            className="max-h-64 rounded-xl"
          />
        )}
      {questionMediaUrl &&
        !questionYoutubeId &&
        isAudioUrl(questionMediaUrl) && (
          <audio
            data-testid={`${mediaTestIdPrefix}-audio`}
            src={questionMediaUrl}
            controls
            autoPlay
          />
        )}
      {isSort && options && !isRevealing && (
        <ol className="flex w-full max-w-xl flex-col gap-3 text-left">
          {options.map((item, index) => (
            <li
              key={index}
              className="flex items-center gap-3 rounded-xl border-2 border-foreground/30 bg-white px-5 py-3 text-xl font-bold"
            >
              <span className="font-display text-cyan">{index + 1}</span>
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ol>
      )}
      {isSort && sortCorrectOrder && (
        <ol className="flex w-full max-w-xl flex-col gap-3 text-left">
          {sortCorrectOrder.map((item, index) => (
            <li
              key={index}
              className="flex items-center gap-3 rounded-xl border-2 border-green bg-white px-5 py-3 text-xl font-bold"
            >
              <span className="font-display text-green">{index + 1}</span>
              <span className="text-foreground">{item}</span>
              <span aria-hidden="true" className="ml-auto text-green">
                ✓
              </span>
            </li>
          ))}
        </ol>
      )}
      {isMatch && options && matchTargets && !isRevealing && (
        <div className="grid w-full max-w-3xl grid-cols-2 gap-4 text-left">
          <ul className="flex flex-col gap-3">
            {options.map((item, index) => (
              <li
                key={index}
                className="rounded-xl border-2 border-foreground/30 bg-white px-5 py-3 text-xl font-bold text-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-3">
            {matchTargets.map((item, index) => (
              <li
                key={index}
                className="rounded-xl border-2 border-foreground/30 bg-white px-5 py-3 text-xl font-bold text-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {isMatch && options && matchCorrectRights && (
        <ul className="flex w-full max-w-xl flex-col gap-3 text-left">
          {options.map((left, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-3 rounded-xl border-2 border-green bg-white px-5 py-3 text-xl font-bold text-foreground"
            >
              <span>{left}</span>
              <span aria-hidden="true" className="text-green">
                →
              </span>
              <span>{matchCorrectRights[index]}</span>
            </li>
          ))}
        </ul>
      )}
      {!isSort && !isMatch && options && (
        <ul className="grid w-full max-w-3xl grid-cols-2 gap-4">
          {options.map((option, index) => {
            const isCorrect =
              correctAnswer !== undefined && option === correctAnswer;
            return (
              <li
                key={index}
                className={`flex items-center gap-3 rounded-xl border-2 bg-white px-5 py-3 text-left text-xl font-bold ${
                  isCorrect ? 'border-green' : 'border-foreground/30'
                }`}
              >
                <span
                  className={`font-display ${isCorrect ? 'text-green' : 'text-cyan'}`}
                >
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
      {isRevealing && !isSort && !isMatch && (
        <p className="font-display text-lg text-green">
          <span className="font-body text-sm font-extrabold text-foreground/55">
            ANSWER{' '}
          </span>
          {correctAnswer}
        </p>
      )}
      {isRevealing && safeAnswerMediaUrl && answerYoutubeId && (
        <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-xl">
          <iframe
            data-testid={`${mediaTestIdPrefix}-answer-youtube`}
            src={buildYoutubeEmbedSrc(answerYoutubeId)}
            title="Answer video"
            className="absolute inset-x-0 top-[-12%] h-[112%] w-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}
      {isRevealing &&
        safeAnswerMediaUrl &&
        !answerYoutubeId &&
        !isAudioUrl(safeAnswerMediaUrl) && (
          // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
          <img
            data-testid={`${mediaTestIdPrefix}-answer-image`}
            src={safeAnswerMediaUrl}
            alt="Answer image"
            className="max-h-64 rounded-xl"
          />
        )}
      {isRevealing &&
        safeAnswerMediaUrl &&
        !answerYoutubeId &&
        isAudioUrl(safeAnswerMediaUrl) && (
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
