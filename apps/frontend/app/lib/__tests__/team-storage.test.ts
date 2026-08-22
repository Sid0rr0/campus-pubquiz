import { describe, expect, it } from 'vitest';
import { normalizeJoinCode } from '@/app/lib/team-storage';

describe('normalizeJoinCode', () => {
  it('trims surrounding whitespace and uppercases the code', () => {
    expect(normalizeJoinCode(' abcdef ')).toBe('ABCDEF');
  });

  it('leaves an already-normalized code unchanged', () => {
    expect(normalizeJoinCode('BOLD-AMBER-OTTER')).toBe('BOLD-AMBER-OTTER');
  });

  it('returns an empty string when given only whitespace', () => {
    expect(normalizeJoinCode('   ')).toBe('');
  });
});
