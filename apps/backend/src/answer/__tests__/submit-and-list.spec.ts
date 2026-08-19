import { Question } from '@/db/entities/question.entity';
import { setupAnswerServiceTest } from '@/answer/__tests__/answer-service-test-utils';

describe('AnswerService (Postgres integration) - submit and list', () => {
  const { state, insertTeam } = setupAnswerServiceTest();

  it('creates a new ungraded answer for a team', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

    const result = await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );

    expect(result.teamId).toBe(team.id);
    expect(result.teamName).toBe('The Quizzards');
    expect(result.value).toBe('Banana');
  });

  it('overwrites the previous answer for the same team and question (last-write-wins)', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );
    await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Apple',
    );

    const answers = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answers).toHaveLength(1);
    expect(answers[0].value).toBe('Apple');
  });

  it('does not disturb another team answering the same question', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    await state.answerService.submit(
      state.session.id,
      state.question.id,
      teamA.id,
      'Banana',
    );
    await state.answerService.submit(
      state.session.id,
      state.question.id,
      teamB.id,
      'Mango',
    );

    const answers = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answers).toHaveLength(2);
    expect(answers.find((a) => a.teamId === teamA.id)?.value).toBe('Banana');
    expect(answers.find((a) => a.teamId === teamB.id)?.value).toBe('Mango');
  });

  it('lists a team own answers keyed by question so a reconnect can restore them', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
    const other = await insertTeam('Team B', 'token-b');
    const question2 = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'free_text',
      prompt: 'Name a vegetable',
      answer: 'Carrot',
      points: 1,
    });
    await state.em.flush();

    await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'Banana',
    );
    await state.answerService.submit(
      state.session.id,
      question2.id,
      team.id,
      'Carrot',
    );
    await state.answerService.submit(
      state.session.id,
      state.question.id,
      other.id,
      'Apple',
    );

    const answers = await state.answerService.listForTeam(
      state.session.id,
      team.id,
    );

    expect(answers).toHaveLength(2);
    expect(answers).toEqual(
      expect.arrayContaining([
        { questionId: state.question.id, value: 'Banana' },
        { questionId: question2.id, value: 'Carrot' },
      ]),
    );
  });

  it('returns an empty list for a team that has not answered anything', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

    const answers = await state.answerService.listForTeam(
      state.session.id,
      team.id,
    );

    expect(answers).toEqual([]);
  });

  it('lists answers with zero points and a null gradedAt before grading', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');
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
    expect(answer.gradedAt).toBeNull();
  });
});
