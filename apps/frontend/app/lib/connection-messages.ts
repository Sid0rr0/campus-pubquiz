import type { AckResult } from '@campus-pubquiz/types';

export const RECONNECTING_MESSAGE = 'Connection lost — reconnecting…';
export const NOT_CONNECTED_MESSAGE =
  "You're not connected right now — hang on while we reconnect, then try again.";

/** True when an emit never reached the server: the socket wasn't connected, or nothing acknowledged in time. */
export function isNotDelivered(result: AckResult<unknown>): boolean {
  return !result.success && result.error === NOT_CONNECTED_MESSAGE;
}
