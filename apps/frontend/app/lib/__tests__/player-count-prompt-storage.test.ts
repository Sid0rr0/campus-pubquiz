import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readPlayerCountPromptDecision,
  readPlayerCountPromptDismissed,
  writePlayerCountPromptDecision,
  writePlayerCountPromptDismissed,
} from '@/app/lib/player-count-prompt-storage';

describe('player-count-prompt-storage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  describe('dismissed', () => {
    it('is not dismissed until written', () => {
      expect(readPlayerCountPromptDismissed('JOIN')).toBe(false);
    });

    it('remembers the dismissal per join code', () => {
      writePlayerCountPromptDismissed('JOIN');
      expect(readPlayerCountPromptDismissed('JOIN')).toBe(true);
      expect(readPlayerCountPromptDismissed('OTHER')).toBe(false);
      expect(
        window.localStorage.getItem(
          'campus-pubquiz-player-count-dismissed-JOIN',
        ),
      ).toBe('1');
    });

    it('reads as not dismissed when storage is blocked', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(() => window.localStorage.getItem('x')).toThrow('blocked');
      expect(readPlayerCountPromptDismissed('JOIN')).toBe(false);
    });

    it('does not throw when storage is blocked on write', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(() => writePlayerCountPromptDismissed('JOIN')).not.toThrow();
    });
  });

  describe('decision', () => {
    it('is null before a decision is written', () => {
      expect(readPlayerCountPromptDecision('JOIN')).toBeNull();
    });

    it('remembers a decision to ask, per join code', () => {
      writePlayerCountPromptDecision('JOIN', true);
      expect(readPlayerCountPromptDecision('JOIN')).toBe(true);
      expect(readPlayerCountPromptDecision('OTHER')).toBeNull();
      expect(
        window.localStorage.getItem('campus-pubquiz-player-count-asked-JOIN'),
      ).toBe('1');
    });

    it('remembers a decision not to ask as false, not as undecided', () => {
      writePlayerCountPromptDecision('JOIN', false);
      expect(readPlayerCountPromptDecision('JOIN')).toBe(false);
      expect(
        window.localStorage.getItem('campus-pubquiz-player-count-asked-JOIN'),
      ).toBe('0');
    });

    it('reads as undecided when storage is blocked', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(readPlayerCountPromptDecision('JOIN')).toBeNull();
    });

    it('does not throw when storage is blocked on write', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(() => writePlayerCountPromptDecision('JOIN', true)).not.toThrow();
    });
  });
});
