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

      expect(screen.getByTestId('detail-date')).toHaveTextContent('Jun 15, 2024');
    });

    it('should pre-fill date for dropped game', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="dropped" initialDate="2024-03-01" />,
      );

      expect(screen.getByTestId('detail-date')).toHaveTextContent('Mar 1, 2024');
    });
  });

  describe('date field visibility', () => {
    it('should not show date field for backlog status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      expect(screen.queryByLabelText(/finished on|dropped on/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();
    });

    it('should not show date field for hidden status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="hidden" />);

      expect(screen.queryByLabelText(/finished on|dropped on/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();
    });

    it('should show "Finished on" label and date input for finished status with a date', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      expect(screen.getByLabelText(/finished on/i)).toBeInTheDocument();
      expect(screen.getByTestId('detail-date')).toBeInTheDocument();
    });

    it('should show "Dropped on" label and date input for dropped status with a date', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="dropped" initialDate="2024-03-01" />,
      );

      expect(screen.getByLabelText(/dropped on/i)).toBeInTheDocument();
      expect(screen.getByTestId('detail-date')).toBeInTheDocument();
    });

    it('should show date row after switching to finished', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      expect(screen.queryByLabelText(/no date selected/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /finished/i }));

      expect(screen.getByLabelText(/no date selected/i)).toBeInTheDocument();
    });

    it('should hide date field after switching from finished to hidden', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      expect(screen.getByTestId('detail-date')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /hidden/i }));

      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();
    });

    it('should update label when switching from finished to dropped', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      expect(screen.getByLabelText(/finished on/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /dropped/i }));

      expect(screen.queryByLabelText(/finished on/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/dropped on/i)).toBeInTheDocument();
    });
  });

  describe('date checkbox', () => {
    it('should be checked by default when a date is provided', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      expect(screen.getByLabelText(/finished on/i)).toBeChecked();
    });

    it('should be unchecked by default when no date is saved', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate={null} />);

      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('should be unchecked by default when initialDate is empty string', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate="" />);

      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('should hide date input when unchecked', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      fireEvent.click(screen.getByLabelText(/finished on/i));

      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();
    });

    it('should show date input again when re-checked', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      fireEvent.click(screen.getByLabelText(/finished on/i)); // uncheck
      fireEvent.click(screen.getByLabelText(/no date selected/i)); // re-check

      expect(screen.getByTestId('detail-date')).toBeInTheDocument();
    });

    it('should pass empty string for date when unchecked', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      fireEvent.click(screen.getByLabelText(/finished on/i));
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', '', '', null);
    });

    it('should pass the date when checked', () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', '2024-06-15', '', null);
    });
  });

  describe('null/empty initialDate bug regression', () => {
    it('should not render date button when initialDate is null', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate={null} />);

      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();
    });

    it('should not render date button when initialDate is empty string', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate="" />);

      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();
    });

    it('should show a valid date (not "Invalid Date") when checkbox is checked after null initialDate', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate={null} />);

      fireEvent.click(screen.getByLabelText(/no date selected/i));

      const dateButton = screen.getByTestId('detail-date');
      expect(dateButton).toBeInTheDocument();
      expect(dateButton).not.toHaveTextContent('Invalid Date');
    });

    it('should pass empty string when saving with null initialDate and unchecked checkbox', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate={null} />);

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', '', '', null);
    });

    it('should pass today date when saving after checking checkbox with null initialDate', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate={null} />);

      fireEvent.click(screen.getByLabelText(/no date selected/i));
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      const today = new Date().toISOString().slice(0, 10);
      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', today, '', null);
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

  describe('pick this game', () => {
    it('should show start playing button only for backlog status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      expect(screen.getByRole('button', { name: /start playing/i })).toBeInTheDocument();
    });

    it('should not show start playing button for finished status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" />);

      expect(screen.queryByRole('button', { name: /start playing/i })).not.toBeInTheDocument();
    });

    it('should not show start playing button for dropped status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="dropped" />);

      expect(screen.queryByRole('button', { name: /start playing/i })).not.toBeInTheDocument();
    });

    it('should not show start playing button for hidden status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="hidden" />);

      expect(screen.queryByRole('button', { name: /start playing/i })).not.toBeInTheDocument();
    });

    it('should keep same label when toggled active', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      fireEvent.click(screen.getByRole('button', { name: /start playing/i }));

      expect(screen.getByRole('button', { name: /start playing/i })).toBeInTheDocument();
    });

    it('should call onConfirm with playing status when active and saved', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      fireEvent.click(screen.getByRole('button', { name: /start playing/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('playing', expect.any(String), '', null);
    });

    it('should reset when switching away from backlog', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      fireEvent.click(screen.getByRole('button', { name: /start playing/i }));
      fireEvent.click(screen.getByRole('button', { name: /^finished$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^backlog$/i }));

      // Should not pass playing after reset
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect(defaultProps.onConfirm).toHaveBeenCalledWith('backlog', expect.any(String), '', null);
    });

    it('should not pass playing status when not active', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('backlog', expect.any(String), '', null);
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
