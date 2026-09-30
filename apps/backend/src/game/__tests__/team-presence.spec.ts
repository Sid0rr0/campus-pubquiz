import { GameStateService } from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  createFakeShowdownService,
  asShowdownService,
} from './test-utils';

const QUIZZARDS = [{ teamId: 31, teamName: 'The Quizzards' }];

describe('GameStateService — team connection presence (one live device per team + kick)', () => {
  let service: GameStateService;
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('has no connected socket for a team that has never joined', () => {
    expect(service.getConnectedSocketId(joinCode, 31)).toBeUndefined();
  });

  it('tracks which socket is connected for a team', () => {
    service.teamConnected(joinCode, 31, 'socket-a', QUIZZARDS);

    expect(service.getConnectedSocketId(joinCode, 31)).toBe('socket-a');
  });

  it('reflects isConnected in the snapshot once a team is connected', () => {
    service.teamConnected(joinCode, 31, 'socket-a', QUIZZARDS);

    expect(service.getSnapshot(joinCode).teams).toEqual([
      { teamId: 31, teamName: 'The Quizzards', isConnected: true },
    ]);
  });

  it('asks for a state broadcast when a team connects', () => {
    const outcome = service.teamConnected(joinCode, 31, 'socket-a', QUIZZARDS);

    expect(outcome.shouldBroadcastState).toBe(true);
  });

  it('frees a team connection by socket id and asks for a state broadcast', () => {
    service.teamConnected(joinCode, 31, 'socket-a', QUIZZARDS);

    const outcome = service.teamDisconnected(joinCode, 'socket-a');

    expect(outcome?.shouldBroadcastState).toBe(true);
    expect(service.getConnectedSocketId(joinCode, 31)).toBeUndefined();
    expect(service.getSnapshot(joinCode).teams).toEqual([
      { teamId: 31, teamName: 'The Quizzards', isConnected: false },
    ]);
  });

  it('has nothing to push when the disconnected socket is not connected to any team', () => {
    expect(service.teamDisconnected(joinCode, 'unknown-socket')).toBeNull();
  });

  it('does not disturb another team connection when an unrelated socket disconnects', () => {
    service.teamConnected(joinCode, 31, 'socket-a', QUIZZARDS);
    service.teamConnected(joinCode, 32, 'socket-b', QUIZZARDS);

    service.teamDisconnected(joinCode, 'socket-a');

    expect(service.getConnectedSocketId(joinCode, 31)).toBeUndefined();
    expect(service.getConnectedSocketId(joinCode, 32)).toBe('socket-b');
  });

  it('does not carry a stale team connection over into a newly created session', async () => {
    service.teamConnected(joinCode, 31, 'socket-a', QUIZZARDS);

    const created = await service.createSession(2);

    expect(service.getConnectedSocketId(created.joinCode, 31)).toBeUndefined();
  });
});
