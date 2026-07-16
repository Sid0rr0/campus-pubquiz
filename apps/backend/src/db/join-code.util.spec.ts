import { generateJoinCode } from './join-code.util';

describe('generateJoinCode', () => {
  it('generates a 4-character code from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateJoinCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it('generates different codes across calls (not a constant)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
