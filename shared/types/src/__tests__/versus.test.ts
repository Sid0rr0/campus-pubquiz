import { describe, expect, it } from 'vitest';
import {
  MAX_VERSUS_SIDE_ID_LENGTH,
  VERSUS_SIDE_COLORS,
  VERSUS_SIDE_ID_MESSAGE,
  VERSUS_SIDE_COUNT_MESSAGE,
  VERSUS_SIDE_NAME_MESSAGE,
  versusSettingsRefusal,
  versusSideColor,
} from '../versus';

const side = (id: string, name: string) => ({ id, name });

describe('versusSettingsRefusal', () => {
  it('accepts 2 to 4 distinct named sides', () => {
    expect(
      versusSettingsRefusal({
        versusEnabled: true,
        versusSides: [side('a', 'Law'), side('b', 'Eng')],
      }),
    ).toBeUndefined();
  });

  it('ignores the sides while Versus is off or unnamed', () => {
    expect(
      versusSettingsRefusal({ versusEnabled: false, versusSides: [] }),
    ).toBeUndefined();
    expect(versusSettingsRefusal({ versusSides: [] })).toBeUndefined();
  });

  it('refuses too few and too many sides, and a missing list', () => {
    expect(versusSettingsRefusal({ versusEnabled: true })).toBe(
      VERSUS_SIDE_COUNT_MESSAGE,
    );
    expect(
      versusSettingsRefusal({
        versusEnabled: true,
        versusSides: [side('a', 'A')],
      }),
    ).toBe(VERSUS_SIDE_COUNT_MESSAGE);
    expect(
      versusSettingsRefusal({
        versusEnabled: true,
        versusSides: ['a', 'b', 'c', 'd', 'e'].map((n) => side(n, n)),
      }),
    ).toBe(VERSUS_SIDE_COUNT_MESSAGE);
  });

  it('refuses a blank name and names differing only by case', () => {
    expect(
      versusSettingsRefusal({
        versusEnabled: true,
        versusSides: [side('a', 'A'), side('b', '  ')],
      }),
    ).toBe(VERSUS_SIDE_NAME_MESSAGE);
    expect(
      versusSettingsRefusal({
        versusEnabled: true,
        versusSides: [side('a', 'Law'), side('b', ' LAW')],
      }),
    ).toBe(VERSUS_SIDE_NAME_MESSAGE);
  });
});

describe('versusSettingsRefusal ids', () => {
  it('refuses two sides sharing an id', () => {
    expect(
      versusSettingsRefusal({
        versusEnabled: true,
        versusSides: [side('a', 'Law'), side('a', 'Eng')],
      }),
    ).toBe(VERSUS_SIDE_ID_MESSAGE);
  });

  it('refuses an id longer than the cap', () => {
    expect(
      versusSettingsRefusal({
        versusEnabled: true,
        versusSides: [
          side('x'.repeat(MAX_VERSUS_SIDE_ID_LENGTH + 1), 'Law'),
          side('b', 'Eng'),
        ],
      }),
    ).toBe(VERSUS_SIDE_ID_MESSAGE);
  });
});

describe('versusSideColor', () => {
  it('maps a side position onto the four-colour palette', () => {
    expect(VERSUS_SIDE_COLORS).toHaveLength(4);
    expect(versusSideColor(1)).toBe(VERSUS_SIDE_COLORS[1]);
    expect(versusSideColor(4)).toBe(VERSUS_SIDE_COLORS[0]);
  });
});
