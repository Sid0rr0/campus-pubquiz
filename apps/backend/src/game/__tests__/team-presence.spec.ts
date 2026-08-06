import { GameStateService } from '@/game/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  asSeedService,
  asGameProgressRepository,
} from './test-utils';

describe('GameStateService — team connection presence (one live device per team + kick)', () => {
  let service: GameStateService;
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('has no connected socket for a team that has never joined', () => {
    expect(service.getConnectedSocketId(joinCode, 31)).toBeUndefined();
  });

  it('tracks which socket is connected for a team', () => {
    service.setTeamConnected(joinCode, 31, 'socket-a');

    expect(service.getConnectedSocketId(joinCode, 31)).toBe('socket-a');
  });

  it('reflects isConnected in the snapshot once a team is connected', () => {
    service.setTeams(joinCode, [{ teamId: 31, teamName: 'The Quizzards' }]);
    service.setTeamConnected(joinCode, 31, 'socket-a');

    expect(service.getSnapshot(joinCode).teams).toEqual([
      { teamId: 31, teamName: 'The Quizzards', isConnected: true },
    ]);
  });

  it('clears a team connection by socket id and returns the freed teamId', () => {
    service.setTeams(joinCode, [{ teamId: 31, teamName: 'The Quizzards' }]);
    service.setTeamConnected(joinCode, 31, 'socket-a');

    const clearedTeamId = service.clearTeamConnectionBySocketId(
      joinCode,
      'socket-a',
    );

    expect(clearedTeamId).toBe(31);
    expect(service.getConnectedSocketId(joinCode, 31)).toBeUndefined();
    expect(service.getSnapshot(joinCode).teams).toEqual([
      { teamId: 31, teamName: 'The Quizzards', isConnected: false },
    ]);
  });

  it('returns null when clearing a socket id that is not connected to any team', () => {
    expect(
      service.clearTeamConnectionBySocketId(joinCode, 'unknown-socket'),
    ).toBeNull();
  });

  it('does not disturb another team connection when clearing an unrelated socket id', () => {
    service.setTeamConnected(joinCode, 31, 'socket-a');
    service.setTeamConnected(joinCode, 32, 'socket-b');

    service.clearTeamConnectionBySocketId(joinCode, 'socket-a');

    expect(service.getConnectedSocketId(joinCode, 31)).toBeUndefined();
    expect(service.getConnectedSocketId(joinCode, 32)).toBe('socket-b');
  });

  it('does not carry a stale team connection over into a newly created session', async () => {
    service.setTeamConnected(joinCode, 31, 'socket-a');

    const created = await service.createSession(2);

    expect(service.getConnectedSocketId(created.joinCode, 31)).toBeUndefined();
  });
});
