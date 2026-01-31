import confetti from 'canvas-confetti';

export function celebrateGameFinished() {
  const colors = ['#a855f7', '#d946ef', '#fbbf24', '#f59e0b', '#ffffff'];

  // Single satisfying burst from center
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.6 },
    colors,
  });
}
