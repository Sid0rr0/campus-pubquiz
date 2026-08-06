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
  asSocket,
  type MockServer,
  type MockAnswerService,
} from './test-utils';

describe('GameGateway — grading', () => {
  let gateway: GameGateway;
  let server: MockServer;
  let answerService: MockAnswerService;

  beforeEach(async () => {
    ({ gateway, server, answerService } = await createTestGateway());
  });

  it('grades an answer and broadcasts ANSWERS_UPDATED to the admin room', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleGradeAnswer(asSocket(admin), {
      answerId: 41,
      pointsAwarded: 2,
    });

    expect(answerService.grade).toHaveBeenCalledWith(101, 41, 2);
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

  it('refreshes the leaderboard and broadcasts STATE_UPDATED to all three rooms after grading', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleGradeAnswer(asSocket(admin), {
      answerId: 41,
      pointsAwarded: 2,
    });

    expect(answerService.computeLeaderboard).toHaveBeenCalledWith(101);
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.DISPLAY),
    );
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.PLAYERS),
    );
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        leaderboard: [
          {
            teamId: 31,
            teamName: 'The Quizzards',
            totalPoints: 2,
            bonusPoints: 0,
          },
        ],
      }),
    );
  });

  it('rejects GRADE_ANSWER from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleGradeAnswer(asSocket(player), {
        answerId: 41,
        pointsAwarded: 2,
      }),
    ).rejects.toThrow(WsException);
    expect(answerService.grade).not.toHaveBeenCalled();
  });

  it('lists answers for a requested block question to the requesting admin only', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleListAnswers(asSocket(admin), { questionId: 21 });

    expect(answerService.listForQuestion).toHaveBeenCalledWith(101, 21);
    expect(admin.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ANSWERS_UPDATED, {
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

  it('rejects LIST_ANSWERS from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleListAnswers(asSocket(player), { questionId: 21 }),
    ).rejects.toThrow(WsException);
    expect(answerService.listForQuestion).not.toHaveBeenCalled();
  });
});
