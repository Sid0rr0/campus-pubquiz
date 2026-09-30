import { Answer } from '@/db/entities/answer.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Team } from '@/db/entities/team.entity';
import { AnswerService } from '@/answer/answer.service';
import type { AnswerRepository } from '@/db/repositories/answer.repository';
import type { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import type { QuestionRepository } from '@/db/repositories/question.repository';
import type { TeamRepository } from '@/db/repositories/team.repository';
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
    expect(answer.gradedAt).not.toBeNull();
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

  it('resets points and gradedAt when a team changes an already-graded audio answer', async () => {
    const audioQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'audio',
      prompt: 'Name that tune',
      answer: 'Reference answer',
      points: 1,
    });
    await state.em.flush();
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await state.answerService.submit(
      state.session.id,
      audioQuestion.id,
      team.id,
      'Banana',
    );
    await state.answerService.grade(state.session.id, submitted.answerId, 1);

    await state.answerService.submit(
      state.session.id,
      audioQuestion.id,
      team.id,
      'Mango',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      audioQuestion.id,
    );
    expect(answer.value).toBe('Mango');
    expect(answer.pointsAwarded).toBe(0);
    expect(answer.gradedAt).toBeNull();
  });

  it('keeps an already-graded audio answer intact when resubmitted with the same value', async () => {
    const audioQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'audio',
      prompt: 'Name that tune',
      answer: 'Reference answer',
      points: 1,
    });
    await state.em.flush();
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await state.answerService.submit(
      state.session.id,
      audioQuestion.id,
      team.id,
      'Banana',
    );
    await state.answerService.grade(state.session.id, submitted.answerId, 1);

    await state.answerService.submit(
      state.session.id,
      audioQuestion.id,
      team.id,
      'Banana',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      audioQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(1);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('re-grades a free_text answer against the answer key on every resubmission, discarding a manual override', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const submitted = await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );
    await state.answerService.grade(state.session.id, submitted.answerId, 1);

    // Resubmitting (even the same wrong value) re-runs auto-grading against
    // the answer key, same as multiple_choice/sort/match — it does not
    // preserve the admin's manual override, unlike the human-graded types
    // above.
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
    expect(answer.pointsAwarded).toBe(0);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('re-grades (rather than resets) a free_text answer when the team changes it after manual grading', async () => {
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
      'Apple',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answer.value).toBe('Apple');
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
      guessQuestion,
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
      guessQuestion,
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
      guessQuestion,
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
      guessQuestion,
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
      guessQuestion,
    );
    const second = await state.answerService.gradeClosestGuess(
      state.session.id,
      guessQuestion,
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

      await state.answerService.regradeAutoGraded(state.session.id, {
        id: mcQuestion.id,
        type: 'multiple_choice',
        answer: 'Paris',
        points: 2,
      });

      const answers = await state.answerService.listForQuestion(
        state.session.id,
        mcQuestion.id,
      );
      expect(answers.find((a) => a.teamId === teamA.id)?.pointsAwarded).toBe(2);
      expect(answers.find((a) => a.teamId === teamB.id)?.pointsAwarded).toBe(0);
      expect(answers.every((a) => a.gradedAt !== null)).toBe(true);
    });

    it('re-scores every free_text answer case-insensitively against a corrected answer key', async () => {
      const teamA = await insertTeam('Team A', 'token-a');
      const teamB = await insertTeam('Team B', 'token-b');
      await state.answerService.submit(
        state.session.id,
        state.question.id,
        teamA.id,
        'pear',
      );
      await state.answerService.submit(
        state.session.id,
        state.question.id,
        teamB.id,
        'APPLE',
      );

      await state.answerService.regradeAutoGraded(state.session.id, {
        id: state.question.id,
        type: 'free_text',
        answer: 'Pear',
        points: 1,
      });

      const answers = await state.answerService.listForQuestion(
        state.session.id,
        state.question.id,
      );
      expect(answers.find((a) => a.teamId === teamA.id)?.pointsAwarded).toBe(1);
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

      await state.answerService.regradeAutoGraded(state.session.id, {
        id: matchQuestion.id,
        type: 'match',
        answer: 'excalibur|shield',
        points: 6,
      });

      const [answer] = await state.answerService.listForQuestion(
        state.session.id,
        matchQuestion.id,
      );
      expect(answer.pointsAwarded).toBe(3);
    });

    it('re-scores a match answer under all_or_nothing scoring when the answer key is corrected', async () => {
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
          matchScoringMode: 'all_or_nothing',
        },
      });
      await state.em.flush();
      const team = await insertTeam('Team A', 'token-a');
      // Submitted against the original key: 3 of 4 correct (hammer wrong).
      await state.answerService.submit(
        state.session.id,
        matchQuestion.id,
        team.id,
        'excalibur|shield|web|web',
      );

      // Corrected key makes the submission fully correct.
      await state.answerService.regradeAutoGraded(state.session.id, {
        id: matchQuestion.id,
        type: 'match',
        answer: 'excalibur|shield|web|web',
        points: 4,
        matchScoringMode: 'all_or_nothing',
      });

      const [answer] = await state.answerService.listForQuestion(
        state.session.id,
        matchQuestion.id,
      );
      expect(answer.pointsAwarded).toBe(4);
    });
  });

  describe('kahoot speed scoring (from stored response time)', () => {
    const TIMER_SECONDS = 10;

    async function createQuestion(
      overrides: Partial<{
        type: 'multiple_choice' | 'match';
        answer: string;
        points: number;
        payload: Record<string, unknown>;
      }> = {},
    ): Promise<Question> {
      const question = state.em.create(Question, {
        round: state.round,
        orderIndex: 1,
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 10,
        payload: { options: ['Paris', 'London'] },
        ...overrides,
      });
      await state.em.flush();
      return question;
    }

    async function pointsByTeam(
      questionId: number,
    ): Promise<Record<number, number>> {
      const answers = await state.answerService.listForQuestion(
        state.session.id,
        questionId,
      );
      return Object.fromEntries(
        answers.map((a) => [a.teamId, a.pointsAwarded]),
      );
    }

    it('gives full points to an instant answer and the 50% floor to one right at the timer', async () => {
      const question = await createQuestion();
      const fast = await insertTeam('Fast Team', 'token-fast');
      const slow = await insertTeam('Slow Team', 'token-slow');
      await state.answerService.submit(
        state.session.id,
        question.id,
        fast.id,
        'Paris',
        0,
      );
      await state.answerService.submit(
        state.session.id,
        question.id,
        slow.id,
        'Paris',
        TIMER_SECONDS * 1000,
      );

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        question,
        TIMER_SECONDS,
      );

      expect(await pointsByTeam(question.id)).toEqual({
        [fast.id]: 10,
        [slow.id]: 5,
      });
    });

    it('stores the speed-scaled points and leaves the answers graded', async () => {
      const question = await createQuestion();
      const team = await insertTeam('Mid Team', 'token-mid');
      await state.answerService.submit(
        state.session.id,
        question.id,
        team.id,
        'Paris',
        5_000,
      );

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        question,
        TIMER_SECONDS,
      );

      const [answer] = await state.answerService.listForQuestion(
        state.session.id,
        question.id,
      );
      expect(answer.pointsAwarded).toBe(8);
      expect(answer.gradedAt).not.toBeNull();
    });

    it('times a team that resubmits before lock from its last submission', async () => {
      const question = await createQuestion();
      const team = await insertTeam('Reviser', 'token-rev');
      await state.answerService.submit(
        state.session.id,
        question.id,
        team.id,
        'London',
        500,
      );
      await state.answerService.submit(
        state.session.id,
        question.id,
        team.id,
        'Paris',
        10_000,
      );

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        question,
        TIMER_SECONDS,
      );

      expect(await pointsByTeam(question.id)).toEqual({ [team.id]: 5 });
    });

    it('scores against the answer key it is given, so a correction made before lock counts', async () => {
      const question = await createQuestion({ answer: 'London' });
      const team = await insertTeam('Fast Team', 'token-fast');
      await state.answerService.submit(
        state.session.id,
        question.id,
        team.id,
        'Paris',
        0,
      );

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        {
          id: question.id,
          type: 'multiple_choice',
          answer: 'Paris',
          points: 10,
        },
        TIMER_SECONDS,
      );

      expect(await pointsByTeam(question.id)).toEqual({ [team.id]: 10 });
    });

    it('keeps full points when no question timer is configured (unlimited)', async () => {
      const question = await createQuestion();
      const slow = await insertTeam('Slow Team', 'token-slow');
      await state.answerService.submit(
        state.session.id,
        question.id,
        slow.id,
        'Paris',
        9_000,
      );

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        question,
        null,
      );

      expect(await pointsByTeam(question.id)).toEqual({ [slow.id]: 10 });
    });

    it('applies no scaling to an answer with no stored response time', async () => {
      const question = await createQuestion();
      const legacy = await insertTeam('Legacy Team', 'token-legacy');
      await state.answerService.submit(
        state.session.id,
        question.id,
        legacy.id,
        'Paris',
        null,
      );

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        question,
        TIMER_SECONDS,
      );

      expect(await pointsByTeam(question.id)).toEqual({ [legacy.id]: 10 });
    });

    it('leaves a wrong answer at zero regardless of speed', async () => {
      const question = await createQuestion();
      const wrong = await insertTeam('Wrong Team', 'token-wrong');
      await state.answerService.submit(
        state.session.id,
        question.id,
        wrong.id,
        'London',
        0,
      );

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        question,
        TIMER_SECONDS,
      );

      expect(await pointsByTeam(question.id)).toEqual({ [wrong.id]: 0 });
    });

    it('scales a partially correct match answer from its pre-speed-scaling partial credit, not full points', async () => {
      const question = await createQuestion({
        type: 'match',
        answer: 'excalibur|shield|web|hammer',
        points: 4,
        payload: {
          options: ['arthur', 'captain america', 'spiderman', 'thor'],
          matchTargets: ['shield', 'excalibur', 'web', 'hammer'],
        },
      });
      const team = await insertTeam('The Quizzards', 'token-1');
      await state.answerService.submit(
        state.session.id,
        question.id,
        team.id,
        'excalibur|shield|excalibur|excalibur',
        TIMER_SECONDS * 1000,
      );

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        question,
        TIMER_SECONDS,
      );

      // Two of four pairs right -> base 2, at the timer -> 50% floor -> 1.
      expect(await pointsByTeam(question.id)).toEqual({ [team.id]: 1 });
    });

    it('scales an all_or_nothing match answer from its pre-speed-scaling half credit, not full points', async () => {
      const question = await createQuestion({
        type: 'match',
        answer: 'excalibur|shield|web|hammer',
        points: 4,
        payload: {
          options: ['arthur', 'captain america', 'spiderman', 'thor'],
          matchTargets: ['shield', 'excalibur', 'web', 'hammer'],
          matchScoringMode: 'all_or_nothing',
        },
      });
      const team = await insertTeam('The Quizzards', 'token-1');
      // Exactly one pair wrong (hammer) -> 2 points base (round(4 / 2)).
      await state.answerService.submit(
        state.session.id,
        question.id,
        team.id,
        'excalibur|shield|web|web',
        TIMER_SECONDS * 1000,
      );

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        {
          id: question.id,
          type: 'match',
          answer: question.answer,
          points: question.points,
          matchScoringMode: 'all_or_nothing',
        },
        TIMER_SECONDS,
      );

      // Base 2, at the timer -> 50% floor -> round(2 * 0.5) = 1.
      expect(await pointsByTeam(question.id)).toEqual({ [team.id]: 1 });
    });

    it('re-scales after an answer-key correction to the same points with or without a restart', async () => {
      const question = await createQuestion({ answer: 'London' });
      const fast = await insertTeam('Fast Team', 'token-fast');
      const slow = await insertTeam('Slow Team', 'token-slow');
      await state.answerService.submit(
        state.session.id,
        question.id,
        fast.id,
        'Paris',
        0,
      );
      await state.answerService.submit(
        state.session.id,
        question.id,
        slow.id,
        'Paris',
        7_000,
      );
      const corrected = {
        id: question.id,
        type: 'multiple_choice' as const,
        answer: 'Paris',
        points: 10,
      };

      await state.answerService.applyKahootSpeedScoring(
        state.session.id,
        corrected,
        TIMER_SECONDS,
      );
      const withoutRestart = await pointsByTeam(question.id);

      // A restart drops everything in memory: a fresh service on a fresh
      // entity manager sees only what Postgres stored.
      const freshEm = state.em.fork();
      const freshService = new AnswerService(
        freshEm.getRepository<Answer, AnswerRepository>(Answer),
        freshEm.getRepository<Team, TeamRepository>(Team),
        freshEm.getRepository<GameSessionTeam, GameSessionTeamRepository>(
          GameSessionTeam,
        ),
        freshEm.getRepository<Question, QuestionRepository>(Question),
      );
      await freshService.regradeAutoGraded(
        state.session.id,
        corrected,
        TIMER_SECONDS,
      );
      const afterRestart = Object.fromEntries(
        (await freshService.listForQuestion(state.session.id, question.id)).map(
          (a) => [a.teamId, a.pointsAwarded],
        ),
      );

      expect(withoutRestart).toEqual({ [fast.id]: 10, [slow.id]: 7 });
      expect(afterRestart).toEqual(withoutRestart);
    });

    it('regrades a kahoot question that was never speed-scored, scaling by stored response time', async () => {
      const question = await createQuestion({ answer: 'London' });
      const team = await insertTeam('Team', 'token-1');
      await state.answerService.submit(
        state.session.id,
        question.id,
        team.id,
        'Paris',
        TIMER_SECONDS * 1000,
      );

      await state.answerService.regradeAutoGraded(
        state.session.id,
        {
          id: question.id,
          type: 'multiple_choice',
          answer: 'Paris',
          points: 10,
        },
        TIMER_SECONDS,
      );

      expect(await pointsByTeam(question.id)).toEqual({ [team.id]: 5 });
    });
  });
});
