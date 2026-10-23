import { describe, expect, it } from 'vitest';
import {
  isSeatTakenRefusal,
  NOT_YOUR_TEAM_ANSWER_ERROR,
  SEAT_TAKEN_REFUSAL_MARKER,
} from '../team-presence';

describe('NOT_YOUR_TEAM_ANSWER_ERROR', () => {
  it('pins the refusal text the phone shows when a socket answers for another team', () => {
    expect(NOT_YOUR_TEAM_ANSWER_ERROR).toBe(
      'You may only submit answers for your own team',
    );
  });
});

describe('isSeatTakenRefusal', () => {
  it('recognises the refusal the server sends for a team held on another device', () => {
    expect(
      isSeatTakenRefusal(
        'Team "The Owls" is already connected on another device',
      ),
    ).toBe(true);
  });

  it('recognises the marker on its own', () => {
    expect(isSeatTakenRefusal(SEAT_TAKEN_REFUSAL_MARKER)).toBe(true);
  });

  it('rejects any other refusal', () => {
    expect(isSeatTakenRefusal('Team name is required')).toBe(false);
    expect(isSeatTakenRefusal('')).toBe(false);
  });
});
