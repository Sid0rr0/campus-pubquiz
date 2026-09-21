import type { MediaStorage } from '@/media/media-storage';
import { MediaService, UnsupportedImageError } from '@/media/media.service';

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);

function makeService() {
  const put = jest.fn().mockResolvedValue({ url: 'https://cdn.example/x.png' });
  const storage: MediaStorage = { put };
  return { service: new MediaService(storage), put };
}

describe('MediaService.uploadImage', () => {
  it('stores the image under a generated key and returns the public URL', async () => {
    const { service, put } = makeService();

    const result = await service.uploadImage(PNG_BYTES);

    expect(result).toEqual({ url: 'https://cdn.example/x.png' });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith({
      key: expect.stringMatching(/^quiz-media\/[0-9a-f-]{36}\.png$/) as string,
      contentType: 'image/png',
      data: PNG_BYTES,
    });
  });

  it('uses a different key for every upload so a name can never collide or be guessed', async () => {
    const { service, put } = makeService();

    await service.uploadImage(PNG_BYTES);
    await service.uploadImage(PNG_BYTES);

    const keys = put.mock.calls.map(
      ([upload]: [{ key: string }]) => upload.key,
    );
    expect(new Set(keys).size).toBe(2);
  });

  it('rejects non-image content without touching storage', async () => {
    const { service, put } = makeService();

    await expect(
      service.uploadImage(Buffer.from('<script>alert(1)</script>')),
    ).rejects.toBeInstanceOf(UnsupportedImageError);
    expect(put).not.toHaveBeenCalled();
  });

  it('propagates storage failures unchanged', async () => {
    const { service, put } = makeService();
    const failure = new Error('blob store down');
    put.mockRejectedValue(failure);

    await expect(service.uploadImage(PNG_BYTES)).rejects.toBe(failure);
  });
});
