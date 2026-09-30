import { WsException } from '@nestjs/websockets';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type SocketRoomName,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — grading', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let team: { socket: MockSocket; teamId: number };
  let questionId: number;

  beforeEach(async () => {
    // A single human-graded question, so the submitted answer stays
    // ungraded until the admin grades it.
    game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            {
              type: 'audio',
              prompt: 'Which band is this?',
              answer: 'Queen',
              points: 2,
            },
          ],
        },
      ],
    });
    admin = await game.connectAdmin();
    [team] = game.teams;
    [questionId] = game.rounds[0].questionIds;
  });

  async function submitBanana(): Promise<number> {
    await game.openFirstQuestion(admin);
    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value: 'Banana',
    });
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    game.clearEmits();
    return answer.answerId;
  }

  function lastSnapshot(room: SocketRoomName): StateSnapshotPayload {
    const snapshots = game.payloadsTo<StateSnapshotPayload>(
      room,
      SOCKET_EVENTS.STATE_UPDATED,
    );
    return snapshots[snapshots.length - 1];
  }

  it('grades an answer and broadcasts ANSWERS_UPDATED to the admin room', async () => {
    const answerId = await submitBanana();

    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId,
      pointsAwarded: 2,
    });

    const [update] = game.payloadsTo<{
      questionId: number;
      question: Record<string, unknown>;
      answers: Record<string, unknown>[];
    }>(SOCKET_ROOMS.ADMIN, SOCKET_EVENTS.ANSWERS_UPDATED);
    expect(update.questionId).toBe(questionId);
    expect(update.question).toMatchObject({
      type: 'audio',
      prompt: 'Which band is this?',
      points: 2,
      correctAnswer: 'Queen',
      roundTitle: 'Round 1',
    });
    expect(update.answers).toEqual([
      expect.objectContaining({
        answerId,
        teamId: team.teamId,
        teamName: 'The Quizzards',
        value: 'Banana',
        pointsAwarded: 2,
        gradedAt: expect.any(String) as string,
      }),
    ]);
  });

  it('refreshes the leaderboard and broadcasts STATE_UPDATED to all three rooms after grading', async () => {
    const answerId = await submitBanana();

    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId,
      pointsAwarded: 2,
    });

    for (const room of [
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      expect(lastSnapshot(room).leaderboard).toEqual([
        expect.objectContaining({
          teamId: team.teamId,
          teamName: 'The Quizzards',
          totalPoints: 2,
          bonusPoints: 0,
        }),
      ]);
    }
  });

  it('rejects GRADE_ANSWER from a non-admin client', async () => {
    const answerId = await submitBanana();

    await expect(
      game.gateway.handleGradeAnswer(asSocket(team.socket), {
        answerId,
        pointsAwarded: 2,
      }),
    ).rejects.toThrow(WsException);

    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    expect(answer).toMatchObject({ pointsAwarded: 0, gradedAt: null });
  });

  it('marks the question ungraded once a manually-graded answer is submitted', async () => {
    await submitBanana();

    expect((await game.snapshot()).ungradedQuestionIds).toEqual([questionId]);
  });

  it('clears the ungraded-question cache once every submitted answer for that question is graded', async () => {
    const answerId = await submitBanana();
    expect((await game.snapshot()).ungradedQuestionIds).toEqual([questionId]);

    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId,
      pointsAwarded: 2,
    });

    expect((await game.snapshot()).ungradedQuestionIds).toEqual([]);
  });
});
