import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '@/components/ui/Modal';

// The trap moves focus itself only where Tab would leave the dialog; anywhere
// else the browser's own Tab does the work. So these press Tab at the edges
// and check whether the dialog stepped in.
const tab = (shiftKey = false) => fireEvent.keyDown(document, { key: 'Tab', shiftKey });

const renderDialog = (saveDisabled = false) =>
  render(
    <>
      <button>Behind the dialog</button>
      <Modal isOpen title="Add a game" onClose={() => {}}>
        <input aria-label="Name" />
        <input type="hidden" name="token" />
        <button>Cancel</button>
        <button disabled={saveDisabled}>Save</button>
      </Modal>
    </>,
  );

it('wraps from the last control back to the first', () => {
  renderDialog();
  screen.getByRole('button', { name: 'Save' }).focus();

  tab();

  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
});

it('wraps backwards from the first control to the last', () => {
  renderDialog();
  screen.getByRole('button', { name: 'Close' }).focus();

  tab(true);

  expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
});

it('treats the last enabled control as the last stop when the one after it is disabled', () => {
  renderDialog(true);
  screen.getByRole('button', { name: 'Cancel' }).focus();

  // Before, the disabled Save counted as the last stop, so Tab from Cancel
  // was left to the browser, which moved on to the page behind.
  tab();

  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
});

it('goes backwards to the last enabled control, not a disabled one', () => {
  renderDialog(true);
  screen.getByRole('button', { name: 'Close' }).focus();

  tab(true);

  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
});

it('brings focus back in when it has ended up outside the dialog', () => {
  renderDialog();
  screen.getByRole('button', { name: 'Behind the dialog' }).focus();

  tab();
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

  screen.getByRole('button', { name: 'Behind the dialog' }).focus();
  tab(true);
  expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
});

it('leaves Tab alone in the middle of the dialog', () => {
  renderDialog();
  screen.getByRole('textbox', { name: 'Name' }).focus();

  const notPrevented = tab();

  expect(notPrevented).toBe(true);
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
});

describe('when it closes', () => {
  const onOpenerGone = jest.fn();
  beforeEach(() => onOpenerGone.mockClear());

  function Opened({ open, opener = true }: { open: boolean; opener?: boolean }) {
    return (
      <>
        {opener && <button>Open</button>}
        <Modal isOpen={open} title="Pick" onClose={() => {}} onOpenerGone={onOpenerGone}>
          <button>Inside</button>
        </Modal>
      </>
    );
  }

  /** Opens the dialog from the Open button, as a click on it would. */
  function open() {
    const view = render(<Opened open={false} />);
    screen.getByRole('button', { name: 'Open' }).focus();
    view.rerender(<Opened open />);
    return view;
  }

  it('gives focus back to the control that opened it', () => {
    const view = open();
    view.rerender(<Opened open={false} />);
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    expect(onOpenerGone).not.toHaveBeenCalled();
  });

  it('asks the parent where focus goes when that control is gone', () => {
    const view = open();
    // The dialog replaced what opened it (a place it filled, say).
    view.rerender(<Opened open opener={false} />);
    expect(onOpenerGone).not.toHaveBeenCalled();

    view.rerender(<Opened open={false} opener={false} />);
    expect(onOpenerGone).toHaveBeenCalledTimes(1);
  });
});
