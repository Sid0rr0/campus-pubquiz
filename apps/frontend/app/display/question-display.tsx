import { useState, type SyntheticEvent } from 'react';
import {
  answerInputKind,
  extractYoutubeVideoId,
  splitPipeList,
  type QuestionView,
  type RevealQuestionView,
} from '@campus-pubquiz/types';
import {
  getLowerOptionLetter,
  getOptionLetter,
} from '@/app/lib/option-letters';

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
// data:/blob: payload that bloats or hangs the shared display. Exported so
// callers (e.g. QuestionBrowser's "Look at the screen" hint) can detect
// whether a question has display-worthy media without duplicating this check.
export function isHttpUrl(url: string): boolean {
  return HTTP_URL_PATTERN.test(url);
}

/** Whether `url` is an http(s) URL that resolves to an embeddable YouTube video — the same inference QuestionDisplay uses to pick the iframe branch, exposed so /control and /remote can decide whether a "Play again" action has anything to act on. */
export function isYoutubeMediaUrl(url: string | undefined): boolean {
  return (
    url !== undefined &&
    isHttpUrl(url) &&
    extractYoutubeVideoId(url) !== undefined
  );
}

function buildYoutubeEmbedSrc(
  videoId: string,
  autoplay: boolean,
  startSeconds?: number,
  endSeconds?: number,
): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    controls: '0',
    modestbranding: '1',
  });
  if (startSeconds !== undefined) params.set('start', String(startSeconds));
  if (endSeconds !== undefined) params.set('end', String(endSeconds));
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

interface AnswerMediaProps {
  url?: string;
  mediaTestIdPrefix: string;
  /** Controls <audio autoPlay> and YouTube's autoplay param — defaults to true, matching the pre-settings hardcoded behavior. */
  autoplayMedia?: boolean;
  /** Overrides the answer image's className — defaults to the original fixed size used by ClosestGuessRevealScreen's standalone reveal. */
  imageClassName?: string;
}

// Shared by QuestionDisplay's reveal step and ClosestGuessRevealScreen's
// correct-answer step — same image/audio/YouTube inference and http(s)-only
// guard (media_url/answer_media_url come from an admin-imported spreadsheet,
// not a trusted author).
export function AnswerMedia({
  url,
  mediaTestIdPrefix,
  autoplayMedia = true,
  imageClassName = 'max-h-64 rounded-xl',
}: AnswerMediaProps) {
  const safeUrl = url && isHttpUrl(url) ? url : undefined;
  const youtubeId = safeUrl ? extractYoutubeVideoId(safeUrl) : undefined;
  if (!safeUrl) return null;

  if (youtubeId) {
    return (
      <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-xl">
        <iframe
          data-testid={`${mediaTestIdPrefix}-answer-youtube`}
          src={buildYoutubeEmbedSrc(youtubeId, autoplayMedia)}
          title="Answer video"
          className="absolute inset-x-0 top-[-12%] h-[112%] w-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }
  if (isAudioUrl(safeUrl)) {
    return (
      <audio
        data-testid={`${mediaTestIdPrefix}-answer-audio`}
        src={safeUrl}
        controls
        autoPlay={autoplayMedia}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
    <img
      data-testid={`${mediaTestIdPrefix}-answer-image`}
      src={safeUrl}
      alt="Answer image"
      className={imageClassName}
    />
  );
}

/** The fields QuestionDisplay renders — the reveal-only ones (answer, answerMedia) are present only once the answer is shown. */
export type QuestionDisplayQuestion = Pick<
  QuestionView,
  | 'type'
  | 'prompt'
  | 'mediaUrl'
  | 'mediaStartSeconds'
  | 'mediaEndSeconds'
  | 'options'
  | 'matchTargets'
> &
  Partial<Pick<RevealQuestionView, 'answer' | 'answerMediaUrl'>>;

interface QuestionDisplayProps {
  /** When `answer` is set (reveal only), highlights the matching option and shows an answer line. `answerMediaUrl` is shown alongside it, independent of the question's own media. `mediaStartSeconds`/`mediaEndSeconds` clip a YouTube `mediaUrl` — ignored for non-YouTube media and for `answerMediaUrl`. */
  question: QuestionDisplayQuestion;
  /** Renders the question with no media at all (neither its own nor the answer's) — the phone's question browser, which leaves the big screen's audio and video to the big screen. */
  isMediaHidden?: boolean;
  playerAnswer?: string;
  mediaTestIdPrefix: string;
  /** Controls <audio autoPlay> and YouTube's autoplay param — defaults to true, matching the pre-settings hardcoded behavior. */
  autoplayMedia?: boolean;
  /** Overrides the prompt heading's className — defaults to the big-screen size used by /display; the /play reveal step passes its question_open size to keep both states visually consistent. */
  promptClassName?: string;
  /** Admin-toggled (spacebar in /control) full-viewport overlay of the question's own image/YouTube media — see GameProgress.isMediaFullscreen. No-op when there's no question media to enlarge. */
  isFullscreen?: boolean;
  /** GameProgress.mediaReplayToken — bumped by REPLAY_MEDIA. Folded into the YouTube iframe's `key` so incrementing it remounts the iframe and restarts playback; left out of the key the rest of the time so fullscreen toggling (which doesn't change this) keeps the same iframe per the comment below. */
  mediaReplayToken?: number;
}

// Shared by question_open and reveal so the big screen shows each question
// the same way it was originally asked, just with the answer added back in.
export function QuestionDisplay({
  question,
  isMediaHidden = false,
  playerAnswer,
  mediaTestIdPrefix,
  autoplayMedia = true,
  promptClassName = 'text-balance font-display text-display-4xl leading-snug',
  isFullscreen = false,
  mediaReplayToken = 0,
}: QuestionDisplayProps) {
  const {
    type,
    prompt,
    mediaStartSeconds,
    mediaEndSeconds,
    options,
    matchTargets,
    answer: correctAnswer,
  } = question;
  const mediaUrl = isMediaHidden ? undefined : question.mediaUrl;
  const answerMediaUrl = isMediaHidden ? undefined : question.answerMediaUrl;
  // On reveal, answer_media_url (when set) normally replaces the question's
  // own media_url rather than showing both. The one exception is a plain
  // question whose media is an image (not audio/video): then both are shown
  // together, question image smaller, answer image bigger, side by side — see
  // showSideBySideReveal below.
  const isRevealing = correctAnswer !== undefined;
  const isSort = answerInputKind(type) === 'sort';
  const isMatch = answerInputKind(type) === 'match';
  const sortCorrectOrder =
    isSort && isRevealing && correctAnswer
      ? splitPipeList(correctAnswer)
      : undefined;
  const matchCorrectRights =
    isMatch && isRevealing && correctAnswer
      ? splitPipeList(correctAnswer)
      : undefined;
  // Presence of the prop (not its content) is what switches sort/match into
  // player-reveal mode — an empty string still means "don't show the answer
  // key", it just has nothing of the team's own to show either.
  const isPlayerRevealMode = playerAnswer !== undefined;
  const rawPlayerOrder = isPlayerRevealMode
    ? splitPipeList(playerAnswer)
    : undefined;
  const playerSortOrder =
    isSort &&
    isRevealing &&
    rawPlayerOrder &&
    sortCorrectOrder &&
    rawPlayerOrder.length === sortCorrectOrder.length
      ? rawPlayerOrder
      : undefined;
  const playerMatchOrder =
    isMatch &&
    isRevealing &&
    rawPlayerOrder &&
    options &&
    rawPlayerOrder.length === options.length
      ? rawPlayerOrder
      : undefined;
  const isRevealingWithAnswerMedia =
    isRevealing && answerMediaUrl !== undefined;
  const rawQuestionMediaUrl =
    mediaUrl && isHttpUrl(mediaUrl) ? mediaUrl : undefined;
  const questionYoutubeId = rawQuestionMediaUrl
    ? extractYoutubeVideoId(rawQuestionMediaUrl)
    : undefined;
  const questionIsImage =
    rawQuestionMediaUrl !== undefined &&
    !questionYoutubeId &&
    !isAudioUrl(rawQuestionMediaUrl);
  const showSideBySideReveal = isRevealingWithAnswerMedia && questionIsImage;
  const questionMediaUrl =
    isRevealingWithAnswerMedia && !showSideBySideReveal
      ? undefined
      : rawQuestionMediaUrl;

  // Detected once the <img> actually loads — naturalWidth/naturalHeight
  // reflect the real pixel dimensions regardless of CSS scaling. Reset
  // whenever the media changes (tracked here rather than in an effect, so
  // the stale orientation never paints even for one frame) so it can't leak
  // from the previous question into this one before the new image loads.
  const [questionImageOrientation, setQuestionImageOrientation] = useState<
    'portrait' | 'landscape' | null
  >(null);
  const [orientationTrackedUrl, setOrientationTrackedUrl] =
    useState(questionMediaUrl);
  if (orientationTrackedUrl !== questionMediaUrl) {
    setOrientationTrackedUrl(questionMediaUrl);
    setQuestionImageOrientation(null);
  }

  function handleQuestionImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setQuestionImageOrientation(
      naturalHeight > naturalWidth ? 'portrait' : 'landscape',
    );
  }

  // Side-by-side answer reveal and fullscreen already have their own
  // deliberate layouts — the two-column treatment only applies to a plain
  // question image shown inline.
  const isPlainQuestionImage =
    questionMediaUrl !== undefined &&
    !questionYoutubeId &&
    !isAudioUrl(questionMediaUrl) &&
    !showSideBySideReveal;
  const showTwoColumnLayout =
    isPlainQuestionImage &&
    !isFullscreen &&
    questionImageOrientation === 'portrait';

  return (
    <>
      <div
        data-testid={`${mediaTestIdPrefix}-prompt-media-row`}
        data-layout={showTwoColumnLayout ? 'two-column' : 'stacked'}
        className={
          showTwoColumnLayout
            ? 'flex w-full min-h-0 flex-1 items-center gap-8'
            : 'contents'
        }
      >
        <h1
          className={
            showTwoColumnLayout
              ? `${promptClassName} flex-1 text-left`
              : promptClassName
          }
        >
          {prompt}
        </h1>
        {showTwoColumnLayout && (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs */}
            <img
              data-testid={`${mediaTestIdPrefix}-image`}
              src={questionMediaUrl}
              alt="Question image"
              onLoad={handleQuestionImageLoad}
              className="max-h-full max-w-full rounded-xl object-contain"
            />
          </div>
        )}
      </div>
      {isRevealing && !isSort && !isMatch && (
        <p className="font-extrabold text-display-3xl">
          <span className="font-body text-foreground/55">Answer{': '}</span>
          {correctAnswer}
        </p>
      )}
      {questionMediaUrl && questionYoutubeId && (
        <div
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
              : 'w-full max-w-2xl'
          }
        >
          {/* Same nesting (and the same iframe element) in both states —
              changing the tree shape between fullscreen and inline would
              remount the iframe and restart the YouTube player instead of
              continuing playback. */}
          <div
            className={
              isFullscreen
                ? 'relative aspect-video max-h-full w-full'
                : 'relative aspect-video w-full overflow-hidden rounded-xl'
            }
          >
            <iframe
              key={mediaReplayToken}
              data-testid={`${mediaTestIdPrefix}-youtube`}
              src={buildYoutubeEmbedSrc(
                questionYoutubeId,
                autoplayMedia,
                mediaStartSeconds,
                mediaEndSeconds,
              )}
              title="Question video"
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
            {/* YouTube always renders its title/channel overlay near the top
                of the player and no longer honors any param that removes it
                (modestbranding is deprecated) — mask it with a solid bar
                instead, sized to the band YouTube draws it in. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[13%] bg-black"
            />
          </div>
        </div>
      )}
      {questionMediaUrl &&
        !questionYoutubeId &&
        !isAudioUrl(questionMediaUrl) &&
        !showTwoColumnLayout &&
        (showSideBySideReveal ? (
          <div className="flex w-full min-h-0 flex-1 items-stretch justify-center gap-6">
            <div className="flex min-h-0 min-w-0 flex-2 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs */}
              <img
                data-testid={`${mediaTestIdPrefix}-image`}
                src={questionMediaUrl}
                alt="Question image"
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            </div>
            <div className="flex min-h-0 min-w-0 flex-3 items-center justify-center">
              <AnswerMedia
                url={answerMediaUrl}
                mediaTestIdPrefix={mediaTestIdPrefix}
                autoplayMedia={autoplayMedia}
                imageClassName="max-h-full max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        ) : (
          <div
            className={
              isFullscreen
                ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
                : 'flex w-full min-h-0 flex-1 items-center justify-center'
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs */}
            <img
              data-testid={`${mediaTestIdPrefix}-image`}
              src={questionMediaUrl}
              alt="Question image"
              onLoad={handleQuestionImageLoad}
              className="max-h-full max-w-full rounded-xl object-contain"
            />
          </div>
        ))}
      {questionMediaUrl &&
        !questionYoutubeId &&
        isAudioUrl(questionMediaUrl) && (
          <audio
            data-testid={`${mediaTestIdPrefix}-audio`}
            src={questionMediaUrl}
            controls
            autoPlay={autoplayMedia}
          />
        )}
      {isSort && options && !isRevealing && (
        <ol className="flex w-full max-w-xl flex-col gap-3 text-left">
          {options.map((item, index) => (
            <li
              key={index}
              className="flex items-center gap-3 rounded-xl border-2 border-foreground/30 bg-white px-5 py-3 text-display-xl font-bold"
            >
              <span className="font-display text-cyan">{index + 1}</span>
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ol>
      )}
      {isSort && sortCorrectOrder && !isPlayerRevealMode && (
        <ol className="flex w-full max-w-xl flex-col gap-3 text-left">
          {sortCorrectOrder.map((item, index) => (
            <li
              key={index}
              className="flex items-center gap-3 rounded-xl border-2 border-green bg-white px-5 py-3 text-display-xl font-bold"
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
      {isSort && playerSortOrder && sortCorrectOrder && (
        <ol className="flex w-full max-w-xl flex-col gap-3 text-left">
          {playerSortOrder.map((item, index) => {
            const isCorrect = item === sortCorrectOrder[index];
            return (
              <li
                key={index}
                className={`flex items-center gap-3 rounded-xl border-2 bg-white px-5 py-3 text-display-xl font-bold ${
                  isCorrect ? 'border-green' : 'border-magenta'
                }`}
              >
                <span
                  className={`font-display ${isCorrect ? 'text-green' : 'text-magenta'}`}
                >
                  {index + 1}
                </span>
                <span className="text-foreground">{item}</span>
                <span
                  aria-hidden="true"
                  className={`ml-auto ${isCorrect ? 'text-green' : 'text-magenta'}`}
                >
                  {isCorrect ? '✓' : '✗'}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {isMatch && options && matchTargets && !isRevealing && (
        <div className="grid w-full max-w-3xl grid-cols-2 gap-4 text-left">
          <ul className="flex flex-col gap-3">
            {options.map((item, index) => (
              <li
                key={index}
                className="flex items-center gap-3 rounded-xl border-2 border-foreground/30 bg-white px-5 py-3 text-display-xl font-bold text-foreground"
              >
                <span className="font-display text-cyan">{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-3">
            {matchTargets.map((item, index) => (
              <li
                key={index}
                className="flex items-center gap-3 rounded-xl border-2 border-foreground/30 bg-white px-5 py-3 text-display-xl font-bold text-foreground"
              >
                <span className="font-display text-cyan">
                  {getLowerOptionLetter(index)}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {isMatch && options && matchCorrectRights && !isPlayerRevealMode && (
        <ul className="flex w-full max-w-xl flex-col gap-3 text-left">
          {options.map((left, index) => {
            const right = matchCorrectRights[index];
            const rightLetterIndex = matchTargets?.indexOf(right) ?? index;
            return (
              <li
                key={index}
                className="flex items-center justify-between gap-3 rounded-xl border-2 border-green bg-white px-5 py-3 text-display-xl font-bold text-foreground"
              >
                <span className="flex items-center gap-3">
                  <span className="font-display text-green">{index + 1}</span>
                  <span>{left}</span>
                </span>
                <span aria-hidden="true" className="text-green">
                  →
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-display text-green">
                    {getLowerOptionLetter(
                      rightLetterIndex >= 0 ? rightLetterIndex : index,
                    )}
                  </span>
                  <span>{right}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {isMatch && options && playerMatchOrder && matchCorrectRights && (
        <ul className="flex w-full max-w-xl flex-col gap-3 text-left">
          {options.map((left, index) => {
            const right = playerMatchOrder[index];
            const rightLetterIndex = matchTargets?.indexOf(right) ?? index;
            const isCorrect = right === matchCorrectRights[index];
            const accentClass = isCorrect ? 'text-green' : 'text-magenta';
            return (
              <li
                key={index}
                className={`flex items-center justify-between gap-3 rounded-xl border-2 bg-white px-5 py-3 text-display-xl font-bold text-foreground ${
                  isCorrect ? 'border-green' : 'border-magenta'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`font-display ${accentClass}`}>
                    {index + 1}
                  </span>
                  <span>{left}</span>
                </span>
                <span aria-hidden="true" className={accentClass}>
                  {isCorrect ? '→' : '✗'}
                </span>
                <span className="flex items-center gap-3">
                  <span className={`font-display ${accentClass}`}>
                    {getLowerOptionLetter(
                      rightLetterIndex >= 0 ? rightLetterIndex : index,
                    )}
                  </span>
                  <span>{right}</span>
                </span>
              </li>
            );
          })}
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
                className={`flex items-center gap-3 rounded-xl border-2 bg-white px-5 py-3 text-left text-display-xl font-bold ${
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
      {isRevealing && !showSideBySideReveal && answerMediaUrl && (
        <div className="flex w-full min-h-0 flex-1 items-center justify-center">
          <AnswerMedia
            url={answerMediaUrl}
            mediaTestIdPrefix={mediaTestIdPrefix}
            autoplayMedia={autoplayMedia}
            imageClassName="max-h-full max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </>
  );
}
