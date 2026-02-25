import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionResult } from '@/components/suggest/SuggestionResult';
import type { SuggestionResult as SuggestionResultType } from '@/lib/suggest/types';

describe('SuggestionResult', () => {
  const mockSuggestion: SuggestionResultType = {
    game: {
      app_id: 123,
      name: 'Test Game',
      header_image: 'https://example.com/image.jpg',
      main_story_hours: 15,
      genres: ['Action', 'Adventure', 'RPG'],
      tags: ['Singleplayer', 'Story Rich', 'Open World'],
      steam_review_score: 92,
    },
    reasoning: 'This game perfectly matches your mood for adventure and has great reviews.',
  };

  const mockOnPick = jest.fn();
  const mockOnReroll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render game name', () => {
    render(
      <SuggestionResult
        suggestion={mockSuggestion}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={0}
        isLoading={false}
      />,
    );

    expect(screen.getByText('Test Game')).toBeInTheDocument();
  });

  it('should render game duration', () => {
    render(
      <SuggestionResult
        suggestion={mockSuggestion}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={0}
        isLoading={false}
      />,
    );

    expect(screen.getByText('15h')).toBeInTheDocument();
  });

  it('should render genres (limited to 2)', () => {
    render(
      <SuggestionResult
        suggestion={mockSuggestion}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={0}
        isLoading={false}
      />,
    );

    expect(screen.getByText('Action, Adventure')).toBeInTheDocument();
  });

  it('should render AI reasoning', () => {
    render(
      <SuggestionResult
        suggestion={mockSuggestion}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={0}
        isLoading={false}
      />,
    );

    expect(screen.getByText(/This game perfectly matches/)).toBeInTheDocument();
  });

  it('should call onPick when Start Playing button clicked', () => {
    render(
      <SuggestionResult
        suggestion={mockSuggestion}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={0}
        isLoading={false}
      />,
    );

    fireEvent.click(screen.getByText('Start Playing'));

    expect(mockOnPick).toHaveBeenCalledTimes(1);
  });

  it('should call onReroll when Reroll button clicked', () => {
    render(
      <SuggestionResult
        suggestion={mockSuggestion}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={0}
        isLoading={false}
      />,
    );

    fireEvent.click(screen.getByText('Reroll'));

    expect(mockOnReroll).toHaveBeenCalledTimes(1);
  });

  it('should show cooldown timer when on cooldown', () => {
    render(
      <SuggestionResult
        suggestion={mockSuggestion}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={10}
        isLoading={false}
      />,
    );

    expect(screen.getByText('10s')).toBeInTheDocument();
  });

  it('should disable reroll button during cooldown', () => {
    render(
      <SuggestionResult
        suggestion={mockSuggestion}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={5}
        isLoading={false}
      />,
    );

    const rerollButton = screen.getByText('5s').closest('button');
    expect(rerollButton).toBeDisabled();
  });

  it('should disable buttons when loading', () => {
    render(
      <SuggestionResult
        suggestion={mockSuggestion}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={0}
        isLoading={true}
      />,
    );

    expect(screen.getByText('Start Playing').closest('button')).toBeDisabled();
    expect(screen.getByText('Reroll').closest('button')).toBeDisabled();
  });

  it('should handle game without duration', () => {
    const suggestionWithoutDuration: SuggestionResultType = {
      ...mockSuggestion,
      game: {
        ...mockSuggestion.game,
        main_story_hours: null,
      },
    };

    render(
      <SuggestionResult
        suggestion={suggestionWithoutDuration}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={0}
        isLoading={false}
      />,
    );

    expect(screen.queryByText(/\dh$/)).not.toBeInTheDocument();
  });

  it('should handle game without genres', () => {
    const suggestionWithoutGenres: SuggestionResultType = {
      ...mockSuggestion,
      game: {
        ...mockSuggestion.game,
        genres: null,
      },
    };

    render(
      <SuggestionResult
        suggestion={suggestionWithoutGenres}
        onPick={mockOnPick}
        onReroll={mockOnReroll}
        cooldownRemaining={0}
        isLoading={false}
      />,
    );

    expect(screen.getByText('Test Game')).toBeInTheDocument();
  });
});
