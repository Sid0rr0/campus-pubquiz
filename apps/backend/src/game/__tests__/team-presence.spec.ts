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

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await service.onModuleInit();
  });

  it('has no connected socket for a team that has never joined', () => {
    expect(service.getConnectedSocketId(31)).toBeUndefined();
  });

  it('tracks which socket is connected for a team', () => {
    service.setTeamConnected(31, 'socket-a');

    expect(service.getConnectedSocketId(31)).toBe('socket-a');
  });

  it('reflects isConnected in the snapshot once a team is connected', () => {
    service.setTeams([{ teamId: 31, teamName: 'The Quizzards' }]);
    service.setTeamConnected(31, 'socket-a');

    expect(service.getSnapshot().teams).toEqual([
      { teamId: 31, teamName: 'The Quizzards', isConnected: true },
    ]);
  });

  it('clears a team connection by socket id and returns the freed teamId', () => {
    service.setTeams([{ teamId: 31, teamName: 'The Quizzards' }]);
    service.setTeamConnected(31, 'socket-a');

    const clearedTeamId = service.clearTeamConnectionBySocketId('socket-a');

    expect(clearedTeamId).toBe(31);
    expect(service.getConnectedSocketId(31)).toBeUndefined();
    expect(service.getSnapshot().teams).toEqual([
      { teamId: 31, teamName: 'The Quizzards', isConnected: false },
    ]);
  });

  it('returns null when clearing a socket id that is not connected to any team', () => {
    expect(service.clearTeamConnectionBySocketId('unknown-socket')).toBeNull();
  });

  it('does not disturb another team connection when clearing an unrelated socket id', () => {
    service.setTeamConnected(31, 'socket-a');
    service.setTeamConnected(32, 'socket-b');

    service.clearTeamConnectionBySocketId('socket-a');

    expect(service.getConnectedSocketId(31)).toBeUndefined();
    expect(service.getConnectedSocketId(32)).toBe('socket-b');
  });

  it('resets team connections when a new quiz session is selected', async () => {
    service.setTeamConnected(31, 'socket-a');

    await service.selectQuiz(2);

    expect(service.getConnectedSocketId(31)).toBeUndefined();
  });
});
