import { Question } from '@/db/entities/question.entity';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { setupAnswerServiceTest } from '@/answer/__tests__/answer-service-test-utils';

describe('AnswerService (Postgres integration) - leaderboard', () => {
  const { state, insertTeam } = setupAnswerServiceTest();

  it('computes a leaderboard summing graded points per team, sorted descending', async () => {
    const question2 = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'free_text',
      prompt: 'Name a vegetable',
      answer: 'Carrot',
      points: 1,
    });
    await state.em.flush();

    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    const answerA1 = await state.answerService.submit(
      state.session.id,
      state.question.id,
      teamA.id,
      'Banana',
    );
    const answerA2 = await state.answerService.submit(
      state.session.id,
      question2.id,
      teamA.id,
      'Carrot',
    );
    const answerB1 = await state.answerService.submit(
      state.session.id,
      state.question.id,
      teamB.id,
      'Mango',
    );

    await state.answerService.grade(state.session.id, answerA1.answerId, 2);
    await state.answerService.grade(state.session.id, answerA2.answerId, 0.5);
    await state.answerService.grade(state.session.id, answerB1.answerId, 1);

    const leaderboard = await state.answerService.computeLeaderboard(
      state.session.id,
    );

    expect(leaderboard).toEqual([
      {
        teamId: teamA.id,
        teamName: 'Team A',
        totalPoints: 2.5,
        bonusPoints: 0,
        roundPoints: [{ roundTitle: 'Round 1', points: 2.5 }],
      },
      {
        teamId: teamB.id,
        teamName: 'Team B',
        totalPoints: 1,
        bonusPoints: 0,
        roundPoints: [{ roundTitle: 'Round 1', points: 1 }],
      },
    ]);
  });

  it('treats ungraded answers as zero points in the leaderboard', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );

    const leaderboard = await state.answerService.computeLeaderboard(
      state.session.id,
    );
    expect(leaderboard).toEqual([
      {
        teamId: team.id,
        teamName: 'The Quizzards',
        totalPoints: 0,
        bonusPoints: 0,
        roundPoints: [{ roundTitle: 'Round 1', points: 0 }],
      },
    ]);
  });

  it('folds bonus awards into the leaderboard total and reports them separately', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    const answerA1 = await state.answerService.submit(
      state.session.id,
      state.question.id,
      teamA.id,
      'Banana',
    );
    await state.answerService.grade(state.session.id, answerA1.answerId, 2);

    state.em.create(BonusAward, {
      gameSession: state.session,
      team: teamA,
      category: 'shot',
      points: 1,
    });
    state.em.create(BonusAward, {
      gameSession: state.session,
      team: teamA,
      category: 'custom',
      reason: 'Best team name',
      points: 3,
    });
    state.em.create(BonusAward, {
      gameSession: state.session,
      team: teamB,
      category: 'selfie',
      points: 1,
    });
    await state.em.flush();

    const leaderboard = await state.answerService.computeLeaderboard(
      state.session.id,
    );

    expect(leaderboard).toEqual([
      {
        teamId: teamA.id,
        teamName: 'Team A',
        totalPoints: 6,
        bonusPoints: 4,
        roundPoints: [{ roundTitle: 'Round 1', points: 2 }],
      },
      {
        teamId: teamB.id,
        teamName: 'Team B',
        totalPoints: 1,
        bonusPoints: 1,
        roundPoints: [{ roundTitle: 'Round 1', points: 0 }],
      },
    ]);
  });

  it('subtracts a negative bonus (penalty) from the leaderboard total', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    const answerA1 = await state.answerService.submit(
      state.session.id,
      state.question.id,
      teamA.id,
      'Banana',
    );
    await state.answerService.grade(state.session.id, answerA1.answerId, 5);
    const answerB1 = await state.answerService.submit(
      state.session.id,
      state.question.id,
      teamB.id,
      'Mango',
    );
    await state.answerService.grade(state.session.id, answerB1.answerId, 1);

    state.em.create(BonusAward, {
      gameSession: state.session,
      team: teamA,
      category: 'custom',
      reason: 'Late arrival',
      points: -4,
    });
    await state.em.flush();

    const leaderboard = await state.answerService.computeLeaderboard(
      state.session.id,
    );

    expect(leaderboard).toEqual([
      {
        teamId: teamA.id,
        teamName: 'Team A',
        totalPoints: 1,
        bonusPoints: -4,
        roundPoints: [{ roundTitle: 'Round 1', points: 5 }],
      },
      {
        teamId: teamB.id,
        teamName: 'Team B',
        totalPoints: 1,
        bonusPoints: 0,
        roundPoints: [{ roundTitle: 'Round 1', points: 1 }],
      },
    ]);
  });
});
