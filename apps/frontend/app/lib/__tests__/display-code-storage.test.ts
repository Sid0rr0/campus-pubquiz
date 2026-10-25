import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearStoredDisplayCode,
  readStoredDisplayCode,
  storeDisplayCode,
} from '@/app/lib/display-code-storage';

describe('display-code-storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('reads null when nothing is stored', () => {
    expect(readStoredDisplayCode()).toBeNull();
  });

  it('stores the code under the display-code key and reads it back', () => {
    storeDisplayCode('ABC123');
    expect(window.localStorage.getItem('campus-pubquiz-display-code')).toBe(
      'ABC123',
    );
    expect(readStoredDisplayCode()).toBe('ABC123');
  });

  it('forgets the code when cleared', () => {
    window.localStorage.setItem('campus-pubquiz-display-code', 'ABC123');
    clearStoredDisplayCode();
    expect(
      window.localStorage.getItem('campus-pubquiz-display-code'),
    ).toBeNull();
  });
});
