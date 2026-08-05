import { WsException } from '@nestjs/websockets';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import {
  TEST_SESSION_TOKEN,
  createMockSocket,
  createTestGateway,
  openFirstQuestion,
  asSocket,
  type MockServer,
  type MockAnswerService,
} from './test-utils';

describe('GameGateway — submit answer', () => {
  let gateway: GameGateway;
  let server: MockServer;
  let answerService: MockAnswerService;

  beforeEach(async () => {
    ({ gateway, server, answerService } = await createTestGateway());
  });

  it('submits an answer and broadcasts ANSWERS_UPDATED to the admin room', async () => {
    await openFirstQuestion(gateway, server);
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleSubmitAnswer(asSocket(player), {
      questionId: 21,
      teamId: 31,
      value: 'Banana',
    });

    expect(answerService.submit).toHaveBeenCalledWith(101, 21, 31, 'Banana');
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.ADMIN),
    );
    expect(server.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ANSWERS_UPDATED, {
      questionId: 21,
      question: {
        type: 'free_text',
        prompt: 'Q1',
        points: 1,
        correctAnswer: 'A1',
        roundTitle: 'Round 1',
        roundNumber: 1,
        questionNumberInRound: 1,
        totalQuestionsInRound: 1,
      },
      answers: [
        {
          answerId: 41,
          teamId: 31,
          teamName: 'The Quizzards',
          value: 'Banana',
          pointsAwarded: 0,
          gradedAt: null,
        },
      ],
    });
  });

  it('acknowledges the submitting player with ANSWER_RECEIVED', async () => {
    await openFirstQuestion(gateway, server);
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleSubmitAnswer(asSocket(player), {
      questionId: 21,
      teamId: 31,
      value: 'Banana',
    });

    expect(player.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ANSWER_RECEIVED, {
      questionId: 21,
      teamId: 31,
      teamName: 'The Quizzards',
      value: 'Banana',
    });
  });

  it('broadcasts STATE_UPDATED with the answered team ids after a submit', async () => {
    await openFirstQuestion(gateway, server);
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await gateway.handleSubmitAnswer(asSocket(player), {
      questionId: 21,
      teamId: 31,
      value: 'Banana',
    });

    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.DISPLAY),
    );
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.PLAYERS),
    );
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({ answeredTeamIds: [31] }),
    );
  });

  it('rejects SUBMIT_ANSWER while the question is not open for answering', async () => {
    // Still in the lobby - no question has been revealed yet.
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleSubmitAnswer(asSocket(player), {
        questionId: 21,
        teamId: 31,
        value: 'Banana',
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.submit).not.toHaveBeenCalled();
  });

  it('rejects SUBMIT_ANSWER from a non-players client', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await expect(
      gateway.handleSubmitAnswer(asSocket(admin), {
        questionId: 21,
        teamId: 31,
        value: 'Banana',
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.submit).not.toHaveBeenCalled();
  });
});
