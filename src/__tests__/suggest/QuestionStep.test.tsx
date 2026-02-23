import { render, screen, fireEvent } from '@testing-library/react';
import { Zap, Leaf, BatteryFull } from 'lucide-react';
import { QuestionStep } from '@/components/suggest/QuestionStep';

describe('QuestionStep', () => {
  const mockOptions = [
    {
      value: 'option1',
      icon: Zap,
      iconClassName: 'text-orange-400',
      label: 'Option One',
      description: 'First option description',
    },
    {
      value: 'option2',
      icon: BatteryFull,
      iconClassName: 'text-emerald-400',
      label: 'Option Two',
      description: 'Second option description',
    },
    {
      value: 'option3',
      icon: Leaf,
      iconClassName: 'text-yellow-400',
      label: 'Option Three',
      description: 'Third option description',
    },
  ];

  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the question title', () => {
    render(
      <QuestionStep
        title="What do you want to feel?"
        options={mockOptions}
        onSelect={mockOnSelect}
      />,
    );

    expect(screen.getByText('What do you want to feel?')).toBeInTheDocument();
  });

  it('should render all options', () => {
    render(<QuestionStep title="Test Question" options={mockOptions} onSelect={mockOnSelect} />);

    expect(screen.getByText('Option One')).toBeInTheDocument();
    expect(screen.getByText('Option Two')).toBeInTheDocument();
    expect(screen.getByText('Option Three')).toBeInTheDocument();
  });

  it('should render option descriptions', () => {
    render(<QuestionStep title="Test Question" options={mockOptions} onSelect={mockOnSelect} />);

    expect(screen.getByText('First option description')).toBeInTheDocument();
    expect(screen.getByText('Second option description')).toBeInTheDocument();
  });

  it('should render an icon for each option', () => {
    const { container } = render(
      <QuestionStep title="Test Question" options={mockOptions} onSelect={mockOnSelect} />,
    );

    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(mockOptions.length);
  });

  it('should call onSelect with correct value when option clicked', () => {
    render(<QuestionStep title="Test Question" options={mockOptions} onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByText('Option Two'));

    expect(mockOnSelect).toHaveBeenCalledWith('option2');
  });

  it('should call onSelect only once per click', () => {
    render(<QuestionStep title="Test Question" options={mockOptions} onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByText('Option One'));

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });
});
