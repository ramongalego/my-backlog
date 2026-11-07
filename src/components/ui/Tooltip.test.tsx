import { fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from '@/components/ui/Tooltip';

// jsdom has no PointerEvent, so give a plain one the pointer type React reads.
function pointerDown(target: Element, pointerType: string) {
  const event = new MouseEvent('pointerdown', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  fireEvent(target, event);
}

function card(onOpen: () => void, tip = <Tooltip content="Releases Nov 5">Out Nov 5</Tooltip>) {
  return render(
    <button type="button" onClick={onOpen}>
      Celeste {tip}
    </button>,
  );
}

it('shows the tooltip on a tap, without opening the card it sits on', () => {
  const onOpen = jest.fn();
  card(onOpen);

  const trigger = screen.getByText('Out Nov 5');
  pointerDown(trigger, 'touch');
  fireEvent.click(trigger);

  expect(onOpen).not.toHaveBeenCalled();
  expect(document.body).toHaveTextContent('Releases Nov 5');
});

it('lets a mouse click through, since hovering already showed it', () => {
  const onOpen = jest.fn();
  card(onOpen);

  const trigger = screen.getByText('Out Nov 5');
  pointerDown(trigger, 'mouse');
  fireEvent.click(trigger);

  expect(onOpen).toHaveBeenCalled();
});

it('still lets a tap reach a button inside the tooltip', () => {
  const onMove = jest.fn();
  render(
    <Tooltip content="Move to top">
      <button type="button" onClick={onMove}>
        Top
      </button>
    </Tooltip>,
  );

  const button = screen.getByRole('button', { name: 'Top' });
  pointerDown(button, 'touch');
  fireEvent.click(button);

  expect(onMove).toHaveBeenCalled();
});
