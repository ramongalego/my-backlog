export function celebrateGameFinished() {
  // Loaded on demand: confetti fires at most once per session, so keep
  // canvas-confetti out of the main bundle.
  import('canvas-confetti')
    .then(({ default: confetti }) => {
      const colors = ['#f97934', '#ff9451', '#fbbf24', '#34d399', '#f7f5f2'];

      // Single satisfying burst from center
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors,
        disableForReducedMotion: true,
      });
    })
    .catch(() => {
      // Purely decorative; never let a failed chunk load break the flow.
    });
}
