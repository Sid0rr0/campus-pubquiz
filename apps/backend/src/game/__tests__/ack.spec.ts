import { Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { GameSocket } from '@/game/socket/game-socket.types';
import {
  acknowledge,
  GENERIC_ERROR_MESSAGE,
} from '@/game/socket/acknowledge.util';

describe('acknowledge', () => {
  const logger = new Logger('ack-spec');
  const emit = jest.fn();
  const logError = jest
    .spyOn(logger, 'error')
    .mockImplementation(() => undefined);
  const client = { id: 'sock-1', emit } as unknown as GameSocket;

  beforeEach(() => {
    logError.mockClear();
    emit.mockClear();
  });

  it('returns success without data when the handler returns nothing', async () => {
    await expect(
      acknowledge(client, logger, 'evt', () => Promise.resolve()),
    ).resolves.toEqual({ success: true });
  });

  it('returns the handler payload as data', async () => {
    await expect(
      acknowledge(client, logger, 'evt', () => Promise.resolve({ id: 7 })),
    ).resolves.toEqual({ success: true, data: { id: 7 } });
  });

  it('returns a client-safe failure for a WsException', async () => {
    await expect(
      acknowledge(client, logger, 'evt', () => {
        throw new WsException('Nope');
      }),
    ).resolves.toEqual({ success: false, error: 'Nope' });
    expect(logError).not.toHaveBeenCalled();
  });

  it('logs an unexpected error and returns the generic message', async () => {
    await expect(
      acknowledge(client, logger, 'evt', () => {
        throw new Error('db exploded: secret detail');
      }),
    ).resolves.toEqual({ success: false, error: GENERIC_ERROR_MESSAGE });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('db exploded: secret detail'),
    );
  });
});
