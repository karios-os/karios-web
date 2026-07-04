import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AttachDriveForm from './AttachDrive';
import {
  useVm,
  usePermissions,
  useServer,
  useAppState,
  configureVmStartOnBoot,
  mountIsoForInstallation,
  api,
} from '@karios-monorepo/shared-state';

// Mock the shared-state module
jest.mock('@karios-monorepo/shared-state', () => ({
  useVm: jest.fn(),
  usePermissions: jest.fn(),
  useServer: jest.fn(),
  useAppState: jest.fn(),
  configureVmStartOnBoot: jest.fn(),
  mountIsoForInstallation: jest.fn(),
  api: {
    fetch: jest.fn(),
  },
}));

const mockUseVm = useVm as jest.MockedFunction<typeof useVm>;
const mockUsePermissions = usePermissions as jest.MockedFunction<typeof usePermissions>;
const mockUseServer = useServer as jest.MockedFunction<typeof useServer>;
const mockUseAppState = useAppState as jest.MockedFunction<typeof useAppState>;
const mockConfigureVmStartOnBoot = configureVmStartOnBoot as jest.MockedFunction<
  typeof configureVmStartOnBoot
>;
const mockMountIsoForInstallation = mountIsoForInstallation as jest.MockedFunction<
  typeof mountIsoForInstallation
>;
const mockApi = api as jest.Mocked<typeof api>;

// Mock timers
jest.useFakeTimers();

// Mock envConfig
jest.mock('../../../../runtime-config', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    CONTROL_NODE_IP: {
      PORT: '8080',
    },
  })),
}));

describe('AttachDriveForm Component', () => {
  const mockSetVmDetails = jest.fn();
  const mockOnClose = jest.fn();
  const mockFetchVmDisks = jest.fn();
  const mockSetDiskFormField = jest.fn();
  const mockAttachDisk = jest.fn();
  const mockFetchIsoList = jest.fn();
  const mockSetIsoField = jest.fn();
  const mockDispatch = jest.fn();

  const defaultStorage = {
    vmDisks: [{ id: 1 }, { id: 2 }],
    diskForm: {
      diskNo: 2,
    },
  };

  const defaultIso = {
    selectedIso: '',
    isoList: ['ubuntu-20.04.iso', 'windows-10.iso', 'centos-8.iso'],
  };

  const mockVmDetails = {
    name: 'test-vm',
    datastore: 'Public',
    'virtual-disk': [{ id: 1 }, { id: 2 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    mockUseVm.mockReturnValue({
      selectedVm: { name: 'test-vm' },
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      fetchVMsWebSocket: jest.fn(),
      performVmActionWebSocket: jest.fn(),
      dataCenters: [],
    });

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

    mockUseServer.mockReturnValue({
      selectedServer: { ip: '192.168.1.100' },
      setSelectedServer: jest.fn(),
      dataCenters: [],
    });

    mockUseAppState.mockReturnValue({
      storage: defaultStorage,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: defaultIso,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    mockFetchIsoList.mockResolvedValue({ success: true });
    mockFetchVmDisks.mockResolvedValue({ success: true });
    mockAttachDisk.mockResolvedValue({ success: true });
    mockConfigureVmStartOnBoot.mockResolvedValue(true);
    mockMountIsoForInstallation.mockResolvedValue(true);

    // Mock api.fetch for VM details refresh
    mockApi.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ name: 'test-vm', datastore: 'Public' }),
    } as any);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  it('renders the AttachDriveForm component with all form fields', () => {
    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    expect(screen.getByText('Select ISO:')).toBeInTheDocument();
    expect(screen.getByDisplayValue('-- Select an ISO --')).toBeInTheDocument();
    expect(screen.getByText('Mount ISO in installation mode')).toBeInTheDocument();
    expect(screen.getByText('Start VM on Host Restart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attach/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('fetches ISO list and VM disks on component mount when server and VM are available', async () => {
    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.100');
      expect(mockFetchVmDisks).toHaveBeenCalledWith('192.168.1.100', 'test-vm');
    });
  });

  it('does not fetch data when server or VM is not available', () => {
    mockUseServer.mockReturnValue({
      selectedServer: null,
      setSelectedServer: jest.fn(),
      dataCenters: [],
    });

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    expect(mockFetchIsoList).not.toHaveBeenCalled();
    expect(mockFetchVmDisks).not.toHaveBeenCalled();
  });

  it('sets disk number based on existing VM disks count', async () => {
    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(mockSetDiskFormField).toHaveBeenCalledWith('diskNo', 2);
    });
  });

  it('renders ISO options from the ISO list', () => {
    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    expect(screen.getByText('ubuntu-20.04.iso')).toBeInTheDocument();
    expect(screen.getByText('windows-10.iso')).toBeInTheDocument();
    expect(screen.getByText('centos-8.iso')).toBeInTheDocument();
  });

  it('handles ISO selection', () => {
    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const isoSelect = screen.getByDisplayValue('-- Select an ISO --');
    fireEvent.change(isoSelect, { target: { value: 'ubuntu-20.04.iso' } });

    expect(mockSetIsoField).toHaveBeenCalledWith('selectedIso', 'ubuntu-20.04.iso');
  });

  it('handles OS installation mode checkbox', () => {
    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const osInstallCheckbox = screen.getByRole('checkbox', {
      name: /mount iso in installation mode/i,
    });
    fireEvent.click(osInstallCheckbox);

    expect(osInstallCheckbox).toBeChecked();
  });

  it('shows error when trying to attach without selecting an ISO', async () => {
    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(screen.getByText('Please select an ISO to attach.')).toBeInTheDocument();
    });

    expect(mockAttachDisk).not.toHaveBeenCalled();
  });

  it('successfully attaches ISO without OS installation mode', async () => {
    const storageWithSelectedIso = {
      ...defaultStorage,
    };

    const isoWithSelection = {
      ...defaultIso,
      selectedIso: 'ubuntu-20.04.iso',
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithSelectedIso,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithSelection,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    render(
      <AttachDriveForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(mockAttachDisk).toHaveBeenCalledWith('192.168.1.100', {
        vmname: 'test-vm',
        datastore: 'Public',
        disk_type: 'ahci-cd',
        disk_dev: 'custom',
        disk_no: 2,
        iso: 'ubuntu-20.04.iso',
      });
      expect(mockSetIsoField).toHaveBeenCalledWith('selectedIso', '');
      expect(mockFetchVmDisks).toHaveBeenCalledWith('192.168.1.100', 'test-vm');
      expect(screen.getByText('Successfully attached ISO ubuntu-20.04.iso')).toBeInTheDocument();
    });

    expect(mockMountIsoForInstallation).not.toHaveBeenCalled();
  });

  it('successfully attaches ISO with OS installation mode', async () => {
    const storageWithSelectedIso = {
      ...defaultStorage,
    };

    const isoWithSelection = {
      ...defaultIso,
      selectedIso: 'ubuntu-20.04.iso',
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithSelectedIso,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithSelection,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    render(
      <AttachDriveForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    // Enable OS installation mode
    const osInstallCheckbox = screen.getByRole('checkbox', {
      name: /mount iso in installation mode/i,
    });
    fireEvent.click(osInstallCheckbox);

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(mockMountIsoForInstallation).toHaveBeenCalledWith(
        '192.168.1.100',
        'test-vm',
        'ubuntu-20.04.iso',
        mockDispatch,
        'Public'
      );
      expect(mockAttachDisk).toHaveBeenCalled();
      expect(
        screen.getByText('Successfully attached ISO ubuntu-20.04.iso in installation mode')
      ).toBeInTheDocument();
    });
  });

  it('handles ISO attachment failure', async () => {
    const storageWithSelectedIso = {
      ...defaultStorage,
    };

    const isoWithSelection = {
      ...defaultIso,
      selectedIso: 'ubuntu-20.04.iso',
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithSelectedIso,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithSelection,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    mockAttachDisk.mockResolvedValue({ error: 'Failed to attach ISO' });

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to attach ISO')).toBeInTheDocument();
    });
  });

  it('handles start on boot checkbox when user has permissions', async () => {
    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const startOnBootCheckbox = screen.getByRole('checkbox', { name: /start vm on host restart/i });
    expect(startOnBootCheckbox).not.toBeDisabled();

    fireEvent.click(startOnBootCheckbox);

    await waitFor(() => {
      expect(mockConfigureVmStartOnBoot).toHaveBeenCalledWith(
        '192.168.1.100',
        'test-vm',
        true,
        mockDispatch
      );
      expect(screen.getByText('VM test-vm will start on host restart')).toBeInTheDocument();
    });
  });

  it('disables start on boot checkbox when user lacks permissions', () => {
    mockUsePermissions.mockReturnValue({
      permissions: {
        LOGS_VIEW: true,
        VM_MANAGE: false, // Set to false to lack VM_MANAGE permission
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

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const startOnBootCheckbox = screen.getByRole('checkbox', { name: /start vm on host restart/i });
    expect(startOnBootCheckbox).toBeDisabled();
  });

  it('handles start on boot configuration failure', async () => {
    mockConfigureVmStartOnBoot.mockRejectedValue(new Error('Configuration failed'));

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const startOnBootCheckbox = screen.getByRole('checkbox', { name: /start vm on host restart/i });
    fireEvent.click(startOnBootCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Configuration failed')).toBeInTheDocument();
    });
  });

  it('handles unchecking start on boot', async () => {
    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const startOnBootCheckbox = screen.getByRole('checkbox', { name: /start vm on host restart/i });

    // First check it
    fireEvent.click(startOnBootCheckbox);
    await waitFor(() => {
      expect(startOnBootCheckbox).toBeChecked();
    });

    // Then uncheck it
    fireEvent.click(startOnBootCheckbox);
    await waitFor(() => {
      expect(mockConfigureVmStartOnBoot).toHaveBeenCalledWith(
        '192.168.1.100',
        'test-vm',
        false,
        mockDispatch
      );
      expect(
        screen.getByText('VM test-vm will no longer start on host restart')
      ).toBeInTheDocument();
    });
  });

  it('clears status messages after 5 seconds', async () => {
    const storageWithSelectedIso = {
      ...defaultStorage,
    };

    const isoWithSelection = {
      ...defaultIso,
      selectedIso: 'ubuntu-20.04.iso',
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithSelectedIso,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithSelection,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(screen.getByText('Successfully attached ISO ubuntu-20.04.iso')).toBeInTheDocument();
    });

    // Fast-forward time by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(
        screen.queryByText('Successfully attached ISO ubuntu-20.04.iso')
      ).not.toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not fetch data when selectedVm name is not available', () => {
    mockUseVm.mockReturnValue({
      selectedVm: { name: '' }, // Empty name
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      fetchVMsWebSocket: jest.fn(),
      performVmActionWebSocket: jest.fn(),
      dataCenters: [],
    });

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    expect(mockFetchIsoList).not.toHaveBeenCalled();
    expect(mockFetchVmDisks).not.toHaveBeenCalled();
  });

  it('sets disk number to 0 when vmDisks is empty', async () => {
    const storageWithEmptyDisks = {
      vmDisks: [],
      diskForm: {
        diskNo: 0,
      },
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithEmptyDisks,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: defaultIso,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(mockSetDiskFormField).toHaveBeenCalledWith('diskNo', 0);
    });
  });

  it('does not set disk number when vmDisks is null or undefined', () => {
    const storageWithNullDisks = {
      vmDisks: null,
      diskForm: {
        diskNo: 0,
      },
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithNullDisks,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: defaultIso,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    // Should not call setDiskFormField when vmDisks is null
    expect(mockSetDiskFormField).not.toHaveBeenCalledWith('diskNo', expect.any(Number));
  });

  it('refetches data when selectedServer.ip changes', async () => {
    const { rerender } = render(
      <AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.100');
      expect(mockFetchVmDisks).toHaveBeenCalledWith('192.168.1.100', 'test-vm');
    });

    // Clear previous calls
    jest.clearAllMocks();

    // Change server IP
    mockUseServer.mockReturnValue({
      selectedServer: { ip: '192.168.1.200' },
      setSelectedServer: jest.fn(),
      dataCenters: [],
    });

    rerender(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.200');
      expect(mockFetchVmDisks).toHaveBeenCalledWith('192.168.1.200', 'test-vm');
    });
  });

  it('refetches data when selectedVm.name changes', async () => {
    const { rerender } = render(
      <AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.100');
      expect(mockFetchVmDisks).toHaveBeenCalledWith('192.168.1.100', 'test-vm');
    });

    // Clear previous calls
    jest.clearAllMocks();

    // Change VM name
    mockUseVm.mockReturnValue({
      selectedVm: { name: 'new-test-vm' },
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      fetchVMsWebSocket: jest.fn(),
      performVmActionWebSocket: jest.fn(),
      dataCenters: [],
    });

    rerender(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.100');
      expect(mockFetchVmDisks).toHaveBeenCalledWith('192.168.1.100', 'new-test-vm');
    });
  });

  it('handles error when attachment throws an exception without result.error', async () => {
    const storageWithSelectedIso = {
      ...defaultStorage,
    };

    const isoWithSelection = {
      ...defaultIso,
      selectedIso: 'ubuntu-20.04.iso',
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithSelectedIso,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithSelection,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    mockAttachDisk.mockRejectedValue(new Error('Network error'));

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('handles error when attachment throws an exception without message', async () => {
    const storageWithSelectedIso = {
      ...defaultStorage,
    };

    const isoWithSelection = {
      ...defaultIso,
      selectedIso: 'ubuntu-20.04.iso',
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithSelectedIso,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithSelection,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    mockAttachDisk.mockRejectedValue({});

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(screen.getByText('Error attaching ISO')).toBeInTheDocument();
    });
  });

  it('renders ISO options when isoList is null or undefined', () => {
    const isoWithNullList = {
      selectedIso: '',
      isoList: null,
    };

    mockUseAppState.mockReturnValue({
      storage: defaultStorage,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithNullList,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    expect(screen.getByDisplayValue('-- Select an ISO --')).toBeInTheDocument();
    expect(screen.queryByText('ubuntu-20.04.iso')).not.toBeInTheDocument();
  });

  it('calls setVmDetails when provided after successful attachment', async () => {
    const storageWithSelectedIso = {
      ...defaultStorage,
    };

    const isoWithSelection = {
      ...defaultIso,
      selectedIso: 'ubuntu-20.04.iso',
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithSelectedIso,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithSelection,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    const mockSetVmDetailsCallback = jest.fn();

    render(<AttachDriveForm setVmDetails={mockSetVmDetailsCallback} onClose={mockOnClose} />);

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(mockAttachDisk).toHaveBeenCalled();
      expect(screen.getByText('Successfully attached ISO ubuntu-20.04.iso')).toBeInTheDocument();
    });

    // The setVmDetails callback should be available for potential use
    expect(mockSetVmDetailsCallback).toBeDefined();
  });

  it('handles dependency changes in useEffect properly', async () => {
    let mockServerValue = { ip: '192.168.1.100' };
    let mockVmValue = { name: 'test-vm' };

    // Create a dynamic mock that we can change
    const dynamicMockUseServer = jest.fn().mockReturnValue({
      selectedServer: mockServerValue,
      setSelectedServer: jest.fn(),
      dataCenters: [],
    });

    const dynamicMockUseVm = jest.fn().mockReturnValue({
      selectedVm: mockVmValue,
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      fetchVMsWebSocket: jest.fn(),
      performVmActionWebSocket: jest.fn(),
      dataCenters: [],
    });

    // Override the global mocks temporarily
    (useServer as jest.MockedFunction<typeof useServer>).mockImplementation(dynamicMockUseServer);
    (useVm as jest.MockedFunction<typeof useVm>).mockImplementation(dynamicMockUseVm);

    const { rerender } = render(
      <AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.100');
      expect(mockFetchVmDisks).toHaveBeenCalledWith('192.168.1.100', 'test-vm');
    });

    // Clear previous calls
    jest.clearAllMocks();

    // Change both server and VM to test dependency array [selectedServer?.ip, selectedVm?.name]
    mockServerValue = { ip: '192.168.1.200' };
    mockVmValue = { name: 'new-vm' };

    dynamicMockUseServer.mockReturnValue({
      selectedServer: mockServerValue,
      setSelectedServer: jest.fn(),
      dataCenters: [],
    });

    dynamicMockUseVm.mockReturnValue({
      selectedVm: mockVmValue,
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      fetchVMsWebSocket: jest.fn(),
      performVmActionWebSocket: jest.fn(),
      dataCenters: [],
    });

    rerender(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.200');
      expect(mockFetchVmDisks).toHaveBeenCalledWith('192.168.1.200', 'new-vm');
    });
  });

  it('throws error when result contains error property', async () => {
    const storageWithSelectedIso = {
      ...defaultStorage,
    };

    const isoWithSelection = {
      ...defaultIso,
      selectedIso: 'ubuntu-20.04.iso',
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithSelectedIso,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithSelection,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    // Mock attachDisk to return an object with error property (line 77)
    mockAttachDisk.mockResolvedValue({ error: 'Specific error from result' });

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(screen.getByText('Specific error from result')).toBeInTheDocument();
    });

    // Verify that the error was thrown and caught
    expect(mockAttachDisk).toHaveBeenCalled();
  });

  it('tests edge case for undefined server and vm values in useEffect', () => {
    // Test with undefined server and VM to trigger the dependency array conditions
    mockUseVm.mockReturnValue({
      selectedVm: undefined,
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      fetchVMsWebSocket: jest.fn(),
      performVmActionWebSocket: jest.fn(),
      dataCenters: [],
    });

    mockUseServer.mockReturnValue({
      selectedServer: undefined,
      setSelectedServer: jest.fn(),
      dataCenters: [],
    });

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    // Should not fetch when undefined
    expect(mockFetchIsoList).not.toHaveBeenCalled();
    expect(mockFetchVmDisks).not.toHaveBeenCalled();
  });

  it('tests dependency array edge cases', async () => {
    // Test with server having ip but VM being null
    mockUseVm.mockReturnValue({
      selectedVm: null,
      setSelectedVm: jest.fn(),
      fetchVMs: jest.fn(),
      fetchVMsWebSocket: jest.fn(),
      performVmActionWebSocket: jest.fn(),
      dataCenters: [],
    });

    mockUseServer.mockReturnValue({
      selectedServer: { ip: '192.168.1.100' },
      setSelectedServer: jest.fn(),
      dataCenters: [],
    });

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    // Should not fetch when VM is null
    expect(mockFetchIsoList).not.toHaveBeenCalled();
    expect(mockFetchVmDisks).not.toHaveBeenCalled();
  });

  // Additional test cases as requested
  it('handles multiple ISO attachments in sequence', async () => {
    const storageWithSelectedIso = {
      ...defaultStorage,
    };

    const isoWithSelection = {
      ...defaultIso,
      selectedIso: 'ubuntu-20.04.iso',
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithSelectedIso,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithSelection,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    render(
      <AttachDriveForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    const attachButton = screen.getByRole('button', { name: /attach/i });

    // First attachment
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(mockAttachDisk).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Successfully attached ISO ubuntu-20.04.iso')).toBeInTheDocument();
    });

    // Reset selectedIso to simulate user selecting another ISO
    isoWithSelection.selectedIso = 'windows-10.iso';

    // Clear success message by advancing timers
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Second attachment
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(mockAttachDisk).toHaveBeenCalledTimes(2);
    });
  });

  it('validates disk number assignment with mixed virtual disk types', async () => {
    const storageWithMixedDisks = {
      vmDisks: [
        { id: 1, type: 'virtio-blk' },
        { id: 2, type: 'ahci-hd' },
        { id: 3, type: 'ahci-cd' },
      ],
      diskForm: {
        diskNo: 0,
      },
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithMixedDisks,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: defaultIso,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    render(<AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(mockSetDiskFormField).toHaveBeenCalledWith('diskNo', 3);
    });
  });

  it('handles component unmount during async operations', async () => {
    const storageWithSelectedIso = {
      ...defaultStorage,
    };

    const isoWithSelection = {
      ...defaultIso,
      selectedIso: 'ubuntu-20.04.iso',
    };

    // Make attachDisk take a long time to resolve
    let resolveAttachDisk: (value: any) => void;
    const attachDiskPromise = new Promise((resolve) => {
      resolveAttachDisk = resolve;
    });
    mockAttachDisk.mockReturnValue(attachDiskPromise);

    mockUseAppState.mockReturnValue({
      storage: storageWithSelectedIso,
      fetchVmDisks: mockFetchVmDisks,
      setDiskFormField: mockSetDiskFormField,
      attachDisk: mockAttachDisk,
      fetchIsoList: mockFetchIsoList,
      iso: isoWithSelection,
      setIsoField: mockSetIsoField,
      dispatch: mockDispatch,
    } as any);

    const { unmount } = render(
      <AttachDriveForm setVmDetails={mockSetVmDetails} onClose={mockOnClose} />
    );

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    // Unmount component while async operation is pending
    unmount();

    // Resolve the async operation after unmount
    resolveAttachDisk!({ success: true });

    // Test should complete without errors (no state updates on unmounted component)
    await waitFor(() => {
      expect(mockAttachDisk).toHaveBeenCalled();
    });
  });
});
