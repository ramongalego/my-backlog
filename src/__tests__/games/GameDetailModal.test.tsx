import { render, screen, fireEvent } from '@testing-library/react';
import { GameDetailModal } from '@/components/games/GameStatusModal';

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

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onConfirm: jest.fn(),
  gameName: 'Dark Souls',
  headerImage: 'https://example.com/dark-souls.jpg',
  initialStatus: 'backlog' as const,
};

describe('GameDetailModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render game name', () => {
      render(<GameDetailModal {...defaultProps} />);

      expect(screen.getByText('Dark Souls')).toBeInTheDocument();
    });

    it('should render game image when provided', () => {
      render(<GameDetailModal {...defaultProps} />);

      expect(screen.getByAltText('Dark Souls')).toHaveAttribute(
        'src',
        'https://example.com/dark-souls.jpg',
      );
    });

    it('should render placeholder when no image', () => {
      render(<GameDetailModal {...defaultProps} headerImage={null} />);

      expect(screen.queryByAltText('Dark Souls')).not.toBeInTheDocument();
    });

    it('should render all four status options', () => {
      render(<GameDetailModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /backlog/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /finished/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /dropped/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /hidden/i })).toBeInTheDocument();
    });

    it('should render rating and notes fields', () => {
      render(<GameDetailModal {...defaultProps} />);

      expect(screen.getByLabelText(/your rating/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it('should render Save Changes and Cancel buttons', () => {
      render(<GameDetailModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<GameDetailModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Dark Souls')).not.toBeInTheDocument();
    });
  });

  describe('pre-filling initial values', () => {
    it('should pre-fill notes', () => {
      render(<GameDetailModal {...defaultProps} initialNotes="Great game" />);

      expect(screen.getByLabelText(/notes/i)).toHaveValue('Great game');
    });

    it('should pre-fill rating', () => {
      render(<GameDetailModal {...defaultProps} initialRating={8} />);

      expect(screen.getByLabelText(/your rating/i)).toHaveValue(8);
    });

    it('should leave rating empty when not provided', () => {
      render(<GameDetailModal {...defaultProps} />);

      expect(screen.getByLabelText(/your rating/i)).toHaveValue(null);
    });

    it('should pre-fill date for finished game', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      expect(screen.getByLabelText(/finished on/i)).toHaveValue('2024-06-15');
    });

    it('should pre-fill date for dropped game', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="dropped" initialDate="2024-03-01" />,
      );

      expect(screen.getByLabelText(/dropped on/i)).toHaveValue('2024-03-01');
    });
  });

  describe('date field visibility', () => {
    it('should not show date field for backlog status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      expect(screen.queryByLabelText(/finished on|dropped on/i)).not.toBeInTheDocument();
    });

    it('should not show date field for hidden status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="hidden" />);

      expect(screen.queryByLabelText(/finished on|dropped on/i)).not.toBeInTheDocument();
    });

    it('should show "Finished on" date field for finished status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" />);

      expect(screen.getByLabelText(/finished on/i)).toBeInTheDocument();
    });

    it('should show "Dropped on" date field for dropped status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="dropped" />);

      expect(screen.getByLabelText(/dropped on/i)).toBeInTheDocument();
    });

    it('should show date field after switching to finished', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      expect(screen.queryByLabelText(/finished on/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /finished/i }));

      expect(screen.getByLabelText(/finished on/i)).toBeInTheDocument();
    });

    it('should hide date field after switching from finished to hidden', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" />);

      expect(screen.getByLabelText(/finished on/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /hidden/i }));

      expect(screen.queryByLabelText(/finished on|dropped on/i)).not.toBeInTheDocument();
    });

    it('should update label when switching from finished to dropped', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" />);

      expect(screen.getByLabelText(/finished on/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /dropped/i }));

      expect(screen.queryByLabelText(/finished on/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/dropped on/i)).toBeInTheDocument();
    });
  });

  describe('onConfirm callback', () => {
    it('should call onConfirm with current status, date, notes and rating', () => {
      render(
        <GameDetailModal
          {...defaultProps}
          initialStatus="finished"
          initialDate="2024-06-15"
          initialNotes="Good game"
          initialRating={9}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', '2024-06-15', 'Good game', 9);
    });

    it('should call onConfirm with null rating when field is empty', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('backlog', expect.any(String), '', null);
    });

    it('should call onConfirm with updated status after switching', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      fireEvent.click(screen.getByRole('button', { name: /finished/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', expect.any(String), '', null);
    });

    it('should call onConfirm with updated notes', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Amazing!' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith(
        'backlog',
        expect.any(String),
        'Amazing!',
        null,
      );
    });
  });

  describe('onClose callback', () => {
    it('should call onClose when Cancel is clicked', () => {
      render(<GameDetailModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
