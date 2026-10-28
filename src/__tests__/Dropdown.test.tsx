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
  // The label carries the underline; it doesn't reach into the stacked labels from the button.
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
