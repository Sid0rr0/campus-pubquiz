import { Answer } from '@/db/entities/answer.entity';
import type { AnswerRepository } from '@/db/repositories/answer.repository';
import { Question } from '@/db/entities/question.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { setupAnswerServiceTest } from '@/answer/__tests__/answer-service-test-utils';

describe('AnswerService (Postgres integration) - manual and closest-guess grading', () => {
  const { state, insertTeam } = setupAnswerServiceTest();

  it('grades an answer, returning the questionId it belongs to', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );

    const graded = await state.answerService.grade(
      state.session.id,
      submitted.answerId,
      2,
    );
    expect(graded.questionId).toBe(state.question.id);

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answer.pointsAwarded).toBe(2);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('rejects grading an answer that belongs to a different game session', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );
    const otherSession = state.em.create(GameSession, {
      quiz: state.session.quiz,
      joinCode: 'ZZZZZZ',
    });
    await state.em.flush();

    await expect(
      state.answerService.grade(otherSession.id, submitted.answerId, 2),
    ).rejects.toThrow();

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answer.pointsAwarded).toBe(0);
    expect(answer.gradedAt).toBeNull();
  });

  it('grades an answer with half points', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );

    await state.answerService.grade(state.session.id, submitted.answerId, 0.5);

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answer.pointsAwarded).toBe(0.5);
  });

  it('re-grading an already-graded answer overwrites the previous points and gradedAt', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );

    await state.answerService.grade(state.session.id, submitted.answerId, 2);
    const [firstGrade] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );

    await state.answerService.grade(state.session.id, submitted.answerId, 0);
    const [secondGrade] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );

    expect(secondGrade.pointsAwarded).toBe(0);
    expect(secondGrade.gradedAt).not.toBe(firstGrade.gradedAt);
  });

  it('resets points and gradedAt when a team changes an already-graded free_text answer', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );
    await state.answerService.grade(state.session.id, submitted.answerId, 1);

    await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Mango',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answer.value).toBe('Mango');
    expect(answer.pointsAwarded).toBe(0);
    expect(answer.gradedAt).toBeNull();
  });

  it('keeps an already-graded answer intact when resubmitted with the same value', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );
    await state.answerService.grade(state.session.id, submitted.answerId, 1);

    await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answer.pointsAwarded).toBe(1);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('gradeClosestGuess awards full points to the single closest guess', async () => {
    const guessQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'closest_guess',
      prompt: 'How many students attend this university?',
      answer: '1000',
      points: 5,
    });
    await state.em.flush();
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const teamC = await insertTeam('Team C', 'token-c');
    await state.answerService.submit(
      state.session.id,
      guessQuestion.id,
      teamA.id,
      '900',
    );
    await state.answerService.submit(
      state.session.id,
      guessQuestion.id,
      teamB.id,
      '950',
    );
    await state.answerService.submit(
      state.session.id,
      guessQuestion.id,
      teamC.id,
      '2000',
    );

    const graded = await state.answerService.gradeClosestGuess(
      state.session.id,
      guessQuestion.id,
      guessQuestion.answer,
      guessQuestion.points,
    );

    expect(graded.find((a) => a.teamId === teamB.id)?.pointsAwarded).toBe(5);
    expect(graded.find((a) => a.teamId === teamA.id)?.pointsAwarded).toBe(0);
    expect(graded.find((a) => a.teamId === teamC.id)?.pointsAwarded).toBe(0);
    expect(graded.every((a) => a.gradedAt !== null)).toBe(true);
  });

  it('gradeClosestGuess awards full (unsplit) points to every team tied for closest', async () => {
    const guessQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'closest_guess',
      prompt: 'What year was this built?',
      answer: '1000',
      points: 10,
    });
    await state.em.flush();
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    await state.answerService.submit(
      state.session.id,
      guessQuestion.id,
      teamA.id,
      '990',
    );
    await state.answerService.submit(
      state.session.id,
      guessQuestion.id,
      teamB.id,
      '1010',
    );

    const graded = await state.answerService.gradeClosestGuess(
      state.session.id,
      guessQuestion.id,
      guessQuestion.answer,
      guessQuestion.points,
    );

    expect(graded.find((a) => a.teamId === teamA.id)?.pointsAwarded).toBe(10);
    expect(graded.find((a) => a.teamId === teamB.id)?.pointsAwarded).toBe(10);
  });

  it('gradeClosestGuess returns an empty list when nobody answered', async () => {
    const guessQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'closest_guess',
      prompt: 'How many?',
      answer: '1000',
      points: 5,
    });
    await state.em.flush();

    const graded = await state.answerService.gradeClosestGuess(
      state.session.id,
      guessQuestion.id,
      guessQuestion.answer,
      guessQuestion.points,
    );

    expect(graded).toEqual([]);
  });

  it('gradeClosestGuess treats an unparseable guess as never winning', async () => {
    const guessQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'closest_guess',
      prompt: 'How many?',
      answer: '1000',
      points: 5,
    });
    await state.em.flush();
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    await state.answerService.submit(
      state.session.id,
      guessQuestion.id,
      teamA.id,
      'not a number',
    );
    await state.answerService.submit(
      state.session.id,
      guessQuestion.id,
      teamB.id,
      '900',
    );

    const graded = await state.answerService.gradeClosestGuess(
      state.session.id,
      guessQuestion.id,
      guessQuestion.answer,
      guessQuestion.points,
    );

    expect(graded.find((a) => a.teamId === teamA.id)?.pointsAwarded).toBe(0);
    expect(graded.find((a) => a.teamId === teamB.id)?.pointsAwarded).toBe(5);
  });

  it('gradeClosestGuess is idempotent when called again after the guesses are unchanged', async () => {
    const guessQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'closest_guess',
      prompt: 'How many?',
      answer: '1000',
      points: 5,
    });
    await state.em.flush();
    const teamA = await insertTeam('Team A', 'token-a');
    await state.answerService.submit(
      state.session.id,
      guessQuestion.id,
      teamA.id,
      '900',
    );

    await state.answerService.gradeClosestGuess(
      state.session.id,
      guessQuestion.id,
      guessQuestion.answer,
      guessQuestion.points,
    );
    const second = await state.answerService.gradeClosestGuess(
      state.session.id,
      guessQuestion.id,
      guessQuestion.answer,
      guessQuestion.points,
    );

    expect(second.find((a) => a.teamId === teamA.id)?.pointsAwarded).toBe(5);
  });

  it('rejects manually grading a closest_guess answer via grade()', async () => {
    const guessQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'closest_guess',
      prompt: 'How many?',
      answer: '1000',
      points: 5,
    });
    await state.em.flush();
    const team = await insertTeam('Team A', 'token-a');
    const submitted = await state.answerService.submit(
      state.session.id,
      guessQuestion.id,
      team.id,
      '900',
    );

    await expect(
      state.answerService.grade(state.session.id, submitted.answerId, 5),
    ).rejects.toThrow(
      'closest_guess answers are graded automatically and cannot be graded manually',
    );
  });

  it('lets the admin override the auto-graded points of a match answer via grade()', async () => {
    const matchQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'match',
      prompt: 'Match the hero to their weapon.',
      answer: 'excalibur|shield',
      points: 4,
      payload: {
        options: ['arthur', 'captain america'],
        matchTargets: ['shield', 'excalibur'],
      },
    });
    await state.em.flush();
    const team = await insertTeam('Team A', 'token-a');
    const submitted = await state.answerService.submit(
      state.session.id,
      matchQuestion.id,
      team.id,
      'excalibur|shield',
    );

    // Submitted answer is fully correct (4/4), auto-graded at submit time;
    // the quiz master then knocks it down to 3.
    expect(submitted.pointsAwarded).toBe(4);
    const graded = await state.answerService.grade(
      state.session.id,
      submitted.answerId,
      3,
    );

    expect(graded).toEqual({ questionId: matchQuestion.id });
    const answers = await state.answerService.listForQuestion(
      state.session.id,
      matchQuestion.id,
    );
    expect(answers.find((a) => a.teamId === team.id)?.pointsAwarded).toBe(3);
  });

  describe('regradeAutoGraded', () => {
    it('re-scores every multiple_choice answer against a corrected answer key', async () => {
      const mcQuestion = state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'London',
        points: 2,
        payload: { options: ['Paris', 'London'] },
      });
      await state.em.flush();
      const teamA = await insertTeam('Team A', 'token-a');
      const teamB = await insertTeam('Team B', 'token-b');
      await state.answerService.submit(
        state.session.id,
        mcQuestion.id,
        teamA.id,
        'Paris',
      );
      await state.answerService.submit(
        state.session.id,
        mcQuestion.id,
        teamB.id,
        'London',
      );

      await state.answerService.regradeAutoGraded(
        state.session.id,
        mcQuestion.id,
        'multiple_choice',
        'Paris',
        2,
      );

      const answers = await state.answerService.listForQuestion(
        state.session.id,
        mcQuestion.id,
      );
      expect(answers.find((a) => a.teamId === teamA.id)?.pointsAwarded).toBe(2);
      expect(answers.find((a) => a.teamId === teamB.id)?.pointsAwarded).toBe(0);
      expect(answers.every((a) => a.gradedAt !== null)).toBe(true);
    });

    it('re-scores match partial credit against new points, replacing a manual override', async () => {
      const matchQuestion = state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'match',
        prompt: 'Match the hero to their weapon.',
        answer: 'excalibur|shield',
        points: 4,
        payload: {
          options: ['arthur', 'captain america'],
          matchTargets: ['shield', 'excalibur'],
        },
      });
      await state.em.flush();
      const team = await insertTeam('Team A', 'token-a');
      const submitted = await state.answerService.submit(
        state.session.id,
        matchQuestion.id,
        team.id,
        'excalibur|excalibur',
      );
      await state.answerService.grade(state.session.id, submitted.answerId, 4);

      await state.answerService.regradeAutoGraded(
        state.session.id,
        matchQuestion.id,
        'match',
        'excalibur|shield',
        6,
      );

      const [answer] = await state.answerService.listForQuestion(
        state.session.id,
        matchQuestion.id,
      );
      expect(answer.pointsAwarded).toBe(3);
    });
  });

  describe('applyKahootSpeedScoring', () => {
    async function setAnsweredAt(
      questionId: number,
      teamId: number,
      when: number,
    ): Promise<void> {
      const answerRepo = state.em.getRepository<Answer, AnswerRepository>(
        Answer,
      );
      await answerRepo
        .getKnex()('answers')
        .where({
          game_session_id: state.session.id,
          question_id: questionId,
          team_id: teamId,
        })
        .update({ updated_at: new Date(when) });
    }

    it('gives full points to an instant answer and the 50% floor to one right at the timer', async () => {
      const mcQuestion = state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 10,
        payload: { options: ['Paris', 'London'] },
      });
      await state.em.flush();
      const teamFast = await insertTeam('Fast Team', 'token-fast');
      const teamSlow = await insertTeam('Slow Team', 'token-slow');
      await state.answerService.submit(
        state.session.id,
        mcQuestion.id,
        teamFast.id,
        'Paris',
      );
      await state.answerService.submit(
        state.session.id,
        mcQuestion.id,
        teamSlow.id,
        'Paris',
      );

      const questionTimerSeconds = 10;
      const questionOpenedAt = Date.now() - questionTimerSeconds * 1000;
      const lockedAt = Date.now();
      await setAnsweredAt(mcQuestion.id, teamFast.id, questionOpenedAt);
      await setAnsweredAt(mcQuestion.id, teamSlow.id, lockedAt);

      const multipliers = await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        mcQuestion.id,
        questionOpenedAt,
        questionTimerSeconds,
        mcQuestion.type,
        mcQuestion.answer,
        mcQuestion.points,
      );

      const answers = await state.answerService.listForQuestion(
        state.session.id,
        mcQuestion.id,
      );
      expect(answers.find((a) => a.teamId === teamFast.id)?.pointsAwarded).toBe(
        10,
      );
      expect(answers.find((a) => a.teamId === teamSlow.id)?.pointsAwarded).toBe(
        5,
      );
      const answerIdOf = (teamId: number) =>
        answers.find((a) => a.teamId === teamId)!.answerId;
      expect(multipliers).toEqual({
        [answerIdOf(teamFast.id)]: 1,
        [answerIdOf(teamSlow.id)]: 0.5,
      });
    });

    it('returns a speed multiplier for a wrong answer too, so a later regrade can scale it', async () => {
      const mcQuestion = state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'London',
        points: 10,
        payload: { options: ['Paris', 'London'] },
      });
      await state.em.flush();
      const team = await insertTeam('Fast Team', 'token-fast');
      const submitted = await state.answerService.submit(
        state.session.id,
        mcQuestion.id,
        team.id,
        'Paris',
      );
      const questionTimerSeconds = 10;
      const questionOpenedAt = Date.now() - questionTimerSeconds * 1000;
      await setAnsweredAt(mcQuestion.id, team.id, questionOpenedAt);

      const multipliers = await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        mcQuestion.id,
        questionOpenedAt,
        questionTimerSeconds,
        mcQuestion.type,
        mcQuestion.answer,
        mcQuestion.points,
      );
      await state.answerService.regradeAutoGraded(
        state.session.id,
        mcQuestion.id,
        'multiple_choice',
        'Paris',
        10,
        multipliers,
      );

      expect(multipliers).toEqual({ [submitted.answerId]: 1 });
      const [answer] = await state.answerService.listForQuestion(
        state.session.id,
        mcQuestion.id,
      );
      expect(answer.pointsAwarded).toBe(10);
    });

    it('scores against the answer key it is given, so a correction made before lock counts', async () => {
      const mcQuestion = state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'London',
        points: 10,
        payload: { options: ['Paris', 'London'] },
      });
      await state.em.flush();
      const team = await insertTeam('Fast Team', 'token-fast');
      await state.answerService.submit(
        state.session.id,
        mcQuestion.id,
        team.id,
        'Paris',
      );
      const questionTimerSeconds = 10;
      const questionOpenedAt = Date.now() - questionTimerSeconds * 1000;
      await setAnsweredAt(mcQuestion.id, team.id, questionOpenedAt);

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        mcQuestion.id,
        questionOpenedAt,
        questionTimerSeconds,
        'multiple_choice',
        'Paris',
        10,
      );

      const [answer] = await state.answerService.listForQuestion(
        state.session.id,
        mcQuestion.id,
      );
      expect(answer.pointsAwarded).toBe(10);
    });

    it('leaves points untouched when no question timer is configured (unlimited)', async () => {
      const mcQuestion = state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 10,
        payload: { options: ['Paris', 'London'] },
      });
      await state.em.flush();
      const teamSlow = await insertTeam('Slow Team', 'token-slow');
      await state.answerService.submit(
        state.session.id,
        mcQuestion.id,
        teamSlow.id,
        'Paris',
      );

      const questionOpenedAt = Date.now() - 10_000;
      await setAnsweredAt(mcQuestion.id, teamSlow.id, Date.now());

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        mcQuestion.id,
        questionOpenedAt,
        null,
        mcQuestion.type,
        mcQuestion.answer,
        mcQuestion.points,
      );

      const [answer] = await state.answerService.listForQuestion(
        state.session.id,
        mcQuestion.id,
      );
      expect(answer.pointsAwarded).toBe(10);
    });

    it('leaves an already-wrong answer at zero regardless of speed', async () => {
      const mcQuestion = state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 10,
        payload: { options: ['Paris', 'London'] },
      });
      await state.em.flush();
      const teamWrong = await insertTeam('Wrong Team', 'token-wrong');
      await state.answerService.submit(
        state.session.id,
        mcQuestion.id,
        teamWrong.id,
        'London',
      );

      const questionTimerSeconds = 10;
      const questionOpenedAt = Date.now() - questionTimerSeconds * 1000;
      await setAnsweredAt(mcQuestion.id, teamWrong.id, questionOpenedAt);

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        mcQuestion.id,
        questionOpenedAt,
        questionTimerSeconds,
        mcQuestion.type,
        mcQuestion.answer,
        mcQuestion.points,
      );

      const [answer] = await state.answerService.listForQuestion(
        state.session.id,
        mcQuestion.id,
      );
      expect(answer.pointsAwarded).toBe(0);
    });

    it('scales a partially correct match answer from its pre-speed-scaling partial credit, not full points', async () => {
      const matchQuestion = state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'match',
        prompt: 'Match the hero to their weapon.',
        answer: 'excalibur|shield|web|hammer',
        points: 4,
        payload: {
          options: ['arthur', 'captain america', 'spiderman', 'thor'],
          matchTargets: ['shield', 'excalibur', 'web', 'hammer'],
        },
      });
      await state.em.flush();
      const team = await insertTeam('The Quizzards', 'token-1');
      await state.answerService.submit(
        state.session.id,
        matchQuestion.id,
        team.id,
        'excalibur|shield|excalibur|excalibur',
      );

      const questionTimerSeconds = 10;
      const questionOpenedAt = Date.now() - questionTimerSeconds * 1000;
      const lockedAt = Date.now();
      await setAnsweredAt(matchQuestion.id, team.id, lockedAt);

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        matchQuestion.id,
        questionOpenedAt,
        questionTimerSeconds,
        matchQuestion.type,
        matchQuestion.answer,
        matchQuestion.points,
      );

      const [answer] = await state.answerService.listForQuestion(
        state.session.id,
        matchQuestion.id,
      );
      expect(answer.pointsAwarded).toBe(1);
    });
  });
});
