import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { Server } from 'node:http';
import { LeagueTableService } from '@/league/league-table.service';
import { TeamHistoryService } from '@/team/team-history.service';
import { TeamPageController } from '@/team/team-page.controller';

describe('team page throttling (HTTP)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
      controllers: [TeamPageController],
      providers: [
        {
          provide: TeamHistoryService,
          useValue: {
            detailByCode: jest.fn().mockResolvedValue(null),
            nightByCode: jest.fn().mockResolvedValue(null),
          },
        },
        { provide: LeagueTableService, useValue: { positionsOf: jest.fn() } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    // Listen once, on loopback only. Left alone, supertest opens a wildcard
    // `listen(0)` for every request, and on a busy machine the port it gets can
    // already belong to another process on 127.0.0.1, which then answers (a
    // stray 404/401, or a hang-up) instead of this app.
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer() as Server;

  it('answers the sixth history request in a minute with a 429', async () => {
    for (let i = 0; i < 5; i += 1) {
      const response = await request(server())
        .post('/team-page')
        .send({ teamCode: 'NOPE99' });
      expect(response.status).toBe(404);
    }

    const response = await request(server())
      .post('/team-page')
      .send({ teamCode: 'NOPE99' });

    expect(response.status).toBe(429);
  });

  it('lets a team open many nights without hitting the history limit', async () => {
    for (let i = 0; i < 20; i += 1) {
      const response = await request(server())
        .post('/team-page/sessions/1')
        .send({ teamCode: 'NOPE99' });
      expect(response.status).toBe(404);
    }

    const history = await request(server())
      .post('/team-page')
      .send({ teamCode: 'NOPE99' });
    expect(history.status).toBe(404);
  });

  it('still stops night requests at their own, looser limit', async () => {
    for (let i = 0; i < 30; i += 1) {
      await request(server())
        .post('/team-page/sessions/1')
        .send({ teamCode: 'NOPE99' });
    }

    const response = await request(server())
      .post('/team-page/sessions/1')
      .send({ teamCode: 'NOPE99' });

    expect(response.status).toBe(429);
  });
});
