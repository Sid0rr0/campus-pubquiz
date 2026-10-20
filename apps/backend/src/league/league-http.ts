import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UnknownLiveSessionError } from '@/game/state/errors/unknown-live-session.error';
import {
  InvalidLeagueIdsError,
  LeagueNotFoundError,
  SessionEndedError,
  SessionNotEndedError,
  SessionNotFoundError,
} from '@/league/league.service';

/** The unwrapped value of a successful Zod parse, or a 400 with its first issue. */
export function parseOrThrow<T>(
  result:
    | { success: true; data: T }
    | { success: false; error: { issues: { message: string }[] } },
  fallback: string,
): T {
  if (!result.success) {
    throw new BadRequestException(result.error.issues[0]?.message ?? fallback);
  }
  return result.data;
}

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

/** Maps the league service's domain refusals to HTTP; anything else is a real failure. */
export async function mapLeagueErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof InvalidLeagueIdsError) {
      throw new BadRequestException(error.message);
    }
    if (
      error instanceof LeagueNotFoundError ||
      error instanceof SessionNotFoundError
    ) {
      throw new NotFoundException(error.message);
    }
    if (
      error instanceof SessionEndedError ||
      error instanceof SessionNotEndedError
    ) {
      throw new ConflictException(error.message);
    }
    throw error;
  }
}
