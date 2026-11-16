import { fireEvent, render, screen, within } from '@testing-library/react';
import { Dropdown } from '@/components/ui/Dropdown';

const options = [
  { value: '60', label: '5 years' },
  { value: '12', label: '1 year' },
  { value: '6', label: '6 months' },
];

it('reads as part of a sentence and picks from its list', () => {
  const onChange = jest.fn();
  render(
    <div>
      Clearing it in{' '}
      <Dropdown inline value="60" options={options} onChange={onChange} aria-label="Clear it in" />
    </div>,
  );
  const trigger = screen.getByRole('button', { name: 'Clear it in: 5 years' });
  // The label carries the underline (it doesn't reach in from the button).
  expect(within(trigger).getByText('5 years')).toHaveClass('underline');

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('option', { name: '1 year' }));
  expect(onChange).toHaveBeenCalledWith('12');
});

it('picks with the keyboard', () => {
  const onChange = jest.fn();
  render(
    <Dropdown inline value="60" options={options} onChange={onChange} aria-label="Clear it in" />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear it in: 5 years' }));
  const list = screen.getByRole('listbox');
  fireEvent.keyDown(list, { key: 'End' });
  fireEvent.keyDown(list, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('6');
});

describe('as a toolbar control', () => {
  const platforms = [
    { value: '', label: 'All platforms', count: 20 },
    { value: 'Switch 2', label: 'Switch 2', count: 19 },
    { value: 'N64', label: 'N64', count: 1 },
  ];

  it('says how many games each choice lists, as part of its name', () => {
    render(<Dropdown value="" options={platforms} onChange={jest.fn()} aria-label="Platform" />);
    fireEvent.click(screen.getByRole('button', { name: 'Platform: All platforms' }));

    expect(screen.getByRole('option', { name: 'Switch 2 19 games' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'N64 1 game' })).toBeInTheDocument();
  });

  it('keeps its quiet colors unless given others, and passes classes to its label', () => {
    const { rerender } = render(
      <Dropdown value="" options={platforms} onChange={jest.fn()} aria-label="Platform" />,
    );
    expect(screen.getByRole('button')).toHaveClass('text-ink-300', 'hover:text-ink-50');

    rerender(
      <Dropdown
        value="N64"
        options={platforms}
        onChange={jest.fn()}
        aria-label="Platform"
        triggerTone="text-ink-950"
        labelClassName="truncate"
      />,
    );
    expect(screen.getByRole('button')).toHaveClass('text-ink-950');
    expect(screen.getByRole('button')).not.toHaveClass('text-ink-300');
    expect(within(screen.getByRole('button')).getByText('N64')).toHaveClass('truncate');
  });

  it('opens from the right edge on phones when asked to, and scrolls when the list is long', () => {
    render(
      <Dropdown
        value=""
        options={platforms}
        onChange={jest.fn()}
        aria-label="Platform"
        align="responsive-left"
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toHaveClass(
      'right-0',
      'sm:right-auto',
      'sm:left-0',
      'overflow-y-auto',
    );
  });

  it('scrolls its list, not the page, to keep the highlighted option in sight', () => {
    // Each option 36px tall, in a list with room for two.
    const offsets = jest
      .spyOn(HTMLElement.prototype, 'offsetTop', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return [...(this.parentElement?.children ?? [])].indexOf(this) * 36;
      });
    const heights = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(36);
    const room = jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(72);
    const scrollIntoView = jest.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(<Dropdown value="" options={platforms} onChange={jest.fn()} aria-label="Platform" />);
    fireEvent.click(screen.getByRole('button'));
    const list = screen.getByRole('listbox');
    expect(list.scrollTop).toBe(0);

    fireEvent.keyDown(list, { key: 'End' });
    expect(list.scrollTop).toBe(36);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(list.scrollTop).toBe(0);
    expect(scrollIntoView).not.toHaveBeenCalled();

    offsets.mockRestore();
    heights.mockRestore();
    room.mockRestore();
  });
});
