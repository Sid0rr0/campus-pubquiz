import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { SessionTeamJoker } from '@/db/entities/session-team-joker.entity';
import {
  gradable,
  setupAnswerServiceTest,
} from '@/answer/__tests__/answer-service-test-utils';
import { buildStandingsService } from '@/standings/__tests__/standings-test-utils';
import type { StandingsService } from '@/standings/standings.service';

describe('StandingsService.resultsForSessions (Postgres integration)', () => {
  const { state, insertTeam } = setupAnswerServiceTest();
  let standings: StandingsService;

  beforeEach(() => {
    standings = buildStandingsService(state.em);
  });

  async function endSession() {
    state.session.status = 'ended';
    await state.em.flush();
  }

  async function score(question: Question, teamId: number, points: number) {
    const { answerId } = await state.answerService.submit(
      state.session.id,
      gradable(question),
      teamId,
      'guess',
    );
    await state.answerService.grade(
      state.session.id,
      answerId,
      gradable(question),
      points,
    );
  }

  it("includes a departed team's answers and bonuses and takes questions from the session's quiz", async () => {
    const stays = await insertTeam('Stays', 'token-s');
    const leaves = await insertTeam('Leaves', 'token-l');
    await score(state.question, stays.id, 1);
    await score(state.question, leaves.id, 1);
    state.em.create(BonusAward, {
      gameSession: state.session,
      team: leaves,
      category: 'custom',
      reason: 'Because',
      points: 2,
    });
    await state.em.flush();
    await state.em.nativeDelete(GameSessionTeam, {
      gameSession: state.session.id,
      team: leaves.id,
    });
    await endSession();

    const result = (await standings.resultsForSessions([state.session.id])).get(
      state.session.id,
    )!;

    expect(result.participantCount).toBe(2);
    expect(result.maxPoints).toBe(state.question.points);
    expect(result.questions.map((q) => q.questionId)).toEqual([
      state.question.id,
    ]);
    expect(result.questions[0].answeredCount).toBe(2);
    expect(result.teams.map((t) => t.teamName)).toEqual(['Stays', 'Leaves']);
    expect(result.teams[1]).toMatchObject({
      hasLeft: true,
      placing: null,
      answered: true,
      totalPoints: 3,
      bonusPoints: 2,
    });
  });

  it('places and crowns teams on the doubled totals while max points and outcomes stay raw', async () => {
    const gambler = await insertTeam('Gambler', 'token-g');
    const steady = await insertTeam('Steady', 'token-s');
    await score(state.question, gambler.id, 1);
    await score(state.question, steady.id, 1.5);
    state.em.create(SessionTeamJoker, {
      gameSession: state.session,
      team: gambler,
      round: state.round,
      source: 'chosen',
    });
    await state.em.flush();
    await endSession();

    const result = (await standings.resultsForSessions([state.session.id])).get(
      state.session.id,
    )!;

    expect(
      result.teams.map((t) => [t.teamName, t.totalPoints, t.placing]),
    ).toEqual([
      ['Gambler', 2, 1],
      ['Steady', 1.5, 2],
    ]);
    expect(result.teams[0].wonNight).toBe(true);
    expect(result.maxPoints).toBe(state.question.points);
    expect(result.questions[0].answeredCount).toBe(2);
  });

  it('reads only ended sessions', async () => {
    const team = await insertTeam('Team', 'token-t');
    await score(state.question, team.id, 1);

    const lobby = await standings.resultsForSessions([state.session.id]);
    expect(lobby.size).toBe(0);

    await endSession();
    const ended = await standings.resultsForSessions([state.session.id]);
    expect([...ended.keys()]).toEqual([state.session.id]);
  });

  it('returns an empty map for no sessions', async () => {
    expect((await standings.resultsForSessions([])).size).toBe(0);
  });
});
