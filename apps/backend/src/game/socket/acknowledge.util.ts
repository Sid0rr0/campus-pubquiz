import type { Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { AckResult } from '@campus-pubquiz/types';

export const GENERIC_ERROR_MESSAGE = 'Internal server error';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

/**
 * Runs one event handler body and turns its outcome into the acknowledgement
 * Nest sends back to the sender. Plain code rather than a filter so specs
 * that call handler methods directly see the same result.
 */
export async function acknowledge<T = void>(
  client: Socket,
  logger: Logger,
  event: string,
  run: () => Promise<T>,
): Promise<AckResult<T>> {
  try {
    const data = await run();
    return data === undefined
      ? { success: true }
      : { success: true, data: data as T };
  } catch (error) {
    const message =
      error instanceof WsException
        ? wsMessage(error)
        : logUnexpected(logger, client, event, error);
    return { success: false, error: message };
  }
}

function wsMessage(error: WsException): string {
  const payload = error.getError();
  return typeof payload === 'string' ? payload : GENERIC_ERROR_MESSAGE;
}

function logUnexpected(
  logger: Logger,
  client: Socket,
  event: string,
  error: unknown,
): string {
  logger.error(`${event} from ${client.id} failed: ${errorMessage(error)}`);
  return GENERIC_ERROR_MESSAGE;
}
