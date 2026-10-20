import { NotFoundException } from '@nestjs/common';
import { UnknownLiveSessionError } from '@/game/state/errors/unknown-live-session.error';

/** Maps the REST entry's unknown-live-session error to a 404 with its message; anything else is rethrown. */
export async function mapUnknownLiveSession<T>(
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof UnknownLiveSessionError) {
      throw new NotFoundException(error.message);
    }
    throw error;
  }
}
