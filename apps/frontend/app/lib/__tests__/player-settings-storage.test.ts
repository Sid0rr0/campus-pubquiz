import { beforeEach, describe, expect, it } from 'vitest';
import {
  readAutoAdvanceSetting,
  writeAutoAdvanceSetting,
} from '@/app/lib/player-settings-storage';

describe('player-settings-storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to enabled when nothing has been stored yet', () => {
    expect(readAutoAdvanceSetting()).toBe(true);
  });

  it('reads back a disabled value after writing it', () => {
    writeAutoAdvanceSetting(false);
    expect(readAutoAdvanceSetting()).toBe(false);
  });

  it('stores the setting under the auto-advance key as 1 or 0', () => {
    writeAutoAdvanceSetting(true);
    expect(window.localStorage.getItem('campus-pubquiz-auto-advance')).toBe(
      '1',
    );
    writeAutoAdvanceSetting(false);
    expect(window.localStorage.getItem('campus-pubquiz-auto-advance')).toBe(
      '0',
    );
  });

  it('reads an unrelated stored value as enabled', () => {
    window.localStorage.setItem('campus-pubquiz-auto-advance', '');
    expect(readAutoAdvanceSetting()).toBe(true);
  });

  it('reads back an enabled value after writing it', () => {
    writeAutoAdvanceSetting(false);
    writeAutoAdvanceSetting(true);
    expect(readAutoAdvanceSetting()).toBe(true);
  });
});
