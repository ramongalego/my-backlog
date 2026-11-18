export function celebrateGameFinished() {
  // Loaded on demand: it fires at most once per session, so it stays out of
  // the main bundle.
  import('canvas-confetti')
    .then(({ default: confetti }) => {
      const colors = ['#f97934', '#ff9451', '#fbbf24', '#34d399', '#f7f5f2'];

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors,
        disableForReducedMotion: true,
      });
    })
    .catch(() => {
      // Decorative: a failed chunk load must never break the flow.
    });
}
