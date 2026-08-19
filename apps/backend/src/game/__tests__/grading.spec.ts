import { WsException } from '@nestjs/websockets';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import type { GameStateService } from '@/game/game-state.service';
import {
  TEST_SESSION_TOKEN,
  createMockSocket,
  createTestGateway,
  openFirstQuestion,
  asSocket,
  type MockServer,
  type MockAnswerService,
} from './test-utils';

describe('GameGateway — grading', () => {
  let gateway: GameGateway;
  let server: MockServer;
  let answerService: MockAnswerService;
  let gameStateService: GameStateService;

  beforeEach(async () => {
    ({ gateway, server, answerService, gameStateService } =
      await createTestGateway());
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

  it('marks the question ungraded once a manually-graded answer is submitted', async () => {
    await openFirstQuestion(gateway, server);
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));
    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
    });

    await gateway.handleSubmitAnswer(asSocket(player), {
      questionId: 21,
      teamId: 31,
      value: 'Banana',
    });

    expect(gameStateService.getSnapshot('ABCDEF').ungradedQuestionIds).toEqual([
      21,
    ]);
  });

  it('clears the ungraded-question cache once every submitted answer for that question is graded', async () => {
    gameStateService.setQuestionGradedStatus('ABCDEF', 21, true);
    expect(gameStateService.getSnapshot('ABCDEF').ungradedQuestionIds).toEqual([
      21,
    ]);

    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));
    answerService.listForQuestion.mockResolvedValueOnce([
      {
        answerId: 41,
        teamId: 31,
        teamName: 'The Quizzards',
        value: 'Banana',
        pointsAwarded: 2,
        gradedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await gateway.handleGradeAnswer(asSocket(admin), {
      answerId: 41,
      pointsAwarded: 2,
    });

    expect(gameStateService.getSnapshot('ABCDEF').ungradedQuestionIds).toEqual(
      [],
    );
  });
});
