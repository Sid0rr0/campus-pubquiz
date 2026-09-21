import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { MAX_MEDIA_UPLOAD_BYTES } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { MEDIA_STORAGE } from '@/media/media-storage';
import { MediaController } from '@/media/media.controller';
import { MediaService } from '@/media/media.service';

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function pngOfSize(bytes: number): Buffer {
  return Buffer.concat([PNG_HEADER, Buffer.alloc(bytes - PNG_HEADER.length)]);
}

describe('POST /media (multipart)', () => {
  let app: INestApplication;
  let put: jest.Mock;

  beforeEach(async () => {
    put = jest.fn().mockResolvedValue({ url: 'https://cdn.example/a.png' });
    const moduleRef = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [MediaService, { provide: MEDIA_STORAGE, useValue: { put } }],
    })
      .overrideGuard(SessionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  it('stores an uploaded PNG and returns its URL', async () => {
    const response = await request(server())
      .post('/media')
      .attach('file', pngOfSize(64), 'photo.png');

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ url: 'https://cdn.example/a.png' });
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('ignores the claimed filename and MIME type, trusting only the bytes', async () => {
    const response = await request(server())
      .post('/media')
      .attach('file', Buffer.from('<script>alert(1)</script>'), {
        filename: 'evil.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(415);
    expect(put).not.toHaveBeenCalled();
  });

  it('answers 400 when no file part is sent', async () => {
    const response = await request(server())
      .post('/media')
      .field('note', 'no file here');

    expect(response.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it('answers 413 for a file over the size limit without storing it', async () => {
    const response = await request(server())
      .post('/media')
      .attach('file', pngOfSize(MAX_MEDIA_UPLOAD_BYTES + 1), 'huge.png');

    expect(response.status).toBe(413);
    expect(put).not.toHaveBeenCalled();
  });
});
