import { SessionPlayerCount } from '@/db/entities/session-player-count.entity';
import { SessionPlayerCountRepository } from '@/db/repositories/session-player-count.repository';
import { PlayerCountService } from '@/player-count/player-count.service';
import { setupAnswerServiceTest } from '@/answer/__tests__/answer-service-test-utils';

describe('PlayerCountService (Postgres integration)', () => {
  const { state, insertTeam } = setupAnswerServiceTest();
  const LONG_AGO = new Date('2026-01-01T00:00:00Z');
  let service: PlayerCountService;

  beforeEach(() => {
    service = new PlayerCountService(
      state.em.getRepository<SessionPlayerCount, SessionPlayerCountRepository>(
        SessionPlayerCount,
      ),
    );
  });

  it('keeps the first report time when a team changes its count', async () => {
    const team = await insertTeam('Counters', 'token-c');
    await service.set(state.session.id, team.id, 3);
    await state.em.nativeUpdate(
      SessionPlayerCount,
      { team: team.id },
      { createdAt: LONG_AGO },
    );

    await service.set(state.session.id, team.id, 5);

    const stored = await state.em
      .fork()
      .findOneOrFail(SessionPlayerCount, { team: team.id });
    expect(stored.playerCount).toBe(5);
    expect(stored.createdAt).toEqual(LONG_AGO);
  });

  it('reads no counts for no sessions', async () => {
    const team = await insertTeam('Counters', 'token-c');
    await service.set(state.session.id, team.id, 3);

    expect(await service.listForSessions([])).toEqual(new Map());
  });
});
