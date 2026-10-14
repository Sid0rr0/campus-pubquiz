const BURST_PARTICLES = 140;
const BURST_SPREAD = 90;

/**
 * One celebratory burst. Off under prefers-reduced-motion; never throws.
 * The library is loaded on first use: it touches canvas APIs at import time,
 * which the server render and the test DOM don't have.
 */
export function fireConfetti(): void {
  import('canvas-confetti')
    .then(({ default: confetti }) =>
      confetti({
        disableForReducedMotion: true,
        particleCount: BURST_PARTICLES,
        spread: BURST_SPREAD,
        origin: { y: 0.6 },
      }),
    )
    .catch(() => {
      // Confetti is decoration; a canvas failure must not break the screen.
    });
}
