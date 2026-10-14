import { describe, expect, it } from 'vitest';
import { createLiveChangeGate } from '@/app/lib/live-change';

describe('createLiveChangeGate', () => {
  it('does not fire on the first snapshot after connect', () => {
    const gate = createLiveChangeGate();

    expect(gate.observe(5)).toBe(false);
  });

  it('fires once on a forward move into a new position', () => {
    const gate = createLiveChangeGate();
    gate.observe(5);

    expect(gate.observe(6)).toBe(true);
    expect(gate.observe(6)).toBe(false);
  });

  it('does not fire on a Previous move', () => {
    const gate = createLiveChangeGate();
    gate.observe(5);

    expect(gate.observe(4)).toBe(false);
  });

  it('fires again on a forward move after a Previous move', () => {
    const gate = createLiveChangeGate();
    gate.observe(5);
    gate.observe(4);

    expect(gate.observe(5)).toBe(true);
  });

  it('treats the first snapshot after a reset as a fresh load', () => {
    const gate = createLiveChangeGate();
    gate.observe(5);
    gate.reset();

    expect(gate.observe(9)).toBe(false);
    expect(gate.observe(10)).toBe(true);
  });
});
