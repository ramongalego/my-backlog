export function celebrateGameFinished() {
  // Loaded on demand: confetti fires at most once per session, so keep
  // canvas-confetti out of the main bundle.
  import('canvas-confetti')
    .then(({ default: confetti }) => {
      const colors = ['#a855f7', '#d946ef', '#fbbf24', '#f59e0b', '#ffffff'];

      // Single satisfying burst from center
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors,
      });
    })
    .catch(() => {
      // Purely decorative; never let a failed chunk load break the flow.
    });
}
