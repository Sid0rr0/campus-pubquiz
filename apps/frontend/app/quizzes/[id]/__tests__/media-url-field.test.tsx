import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_MEDIA_UPLOAD_BYTES } from '@campus-pubquiz/types';
import { MediaApiError } from '@/app/lib/media-api';
import { MediaUrlField } from '@/app/quizzes/[id]/media-url-field';
import { renderWithQuery } from '@/test-utils/query';

const { mockUploadMedia } = vi.hoisted(() => ({ mockUploadMedia: vi.fn() }));

vi.mock('@/app/lib/media-api', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/media-api')>(
    '@/app/lib/media-api',
  );
  return { ...actual, uploadMedia: mockUploadMedia };
});

function renderField(
  overrides: Partial<Parameters<typeof MediaUrlField>[0]> = {},
) {
  const onChange = vi.fn();
  renderWithQuery(
    <>
      <Toaster />
      <MediaUrlField
        label="Media URL"
        value=""
        placeholder="https://…"
        disabled={false}
        onChange={onChange}
        {...overrides}
      />
    </>,
  );
  return { onChange };
}

function pngFile(name = 'photo.png', size = 3): File {
  return new File([new Uint8Array(size)], name, { type: 'image/png' });
}

describe('MediaUrlField', () => {
  beforeEach(() => {
    mockUploadMedia.mockReset();
  });

  it('shows the label, the current value and the required marker', () => {
    renderField({ value: 'https://x/y.png', isRequired: true });

    expect(screen.getByLabelText(/media url \(required\)/i)).toHaveValue(
      'https://x/y.png',
    );
  });

  it('reports typed URLs through onChange', async () => {
    const { onChange } = renderField();

    await userEvent.type(screen.getByLabelText('Media URL'), 'h');

    expect(onChange).toHaveBeenCalledWith('h');
  });

  it('uploads the chosen image and fills the field with the returned URL', async () => {
    mockUploadMedia.mockResolvedValue({ url: 'https://cdn.example/a.png' });
    const { onChange } = renderField();
    const file = pngFile();

    await userEvent.upload(screen.getByLabelText('Media URL image file'), file);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('https://cdn.example/a.png'),
    );
    expect(mockUploadMedia).toHaveBeenCalledWith(file);
  });

  it('opens the file picker from the upload button', async () => {
    renderField();
    const fileInput = screen.getByLabelText('Media URL image file');
    const click = vi.spyOn(fileInput, 'click');

    await userEvent.click(
      screen.getByRole('button', { name: 'Upload image for Media URL' }),
    );

    expect(click).toHaveBeenCalled();
  });

  it('toasts the server message and leaves the field alone when the upload fails', async () => {
    mockUploadMedia.mockRejectedValue(
      new MediaApiError('File is not a supported image', 415),
    );
    const { onChange } = renderField();

    await userEvent.upload(
      screen.getByLabelText('Media URL image file'),
      pngFile(),
    );

    expect(
      await screen.findByText('File is not a supported image'),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toasts a generic message for unexpected failures like a dropped network', async () => {
    mockUploadMedia.mockRejectedValue(new TypeError('Failed to fetch'));
    renderField();

    await userEvent.upload(
      screen.getByLabelText('Media URL image file'),
      pngFile(),
    );

    expect(await screen.findByText('Image upload failed')).toBeInTheDocument();
  });

  it('rejects an oversized file before sending it anywhere', async () => {
    const { onChange } = renderField();

    await userEvent.upload(
      screen.getByLabelText('Media URL image file'),
      pngFile('huge.png', MAX_MEDIA_UPLOAD_BYTES + 1),
    );

    expect(await screen.findByText(/larger than 5 MB/i)).toBeInTheDocument();
    expect(mockUploadMedia).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables typing and uploading while the question is opened in a live session', () => {
    renderField({ disabled: true });

    expect(screen.getByLabelText('Media URL')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Upload image for Media URL' }),
    ).toBeDisabled();
  });

  it('disables the upload button while an upload is in flight', async () => {
    mockUploadMedia.mockReturnValue(new Promise(() => undefined));
    renderField();

    await userEvent.upload(
      screen.getByLabelText('Media URL image file'),
      pngFile(),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Upload image for Media URL' }),
      ).toBeDisabled(),
    );
  });
});
