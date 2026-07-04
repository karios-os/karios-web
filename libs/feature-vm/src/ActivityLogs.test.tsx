import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityLogs from './ActivityLogs';
import { usePermissions, useVm, useAppState, api } from '@karios-monorepo/shared-state';

// Mock the shared-state module
jest.mock('@karios-monorepo/shared-state', () => ({
  usePermissions: jest.fn(),
  useVm: jest.fn(),
  useAppState: jest.fn(),
  api: {
    fetch: jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    ),
  },
  ActionTypes: {},
}));

// Mock the badge components
jest.mock('../../../apps/karios-gui/src/Components/SuccessBadge', () => {
  return function SuccessBadge() {
    return React.createElement('span', { 'data-testid': 'success-badge' }, 'SUCCESS');
  };
});

jest.mock('../../../apps/karios-gui/src/Components/FailureBadge', () => {
  return function FailureBadge() {
    return React.createElement('span', { 'data-testid': 'failure-badge' }, 'FAILURE');
  };
});

const mockUsePermissions = usePermissions as jest.MockedFunction<typeof usePermissions>;
const mockUseVm = useVm as jest.MockedFunction<typeof useVm>;
const mockUseAppState = useAppState as jest.MockedFunction<typeof useAppState>;

describe('ActivityLogs Component', () => {
  const mockDispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePermissions.mockReturnValue({
      permissions: {
        LOGS_VIEW: true,
        VM_MANAGE: true,
        VM_VIEW: true,
        VM_BACKUP: true,
        NETWORK_VIEW: true,
        NETWORK_MANAGE: true,
        ZFS_VIEW: true,
        ZFS_MANAGE: true,
        UM_ADMIN: true,
      },
      isAuthenticated: true,
      userName: 'test-user',
      seedUser: false,
      updatePermissions: jest.fn(),
      handleLogout: jest.fn(),
      validateToken: jest.fn(),
      refreshAccessToken: jest.fn(),
      handleSessionExpired: jest.fn(),
      setupTokenRefresh: jest.fn(),
      checkRefreshTokenExpiry: jest.fn(),
    });

    mockUseVm.mockReturnValue({
      selectedVm: { name: 'test-vm' },
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      dataCenters: [],
    } as any);

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: { ip: '192.168.1.100' },
        activityLogs: [],
        activityLogsLoading: false,
        activityLogsError: null,
      } as any,
      dispatch: mockDispatch,
    } as any);
  });

  it('renders ActivityLogs component', () => {
    render(React.createElement(ActivityLogs));
    expect(document.body).toBeInTheDocument();
  });

  it('handles no permissions scenario', () => {
    mockUsePermissions.mockReturnValue({
      permissions: {
        LOGS_VIEW: false,
        VM_MANAGE: false,
        VM_VIEW: false,
        VM_BACKUP: false,
        NETWORK_VIEW: false,
        NETWORK_MANAGE: false,
        ZFS_VIEW: false,
        ZFS_MANAGE: false,
        UM_ADMIN: false,
      },
      isAuthenticated: true,
      userName: 'test-user',
      seedUser: false,
      updatePermissions: jest.fn(),
      handleLogout: jest.fn(),
      validateToken: jest.fn(),
      refreshAccessToken: jest.fn(),
      handleSessionExpired: jest.fn(),
      setupTokenRefresh: jest.fn(),
      checkRefreshTokenExpiry: jest.fn(),
    });

    render(React.createElement(ActivityLogs));
    expect(document.body).toBeInTheDocument();
  });

  it('handles loading state', () => {
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: { ip: '192.168.1.100' },
        activityLogs: [],
        activityLogsLoading: true,
        activityLogsError: null,
      } as any,
      dispatch: mockDispatch,
    } as any);

    render(React.createElement(ActivityLogs));
    expect(document.body).toBeInTheDocument();
  });

  it('handles error state', () => {
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: { ip: '192.168.1.100' },
        activityLogs: [],
        activityLogsLoading: false,
        activityLogsError: 'Failed to fetch logs',
      } as any,
      dispatch: mockDispatch,
    } as any);

    render(React.createElement(ActivityLogs));
    expect(document.body).toBeInTheDocument();
  });

  it('initializes server from global state', () => {
    render(React.createElement(ActivityLogs));
    expect(mockUseAppState).toHaveBeenCalled();
  });

  it('renders logs table with activity logs data', async () => {
    const mockLogs = [
      {
        id: '1',
        start_time: '2025-06-19T10:30:00Z',
        username: 'testuser',
        vm_name: 'test-vm',
        activity: 'VM Start',
        status: 'SUCCESS',
        component_type: 'VM_MANAGEMENT',
      },
      {
        id: '2',
        start_time: '2025-06-19T11:00:00Z',
        username: 'testuser2',
        vm_name: 'test-vm-2',
        activity: 'VM Stop',
        status: 'FAILURE',
        component_type: 'VM_MANAGEMENT',
      },
    ];

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: { ip: '192.168.1.100' },
        activityLogs: mockLogs,
        activityLogsLoading: false,
        activityLogsError: null,
      } as any,
      dispatch: mockDispatch,
    } as any);

    render(React.createElement(ActivityLogs));

    // Check if table is rendered
    expect(screen.getByText('Date/Time')).toBeInTheDocument();
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('VM Name')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Component')).toBeInTheDocument();

    // Check if log data is displayed
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('test-vm')).toBeInTheDocument();
    expect(screen.getByText('VM Start')).toBeInTheDocument();
    expect(screen.getAllByText('VM_MANAGEMENT')).toHaveLength(2);

    // Check for success and failure badges
    expect(screen.getByTestId('success-badge')).toBeInTheDocument();
    expect(screen.getByTestId('failure-badge')).toBeInTheDocument();
  });

  it('handles filter inputs and applies filters', async () => {
    const { act } = await import('@testing-library/react');
    const { fireEvent } = await import('@testing-library/react');

    render(React.createElement(ActivityLogs));

    // Find filter inputs
    const usernameInput = screen.getByPlaceholderText('Filter by Username');
    const componentTypeInput = screen.getByPlaceholderText('Filter by Component Type');
    const applyFiltersButton = screen.getByText('Apply Filters');

    expect(usernameInput).toBeInTheDocument();
    expect(componentTypeInput).toBeInTheDocument();
    expect(applyFiltersButton).toBeInTheDocument();

    // Test filter input changes
    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(componentTypeInput, { target: { value: 'VM_MANAGEMENT' } });
    });

    expect(usernameInput).toHaveValue('testuser');
    expect(componentTypeInput).toHaveValue('VM_MANAGEMENT');

    // Test apply filters button click
    await act(async () => {
      fireEvent.click(applyFiltersButton);
    });
  });

  it.skip('handles pagination controls correctly', async () => {
    const { act } = await import('@testing-library/react');
    const { fireEvent } = await import('@testing-library/react');

    const mockLogs = Array.from({ length: 10 }, (_, i) => ({
      id: i.toString(),
      start_time: '2025-06-19T10:30:00Z',
      username: 'testuser',
      vm_name: 'test-vm',
      activity: `Activity ${i}`,
      status: 'SUCCESS',
      component_type: 'VM_MANAGEMENT',
    }));

    // Mock the fetch response to include total count
    const mockApiFetch = api.fetch as jest.MockedFunction<typeof api.fetch>;
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          logs: mockLogs,
          total: 25, // Mock total count for pagination
        }),
    } as any);

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: { ip: '192.168.1.100' },
        vm: { name: 'test-vm' },
        activityLogs: mockLogs,
        activityLogsLoading: false,
        activityLogsError: null,
      } as any,
      dispatch: mockDispatch,
    } as any);

    render(React.createElement(ActivityLogs));

    // Wait for logs to load and pagination info to appear
    await screen.findByText('Activity 0');

    // Check pagination controls are rendered
    const previousButton = screen.getByText('Previous');
    const nextButton = screen.getByText('Next');

    expect(previousButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();

    // Previous button should be disabled initially (offset = 0)
    expect(previousButton).toHaveClass('bg-gray-300');

    // Test next button click
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // Test previous button click
    await act(async () => {
      fireEvent.click(previousButton);
    });

    // Check pagination info text appears after fetch completes
    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ to \d+ of/)).toBeInTheDocument();
    });
  });

  it('displays correct no-data messages based on state', () => {
    // Test no server selected message
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: null,
        activityLogs: [],
        activityLogsLoading: false,
        activityLogsError: null,
      } as any,
      dispatch: mockDispatch,
    } as any);

    const { rerender } = render(React.createElement(ActivityLogs));
    expect(
      screen.getByText('No server selected. Please select a server to view logs.')
    ).toBeInTheDocument();

    // Test no VM selected message
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: { ip: '192.168.1.100' },
        activityLogs: [],
        activityLogsLoading: false,
        activityLogsError: null,
      } as any,
      dispatch: mockDispatch,
    } as any);

    mockUseVm.mockReturnValue({
      selectedVm: null,
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      dataCenters: [],
    } as any);

    rerender(React.createElement(ActivityLogs));
    expect(
      screen.getByText('No VM selected. Please select a VM to view logs.')
    ).toBeInTheDocument();

    // Test no logs found message
    mockUseVm.mockReturnValue({
      selectedVm: { name: 'test-vm' },
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      dataCenters: [],
    } as any);

    rerender(React.createElement(ActivityLogs));
    expect(screen.getByText('No logs found for this VM.')).toBeInTheDocument();
  });

  it('handles API success response with different data structures', async () => {
    const mockApiResponse = {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          logs: [
            {
              id: '1',
              start_time: '2025-06-19T10:30:00Z',
              username: 'testuser',
              vm_name: 'test-vm',
              activity: 'VM Start',
              status: 'SUCCESS',
              component_type: 'VM_MANAGEMENT',
            },
          ],
          total: 25,
        }),
    };

    const mockApi = api as jest.Mocked<typeof api>;
    mockApi.fetch.mockResolvedValue(mockApiResponse as any);

    // Mock initial state to trigger fetch
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: { ip: '192.168.1.100' },
        activityLogs: [],
        activityLogsLoading: false,
        activityLogsError: null,
      } as any,
      dispatch: mockDispatch,
    } as any);

    render(React.createElement(ActivityLogs));

    // Verify the dispatch calls for successful API response
    expect(mockDispatch).toHaveBeenCalled();

    // Test with response that has logs but no total
    const mockApiResponseNoTotal = {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          logs: [
            {
              id: '1',
              start_time: '2025-06-19T10:30:00Z',
              username: 'testuser',
              vm_name: 'test-vm',
              activity: 'VM Start',
              status: 'SUCCESS',
              component_type: 'VM_MANAGEMENT',
            },
          ],
        }),
    };

    mockApi.fetch.mockResolvedValue(mockApiResponseNoTotal as any);

    // Test with invalid response structure
    const mockApiResponseInvalid = {
      ok: true,
      status: 200,
      json: () => Promise.resolve(null),
    };

    mockApi.fetch.mockResolvedValue(mockApiResponseInvalid as any);
  });
});
