/** Largest image the quiz editor may upload — enforced by the backend, pre-checked by the frontend. */
export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface MediaUploadResult {
  /** Public, direct link to the stored image — safe to drop into `mediaUrl`/`answerMediaUrl`. */
  url: string;
}
