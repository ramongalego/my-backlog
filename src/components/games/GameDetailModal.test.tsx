import { render, screen, fireEvent, act } from '@testing-library/react';
import { GameDetailModal } from '@/components/games/GameDetailModal';

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

// The picker has its own tests; here it's the dialog around it that's checked.
jest.mock('@/components/games/detail/ArtPicker', () => ({
  ArtPicker: ({
    onPreview,
    onDone,
    onCancel,
  }: {
    onPreview: (url: string) => void;
    onDone: (url: string) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="art-picker">
      <button onClick={() => onPreview('https://cdn2.steamgriddb.com/grid/pick.png')}>
        Preview
      </button>
      <button onClick={() => onDone('https://cdn2.steamgriddb.com/grid/pick.png')}>Done</button>
      <button onClick={onCancel}>Cancel art</button>
    </div>
  ),
}));

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onConfirm: jest.fn(),
  game: { name: 'Dark Souls', header_image: 'https://example.com/dark-souls.jpg' },
  initialStatus: 'backlog' as const,
};

// Another game is being played, and this dialog can't switch to this one.
const otherPlaying = { name: 'Zelda' };

// Rating and notes are only editable for finished/dropped games.
const reviewProps = { ...defaultProps, initialStatus: 'finished' as const };

describe('GameDetailModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pre-filling initial values', () => {
    it('should pre-fill notes', () => {
      render(<GameDetailModal {...reviewProps} initialNotes="Great game" />);

      expect(screen.getByLabelText(/notes/i)).toHaveValue('Great game');
    });

    it('should pre-fill rating', () => {
      render(<GameDetailModal {...reviewProps} initialRating={8} />);

      expect(screen.getByLabelText(/your rating/i)).toHaveValue(8);
    });

    it('should leave rating empty when not provided', () => {
      render(<GameDetailModal {...reviewProps} />);

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

    it("should show date row with today's date after switching to finished", () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /finished/i }));

      expect(screen.getByTestId('detail-date')).toBeInTheDocument();
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

    it('should be unchecked by default when no date was previously saved', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate={null} />);

      expect(screen.getByRole('checkbox')).not.toBeChecked();
      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();
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
      fireEvent.click(screen.getByLabelText(/add the date/i)); // re-check

      expect(screen.getByTestId('detail-date')).toBeInTheDocument();
    });

    it('should pass empty string for date when unchecked', async () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      fireEvent.click(screen.getByLabelText(/finished on/i));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', '', '', null);
    });

    it('should pass the date when checked', async () => {
      render(
        <GameDetailModal {...defaultProps} initialStatus="finished" initialDate="2024-06-15" />,
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', '2024-06-15', '', null);
    });
  });

  describe('null/empty initialDate behaviour', () => {
    it('should not render date button when initialDate is null', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate={null} />);

      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();
    });

    it('should not render date button when initialDate is empty string', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate="" />);

      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();
    });

    it('should show a valid date (not "Invalid Date") after checking the checkbox with null initialDate', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate={null} />);

      fireEvent.click(screen.getByRole('checkbox'));

      const dateButton = screen.getByTestId('detail-date');
      expect(dateButton).toBeInTheDocument();
      expect(dateButton).not.toHaveTextContent('Invalid Date');
    });

    it('should pass empty string when saving without checking the date (null initialDate)', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate={null} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', '', '', null);
    });

    it("should pass today's date when checking then saving with null initialDate", async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" initialDate={null} />);

      fireEvent.click(screen.getByRole('checkbox'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      const today = new Date().toISOString().slice(0, 10);
      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', today, '', null);
    });
  });

  describe('onConfirm callback', () => {
    it('should call onConfirm with current status, date, notes and rating', async () => {
      render(
        <GameDetailModal
          {...defaultProps}
          initialStatus="finished"
          initialDate="2024-06-15"
          initialNotes="Good game"
          initialRating={9}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', '2024-06-15', 'Good game', 9);
    });

    it('should call onConfirm with null rating when field is empty', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('backlog', expect.any(String), '', null);
    });

    it('should call onConfirm with updated status after switching', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      fireEvent.click(screen.getByRole('button', { name: /finished/i }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', expect.any(String), '', null);
    });

    it('should call onConfirm with updated notes', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" />);

      fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Amazing!' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith(
        'finished',
        expect.any(String),
        'Amazing!',
        null,
      );
    });
  });

  describe('rating validation', () => {
    it('should block save and show error when rating is above 10', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" />);

      fireEvent.change(screen.getByLabelText(/your rating/i), { target: { value: '88' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      expect(screen.getByText('Rating must be between 0 and 10')).toBeInTheDocument();
    });

    it('should block save and show error when rating is below 0', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" />);

      fireEvent.change(screen.getByLabelText(/your rating/i), { target: { value: '-1' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      expect(screen.getByText('Rating must be between 0 and 10')).toBeInTheDocument();
    });

    it('should clear the error when the rating is corrected', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" />);

      fireEvent.change(screen.getByLabelText(/your rating/i), { target: { value: '88' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(screen.getByText('Rating must be between 0 and 10')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/your rating/i), { target: { value: '8' } });

      expect(screen.queryByText('Rating must be between 0 and 10')).not.toBeInTheDocument();
    });

    it('should allow save with rating of 0', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" />);

      fireEvent.change(screen.getByLabelText(/your rating/i), { target: { value: '0' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', expect.any(String), '', 0);
    });

    it('should allow save with rating of 10', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="finished" />);

      fireEvent.change(screen.getByLabelText(/your rating/i), { target: { value: '10' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', expect.any(String), '', 10);
    });
  });

  describe('playing status pill', () => {
    it('should render the playing pill', () => {
      render(<GameDetailModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /^playing$/i })).toBeInTheDocument();
    });

    it('should select playing when the pill is clicked', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

      fireEvent.click(screen.getByRole('button', { name: /^playing$/i }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('playing', expect.any(String), '', null);
    });

    it('should pre-select playing when initialStatus is playing', async () => {
      render(<GameDetailModal {...defaultProps} initialStatus="playing" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('playing', expect.any(String), '', null);
    });

    it('should not show date field for playing status', () => {
      render(<GameDetailModal {...defaultProps} initialStatus="playing" />);

      expect(screen.queryByTestId('detail-date')).not.toBeInTheDocument();
    });

    describe('while another game is being played', () => {
      it('should hide the playing pill when it cannot be switched to', () => {
        render(
          <GameDetailModal {...defaultProps} initialStatus="backlog" playing={otherPlaying} />,
        );

        expect(screen.queryByRole('button', { name: /^playing$/i })).not.toBeInTheDocument();
      });

      it('should show the playing pill when nothing else is playing', () => {
        render(<GameDetailModal {...defaultProps} />);

        expect(screen.getByRole('button', { name: /^playing$/i })).toBeInTheDocument();
      });
    });

    describe('Queue pill', () => {
      const onAddToQueue = jest.fn();

      beforeEach(() => {
        onAddToQueue.mockClear();
      });

      it('should show Queue pill when another game is playing and onAddToQueue is provided for a backlog game', () => {
        render(
          <GameDetailModal
            {...defaultProps}
            initialStatus="backlog"
            playing={otherPlaying}
            onAddToQueue={onAddToQueue}
          />,
        );

        expect(screen.getByRole('button', { name: /queue/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^playing$/i })).not.toBeInTheDocument();
      });

      it('should not show Queue pill when onAddToQueue is not provided', () => {
        render(
          <GameDetailModal {...defaultProps} initialStatus="backlog" playing={otherPlaying} />,
        );

        expect(screen.queryByRole('button', { name: /queue/i })).not.toBeInTheDocument();
      });

      it('should select Queue pill on click without immediately acting', () => {
        render(
          <GameDetailModal
            {...defaultProps}
            initialStatus="backlog"
            playing={otherPlaying}
            onAddToQueue={onAddToQueue}
          />,
        );

        fireEvent.click(screen.getByRole('button', { name: /queue/i }));

        expect(onAddToQueue).not.toHaveBeenCalled();
        expect(defaultProps.onClose).not.toHaveBeenCalled();
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      });

      it('should call onAddToQueue and onClose (not onConfirm) when saving with Queue selected', () => {
        render(
          <GameDetailModal
            {...defaultProps}
            initialStatus="backlog"
            playing={otherPlaying}
            onAddToQueue={onAddToQueue}
          />,
        );

        fireEvent.click(screen.getByRole('button', { name: /queue/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(onAddToQueue).toHaveBeenCalledTimes(1);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      });
    });
  });

  describe('playing instead of the game being played', () => {
    const onAddToQueue = jest.fn();
    const onPlayInstead = jest.fn();
    const switchProps = {
      ...defaultProps,
      playing: { name: 'Zelda', onPlayInstead },
      onAddToQueue,
    };
    const statusLabels = () =>
      Array.from(
        screen.getByRole('group', { name: 'Status' }).querySelectorAll('button'),
        (b) => b.textContent,
      );

    beforeEach(() => {
      onAddToQueue.mockClear();
      onPlayInstead.mockClear();
    });

    it('offers Queue and Playing side by side, four to a row', () => {
      render(<GameDetailModal {...switchProps} />);

      expect(statusLabels()).toEqual([
        'Backlog',
        'Queue',
        'Playing',
        'Finished',
        'Dropped',
        "Won't Play",
        'Hidden',
      ]);
      expect(screen.getByRole('group', { name: 'Status' })).toHaveClass('grid-cols-4');
    });

    it('says the game being played goes to the top of the queue', () => {
      render(<GameDetailModal {...switchProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Playing' }));

      expect(screen.getByText('Zelda goes to the top of your queue.')).toBeInTheDocument();
    });

    it('switches on save, instead of saving a status', async () => {
      render(<GameDetailModal {...switchProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Playing' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });

      expect(onPlayInstead).toHaveBeenCalledTimes(1);
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      expect(onAddToQueue).not.toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('works for a finished game too (a replay), without Queue', () => {
      render(
        <GameDetailModal {...switchProps} initialStatus="finished" onAddToQueue={undefined} />,
      );

      expect(statusLabels()).toEqual([
        'Backlog',
        'Playing',
        'Finished',
        'Dropped',
        "Won't Play",
        'Hidden',
      ]);
    });

    it("doesn't offer Playing for a game that isn't out yet", () => {
      const nextYear = new Date().getFullYear() + 1;
      render(
        <GameDetailModal
          {...switchProps}
          game={{ ...defaultProps.game, release_date: `Jan 28, ${nextYear}` }}
        />,
      );

      expect(statusLabels()).not.toContain('Playing');
      expect(statusLabels()).toContain('Queue');
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

describe('GameDetailModal review fields', () => {
  it('should hide rating and notes for statuses the API does not store them for', () => {
    render(<GameDetailModal {...defaultProps} initialStatus="backlog" />);

    expect(screen.queryByLabelText(/your rating/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/notes/i)).not.toBeInTheDocument();
  });

  it('should warn before hiding a reviewed game clears its review', async () => {
    render(<GameDetailModal {...reviewProps} initialNotes="Loved it" initialRating={9} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /hidden/i }));
    });

    expect(screen.getByText(/will clear the rating and notes/i)).toBeInTheDocument();
  });
});

describe('GameDetailModal as a form', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves on Enter in a field', async () => {
    render(<GameDetailModal {...reviewProps} initialDate="2024-06-15" />);

    fireEvent.change(screen.getByLabelText(/your rating/i), { target: { value: '7' } });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText(/your rating/i).closest('form')!);
    });

    expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', '2024-06-15', '', 7);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('keeps the dialog open with the error when the save fails', async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error('Could not reach the server'));
    render(<GameDetailModal {...defaultProps} onConfirm={onConfirm} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server');
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('lets the actions under it act without saving the dialog', () => {
    const onDelete = jest.fn();
    render(
      <GameDetailModal
        {...defaultProps}
        manual={{ platform: 'Switch', onSaveHours: jest.fn(), onDelete }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove from library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onDelete).toHaveBeenCalled();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  describe('a queued game', () => {
    const onRemove = jest.fn();
    const onAddToQueue = jest.fn();
    const onPlayInstead = jest.fn();
    const queuedProps = { ...defaultProps, queued: { onRemove } };
    const statusLabels = () =>
      Array.from(
        screen.getByRole('group', { name: 'Status' }).querySelectorAll('button'),
        (b) => b.textContent,
      );
    const selected = () =>
      screen.getByRole('group', { name: 'Status' }).querySelector('button[aria-pressed="true"]')
        ?.textContent;
    const save = async () => {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      });
    };
    const all = ['Backlog', 'Queue', 'Playing', 'Finished', 'Dropped', "Won't Play", 'Hidden'];

    beforeEach(() => {
      onRemove.mockClear();
      onAddToQueue.mockClear();
      onPlayInstead.mockClear();
    });

    it('shows Queue as its status, with nothing playing', () => {
      render(<GameDetailModal {...queuedProps} />);
      expect(statusLabels()).toEqual(all);
      expect(selected()).toBe('Queue');
    });

    it('shows Queue as its status while another game plays, beside Playing to switch', () => {
      render(<GameDetailModal {...queuedProps} playing={{ name: 'Zelda', onPlayInstead }} />);
      expect(statusLabels()).toEqual(all);
      expect(selected()).toBe('Queue');
    });

    it("has no Playing while another game plays and it can't switch", () => {
      render(<GameDetailModal {...queuedProps} playing={otherPlaying} />);
      expect(statusLabels()).toEqual(all.filter((label) => label !== 'Playing'));
    });

    it('changes nothing when saved as it is', async () => {
      render(<GameDetailModal {...queuedProps} onAddToQueue={onAddToQueue} />);
      await save();
      expect(onRemove).not.toHaveBeenCalled();
      expect(onAddToQueue).not.toHaveBeenCalled();
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('comes off the queue when Backlog is chosen', async () => {
      render(<GameDetailModal {...queuedProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Backlog' }));
      await save();
      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('saves any other status as a status change', async () => {
      render(<GameDetailModal {...queuedProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Finished' }));
      await save();
      expect(defaultProps.onConfirm).toHaveBeenCalledWith('finished', expect.any(String), '', null);
      expect(onRemove).not.toHaveBeenCalled();
    });

    it('starts it when Playing is chosen with nothing playing', async () => {
      render(<GameDetailModal {...queuedProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Playing' }));
      await save();
      expect(defaultProps.onConfirm).toHaveBeenCalledWith('playing', '', '', null);
    });
  });

  describe('choosing art', () => {
    const artButton = () => screen.queryByRole('button', { name: 'Choose art' });

    it('is offered for a game in the library, on its art', () => {
      render(<GameDetailModal {...defaultProps} art={{ gameId: 7 }} />);
      expect(artButton()).toBeInTheDocument();
    });

    it("isn't offered without the game's id, or for a game still being added", () => {
      const { unmount } = render(<GameDetailModal {...defaultProps} />);
      expect(artButton()).not.toBeInTheDocument();
      unmount();

      render(
        <GameDetailModal
          {...defaultProps}
          art={{ gameId: 7 }}
          adding={{
            consoles: ['Switch'],
            defaultConsole: 'Switch',
            year: 2020,
            playingName: null,
            onAdd: jest.fn(),
            onChangeGame: jest.fn(),
          }}
        />,
      );
      expect(artButton()).not.toBeInTheDocument();
    });

    it('swaps the fields for the picker, previews a pick in the header, and comes back', async () => {
      render(<GameDetailModal {...defaultProps} art={{ gameId: 7 }} />);
      fireEvent.click(artButton()!);

      // The picker is there; the status fields are kept, out of sight.
      expect(screen.getByTestId('art-picker')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Status', hidden: true })).not.toBeVisible();
      expect(artButton()).not.toBeInTheDocument();

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Preview' })));
      expect(document.querySelector('img[src="https://cdn2.steamgriddb.com/grid/pick.png"]')).toBe(
        document.querySelector('img'),
      );

      // Saved: the fields are back, the header keeps the new art, and focus
      // returns to the button that opened the picker.
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Done' })));
      expect(screen.queryByTestId('art-picker')).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Status' })).toBeVisible();
      expect(document.querySelector('img')).toHaveAttribute(
        'src',
        'https://cdn2.steamgriddb.com/grid/pick.png',
      );
      expect(artButton()).toHaveFocus();
    });

    it('goes back to the art it had when the picker is cancelled', async () => {
      render(<GameDetailModal {...defaultProps} art={{ gameId: 7 }} />);
      fireEvent.click(artButton()!);
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Preview' })));
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel art' })));

      expect(document.querySelector('img')).toHaveAttribute(
        'src',
        'https://example.com/dark-souls.jpg',
      );
    });
  });

  it('offers no Queue for a backlog game that is not queued, with nothing playing', () => {
    render(<GameDetailModal {...defaultProps} onAddToQueue={jest.fn()} />);
    const labels = Array.from(
      screen.getByRole('group', { name: 'Status' }).querySelectorAll('button'),
      (b) => b.textContent,
    );
    expect(labels).toEqual(['Backlog', 'Playing', 'Finished', 'Dropped', "Won't Play", 'Hidden']);
  });
});
