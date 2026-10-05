import { Question } from '@/db/entities/question.entity';
import { setupAnswerServiceTest } from '@/answer/__tests__/answer-service-test-utils';

describe('AnswerService (Postgres integration) - auto-grading on submit', () => {
  const { state, insertTeam } = setupAnswerServiceTest();

  it('auto-grades a correct multiple choice answer on submit, awarding full points', async () => {
    const mcQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'multiple_choice',
      prompt: 'Capital of France?',
      answer: 'Paris',
      points: 2,
    });
    await state.em.flush();
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      mcQuestion.id,
      team.id,
      'Paris',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      mcQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(2);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('auto-grades an incorrect multiple choice answer on submit as zero points', async () => {
    const mcQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'multiple_choice',
      prompt: 'Capital of France?',
      answer: 'Paris',
      points: 2,
    });
    await state.em.flush();
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      mcQuestion.id,
      team.id,
      'London',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      mcQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(0);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('re-grades a multiple choice answer when the team changes their pick before locking', async () => {
    const mcQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'multiple_choice',
      prompt: 'Capital of France?',
      answer: 'Paris',
      points: 2,
    });
    await state.em.flush();
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      mcQuestion.id,
      team.id,
      'London',
    );
    await state.answerService.submit(
      state.session.id,
      mcQuestion.id,
      team.id,
      'Paris',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      mcQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(2);
  });

  it('auto-grades a correct sort answer on submit, awarding full points', async () => {
    const sortQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'sort',
      prompt: 'Order these planets from the sun outward.',
      answer: 'Mercury|Venus|Earth',
      points: 3,
      payload: { options: ['Venus', 'Mercury', 'Earth'] },
    });
    await state.em.flush();
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      sortQuestion.id,
      team.id,
      'Mercury|Venus|Earth',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      sortQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(3);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('auto-grades a sort answer with stray whitespace and empty items as correct', async () => {
    const sortQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'sort',
      prompt: 'Order these planets from the sun outward.',
      answer: 'Mercury|Venus|Earth',
      points: 3,
      payload: { options: ['Venus', 'Mercury', 'Earth'] },
    });
    await state.em.flush();
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      sortQuestion.id,
      team.id,
      ' Mercury | Venus ||Earth|',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      sortQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(3);
    expect(answer.verdict).toBe('correct');
  });

  it('auto-grades an incorrect sort answer on submit as zero points', async () => {
    const sortQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'sort',
      prompt: 'Order these planets from the sun outward.',
      answer: 'Mercury|Venus|Earth',
      points: 3,
      payload: { options: ['Venus', 'Mercury', 'Earth'] },
    });
    await state.em.flush();
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      sortQuestion.id,
      team.id,
      'Earth|Venus|Mercury',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      sortQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(0);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('auto-grades a correct match answer on submit, awarding full points', async () => {
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
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      matchQuestion.id,
      team.id,
      'excalibur|shield',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      matchQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(4);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('auto-grades an incorrect match answer on submit as zero points', async () => {
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
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      matchQuestion.id,
      team.id,
      'shield|excalibur',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      matchQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(0);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('auto-grades a partially correct match answer on submit, splitting points per correctly matched pair', async () => {
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
      'excalibur|excalibur|excalibur|excalibur',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      matchQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(1);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('all_or_nothing match scoring: awards full points when every pair is correct', async () => {
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
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      matchQuestion.id,
      team.id,
      'excalibur|shield|web|hammer',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      matchQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(4);
  });

  it('all_or_nothing match scoring: awards exactly half points when exactly one pair is wrong', async () => {
    const matchQuestion = state.em.create(Question, {
      round: state.round,
      orderIndex: 1,
      type: 'match',
      prompt: 'Match the hero to their weapon.',
      answer: 'excalibur|shield|web|hammer',
      points: 5,
      payload: {
        options: ['arthur', 'captain america', 'spiderman', 'thor'],
        matchTargets: ['shield', 'excalibur', 'web', 'hammer'],
        matchScoringMode: 'all_or_nothing',
      },
    });
    await state.em.flush();
    const team = await insertTeam('The Quizzards', 'token-1');

    // Only the last pair (hammer) is wrong — 3 of 4 correct, exactly one miss.
    await state.answerService.submit(
      state.session.id,
      matchQuestion.id,
      team.id,
      'excalibur|shield|web|web',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      matchQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(2.5);
  });

  it('all_or_nothing match scoring: awards zero points when two or more pairs are wrong', async () => {
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
    const team = await insertTeam('The Quizzards', 'token-1');

    // Two pairs wrong (web/hammer swapped).
    await state.answerService.submit(
      state.session.id,
      matchQuestion.id,
      team.id,
      'excalibur|shield|hammer|web',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      matchQuestion.id,
    );
    expect(answer.pointsAwarded).toBe(0);
  });

  it('auto-grades an exact-match free_text answer on submit, awarding full points', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

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
    expect(answer.pointsAwarded).toBe(1);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('auto-grades a free_text answer case-insensitively', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      'aPPLE',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answer.pointsAwarded).toBe(1);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('auto-grades a free_text answer with leading/trailing whitespace trimmed', async () => {
    const team = await insertTeam('The Quizzards', 'token-1');

    await state.answerService.submit(
      state.session.id,
      state.question.id,
      team.id,
      '  Apple  ',
    );

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answer.pointsAwarded).toBe(1);
    expect(answer.gradedAt).not.toBeNull();
  });

  it('leaves a non-matching free_text answer ungraded for the moderator', async () => {
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
    expect(answer.verdict).toBeNull();
  });

  it('re-grades a free_text answer when the team revises it before locking', async () => {
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

    const [answer] = await state.answerService.listForQuestion(
      state.session.id,
      state.question.id,
    );
    expect(answer.pointsAwarded).toBe(1);
  });
});
