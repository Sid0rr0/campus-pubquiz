/**
 * Compile-time assertions that a SessionOutcome's replies and notices pair
 * each event with its protocol payload. Not a Jest suite: `pnpm typecheck`
 * compiles it.
 */
import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import type { SocketNotice, SocketReply } from '@/game/state/session-outcome';

export const kicked: SocketNotice = {
  socketId: 's1',
  event: SOCKET_EVENTS.TEAM_KICKED,
  payload: undefined,
};

export const mismatchedReply: SocketReply = {
  event: SOCKET_EVENTS.ANSWER_RECEIVED,
  // @ts-expect-error a join-accepted payload is not an answer-received payload
  payload: { teamToken: 'x' },
};

const sendReply = (reply: SocketReply): SocketReply => reply;
// @ts-expect-error STATE_UPDATED is not a reply the Live session module sends
sendReply({ event: SOCKET_EVENTS.STATE_UPDATED, payload: {} });

// @ts-expect-error a bonus notice carries a bonus award, not nothing
export const mismatchedNotice: SocketNotice = {
  socketId: 's1',
  event: SOCKET_EVENTS.BONUS_AWARDED,
  payload: undefined,
};
