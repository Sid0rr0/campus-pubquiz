import { Question } from '@/db/entities/question.entity';
import { AnswerLockedError } from '@/answer/answer.service';
import {
  gradable,
  regradeMatchOrHuman,
  setupAnswerServiceTest,
} from '@/answer/__tests__/answer-service-test-utils';

describe('AnswerService (Postgres integration) - Clue question answers', () => {
  const { state, insertTeam } = setupAnswerServiceTest();

  async function clueQuestion(): Promise<Question> {
    const question = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'clues',
      prompt: 'Who am I?',
      answer: 'Marie Curie',
      points: 2.5,
      payload: { options: ['a', 'b', 'c', 'd', 'e'] },
    });
    await state.em.flush();
    return question;
  }

  async function answerOf(question: Question) {
    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      question.id,
    );
    return answer;
  }

  it('records the highest clue shown and grades an exact match at that clue value', async () => {
    const question = await clueQuestion();
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      gradable(question),
      team.id,
      'marie curie',
      null,
      2,
    );

    const answer = await answerOf(question);
    expect(answer).toMatchObject({
      clue: 2,
      pointsAwarded: 2,
      verdict: 'correct',
    });
  });

  it('leaves a non-matching answer for the quiz master', async () => {
    const question = await clueQuestion();
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      gradable(question),
      team.id,
      'Curie',
      null,
      3,
    );

    expect(await answerOf(question)).toMatchObject({
      clue: 3,
      gradingState: 'ungraded',
    });
  });

  it('refuses a changed answer once a newer clue is shown', async () => {
    const question = await clueQuestion();
    const team = await insertTeam('The Quizzards', 'token-1');
    const submit = (value: string, clue: number) =>
      state.answerService.submit(
        state.session.id,
        gradable(question),
        team.id,
        value,
        null,
        clue,
      );
    await submit('Curie', 1);

    await expect(submit('Marie Curie', 2)).rejects.toThrow(AnswerLockedError);

    expect(await answerOf(question)).toMatchObject({
      value: 'Curie',
      clue: 1,
    });
  });

  it('reports the worth from the clue count, not from the stored points', async () => {
    const question = await clueQuestion();
    question.points = 9;
    await state.em.flush();
    const team = await insertTeam('The Quizzards', 'token-1');

    const submitted = await state.answerService.submit(
      state.session.id,
      gradable(question),
      team.id,
      'Curie',
      null,
      3,
    );

    expect(submitted.clueValue).toBe(1.5);
    expect(await answerOf(question)).toMatchObject({ clue: 3, clueValue: 1.5 });
    const [mine] = await state.answerService.listForTeam(
      state.session.id,
      team.id,
    );
    expect(mine).toMatchObject({ clue: 3, clueValue: 1.5 });
  });

  it('takes any hand-graded amount, judging it against the answer clue value', async () => {
    const question = await clueQuestion();
    const team = await insertTeam('The Quizzards', 'token-1');
    const { answerId } = await state.answerService.submit(
      state.session.id,
      gradable(question),
      team.id,
      'Curie',
      null,
      2,
    );
    const grade = (points: number) =>
      state.answerService.grade(
        state.session.id,
        answerId,
        gradable(question),
        points,
      );

    await grade(1);
    expect(await answerOf(question)).toMatchObject({
      pointsAwarded: 1,
      verdict: 'partial',
    });

    await grade(2);
    expect(await answerOf(question)).toMatchObject({
      pointsAwarded: 2,
      verdict: 'correct',
    });
  });

  it('re-scores each answer at its own clue value on a key fix and keeps a hand grade', async () => {
    const question = await clueQuestion();
    const early = await insertTeam('Early', 'token-1');
    const late = await insertTeam('Late', 'token-2');
    const stubborn = await insertTeam('Stubborn', 'token-3');
    const submit = (teamId: number, value: string, clue: number) =>
      state.answerService.submit(
        state.session.id,
        gradable(question),
        teamId,
        value,
        null,
        clue,
      );
    await submit(early.id, 'Curie', 1);
    await submit(late.id, 'Curie', 4);
    const { answerId } = await submit(stubborn.id, 'Nope', 2);
    await state.answerService.grade(
      state.session.id,
      answerId,
      gradable(question),
      2,
    );
    const previous = gradable(question);

    await regradeMatchOrHuman(
      state.answerService,
      state.session.id,
      { ...gradable(question), answer: 'Curie' },
      previous,
    );

    const points = Object.fromEntries(
      (
        await state.answerService.listForQuestion(state.session.id, question.id)
      ).map((answer) => [answer.teamName, answer.pointsAwarded]),
    );
    expect(points).toEqual({ Early: 2.5, Late: 1, Stubborn: 2 });
  });
});
