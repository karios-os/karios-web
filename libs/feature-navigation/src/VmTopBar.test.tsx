import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import VmTopBar from './VmTopBar';
import { useVm, usePermissions, useServer } from '@karios-monorepo/shared-state';

// Mock the dependencies
jest.mock('@karios-monorepo/shared-state', () => ({
  useVm: jest.fn(),
  usePermissions: jest.fn(),
  useServer: jest.fn(),
}));

// Mock VM components
jest.mock('@karios-monorepo/feature-vm', () => ({
  Hardware: () => <div>Hardware Component</div>,
  Console: () => <div>Console Component</div>,
  SnapshotManager: () => <div>Snapshot Manager Component</div>,
  ActivityLogs: () => <div>Activity Logs Component</div>,
}));

// Mock Home component
jest.mock('@karios-monorepo/shared-ui', () => ({
  Home: () => <div>Home Component</div>,
  ScrollableContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scrollable-content">{children}</div>
  ),
}));

// Mock iconsax-react icons
jest.mock('iconsax-react', () => ({
  Code1: ({ size, color, ...props }: any) => (
    <div data-testid="code1-icon" style={{ color }} {...props}>
      Code1
    </div>
  ),
  Cpu: ({ size, color, ...props }: any) => (
    <div data-testid="cpu-icon" style={{ color }} {...props}>
      Cpu
    </div>
  ),
  KeyboardOpen: ({ size, color, ...props }: any) => (
    <div data-testid="keyboard-icon" style={{ color }} {...props}>
      Keyboard
    </div>
  ),
  Gallery: ({ size, color, ...props }: any) => (
    <div data-testid="gallery-icon" style={{ color }} {...props}>
      Gallery
    </div>
  ),
}));

describe('VmTopBar', () => {
  const mockVm = {
    name: 'Test VM',
    id: 'vm1',
    state: 'Running',
  };

  const mockDataCenters = [
    {
      id: 'dc1',
      name: 'Test DC',
      servers: [],
    },
  ];

  const mockServer = {
    name: 'Test Server',
    id: 'server1',
    state: 'Running',
  };

  beforeEach(() => {
    // Setup default mocks
    (useVm as jest.Mock).mockReturnValue({
      selectedVm: mockVm,
      dataCenters: mockDataCenters,
      setSelectedVm: jest.fn(),
    });

    (useServer as jest.Mock).mockReturnValue({
      selectedServer: mockServer,
      setSelectedServer: jest.fn(),
    });

    (usePermissions as jest.Mock).mockReturnValue({
      permissions: {
        VM_VIEW: true,
        VM_MANAGE: true,
        LOGS_VIEW: true,
      },
    });
  });

  it('displays message when no VM is selected and no datacenters exist', () => {
    (useVm as jest.Mock).mockReturnValue({
      selectedVm: null,
      dataCenters: [],
      setSelectedVm: jest.fn(),
    });

    (useServer as jest.Mock).mockReturnValue({
      selectedServer: null,
      setSelectedServer: jest.fn(),
    });

    render(
      <BrowserRouter>
        <VmTopBar />
      </BrowserRouter>
    );

    expect(screen.getByText('Please Select a VM')).toBeInTheDocument();
  });

  it('renders Home component when no VM is selected but datacenters exist', () => {
    (useVm as jest.Mock).mockReturnValue({
      selectedVm: null,
      dataCenters: mockDataCenters,
      setSelectedVm: jest.fn(),
    });

    (useServer as jest.Mock).mockReturnValue({
      selectedServer: null,
      setSelectedServer: jest.fn(),
    });

    render(
      <BrowserRouter>
        <VmTopBar />
      </BrowserRouter>
    );

    expect(screen.getByText('Home Component')).toBeInTheDocument();
  });

  it('displays selected VM name when VM is selected', () => {
    render(
      <BrowserRouter>
        <VmTopBar />
      </BrowserRouter>
    );

    expect(screen.getByText('Selected VM:')).toBeInTheDocument();
    expect(screen.getByText('Test VM')).toBeInTheDocument();
  });

  it('renders navigation tabs based on permissions', () => {
    render(
      <BrowserRouter>
        <VmTopBar />
      </BrowserRouter>
    );

    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Console')).toBeInTheDocument();
    expect(screen.getByText('Snapshots')).toBeInTheDocument();
    expect(screen.getByText('Activity Logs')).toBeInTheDocument();
  });

  it('hides Console tab for OpenShift VMs (starting with "op-")', () => {
    (useVm as jest.Mock).mockReturnValue({
      selectedVm: {
        id: '1',
        name: 'op-jash-controlplane3', // OpenShift VM name
        isOn: true,
        state: 'running',
      },
      dataCenters: mockDataCenters,
      setSelectedVm: jest.fn(),
    });

    (useServer as jest.Mock).mockReturnValue({
      selectedServer: mockServer,
      setSelectedServer: jest.fn(),
    });

    render(
      <BrowserRouter>
        <VmTopBar />
      </BrowserRouter>
    );

    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.queryByText('Console')).not.toBeInTheDocument(); // Console should be hidden
    expect(screen.getByText('Snapshots')).toBeInTheDocument();
    expect(screen.getByText('Activity Logs')).toBeInTheDocument();
  });

  it('shows Console tab for regular VMs (not starting with "op-")', () => {
    (useVm as jest.Mock).mockReturnValue({
      selectedVm: {
        id: '1',
        name: 'regular-vm', // Regular VM name
        isOn: true,
        state: 'running',
      },
      dataCenters: mockDataCenters,
      setSelectedVm: jest.fn(),
    });

    (useServer as jest.Mock).mockReturnValue({
      selectedServer: mockServer,
      setSelectedServer: jest.fn(),
    });

    render(
      <BrowserRouter>
        <VmTopBar />
      </BrowserRouter>
    );

    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Console')).toBeInTheDocument(); // Console should be visible
    expect(screen.getByText('Snapshots')).toBeInTheDocument();
    expect(screen.getByText('Activity Logs')).toBeInTheDocument();
  });

  it('renders correct component based on current route', () => {
    render(
      <MemoryRouter initialEntries={['/server/Test Server/vm/Test VM/hardware']}>
        <Routes>
          <Route path="/server/:serverName/vm/:vmName/*" element={<VmTopBar />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Hardware Component')).toBeInTheDocument();
  });

  it('redirects to hardware when on base VM path', () => {
    render(
      <MemoryRouter initialEntries={['/server/Test Server/vm/Test VM']}>
        <Routes>
          <Route path="/server/:serverName/vm/:vmName/*" element={<VmTopBar />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Hardware Component')).toBeInTheDocument();
  });

  it('redirects OpenShift VMs from console route to hardware', () => {
    (useVm as jest.Mock).mockReturnValue({
      selectedVm: {
        id: '1',
        name: 'op-jash-worker1', // OpenShift VM name
        isOn: true,
        state: 'running',
      },
      dataCenters: mockDataCenters,
      setSelectedVm: jest.fn(),
    });

    (useServer as jest.Mock).mockReturnValue({
      selectedServer: mockServer,
      setSelectedServer: jest.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/server/Test Server/vm/op-jash-worker1/console']}>
        <Routes>
          <Route path="/server/:serverName/vm/:vmName/*" element={<VmTopBar />} />
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to hardware and show Hardware Component instead of Console Component
    expect(screen.getByText('Hardware Component')).toBeInTheDocument();
    expect(screen.queryByText('Console Component')).not.toBeInTheDocument();
  });

  describe('NavItem', () => {
    it('applies active styles when tab is active', () => {
      render(
        <MemoryRouter initialEntries={['/server/Test Server/vm/Test VM/hardware']}>
          <Routes>
            <Route path="/server/:serverName/vm/:vmName/*" element={<VmTopBar />} />
          </Routes>
        </MemoryRouter>
      );

      const hardwareTab = screen.getByText('Hardware').closest('a');
      expect(hardwareTab).toHaveClass('text-karios-green');
    });

    it('applies hover styles on mouse enter/leave', () => {
      render(
        <MemoryRouter initialEntries={['/server/Test Server/vm/Test VM/console']}>
          <Routes>
            <Route path="/server/:serverName/vm/:vmName/*" element={<VmTopBar />} />
          </Routes>
        </MemoryRouter>
      );

      const hardwareTab = screen.getByText('Hardware').closest('a');

      fireEvent.mouseEnter(hardwareTab!);
      expect(hardwareTab).toHaveClass('hover:text-green-600');

      fireEvent.mouseLeave(hardwareTab!);
      expect(hardwareTab).toHaveClass('text-gray-700');
    });
  });
});
