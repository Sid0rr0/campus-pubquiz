export const SOCKET_EVENTS = {
  // server -> client
  STATE_SYNC: 'game:state_sync',
  STATE_UPDATED: 'game:state_updated',
  ANSWER_RECEIVED: 'game:answer_received',
  JOIN_ACCEPTED: 'game:join_accepted',
  ANSWERS_UPDATED: 'game:answers_updated',
  PRESENTER_CONTEXT_UPDATED: 'game:presenter_context_updated',
  TEAM_ANSWERS_SYNCED: 'game:team_answers_synced',
  BONUS_AWARDED: 'game:bonus_awarded',
  SESSION_CLOSED: 'game:session_closed',
  TEAM_KICKED: 'game:team_kicked',
  // client -> server
  ADMIN_ACTION: 'game:admin_action',
  SUBMIT_ANSWER: 'game:submit_answer',
  JOIN_PLAYERS: 'game:join_players',
  GRADE_ANSWER: 'game:grade_answer',
  KICK_TEAM: 'game:kick_team',
  LEAVE_SESSION: 'game:leave_session',
  AWARD_BONUS: 'game:award_bonus',
  SET_BREAK_END_TIME: 'game:set_break_end_time',
  SET_DISPLAY_TEXT_SCALE: 'game:set_display_text_scale',
  CREATE_SHOWDOWN_ROUND: 'game:create_showdown_round',
  SUBMIT_SHOWDOWN_GUESS: 'game:submit_showdown_guess',
  RATE_ROUND: 'game:rate_round',
  SEND_FEEDBACK: 'game:send_feedback',
} as const;

export const SOCKET_ROOMS = {
  DISPLAY: 'display',
  ADMIN: 'admin',
  PLAYERS: 'players',
} as const;

export type SocketRoomName = (typeof SOCKET_ROOMS)[keyof typeof SOCKET_ROOMS];

/**
 * Socket.IO handshake `query` contract. `code` is optional so today's
 * single-session handshake (no code) keeps working unchanged; once a client
 * knows its session's joinCode it passes it here to be routed to that
 * session's rooms instead of the sole implicit one.
 */
export interface GameSocketHandshakeQuery {
  role: SocketRoomName;
  code?: string;
}

/** Room name for one role within one session — keeps the `${role}:${code}` naming convention in one place. */
export function sessionRoom(code: string, role: SocketRoomName): string {
  return `${role}:${code}`;
}

/**
 * What the server replies with (as the Socket.IO acknowledgement) to every
 * client-to-server event. `error` is always client-safe: a domain rejection's
 * own message, or a generic one for an unexpected failure.
 */
export type AckResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };
