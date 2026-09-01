import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import {
  resolveSessionSettings,
  sessionSettingsPartialSchema,
} from '@/session/session-settings.schema';

describe('sessionSettingsPartialSchema', () => {
  it('accepts an empty object — every field is optional', () => {
    const result = sessionSettingsPartialSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it('accepts a fully-specified partial', () => {
    const result = sessionSettingsPartialSchema.safeParse({
      lockGraceSeconds: 15,
      enabledBonusCategories: ['shot'],
      autoplayMedia: false,
      playLockCountdownSound: false,
      rules: ['Be nice.'],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      lockGraceSeconds: 15,
      enabledBonusCategories: ['shot'],
      autoplayMedia: false,
      playLockCountdownSound: false,
      rules: ['Be nice.'],
    });
  });

  it('rejects a non-positive lockGraceSeconds', () => {
    expect(
      sessionSettingsPartialSchema.safeParse({ lockGraceSeconds: 0 }).success,
    ).toBe(false);
    expect(
      sessionSettingsPartialSchema.safeParse({ lockGraceSeconds: -5 }).success,
    ).toBe(false);
  });

  it('rejects a non-integer lockGraceSeconds', () => {
    expect(
      sessionSettingsPartialSchema.safeParse({ lockGraceSeconds: 15.5 })
        .success,
    ).toBe(false);
  });

  it('rejects an empty enabledBonusCategories array', () => {
    expect(
      sessionSettingsPartialSchema.safeParse({ enabledBonusCategories: [] })
        .success,
    ).toBe(false);
  });

  it('rejects an unknown bonus category', () => {
    expect(
      sessionSettingsPartialSchema.safeParse({
        enabledBonusCategories: ['jackpot'],
      }).success,
    ).toBe(false);
  });

  it('rejects an empty (blank/whitespace) rule string', () => {
    expect(
      sessionSettingsPartialSchema.safeParse({ rules: [''] }).success,
    ).toBe(false);
    expect(
      sessionSettingsPartialSchema.safeParse({ rules: ['   '] }).success,
    ).toBe(false);
  });

  it('trims rule strings', () => {
    const result = sessionSettingsPartialSchema.safeParse({
      rules: ['  Be nice.  '],
    });

    expect(result.success).toBe(true);
    expect(result.data?.rules).toEqual(['Be nice.']);
  });

  it('rejects a non-boolean autoplayMedia', () => {
    expect(
      sessionSettingsPartialSchema.safeParse({ autoplayMedia: 'yes' }).success,
    ).toBe(false);
  });

  it('rejects a non-boolean playLockCountdownSound', () => {
    expect(
      sessionSettingsPartialSchema.safeParse({ playLockCountdownSound: 'yes' })
        .success,
    ).toBe(false);
  });

  it('accepts a partial maxBonusAwardsPerCategory map', () => {
    const result = sessionSettingsPartialSchema.safeParse({
      maxBonusAwardsPerCategory: { shot: 2, selfie: 1 },
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      maxBonusAwardsPerCategory: { shot: 2, selfie: 1 },
    });
  });

  it('accepts an empty maxBonusAwardsPerCategory map', () => {
    expect(
      sessionSettingsPartialSchema.safeParse({ maxBonusAwardsPerCategory: {} })
        .success,
    ).toBe(true);
  });

  it('rejects a non-positive maxBonusAwardsPerCategory value', () => {
    expect(
      sessionSettingsPartialSchema.safeParse({
        maxBonusAwardsPerCategory: { shot: 0 },
      }).success,
    ).toBe(false);
  });

  it('rejects a non-integer maxBonusAwardsPerCategory value', () => {
    expect(
      sessionSettingsPartialSchema.safeParse({
        maxBonusAwardsPerCategory: { shot: 1.5 },
      }).success,
    ).toBe(false);
  });

  it('strips an unknown category key from maxBonusAwardsPerCategory', () => {
    const result = sessionSettingsPartialSchema.safeParse({
      maxBonusAwardsPerCategory: { jackpot: 1 },
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ maxBonusAwardsPerCategory: {} });
  });
});

describe('resolveSessionSettings', () => {
  it('returns the exact defaults when the partial is empty', () => {
    expect(resolveSessionSettings({})).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('overrides only the fields present in the partial', () => {
    const resolved = resolveSessionSettings({ lockGraceSeconds: 15 });

    expect(resolved).toEqual({
      ...DEFAULT_SESSION_SETTINGS,
      lockGraceSeconds: 15,
    });
  });

  it('leaves every unspecified field at its default value', () => {
    const resolved = resolveSessionSettings({ autoplayMedia: false });

    expect(resolved.lockGraceSeconds).toBe(
      DEFAULT_SESSION_SETTINGS.lockGraceSeconds,
    );
    expect(resolved.enabledBonusCategories).toEqual(
      DEFAULT_SESSION_SETTINGS.enabledBonusCategories,
    );
    expect(resolved.rules).toEqual(DEFAULT_SESSION_SETTINGS.rules);
    expect(resolved.autoplayMedia).toBe(false);
    expect(resolved.maxBonusAwardsPerCategory).toEqual(
      DEFAULT_SESSION_SETTINGS.maxBonusAwardsPerCategory,
    );
  });

  it('overrides maxBonusAwardsPerCategory when present in the partial', () => {
    const resolved = resolveSessionSettings({
      maxBonusAwardsPerCategory: { shot: 2, selfie: 1 },
    });

    expect(resolved.maxBonusAwardsPerCategory).toEqual({
      shot: 2,
      selfie: 1,
    });
  });
});
