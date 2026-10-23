import { describe, expect, it } from 'vitest';
import { teamMergeRefusalReason } from '../team';

describe('teamMergeRefusalReason', () => {
  it('names the one shared session', () => {
    expect(
      teamMergeRefusalReason({
        kind: 'shared_session',
        sessionNames: ['Quiz Night'],
      }),
    ).toBe('both teams took part in Quiz Night');
  });

  it('lists several shared sessions, comma separated', () => {
    expect(
      teamMergeRefusalReason({
        kind: 'shared_session',
        sessionNames: ['Quiz Night', 'Finals'],
      }),
    ).toBe('both teams took part in Quiz Night, Finals');
  });

  it('names the team that is in a session that has not ended', () => {
    expect(
      teamMergeRefusalReason({
        kind: 'unended_session',
        teamId: 7,
        teamName: 'The Owls',
      }),
    ).toBe("The Owls is in a session that hasn't ended");
  });
});
