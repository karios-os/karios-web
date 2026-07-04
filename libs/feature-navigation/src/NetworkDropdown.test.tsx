import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import NetworkDropdown from './NetworkDropdown';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  NavLink: ({ children, to, onClick, className, onMouseEnter, onMouseLeave }: any) => (
    <div
      data-testid="nav-link"
      data-to={to}
      onClick={onClick}
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  ),
}));

jest.mock('iconsax-react', () => ({
  Wifi: ({ color }: any) => <div data-testid="wifi-icon" data-color={color} />,
  ArrowDown2: ({ color }: any) => <div data-testid="arrow-down-icon" data-color={color} />,
  ArrowUp2: ({ color }: any) => <div data-testid="arrow-up-icon" data-color={color} />,
  Setting3: ({ color }: any) => <div data-testid="setting-icon" data-color={color} />,
}));

jest.mock('./ServerTopBar', () => ({
  NavItem: ({ to, icon: Icon, label, onClick, isActive }: any) => (
    <div data-testid="nav-item" data-to={to} data-active={isActive} onClick={onClick}>
      <Icon />
      <span>{label}</span>
    </div>
  ),
}));

const defaultProps = {
  dataCenterId: 'dc1',
  currentView: 'switches',
  onOptionSelect: jest.fn(),
  isActive: false,
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('NetworkDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('renders network dropdown button with correct text and icon', () => {
    renderWithRouter(<NetworkDropdown {...defaultProps} />);
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByTestId('wifi-icon')).toBeInTheDocument();
    expect(screen.getByTestId('arrow-down-icon')).toBeInTheDocument();
  });

  test('toggles dropdown when button is clicked', async () => {
    renderWithRouter(<NetworkDropdown {...defaultProps} />);
    const button = screen.getByText('Network').closest('div');

    fireEvent.click(button!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search network options...')).toBeInTheDocument();
    });

    expect(screen.getByTestId('arrow-up-icon')).toBeInTheDocument();
  });

  test('shows active state when currentView matches network options', () => {
    renderWithRouter(<NetworkDropdown {...defaultProps} currentView="switches" />);
    const wifiIcon = screen.getByTestId('wifi-icon');
    expect(wifiIcon).toHaveAttribute('data-color', '#221d57');
  });

  test('shows active state when isActive prop is true', () => {
    renderWithRouter(<NetworkDropdown {...defaultProps} isActive={true} />);
    const wifiIcon = screen.getByTestId('wifi-icon');
    expect(wifiIcon).toHaveAttribute('data-color', '#221d57');
  });

  test('filters options based on search input', async () => {
    renderWithRouter(<NetworkDropdown {...defaultProps} />);
    const button = screen.getByText('Network').closest('div');

    fireEvent.click(button!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search network options...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search network options...');
    fireEvent.change(searchInput, { target: { value: 'switch' } });

    expect(screen.getByText('Switches')).toBeInTheDocument();
    expect(screen.queryByText('Interface')).not.toBeInTheDocument();
  });

  test('shows no results message when search yields empty results', async () => {
    renderWithRouter(<NetworkDropdown {...defaultProps} />);
    const button = screen.getByText('Network').closest('div');

    fireEvent.click(button!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search network options...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search network options...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No options found')).toBeInTheDocument();
  });

  test('calls onOptionSelect when option is clicked', async () => {
    const mockOnOptionSelect = jest.fn();
    renderWithRouter(<NetworkDropdown {...defaultProps} onOptionSelect={mockOnOptionSelect} />);

    const button = screen.getByText('Network').closest('div');
    fireEvent.click(button!);

    await waitFor(() => {
      expect(screen.getByText('Switches')).toBeInTheDocument();
    });

    const switchesOption = screen.getByText('Switches').closest('[data-testid="nav-item"]');
    fireEvent.click(switchesOption!);

    expect(mockOnOptionSelect).toHaveBeenCalledWith('switches');
  });

  test('closes dropdown when option is selected', async () => {
    renderWithRouter(<NetworkDropdown {...defaultProps} />);
    const button = screen.getByText('Network').closest('div');

    fireEvent.click(button!);

    await waitFor(() => {
      expect(screen.getByText('Switches')).toBeInTheDocument();
    });

    const switchesOption = screen.getByText('Switches').closest('[data-testid="nav-item"]');
    fireEvent.click(switchesOption!);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search network options...')).not.toBeInTheDocument();
    });
  });

  test('closes dropdown when clicking outside', async () => {
    renderWithRouter(<NetworkDropdown {...defaultProps} />);
    const button = screen.getByText('Network').closest('div');

    fireEvent.click(button!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search network options...')).toBeInTheDocument();
    });

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search network options...')).not.toBeInTheDocument();
    });
  });
});
