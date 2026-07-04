import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AttachDiskForm from './AttachDisk';
import { useVm, useServer, useAppState } from '@karios-monorepo/shared-state';

// Mock the shared-state module
jest.mock('@karios-monorepo/shared-state', () => ({
  useVm: jest.fn(),
  useServer: jest.fn(),
  useAppState: jest.fn(),
}));

const mockUseVm = useVm as jest.MockedFunction<typeof useVm>;
const mockUseServer = useServer as jest.MockedFunction<typeof useServer>;
const mockUseAppState = useAppState as jest.MockedFunction<typeof useAppState>;

// Mock window.alert
const mockAlert = jest.fn();
global.alert = mockAlert;

describe('AttachDiskForm Component', () => {
  const mockSetVmDetails = jest.fn();
  const mockOnClose = jest.fn();
  const mockFetchStoragePools = jest.fn();
  const mockFetchDatastores = jest.fn();
  const mockFetchVmDisks = jest.fn();
  const mockAttachDisk = jest.fn();
  const mockSetDiskFormField = jest.fn();

  const defaultStorage = {
    pools: [
      { NAME: 'pool1', FREE: '100G' },
      { NAME: 'pool2', FREE: '50G' },
    ],
    poolsTransformed: [],
    vmDisks: [{ id: 1 }, { id: 2 }],
    diskForm: {
      diskType: 'virtio-blk',
      diskDev: 'custom',
      diskSize: '1G',
      zfsPath: '',
      selectedZpool: '',
      zpoolFreeSpace: '',
      diskNo: 2,
      zpoolList: [],
    },
    attachError: null,
    attachLoading: false,
    attachSuccess: null,
    datastores: [],
    deleteError: null,
    deleteLoading: false,
    deleteSuccess: null,
    loadingDatastores: false,
    loadingPools: false,
    loadingVmDisks: false,
    reassignError: null,
    reassignLoading: false,
    reassignSuccess: null,
  };

  const defaultDatastores = [{ name: 'datastore1' }, { NAME: 'datastore2' }];

  const mockVmDetails = {
    name: 'test-vm',
    datastore: 'Public',
    'virtual-disk': [{ id: 1 }, { id: 2 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAppState.mockReturnValue({
      storage: defaultStorage,
      datastores: defaultDatastores,
      fetchStoragePools: mockFetchStoragePools,
      fetchDatastores: mockFetchDatastores,
      fetchVmDisks: mockFetchVmDisks,
      attachDisk: mockAttachDisk,
      setDiskFormField: mockSetDiskFormField,
    } as any);

    mockFetchStoragePools.mockResolvedValue({ success: true });
    mockAttachDisk.mockResolvedValue({ success: true });
  });

  it('renders the AttachDiskForm component with all form fields', () => {
    render(
      <AttachDiskForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    expect(screen.getByText('Disk Type:')).toBeInTheDocument();
    expect(screen.getByText('Disk Device:')).toBeInTheDocument();
    expect(screen.getByText('ZFS Dataset Path:')).toBeInTheDocument();
    // Datastore field has been removed since it now comes from vmDetails
    expect(screen.getByText(/disk size/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attach/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('fetches storage data on component mount when server is available', async () => {
    render(
      <AttachDiskForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    await waitFor(() => {
      expect(mockFetchStoragePools).toHaveBeenCalledWith('192.168.1.100');
      expect(mockFetchDatastores).toHaveBeenCalledWith('192.168.1.100');
      expect(mockFetchVmDisks).toHaveBeenCalledWith('192.168.1.100', 'test-vm');
    });
  });

  it('sets disk number based on existing VM disks count', async () => {
    render(
      <AttachDiskForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    await waitFor(() => {
      expect(mockSetDiskFormField).toHaveBeenCalledWith('diskNo', 2);
    });
  });

  it('initializes form with default values', async () => {
    render(
      <AttachDiskForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    await waitFor(() => {
      expect(mockSetDiskFormField).toHaveBeenCalledWith('diskDev', 'custom');
      expect(mockSetDiskFormField).toHaveBeenCalledWith('diskSize', '1G');
    });
  });

  it('handles ZFS pool selection and updates related fields', () => {
    render(
      <AttachDiskForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    // The select should have the placeholder value if nothing is selected
    const zpoolSelect = screen.getByDisplayValue(/select zfs pool/i);
    fireEvent.change(zpoolSelect, { target: { value: 'pool1' } });

    expect(mockSetDiskFormField).toHaveBeenCalledWith('selectedZpool', 'pool1');
    expect(mockSetDiskFormField).toHaveBeenCalledWith('zfsPath', 'pool1/vm');
    expect(mockSetDiskFormField).toHaveBeenCalledWith('zpoolFreeSpace', '100G');
  });

  it('displays "No pools available" when no storage pools exist', () => {
    mockUseAppState.mockReturnValue({
      storage: { ...defaultStorage, pools: [], diskForm: { ...defaultStorage.diskForm } },
      datastores: defaultDatastores,
      fetchStoragePools: mockFetchStoragePools,
      fetchDatastores: mockFetchDatastores,
      fetchVmDisks: mockFetchVmDisks,
      attachDisk: mockAttachDisk,
      setDiskFormField: mockSetDiskFormField,
    } as any);

    render(
      <AttachDiskForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    expect(screen.getByText('No pools available')).toBeInTheDocument();
  });

  it('successfully attaches disk with valid form data', async () => {
    // Use fake timers to control setTimeout
    jest.useFakeTimers();

    const storageWithValidForm = {
      ...defaultStorage,
      diskForm: {
        ...defaultStorage.diskForm,
        diskSize: '10G',
        zfsPath: 'pool1/vm',
        selectedZpool: 'pool1',
        zpoolFreeSpace: '100G',
        diskNo: '2',
        datastore: 'datastore1',
      },
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithValidForm,
      datastores: defaultDatastores,
      fetchStoragePools: mockFetchStoragePools,
      fetchDatastores: mockFetchDatastores,
      fetchVmDisks: mockFetchVmDisks,
      attachDisk: mockAttachDisk,
      setDiskFormField: mockSetDiskFormField,
    } as any);

    render(
      <AttachDiskForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    // Wait for initial assertions
    await waitFor(() => {
      expect(mockAttachDisk).toHaveBeenCalledWith('192.168.1.100', {
        vmname: 'test-vm',
        datastore: 'Public',
        size: '10G',
        zvol_path: 'pool1',
        zvol_name: '',
        disk_no: 2,
        disk_type: 'virtio-blk',
        disk_dev: 'custom',
      });
      expect(mockAlert).toHaveBeenCalledWith('Disk attached successfully!');
    });
    // Fast-forward timers to trigger the setTimeout callback
    jest.advanceTimersByTime(1500);
    // Now check if onClose was called
    expect(mockOnClose).toHaveBeenCalled();

    // Restore real timers
    jest.useRealTimers();
  });

  it('shows error when trying to attach disk with insufficient space', async () => {
    const storageWithLargeSize = {
      ...defaultStorage,
      diskForm: {
        ...defaultStorage.diskForm,
        diskSize: '200G', // Larger than available space
        zfsPath: 'pool1/vm',
        selectedZpool: 'pool1',
        zpoolFreeSpace: '100G',
        diskNo: '2',
        datastore: 'datastore1',
      },
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithLargeSize,
      datastores: defaultDatastores,
      fetchStoragePools: mockFetchStoragePools,
      fetchDatastores: mockFetchDatastores,
      fetchVmDisks: mockFetchVmDisks,
      attachDisk: mockAttachDisk,
      setDiskFormField: mockSetDiskFormField,
    } as any);

    render(
      <AttachDiskForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Disk size exceeds available zpool space.');
      expect(mockAttachDisk).not.toHaveBeenCalled();
    });
  });

  it('shows validation error when required fields are missing', async () => {
    const storageWithIncompleteForm = {
      ...defaultStorage,
      diskForm: {
        ...defaultStorage.diskForm,
        diskSize: '', // Missing required field
        zfsPath: '',
        selectedZpool: '',
        zpoolFreeSpace: '',
        diskNo: '',
        datastore: '',
      },
    };

    mockUseAppState.mockReturnValue({
      storage: storageWithIncompleteForm,
      datastores: defaultDatastores,
      fetchStoragePools: mockFetchStoragePools,
      fetchDatastores: mockFetchDatastores,
      fetchVmDisks: mockFetchVmDisks,
      attachDisk: mockAttachDisk,
      setDiskFormField: mockSetDiskFormField,
    } as any);

    render(
      <AttachDiskForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Please fill in all fields.');
      expect(mockAttachDisk).not.toHaveBeenCalled();
    });
  });

  it('handles disk attachment failure', async () => {
    const storageWithValidForm = {
      ...defaultStorage,
      diskForm: {
        ...defaultStorage.diskForm,
        diskSize: '10G',
        zfsPath: 'pool1/vm',
        selectedZpool: 'pool1',
        zpoolFreeSpace: '100G',
        diskNo: '2',
        datastore: 'datastore1',
      },
    };

    mockAttachDisk.mockResolvedValue({ success: false, error: 'Attachment failed' });

    mockUseAppState.mockReturnValue({
      storage: storageWithValidForm,
      datastores: defaultDatastores,
      fetchStoragePools: mockFetchStoragePools,
      fetchDatastores: mockFetchDatastores,
      fetchVmDisks: mockFetchVmDisks,
      attachDisk: mockAttachDisk,
      setDiskFormField: mockSetDiskFormField,
    } as any);

    render(
      <AttachDiskForm
        setVmDetails={mockSetVmDetails}
        onClose={mockOnClose}
        vmDetails={mockVmDetails}
      />
    );

    const attachButton = screen.getByRole('button', { name: /attach/i });
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Failed to attach disk: Attachment failed');
      expect(mockOnClose).toHaveBeenCalled(); // Component calls onClose() immediately to prevent UI freezing
    });
  });
});
