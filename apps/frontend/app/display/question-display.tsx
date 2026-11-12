import {
  useState,
  type ComponentProps,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import {
  classifyMediaUrl,
  extractYoutubeVideoId,
  isYoutubeShortUrl,
  isHttpUrl,
  isVideoUrl,
  QUESTION_KINDS,
  resolveAnswerKind,
  resolveRevealClip,
  type QuestionView,
  type SeededQuestion,
} from '@campus-pubquiz/types';
import { ClueList } from '@/app/components/clue-list';
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
  /** GameProgress.isMediaFullscreen — raises an answer image or video to the full viewport, without remounting it. */
  isFullscreen?: boolean;
  /** GameProgress.isMediaPaused — pauses and resumes a video-file answer in place. */
  isMediaPaused?: boolean;
  /** GameProgress.mediaReplayToken — a change seeks a video-file answer to the reveal clip start and plays it. */
  mediaReplayToken?: number;
  /** The snapshot's isDisplaySoundMuted — silences the answer media (video file, YouTube, audio) without pausing it. */
  isDisplaySoundMuted?: boolean;
  /** Shown in QuestionDisplay's media column, whose full height an upright Short fills. */
  isInMediaColumn?: boolean;
}

const FULLSCREEN_OVERLAY =
  'fixed inset-0 z-50 flex items-center justify-center bg-black';

/** The box around a video: the fullscreen overlay, the media column's full height for an upright Short in it, else a capped width (and a capped height, so a Short can't push the text off the screen). */
function videoBoxClass(
  isFullscreen: boolean,
  isUpright: boolean,
  isInMediaColumn: boolean,
): string {
  if (isFullscreen) return FULLSCREEN_OVERLAY;
  if (!isUpright) return 'w-full max-w-2xl';
  return isInMediaColumn ? 'h-full' : 'h-[60vh] w-full max-w-2xl';
}

/** A video's frame size: 16:9, or upright 9:16 for a YouTube Short, as tall as its box. */
function videoFrameShape(isFullscreen: boolean, isUpright: boolean): string {
  if (isUpright) {
    return 'mx-auto aspect-[9/16] h-full';
  }
  return isFullscreen
    ? 'aspect-video max-h-full w-full'
    : 'aspect-video w-full';
}

// Same nesting in both states, so toggling fullscreen never remounts the player.
function AnswerVideoFrame({
  isFullscreen,
  isUpright = false,
  isInMediaColumn,
  children,
}: {
  isFullscreen: boolean;
  isUpright?: boolean;
  isInMediaColumn: boolean;
  children: ReactNode;
}) {
  return (
    <div className={videoBoxClass(isFullscreen, isUpright, isInMediaColumn)}>
      <div
        className={`relative overflow-hidden bg-black ${videoFrameShape(isFullscreen, isUpright)}${isFullscreen ? '' : ' rounded-xl'}`}
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
/**
 * The question's text content below the prompt: its options or lists while
 * asked, the answer at reveal. Presence of the prop (not its content) is
 * what switches sort/match into player-reveal mode — an empty string still
 * means "don't show the answer key", it just has nothing of the team's own
 * to show either.
 */
function QuestionText({
  question,
  playerAnswer,
  hasRevealEntrance,
}: Pick<QuestionDisplayProps, 'question' | 'playerAnswer'> & {
  hasRevealEntrance: boolean;
}) {
  const answerKind = resolveAnswerKind(question);
  // Asked: the clues shown so far. Revealed: every clue, which ride in `options`.
  const clues =
    question.clues ??
    (QUESTION_KINDS[question.type].hasClues ? question.options : undefined);
  const clueList = clues && <ClueList clues={clues} />;
  if (question.answer === undefined) {
    const QuestionBody = QUESTION_BODIES[answerKind];
    return (
      <>
        {clueList}
        <QuestionBody question={question} />
      </>
    );
  }
  const reveal = REVEAL_BODIES[answerKind]({
    question,
    correctAnswer: question.answer,
    playerAnswer,
    hasEntrance: hasRevealEntrance,
  });
  return (
    <>
      {clueList}
      {reveal.lead}
      {reveal.body}
    </>
  );
}

/** Covered (and its YouTube title masked) while the question is asked and in break review; uncovered at reveal, where a hidden video may restart on its reveal clip. */
function videoCoverOf(
  question: QuestionDisplayProps['question'],
  isRevealing: boolean,
  revealClip: ReturnType<typeof resolveRevealClip>,
) {
  return {
    isVideoCovered: question.isVideoHidden === true && !isRevealing,
    isTitleMasked: !isRevealing,
    restartsAtReveal:
      isRevealing && restartsVideoAtReveal(question.isVideoHidden, revealClip),
  };
}

/** Stretched (by the row's items-stretch) to a definite height, so the image's max-h-full caps against it. */
function MediaColumn({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
      {children}
    </div>
  );
}

function AnswerMediaBelow({
  url,
  answerMedia,
}: {
  url: string | undefined;
  answerMedia: ReactNode;
}) {
  if (!url) return null;
  return (
    <div className="flex w-full min-h-0 items-center justify-center">
      {answerMedia}
    </div>
  );
}

function questionClipOf(
  question: QuestionDisplayProps['question'],
  isRevealing: boolean,
  revealClip: ReturnType<typeof resolveRevealClip>,
) {
  return isRevealing
    ? revealClip
    : { start: question.mediaStartSeconds, end: question.mediaEndSeconds };
}

/** Upright media (a Short, a portrait image) can't fit under the text, so it goes in a column beside it; an answer video keeps that column in fullscreen, as leaving it would remount the player. */
function mediaColumnOf({
  questionImageOrientation,
  questionMediaKind,
  questionMediaUrl,
  isFullscreen,
  isRevealingWithAnswerMedia,
  answerMediaUrl,
}: {
  questionImageOrientation: 'portrait' | 'landscape' | null;
  questionMediaKind: ReturnType<typeof classifyMediaUrl>;
  questionMediaUrl: string | undefined;
  isFullscreen: boolean;
  isRevealingWithAnswerMedia: boolean;
  answerMediaUrl: string | undefined;
}) {
  const shownUrl = isRevealingWithAnswerMedia
    ? answerMediaUrl
    : questionMediaUrl;
  const isShortInColumn = isYoutubeShortUrl(shownUrl ?? '');
  return {
    isShortInColumn,
    columnMedia: columnMediaOf(isRevealingWithAnswerMedia, isShortInColumn),
    showTwoColumnLayout:
      isShortInColumn ||
      (questionImageOrientation === 'portrait' &&
        keepsInlineImageLayout(questionMediaKind, {
          isFullscreen,
          isRevealingWithAnswerMedia,
          answerMediaUrl,
        })),
  };
}

function columnMediaOf(
  isRevealingWithAnswerMedia: boolean,
  isShortInColumn: boolean,
): 'answer' | 'questionVideo' | 'questionImage' {
  if (isRevealingWithAnswerMedia) return 'answer';
  return isShortInColumn ? 'questionVideo' : 'questionImage';
}

/** A question image shown inline; fullscreen has its own layout, except that an answer video keeps the inline one: leaving it would remount the player. */
function keepsInlineImageLayout(
  questionMediaKind: ReturnType<typeof classifyMediaUrl>,
  {
    isFullscreen,
    isRevealingWithAnswerMedia,
    answerMediaUrl,
  }: {
    isFullscreen: boolean;
    isRevealingWithAnswerMedia: boolean;
    answerMediaUrl: string | undefined;
  },
): boolean {
  return (
    questionMediaKind === 'image' &&
    (!isFullscreen ||
      (isRevealingWithAnswerMedia && isVideoUrl(answerMediaUrl)))
  );
}

/**
 * Detected once the <img> actually loads — naturalWidth/naturalHeight
 * reflect the real pixel dimensions regardless of CSS scaling. Reset
 * whenever the media changes (tracked here rather than in an effect, so
 * the stale orientation never paints even for one frame) so it can't leak
 * from the previous question into this one before the new image loads.
 */
function useImageOrientation(url: string | undefined) {
  const [orientation, setOrientation] = useState<
    'portrait' | 'landscape' | null
  >(null);
  const [trackedUrl, setTrackedUrl] = useState(url);
  if (trackedUrl !== url) {
    setTrackedUrl(url);
    setOrientation(null);
  }
  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setOrientation(naturalHeight > naturalWidth ? 'portrait' : 'landscape');
  }
  return [orientation, handleLoad] as const;
}

/** The question's own media below the prompt: its video, its inline image, or its sound. */
function QuestionMedia({
  url,
  kind,
  isVideo,
  hasVideoFailed,
  showsInlineImage,
  video,
  image,
  answerMedia,
  isAnswerSound,
  audioRef,
}: {
  url: string;
  kind: ReturnType<typeof classifyMediaUrl>;
  isVideo: boolean;
  hasVideoFailed: boolean;
  showsInlineImage: boolean;
  video: Omit<ComponentProps<typeof QuestionVideo>, 'url'>;
  image: ReactNode;
  answerMedia: ReactNode;
  isAnswerSound: boolean;
  audioRef: ReturnType<typeof useMediaPause>['audioRef'];
}) {
  return (
    <>
      {isVideo && !hasVideoFailed && <QuestionVideo url={url} {...video} />}
      {kind === 'image' && showsInlineImage && (
        <InlineImage
          image={image}
          answerMedia={answerMedia}
          isFullscreen={video.isFullscreen}
          isAnswerSound={isAnswerSound}
        />
      )}
      {kind === 'audio' && (
        <audio
          ref={audioRef}
          data-testid={`${video.mediaTestIdPrefix}-audio`}
          src={url}
          controls
          autoPlay={video.autoplayMedia}
        />
      )}
    </>
  );
}

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
  isInMediaColumn = false,
}: AnswerMediaProps) {
  const safeUrl = httpUrlOrNone(url);
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
      <AnswerVideoFrame
        isFullscreen={isFullscreen}
        isInMediaColumn={isInMediaColumn}
      >
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
    const isUpright = isYoutubeShortUrl(safeUrl);
    return (
      <AnswerVideoFrame
        isFullscreen={isFullscreen}
        isUpright={isUpright}
        isInMediaColumn={isInMediaColumn}
      >
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
          // Crops YouTube's top title band off a 16:9 video; a Short's title runs along the bottom and is no secret at reveal.
          className={
            isUpright
              ? 'absolute inset-0 h-full w-full'
              : 'absolute inset-x-0 top-[-12%] h-[112%] w-full'
          }
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
    <AnswerImage
      url={safeUrl}
      mediaTestIdPrefix={mediaTestIdPrefix}
      imageClassName={imageClassName}
      isFullscreen={isFullscreen}
    />
  );
}

function httpUrlOrNone(url: string | undefined): string | undefined {
  return url && isHttpUrl(url) ? url : undefined;
}

function AnswerImage({
  url,
  mediaTestIdPrefix,
  imageClassName,
  isFullscreen,
}: {
  url: string;
  mediaTestIdPrefix: string;
  imageClassName: string;
  isFullscreen: boolean;
}) {
  return (
    <div className={isFullscreen ? FULLSCREEN_OVERLAY : 'contents'}>
      {/* eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs */}
      <img
        data-testid={`${mediaTestIdPrefix}-answer-image`}
        src={url}
        alt="Answer image"
        className={
          isFullscreen ? 'max-h-full max-w-full object-contain' : imageClassName
        }
      />
    </div>
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
  | 'clues'
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
  /** Admin-toggled (spacebar in /control) full-viewport overlay of the question's own image/video, or at reveal the answer's image/video when it has one — see GameProgress.isMediaFullscreen. No-op when there's no question media to enlarge. */
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
  // On reveal, answer_media_url (when set) normally replaces the question's
  // own media_url rather than showing both. The one exception is a plain
  // question whose media is an image (not audio/video): then both are shown
  // together, question image smaller, answer image bigger, side by side — see
  // showSideBySideReveal below.
  const isRevealing = correctAnswer !== undefined;
  // While asked the question video plays its clip; at reveal it plays the
  // reveal clip, which falls back to that clip when left blank.
  const revealClip = resolveRevealClip(question);
  const questionClip = questionClipOf(question, isRevealing, revealClip);
  const { youtubeRef, onYoutubeLoad, audioRef, videoRef, onVideoReady } =
    useMediaPause(
      isMediaPaused,
      mediaReplayToken,
      questionClip.start ?? 0,
      isDisplaySoundMuted,
    );
  const {
    answerMediaUrl,
    isRevealingWithAnswerMedia,
    questionYoutubeId,
    showSideBySideReveal,
    questionMediaUrl,
  } = questionMediaOf(question, isMediaHidden, isRevealing);

  const [questionImageOrientation, handleQuestionImageLoad] =
    useImageOrientation(questionMediaUrl);

  // Side-by-side answer reveal and fullscreen already have their own
  // deliberate layouts — the two-column treatment only applies to a plain
  // question image shown inline.
  const questionMediaKind = classifyMediaUrl(questionMediaUrl);
  const isQuestionVideo = isVideoUrl(questionMediaUrl);
  const questionVideoFailure = useVideoLoadFailure(questionMediaUrl);
  const { isShortInColumn, showTwoColumnLayout, columnMedia } = mediaColumnOf({
    questionImageOrientation,
    questionMediaKind,
    questionMediaUrl,
    isFullscreen,
    isRevealingWithAnswerMedia,
    answerMediaUrl,
  });

  const layout = showTwoColumnLayout ? TWO_COLUMN_LAYOUT : STACKED_LAYOUT;
  const answerMedia = (
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
      isInMediaColumn={showTwoColumnLayout}
    />
  );
  const questionImage = (
    // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
    <img
      data-testid={`${mediaTestIdPrefix}-image`}
      src={questionMediaUrl}
      alt="Question image"
      onLoad={handleQuestionImageLoad}
      className="max-h-full max-w-full rounded-xl object-contain"
    />
  );

  const questionMedia = questionMediaUrl && (
    <QuestionMedia
      url={questionMediaUrl}
      kind={questionMediaKind}
      isVideo={isQuestionVideo}
      hasVideoFailed={questionVideoFailure.isFailed}
      showsInlineImage={!showTwoColumnLayout}
      video={{
        youtubeId: questionYoutubeId,
        clip: questionClip,
        ...videoCoverOf(question, isRevealing, revealClip),
        mediaReplayToken,
        isFullscreen,
        autoplayMedia,
        mediaTestIdPrefix,
        youtubeRef,
        onYoutubeLoad,
        videoRef,
        onVideoReady,
        onError: questionVideoFailure.onError,
      }}
      image={questionImage}
      answerMedia={showSideBySideReveal ? answerMedia : null}
      isAnswerSound={classifyMediaUrl(answerMediaUrl) === 'audio'}
      audioRef={audioRef}
    />
  );

  return (
    <>
      <div
        data-testid={`${mediaTestIdPrefix}-prompt-media-row`}
        data-layout={layout.name}
        className={layout.row}
      >
        {/* The prompt and its text content (margin, options, lists, reveal answer line) travel together in both layouts. */}
        <div
          data-testid={`${mediaTestIdPrefix}-prompt-column`}
          className={layout.promptColumn}
        >
          <h1 className={promptClassName}>{prompt}</h1>
          <QuestionText
            question={question}
            playerAnswer={playerAnswer}
            hasRevealEntrance={hasRevealEntrance}
          />
          <RevealNotes notes={revealNotes} hasEntrance={hasRevealEntrance} />
        </div>
        {showTwoColumnLayout && (
          <MediaColumn>
            {
              {
                answer: answerMedia,
                questionVideo: questionMedia,
                questionImage,
              }[columnMedia]
            }
          </MediaColumn>
        )}
      </div>
      {!isShortInColumn && questionMedia}
      {isRevealing && !showSideBySideReveal && !showTwoColumnLayout && (
        <AnswerMediaBelow url={answerMediaUrl} answerMedia={answerMedia} />
      )}
    </>
  );
}

/**
 * Whether the question video remounts at reveal: a visible video always does,
 * and a hidden one only when it has a reveal clip to play.
 */
function restartsVideoAtReveal(
  isVideoHidden: boolean | undefined,
  revealClip: { start?: number; end?: number },
): boolean {
  return (
    isVideoHidden !== true ||
    revealClip.start !== undefined ||
    revealClip.end !== undefined
  );
}

type MediaPause = ReturnType<typeof useMediaPause>;

function QuestionVideo({
  url,
  youtubeId,
  clip,
  restartsAtReveal,
  mediaReplayToken,
  isFullscreen,
  isVideoCovered,
  isTitleMasked,
  autoplayMedia,
  mediaTestIdPrefix,
  youtubeRef,
  onYoutubeLoad,
  videoRef,
  onVideoReady,
  onError,
}: {
  url: string;
  youtubeId: string | undefined;
  clip: { start?: number; end?: number };
  restartsAtReveal: boolean;
  mediaReplayToken: number;
  isFullscreen: boolean;
  isVideoCovered: boolean;
  isTitleMasked: boolean;
  autoplayMedia: boolean;
  mediaTestIdPrefix: string;
  youtubeRef: MediaPause['youtubeRef'];
  onYoutubeLoad: MediaPause['onYoutubeLoad'];
  videoRef: MediaPause['videoRef'];
  onVideoReady: MediaPause['onVideoReady'];
  onError: () => void;
}) {
  const videoKey = restartsAtReveal
    ? `${mediaReplayToken}-reveal`
    : mediaReplayToken;
  // A video file replays by seeking in place (see useMediaPause), so its key
  // leaves out the replay token; it still remounts at reveal for the reveal clip.
  const videoFileKey = restartsAtReveal ? 'reveal' : 'question';
  const isUpright = isYoutubeShortUrl(url);
  return (
    <div className={videoBoxClass(isFullscreen, isUpright, true)}>
      {/* A visible video, or a hidden one with a clip to play at reveal,
        is keyed on the reveal so it plays again even when the reveal
        clip's src equals the question's; a hidden video with no clip is
        not, so lifting its cover must not remount the player.
        Same nesting (and the same iframe element) in both states —
        changing the tree shape between fullscreen and inline would
        remount the iframe and restart the YouTube player instead of
        continuing playback. */}
      <div
        className={`relative ${videoFrameShape(isFullscreen, isUpright)}${isFullscreen ? '' : ' overflow-hidden rounded-xl'}`}
      >
        {youtubeId ? (
          <>
            <iframe
              ref={youtubeRef}
              onLoad={onYoutubeLoad}
              key={videoKey}
              data-testid={`${mediaTestIdPrefix}-youtube`}
              src={buildYoutubeEmbedSrc(
                youtubeId,
                autoplayMedia,
                clip.start,
                clip.end,
              )}
              title="Question video"
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
            {/* YouTube always renders its title/channel overlay near the
              top of the player (a Short also repeats it along the bottom,
              with like/share) and no longer honors any param that removes
              it (modestbranding is deprecated) — mask it with solid bars
              instead, sized to the bands YouTube draws it in. At reveal the
              answer is out, so the bars come off. */}
            {isTitleMasked && (
              <div
                aria-hidden
                data-testid={`${mediaTestIdPrefix}-youtube-title-mask`}
                className="pointer-events-none absolute inset-x-0 top-0 h-[9%] bg-black"
              />
            )}
            {isTitleMasked && isUpright && (
              <ShortBottomMask
                testId={`${mediaTestIdPrefix}-youtube-title-mask`}
                isFullscreen={isFullscreen}
              />
            )}
          </>
        ) : (
          <VideoFile
            videoRef={videoRef}
            key={videoFileKey}
            testId={`${mediaTestIdPrefix}-video`}
            url={url}
            startSeconds={clip.start}
            endSeconds={clip.end}
            autoPlay={autoplayMedia}
            onLoadedMetadata={onVideoReady}
            onError={onError}
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
  );
}

/** A Short repeats its title along the bottom; YouTube draws that band at a fixed pixel height, so it is a smaller share of a fullscreen frame. */
function ShortBottomMask({
  testId,
  isFullscreen,
}: {
  testId: string;
  isFullscreen: boolean;
}) {
  return (
    <div
      aria-hidden
      data-testid={testId}
      className={`pointer-events-none absolute inset-x-0 bottom-0 bg-black ${isFullscreen ? 'h-1/9' : 'h-1/6'}`}
    />
  );
}

const TWO_COLUMN_LAYOUT = {
  name: 'two-column',
  row: 'flex w-full min-h-0 flex-1 items-stretch gap-8',
  promptColumn:
    'flex min-w-0 flex-1 flex-col items-start justify-center gap-4 self-center text-left',
};
const STACKED_LAYOUT = {
  name: 'stacked',
  row: 'contents',
  promptColumn: 'contents',
};

/**
 * Which media the question shows. On reveal, answer_media_url (when set)
 * replaces the question's own media, except a question image, which stays
 * beside the answer media (the side-by-side reveal).
 */
function questionMediaOf(
  question: QuestionDisplayProps['question'],
  isMediaHidden: boolean,
  isRevealing: boolean,
) {
  const mediaUrl = isMediaHidden ? undefined : question.mediaUrl;
  const answerMediaUrl = isMediaHidden ? undefined : question.answerMediaUrl;
  const isRevealingWithAnswerMedia =
    isRevealing && answerMediaUrl !== undefined;
  const rawQuestionMediaUrl = httpUrlOrNone(mediaUrl);
  // An upright Short can't fit under the text beside an image: it replaces the image instead.
  const showSideBySideReveal =
    isRevealing &&
    answerMediaUrl !== undefined &&
    classifyMediaUrl(rawQuestionMediaUrl) === 'image' &&
    !isYoutubeShortUrl(answerMediaUrl);
  return {
    answerMediaUrl,
    isRevealingWithAnswerMedia,
    questionYoutubeId: rawQuestionMediaUrl
      ? extractYoutubeVideoId(rawQuestionMediaUrl)
      : undefined,
    showSideBySideReveal,
    questionMediaUrl:
      isRevealingWithAnswerMedia && !showSideBySideReveal
        ? undefined
        : rawQuestionMediaUrl,
  };
}

/** A question image shown in the stacked layout: alone, or beside the answer media at a side-by-side reveal. */
function InlineImage({
  image,
  answerMedia,
  isFullscreen,
  isAnswerSound,
}: {
  image: ReactNode;
  answerMedia: ReactNode | null;
  isFullscreen: boolean;
  isAnswerSound: boolean;
}) {
  if (answerMedia === null) {
    return (
      <div
        className={
          isFullscreen
            ? FULLSCREEN_OVERLAY
            : 'flex w-full min-h-0 items-center justify-center'
        }
      >
        {image}
      </div>
    );
  }
  return (
    <div className="flex w-full min-h-0 flex-1 items-stretch justify-center gap-6">
      {/* A sound answer has no picture to enlarge, so fullscreen takes the question image. */}
      <div
        className={
          isFullscreen && isAnswerSound
            ? FULLSCREEN_OVERLAY
            : 'flex min-h-0 min-w-0 flex-2 items-center justify-center'
        }
      >
        {image}
      </div>
      <div className="flex min-h-0 min-w-0 flex-3 items-center justify-center">
        {answerMedia}
      </div>
    </div>
  );
}
