import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_SHORTCUTS } from '@/app/control/admin-keyboard-shortcuts';
import {
  isNotDelivered,
  NOT_CONNECTED_MESSAGE,
} from '@/app/lib/connection-messages';
import { DISPLAY_CODE_STORAGE_KEY } from '@/app/lib/display-code-storage';
import {
  writePlayerCountPromptDecision,
  writePlayerCountPromptDismissed,
} from '@/app/lib/player-count-prompt-storage';
import { AUTO_ADVANCE_STORAGE_KEY } from '@/app/lib/player-settings-storage';
import {
  VERDICT_TONE_BORDER_CLASS,
  VERDICT_TONE_TEXT_CLASS,
} from '@/app/play/verdict-card';

describe('fixed strings other code and saved data depend on', () => {
  it('keeps the storage keys phones already hold', () => {
    expect(DISPLAY_CODE_STORAGE_KEY).toBe('campus-pubquiz-display-code');
    expect(AUTO_ADVANCE_STORAGE_KEY).toBe('campus-pubquiz-auto-advance');
  });

  describe('the player-count prompt keys', () => {
    beforeEach(() => window.localStorage.clear());

    it('are namespaced per session code', () => {
      writePlayerCountPromptDismissed('ABC');
      writePlayerCountPromptDecision('ABC', true);
      expect(Object.keys(window.localStorage).sort()).toEqual([
        'campus-pubquiz-player-count-asked-ABC',
        'campus-pubquiz-player-count-dismissed-ABC',
      ]);
    });
  });

  it('words every admin shortcut for the guide', () => {
    for (const shortcut of Object.values(ADMIN_SHORTCUTS)) {
      expect(shortcut.keyName.trim()).not.toBe('');
      expect(shortcut.description.trim()).not.toBe('');
    }
  });

  it('gives every verdict tone its own text and border class', () => {
    for (const classes of [
      VERDICT_TONE_TEXT_CLASS,
      VERDICT_TONE_BORDER_CLASS,
    ]) {
      const values = Object.values(classes);
      expect(values.every((c) => c.trim() !== '')).toBe(true);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe('isNotDelivered', () => {
  it('is true only for the not-connected failure', () => {
    expect(
      isNotDelivered({ success: false, error: NOT_CONNECTED_MESSAGE }),
    ).toBe(true);
    expect(isNotDelivered({ success: false, error: 'Nope' })).toBe(false);
    expect(NOT_CONNECTED_MESSAGE.trim()).not.toBe('');
  });
});
