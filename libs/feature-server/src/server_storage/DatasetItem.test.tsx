import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DatasetItem from './DatasetItem';
import { logger } from '../../../shared-state/src/utils/logger';

// Mock dependencies
jest.mock('@karios-monorepo/shared-state', () => ({
  usePermissions: jest.fn(),
  useServer: jest.fn(),
  useStorage: jest.fn(),
}));

// Mock the logger
jest.mock('../../../shared-state/src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock icons
jest.mock('iconsax-react', () => ({
  Trash: jest.fn(({ size, color, ...props }) => (
    <div data-testid="trash-icon" {...props}>
      Trash
    </div>
  )),
  Gallery: jest.fn(({ size, color, ...props }) => (
    <div data-testid="gallery-icon" {...props}>
      Gallery
    </div>
  )),
}));

// Mock window methods
const mockAlert = jest.fn();
const mockConfirm = jest.fn();
global.alert = mockAlert;
global.confirm = mockConfirm;

// Logger is already mocked above - no additional console mocking needed

const mockUsePermissions = require('@karios-monorepo/shared-state').usePermissions as jest.Mock;
const mockUseServer = require('@karios-monorepo/shared-state').useServer as jest.Mock;
const mockUseStorage = require('@karios-monorepo/shared-state').useStorage as jest.Mock;

describe('DatasetItem Component', () => {
  const mockTakeSnapshot = jest.fn();
  const mockDeleteDataset = jest.fn();
  const mockHandleDeduplicationToggle = jest.fn();
  const mockHandleCompressionToggle = jest.fn();

  const mockDataset = {
    name: 'test-dataset',
    used: '100G',
    avail: '900G',
    mount: '/mnt/test-dataset',
  };

  const mockSelectedServer = {
    ip: '192.168.1.100',
    name: 'test-server',
  };

  const defaultProps = {
    dataset: mockDataset,
    poolName: 'test-pool',
    selectedDatasetType: 'filesystem',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (logger.error as jest.Mock).mockClear();

    mockUsePermissions.mockReturnValue({
      permissions: { ZFS_MANAGE: true },
    });

    mockUseServer.mockReturnValue({
      selectedServer: mockSelectedServer,
    });

    mockUseStorage.mockReturnValue({
      deduplicationStatus: { 'test-dataset': false },
      isTogglingDeduplication: { 'test-dataset': false },
      compressionStatus: { 'test-dataset': false },
      isTogglingCompression: { 'test-dataset': false },
      handleDeduplicationToggle: mockHandleDeduplicationToggle,
      handleCompressionToggle: mockHandleCompressionToggle,
      deleteDataset: mockDeleteDataset,
      takeZfsSnapshot: mockTakeSnapshot,
    });
  });

  // Test 1: Component renders correctly with dataset information
  it('renders dataset information correctly', () => {
    render(<DatasetItem {...defaultProps} />);

    expect(screen.getByText('test-dataset')).toBeInTheDocument();
    expect(
      screen.getByText('Used: 100G | Available: 900G | Mount: /mnt/test-dataset')
    ).toBeInTheDocument();
  });

  // Test 2: Deduplication toggle functionality
  it('handles deduplication toggle correctly', async () => {
    render(<DatasetItem {...defaultProps} />);

    // Find the deduplication checkbox by its position (first checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    const deduplicationCheckbox = checkboxes[0];

    expect(deduplicationCheckbox).toBeInTheDocument();
    expect(deduplicationCheckbox).not.toBeChecked();

    await act(async () => {
      fireEvent.click(deduplicationCheckbox);
    });

    expect(mockHandleDeduplicationToggle).toHaveBeenCalledWith(
      mockSelectedServer.ip,
      mockDataset.name,
      'test-pool'
    );
  });

  // Test 3: Compression toggle functionality
  it('handles compression toggle correctly', async () => {
    render(<DatasetItem {...defaultProps} />);

    // Find the compression checkbox by its position (second checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    const compressionCheckbox = checkboxes[1];

    expect(compressionCheckbox).toBeInTheDocument();
    expect(compressionCheckbox).not.toBeChecked();

    await act(async () => {
      fireEvent.click(compressionCheckbox);
    });

    expect(mockHandleCompressionToggle).toHaveBeenCalledWith(
      mockSelectedServer.ip,
      mockDataset.name,
      'test-pool'
    );
  });

  // Test 4: Snapshot creation with valid name
  it('creates snapshot successfully with valid name', async () => {
    mockTakeSnapshot.mockResolvedValueOnce(undefined);

    render(<DatasetItem {...defaultProps} />);

    const snapshotInput = screen.getByPlaceholderText('Snapshot name');
    // Get the green button (snapshot button) by its background color class
    const buttons = screen.getAllByRole('button');
    const snapshotButton = buttons.find((btn) => btn.className.includes('bg-lime-500'));

    await act(async () => {
      fireEvent.change(snapshotInput, { target: { value: 'test-snapshot' } });
    });

    await act(async () => {
      fireEvent.click(snapshotButton!);
    });

    expect(mockTakeSnapshot).toHaveBeenCalledWith(
      mockSelectedServer.ip,
      mockDataset.name,
      'test-snapshot'
    );

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Snapshot created successfully');
    });
  });

  // Test 5: Snapshot creation with empty name shows error
  it('shows error when trying to create snapshot with empty name', async () => {
    render(<DatasetItem {...defaultProps} />);

    // Get the green button (snapshot button) by its background color class
    const buttons = screen.getAllByRole('button');
    const snapshotButton = buttons.find((btn) => btn.className.includes('bg-lime-500'));

    await act(async () => {
      fireEvent.click(snapshotButton!);
    });

    expect(mockAlert).toHaveBeenCalledWith('Please enter a snapshot name');
    expect(mockTakeSnapshot).not.toHaveBeenCalled();
  });

  // Test 6: Snapshot creation handles errors
  it('handles snapshot creation errors correctly', async () => {
    const errorMessage = 'Failed to create snapshot';
    mockTakeSnapshot.mockRejectedValueOnce(new Error(errorMessage));

    render(<DatasetItem {...defaultProps} />);

    const snapshotInput = screen.getByPlaceholderText('Snapshot name');
    // Get the green button (snapshot button) by its background color class
    const buttons = screen.getAllByRole('button');
    const snapshotButton = buttons.find((btn) => btn.className.includes('bg-lime-500'));

    await act(async () => {
      fireEvent.change(snapshotInput, { target: { value: 'test-snapshot' } });
    });

    await act(async () => {
      fireEvent.click(snapshotButton!);
    });

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith('Failed to take snapshot:', expect.any(Error));
      expect(mockAlert).toHaveBeenCalledWith(errorMessage);
    });
  });

  // Test 7: Dataset deletion with confirmation
  it('deletes dataset when confirmed', async () => {
    mockDeleteDataset.mockResolvedValueOnce(true);

    render(<DatasetItem {...defaultProps} />);

    // Get the red delete button by its background color class
    const buttons = screen.getAllByRole('button');
    const deleteButton = buttons.find((btn) => btn.className.includes('bg-red-700'));

    await act(async () => {
      fireEvent.click(deleteButton!);
    });

    // Should show the delete modal
    expect(screen.getByText('⚠️ Critical Warning')).toBeInTheDocument();
    expect(
      screen.getByText(/Deleting your root ZFS volume will render the system inoperable/)
    ).toBeInTheDocument();

    // Type the dataset name to confirm deletion
    const confirmationInput = screen.getByPlaceholderText('test-dataset');
    await act(async () => {
      fireEvent.change(confirmationInput, { target: { value: 'test-dataset' } });
    });

    // Click the "Yes, Delete" button
    const yesDeleteButton = screen.getByText('Yes, Delete');
    await act(async () => {
      fireEvent.click(yesDeleteButton);
    });

    expect(mockDeleteDataset).toHaveBeenCalledWith(
      mockSelectedServer.ip,
      'test-pool',
      mockDataset.name
    );
  });

  // Test 8: Dataset deletion cancelled by user
  it('does not delete dataset when user cancels confirmation', async () => {
    render(<DatasetItem {...defaultProps} />);

    // Get the red delete button by its background color class
    const buttons = screen.getAllByRole('button');
    const deleteButton = buttons.find((btn) => btn.className.includes('bg-red-700'));

    await act(async () => {
      fireEvent.click(deleteButton!);
    });

    // Should show the delete modal
    expect(screen.getByText('⚠️ Critical Warning')).toBeInTheDocument();

    // Click the "Cancel" button
    const cancelButton = screen.getByText('Cancel');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // Modal should be closed and delete should not be called
    expect(screen.queryByText('⚠️ Critical Warning')).not.toBeInTheDocument();
    expect(mockDeleteDataset).not.toHaveBeenCalled();
  });

  // Test 9: Dataset deletion handles errors
  it('handles dataset deletion errors correctly', async () => {
    const errorMessage = 'Failed to delete dataset';
    mockDeleteDataset.mockRejectedValueOnce(new Error(errorMessage));

    render(<DatasetItem {...defaultProps} />);

    // Get the red delete button by its background color class
    const buttons = screen.getAllByRole('button');
    const deleteButton = buttons.find((btn) => btn.className.includes('bg-red-700'));

    await act(async () => {
      fireEvent.click(deleteButton!);
    });

    // Type the dataset name to confirm deletion
    const confirmationInput = screen.getByPlaceholderText('test-dataset');
    await act(async () => {
      fireEvent.change(confirmationInput, { target: { value: 'test-dataset' } });
    });

    // Click the "Yes, Delete" button
    const yesDeleteButton = screen.getByText('Yes, Delete');
    await act(async () => {
      fireEvent.click(yesDeleteButton);
    });

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith('Failed to delete dataset:', expect.any(Error));
      expect(mockAlert).toHaveBeenCalledWith(errorMessage);
    });
  });

  // Test 10: Component behavior for snapshot type datasets
  it('hides deduplication and compression controls for snapshot type', () => {
    const snapshotProps = {
      ...defaultProps,
      selectedDatasetType: 'snapshot',
    };

    render(<DatasetItem {...snapshotProps} />);

    // Should not show deduplication and compression controls
    expect(screen.queryByText('Deduplication:')).not.toBeInTheDocument();
    expect(screen.queryByText('Compression:')).not.toBeInTheDocument();

    // Should not show snapshot creation input
    expect(screen.queryByPlaceholderText('Snapshot name')).not.toBeInTheDocument();

    // Should still show dataset info and delete button
    expect(screen.getByText('test-dataset')).toBeInTheDocument();
    // Check for delete button by its background color class
    const buttons = screen.getAllByRole('button');
    const deleteButton = buttons.find((btn) => btn.className.includes('bg-red-700'));
    expect(deleteButton).toBeInTheDocument();
  });

  // Test 11: Component behavior without ZFS_MANAGE permissions
  it('hides management controls when user lacks ZFS_MANAGE permission', () => {
    mockUsePermissions.mockReturnValue({
      permissions: { ZFS_MANAGE: false },
    });

    render(<DatasetItem {...defaultProps} />);

    // Should not show any management controls
    expect(screen.queryByText('Deduplication:')).not.toBeInTheDocument();
    expect(screen.queryByText('Compression:')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Snapshot name')).not.toBeInTheDocument();

    // Check that no buttons with these specific background colors exist
    const buttons = screen.queryAllByRole('button');
    const deleteButton = buttons.find((btn) => btn.className.includes('bg-red-700'));
    const snapshotButton = buttons.find((btn) => btn.className.includes('bg-lime-500'));
    expect(deleteButton).toBeUndefined();
    expect(snapshotButton).toBeUndefined();

    // Should still show dataset info
    expect(screen.getByText('test-dataset')).toBeInTheDocument();
  });

  // Test 12: Loading states for toggles
  it('shows loading state for deduplication toggle', () => {
    mockUseStorage.mockReturnValue({
      deduplicationStatus: { 'test-dataset': false },
      isTogglingDeduplication: { 'test-dataset': true },
      compressionStatus: { 'test-dataset': false },
      isTogglingCompression: { 'test-dataset': false },
      handleDeduplicationToggle: mockHandleDeduplicationToggle,
      handleCompressionToggle: mockHandleCompressionToggle,
      deleteDataset: mockDeleteDataset,
      takeZfsSnapshot: mockTakeSnapshot,
    });

    render(<DatasetItem {...defaultProps} />);

    // Find the deduplication checkbox by its position (first checkbox) and check it's disabled
    const checkboxes = screen.getAllByRole('checkbox');
    const deduplicationCheckbox = checkboxes[0];

    expect(deduplicationCheckbox).toBeDisabled();
    expect(screen.getByText('...')).toBeInTheDocument();
  });
});
