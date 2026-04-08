import { render, screen, fireEvent } from '@testing-library/react';
import { GameCarousel } from '@/components/GameCarousel';

jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({
    alt,
    fill,
    ...props
  }: {
    alt: string;
    fill?: boolean;
    [key: string]: unknown;
  }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} data-fill={fill ? 'true' : undefined} {...props} />;
  },
}));

const mockGames = [
  {
    app_id: 1,
    name: 'Game One',
    header_image: 'https://cdn.steam.com/game1.jpg',
    main_story_hours: 3,
    playtime_forever: 0,
  },
  {
    app_id: 2,
    name: 'Game Two',
    header_image: 'https://cdn.steam.com/game2.jpg',
    main_story_hours: 4.5,
    playtime_forever: 0,
  },
  {
    app_id: 3,
    name: 'Game Three',
    header_image: null,
    main_story_hours: 2,
    playtime_forever: 0,
  },
];

describe('GameCarousel', () => {
  it('should render nothing when games array is empty', () => {
    const { container } = render(<GameCarousel title="Empty" games={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('should display hours to beat for each game', () => {
    render(<GameCarousel title="Test Games" games={mockGames} />);

    expect(screen.getByText('3h')).toBeInTheDocument();
    expect(screen.getByText('4.5h')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('should disable left scroll button initially', () => {
    render(<GameCarousel title="Test" games={mockGames} />);

    expect(screen.getByLabelText('Scroll left')).toBeDisabled();
  });

  it('should call onOpenDetail with the correct game when clicked', () => {
    const mockOpenDetail = jest.fn();
    render(<GameCarousel title="Test" games={mockGames} onOpenDetail={mockOpenDetail} />);

    const buttons = screen.getAllByRole('button', { name: /open details for/i });
    fireEvent.click(buttons[1]);

    expect(mockOpenDetail).toHaveBeenCalledWith(mockGames[1]);
  });
});
