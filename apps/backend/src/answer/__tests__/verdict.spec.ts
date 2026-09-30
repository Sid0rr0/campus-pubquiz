import type { Verdict } from '@campus-pubquiz/types';
import { Question } from '@/db/entities/question.entity';
import { setupAnswerServiceTest } from '@/answer/__tests__/answer-service-test-utils';

describe('AnswerService (Postgres integration) - stored verdict', () => {
  const { state, insertTeam } = setupAnswerServiceTest();

  async function createQuestion(
    type: Question['type'],
    answer: string,
    points: number,
    payload: Record<string, unknown> = {},
  ): Promise<Question> {
    const question = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type,
      prompt: 'Question?',
      answer,
      points,
      payload,
    });
    await state.em.flush();
    return question;
  }

  async function verdictsByTeam(
    questionId: number,
  ): Promise<Record<number, Verdict | null>> {
    const answers = await state.answerService.listForQuestion(
      state.session.id,
      questionId,
    );
    return Object.fromEntries(answers.map((a) => [a.teamId, a.verdict]));
  }

  it('stores correct/incorrect at submit and returns it on the acknowledgement', async () => {
    const question = await createQuestion('multiple_choice', 'Paris', 10, {
      options: ['Paris', 'London'],
    });
    const right = await insertTeam('Right', 'token-right');
    const wrong = await insertTeam('Wrong', 'token-wrong');

    const ack = await state.answerService.submit(
      state.session.id,
      question.id,
      right.id,
      'Paris',
    );
    await state.answerService.submit(
      state.session.id,
      question.id,
      wrong.id,
      'London',
    );

    expect(ack.verdict).toBe('correct');
    expect(await verdictsByTeam(question.id)).toEqual({
      [right.id]: 'correct',
      [wrong.id]: 'incorrect',
    });
  });

  it('stores partial for a match answer with some pairs right', async () => {
    const question = await createQuestion('match', 'a|b|c|d', 8, {
      options: ['1', '2', '3', '4'],
      matchTargets: ['a', 'b', 'c', 'd'],
    });
    const team = await insertTeam('Team', 'token-1');

    await state.answerService.submit(
      state.session.id,
      question.id,
      team.id,
      'a|b|x|x',
    );

    expect(await verdictsByTeam(question.id)).toEqual({ [team.id]: 'partial' });
  });

  it('leaves a human-graded answer without a verdict until graded, and resets it when the value changes', async () => {
    const question = await createQuestion('audio', 'Queen', 2);
    const team = await insertTeam('Team', 'token-1');
    const ack = await state.answerService.submit(
      state.session.id,
      question.id,
      team.id,
      'Queen',
    );
    expect(ack.verdict).toBeNull();

    await state.answerService.grade(state.session.id, ack.answerId, 2);
    expect(await verdictsByTeam(question.id)).toEqual({ [team.id]: 'correct' });

    await state.answerService.submit(
      state.session.id,
      question.id,
      team.id,
      'Bowie',
    );
    expect(await verdictsByTeam(question.id)).toEqual({ [team.id]: null });
  });

  it.each([
    [2, 'correct'],
    [3, 'correct'],
    [1, 'partial'],
    [0, 'incorrect'],
  ] as const)(
    'stores the manual grade of %i of 2 points as %s',
    async (points, verdict) => {
      const question = await createQuestion('audio', 'Queen', 2);
      const team = await insertTeam('Team', 'token-1');
      const ack = await state.answerService.submit(
        state.session.id,
        question.id,
        team.id,
        'Queen',
      );

      await state.answerService.grade(state.session.id, ack.answerId, points);

      expect(await verdictsByTeam(question.id)).toEqual({ [team.id]: verdict });
    },
  );

  it('updates the verdict when the admin overrides an auto-graded answer', async () => {
    const question = await createQuestion('free_text', 'Paris', 4);
    const team = await insertTeam('Team', 'token-1');
    const ack = await state.answerService.submit(
      state.session.id,
      question.id,
      team.id,
      'Parris',
    );
    expect(ack.verdict).toBe('incorrect');

    await state.answerService.grade(state.session.id, ack.answerId, 4);

    expect(await verdictsByTeam(question.id)).toEqual({ [team.id]: 'correct' });
  });

  it('stores correct for a speed-scaled kahoot answer that earned fewer than full points', async () => {
    const question = await createQuestion('multiple_choice', 'Paris', 10, {
      options: ['Paris', 'London'],
    });
    const team = await insertTeam('Slow', 'token-slow');
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
      10,
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      question.id,
    );
    expect(answer.pointsAwarded).toBe(5);
    expect(answer.verdict).toBe('correct');
  });

  it('re-derives the verdict when an answer key is corrected', async () => {
    const question = await createQuestion('multiple_choice', 'London', 10, {
      options: ['Paris', 'London'],
    });
    const team = await insertTeam('Team', 'token-1');
    await state.answerService.submit(
      state.session.id,
      question.id,
      team.id,
      'Paris',
    );
    expect(await verdictsByTeam(question.id)).toEqual({
      [team.id]: 'incorrect',
    });

    await state.answerService.regradeAutoGraded(state.session.id, {
      id: question.id,
      type: 'multiple_choice',
      answer: 'Paris',
      points: 10,
    });

    expect(await verdictsByTeam(question.id)).toEqual({ [team.id]: 'correct' });
  });

  it('stores the closest_guess batch verdicts and returns them', async () => {
    const question = await createQuestion('closest_guess', '100', 6);
    const near = await insertTeam('Near', 'token-near');
    const far = await insertTeam('Far', 'token-far');
    await state.answerService.submit(
      state.session.id,
      question.id,
      near.id,
      '99',
    );
    await state.answerService.submit(
      state.session.id,
      question.id,
      far.id,
      '10',
    );

    const graded = await state.answerService.gradeClosestGuess(
      state.session.id,
      question,
    );

    expect(graded.map((a) => [a.teamName, a.verdict])).toEqual([
      ['Far', 'incorrect'],
      ['Near', 'correct'],
    ]);
    expect(await verdictsByTeam(question.id)).toEqual({
      [near.id]: 'correct',
      [far.id]: 'incorrect',
    });
  });

  it('includes the verdict in the per-team answer sync', async () => {
    const question = await createQuestion('multiple_choice', 'Paris', 10, {
      options: ['Paris', 'London'],
    });
    const team = await insertTeam('Team', 'token-1');
    await state.answerService.submit(
      state.session.id,
      question.id,
      team.id,
      'Paris',
    );

    const synced = await state.answerService.listForTeam(
      state.session.id,
      team.id,
    );

    expect(synced.map((a) => a.verdict)).toEqual(['correct']);
  });
});
