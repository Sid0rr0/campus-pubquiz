import { SessionTeamJoker } from '@/db/entities/session-team-joker.entity';
import { SessionTeamJokerRepository } from '@/db/repositories/session-team-joker.repository';
import { JokerService } from '@/joker/joker.service';
import { setupAnswerServiceTest } from '@/answer/__tests__/answer-service-test-utils';

describe('JokerService (Postgres integration)', () => {
  const { state, insertTeam } = setupAnswerServiceTest();
  const LONG_AGO = new Date('2026-01-01T00:00:00Z');
  let service: JokerService;

  beforeEach(() => {
    service = new JokerService(
      state.em.getRepository<SessionTeamJoker, SessionTeamJokerRepository>(
        SessionTeamJoker,
      ),
    );
  });

  it('keeps the first save time when a team changes its joker', async () => {
    const team = await insertTeam('Pickers', 'token-p');
    await service.set(state.session.id, team.id, {
      roundId: state.round.id,
      source: 'drawn',
    });
    await state.em.nativeUpdate(
      SessionTeamJoker,
      { team: team.id },
      { createdAt: LONG_AGO },
    );

    await service.set(state.session.id, team.id, {
      roundId: state.round.id,
      source: 'chosen',
    });

    const stored = await state.em
      .fork()
      .findOneOrFail(SessionTeamJoker, { team: team.id });
    expect(stored.source).toBe('chosen');
    expect(stored.createdAt).toEqual(LONG_AGO);
  });

  it('clears the drawn jokers only, and names the teams that held one', async () => {
    const drawn = await insertTeam('Drawn', 'token-d');
    const chosen = await insertTeam('Chosen', 'token-c');
    await service.set(state.session.id, drawn.id, {
      roundId: state.round.id,
      source: 'drawn',
    });
    await service.set(state.session.id, chosen.id, {
      roundId: state.round.id,
      source: 'chosen',
    });

    expect(await service.clearDrawn(state.session.id)).toEqual([drawn.id]);

    expect([
      ...(await service.listForSession(state.session.id)).keys(),
    ]).toEqual([chosen.id]);
  });
});
