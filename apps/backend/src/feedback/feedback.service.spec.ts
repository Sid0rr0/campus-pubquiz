import { RoundRating } from '@/db/entities/round-rating.entity';
import { SessionFeedback } from '@/db/entities/session-feedback.entity';
import { RoundRatingRepository } from '@/db/repositories/round-rating.repository';
import { SessionFeedbackRepository } from '@/db/repositories/session-feedback.repository';
import { FeedbackService } from '@/feedback/feedback.service';
import { setupAnswerServiceTest } from '@/answer/__tests__/answer-service-test-utils';

describe('FeedbackService (Postgres integration)', () => {
  const { state, insertTeam } = setupAnswerServiceTest();
  const LONG_AGO = new Date('2026-01-01T00:00:00Z');
  let service: FeedbackService;

  beforeEach(() => {
    service = new FeedbackService(
      state.em.getRepository<RoundRating, RoundRatingRepository>(RoundRating),
      state.em.getRepository<SessionFeedback, SessionFeedbackRepository>(
        SessionFeedback,
      ),
    );
  });

  /** The stored row as a fresh read sees it, past the identity map. */
  const storedFeedback = (teamId: number) =>
    state.em.fork().findOneOrFail(SessionFeedback, {
      gameSession: state.session.id,
      team: teamId,
    });

  it('keeps the first rating time when a round is rated again', async () => {
    const team = await insertTeam('Raters', 'token-r');
    await service.rateRound(state.session.id, team.id, state.round.id, 3);
    await state.em.nativeUpdate(
      RoundRating,
      { team: team.id },
      { createdAt: LONG_AGO },
    );

    await service.rateRound(state.session.id, team.id, state.round.id, 5);

    const stored = await state.em
      .fork()
      .findOneOrFail(RoundRating, { team: team.id });
    expect(stored.stars).toBe(5);
    expect(stored.createdAt).toEqual(LONG_AGO);
  });

  it('starts a scale answer with an empty comment and no topics', async () => {
    const team = await insertTeam('Raters', 'token-r');

    await service.rateSession(state.session.id, team.id, {
      scale: 'pacing',
      value: 'just_right',
    });

    const stored = await storedFeedback(team.id);
    expect(stored.comment).toBe('');
    expect(stored.topics).toEqual([]);
  });

  it('keeps the first feedback time and the scale answers when the comment is sent', async () => {
    const team = await insertTeam('Raters', 'token-r');
    await service.rateSession(state.session.id, team.id, {
      scale: 'pacing',
      value: 'just_right',
    });
    await state.em.nativeUpdate(
      SessionFeedback,
      { team: team.id },
      { createdAt: LONG_AGO },
    );

    await service.sendFeedback(state.session.id, team.id, {
      comment: 'Lovely',
      topics: ['music'],
    });

    const stored = await storedFeedback(team.id);
    expect(stored.comment).toBe('Lovely');
    expect(stored.pacing).toBe('just_right');
    expect(stored.createdAt).toEqual(LONG_AGO);
  });
});
