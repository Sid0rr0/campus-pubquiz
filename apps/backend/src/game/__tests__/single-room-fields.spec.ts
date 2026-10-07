import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type SocketRoomName,
} from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

/** Fields exactly one room's page reads: each is in that room's view and no other. */
const SINGLE_ROOM_FIELDS: Record<SocketRoomName, readonly string[]> = {
  display: [
    'roundCategory',
    'roundAuthor',
    'roundCategories',
    'roundAuthors',
    'leaderboardRevealCount',
    'kahootQuestionEndsAt',
  ],
  admin: ['ungradedQuestionIds', 'phaseStartedAt', 'phaseElapsedMs'],
  players: ['upcomingQuestions', 'pastRevealedQuestions'],
};

describe('Screen projection — fields only one room reads', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  const rooms = Object.values(SOCKET_ROOMS);

  beforeEach(async () => {
    game = await harness.createGateway();
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
  });

  it.each(rooms)(
    'gives the %s view its own single-room fields and none of the other rooms',
    (room) => {
      const view = game.gameState.getView(game.joinCode, room);

      for (const [owner, fields] of Object.entries(SINGLE_ROOM_FIELDS)) {
        for (const field of fields) {
          if (owner === room) expect(view).toHaveProperty(field);
          else expect(view).not.toHaveProperty(field);
        }
      }
    },
  );

  it('leaves the core snapshot without any single-room field', () => {
    const snapshot = game.gameState.getSnapshot(game.joinCode);

    for (const field of Object.values(SINGLE_ROOM_FIELDS).flat()) {
      expect(snapshot).not.toHaveProperty(field);
    }
  });

  it.each(rooms)(
    'resyncs a reconnecting %s client with the same fields as the live view',
    async (room) => {
      const resync = await game.resync(room);

      const live = game.gameState.getView(game.joinCode, room);
      expect(Object.keys(resync).sort()).toEqual(Object.keys(live).sort());
      for (const field of SINGLE_ROOM_FIELDS[room]) {
        expect(resync).toHaveProperty(field);
      }
    },
  );

  it('broadcasts each room its own single-room fields on a live update', async () => {
    game.clearEmits();
    await game.act('ADVANCE');

    for (const room of rooms) {
      const payload = game
        .payloadsTo<Record<string, unknown>>(room, SOCKET_EVENTS.STATE_UPDATED)
        .at(-1);
      for (const field of SINGLE_ROOM_FIELDS[room]) {
        expect(payload).toHaveProperty(field);
      }
    }
  });
});
