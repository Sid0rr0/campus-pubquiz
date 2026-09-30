import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type SocketRoomName,
  sessionRoom,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

interface AnswersUpdated {
  questionId: number;
  answers: { answerId: number; teamId: number; pointsAwarded: number }[];
}

describe('GameGateway — real-store harness smoke', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
  });

  function roomPayloads<T>(room: SocketRoomName, event: string): T[] {
    const fullRoom = sessionRoom(game.joinCode, room);
    return game
      .roomEmits()
      .filter((emit) => emit.rooms.includes(fullRoom) && emit.event === event)
      .map((emit) => emit.payload as T);
  }

  it('plays a real submit and grade through the gateway and shows the results to each room', async () => {
    const admin = await game.connectAdmin();
    const [{ socket: team, teamId }] = game.teams;
    await game.openFirstQuestion(admin);
    game.clearEmits();

    await game.gateway.handleSubmitAnswer(asSocket(team), {
      questionId: game.questionIds.multipleChoice,
      teamId,
      value: 'Paris',
    });

    const [submitted] = roomPayloads<AnswersUpdated>(
      SOCKET_ROOMS.ADMIN,
      SOCKET_EVENTS.ANSWERS_UPDATED,
    );
    expect(submitted.questionId).toBe(game.questionIds.multipleChoice);
    // multiple_choice is auto-graded at submit time: Paris is worth 2 points.
    expect(submitted.answers).toEqual([
      expect.objectContaining({ teamId, pointsAwarded: 2 }),
    ]);
    expect(team.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.ANSWER_RECEIVED,
      expect.objectContaining({ value: 'Paris', pointsAwarded: 2 }),
    );

    game.clearEmits();
    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: submitted.answers[0].answerId,
      pointsAwarded: 1,
    });

    const [regraded] = roomPayloads<AnswersUpdated>(
      SOCKET_ROOMS.ADMIN,
      SOCKET_EVENTS.ANSWERS_UPDATED,
    );
    expect(regraded.answers).toEqual([
      expect.objectContaining({ teamId, pointsAwarded: 1 }),
    ]);
    for (const room of [
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      expect(
        roomPayloads(room, SOCKET_EVENTS.STATE_UPDATED).length,
      ).toBeGreaterThan(0);
    }
  });
});
