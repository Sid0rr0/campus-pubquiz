import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — submit answer', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let team: { socket: MockSocket; teamId: number };

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
    [team] = game.teams;
  });

  function submit(socket: MockSocket, teamId: number, value = 'Banana') {
    return game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId: game.questionIds.multipleChoice,
      teamId,
      value,
    });
  }

  function storedAnswers() {
    return game.inRequestContext(() =>
      game.answerService.listForQuestion(
        game.gameSessionId,
        game.questionIds.multipleChoice,
      ),
    );
  }

  it('submits an answer and broadcasts ANSWERS_UPDATED to the admin room', async () => {
    await game.openFirstQuestion(admin);
    game.clearEmits();

    await submit(team.socket, team.teamId);

    const [update] = game.payloadsTo<{
      questionId: number;
      question: Record<string, unknown>;
      answers: Record<string, unknown>[];
    }>(SOCKET_ROOMS.ADMIN, SOCKET_EVENTS.ANSWERS_UPDATED);
    expect(update.questionId).toBe(game.questionIds.multipleChoice);
    expect(update.question).toMatchObject({
      type: 'multiple_choice',
      prompt: 'Capital of France?',
      points: 2,
      correctAnswer: 'Paris',
      roundTitle: 'Round 1',
      roundNumber: 1,
      questionNumberInRound: 1,
    });
    expect(update.answers).toEqual([
      expect.objectContaining({
        teamId: team.teamId,
        teamName: 'The Quizzards',
        value: 'Banana',
        pointsAwarded: 0,
      }),
    ]);
  });

  it('acknowledges the submitting player with ANSWER_RECEIVED', async () => {
    await game.openFirstQuestion(admin);
    game.clearEmits();

    await submit(team.socket, team.teamId);

    expect(team.socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.ANSWER_RECEIVED,
      expect.objectContaining({
        questionId: game.questionIds.multipleChoice,
        teamId: team.teamId,
        teamName: 'The Quizzards',
        value: 'Banana',
        pointsAwarded: 0,
      }),
    );
  });

  it('broadcasts STATE_UPDATED with the answered team ids after a submit', async () => {
    await game.openFirstQuestion(admin);
    game.clearEmits();

    await submit(team.socket, team.teamId);

    for (const room of [SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.PLAYERS]) {
      const snapshots = game.payloadsTo<StateSnapshotPayload>(
        room,
        SOCKET_EVENTS.STATE_UPDATED,
      );
      expect(snapshots[snapshots.length - 1].answeredTeamIds).toEqual([
        team.teamId,
      ]);
    }
  });

  it('rejects SUBMIT_ANSWER while the question is not open for answering', async () => {
    // Still in the lobby - no question has been revealed yet.
    await expect(submit(team.socket, team.teamId)).resolves.toEqual({
      success: false,
      error: 'Answers are locked for this question',
    });

    expect(await storedAnswers()).toEqual([]);
  });

  it('rejects SUBMIT_ANSWER for a team the submitting socket never joined as', async () => {
    await game.openFirstQuestion(admin);
    const attacker = await game.connectPlayer();

    await expect(submit(attacker, team.teamId, 'Hijacked')).resolves.toEqual({
      success: false,
      error: 'You may only submit answers for your own team',
    });

    expect(await storedAnswers()).toEqual([]);
  });

  it('rejects a late answer before it checks whose seat it is', async () => {
    const attacker = await game.connectPlayer();

    await expect(
      submit(attacker, team.teamId, 'Hijacked'),
    ).resolves.toMatchObject({
      success: false,
      error: 'Answers are locked for this question',
    });
  });

  it('rejects SUBMIT_ANSWER from a non-players client', async () => {
    await game.openFirstQuestion(admin);

    await expect(submit(admin, team.teamId)).resolves.toMatchObject({
      success: false,
    });

    expect(await storedAnswers()).toEqual([]);
  });
});
