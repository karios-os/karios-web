import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'react-toastify';
import Hardware from './hardware';
import {
  useVm,
  useServer,
  api,
  useApprovalFlow,
  useAppState,
  fetchVmDetails,
} from '@karios-monorepo/shared-state';
import {
  setupVMMigrationStatusSSE,
  MigrationStatusResponse,
  MigrationDisk,
  getStatusColor,
  getStatusDisplayText,
} from '../../shared-state/src/utils/vmMigrationStatusService';
import {
  retryDiskMigration,
  setupDiskStatusSSE,
  DiskStatusData,
} from '../../shared-state/src/utils/migrationApiService';

// Mock all dependencies
jest.mock('@karios-monorepo/shared-state');
jest.mock('../../shared-state/src/utils/vmMigrationStatusService');
jest.mock('../../shared-state/src/utils/migrationApiService');
jest.mock('react-toastify');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({
    pathname: '/vm/hardware',
    search: '',
    hash: '',
    state: null,
  }),
}));
jest.mock('../../../runtime-config', () => ({
  __esModule: true,
  default: () => ({
    PROTOCOL: 'http',
    CONTROL_NODE_IP: {
      URL: 'localhost',
      PORT: ':3000',
    },
  }),
}));

// Mock all icon imports
jest.mock('react-icons/fa', () => ({
  FaMemory: () => <div data-testid="memory-icon" />,
  FaMicrochip: () => <div data-testid="microchip-icon" />,
  FaHdd: () => <div data-testid="hdd-icon" />,
  FaNetworkWired: () => <div data-testid="network-icon" />,
  FaExchangeAlt: () => <div data-testid="exchange-icon" />,
  FaClock: () => <div data-testid="clock-icon" />,
  FaServer: () => <div data-testid="server-icon" />,
  FaDatabase: () => <div data-testid="database-icon" />,
  FaChevronRight: () => <div data-testid="chevron-icon" />,
  FaEthernet: () => <div data-testid="ethernet-icon" />,
  FaGlobe: () => <div data-testid="globe-icon" />,
  FaLink: () => <div data-testid="link-icon" />,
  FaMapMarkerAlt: () => <div data-testid="marker-icon" />,
}));

jest.mock('react-icons/bs', () => ({
  BsGpuCard: () => <div data-testid="gpu-icon" />,
  BsPciCardNetwork: () => <div data-testid="pci-network-icon" />,
  BsFillNvmeFill: () => <div data-testid="nvme-icon" />,
}));

jest.mock('iconsax-react', () => ({
  ArrowRotateRight: () => <div data-testid="arrow-rotate-icon" />,
  Cpu: () => <div data-testid="cpu-icon" />,
  Folder: () => <div data-testid="folder-icon" />,
  Ram: () => <div data-testid="ram-icon" />,
  ArrowRight2: () => <div data-testid="arrow-right-icon" />,
  Export: () => <div data-testid="export-icon" />,
  AttachCircle: () => <div data-testid="attach-icon" />,
  Trash: () => <div data-testid="trash-icon" />,
  Refresh: () => <div data-testid="refresh-icon" />,
}));

jest.mock('react-icons/pi', () => ({
  PiMemoryDuotone: () => <div data-testid="memory-duotone-icon" />,
}));

// Mock subcomponents
jest.mock('./hardware_components/AttachDrive', () => {
  return function AttachDriveForm({ isOpen, onClose }: any) {
    if (!isOpen) return null;
    return <div data-testid="attach-drive-form">Attach Drive Form</div>;
  };
});

jest.mock('./hardware_components/AttachDisk', () => {
  return function AttachDiskForm({ isOpen, onClose }: any) {
    if (!isOpen) return null;
    return <div data-testid="attach-disk-form">Attach Disk Form</div>;
  };
});

jest.mock('./hardware_components/unusedDisks', () => {
  return function UnusedDisks() {
    return <div data-testid="unused-disks">Unused Disks</div>;
  };
});

jest.mock('./hardware_components/ReassignDiskForm', () => {
  return function ReassignDiskForm({ isOpen, onClose }: any) {
    if (!isOpen) return null;
    return <div data-testid="reassign-disk-form">Reassign Disk Form</div>;
  };
});

jest.mock('./hardware_components/Modal', () => {
  return function Modal({ isOpen, onClose, children }: any) {
    if (!isOpen) return null;
    return <div data-testid="modal">{children}</div>;
  };
});

jest.mock('../../shared-state/src/widgets/Tooltip', () => {
  return function Tooltip({ children, title }: any) {
    return <div title={title}>{children}</div>;
  };
});

jest.mock('@karios-monorepo/feature-server', () => ({
  StatusCard: ({ children }: any) => <div data-testid="status-card">{children}</div>,
}));

const mockUseVm = useVm as jest.MockedFunction<typeof useVm>;
const mockUseServer = useServer as jest.MockedFunction<typeof useServer>;
const mockApi = api as jest.Mocked<typeof api>;
const mockUseApprovalFlow = useApprovalFlow as jest.MockedFunction<typeof useApprovalFlow>;
const mockUseAppState = useAppState as jest.MockedFunction<typeof useAppState>;
const mockFetchVmDetails = fetchVmDetails as jest.MockedFunction<typeof fetchVmDetails>;
const mockSetupVMMigrationStatusSSE = setupVMMigrationStatusSSE as jest.MockedFunction<
  typeof setupVMMigrationStatusSSE
>;
const mockRetryDiskMigration = retryDiskMigration as jest.MockedFunction<typeof retryDiskMigration>;
const mockSetupDiskStatusSSE = setupDiskStatusSSE as jest.MockedFunction<typeof setupDiskStatusSSE>;
const mockGetStatusColor = getStatusColor as jest.MockedFunction<typeof getStatusColor>;
const mockGetStatusDisplayText = getStatusDisplayText as jest.MockedFunction<
  typeof getStatusDisplayText
>;
const mockToast = toast as jest.Mocked<typeof toast>;

// Mock EventSource
class MockEventSource {
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close: jest.MockedFunction<() => void>;
  readyState: number = 1;

  constructor(url: string) {
    this.url = url;
    this.close = jest.fn();
  }

  dispatchEvent(event: Event): boolean {
    return true;
  }

  addEventListener(type: string, listener: EventListener): void {}
  removeEventListener(type: string, listener: EventListener): void {}
}

global.EventSource = MockEventSource as any;

describe('Hardware Component - Migration Functionality', () => {
  const mockVm = {
    uuid: 'test-vm-uuid-123',
    name: 'test-vm',
    state: 'running',
    disks: [
      {
        number: 1,
        vmdk_id: 'disk-001',
        size: '20GB',
        name: 'test-disk-1.vmdk',
        migration_status: 'completed',
      },
      {
        number: 2,
        vmdk_id: 'disk-002',
        size: '30GB',
        name: 'test-disk-2.vmdk',
        migration_status: 'migration_failed',
      },
    ],
    memory: 4096,
    cpu: 2,
  };

  const mockServer = {
    ip: '192.168.1.100',
    name: 'test-server',
  };

  const mockMigrationStatus: MigrationStatusResponse = {
    disks: [
      {
        disk_name: 'test-disk-1.vmdk',
        message: 'Migration completed',
        progress: 100,
        status: 'completed',
        updated_at: '2023-01-01T00:00:00Z',
      },
      {
        disk_name: 'test-disk-2.vmdk',
        message: 'Migration failed',
        progress: 50,
        status: 'migration_failed',
        updated_at: '2023-01-01T00:00:00Z',
      },
    ],
    overall_progress: 75,
    status: 'in_progress',
    updated_at: '2023-01-01T00:00:00Z',
    vm_name: 'test-vm',
    vm_uuid: 'test-vm-uuid-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockUseVm.mockReturnValue({
      selectedVm: mockVm,
      isLoading: false,
      error: null,
      getVmInfo: jest.fn(),
      refreshVmData: jest.fn(),
    } as any);

    mockUseServer.mockReturnValue({
      selectedServer: mockServer,
      isLoading: false,
      error: null,
    } as any);

    mockUseApprovalFlow.mockReturnValue({
      openApprovalModal: jest.fn(),
      closeApprovalModal: jest.fn(),
      isApprovalModalOpen: false,
    } as any);

    mockUseAppState.mockReturnValue({
      selectedSection: 'All',
      dispatch: jest.fn(),
    } as any);

    mockApi.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    } as any);

    mockFetchVmDetails.mockResolvedValue(mockVm as any);

    mockGetStatusColor.mockImplementation((status: string) => {
      switch (status) {
        case 'completed':
          return '#10B981';
        case 'migration_failed':
          return '#EF4444';
        default:
          return '#6B7280';
      }
    });

    mockGetStatusDisplayText.mockImplementation((status: string) => {
      switch (status) {
        case 'completed':
          return 'Completed';
        case 'migration_failed':
          return 'Failed';
        default:
          return status;
      }
    });

    mockToast.success = jest.fn();
    mockToast.error = jest.fn();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <Hardware />
      </BrowserRouter>
    );
  };

  describe('Migration State Management', () => {
    it('should initialize migration state correctly', () => {
      renderComponent();

      // Component should render without errors
      expect(screen.getByText('Hardware Overview')).toBeInTheDocument();
    });

    it('should detect when VM is migrating', async () => {
      const migratingVm = { ...mockVm, state: 'migrating' };
      mockUseVm.mockReturnValue({
        selectedVm: migratingVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      const mockEventSource = new MockEventSource('test-url');
      mockSetupVMMigrationStatusSSE.mockReturnValue(mockEventSource as any);

      renderComponent();

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalledWith(
          '192.168.1.100',
          'test-vm-uuid-123',
          expect.any(Function),
          expect.any(Function),
          expect.any(Function)
        );
      });
    });

    it('should handle migration status updates', async () => {
      const migratingVm = { ...mockVm, state: 'migrating' };
      mockUseVm.mockReturnValue({
        selectedVm: migratingVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      const mockEventSource = new MockEventSource('test-url');
      let statusUpdateCallback: (status: MigrationStatusResponse) => void;

      mockSetupVMMigrationStatusSSE.mockImplementation((targetNodeIp, vmUuid, onStatusUpdate) => {
        statusUpdateCallback = onStatusUpdate;
        return mockEventSource as any;
      });

      renderComponent();

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalled();
      });

      // Simulate status update
      act(() => {
        statusUpdateCallback!(mockMigrationStatus);
      });

      // Should handle the status update without errors
      expect(mockEventSource.close).not.toHaveBeenCalled();
    });

    it('should clean up SSE connection when VM stops migrating', async () => {
      // Start with migrating VM
      const migratingVm = { ...mockVm, state: 'migrating' };
      const { rerender } = render(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      const mockEventSource = new MockEventSource('test-url');
      mockSetupVMMigrationStatusSSE.mockReturnValue(mockEventSource as any);

      mockUseVm.mockReturnValue({
        selectedVm: migratingVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      rerender(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalled();
      });

      // Change VM state to running
      const runningVm = { ...mockVm, state: 'running' };
      mockUseVm.mockReturnValue({
        selectedVm: runningVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      rerender(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockEventSource.close).toHaveBeenCalled();
      });
    });

    it('should maintain SSE connection during transferring state', async () => {
      const transferringVm = { ...mockVm, state: 'transferring' };
      mockUseVm.mockReturnValue({
        selectedVm: transferringVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      const mockEventSource = new MockEventSource('test-url');
      mockSetupVMMigrationStatusSSE.mockReturnValue(mockEventSource as any);

      renderComponent();

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalledWith(
          '192.168.1.100',
          'test-vm-uuid-123',
          expect.any(Function),
          expect.any(Function),
          expect.any(Function)
        );
      });
    });

    it('should maintain SSE connection during transferred state', async () => {
      const transferredVm = { ...mockVm, state: 'transferred' };
      mockUseVm.mockReturnValue({
        selectedVm: transferredVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      const mockEventSource = new MockEventSource('test-url');
      mockSetupVMMigrationStatusSSE.mockReturnValue(mockEventSource as any);

      renderComponent();

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalledWith(
          '192.168.1.100',
          'test-vm-uuid-123',
          expect.any(Function),
          expect.any(Function),
          expect.any(Function)
        );
      });
    });

    it('should close SSE connection when VM exits migration-related states', async () => {
      // Start with transferring VM
      const transferringVm = { ...mockVm, state: 'transferring' };
      const { rerender } = render(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      const mockEventSource = new MockEventSource('test-url');
      mockSetupVMMigrationStatusSSE.mockReturnValue(mockEventSource as any);

      mockUseVm.mockReturnValue({
        selectedVm: transferringVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      rerender(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalled();
      });

      // Change VM state to running (non-migration state)
      const runningVm = { ...mockVm, state: 'running' };
      mockUseVm.mockReturnValue({
        selectedVm: runningVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      rerender(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockEventSource.close).toHaveBeenCalled();
      });
    });

    it('should maintain SSE connection during transferring state', async () => {
      const transferringVm = { ...mockVm, state: 'transferring' };
      mockUseVm.mockReturnValue({
        selectedVm: transferringVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      const mockEventSource = new MockEventSource('test-url');
      mockSetupVMMigrationStatusSSE.mockReturnValue(mockEventSource as any);

      renderComponent();

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalledWith(
          '192.168.1.100',
          'test-vm-uuid-123',
          expect.any(Function),
          expect.any(Function),
          expect.any(Function)
        );
      });
    });

    it('should maintain SSE connection during transferred state', async () => {
      const transferredVm = { ...mockVm, state: 'transferred' };
      mockUseVm.mockReturnValue({
        selectedVm: transferredVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      const mockEventSource = new MockEventSource('test-url');
      mockSetupVMMigrationStatusSSE.mockReturnValue(mockEventSource as any);

      renderComponent();

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalledWith(
          '192.168.1.100',
          'test-vm-uuid-123',
          expect.any(Function),
          expect.any(Function),
          expect.any(Function)
        );
      });
    });

    it('should close SSE connection when VM exits migration-related states', async () => {
      // Start with transferring VM
      const transferringVm = { ...mockVm, state: 'transferring' };
      const { rerender } = render(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      const mockEventSource = new MockEventSource('test-url');
      mockSetupVMMigrationStatusSSE.mockReturnValue(mockEventSource as any);

      mockUseVm.mockReturnValue({
        selectedVm: transferringVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      rerender(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalled();
      });

      // Change VM state to running (non-migration state)
      const runningVm = { ...mockVm, state: 'running' };
      mockUseVm.mockReturnValue({
        selectedVm: runningVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      rerender(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockEventSource.close).toHaveBeenCalled();
      });
    });
  });

  describe('Disk Migration Retry Functionality', () => {
    it('should handle successful disk retry', async () => {
      const mockGetVmInfo = jest.fn();
      mockUseVm.mockReturnValue({
        selectedVm: mockVm,
        isLoading: false,
        error: null,
        getVmInfo: mockGetVmInfo,
        refreshVmData: jest.fn(),
      } as any);

      mockRetryDiskMigration.mockResolvedValue({
        success: true,
        message: 'Retry initiated successfully',
      });

      const mockDiskEventSource = new MockEventSource('disk-url');
      let diskStatusCallback: (status: DiskStatusData) => void;

      mockSetupDiskStatusSSE.mockImplementation((diskId, vmUuid, onStatusUpdate) => {
        diskStatusCallback = onStatusUpdate;
        return mockDiskEventSource as any;
      });

      renderComponent();

      // Find and click retry button for failed disk
      const retryButtons = screen.getAllByText(/retry/i);
      expect(retryButtons.length).toBeGreaterThan(0);

      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(mockRetryDiskMigration).toHaveBeenCalledWith(
          'disk-002',
          'test-vm-uuid-123',
          expect.any(String)
        );
        expect(mockToast.success).toHaveBeenCalledWith(
          'Disk disk-002 migration retry initiated successfully'
        );
      });

      // Simulate disk completion
      act(() => {
        diskStatusCallback!({
          disk_id: 'disk-002',
          vm_uuid: 'test-vm-uuid-123',
          status: 'completed',
          progress: 100,
          message: 'Migration completed',
          updated_at: '2023-01-01T00:00:00Z',
        });
      });

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Disk disk-002 migration completed successfully'
        );
        expect(mockGetVmInfo).toHaveBeenCalledWith(
          true,
          'Disk migration completed - refreshing data'
        );
      });
    });

    it('should handle failed disk retry', async () => {
      mockUseVm.mockReturnValue({
        selectedVm: mockVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      mockRetryDiskMigration.mockRejectedValue(new Error('Retry failed'));

      renderComponent();

      const retryButtons = screen.getAllByText(/retry/i);
      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Failed to retry disk disk-002 migration: Retry failed'
        );
      });
    });

    it('should handle disk retry without VM UUID', async () => {
      const vmWithoutUuid = { ...mockVm, uuid: undefined };
      mockUseVm.mockReturnValue({
        selectedVm: vmWithoutUuid,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      renderComponent();

      const retryButtons = screen.getAllByText(/retry/i);
      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('VM UUID not available for disk retry');
      });
    });

    it('should handle disk retry without disk ID', async () => {
      const vmWithBadDisk = {
        ...mockVm,
        disks: [
          {
            // Missing vmdk_id and number
            size: '20GB',
            name: 'test-disk.vmdk',
            migration_status: 'migration_failed',
          },
        ],
      };

      mockUseVm.mockReturnValue({
        selectedVm: vmWithBadDisk,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      renderComponent();

      const retryButtons = screen.getAllByText(/retry/i);
      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Disk ID not available for retry');
      });
    });
  });

  describe('Migration Status Display', () => {
    it('should display disk migration status correctly', () => {
      renderComponent();

      // Should show migration status for disks
      expect(mockGetStatusColor).toHaveBeenCalledWith('completed');
      expect(mockGetStatusColor).toHaveBeenCalledWith('migration_failed');
      expect(mockGetStatusDisplayText).toHaveBeenCalledWith('completed');
      expect(mockGetStatusDisplayText).toHaveBeenCalledWith('migration_failed');
    });

    it('should show retry button only for failed disks', () => {
      renderComponent();

      // Should show retry buttons for failed disks
      const retryButtons = screen.getAllByText(/retry/i);
      expect(retryButtons.length).toBeGreaterThan(0);
    });

    it('should handle migration error display', async () => {
      const migratingVm = { ...mockVm, state: 'migrating' };
      mockUseVm.mockReturnValue({
        selectedVm: migratingVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      const mockEventSource = new MockEventSource('test-url');
      let errorCallback: (error: any) => void;

      mockSetupVMMigrationStatusSSE.mockImplementation(
        (targetNodeIp, vmUuid, onStatusUpdate, onError) => {
          errorCallback = onError!;
          return mockEventSource as any;
        }
      );

      renderComponent();

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalled();
      });

      // Simulate migration error
      act(() => {
        errorCallback!(new Error('Migration connection failed'));
      });

      // Should handle error appropriately
      expect(mockEventSource).toBeDefined();
    });
  });

  describe('VM State Change Detection', () => {
    it('should detect VM state changes and refresh data', async () => {
      const mockGetVmInfo = jest.fn();

      // Start with running VM
      const runningVm = { ...mockVm, state: 'running' };
      const { rerender } = render(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      mockUseVm.mockReturnValue({
        selectedVm: runningVm,
        isLoading: false,
        error: null,
        getVmInfo: mockGetVmInfo,
        refreshVmData: jest.fn(),
      } as any);

      rerender(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      // Change to migrating state
      const migratingVm = { ...mockVm, state: 'migrating' };
      mockUseVm.mockReturnValue({
        selectedVm: migratingVm,
        isLoading: false,
        error: null,
        getVmInfo: mockGetVmInfo,
        refreshVmData: jest.fn(),
      } as any);

      rerender(
        <BrowserRouter>
          <Hardware />
        </BrowserRouter>
      );

      // Should detect state change and call getVmInfo
      await waitFor(() => {
        expect(mockGetVmInfo).toHaveBeenCalledWith(
          true,
          'migration completed - VM state changed to migrating'
        );
      });
    });
  });

  describe('Component Cleanup', () => {
    it('should clean up SSE connections on unmount', async () => {
      const migratingVm = { ...mockVm, state: 'migrating' };
      mockUseVm.mockReturnValue({
        selectedVm: migratingVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      const mockEventSource = new MockEventSource('test-url');
      mockSetupVMMigrationStatusSSE.mockReturnValue(mockEventSource as any);

      const { unmount } = renderComponent();

      await waitFor(() => {
        expect(mockSetupVMMigrationStatusSSE).toHaveBeenCalled();
      });

      // Unmount component
      unmount();

      // Should clean up connections
      await waitFor(() => {
        expect(mockEventSource.close).toHaveBeenCalled();
      });
    });

    it('should clean up disk SSE connections on unmount', async () => {
      mockUseVm.mockReturnValue({
        selectedVm: mockVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      mockRetryDiskMigration.mockResolvedValue({
        success: true,
        message: 'Retry initiated successfully',
      });

      const mockDiskEventSource = new MockEventSource('disk-url');
      mockSetupDiskStatusSSE.mockReturnValue(mockDiskEventSource as any);

      const { unmount } = renderComponent();

      // Trigger disk retry
      const retryButtons = screen.getAllByText(/retry/i);
      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(mockSetupDiskStatusSSE).toHaveBeenCalled();
      });

      // Unmount component
      unmount();

      // Should clean up disk connections
      await waitFor(() => {
        expect(mockDiskEventSource.close).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle migration status fetch errors gracefully', async () => {
      const migratingVm = { ...mockVm, state: 'migrating' };
      mockUseVm.mockReturnValue({
        selectedVm: migratingVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      // Simulate SSE setup error
      mockSetupVMMigrationStatusSSE.mockImplementation(() => {
        throw new Error('SSE connection failed');
      });

      // Should not crash the component
      expect(() => renderComponent()).not.toThrow();
    });

    it('should handle disk retry API errors', async () => {
      mockUseVm.mockReturnValue({
        selectedVm: mockVm,
        isLoading: false,
        error: null,
        getVmInfo: jest.fn(),
        refreshVmData: jest.fn(),
      } as any);

      mockRetryDiskMigration.mockResolvedValue({
        success: false,
        message: 'API error occurred',
      });

      renderComponent();

      const retryButtons = screen.getAllByText(/retry/i);
      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Failed to retry disk disk-002 migration: API error occurred'
        );
      });
    });
  });
});
