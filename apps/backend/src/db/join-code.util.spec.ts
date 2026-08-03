import { generateJoinCode } from '@/db/join-code.util';

describe('generateJoinCode', () => {
  it('generates a 3-word dash-separated uppercase code', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateJoinCode()).toMatch(/^[A-Z]+-[A-Z]+-[A-Z]+$/);
    }
  });

  it('generates different codes across calls (not a constant)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
