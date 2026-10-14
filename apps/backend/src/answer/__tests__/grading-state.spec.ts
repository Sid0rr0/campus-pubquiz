import { Question } from '@/db/entities/question.entity';
import {
  gradable,
  regradeMatchOrHuman,
  setupAnswerServiceTest,
} from '@/answer/__tests__/answer-service-test-utils';

describe('AnswerService (Postgres integration) - grading state of the answer list', () => {
  const { state, insertTeam } = setupAnswerServiceTest();

  async function listStates(questionId: number) {
    const answers = await state.answerService.listForQuestion(
      state.session.id,
      questionId,
    );
    return answers.map((answer) => [answer.teamName, answer.gradingState]);
  }

  async function createQuestion(
    type: 'closest_guess' | 'multiple_choice',
    orderIndex: number,
  ) {
    const question =
      type === 'closest_guess'
        ? state.em.create(Question, {
            round: state.round,
            orderIndex,
            type,
            prompt: 'How many?',
            answer: '1000',
            points: 4,
          })
        : state.em.create(Question, {
            round: state.round,
            orderIndex,
            type,
            prompt: 'Capital of France?',
            answer: 'Paris',
            points: 2,
            payload: { options: ['Paris', 'London'] },
          });
    await state.em.flush();
    return question;
  }

  it('lists a closest_guess answer as awaiting its batch until the batch ran, then graded, never ungraded', async () => {
    const question = await createQuestion('closest_guess', 1);
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    await state.answerService.submit(
      state.session.id,
      gradable(question),
      teamA.id,
      '990',
    );
    await state.answerService.submit(
      state.session.id,
      gradable(question),
      teamB.id,
      '1200',
    );

    expect(await listStates(question.id)).toEqual([
      ['Team A', 'awaiting_batch'],
      ['Team B', 'awaiting_batch'],
    ]);

    const atLock = await state.answerService.gradeAtLock(
      state.session.id,
      question,
    );

    expect(atLock.map((answer) => answer.gradingState)).toEqual([
      'graded',
      'graded',
    ]);
    expect(await listStates(question.id)).toEqual([
      ['Team A', 'graded'],
      ['Team B', 'graded'],
    ]);
  });

  it('lists an auto-graded answer as graded the moment it is submitted', async () => {
    const question = await createQuestion('multiple_choice', 1);
    const team = await insertTeam('Team A', 'token-a');
    await state.answerService.submit(
      state.session.id,
      gradable(question),
      team.id,
      'London',
    );

    expect(await listStates(question.id)).toEqual([['Team A', 'graded']]);
  });

  it('lists a missed free_text answer as ungraded, then graded once the quiz master grades it', async () => {
    const team = await insertTeam('Team A', 'token-a');
    const submitted = await state.answerService.submit(
      state.session.id,
      gradable(state.question),
      team.id,
      'Pear',
    );

    expect(await listStates(state.question.id)).toEqual([
      ['Team A', 'ungraded'],
    ]);

    await state.answerService.grade(
      state.session.id,
      submitted.answerId,
      gradable(state.question),
      1,
    );

    expect(await listStates(state.question.id)).toEqual([['Team A', 'graded']]);
  });

  it('returns an automatically graded free_text answer to ungraded when a key fix no longer matches it', async () => {
    const team = await insertTeam('Team A', 'token-a');
    await state.answerService.submit(
      state.session.id,
      gradable(state.question),
      team.id,
      'Apple',
    );
    expect(await listStates(state.question.id)).toEqual([['Team A', 'graded']]);

    const previous = gradable(state.question);
    const { answers } = await state.answerService.regradeForKeyFix(
      state.session.id,
      { ...previous, answer: 'Pear' },
      previous,
      null,
      false,
    );

    expect(answers.map((answer) => answer.gradingState)).toEqual(['ungraded']);
    expect(await listStates(state.question.id)).toEqual([
      ['Team A', 'ungraded'],
    ]);
  });

  it('keeps a hand grade graded through a key fix that does not touch it', async () => {
    const team = await insertTeam('Team A', 'token-a');
    const submitted = await state.answerService.submit(
      state.session.id,
      gradable(state.question),
      team.id,
      'Pear',
    );
    await state.answerService.grade(
      state.session.id,
      submitted.answerId,
      gradable(state.question),
      1,
    );
    const previous = gradable(state.question);

    await regradeMatchOrHuman(
      state.answerService,
      state.session.id,
      { ...previous, answer: 'Plum' },
      previous,
    );

    expect(await listStates(state.question.id)).toEqual([['Team A', 'graded']]);
  });
});
