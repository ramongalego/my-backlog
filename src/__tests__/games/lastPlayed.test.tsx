import { render, screen } from '@testing-library/react';
import { GameMetaRow } from '@/components/games/GameCardInfo';
import { steamLastPlayed } from '@/lib/games/consoles';

const today = new Date().toISOString();

describe('steamLastPlayed', () => {
  it("shows Steam's date for a game played on Steam", () => {
    expect(steamLastPlayed({ source: 'steam', platform: 'PC', last_played_at: today })).toBe(today);
  });

  it("hides the stored date for a console game, Steam's moved there or added by hand", () => {
    expect(
      steamLastPlayed({ source: 'steam', platform: 'Switch', last_played_at: today }),
    ).toBeNull();
    expect(
      steamLastPlayed({ source: 'manual', platform: 'PS5', last_played_at: today }),
    ).toBeNull();
  });
});

describe('GameMetaRow', () => {
  it('doesn\'t put a console game\'s date (or "on Steam") in the hours tooltip', () => {
    render(<GameMetaRow playtimeMinutes={300} lastPlayedAt={today} platform="Switch" />);
    expect(screen.queryByText(/Last played/)).not.toBeInTheDocument();
    expect(screen.queryByText(/on Steam/)).not.toBeInTheDocument();
  });

  it("keeps Steam's date for a Steam game", () => {
    render(<GameMetaRow playtimeMinutes={300} lastPlayedAt={today} />);
    expect(screen.getByText(/Last played/)).toBeInTheDocument();
  });
});
