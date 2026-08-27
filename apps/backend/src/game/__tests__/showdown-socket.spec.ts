import { WsException } from '@nestjs/websockets';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import type { GameStateService } from '@/game/state/game-state.service';
import {
  TEST_SESSION_TOKEN,
  createMockSocket,
  createTestGateway,
  asSocket,
  type MockServer,
  type MockShowdownService,
} from './test-utils';

const TIED_LEADERBOARD = [
  {
    teamId: 31,
    teamName: 'Team A',
    totalPoints: 10,
    bonusPoints: 0,
    roundPoints: [],
  },
  {
    teamId: 32,
    teamName: 'Team B',
    totalPoints: 10,
    bonusPoints: 0,
    roundPoints: [],
  },
];

describe('GameGateway — showdown', () => {
  let gateway: GameGateway;
  let server: MockServer;
  let showdownService: MockShowdownService;
  let gameStateService: GameStateService;

  beforeEach(async () => {
    ({ gateway, server, showdownService, gameStateService } =
      await createTestGateway());
  });

  describe('CREATE_SHOWDOWN_ROUND', () => {
    it('rejects when nobody is tied for first', async () => {
      gameStateService.setLeaderboard('ABCDEF', [
        {
          teamId: 31,
          teamName: 'Team A',
          totalPoints: 10,
          bonusPoints: 0,
          roundPoints: [],
        },
        {
          teamId: 32,
          teamName: 'Team B',
          totalPoints: 5,
          bonusPoints: 0,
          roundPoints: [],
        },
      ]);
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        token: TEST_SESSION_TOKEN,
      });
      await gateway.handleConnection(asSocket(admin));

      await expect(
        gateway.handleCreateShowdownRound(asSocket(admin), {
          question: 'How many?',
          answer: '100',
          points: 5,
        }),
      ).rejects.toThrow(WsException);
      expect(showdownService.createRound).not.toHaveBeenCalled();
    });

    it('rejects CREATE_SHOWDOWN_ROUND from a non-admin client', async () => {
      gameStateService.setLeaderboard('ABCDEF', TIED_LEADERBOARD);
      const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
      await gateway.handleConnection(asSocket(player));

      await expect(
        gateway.handleCreateShowdownRound(asSocket(player), {
          question: 'How many?',
          answer: '100',
          points: 5,
        }),
      ).rejects.toThrow(WsException);
      expect(showdownService.createRound).not.toHaveBeenCalled();
    });

    it('creates a round for the tied teams, hides the leaderboard, and broadcasts activeShowdown', async () => {
      gameStateService.setLeaderboard('ABCDEF', TIED_LEADERBOARD);
      showdownService.createRound.mockResolvedValueOnce({
        id: 900,
        question: 'How many?',
        answer: '100',
        winnerTeamId: null,
        isTie: false,
        resolved: false,
        participants: [
          { teamId: 31, teamName: 'Team A', seatIndex: 0, guess: null },
          { teamId: 32, teamName: 'Team B', seatIndex: 1, guess: null },
        ],
      });
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        token: TEST_SESSION_TOKEN,
      });
      await gateway.handleConnection(asSocket(admin));

      await gateway.handleCreateShowdownRound(asSocket(admin), {
        question: 'How many?',
        answer: '100',
        points: 5,
      });

      expect(showdownService.createRound).toHaveBeenCalledWith(
        101,
        [
          { teamId: 31, teamName: 'Team A' },
          { teamId: 32, teamName: 'Team B' },
        ],
        'How many?',
        '100',
        5,
      );
      expect(server.to).toHaveBeenCalledWith(
        sessionRoom('ABCDEF', SOCKET_ROOMS.DISPLAY),
      );
      const lastCall = server.emit.mock.calls.at(-1) as
        | [string, StateSnapshotPayload]
        | undefined;
      expect(lastCall?.[0]).toBe(SOCKET_EVENTS.STATE_UPDATED);
      expect(lastCall?.[1].showdownRevealStep).toBe(0);
      expect(lastCall?.[1].activeShowdown?.id).toBe(900);
      expect(lastCall?.[1].progress.isLeaderboardVisible).toBe(false);
    });
  });

  describe('SUBMIT_SHOWDOWN_GUESS', () => {
    async function seedActiveRound(): Promise<void> {
      gameStateService.setLeaderboard('ABCDEF', TIED_LEADERBOARD);
      showdownService.createRound.mockResolvedValueOnce({
        id: 900,
        question: 'How many?',
        answer: '100',
        winnerTeamId: null,
        isTie: false,
        resolved: false,
        participants: [
          { teamId: 31, teamName: 'Team A', seatIndex: 0, guess: null },
          { teamId: 32, teamName: 'Team B', seatIndex: 1, guess: null },
        ],
      });
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        token: TEST_SESSION_TOKEN,
      });
      await gateway.handleConnection(asSocket(admin));
      await gateway.handleCreateShowdownRound(asSocket(admin), {
        question: 'How many?',
        answer: '100',
        points: 5,
      });
    }

    it('accepts a guess from the owning team and broadcasts hasGuessed without the value', async () => {
      await seedActiveRound();
      const player = createMockSocket(SOCKET_ROOMS.PLAYERS, {}, 'socket-a');
      await gateway.handleConnection(asSocket(player));
      gameStateService.setTeamConnected('ABCDEF', 31, 'socket-a');

      await gateway.handleSubmitShowdownGuess(asSocket(player), {
        showdownRoundId: 900,
        teamId: 31,
        value: '95',
      });

      expect(showdownService.submitGuess).toHaveBeenCalledWith(900, 31, '95');
      const lastCall = server.emit.mock.calls.at(-1) as
        | [string, StateSnapshotPayload]
        | undefined;
      expect(lastCall?.[0]).toBe(SOCKET_EVENTS.STATE_UPDATED);
      const broadcastParticipants = lastCall?.[1].activeShowdown?.participants;
      expect(broadcastParticipants).toEqual([
        { teamId: 31, teamName: 'Team A', seatIndex: 0, hasGuessed: true },
        { teamId: 32, teamName: 'Team B', seatIndex: 1, hasGuessed: false },
      ]);
      // Guess values are never included at step 0, however far the reveal
      // walk has progressed for other participants.
      expect(broadcastParticipants?.[0].guess).toBeUndefined();
    });

    it("rejects a guess for a team the submitting socket doesn't own", async () => {
      await seedActiveRound();
      const attacker = createMockSocket(
        SOCKET_ROOMS.PLAYERS,
        {},
        'socket-attacker',
      );
      await gateway.handleConnection(asSocket(attacker));
      gameStateService.setTeamConnected('ABCDEF', 31, 'socket-owner');

      await expect(
        gateway.handleSubmitShowdownGuess(asSocket(attacker), {
          showdownRoundId: 900,
          teamId: 31,
          value: '95',
        }),
      ).rejects.toThrow(WsException);
      expect(showdownService.submitGuess).not.toHaveBeenCalled();
    });

    it('rejects a guess from a team not seated in the round', async () => {
      await seedActiveRound();
      const outsider = createMockSocket(
        SOCKET_ROOMS.PLAYERS,
        {},
        'socket-outsider',
      );
      await gateway.handleConnection(asSocket(outsider));
      gameStateService.setTeamConnected('ABCDEF', 99, 'socket-outsider');

      await expect(
        gateway.handleSubmitShowdownGuess(asSocket(outsider), {
          showdownRoundId: 900,
          teamId: 99,
          value: '95',
        }),
      ).rejects.toThrow(WsException);
      expect(showdownService.submitGuess).not.toHaveBeenCalled();
    });

    it('rejects a guess once the reveal has moved past step 0', async () => {
      await seedActiveRound();
      const player = createMockSocket(SOCKET_ROOMS.PLAYERS, {}, 'socket-a');
      await gateway.handleConnection(asSocket(player));
      gameStateService.setTeamConnected('ABCDEF', 31, 'socket-a');
      gameStateService.setTeamConnected('ABCDEF', 32, 'socket-b');
      gameStateService.setShowdownGuess('ABCDEF', 31, '10');
      gameStateService.setShowdownGuess('ABCDEF', 32, '20');
      await gameStateService.applyAction('ABCDEF', 'ADVANCE');

      await expect(
        gateway.handleSubmitShowdownGuess(asSocket(player), {
          showdownRoundId: 900,
          teamId: 31,
          value: '95',
        }),
      ).rejects.toThrow(WsException);
      expect(showdownService.submitGuess).not.toHaveBeenCalled();
    });

    it('rejects SUBMIT_SHOWDOWN_GUESS from a non-player client', async () => {
      await seedActiveRound();
      const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
        token: TEST_SESSION_TOKEN,
      });
      await gateway.handleConnection(asSocket(admin));

      await expect(
        gateway.handleSubmitShowdownGuess(asSocket(admin), {
          showdownRoundId: 900,
          teamId: 31,
          value: '95',
        }),
      ).rejects.toThrow(WsException);
      expect(showdownService.submitGuess).not.toHaveBeenCalled();
    });
  });
});
