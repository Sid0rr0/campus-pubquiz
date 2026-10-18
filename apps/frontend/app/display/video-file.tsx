import { useState, type Ref } from 'react';

/** A video file's src with its clip as a media fragment (`#t=start,end`, either bound optional); an empty clip leaves the url as it is. */
function buildVideoFileSrc(
  url: string,
  startSeconds?: number,
  endSeconds?: number,
): string {
  if (startSeconds === undefined && endSeconds === undefined) return url;
  const [baseUrl] = url.split('#');
  const range =
    endSeconds === undefined
      ? `${startSeconds}`
      : `${startSeconds ?? ''},${endSeconds}`;
  return `${baseUrl}#t=${range}`;
}

/** Tracks a video file that failed to load, by url, so the caller can drop it and keep the rest of the screen. A new url is treated as not failed. */
export function useVideoLoadFailure(url: string | undefined): {
  isFailed: boolean;
  onError: () => void;
} {
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  return {
    isFailed: url !== undefined && failedUrl === url,
    onError: () => setFailedUrl(url),
  };
}

interface VideoFileProps {
  url: string;
  startSeconds?: number;
  endSeconds?: number;
  autoPlay: boolean;
  testId: string;
  className: string;
  onError: () => void;
  videoRef?: Ref<HTMLVideoElement>;
  onLoadedMetadata?: () => void;
}

/** The big screen's controls-free `<video>` for a video file, carrying its clip as a media fragment. */
export function VideoFile({
  url,
  startSeconds,
  endSeconds,
  autoPlay,
  testId,
  className,
  onError,
  videoRef,
  onLoadedMetadata,
}: VideoFileProps) {
  return (
    <video
      ref={videoRef}
      data-testid={testId}
      src={buildVideoFileSrc(url, startSeconds, endSeconds)}
      autoPlay={autoPlay}
      playsInline
      onLoadedMetadata={onLoadedMetadata}
      onError={onError}
      className={className}
    />
  );
}
