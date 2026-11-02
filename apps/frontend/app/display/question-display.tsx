import { useState, type ReactNode, type SyntheticEvent } from 'react';
import {
  classifyMediaUrl,
  extractYoutubeVideoId,
  isHttpUrl,
  isVideoUrl,
  resolveAnswerKind,
  resolveRevealClip,
  type QuestionView,
  type SeededQuestion,
} from '@campus-pubquiz/types';
import {
  QUESTION_BODIES,
  REVEAL_BODIES,
} from '@/app/display/answer-kind-bodies';
import { EntranceLine } from '@/app/display/reveal-entrance';
import { useMediaPause } from '@/app/display/use-media-pause';
import { useVideoLoadFailure, VideoFile } from '@/app/display/video-file';

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
    // Lets /display pause and resume the player with postMessage commands.
    enablejsapi: '1',
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
  /** The reveal clip, applied when `url` is a video (YouTube or file). */
  startSeconds?: number;
  endSeconds?: number;
  /** GameProgress.isMediaFullscreen — raises an answer video to the full viewport, without remounting it. */
  isFullscreen?: boolean;
  /** GameProgress.isMediaPaused — pauses and resumes a video-file answer in place. */
  isMediaPaused?: boolean;
  /** GameProgress.mediaReplayToken — a change seeks a video-file answer to the reveal clip start and plays it. */
  mediaReplayToken?: number;
  /** The snapshot's isDisplaySoundMuted — silences the answer media (video file, YouTube, audio) without pausing it. */
  isDisplaySoundMuted?: boolean;
}

// Same nesting in both states, so toggling fullscreen never remounts the player.
function AnswerVideoFrame({
  isFullscreen,
  children,
}: {
  isFullscreen: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
          : 'w-full max-w-2xl'
      }
    >
      <div
        className={
          isFullscreen
            ? 'relative aspect-video max-h-full w-full overflow-hidden bg-black'
            : 'relative aspect-video w-full overflow-hidden rounded-xl bg-black'
        }
      >
        {children}
      </div>
    </div>
  );
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
  startSeconds,
  endSeconds,
  isFullscreen = false,
  isMediaPaused = false,
  mediaReplayToken = 0,
  isDisplaySoundMuted = false,
}: AnswerMediaProps) {
  const safeUrl = url && isHttpUrl(url) ? url : undefined;
  const youtubeId = safeUrl ? extractYoutubeVideoId(safeUrl) : undefined;
  const { youtubeRef, onYoutubeLoad, audioRef, videoRef, onVideoReady } =
    useMediaPause(
      isMediaPaused,
      mediaReplayToken,
      startSeconds ?? 0,
      isDisplaySoundMuted,
    );
  const videoFailure = useVideoLoadFailure(safeUrl);
  if (!safeUrl) return null;
  const kind = classifyMediaUrl(safeUrl);

  if (kind === 'video-file') {
    if (videoFailure.isFailed) return null;
    return (
      <AnswerVideoFrame isFullscreen={isFullscreen}>
        <VideoFile
          videoRef={videoRef}
          testId={`${mediaTestIdPrefix}-answer-video`}
          url={safeUrl}
          startSeconds={startSeconds}
          endSeconds={endSeconds}
          autoPlay={autoplayMedia}
          onLoadedMetadata={onVideoReady}
          onError={videoFailure.onError}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </AnswerVideoFrame>
    );
  }
  if (youtubeId) {
    return (
      <AnswerVideoFrame isFullscreen={isFullscreen}>
        <iframe
          ref={youtubeRef}
          onLoad={onYoutubeLoad}
          // Play again remounts the embed, restarting it from the reveal clip.
          key={mediaReplayToken}
          data-testid={`${mediaTestIdPrefix}-answer-youtube`}
          src={buildYoutubeEmbedSrc(
            youtubeId,
            autoplayMedia,
            startSeconds,
            endSeconds,
          )}
          title="Answer video"
          className="absolute inset-x-0 top-[-12%] h-[112%] w-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </AnswerVideoFrame>
    );
  }
  if (kind === 'audio') {
    return (
      <audio
        ref={audioRef}
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
  | 'isVideoHidden'
  | 'options'
  | 'matchTargets'
  | 'margin'
> &
  Partial<
    Pick<
      SeededQuestion,
      'answer' | 'answerMediaUrl' | 'revealStartSeconds' | 'revealEndSeconds'
    >
  >;

interface QuestionDisplayProps {
  /** When `answer` is set (reveal only), highlights the matching option and shows an answer line. `answerMediaUrl` is shown alongside it, independent of the question's own media. `mediaStartSeconds`/`mediaEndSeconds` clip a video `mediaUrl` (YouTube or file) — ignored for other media, and for an `answerMediaUrl` that is a different video. */
  question: QuestionDisplayQuestion;
  /** Renders the question with no media at all (neither its own nor the answer's) — the phone's question browser, which leaves the big screen's audio and video to the big screen. */
  isMediaHidden?: boolean;
  playerAnswer?: string;
  mediaTestIdPrefix: string;
  /** Controls <audio autoPlay> and YouTube's autoplay param — defaults to true, matching the pre-settings hardcoded behavior. */
  autoplayMedia?: boolean;
  /** Overrides the prompt heading's className — defaults to the big-screen size used by /display; the /play reveal step passes its question_open size to keep both states visually consistent. */
  promptClassName?: string;
  /** Admin-toggled (spacebar in /control) full-viewport overlay of the question's own image/video, or a video answer media at reveal — see GameProgress.isMediaFullscreen. No-op when there's no question media to enlarge. */
  isFullscreen?: boolean;
  /** GameProgress.mediaReplayToken — bumped by REPLAY_MEDIA. Folded into the YouTube iframe's `key` so incrementing it remounts the iframe and restarts playback; left out of the key the rest of the time so fullscreen toggling (which doesn't change this) keeps the same iframe per the comment below. */
  mediaReplayToken?: number;
  /** GameProgress.isMediaPaused — pauses the question's YouTube/audio playback in place (no remount) and resumes it when cleared. */
  isMediaPaused?: boolean;
  /** The snapshot's isDisplaySoundMuted — silences the question's and the answer's media (YouTube, audio, video) in place, without pausing it; a standing mute applies to media that mounts later. */
  isDisplaySoundMuted?: boolean;
  /** The big screen's reveal: the answer comes in with its own entrance. Left off on the phone. */
  hasRevealEntrance?: boolean;
  /** The Question notes the big screen shows under the answer; '' or left off shows none. */
  revealNotes?: string;
}

/** Question notes under a revealed answer on the big screen; nothing for ''. `sizeClass` keeps them no larger than the answer they follow. */
export function RevealNotes({
  notes,
  hasEntrance,
  sizeClass = 'text-display-2xl',
}: {
  notes?: string;
  hasEntrance?: boolean;
  sizeClass?: string;
}) {
  if (!notes) return null;
  return (
    <EntranceLine
      hasEntrance={hasEntrance}
      kind="arrive"
      className={`max-w-5xl whitespace-pre-line font-bold text-foreground/70 ${sizeClass}`}
    >
      {notes}
    </EntranceLine>
  );
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
  isMediaPaused = false,
  isDisplaySoundMuted = false,
  hasRevealEntrance = false,
  revealNotes,
}: QuestionDisplayProps) {
  const { prompt, answer: correctAnswer } = question;
  const mediaUrl = isMediaHidden ? undefined : question.mediaUrl;
  const answerMediaUrl = isMediaHidden ? undefined : question.answerMediaUrl;
  // On reveal, answer_media_url (when set) normally replaces the question's
  // own media_url rather than showing both. The one exception is a plain
  // question whose media is an image (not audio/video): then both are shown
  // together, question image smaller, answer image bigger, side by side — see
  // showSideBySideReveal below.
  const isRevealing = correctAnswer !== undefined;
  // While asked the question video plays its clip; at reveal it plays the
  // reveal clip, which falls back to that clip when left blank.
  const revealClip = resolveRevealClip(question);
  const questionClip = isRevealing
    ? revealClip
    : { start: question.mediaStartSeconds, end: question.mediaEndSeconds };
  const { youtubeRef, onYoutubeLoad, audioRef, videoRef, onVideoReady } =
    useMediaPause(
      isMediaPaused,
      mediaReplayToken,
      questionClip.start ?? 0,
      isDisplaySoundMuted,
    );
  // Presence of the prop (not its content) is what switches sort/match into
  // player-reveal mode — an empty string still means "don't show the answer
  // key", it just has nothing of the team's own to show either.
  const answerKind = resolveAnswerKind(question);
  const reveal = isRevealing
    ? REVEAL_BODIES[answerKind]({
        question,
        correctAnswer,
        playerAnswer,
        hasEntrance: hasRevealEntrance,
      })
    : undefined;
  const QuestionBody = QUESTION_BODIES[answerKind];
  const isRevealingWithAnswerMedia =
    isRevealing && answerMediaUrl !== undefined;
  const rawQuestionMediaUrl =
    mediaUrl && isHttpUrl(mediaUrl) ? mediaUrl : undefined;
  const questionYoutubeId = rawQuestionMediaUrl
    ? extractYoutubeVideoId(rawQuestionMediaUrl)
    : undefined;
  const questionIsImage = classifyMediaUrl(rawQuestionMediaUrl) === 'image';
  const showSideBySideReveal = isRevealingWithAnswerMedia && questionIsImage;
  // Covered while the question is asked and in break review; uncovered at reveal.
  const isVideoCovered = question.isVideoHidden === true && !isRevealing;
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
  const questionMediaKind = classifyMediaUrl(questionMediaUrl);
  const isQuestionVideo = isVideoUrl(questionMediaUrl);
  const questionVideoFailure = useVideoLoadFailure(questionMediaUrl);
  const restartsAtReveal =
    isRevealing &&
    (question.isVideoHidden !== true ||
      revealClip.start !== undefined ||
      revealClip.end !== undefined);
  const videoKey = restartsAtReveal
    ? `${mediaReplayToken}-reveal`
    : mediaReplayToken;
  // A video file replays by seeking in place (see useMediaPause), so its key
  // leaves out the replay token; it still remounts at reveal for the reveal clip.
  const videoFileKey = restartsAtReveal ? 'reveal' : 'question';
  // A portrait image also wins over the side-by-side reveal: the answer image
  // then takes the image column in place of the question image.
  const showTwoColumnLayout =
    questionMediaKind === 'image' &&
    !isFullscreen &&
    questionImageOrientation === 'portrait';

  return (
    <>
      <div
        data-testid={`${mediaTestIdPrefix}-prompt-media-row`}
        data-layout={showTwoColumnLayout ? 'two-column' : 'stacked'}
        className={
          showTwoColumnLayout
            ? 'flex w-full min-h-0 flex-1 items-stretch gap-8'
            : 'contents'
        }
      >
        {/* The prompt and its text content (margin, options, lists, reveal answer line) travel together in both layouts. */}
        <div
          data-testid={`${mediaTestIdPrefix}-prompt-column`}
          className={
            showTwoColumnLayout
              ? 'flex min-w-0 flex-1 flex-col items-start justify-center gap-4 self-center text-left'
              : 'contents'
          }
        >
          <h1 className={promptClassName}>{prompt}</h1>
          {reveal?.lead}
          {reveal ? reveal.body : <QuestionBody question={question} />}
          <RevealNotes notes={revealNotes} hasEntrance={hasRevealEntrance} />
        </div>
        {showTwoColumnLayout && (
          // Stretched (by the row's items-stretch) to a definite height, so the image's max-h-full caps against it.
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
            {isRevealingWithAnswerMedia ? (
              <AnswerMedia
                url={answerMediaUrl}
                mediaTestIdPrefix={mediaTestIdPrefix}
                autoplayMedia={autoplayMedia}
                imageClassName="max-h-full max-w-full rounded-xl object-contain"
                startSeconds={revealClip.start}
                endSeconds={revealClip.end}
                isFullscreen={isFullscreen}
                isMediaPaused={isMediaPaused}
                mediaReplayToken={mediaReplayToken}
                isDisplaySoundMuted={isDisplaySoundMuted}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
              <img
                data-testid={`${mediaTestIdPrefix}-image`}
                src={questionMediaUrl}
                alt="Question image"
                onLoad={handleQuestionImageLoad}
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            )}
          </div>
        )}
      </div>
      {questionMediaUrl &&
        isQuestionVideo &&
        !questionVideoFailure.isFailed && (
          <div
            className={
              isFullscreen
                ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
                : 'w-full max-w-2xl'
            }
          >
            {/* A visible video, or a hidden one with a clip to play at reveal,
              is keyed on the reveal so it plays again even when the reveal
              clip's src equals the question's; a hidden video with no clip is
              not, so lifting its cover must not remount the player.
              Same nesting (and the same iframe element) in both states —
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
              {questionYoutubeId ? (
                <>
                  <iframe
                    ref={youtubeRef}
                    onLoad={onYoutubeLoad}
                    key={videoKey}
                    data-testid={`${mediaTestIdPrefix}-youtube`}
                    src={buildYoutubeEmbedSrc(
                      questionYoutubeId,
                      autoplayMedia,
                      questionClip.start,
                      questionClip.end,
                    )}
                    title="Question video"
                    className="absolute inset-0 h-full w-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                  {/* YouTube always renders its title/channel overlay near the
                    top of the player and no longer honors any param that
                    removes it (modestbranding is deprecated) — mask it with a
                    solid bar instead, sized to the band YouTube draws it in. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-[13%] bg-black"
                  />
                </>
              ) : (
                <VideoFile
                  videoRef={videoRef}
                  key={videoFileKey}
                  testId={`${mediaTestIdPrefix}-video`}
                  url={questionMediaUrl}
                  startSeconds={questionClip.start}
                  endSeconds={questionClip.end}
                  autoPlay={autoplayMedia}
                  onLoadedMetadata={onVideoReady}
                  onError={questionVideoFailure.onError}
                  className="absolute inset-0 h-full w-full bg-black object-contain"
                />
              )}
              {/* Hidden video: the player keeps playing at full size under an
                opaque panel (a hidden or zero-size player may not autoplay).
                Same tree as the iframe, so lifting it never remounts the
                player by itself; see restartsAtReveal. */}
              {isVideoCovered && (
                <div
                  data-testid={`${mediaTestIdPrefix}-video-cover`}
                  className="absolute inset-0 flex items-center justify-center bg-black text-display-4xl"
                >
                  <span aria-label="Sound only">🎵</span>
                </div>
              )}
            </div>
          </div>
        )}
      {questionMediaUrl &&
        questionMediaKind === 'image' &&
        !showTwoColumnLayout &&
        (showSideBySideReveal ? (
          <div className="flex w-full min-h-0 flex-1 items-stretch justify-center gap-6">
            <div className="flex min-h-0 min-w-0 flex-2 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs */}
              <img
                data-testid={`${mediaTestIdPrefix}-image`}
                src={questionMediaUrl}
                alt="Question image"
                onLoad={handleQuestionImageLoad}
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            </div>
            <div className="flex min-h-0 min-w-0 flex-3 items-center justify-center">
              <AnswerMedia
                url={answerMediaUrl}
                mediaTestIdPrefix={mediaTestIdPrefix}
                autoplayMedia={autoplayMedia}
                imageClassName="max-h-full max-w-full rounded-xl object-contain"
                startSeconds={revealClip.start}
                endSeconds={revealClip.end}
                isFullscreen={isFullscreen}
                isMediaPaused={isMediaPaused}
                mediaReplayToken={mediaReplayToken}
                isDisplaySoundMuted={isDisplaySoundMuted}
              />
            </div>
          </div>
        ) : (
          <div
            className={
              isFullscreen
                ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
                : 'flex w-full min-h-0 items-center justify-center'
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
      {questionMediaUrl && questionMediaKind === 'audio' && (
        <audio
          ref={audioRef}
          data-testid={`${mediaTestIdPrefix}-audio`}
          src={questionMediaUrl}
          controls
          autoPlay={autoplayMedia}
        />
      )}
      {isRevealing && !showSideBySideReveal && answerMediaUrl && (
        <div className="flex w-full min-h-0 items-center justify-center">
          <AnswerMedia
            url={answerMediaUrl}
            mediaTestIdPrefix={mediaTestIdPrefix}
            autoplayMedia={autoplayMedia}
            imageClassName="max-h-full max-w-full rounded-xl object-contain"
            startSeconds={revealClip.start}
            endSeconds={revealClip.end}
            isFullscreen={isFullscreen}
            isMediaPaused={isMediaPaused}
            mediaReplayToken={mediaReplayToken}
            isDisplaySoundMuted={isDisplaySoundMuted}
          />
        </div>
      )}
    </>
  );
}
