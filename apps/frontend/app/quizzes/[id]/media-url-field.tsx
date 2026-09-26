'use client';

import { useRef, type ChangeEvent } from 'react';
import { UploadIcon } from '@radix-ui/react-icons';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MAX_MEDIA_UPLOAD_BYTES } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { MediaApiError, uploadMedia } from '@/app/lib/media-api';

interface MediaUrlFieldProps {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  isRequired?: boolean;
  onChange: (url: string) => void;
}

const ACCEPTED_IMAGE_TYPES =
  'image/jpeg,image/png,image/gif,image/webp,image/avif';
const BYTES_PER_MB = 1024 * 1024;
const UPLOAD_FAILED_MESSAGE = 'Image upload failed';

/** A media URL input plus an upload button that fills it with a hosted image's URL. */
export function MediaUrlField({
  label,
  value,
  placeholder,
  disabled = false,
  isRequired = false,
  onChange,
}: MediaUrlFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    // Wrapped so React Query's extra (variables, context) args never leak into uploadMedia.
    mutationFn: (file: File) => uploadMedia(file),
    onSuccess: ({ url }) => onChange(url),
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, MediaApiError, UPLOAD_FAILED_MESSAGE) ??
          UPLOAD_FAILED_MESSAGE,
      ),
  });

  function handleFileChosen(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
      toast.error(
        `${file.name} is larger than ${MAX_MEDIA_UPLOAD_BYTES / BYTES_PER_MB} MB`,
      );
      return;
    }
    upload.mutate(file);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-extrabold text-foreground/60">
        {label}
        {isRequired ? ' (required)' : ''}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground disabled:opacity-50"
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Upload image for ${label}`}
        title="Upload an image"
        disabled={disabled || upload.isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadIcon
          aria-hidden="true"
          className={upload.isPending ? 'animate-pulse' : undefined}
        />
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        aria-label={`${label} image file`}
        onChange={handleFileChosen}
        className="hidden"
      />
    </div>
  );
}
