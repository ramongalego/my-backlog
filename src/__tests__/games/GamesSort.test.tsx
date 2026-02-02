import { render, screen, fireEvent } from '@testing-library/react';
import { GamesSort } from '@/components/games/GamesSort';

describe('GamesSort', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render with all sort options', () => {
      render(<GamesSort value='playtime' onChange={mockOnChange} />);

      expect(screen.getByText('Most Played')).toBeInTheDocument();
      expect(screen.getByText('Highest Rated')).toBeInTheDocument();
      expect(screen.getByText('Most Recent')).toBeInTheDocument();
    });

    it('should display selected sort option', () => {
      render(<GamesSort value='score' onChange={mockOnChange} />);

      expect(screen.getByRole('combobox')).toHaveValue('score');
    });

    it('should default to playtime sort', () => {
      render(<GamesSort value='playtime' onChange={mockOnChange} />);

      expect(screen.getByRole('combobox')).toHaveValue('playtime');
    });
  });

  describe('interactions', () => {
    it('should call onChange when selecting Most Played', () => {
      render(<GamesSort value='score' onChange={mockOnChange} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'playtime' } });

      expect(mockOnChange).toHaveBeenCalledWith('playtime');
    });

    it('should call onChange when selecting Highest Rated', () => {
      render(<GamesSort value='playtime' onChange={mockOnChange} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'score' } });

      expect(mockOnChange).toHaveBeenCalledWith('score');
    });

    it('should call onChange when selecting Most Recent', () => {
      render(<GamesSort value='playtime' onChange={mockOnChange} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'recent' } });

      expect(mockOnChange).toHaveBeenCalledWith('recent');
    });
  });
});
