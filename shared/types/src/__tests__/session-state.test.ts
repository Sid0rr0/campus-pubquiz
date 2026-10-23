import { describe, expect, it } from 'vitest';
import { freshSessionState } from '../session-state';
import { sessionOver } from './session-progress-fixtures';

describe('a fresh session state', () => {
  it('starts with the big screen sound on', () => {
    const { seededGame } = sessionOver([]);

    expect(freshSessionState(seededGame).isDisplaySoundMuted).toBe(false);
  });
});
