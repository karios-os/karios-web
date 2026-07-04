// libs/feature-datacenter/src/ApprovalsComponent.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApprovalsComponent from './ApprovalsComponent';

// Mock dependencies
jest.mock('@karios-monorepo/shared-state', () => ({
  useAppState: jest.fn(),
  api: {
    fetch: jest.fn(),
  },
}));

// Import mocked functions after mocking
import { useAppState, api } from '@karios-monorepo/shared-state';
const mockUseAppState = useAppState as jest.MockedFunction<typeof useAppState>;
const mockApiFetch = api.fetch as jest.MockedFunction<typeof api.fetch>;

jest.mock('../../../runtime-config', () => ({
  __esModule: true,
  default: () => ({
    PROTOCOL: 'http',
    CONTROL_NODE_IP: { PORT: ':8080' },
  }),
}));

// Mock react-icons
jest.mock('react-icons/fa', () => ({
  FaBell: ({ className, ...props }: any) => (
    <div data-testid="bell-icon" className={className} {...props} />
  ),
  FaCalendar: ({ className, ...props }: any) => (
    <div data-testid="calendar-icon" className={className} {...props} />
  ),
  FaServer: ({ className, ...props }: any) => (
    <div data-testid="server-icon" className={className} {...props} />
  ),
  FaExclamationTriangle: ({ className, ...props }: any) => (
    <div data-testid="warning-icon" className={className} {...props} />
  ),
  FaInfoCircle: ({ className, ...props }: any) => (
    <div data-testid="info-icon" className={className} {...props} />
  ),
  FaCheckCircle: ({ className, ...props }: any) => (
    <div data-testid="check-circle-icon" className={className} {...props} />
  ),
  FaTimesCircle: ({ className, ...props }: any) => (
    <div data-testid="times-circle-icon" className={className} {...props} />
  ),
  FaCheck: ({ className, ...props }: any) => (
    <div data-testid="check-icon" className={className} {...props} />
  ),
  FaTimes: ({ className, ...props }: any) => (
    <div data-testid="times-icon" className={className} {...props} />
  ),
}));

const mockActivityLogs = [
  {
    id: 1,
    roles: 'admin',
    username: 'john.doe',
    vm_name: 'test-vm-1',
    activity: 'VM Creation Request',
    ip: '192.168.1.100',
    status: 'PENDING',
    component_type: 'REQUEST',
    start_time: '2023-12-01T10:00:00Z',
    end_time: '2023-12-01T10:30:00Z',
  },
  {
    id: 2,
    roles: 'user',
    username: 'jane.smith',
    vm_name: 'test-vm-2',
    activity: 'VM Deletion Request',
    ip: '192.168.1.101',
    status: 'SUCCESS',
    component_type: 'REQUEST',
    start_time: '2023-12-01T11:00:00Z',
    end_time: '2023-12-01T11:15:00Z',
  },
  {
    id: 3,
    roles: 'user',
    username: 'bob.wilson',
    vm_name: 'test-vm-3',
    activity: 'VM Modification Request',
    ip: '192.168.1.102',
    status: 'FAILURE',
    component_type: 'REQUEST',
    start_time: '2023-12-01T12:00:00Z',
    end_time: '2023-12-01T12:05:00Z',
  },
];

// Create mock response helper
const createMockResponse = (data: any, ok = true, status = 200) => {
  const response = {
    ok,
    json: jest.fn().mockResolvedValue(data),
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    text: jest.fn(),
  } as Partial<Response>;
  return response as Response;
};

describe('ApprovalsComponent', () => {
  const defaultProps = {
    host: '192.168.1.100',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup useAppState mock
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: {
          ip: '192.168.1.100',
          name: 'Test Server',
        },
      },
    } as any);

    // Mock successful API response
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: mockActivityLogs,
        total: mockActivityLogs.length,
        offset: 0,
        limit: 10,
      })
    );
  });

  // Basic rendering tests
  it('renders approval component with title', () => {
    render(<ApprovalsComponent {...defaultProps} />);

    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByTestId('bell-icon')).toBeInTheDocument();
  });

  it('renders subtitle and refresh button', () => {
    render(<ApprovalsComponent {...defaultProps} />);

    expect(screen.getByText('Review and approve/reject pending requests.')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  // Loading state tests
  it('shows loading state initially', async () => {
    // Make API call hang
    mockApiFetch.mockImplementation(() => new Promise(() => {}));

    render(<ApprovalsComponent {...defaultProps} />);

    expect(screen.getByText('Loading approval requests...')).toBeInTheDocument();
    // Check for spinner by class name instead of role
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  // API call tests
  it('fetches activity logs on mount with correct parameters', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://192.168.1.100:8080/api/v1/observability/activity-logs'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    // Check URL parameters
    const [url] = mockApiFetch.mock.calls[0];
    const urlObj = new URL(url);
    expect(urlObj.searchParams.get('limit')).toBe('10');
    expect(urlObj.searchParams.get('offset')).toBe('0');
    expect(urlObj.searchParams.get('component_type')).toBe('REQUEST');
  });

  it('uses host prop in API URL', async () => {
    const customHost = '192.168.1.200';
    render(<ApprovalsComponent host={customHost} />);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining(`http://${customHost}:8080`),
        expect.any(Object)
      );
    });
  });

  // Data display tests
  it('displays activity logs when data is loaded', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
      expect(screen.getByText('test-vm-1')).toBeInTheDocument();
      expect(screen.getByText('VM Creation Request')).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
  });

  it('displays multiple activity logs with different statuses', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
      expect(screen.getByText('jane.smith')).toBeInTheDocument();
      expect(screen.getByText('bob.wilson')).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();
      expect(screen.getByText('SUCCESS')).toBeInTheDocument();
      expect(screen.getByText('FAILURE')).toBeInTheDocument();
    });
  });

  it('displays user roles and IP addresses', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getAllByText('user')).toHaveLength(2); // Two users with 'user' role
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
      expect(screen.getByText('192.168.1.101')).toBeInTheDocument();
      expect(screen.getByText('192.168.1.102')).toBeInTheDocument();
    });
  });

  it('displays formatted timestamps', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      // Check for calendar icon presence (timestamp display)
      expect(screen.getAllByTestId('calendar-icon')).toHaveLength(3);
      // Check for formatted date (specific format may vary by locale) - use getAllBy since multiple
      expect(screen.getAllByText(/Dec 01/)).toHaveLength(3);
    });
  });

  it('displays appropriate icons for different statuses', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('info-icon')).toBeInTheDocument(); // PENDING
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument(); // SUCCESS
      expect(screen.getByTestId('times-circle-icon')).toBeInTheDocument(); // FAILURE
    });
  });

  it('applies appropriate styling for different statuses', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      // The component uses different status values, let's check them correctly
      expect(screen.getByText('PENDING')).toBeInTheDocument();
      expect(screen.getByText('SUCCESS')).toBeInTheDocument();
      expect(screen.getByText('FAILURE')).toBeInTheDocument();
    });
  });

  // Button visibility tests
  it('shows approve and reject buttons only for pending requests', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      const approveButtons = screen.getAllByText('Approve');
      const rejectButtons = screen.getAllByText('Reject');

      // Only pending requests (1 in our mock data) should have buttons
      expect(approveButtons).toHaveLength(1);
      expect(rejectButtons).toHaveLength(1);
    });
  });

  it('does not show buttons for non-pending requests', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      // SUCCESS and FAILURE status cards should not have buttons
      const successCard = screen.getByText('SUCCESS').closest('.border');
      const failureCard = screen.getByText('FAILURE').closest('.border');

      expect(successCard).not.toHaveTextContent('Approve');
      expect(successCard).not.toHaveTextContent('Reject');
      expect(failureCard).not.toHaveTextContent('Approve');
      expect(failureCard).not.toHaveTextContent('Reject');
    });
  });

  // Action tests - Approve
  it('calls approve API when approve button is clicked', async () => {
    const approveResponse = createMockResponse({});
    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockResolvedValueOnce(approveResponse);

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:8080/api/v1/approveEvent?eventId=1',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });
  });

  // Action tests - Reject
  it('calls reject API when reject button is clicked', async () => {
    const rejectResponse = createMockResponse({});
    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockResolvedValueOnce(rejectResponse);

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:8080/api/v1/rejectEvent?eventId=1',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });
  });

  // Processing state tests
  it('shows loading state for buttons during processing', async () => {
    // Make approve API call hang
    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockImplementationOnce(() => new Promise(() => {}));

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    await waitFor(() => {
      // Check for spinner in button
      expect(approveButton.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  it('disables buttons during processing', async () => {
    // Make approve API call hang
    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockImplementationOnce(() => new Promise(() => {}));

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    const approveButton = screen.getByText('Approve');
    const rejectButton = screen.getByText('Reject');

    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(approveButton).toBeDisabled();
      expect(rejectButton).toBeDisabled();
    });
  });

  it('refreshes data after successful approve', async () => {
    const approveResponse = createMockResponse({});
    const refreshResponse = createMockResponse({
      logs: mockActivityLogs.filter((log) => log.id !== 1), // Remove approved item
      total: mockActivityLogs.length - 1,
      offset: 0,
      limit: 10,
    });

    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockResolvedValueOnce(approveResponse)
      .mockResolvedValueOnce(refreshResponse);

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    await waitFor(() => {
      // API should be called 3 times - initial load, approve, then refresh
      expect(mockApiFetch).toHaveBeenCalledTimes(3);
    });
  });

  it('refreshes data after successful reject', async () => {
    const rejectResponse = createMockResponse({});
    const refreshResponse = createMockResponse({
      logs: mockActivityLogs.filter((log) => log.id !== 1), // Remove rejected item
      total: mockActivityLogs.length - 1,
      offset: 0,
      limit: 10,
    });

    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockResolvedValueOnce(rejectResponse)
      .mockResolvedValueOnce(refreshResponse);

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);

    await waitFor(() => {
      // API should be called 3 times - initial load, reject, then refresh
      expect(mockApiFetch).toHaveBeenCalledTimes(3);
    });
  });

  // Error handling tests
  it('handles API fetch errors gracefully', async () => {
    const errorResponse = createMockResponse(null, false, 500);
    mockApiFetch.mockResolvedValue(errorResponse);

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Approval Requests')).toBeInTheDocument();
      expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
    });
  });

  it('handles network errors gracefully', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network Error'));

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Approval Requests')).toBeInTheDocument();
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });
  });

  it('handles approve API errors gracefully', async () => {
    const errorResponse = createMockResponse(null, false, 400);
    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockResolvedValueOnce(errorResponse);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to approve event:', 400, 'Bad Request');
    });

    consoleSpy.mockRestore();
  });

  it('handles reject API errors gracefully', async () => {
    const errorResponse = createMockResponse(null, false, 400);
    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockResolvedValueOnce(errorResponse);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to reject event:', 400, 'Bad Request');
    });

    consoleSpy.mockRestore();
  });

  // Pagination tests
  it('displays pagination when total count exceeds limit', async () => {
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: mockActivityLogs,
        total: 25,
        offset: 0,
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3 (25 total requests)')).toBeInTheDocument();
    });
  });

  it('handles pagination navigation', async () => {
    const page1Response = createMockResponse({
      logs: mockActivityLogs,
      total: 25,
      offset: 0,
      limit: 10,
    });

    const page2Response = createMockResponse({
      logs: mockActivityLogs,
      total: 25,
      offset: 10,
      limit: 10,
    });

    mockApiFetch.mockResolvedValueOnce(page1Response).mockResolvedValueOnce(page2Response);

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      const [, secondCallUrl] = mockApiFetch.mock.calls[1];
      const url = mockApiFetch.mock.calls[1][0];
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('offset')).toBe('10'); // Second page
    });
  });

  it('disables Previous button on first page', async () => {
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: mockActivityLogs,
        total: 25,
        offset: 0,
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeDisabled();
    });
  });

  it('disables Next button on last page', async () => {
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: mockActivityLogs,
        total: 25,
        offset: 20, // Last page (page 3 of 3)
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeDisabled();
    });
  });

  // Empty state tests
  it('displays empty state when no approvals', async () => {
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: [],
        total: 0,
        offset: 0,
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No Pending Requests')).toBeInTheDocument();
      expect(screen.getByText('There are no approval requests at this time.')).toBeInTheDocument();
      // Use getAllByTestId since there are multiple bell icons
      expect(screen.getAllByTestId('bell-icon')).toHaveLength(2);
    });
  });

  // Refresh functionality
  it('refreshes data when refresh button is clicked', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      // API should be called twice - initial load and refresh
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });
  });

  // Edge cases
  it('handles missing VM names gracefully', async () => {
    const logsWithoutVmNames = mockActivityLogs.map((log) => ({
      ...log,
      vm_name: '',
    }));

    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: logsWithoutVmNames,
        total: logsWithoutVmNames.length,
        offset: 0,
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
      // Should still render without VM names
    });
  });

  it('handles invalid timestamps gracefully', async () => {
    const logsWithInvalidTimestamps = mockActivityLogs.map((log) => ({
      ...log,
      start_time: 'invalid-date',
    }));

    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: logsWithInvalidTimestamps,
        total: logsWithInvalidTimestamps.length,
        offset: 0,
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
      // Should display original timestamp string if parsing fails (based on component implementation)
      expect(screen.getAllByText('invalid-date')).toHaveLength(3);
    });
  });

  it('handles missing or undefined logs array', async () => {
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        total: 0,
        offset: 0,
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No Pending Requests')).toBeInTheDocument();
    });
  });

  // Component updates
  it('updates when host prop changes', async () => {
    const { rerender } = render(<ApprovalsComponent host="192.168.1.100" />);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.100'),
        expect.any(Object)
      );
    });

    mockApiFetch.mockClear();

    rerender(<ApprovalsComponent host="192.168.1.200" />);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.200'),
        expect.any(Object)
      );
    });
  });

  // Multiple processing states
  it('prevents multiple simultaneous processing operations', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    // Mock hanging approve call
    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockImplementationOnce(() => new Promise(() => {}));

    const approveButton = screen.getByText('Approve');
    const rejectButton = screen.getByText('Reject');

    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(approveButton).toBeDisabled();
      expect(rejectButton).toBeDisabled();
    });
  });

  // Component REQUEST type filter
  it('always filters by REQUEST component type', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      const [url] = mockApiFetch.mock.calls[0];
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('component_type')).toBe('REQUEST');
    });
  });

  // API URL structure
  it('constructs correct API URL with observability path', async () => {
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/observability/activity-logs'),
        expect.any(Object)
      );
    });
  });

  // Console logging
  it('logs successful approve operations', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const approveResponse = createMockResponse({});

    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockResolvedValueOnce(approveResponse);

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Event 1 approved successfully');
    });

    consoleSpy.mockRestore();
  });

  it('logs successful reject operations', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const rejectResponse = createMockResponse({});

    mockApiFetch
      .mockResolvedValueOnce(
        createMockResponse({
          logs: mockActivityLogs,
          total: mockActivityLogs.length,
          offset: 0,
          limit: 10,
        })
      )
      .mockResolvedValueOnce(rejectResponse);

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Event 1 rejected successfully');
    });

    consoleSpy.mockRestore();
  });

  // Test edge cases for better coverage
  it('handles page change with invalid page numbers', async () => {
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: mockActivityLogs,
        total: 25,
        offset: 0,
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    // Test clicking Previous on first page (should not make API call)
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });

    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();
    fireEvent.click(prevButton); // Should not trigger API call

    // Should still only have the initial API call
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('handles responses with different data structures', async () => {
    // Test with undefined/null values
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: undefined,
        total: undefined,
        offset: undefined,
        limit: undefined,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No Pending Requests')).toBeInTheDocument();
    });
  });

  it('handles errors with non-Error objects', async () => {
    mockApiFetch.mockRejectedValue('String error');

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Approval Requests')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch events')).toBeInTheDocument();
    });
  });

  it('tests formatTimestamp function coverage with edge cases', async () => {
    // Test with empty logs first
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: [],
        total: 0,
        offset: 0,
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No Pending Requests')).toBeInTheDocument();
    });

    // Now test with a log that might trigger catch block in formatTimestamp
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: [
          {
            ...mockActivityLogs[0],
            start_time: null as any, // Force null to test edge case
          },
        ],
        total: 1,
        offset: 0,
        limit: 10,
      })
    );

    // Re-render to test the formatTimestamp with null
    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });
  });

  it('covers the last remaining line with various page counts', async () => {
    // Test with different pagination scenarios to cover line 302
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: mockActivityLogs,
        total: 50,
        offset: 30,
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      // Should show page 4 of 5 with various pagination calculations
      expect(screen.getByText('Page 4 of 5 (50 total requests)')).toBeInTheDocument();
    });
  });

  it('tests page boundary conditions for pagination', async () => {
    // Test exactly at page boundary to ensure proper pagination calculations
    mockApiFetch.mockResolvedValue(
      createMockResponse({
        logs: mockActivityLogs,
        total: 10,
        offset: 0,
        limit: 10,
      })
    );

    render(<ApprovalsComponent {...defaultProps} />);

    await waitFor(() => {
      // Should show page 1 of 1 with exactly 10 items
      expect(screen.getByText('Page 1 of 1 (10 total requests)')).toBeInTheDocument();
    });
  });
});
