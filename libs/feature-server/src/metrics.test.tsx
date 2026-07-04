import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Monitoring from './metrics';
import { useServer, useAppState } from '@karios-monorepo/shared-state';

// Mock the shared-state hooks
jest.mock('@karios-monorepo/shared-state', () => ({
  useServer: jest.fn(),
  useAppState: jest.fn(),
}));

jest.spyOn(console, 'log').mockImplementation(() => {});

const mockUseServer = useServer as jest.MockedFunction<typeof useServer>;
const mockUseAppState = useAppState as jest.MockedFunction<typeof useAppState>;

describe('Monitoring (metrics.tsx)', () => {
  const mockServer = {
    ip: '192.168.1.100',
    name: 'Test Server',
    id: '1',
  };

  const mockMetrics = {
    loading: false,
    uid: 'test-uid-123',
    viewingPanel: null,
    error: null,
  };

  const mockAppState = {
    metrics: mockMetrics,
    fetchMetricsUid: jest.fn(),
    setMetricsViewingPanel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseServer.mockReturnValue({
      selectedServer: mockServer,
      setSelectedServer: jest.fn(),
      dataCenters: [mockServer],
    } as any);

    mockUseAppState.mockReturnValue({
      ...mockAppState,
      metrics: mockMetrics,
    } as any);
  });

  it.skip('renders the monitoring component with Grafana embed', async () => {
    render(<Monitoring />);

    await waitFor(() => {
      // Should render the main container
      expect(
        document.querySelector('.flex.flex-col.items-center.min-h-screen')
      ).toBeInTheDocument();
    });
  });

  it.skip('fetches metrics UID when server is selected', async () => {
    render(<Monitoring />);

    await waitFor(() => {
      expect(mockAppState.fetchMetricsUid).toHaveBeenCalledWith(mockServer.ip);
    });
  });

  it.skip('displays loading state when metrics are loading', async () => {
    mockUseAppState.mockReturnValue({
      ...mockAppState,
      metrics: { ...mockMetrics, loading: true },
    } as any);

    render(<Monitoring />);

    expect(screen.getByText('Loading monitoring data...')).toBeInTheDocument();
  });

  it.skip('displays error state when there is an error', async () => {
    const errorMessage = 'Failed to connect to Grafana';
    mockUseAppState.mockReturnValue({
      ...mockAppState,
      metrics: { ...mockMetrics, error: errorMessage },
    } as any);

    render(<Monitoring />);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toHaveClass('text-red-500');
  });

  it.skip('displays failure message when UID is not available', async () => {
    mockUseAppState.mockReturnValue({
      ...mockAppState,
      metrics: { ...mockMetrics, uid: null },
    } as any);

    render(<Monitoring />);

    expect(screen.getByText('Failed to load monitoring data')).toBeInTheDocument();
  });

  it.skip('renders metric panels with correct iframes when data is loaded', async () => {
    render(<Monitoring />);

    await waitFor(() => {
      // Should render 6 metric panels (3 rows × 2 panels)
      const iframes = document.querySelectorAll('iframe');
      expect(iframes).toHaveLength(6);
    });
  });

  it.skip('opens expanded view when View button is clicked', async () => {
    render(<Monitoring />);

    await waitFor(() => {
      const viewButtons = screen.getAllByText('View');
      expect(viewButtons.length).toBeGreaterThan(0);
    });

    const firstViewButton = screen.getAllByText('View')[0];
    fireEvent.click(firstViewButton);

    expect(mockAppState.setMetricsViewingPanel).toHaveBeenCalledWith(77); // First panel ID
  });

  it.skip('displays expanded panel view with close button when viewingPanel is set', async () => {
    mockUseAppState.mockReturnValue({
      ...mockAppState,
      metrics: { ...mockMetrics, viewingPanel: 77 },
    } as any);

    render(<Monitoring />);

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
      expect(screen.getByText('Panel View')).toBeInTheDocument();
    });

    // Should render both the expanded iframe and the regular panels
    const iframes = document.querySelectorAll('iframe');
    expect(iframes.length).toBeGreaterThan(6); // Expanded view + regular panels
  });

  it.skip('closes expanded view when Close button is clicked', async () => {
    mockUseAppState.mockReturnValue({
      ...mockAppState,
      metrics: { ...mockMetrics, viewingPanel: 77 },
    } as any);

    render(<Monitoring />);

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(mockAppState.setMetricsViewingPanel).toHaveBeenCalledWith(null);
  });

  it.skip('does not fetch metrics when no server is selected', async () => {
    mockUseServer.mockReturnValue({
      selectedServer: null,
      setSelectedServer: jest.fn(),
      dataCenters: [],
    } as any);

    render(<Monitoring />);

    await waitFor(() => {
      expect(mockAppState.fetchMetricsUid).not.toHaveBeenCalled();
    });
  });
});
