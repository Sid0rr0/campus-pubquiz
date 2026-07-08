import { describe, expect, it } from 'vitest';
import { SOCKET_EVENTS, SOCKET_ROOMS } from './socket-events';

describe('SOCKET_EVENTS', () => {
  it('pins the exact event name strings shared across frontend and backend', () => {
    expect(SOCKET_EVENTS).toEqual({
      STATE_SYNC: 'game:state_sync',
      STATE_UPDATED: 'game:state_updated',
      ANSWER_RECEIVED: 'game:answer_received',
      ADMIN_ACTION: 'game:admin_action',
      SUBMIT_ANSWER: 'game:submit_answer',
      JOIN_PLAYERS: 'game:join_players',
    });
  });
});

describe('SOCKET_ROOMS', () => {
  it('pins the exact room name strings shared across frontend and backend', () => {
    expect(SOCKET_ROOMS).toEqual({
      DISPLAY: 'display',
      ADMIN: 'admin',
      PLAYERS: 'players',
    });
  });
});
