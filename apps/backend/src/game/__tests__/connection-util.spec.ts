import type { Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { SessionService } from '@/auth/session.service';
import { BROADCAST_STATE_OUTCOME } from '@/game/state/session-outcome';
import type { GameStateService } from '@/game/state/game-state.service';
import type { GameSocket } from '@/game/socket/game-socket.types';
import { buildAnswersUpdatedPayload } from '@/game/socket/answers-updated-payload.util';
import {
  acceptConnection,
  disconnectClient,
} from '@/game/socket/connection.util';

function fakeLogger() {
  return { warn: jest.fn(), log: jest.fn() };
}

describe('connection util (no database)', () => {
  describe('acceptConnection', () => {
    function connecting(query: Record<string, string>, cookie?: string) {
      return {
        id: 'socket-1',
        handshake: { query, headers: { cookie } },
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
      };
    }

    it('says why it turned away an unknown session code', async () => {
      const logger = fakeLogger();
      const client = connecting({ role: SOCKET_ROOMS.PLAYERS, code: 'NOPE12' });

      await acceptConnection(
        {
          gameState: { hasSession: () => false } as unknown as GameStateService,
          sessions: {} as SessionService,
          logger: logger as unknown as Logger,
        },
        client as unknown as GameSocket,
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Rejected connection socket-1: unknown session code "NOPE12"',
      );
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('never asks the session service about an admin that sent no cookie', async () => {
      const validate = jest.fn().mockResolvedValue({ user: { id: 1 } });
      const client = connecting({ role: SOCKET_ROOMS.ADMIN, code: 'ABCDEF' });

      await acceptConnection(
        {
          gameState: { hasSession: () => true } as unknown as GameStateService,
          sessions: { validate } as unknown as SessionService,
          logger: fakeLogger() as unknown as Logger,
        },
        client as unknown as GameSocket,
      );

      expect(validate).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('disconnectClient', () => {
    function deps(overrides: {
      hasSession: boolean;
      outcome?: typeof BROADCAST_STATE_OUTCOME | null;
    }) {
      const teamDisconnected = jest
        .fn()
        .mockResolvedValue(
          overrides.outcome === undefined
            ? BROADCAST_STATE_OUTCOME
            : overrides.outcome,
        );
      const logger = fakeLogger();
      const deliver = jest.fn().mockResolvedValue(undefined);
      return {
        teamDisconnected,
        logger,
        deliver,
        deps: {
          gameState: {
            hasSession: () => overrides.hasSession,
            teamDisconnected,
          } as unknown as GameStateService,
          logger: logger as unknown as Logger,
          deliver,
        },
      };
    }
    const client = { id: 'socket-9', data: { joinCode: 'ABCDEF' } };

    it('leaves a session that has been closed alone', async () => {
      const {
        deps: d,
        teamDisconnected,
        deliver,
      } = deps({ hasSession: false });

      await disconnectClient(d, client as unknown as GameSocket);

      expect(teamDisconnected).not.toHaveBeenCalled();
      expect(deliver).not.toHaveBeenCalled();
    });

    it('swallows a failed write when the session was closed meanwhile, and rethrows it otherwise', async () => {
      const failure = new Error('write failed');
      const closedMeanwhile = {
        gameState: {
          hasSession: jest
            .fn()
            .mockReturnValueOnce(true)
            .mockReturnValue(false),
          teamDisconnected: jest.fn().mockRejectedValue(failure),
        } as unknown as GameStateService,
        logger: fakeLogger() as unknown as Logger,
        deliver: jest.fn(),
      };
      const stillOpen = {
        ...closedMeanwhile,
        gameState: {
          hasSession: () => true,
          teamDisconnected: jest.fn().mockRejectedValue(failure),
        } as unknown as GameStateService,
      };

      await expect(
        disconnectClient(closedMeanwhile, client as unknown as GameSocket),
      ).resolves.toBeUndefined();
      await expect(
        disconnectClient(stillOpen, client as unknown as GameSocket),
      ).rejects.toBe(failure);
    });

    it('frees the team, says so and delivers the outcome', async () => {
      const { deps: d, logger, deliver } = deps({ hasSession: true });

      await disconnectClient(d, client as unknown as GameSocket);

      expect(logger.log).toHaveBeenCalledWith(
        'Client socket-9 disconnected, freeing its team',
      );
      expect(deliver).toHaveBeenCalledWith('ABCDEF', BROADCAST_STATE_OUTCOME);
    });
  });

  it('refuses to build an answers payload for an unknown question', () => {
    const gameState = {
      getAdminQuestionContext: () => null,
    } as unknown as GameStateService;

    expect(() =>
      buildAnswersUpdatedPayload(gameState, 'ABCDEF', 99, []),
    ).toThrow(new WsException('Unknown question 99'));
  });
});
