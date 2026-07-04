import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import ServerTopBar from './ServerTopBar';
import { useAppState, usePermissions } from '@karios-monorepo/shared-state';

// Mock the dependencies
jest.mock('@karios-monorepo/shared-state', () => ({
  usePermissions: jest.fn(),
  useAppState: jest.fn(),
}));

// Mock server components
jest.mock('@karios-monorepo/feature-server', () => ({
  ISO: () => <div>ISO Component</div>,
  LandingPage: () => <div>Landing Page Component</div>,
  PowerMetrics: () => <div>Power Metrics Component</div>,
  ServerFirewall: () => <div>Server Firewall Component</div>,
  SystemLogs: () => <div>System Logs Component</div>,
  metrics: () => <div>Monitoring Component</div>,
  network: () => <div>Network Component</div>,
  storage: () => <div>Storage Component</div>,
  powerMonitoring: () => <div>Power Monitoring Component</div>,
}));

// Mock the ServerConsole component
jest.mock('../../feature-server/src/ServerConsole', () => {
  return function MockServerConsole() {
    return <div>Server Console Component</div>;
  };
});

// Mock the Notifications component
jest.mock('../../feature-datacenter/src/Notification', () => {
  return function MockNotifications() {
    return <div>Notifications Component</div>;
  };
});

describe('ServerTopBar', () => {
  const mockSetServerView = jest.fn();
  const mockServer = {
    id: 'server1',
    name: 'Test Server',
    ip: '192.168.1.1',
  };

  beforeEach(() => {
    // Setup default mocks
    (useAppState as jest.Mock).mockReturnValue({
      state: {
        selectedServer: mockServer,
        currentServerView: 'home',
      },
      setServerView: mockSetServerView,
    });

    (usePermissions as jest.Mock).mockReturnValue({
      permissions: {
        VM_VIEW: true,
        VM_MANAGE: true,
        LOGS_VIEW: true,
        ZFS_MANAGE: true,
        ZFS_VIEW: true,
        NETWORK_MANAGE: true,
        NETWORK_VIEW: true,
      },
    });

    // Clear mock calls
    mockSetServerView.mockClear();
  });

  it('displays no server message when no server is selected', () => {
    (useAppState as jest.Mock).mockReturnValue({
      state: {
        selectedServer: null,
        currentServerView: null,
      },
      setServerView: mockSetServerView,
    });

    render(
      <BrowserRouter>
        <ServerTopBar />
      </BrowserRouter>
    );

    expect(screen.getByText('No server selected')).toBeInTheDocument();
  });

  it('displays server name when server is selected', () => {
    render(
      <BrowserRouter>
        <ServerTopBar />
      </BrowserRouter>
    );

    // The "Selected Server:" text is commented out in the component
    // Instead, check that the navigation tabs are rendered (which indicates server is selected)
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Console')).toBeInTheDocument();
  });

  it('renders navigation tabs based on permissions', () => {
    render(
      <BrowserRouter>
        <ServerTopBar />
      </BrowserRouter>
    );

    // Check for presence of all navigation tabs that are actually available
    expect(screen.getByText('Home')).toBeInTheDocument();
    // Note: Power Monitoring is commented out in the component, so removed from test
    expect(screen.getByText('ISO')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Power')).toBeInTheDocument(); // This is PowerMetrics renamed to 'Power'
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Firewall')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument(); // New tab added
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('hides navigation tabs based on missing permissions', () => {
    (usePermissions as jest.Mock).mockReturnValue({
      permissions: {
        VM_VIEW: false,
        VM_MANAGE: false,
        LOGS_VIEW: false,
        ZFS_MANAGE: false,
        ZFS_VIEW: false,
        NETWORK_MANAGE: false,
        NETWORK_VIEW: false,
      },
    });

    render(
      <BrowserRouter>
        <ServerTopBar />
      </BrowserRouter>
    );

    // Check that tabs are not present
    expect(screen.queryByText('ISO')).not.toBeInTheDocument();
    expect(screen.queryByText('Storage')).not.toBeInTheDocument();
    expect(screen.queryByText('Network')).not.toBeInTheDocument();
    expect(screen.queryByText('Firewall')).not.toBeInTheDocument();
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
  });

  it('does not render Power Monitoring tab (currently commented out)', () => {
    render(
      <BrowserRouter>
        <ServerTopBar />
      </BrowserRouter>
    );

    // Power Monitoring tab is currently commented out in the component
    expect(screen.queryByText('Power Monitoring')).not.toBeInTheDocument();

    // But Power (PowerMetrics) should still be available
    expect(screen.getByText('Power')).toBeInTheDocument();
  });

  it('renders Security tab with proper permissions', () => {
    render(
      <BrowserRouter>
        <ServerTopBar />
      </BrowserRouter>
    );

    // Security tab should be present (new addition)
    expect(screen.getByText('Security')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Security'));
    expect(mockSetServerView).toHaveBeenCalledWith('security');
  });

  it('updates server view when clicking navigation tabs', () => {
    render(
      <BrowserRouter>
        <ServerTopBar />
      </BrowserRouter>
    );

    // Click various navigation tabs and verify setServerView is called
    fireEvent.click(screen.getByText('ISO'));
    expect(mockSetServerView).toHaveBeenCalledWith('iso');

    fireEvent.click(screen.getByText('Storage'));
    expect(mockSetServerView).toHaveBeenCalledWith('storage');

    fireEvent.click(screen.getByText('Network'));
    expect(mockSetServerView).toHaveBeenCalledWith('network');
  });

  it('renders correct component based on current route', () => {
    render(
      <MemoryRouter initialEntries={['/server/Test Server/iso']}>
        <Routes>
          <Route path="/server/:serverName/*" element={<ServerTopBar />} />
        </Routes>
      </MemoryRouter>
    );

    // The ISO component should be rendered (even though it's mocked)
    expect(screen.getByText('ISO Component')).toBeInTheDocument();
  });

  describe('Tab handlers and permissions', () => {
    it('handles monitoring and power metrics tab clicks', () => {
      render(
        <BrowserRouter>
          <ServerTopBar />
        </BrowserRouter>
      );

      fireEvent.click(screen.getByText('Monitoring'));
      expect(mockSetServerView).toHaveBeenCalledWith('monitoring');

      fireEvent.click(screen.getByText('Power')); // Changed from 'Power Metrics' to 'Power'
      expect(mockSetServerView).toHaveBeenCalledWith('PowerMetrics');
    });

    it('shows network and firewall tabs based on permissions', () => {
      (usePermissions as jest.Mock).mockReturnValue({
        permissions: {
          VM_VIEW: true,
          VM_MANAGE: false,
          LOGS_VIEW: true,
          ZFS_MANAGE: true,
          ZFS_VIEW: true,
          NETWORK_MANAGE: false,
          NETWORK_VIEW: false, // Set this to false to test hiding network/firewall tabs
        },
      });
      render(
        <BrowserRouter>
          <ServerTopBar />
        </BrowserRouter>
      );
      expect(screen.queryByText('Network')).not.toBeInTheDocument();
      expect(screen.queryByText('Firewall')).not.toBeInTheDocument();
    });
  });

  describe('NavItem Component', () => {
    it('handles hover states correctly', async () => {
      // Make sure we're not on the monitoring view initially
      (useAppState as jest.Mock).mockReturnValue({
        state: {
          selectedServer: mockServer,
          currentServerView: 'home', // Set to home so monitoring is not active
        },
        setServerView: mockSetServerView,
      });

      render(
        <BrowserRouter>
          <ServerTopBar />
        </BrowserRouter>
      );

      const monitoringTab = screen.getByText('Monitoring').closest('a');

      // Check the base classes exist
      expect(monitoringTab).toHaveClass(
        'flex',
        'items-center',
        'gap-2',
        'text-sm',
        'px-3',
        'pt-4',
        'pb-0',
        'transition-colors'
      );

      // When not active, should have gray text
      expect(monitoringTab).toHaveClass('text-gray-700');
    });

    it('maintains active state regardless of hover', () => {
      (useAppState as jest.Mock).mockReturnValue({
        state: {
          selectedServer: mockServer,
          currentServerView: 'monitoring',
        },
        setServerView: mockSetServerView,
      });

      render(
        <BrowserRouter>
          <ServerTopBar />
        </BrowserRouter>
      );

      const monitoringTab = screen.getByText('Monitoring').closest('a');
      expect(monitoringTab).toHaveClass('text-karios-green');

      fireEvent.mouseEnter(monitoringTab!);
      expect(monitoringTab).toHaveClass('text-karios-green');

      fireEvent.mouseLeave(monitoringTab!);
      expect(monitoringTab).toHaveClass('text-karios-green');
    });
  });

  describe('Route change handling', () => {
    it('updates server view when route changes', () => {
      const mockSetServerView = jest.fn();
      (useAppState as jest.Mock).mockReturnValue({
        state: {
          selectedServer: { id: 'server1', name: 'Test Server' },
          currentServerView: 'home',
        },
        setServerView: mockSetServerView,
      });

      render(
        <MemoryRouter initialEntries={['/server/Test Server/monitoring']}>
          <ServerTopBar />
        </MemoryRouter>
      );

      expect(mockSetServerView).toHaveBeenCalledWith('monitoring');
    });

    it('does not update server view for non-server routes', () => {
      const mockSetServerView = jest.fn();
      (useAppState as jest.Mock).mockReturnValue({
        state: {
          selectedServer: { id: 'server1', name: 'Test Server' },
          currentServerView: 'home',
        },
        setServerView: mockSetServerView,
      });

      render(
        <MemoryRouter initialEntries={['/different/path']}>
          <ServerTopBar />
        </MemoryRouter>
      );

      expect(mockSetServerView).not.toHaveBeenCalled();
    });

    it('handles missing setServerView gracefully', () => {
      (useAppState as jest.Mock).mockReturnValue({
        state: {
          selectedServer: { id: 'server1', name: 'Test Server' },
          currentServerView: 'home',
        },
        setServerView: undefined,
      });

      render(
        <MemoryRouter initialEntries={['/server/Test Server/monitoring']}>
          <ServerTopBar />
        </MemoryRouter>
      );

      // Should render without errors - check that navigation tabs are present
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Console')).toBeInTheDocument();
    });
  });

  describe('Component imports', () => {
    it('renders imported components correctly', () => {
      (useAppState as jest.Mock).mockReturnValue({
        state: {
          selectedServer: { id: 'server1', name: 'Test Server' },
          currentServerView: 'monitoring',
        },
        setServerView: jest.fn(),
      });
      (usePermissions as jest.Mock).mockReturnValue({
        permissions: {
          VM_VIEW: true,
          VM_MANAGE: true,
          LOGS_VIEW: true,
          ZFS_MANAGE: true,
          ZFS_VIEW: true,
          NETWORK_MANAGE: true,
          NETWORK_VIEW: true,
        },
      });

      render(
        <MemoryRouter initialEntries={['/server/Test Server/monitoring']}>
          <Routes>
            <Route path="/server/:serverName/*" element={<ServerTopBar />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Monitoring Component')).toBeInTheDocument();
    });
  });

  // Additional Tests - 3 new test cases
  describe('Additional Test Cases', () => {
    it('renders event logs tab and handles click correctly', () => {
      render(
        <BrowserRouter>
          <ServerTopBar />
        </BrowserRouter>
      );

      expect(screen.getByText('Event Logs')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Event Logs'));
      expect(mockSetServerView).toHaveBeenCalledWith('event-logs');
    });

    it('renders console tab and navigates correctly', () => {
      render(
        <MemoryRouter initialEntries={['/server/Test Server/console']}>
          <Routes>
            <Route path="/server/:serverName/*" element={<ServerTopBar />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Console')).toBeInTheDocument();
      expect(screen.getByText('Server Console Component')).toBeInTheDocument(); // Mocked component
    });

    it('handles server selection with minimal permissions', () => {
      (usePermissions as jest.Mock).mockReturnValue({
        permissions: {
          VM_VIEW: true, // Only VM_VIEW permission
          VM_MANAGE: false,
          LOGS_VIEW: false,
          ZFS_MANAGE: false,
          ZFS_VIEW: false,
          NETWORK_MANAGE: false,
          NETWORK_VIEW: false,
        },
      });

      render(
        <BrowserRouter>
          <ServerTopBar />
        </BrowserRouter>
      );

      // Should still render basic tabs available with VM_VIEW
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Console')).toBeInTheDocument();
      expect(screen.getByText('Monitoring')).toBeInTheDocument();
      expect(screen.getByText('Power')).toBeInTheDocument();
      expect(screen.getByText('Event Logs')).toBeInTheDocument();

      // Should not render tabs that require other permissions
      expect(screen.queryByText('ISO')).not.toBeInTheDocument();
      expect(screen.queryByText('Storage')).not.toBeInTheDocument();
    });
  });
});
