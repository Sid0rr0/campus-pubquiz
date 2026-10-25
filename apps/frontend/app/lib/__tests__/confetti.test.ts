import { describe, expect, it, vi } from 'vitest';
import { fireConfetti } from '@/app/lib/confetti';

const { confettiMock } = vi.hoisted(() => ({ confettiMock: vi.fn() }));

vi.mock('canvas-confetti', () => ({ default: confettiMock }));

describe('fireConfetti', () => {
  it('fires one burst that is off under reduced motion', async () => {
    fireConfetti();

    await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(1));
    expect(confettiMock).toHaveBeenCalledWith({
      disableForReducedMotion: true,
      particleCount: 140,
      spread: 90,
      origin: { y: 0.6 },
    });
  });

  it('never throws when the canvas library fails', async () => {
    confettiMock.mockImplementationOnce(() => {
      throw new Error('no canvas');
    });

    expect(() => fireConfetti()).not.toThrow();
    await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(2));
  });
});
