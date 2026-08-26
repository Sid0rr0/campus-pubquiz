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

  it('reads back an enabled value after writing it', () => {
    writeAutoAdvanceSetting(false);
    writeAutoAdvanceSetting(true);
    expect(readAutoAdvanceSetting()).toBe(true);
  });
});
