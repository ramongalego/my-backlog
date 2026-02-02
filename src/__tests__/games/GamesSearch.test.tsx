import { render, screen, fireEvent } from '@testing-library/react';
import { GamesSearch } from '@/components/games/GamesSearch';

describe('GamesSearch', () => {
  const mockOnSearchChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render search input with placeholder', () => {
      render(
        <GamesSearch
          value=''
          onSearchChange={mockOnSearchChange}
        />
      );

      expect(screen.getByPlaceholderText('Search games...')).toBeInTheDocument();
    });

    it('should render with the provided value', () => {
      render(
        <GamesSearch
          value='zelda'
          onSearchChange={mockOnSearchChange}
        />
      );

      expect(screen.getByDisplayValue('zelda')).toBeInTheDocument();
    });

    it('should render search icon', () => {
      const { container } = render(
        <GamesSearch
          value=''
          onSearchChange={mockOnSearchChange}
        />
      );

      const svgIcon = container.querySelector('svg');
      expect(svgIcon).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onSearchChange when typing', () => {
      render(
        <GamesSearch
          value=''
          onSearchChange={mockOnSearchChange}
        />
      );

      const input = screen.getByPlaceholderText('Search games...');
      fireEvent.change(input, { target: { value: 'mario' } });

      expect(mockOnSearchChange).toHaveBeenCalledWith('mario');
    });

    it('should call onSearchChange on each keystroke', () => {
      render(
        <GamesSearch
          value=''
          onSearchChange={mockOnSearchChange}
        />
      );

      const input = screen.getByPlaceholderText('Search games...');

      fireEvent.change(input, { target: { value: 'm' } });
      fireEvent.change(input, { target: { value: 'ma' } });
      fireEvent.change(input, { target: { value: 'mar' } });

      expect(mockOnSearchChange).toHaveBeenCalledTimes(3);
      expect(mockOnSearchChange).toHaveBeenNthCalledWith(1, 'm');
      expect(mockOnSearchChange).toHaveBeenNthCalledWith(2, 'ma');
      expect(mockOnSearchChange).toHaveBeenNthCalledWith(3, 'mar');
    });

    it('should call onSearchChange with empty string when cleared', () => {
      render(
        <GamesSearch
          value='test'
          onSearchChange={mockOnSearchChange}
        />
      );

      const input = screen.getByPlaceholderText('Search games...');
      fireEvent.change(input, { target: { value: '' } });

      expect(mockOnSearchChange).toHaveBeenCalledWith('');
    });
  });
});
