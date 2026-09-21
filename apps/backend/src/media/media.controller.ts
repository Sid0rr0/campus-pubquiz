import {
  BadRequestException,
  Controller,
  Post,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MAX_MEDIA_UPLOAD_BYTES,
  type MediaUploadResult,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { MediaStorageNotConfiguredError } from '@/media/media-storage';
import { MediaService, UnsupportedImageError } from '@/media/media.service';

@Controller('media')
@UseGuards(SessionGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // Multer buffers in memory and answers 413 past the limit before this runs.
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_MEDIA_UPLOAD_BYTES } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MediaUploadResult> {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    try {
      return await this.mediaService.uploadImage(file.buffer);
    } catch (error) {
      throw mapUploadError(error);
    }
  }
}

function mapUploadError(error: unknown): unknown {
  if (error instanceof UnsupportedImageError) {
    return new UnsupportedMediaTypeException(error.message);
  }
  if (error instanceof MediaStorageNotConfiguredError) {
    return new ServiceUnavailableException(
      'Image uploads are not configured on this server',
    );
  }
  return error;
}
