import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type ScreenOperatorFields,
  type SocketRoomName,
  type StateSnapshotPayload,
  sessionRoom,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const ALL_ROOMS: SocketRoomName[] = [
  SOCKET_ROOMS.ADMIN,
  SOCKET_ROOMS.DISPLAY,
  SOCKET_ROOMS.PLAYERS,
];

describe('GameGateway — connection presence and display settings', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let team: { socket: MockSocket; teamId: number };

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
    [team] = game.teams;
    game.clearEmits();
  });

  function snapshotsTo(room: SocketRoomName): StateSnapshotPayload[] {
    const fullRoom = sessionRoom(game.joinCode, room);
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(fullRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as StateSnapshotPayload);
  }

  function operatorFieldsTo(room: SocketRoomName): ScreenOperatorFields[] {
    return snapshotsTo(room) as unknown as ScreenOperatorFields[];
  }

  it('shows a joining team as connected to every room in one snapshot', async () => {
    await game.joinTeam('Latecomers');

    for (const room of ALL_ROOMS) {
      const snapshots = snapshotsTo(room);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].teams.map((t) => t.teamName)).toEqual(
        expect.arrayContaining(['The Quizzards', 'Latecomers']),
      );
      expect(snapshots[0].teams.every((t) => t.isConnected)).toBe(true);
    }
  });

  it('shows a disconnected team as not connected to every room', async () => {
    await game.gateway.handleDisconnect(asSocket(team.socket));

    for (const room of ALL_ROOMS) {
      const snapshots = snapshotsTo(room);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].teams).toEqual([
        expect.objectContaining({ teamId: team.teamId, isConnected: false }),
      ]);
    }
  });

  it('pushes nothing when a socket that belonged to no team disconnects', async () => {
    await game.gateway.handleDisconnect(asSocket(admin));

    expect(game.roomEmits()).toEqual([]);
  });

  it('broadcasts the admin-set break end time to every room', async () => {
    await game.gateway.handleSetBreakEndTime(asSocket(admin), {
      breakEndsAt: 1_900_000_000_000,
    });

    expect(operatorFieldsTo(SOCKET_ROOMS.ADMIN).at(-1)?.breakEndsAt).toBe(
      1_900_000_000_000,
    );
    // The big screen draws it from its break screen, not from a top-level field.
    expect(snapshotsTo(SOCKET_ROOMS.DISPLAY).at(-1)).not.toHaveProperty(
      'breakEndsAt',
    );
    expect(snapshotsTo(SOCKET_ROOMS.PLAYERS).at(-1)).not.toHaveProperty(
      'breakEndsAt',
    );
  });

  it('broadcasts the admin-set display text scale to the big screen and the quiz master only', async () => {
    await game.gateway.handleSetDisplayTextScale(asSocket(admin), {
      displayTextScale: 1.5,
    });

    for (const room of [SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.ADMIN] as const) {
      expect(operatorFieldsTo(room).at(-1)?.displayTextScale).toBe(1.5);
    }
    expect(snapshotsTo(SOCKET_ROOMS.PLAYERS).at(-1)).not.toHaveProperty(
      'displayTextScale',
    );
  });
});
