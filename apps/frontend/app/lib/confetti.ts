import confetti from 'canvas-confetti';

const BURST_PARTICLES = 140;
const BURST_SPREAD = 90;

/** One celebratory burst. Off under prefers-reduced-motion; never throws. */
export function fireConfetti(): void {
  try {
    void confetti({
      disableForReducedMotion: true,
      particleCount: BURST_PARTICLES,
      spread: BURST_SPREAD,
      origin: { y: 0.6 },
    });
  } catch {
    // Confetti is decoration; a canvas failure must not break the screen.
  }
}
