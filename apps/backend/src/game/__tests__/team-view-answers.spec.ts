import { asSocket } from '@/game/__tests__/test-utils';
import { setupRealStoreGatewayTest } from '@/game/__tests__/real-store-test-utils';
import {
  expectLiveEqualsResync,
  teamViewsTo,
} from '@/game/__tests__/team-view-test-utils';

describe('GameGateway — the team view carries answers and Ask the room readiness', () => {
  const harness = setupRealStoreGatewayTest();

  it('after an answer submit, the last team view equals what a rejoin gets', async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards', 'The Rivals'],
    });
    const [team] = game.teams;
    await game.openFirstQuestion(await game.connectAdmin());

    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: team.teamId,
      value: 'Banana',
    });

    expect(teamViewsTo(game, team).at(-1)?.answers).toEqual([
      expect.objectContaining({ value: 'Banana' }),
    ]);
    await expectLiveEqualsResync(game, team);
  });

  it('keeps the answer-received acknowledgement going to the sending phone', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    await game.openFirstQuestion(await game.connectAdmin());

    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: team.teamId,
      value: 'Banana',
    });

    expect(team.socket.emit).toHaveBeenCalledWith(
      'game:answer_received',
      expect.objectContaining({ value: 'Banana' }),
    );
  });

  it('gives each team only its own answers and a readiness list of question ids, never a count', async () => {
    const game = await harness.createGateway({
      teamNames: ['A', 'B', 'C', 'D'],
    });
    await game.openFirstQuestion(await game.connectAdmin());
    const questionId = game.questionIds.multipleChoice;
    const values = ['Paris', 'London', 'Berlin', 'Rome'];
    for (const [index, team] of game.teams.entries()) {
      await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
        questionId,
        teamId: team.teamId,
        value: values[index],
      });
    }

    for (const [index, team] of game.teams.entries()) {
      const view = teamViewsTo(game, team).at(-1)!;
      expect(view.answers).toEqual([
        expect.objectContaining({ value: values[index] }),
      ]);
      expect(view.roomReadyQuestionIds).toEqual([questionId]);
    }
  });

  it('after a grade by hand, the last team view equals what a rejoin gets', async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Largest planet?', answer: 'Jupiter' },
          ],
        },
      ],
    });
    const admin = await game.connectAdmin();
    const [team] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value: 'Jupitor',
    });
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );

    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: answer.answerId,
      pointsAwarded: 1,
    });

    expect(teamViewsTo(game, team).at(-1)?.answers).toEqual([
      expect.objectContaining({ questionId, pointsAwarded: 1 }),
    ]);
    await expectLiveEqualsResync(game, team);
  });

  it('after a live answer-key fix, the last team view equals what a rejoin gets', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const [team] = game.teams;
    await game.openFirstQuestion(await game.connectAdmin());
    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: team.teamId,
      value: 'London',
    });

    await game.saveAnswerKeyFix(game.questionIds.multipleChoice, {
      answer: 'London',
      points: 5,
    });

    expect(teamViewsTo(game, team).at(-1)?.answers).toEqual([
      expect.objectContaining({ pointsAwarded: 5 }),
    ]);
    await expectLiveEqualsResync(game, team);
  });

  it('after leaving a break into the results with Early answer reveal, the last team view equals what a rejoin gets', async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      settings: { earlyAnswerReveal: true },
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Largest planet?', answer: 'Jupiter' },
          ],
        },
        {
          title: 'Round 2',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Name a fruit', answer: 'x' },
          ],
        },
      ],
    });
    const admin = await game.connectAdmin();
    const [team] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value: 'Jupitor',
    });
    for (let i = 0; i < 4; i += 1) await game.act('ADVANCE'); // -> break_intro
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: answer.answerId,
      pointsAwarded: 1,
    });
    game.clearEmits();

    await game.act('ADVANCE'); // break exit into the results

    expect(teamViewsTo(game, team).at(-1)?.answers).toEqual([
      expect.objectContaining({ questionId, pointsAwarded: 1 }),
    ]);
    await expectLiveEqualsResync(game, team);
  });
});
