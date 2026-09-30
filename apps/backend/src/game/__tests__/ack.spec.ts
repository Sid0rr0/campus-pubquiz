import { Logger, type ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { LegacyExceptionEmitInterceptor } from '@/game/socket/legacy-exception-emit.interceptor';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
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
  const client = { id: 'sock-1', emit } as unknown as Socket;

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

describe('LegacyExceptionEmitInterceptor', () => {
  const emit = jest.fn();
  const context = {
    switchToWs: () => ({ getClient: () => ({ emit }) }),
  } as unknown as ExecutionContext;
  const run = (result: unknown) =>
    lastValueFrom(
      new LegacyExceptionEmitInterceptor().intercept(context, {
        handle: () => of(result),
      }),
    );

  beforeEach(() => emit.mockClear());

  it('re-emits a rejection to the sender as the legacy exception event and passes the result on', async () => {
    const failure = { success: false, error: 'Nope' };

    await expect(run(failure)).resolves.toBe(failure);
    expect(emit).toHaveBeenCalledWith('exception', {
      status: 'error',
      message: 'Nope',
    });
  });

  it('emits nothing for a success', async () => {
    await run({ success: true });

    expect(emit).not.toHaveBeenCalled();
  });
});
