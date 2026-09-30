import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type SocketRoomName,
  type StateSnapshotPayload,
  sessionRoom,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

interface AnswersUpdated {
  questionId: number;
  answers: { answerId: number; teamId: number; gradedAt: string | null }[];
}

describe('GameGateway — answer recorded / answer graded', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let team: MockSocket;
  let teamId: number;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
    [{ socket: team, teamId }] = game.teams;
    await game.openFirstQuestion(admin);
    game.clearEmits();
  });

  function roomPayloads<T>(room: SocketRoomName, event: string): T[] {
    const fullRoom = sessionRoom(game.joinCode, room);
    return game
      .roomEmits()
      .filter((emit) => emit.rooms.includes(fullRoom) && emit.event === event)
      .map((emit) => emit.payload as T);
  }

  function lastSnapshot(room: SocketRoomName): StateSnapshotPayload {
    const snapshots = roomPayloads<StateSnapshotPayload>(
      room,
      SOCKET_EVENTS.STATE_UPDATED,
    );
    return snapshots[snapshots.length - 1];
  }

  /** Steps the open round forward until `questionId` is the current question. */
  async function advanceTo(questionId: number): Promise<void> {
    const order = Object.values(game.questionIds);
    for (let step = 0; step < order.indexOf(questionId); step++) {
      await game.gateway.handleAdminAction(asSocket(admin), {
        action: 'ADVANCE',
      });
    }
    game.clearEmits();
  }

  async function submit(questionId: number, value: string) {
    return game.gateway.handleSubmitAnswer(asSocket(team), {
      questionId,
      teamId,
      value,
    });
  }

  async function grade(answerId: number, pointsAwarded: number) {
    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId,
      pointsAwarded,
    });
  }

  function latestAnswerId(questionId: number): number {
    const lists = roomPayloads<AnswersUpdated>(
      SOCKET_ROOMS.ADMIN,
      SOCKET_EVENTS.ANSWERS_UPDATED,
    ).filter((payload) => payload.questionId === questionId);
    return lists[lists.length - 1].answers[0].answerId;
  }

  it('shows a team its auto-graded points on the leaderboard in the next snapshot', async () => {
    await submit(game.questionIds.multipleChoice, 'Paris');

    for (const room of [
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      expect(lastSnapshot(room).leaderboard).toEqual([
        expect.objectContaining({ teamId, totalPoints: 2 }),
      ]);
    }
  });

  it('marks the answering team as answered in the next snapshot', async () => {
    await submit(game.questionIds.multipleChoice, 'Paris');

    expect(lastSnapshot(SOCKET_ROOMS.ADMIN).answeredTeamIds).toEqual([teamId]);
  });

  it('never counts a closest_guess submit as an ungraded question', async () => {
    await advanceTo(game.questionIds.closestGuess);
    await submit(game.questionIds.closestGuess, '200');

    expect(lastSnapshot(SOCKET_ROOMS.ADMIN).ungradedQuestionIds).toEqual([]);
  });

  it('flags a human-graded question until its last ungraded answer is graded', async () => {
    const { audio } = game.questionIds;
    await advanceTo(audio);
    await submit(audio, 'Queen');
    expect(lastSnapshot(SOCKET_ROOMS.ADMIN).ungradedQuestionIds).toEqual([
      audio,
    ]);

    await grade(latestAnswerId(audio), 2);

    expect(lastSnapshot(SOCKET_ROOMS.ADMIN).ungradedQuestionIds).toEqual([]);
    expect(lastSnapshot(SOCKET_ROOMS.ADMIN).leaderboard).toEqual([
      expect.objectContaining({ teamId, totalPoints: 2 }),
    ]);
  });

  it('flags the question again when a team changes an already-graded answer', async () => {
    const { audio } = game.questionIds;
    await advanceTo(audio);
    await submit(audio, 'Queen');
    await grade(latestAnswerId(audio), 2);

    await submit(audio, 'Abba');

    expect(lastSnapshot(SOCKET_ROOMS.ADMIN).ungradedQuestionIds).toEqual([
      audio,
    ]);
  });

  it('acknowledges the submitting team with its own answer', async () => {
    await submit(game.questionIds.multipleChoice, 'Paris');

    expect(team.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.ANSWER_RECEIVED,
      expect.objectContaining({
        questionId: game.questionIds.multipleChoice,
        teamId,
        value: 'Paris',
        pointsAwarded: 2,
      }),
    );
  });

  it('pushes the question’s answer list to the admin room after every submit and grade', async () => {
    const { audio } = game.questionIds;
    await advanceTo(audio);
    await submit(audio, 'Queen');
    await grade(latestAnswerId(audio), 1);

    const lists = roomPayloads<AnswersUpdated>(
      SOCKET_ROOMS.ADMIN,
      SOCKET_EVENTS.ANSWERS_UPDATED,
    );
    expect(lists).toHaveLength(2);
    expect(lists.map((list) => list.answers[0].gradedAt !== null)).toEqual([
      false,
      true,
    ]);
  });

  it('rejects a submit to a question that is not open with today’s message', async () => {
    await expect(submit(999_999, 'Paris')).resolves.toEqual({
      success: false,
      error: expect.stringContaining(
        'Answers are locked for this question',
      ) as string,
    });
  });

  it('rejects a submit on behalf of another team with today’s message', async () => {
    const other = await game.joinTeam('Other Team');

    await expect(
      game.gateway.handleSubmitAnswer(asSocket(other.socket), {
        questionId: game.questionIds.multipleChoice,
        teamId,
        value: 'Paris',
      }),
    ).resolves.toEqual({
      success: false,
      error: expect.stringContaining(
        'You may only submit answers for your own team',
      ) as string,
    });
  });
});
