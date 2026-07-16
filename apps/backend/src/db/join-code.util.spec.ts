import { generateJoinCode } from './join-code.util';

describe('generateJoinCode', () => {
  it('generates a 6-character code from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateJoinCode(6)).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(generateJoinCode(6)).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('generates different codes across calls (not a constant)', () => {
    const codes = new Set(
      Array.from({ length: 20 }, () => generateJoinCode(6)),
    );
    expect(codes.size).toBeGreaterThan(1);
  });
});
