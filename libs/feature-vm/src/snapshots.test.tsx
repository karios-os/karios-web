import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SnapshotManager from './snapshots';
import { useVm, usePermissions, useServer, useAppState } from '@karios-monorepo/shared-state';

// Mock the shared-state module
jest.mock('@karios-monorepo/shared-state', () => ({
  useVm: jest.fn(),
  usePermissions: jest.fn(),
  useServer: jest.fn(),
  useAppState: jest.fn(),
  ActionTypes: {
    SET_SNAPSHOT_MESSAGE: 'SET_SNAPSHOT_MESSAGE',
  },
}));

// Mock iconsax-react
jest.mock('iconsax-react', () => ({
  Gallery: () => React.createElement('div', { 'data-testid': 'gallery-icon' }, 'Gallery'),
  Refresh: () => React.createElement('div', { 'data-testid': 'refresh-icon' }, 'Refresh'),
}));

// Mock Modal component
jest.mock('../../feature-server/src/widgets/Modal', () => {
  return function Modal({ isOpen, children }: any) {
    return isOpen ? React.createElement('div', { 'data-testid': 'modal' }, children) : null;
  };
});

const mockUseVm = useVm as jest.MockedFunction<typeof useVm>;
const mockUsePermissions = usePermissions as jest.MockedFunction<typeof usePermissions>;
const mockUseServer = useServer as jest.MockedFunction<typeof useServer>;
const mockUseAppState = useAppState as jest.MockedFunction<typeof useAppState>;

describe('SnapshotManager Component', () => {
  const mockDispatch = jest.fn();
  const mockFetchSnapshots = jest.fn().mockResolvedValue(undefined);
  const mockCreateSnapshot = jest.fn().mockResolvedValue(undefined);
  const mockRollbackSnapshot = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockUseVm.mockReturnValue({
      selectedVm: { name: 'test-vm', state: 'Running' },
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      dataCenters: [],
    });

    mockUsePermissions.mockReturnValue({
      permissions: {
        VM_MANAGE: true,
        VM_VIEW: true,
        VM_BACKUP: true,
        NETWORK_VIEW: true,
        NETWORK_MANAGE: true,
        ZFS_VIEW: true,
        ZFS_MANAGE: true,
        UM_ADMIN: true,
        LOGS_VIEW: true,
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

    mockUseServer.mockReturnValue({
      selectedServer: { ip: '192.168.1.100' },
      setSelectedServer: jest.fn(),
      dataCenters: [],
    });

    mockUseAppState.mockReturnValue({
      // Add minimal required properties from AppStateContextType
      state: {},
      dispatch: mockDispatch,
      fetchInitialDataCenters: jest.fn(),
      fetchVMsForServer: jest.fn(),
      fetchVMs: jest.fn(),

      performVmAction: jest.fn(),
      renameVmInContext: jest.fn(),
      cloneVmInContext: jest.fn(),
      checkNodeStatuses: jest.fn(),
      setConfiguredNodes: jest.fn(),
      setMainTopBarComponent: jest.fn(),
      handleAdminPageChange: jest.fn(),
      setDataCenterView: jest.fn(),
      setServerView: jest.fn(),

      // Snapshot-specific properties that the component actually uses
      snapshots: [],
      snapshotMessage: '',
      fetchSnapshots: mockFetchSnapshots,
      createSnapshot: mockCreateSnapshot,
      rollbackSnapshot: mockRollbackSnapshot,
      getVmSnapshots: jest.fn().mockReturnValue([]),

      // Add other required properties with mock implementations
      selectedDataCenter: null,
      setSelectedDataCenter: jest.fn(),
      scannedData: '',
      setScannedData: jest.fn(),
      inventory: [],
      subnet: '',
      loading: false,
      error: null,
      configuredNodes: [],
      handleScan: jest.fn(),
      handleProvision: jest.fn(),
      fetchInventory: jest.fn(),
      vncConsoleUrl: '',
      vncConsoleOptions: {},
      getVncConsoleUrl: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders SnapshotManager component', () => {
    render(React.createElement(SnapshotManager));
    expect(document.body).toBeInTheDocument();
  });

  it('handles no VM selected', () => {
    mockUseVm.mockReturnValue({
      selectedVm: null,
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      dataCenters: [],
    });
    render(React.createElement(SnapshotManager));
    expect(document.body).toBeInTheDocument();
  });

  it('handles no server selected', () => {
    mockUseServer.mockReturnValue({
      selectedServer: null,
      setSelectedServer: jest.fn(),
      dataCenters: [],
    });
    render(React.createElement(SnapshotManager));
    expect(document.body).toBeInTheDocument();
  });

  it('disables actions when user lacks permissions', () => {
    mockUsePermissions.mockReturnValue({
      permissions: {
        VM_MANAGE: false,
        VM_VIEW: false,
        VM_BACKUP: false,
        NETWORK_VIEW: false,
        NETWORK_MANAGE: false,
        ZFS_VIEW: false,
        ZFS_MANAGE: false,
        UM_ADMIN: false,
        LOGS_VIEW: false,
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
    render(React.createElement(SnapshotManager));
    expect(document.body).toBeInTheDocument();
  });

  it('formats snapshot names correctly', () => {
    const getSnapshotName = (name: string): string => {
      const parts = name.split('@');
      return parts.length > 1 ? parts[1] : name;
    };

    expect(getSnapshotName('vm-test@snapshot1')).toBe('snapshot1');
    expect(getSnapshotName('simple-name')).toBe('simple-name');
  });

  it('displays snapshots when available', () => {
    mockUseAppState.mockReturnValue({
      // Add minimal required properties from AppStateContextType
      state: {},
      dispatch: mockDispatch,
      fetchInitialDataCenters: jest.fn(),
      fetchVMsForServer: jest.fn(),
      fetchVMs: jest.fn(),

      performVmAction: jest.fn(),
      renameVmInContext: jest.fn(),
      cloneVmInContext: jest.fn(),
      checkNodeStatuses: jest.fn(),
      setConfiguredNodes: jest.fn(),
      setMainTopBarComponent: jest.fn(),
      handleAdminPageChange: jest.fn(),
      setDataCenterView: jest.fn(),
      setServerView: jest.fn(),

      // Snapshot-specific properties with test data
      snapshots: [{ name: 'vm-test@snap1', date: '2024-01-01' }],
      snapshotMessage: '',
      fetchSnapshots: mockFetchSnapshots,
      createSnapshot: mockCreateSnapshot,
      rollbackSnapshot: mockRollbackSnapshot,
      getVmSnapshots: jest.fn().mockReturnValue([{ name: 'vm-test@snap1', date: '2024-01-01' }]),

      // Add other required properties with mock implementations
      selectedDataCenter: null,
      setSelectedDataCenter: jest.fn(),
      scannedData: '',
      setScannedData: jest.fn(),
      inventory: [],
      subnet: '',
      loading: false,
      error: null,
      configuredNodes: [],
      handleScan: jest.fn(),
      handleProvision: jest.fn(),
      fetchInventory: jest.fn(),
      vncConsoleUrl: '',
      vncConsoleOptions: {},
      getVncConsoleUrl: jest.fn(),
    } as any);

    render(React.createElement(SnapshotManager));
    expect(document.body).toBeInTheDocument();
  });

  // Test 7: Handles snapshot creation with valid input
  it('handles snapshot creation with valid input', async () => {
    await act(async () => {
      render(<SnapshotManager />);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter Snapshot Name')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter Snapshot Name');
    const takeSnapshotButton = screen.getByText('Take Snapshot');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'validSnapshot123' } });
    });

    await act(async () => {
      fireEvent.click(takeSnapshotButton);
    });

    expect(mockCreateSnapshot).toHaveBeenCalledWith('192.168.1.100', 'test-vm', 'validSnapshot123');

    // Test timeout for clearing message
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SNAPSHOT_MESSAGE',
      payload: '',
    });
  });

  // Test 8: Validates snapshot name input and shows error messages
  it('validates snapshot name input and shows error messages', async () => {
    await act(async () => {
      render(<SnapshotManager />);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter Snapshot Name')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter Snapshot Name');
    const takeSnapshotButton = screen.getByText('Take Snapshot');

    // Test empty name
    await act(async () => {
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(takeSnapshotButton);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SNAPSHOT_MESSAGE',
      payload: 'Please enter a snapshot name.',
    });

    // Test name with spaces and special characters
    await act(async () => {
      fireEvent.change(input, { target: { value: 'invalid name!' } });
      fireEvent.click(takeSnapshotButton);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SNAPSHOT_MESSAGE',
      payload:
        'Snapshot name must contain only letters and numbers (no spaces or special characters).',
    });
  });

  // Test 9: Tests duplicate snapshot name validation
  it('validates duplicate snapshot names', async () => {
    // Setup with existing snapshots
    mockUseAppState.mockReturnValue({
      state: {},
      dispatch: mockDispatch,
      fetchInitialDataCenters: jest.fn(),
      fetchVMsForServer: jest.fn(),
      fetchVMs: jest.fn(),

      performVmAction: jest.fn(),
      renameVmInContext: jest.fn(),
      cloneVmInContext: jest.fn(),
      checkNodeStatuses: jest.fn(),
      setConfiguredNodes: jest.fn(),
      setMainTopBarComponent: jest.fn(),
      handleAdminPageChange: jest.fn(),
      setDataCenterView: jest.fn(),
      setServerView: jest.fn(),
      snapshots: [{ name: 'vm-test@existingSnap', date: '2024-01-01' }],
      snapshotMessage: '',
      fetchSnapshots: mockFetchSnapshots,
      createSnapshot: mockCreateSnapshot,
      rollbackSnapshot: mockRollbackSnapshot,
      getVmSnapshots: jest
        .fn()
        .mockReturnValue([{ name: 'vm-test@existingSnap', date: '2024-01-01' }]),
      selectedDataCenter: null,
      setSelectedDataCenter: jest.fn(),
      scannedData: '',
      setScannedData: jest.fn(),
      inventory: [],
      subnet: '',
      loading: false,
      error: null,
      configuredNodes: [],
      handleScan: jest.fn(),
      handleProvision: jest.fn(),
      fetchInventory: jest.fn(),
      vncConsoleUrl: '',
      vncConsoleOptions: {},
      getVncConsoleUrl: jest.fn(),
    } as any);

    await act(async () => {
      render(<SnapshotManager />);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter Snapshot Name')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter Snapshot Name');
    const takeSnapshotButton = screen.getByText('Take Snapshot');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'existingSnap' } });
      fireEvent.click(takeSnapshotButton);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SNAPSHOT_MESSAGE',
      payload: "Please enter a new snapshot name. The name you've provided is already taken.",
    });
  });
  // Test 10: Handles rollback functionality for stopped VM
  it('handles rollback functionality for stopped VM', async () => {
    // Setup with stopped VM and snapshots
    mockUseVm.mockReturnValue({
      selectedVm: { name: 'test-vm', state: 'Stopped' },
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      dataCenters: [],
    });

    mockUseAppState.mockReturnValue({
      state: {},
      dispatch: mockDispatch,
      fetchInitialDataCenters: jest.fn(),
      fetchVMsForServer: jest.fn(),
      fetchVMs: jest.fn(),

      performVmAction: jest.fn(),
      renameVmInContext: jest.fn(),
      cloneVmInContext: jest.fn(),
      checkNodeStatuses: jest.fn(),
      setConfiguredNodes: jest.fn(),
      setMainTopBarComponent: jest.fn(),
      handleAdminPageChange: jest.fn(),
      setDataCenterView: jest.fn(),
      setServerView: jest.fn(),
      snapshots: [{ name: 'vm-test@testSnap', date: '2024-01-01' }],
      snapshotMessage: '',
      fetchSnapshots: mockFetchSnapshots,
      createSnapshot: mockCreateSnapshot,
      rollbackSnapshot: mockRollbackSnapshot,
      getVmSnapshots: jest.fn().mockReturnValue([{ name: 'vm-test@testSnap', date: '2024-01-01' }]),
      selectedDataCenter: null,
      setSelectedDataCenter: jest.fn(),
      scannedData: '',
      setScannedData: jest.fn(),
      inventory: [],
      subnet: '',
      loading: false,
      error: null,
      configuredNodes: [],
      handleScan: jest.fn(),
      handleProvision: jest.fn(),
      fetchInventory: jest.fn(),
      vncConsoleUrl: '',
      vncConsoleOptions: {},
      getVncConsoleUrl: jest.fn(),
    } as any);

    await act(async () => {
      render(<SnapshotManager />);
    });

    await waitFor(() => {
      expect(screen.getByText('testSnap')).toBeInTheDocument();
    });

    // Click rollback button
    const rollbackButton = screen.getByText('Rollback');
    await act(async () => {
      fireEvent.click(rollbackButton);
    });

    // Modal should be open
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Are you ok to rollback to snapshot "testSnap"?')).toBeInTheDocument();

    // Click Yes to confirm rollback
    const yesButton = screen.getByText('Yes');
    await act(async () => {
      fireEvent.click(yesButton);
    });

    expect(mockRollbackSnapshot).toHaveBeenCalledWith('192.168.1.100', 'test-vm', 'testSnap');

    // Test timeout for clearing message
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SNAPSHOT_MESSAGE',
      payload: '',
    });
  });

  // Test 11: Shows warning modal when trying to rollback a running VM
  it('shows warning modal when trying to rollback a running VM', async () => {
    // Setup with running VM and snapshots
    mockUseVm.mockReturnValue({
      selectedVm: { name: 'test-vm', state: 'Running' },
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      dataCenters: [],
    });

    mockUseAppState.mockReturnValue({
      state: {},
      dispatch: mockDispatch,
      fetchInitialDataCenters: jest.fn(),
      fetchVMsForServer: jest.fn(),
      fetchVMs: jest.fn(),

      performVmAction: jest.fn(),
      renameVmInContext: jest.fn(),
      cloneVmInContext: jest.fn(),
      checkNodeStatuses: jest.fn(),
      setConfiguredNodes: jest.fn(),
      setMainTopBarComponent: jest.fn(),
      handleAdminPageChange: jest.fn(),
      setDataCenterView: jest.fn(),
      setServerView: jest.fn(),
      snapshots: [{ name: 'vm-test@runningSnap', date: '2024-01-01' }],
      snapshotMessage: '',
      fetchSnapshots: mockFetchSnapshots,
      createSnapshot: mockCreateSnapshot,
      rollbackSnapshot: mockRollbackSnapshot,
      getVmSnapshots: jest
        .fn()
        .mockReturnValue([{ name: 'vm-test@runningSnap', date: '2024-01-01' }]),
      selectedDataCenter: null,
      setSelectedDataCenter: jest.fn(),
      scannedData: '',
      setScannedData: jest.fn(),
      inventory: [],
      subnet: '',
      loading: false,
      error: null,
      configuredNodes: [],
      handleScan: jest.fn(),
      handleProvision: jest.fn(),
      fetchInventory: jest.fn(),
      vncConsoleUrl: '',
      vncConsoleOptions: {},
      getVncConsoleUrl: jest.fn(),
    } as any);

    await act(async () => {
      render(<SnapshotManager />);
    });

    await waitFor(() => {
      expect(screen.getByText('runningSnap')).toBeInTheDocument();
    });

    // Click rollback button for a running VM
    const rollbackButton = screen.getByText('Rollback');
    await act(async () => {
      fireEvent.click(rollbackButton);
    });

    // Warning modal should be displayed
    expect(
      screen.getByText('Please turn off the VM before rolling back to a snapshot.')
    ).toBeInTheDocument();

    // Click OK to close warning modal
    const okButton = screen.getByText('OK');
    await act(async () => {
      fireEvent.click(okButton);
    });

    // Rollback should not be called
    expect(mockRollbackSnapshot).not.toHaveBeenCalled();
  });

  // Test 12: Handles modal cancel functionality
  it('handles modal cancel functionality', async () => {
    // Setup with stopped VM and snapshots
    mockUseVm.mockReturnValue({
      selectedVm: { name: 'test-vm', state: 'Stopped' },
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      dataCenters: [],
    });

    mockUseAppState.mockReturnValue({
      state: {},
      dispatch: mockDispatch,
      fetchInitialDataCenters: jest.fn(),
      fetchVMsForServer: jest.fn(),
      fetchVMs: jest.fn(),

      performVmAction: jest.fn(),
      renameVmInContext: jest.fn(),
      cloneVmInContext: jest.fn(),
      checkNodeStatuses: jest.fn(),
      setConfiguredNodes: jest.fn(),
      setMainTopBarComponent: jest.fn(),
      handleAdminPageChange: jest.fn(),
      setDataCenterView: jest.fn(),
      setServerView: jest.fn(),
      snapshots: [{ name: 'vm-test@cancelSnap', date: '2024-01-01' }],
      snapshotMessage: '',
      fetchSnapshots: mockFetchSnapshots,
      createSnapshot: mockCreateSnapshot,
      rollbackSnapshot: mockRollbackSnapshot,
      getVmSnapshots: jest
        .fn()
        .mockReturnValue([{ name: 'vm-test@cancelSnap', date: '2024-01-01' }]),
      selectedDataCenter: null,
      setSelectedDataCenter: jest.fn(),
      scannedData: '',
      setScannedData: jest.fn(),
      inventory: [],
      subnet: '',
      loading: false,
      error: null,
      configuredNodes: [],
      handleScan: jest.fn(),
      handleProvision: jest.fn(),
      fetchInventory: jest.fn(),
      vncConsoleUrl: '',
      vncConsoleOptions: {},
      getVncConsoleUrl: jest.fn(),
    } as any);

    await act(async () => {
      render(<SnapshotManager />);
    });

    await waitFor(() => {
      expect(screen.getByText('cancelSnap')).toBeInTheDocument();
    });

    // Click rollback button
    const rollbackButton = screen.getByText('Rollback');
    await act(async () => {
      fireEvent.click(rollbackButton);
    });

    // Modal should be open
    expect(screen.getByTestId('modal')).toBeInTheDocument();

    // Click Cancel button
    const cancelButton = screen.getByText('Cancel');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // Rollback should not be called
    expect(mockRollbackSnapshot).not.toHaveBeenCalled();
  });

  // Test 13: Handles errors during snapshot creation and rollback
  it('handles errors during snapshot creation and rollback', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock error for createSnapshot
    const mockCreateSnapshotError = jest
      .fn()
      .mockRejectedValue(new Error('Snapshot creation failed'));

    mockUseAppState.mockReturnValue({
      state: {},
      dispatch: mockDispatch,
      fetchInitialDataCenters: jest.fn(),
      fetchVMsForServer: jest.fn(),
      fetchVMs: jest.fn(),

      performVmAction: jest.fn(),
      renameVmInContext: jest.fn(),
      cloneVmInContext: jest.fn(),
      checkNodeStatuses: jest.fn(),
      setConfiguredNodes: jest.fn(),
      setMainTopBarComponent: jest.fn(),
      handleAdminPageChange: jest.fn(),
      setDataCenterView: jest.fn(),
      setServerView: jest.fn(),
      snapshots: [],
      snapshotMessage: '',
      fetchSnapshots: mockFetchSnapshots,
      createSnapshot: mockCreateSnapshotError,
      rollbackSnapshot: mockRollbackSnapshot,
      getVmSnapshots: jest.fn().mockReturnValue([]),
      selectedDataCenter: null,
      setSelectedDataCenter: jest.fn(),
      scannedData: '',
      setScannedData: jest.fn(),
      inventory: [],
      subnet: '',
      loading: false,
      error: null,
      configuredNodes: [],
      handleScan: jest.fn(),
      handleProvision: jest.fn(),
      fetchInventory: jest.fn(),
      vncConsoleUrl: '',
      vncConsoleOptions: {},
      getVncConsoleUrl: jest.fn(),
    } as any);

    await act(async () => {
      render(<SnapshotManager />);
    });

    // Test snapshot creation error
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter Snapshot Name')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter Snapshot Name');
    const takeSnapshotButton = screen.getByText('Take Snapshot');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'errorTest' } });
      fireEvent.click(takeSnapshotButton);
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error taking snapshot:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  });
});
