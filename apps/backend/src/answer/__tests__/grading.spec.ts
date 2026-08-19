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
});
