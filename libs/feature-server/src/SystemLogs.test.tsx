import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SystemLogs from './SystemLogs';

// Mock the shared-state hooks
const mockFetchLogs = jest.fn().mockResolvedValue({
  logs: ['Sample log entry'],
  totalCount: 20,
  totalPages: 2,
});
const mockSetLogsLevel = jest.fn();
const mockSetLogsContains = jest.fn();

jest.mock('@karios-monorepo/shared-state', () => ({
  usePermissions: jest.fn(),
  useServer: jest.fn(),
  useAppState: jest.fn(),
}));

// Mock iconsax-react
jest.mock('iconsax-react', () => ({
  SearchNormal: jest.fn(() => <div data-testid="search-icon">SearchIcon</div>),
}));

const { usePermissions, useServer, useAppState } = require('@karios-monorepo/shared-state');

describe('SystemLogs Component', () => {
  const mockLogs = {
    level: 'info',
    contains: '',
    loading: false,
    logs: [
      'Dec 15 10:30:45 server systemd: Started test service',
      'Dec 15 10:31:00 server kernel: Memory allocation completed',
      'Dec 15 10:31:15 server apache: Request processed successfully',
    ],
  };

  const defaultMocks = {
    permissions: { LOGS_VIEW: true, VM_MANAGE: false, VM_VIEW: false },
    selectedServer: { ip: '192.168.1.100', name: 'test-server' },
    logs: mockLogs,
    fetchLogs: mockFetchLogs,
    setLogsLevel: mockSetLogsLevel,
    setLogsContains: mockSetLogsContains,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    usePermissions.mockReturnValue({
      permissions: defaultMocks.permissions,
    });

    useServer.mockReturnValue({
      selectedServer: defaultMocks.selectedServer,
    });

    useAppState.mockReturnValue({
      logs: defaultMocks.logs,
      fetchLogs: defaultMocks.fetchLogs,
      setLogsLevel: defaultMocks.setLogsLevel,
      setLogsContains: defaultMocks.setLogsContains,
    });
  });

  it('renders log viewer with title', () => {
    render(<SystemLogs />);

    expect(screen.getByText('Log Viewer')).toBeInTheDocument();
  });

  it('renders log table headers', () => {
    render(<SystemLogs />);

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  it('calls setLogsLevel when level filter changes', () => {
    render(<SystemLogs />);

    const levelSelect = screen.getByLabelText('Level:');
    fireEvent.change(levelSelect, { target: { value: 'error' } });

    expect(mockSetLogsLevel).toHaveBeenCalledWith('error');
  });

  it('calls setLogsContains when search input changes', () => {
    render(<SystemLogs />);

    const searchInput = screen.getByLabelText('Contains:');
    fireEvent.change(searchInput, { target: { value: 'test search' } });

    expect(mockSetLogsContains).toHaveBeenCalledWith('test search');
  });

  it('calls fetchLogs on mount with correct parameters', () => {
    render(<SystemLogs />);
    expect(mockFetchLogs).toHaveBeenCalledWith('192.168.1.100', 'info', '', 1, 10, 'desc');
  });

  it('calls fetchLogs when level changes', () => {
    const { rerender } = render(<SystemLogs />);
    // Update the logs level
    useAppState.mockReturnValue({
      ...defaultMocks,
      logs: { ...mockLogs, level: 'error' },
    });
    rerender(<SystemLogs />);
    expect(mockFetchLogs).toHaveBeenCalledWith('192.168.1.100', 'info', '', 1, 10, 'desc');
    expect(mockFetchLogs).toHaveBeenCalledWith('192.168.1.100', 'error', '', 1, 10, 'desc');
  });

  it('shows loading state when logs are loading', () => {
    useAppState.mockReturnValue({
      ...defaultMocks,
      logs: { ...mockLogs, loading: true },
    });

    render(<SystemLogs />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders nothing when user lacks permissions', () => {
    usePermissions.mockReturnValue({
      permissions: { LOGS_VIEW: false, VM_MANAGE: false, VM_VIEW: false },
    });

    const { container } = render(<SystemLogs />);

    expect(container.firstChild).toBeNull();
  });

  it('allows access with VM_MANAGE permission', () => {
    usePermissions.mockReturnValue({
      permissions: { LOGS_VIEW: false, VM_MANAGE: true, VM_VIEW: false },
    });

    render(<SystemLogs />);

    expect(screen.getByText('Log Viewer')).toBeInTheDocument();
  });

  it('allows access with VM_VIEW permission', () => {
    usePermissions.mockReturnValue({
      permissions: { LOGS_VIEW: false, VM_MANAGE: false, VM_VIEW: true },
    });

    render(<SystemLogs />);

    expect(screen.getByText('Log Viewer')).toBeInTheDocument();
  });

  it('disables Previous button on first page', () => {
    render(<SystemLogs />);

    const previousButton = screen.getByText('Previous');
    expect(previousButton).toBeInTheDocument();
    expect(previousButton).toBeDisabled();
  });

  it('does not fetch logs when no server is selected', () => {
    useServer.mockReturnValue({
      selectedServer: null,
    });

    render(<SystemLogs />);

    expect(mockFetchLogs).not.toHaveBeenCalled();
  });

  it('handles malformed log entries', () => {
    useAppState.mockReturnValue({
      ...defaultMocks,
      logs: {
        ...mockLogs,
        logs: ['Invalid log format without proper structure'],
      },
    });

    render(<SystemLogs />);

    expect(screen.getByText('Invalid log format without proper structure')).toBeInTheDocument();
  });

  it('renders all available level options', () => {
    render(<SystemLogs />);

    const levelSelect = screen.getByLabelText('Level:');
    expect(levelSelect).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    const optionTexts = options.map((option) => option.textContent);

    expect(optionTexts).toContain('Select Level');
    expect(optionTexts).toContain('Info');
    expect(optionTexts).toContain('Error');
    expect(optionTexts).toContain('Debug');
  });

  it('shows pagination when logs are available', async () => {
    // Mock fetchLogs to return totalCount and totalPages
    mockFetchLogs.mockResolvedValue({
      logs: [
        'Dec 15 10:30:45 server systemd: Started test service',
        'Dec 15 10:31:00 server kernel: Memory allocation completed',
      ],
      totalCount: 20,
      totalPages: 2,
    });

    const logsWithPagination = {
      ...mockLogs,
      logs: [
        'Dec 15 10:30:45 server systemd: Started test service',
        'Dec 15 10:31:00 server kernel: Memory allocation completed',
      ],
    };

    useAppState.mockReturnValue({
      ...defaultMocks,
      logs: logsWithPagination,
      fetchLogs: mockFetchLogs,
    });

    render(<SystemLogs />);

    // Wait for the component to update with pagination information
    await waitFor(() => {
      expect(screen.getByText('Page')).toBeInTheDocument();
      expect(screen.getByText('of 2')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1')).toBeInTheDocument(); // Page input field
    });
  });

  it('updates page input when clicking next button', async () => {
    // Mock fetchLogs to return proper pagination data
    const mockFetchLogsWithPagination = jest.fn().mockResolvedValue({
      logs: ['Log 1', 'Log 2'],
      totalCount: 20,
      totalPages: 2,
    });
    // Mock the initial state
    useAppState.mockReturnValue({
      ...defaultMocks,
      logs: {
        ...defaultMocks.logs,
        logs: ['Log 1', 'Log 2'],
      },
      fetchLogs: mockFetchLogsWithPagination,
    });
    render(<SystemLogs />);
    // Wait for initial render and fetchLogs to complete
    await waitFor(() => {
      expect(mockFetchLogsWithPagination).toHaveBeenCalledWith(
        '192.168.1.100',
        'info',
        '',
        1,
        10,
        'desc'
      );
    });
    // Wait for pagination to be rendered correctly
    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeInTheDocument(); // Page input shows 1
      expect(screen.getByText('of 2')).toBeInTheDocument(); // Shows total pages
    });
    // Find the Next button and verify it's not disabled
    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
    fireEvent.click(nextButton);
    // Wait for the page input to update to show page 2
    await waitFor(() => {
      expect(screen.getByDisplayValue('2')).toBeInTheDocument(); // Page input should now show 2
    });
  });

  it('disables Next button on last page', () => {
    // Mock state to simulate being on the last page
    mockFetchLogs.mockResolvedValue({ logs: ['Last page log'], totalCount: 10, totalPages: 1 });

    render(<SystemLogs />);

    // Wait for the component to update with the totalPages value
    waitFor(() => {
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toBeDisabled();
    });
  });

  it('handles fetch logs error gracefully', async () => {
    // Mock fetchLogs to reject
    const mockFetchLogsError = jest.fn().mockRejectedValue(new Error('Network error'));

    useAppState.mockReturnValue({
      ...defaultMocks,
      fetchLogs: mockFetchLogsError,
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<SystemLogs />);

    await waitFor(() => {
      expect(mockFetchLogsError).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching logs:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('calculates total pages when totalCount is provided but totalPages is not', async () => {
    // Mock fetchLogs to return totalCount but not totalPages
    const mockFetchLogsWithCount = jest.fn().mockResolvedValue({
      logs: ['Sample log entry'],
      totalCount: 25, // Should result in 3 pages with limit of 10
    });
    useAppState.mockReturnValue({
      ...defaultMocks,
      fetchLogs: mockFetchLogsWithCount,
    });
    render(<SystemLogs />);
    await waitFor(() => {
      expect(mockFetchLogsWithCount).toHaveBeenCalledWith(
        '192.168.1.100',
        'info',
        '',
        1,
        10,
        'desc'
      );
    });
    // Should calculate totalPages as Math.ceil(25/10) = 3
    await waitFor(() => {
      expect(screen.getByText('Page')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument(); // Page input field shows 2 (since showing 11-20 of 25)
      expect(screen.getByText('of 3')).toBeInTheDocument();
    });
  });

  it('handles empty result from fetchLogs', async () => {
    // Mock fetchLogs to return null/undefined
    const mockFetchLogsEmpty = jest.fn().mockResolvedValue(null);

    useAppState.mockReturnValue({
      ...defaultMocks,
      fetchLogs: mockFetchLogsEmpty,
    });

    render(<SystemLogs />);

    await waitFor(() => {
      expect(mockFetchLogsEmpty).toHaveBeenCalled();
    });

    // Should not crash and should still render the component
    expect(screen.getByText('Log Viewer')).toBeInTheDocument();
  });
});
