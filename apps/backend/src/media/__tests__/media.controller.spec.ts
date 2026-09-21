import {
  BadRequestException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { MediaStorageNotConfiguredError } from '@/media/media-storage';
import { MediaController } from '@/media/media.controller';
import {
  UnsupportedImageError,
  type MediaService,
} from '@/media/media.service';

function makeController() {
  const mediaService = { uploadImage: jest.fn() };
  const controller = new MediaController(
    mediaService as unknown as MediaService,
  );
  return { controller, mediaService };
}

function makeFile(buffer = Buffer.from([1, 2, 3])): Express.Multer.File {
  return { buffer } as Express.Multer.File;
}

describe('MediaController', () => {
  it('is protected by SessionGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata('__guards__', MediaController) as
      | unknown[]
      | undefined;

    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('returns the stored image URL', async () => {
    const { controller, mediaService } = makeController();
    const file = makeFile();
    mediaService.uploadImage.mockResolvedValue({ url: 'https://cdn/x.png' });

    const result = await controller.upload(file);

    expect(result).toEqual({ url: 'https://cdn/x.png' });
    expect(mediaService.uploadImage).toHaveBeenCalledWith(file.buffer);
  });

  it('rejects a request with no file part as 400', async () => {
    const { controller, mediaService } = makeController();

    await expect(controller.upload(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mediaService.uploadImage).not.toHaveBeenCalled();
  });

  it('maps non-image content to 415', async () => {
    const { controller, mediaService } = makeController();
    mediaService.uploadImage.mockRejectedValue(new UnsupportedImageError());

    await expect(controller.upload(makeFile())).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
  });

  it('maps an unconfigured storage backend to 503', async () => {
    const { controller, mediaService } = makeController();
    mediaService.uploadImage.mockRejectedValue(
      new MediaStorageNotConfiguredError('BLOB_READ_WRITE_TOKEN is not set'),
    );

    await expect(controller.upload(makeFile())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('lets unexpected storage errors surface as 500s', async () => {
    const { controller, mediaService } = makeController();
    const failure = new Error('network down');
    mediaService.uploadImage.mockRejectedValue(failure);

    await expect(controller.upload(makeFile())).rejects.toBe(failure);
  });
});
