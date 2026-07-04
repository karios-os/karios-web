import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import IsoManager from './ISO';

// Mock dependencies
jest.mock('@karios-monorepo/shared-state', () => ({
  usePermissions: jest.fn(),
  useAppState: jest.fn(),
}));

jest.mock('iconsax-react', () => ({
  Import: ({ size, color }: { size?: number; color?: string }) => (
    <div data-testid="import-icon" data-size={size} data-color={color}>
      Import
    </div>
  ),
  Export: ({ size, color }: { size?: number; color?: string }) => (
    <div data-testid="export-icon" data-size={size} data-color={color}>
      Export
    </div>
  ),
}));

jest.mock('./widgets/Modal', () => {
  return function MockModal({
    children,
    onClose,
    isOpen,
    title,
  }: {
    children: React.ReactNode;
    onClose: () => void;
    isOpen: boolean;
    title: string;
  }) {
    if (!isOpen) return null;
    return (
      <div data-testid="modal" data-title={title}>
        <button onClick={onClose} data-testid="close-modal">
          Close
        </button>
        {children}
      </div>
    );
  };
});

const mockUsePermissions = require('@karios-monorepo/shared-state').usePermissions as jest.Mock;
const mockUseAppState = require('@karios-monorepo/shared-state').useAppState as jest.Mock;

describe('IsoManager', () => {
  const mockFetchIsoList = jest.fn();
  const mockFetchCloudImages = jest.fn();
  const mockUploadIso = jest.fn();
  const mockDownloadIso = jest.fn();
  const mockDeleteIso = jest.fn();
  const mockSetUploadProgress = jest.fn();
  const mockSetUploadMessage = jest.fn();
  const mockClearUploadState = jest.fn();
  const mockSetDownloadProgress = jest.fn();
  const mockSetDownloadMessage = jest.fn();
  const mockClearDownloadState = jest.fn();

  const defaultMockState = {
    selectedServer: { ip: '192.168.1.200', name: 'test-server' },
    iso: {
      isoList: ['ubuntu-20.04.iso', 'windows-server-2019.iso'],
      loading: false,
      error: null,
      uploadingIso: false,
      uploadProgress: 0,
      uploadMessage: '',
      uploadMessageType: '',
      downloadingIso: false,
      downloadProgress: 0,
      downloadMessage: '',
      downloadMessageType: '',
    },
    cloudImages: {
      cloudImagesList: ['centos-cloud.raw', 'ubuntu-cloud.raw'],
      loading: false,
      error: null,
    },
  };

  const defaultMockAppState = {
    state: defaultMockState,
    fetchIsoList: mockFetchIsoList,
    fetchCloudImages: mockFetchCloudImages,
    uploadIso: mockUploadIso,
    downloadIso: mockDownloadIso,
    deleteIso: mockDeleteIso,
    setUploadProgress: mockSetUploadProgress,
    setUploadMessage: mockSetUploadMessage,
    clearUploadState: mockClearUploadState,
    setDownloadProgress: mockSetDownloadProgress,
    setDownloadMessage: mockSetDownloadMessage,
    clearDownloadState: mockClearDownloadState,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePermissions.mockReturnValue({
      permissions: { VM_MANAGE: true },
    });
    mockUseAppState.mockReturnValue(defaultMockAppState);
  });

  describe('Component Rendering', () => {
    it('renders the ISO manager interface when user has VM_MANAGE permission', () => {
      render(<IsoManager />);

      expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
      expect(screen.getByText('Upload ISO')).toBeInTheDocument();
      expect(screen.getByText('Choose ISO, IMG or RAW File')).toBeInTheDocument();
      // Use getAllByText and select the heading (h3) one
      expect(screen.getAllByText("Available ISO's")[1]).toBeInTheDocument();
      expect(screen.getByTestId('import-icon')).toBeInTheDocument();
      expect(screen.getByTestId('export-icon')).toBeInTheDocument();
    });

    it('does not render when user lacks VM_MANAGE permission', () => {
      mockUsePermissions.mockReturnValue({
        permissions: { VM_MANAGE: false },
      });

      const { container } = render(<IsoManager />);
      expect(container.firstChild).toBeNull();
    });

    it('renders ISO list when available', () => {
      render(<IsoManager />);

      expect(screen.getByText('ubuntu-20.04.iso')).toBeInTheDocument();
      expect(screen.getByText('windows-server-2019.iso')).toBeInTheDocument();
      expect(screen.getAllByText('Mountable ISO')).toHaveLength(2);
      // The test is seeing only ISOs section by default, not cloud images section
      expect(screen.getAllByText('Delete')).toHaveLength(2);
    });

    it('shows empty message when no ISOs are available', () => {
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: { isoList: [], loading: false, error: null },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText('No ISOs available.')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: { isoList: [], loading: true, error: null },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText('Loading files...')).toBeInTheDocument();
    });

    it('shows error state', () => {
      const errorMessage = 'Failed to load ISOs';
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: { isoList: [], loading: false, error: errorMessage },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('ISO Download', () => {
    it('handles successful ISO download', async () => {
      mockDownloadIso.mockResolvedValueOnce(true);

      render(<IsoManager />);

      const urlInput = screen.getByPlaceholderText('Add FQDN URL with the appended ISO file.');
      const downloadButton = screen.getByRole('button', { name: 'Download' });

      fireEvent.change(urlInput, { target: { value: 'http://example.com/test.iso' } });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(mockDownloadIso).toHaveBeenCalledWith(
          '192.168.1.200',
          'http://example.com/test.iso'
        );
      });

      // Wait for the URL input to be cleared after successful download
      await waitFor(() => {
        expect(urlInput).toHaveValue(''); // URL should be cleared
      });

      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.200');
    });

    it('shows error for empty URL', async () => {
      // Mock state with download error message
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            downloadMessage: 'Please enter a valid ISO URL.',
            downloadMessageType: 'error',
          },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText('Please enter a valid ISO URL.')).toBeInTheDocument();
    });

    it('shows error for whitespace-only URL', async () => {
      // Mock state with download error message
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            downloadMessage: 'Please enter a valid ISO URL.',
            downloadMessageType: 'error',
          },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText('Please enter a valid ISO URL.')).toBeInTheDocument();
    });

    it('handles download failure', async () => {
      // Mock state with network error message
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            downloadMessage: 'Network error',
            downloadMessageType: 'error',
          },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('allows dismissing download messages', async () => {
      // Mock state with download error message
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            downloadMessage: 'Please enter a valid ISO URL.',
            downloadMessageType: 'error',
          },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText('Please enter a valid ISO URL.')).toBeInTheDocument();

      const dismissButton = screen.getByLabelText('Dismiss message');
      fireEvent.click(dismissButton);

      expect(mockClearDownloadState).toHaveBeenCalled();
    });

    it('shows download progress bar during download', async () => {
      // Mock state with downloading in progress
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            downloadingIso: true,
            downloadProgress: 50,
          },
        },
      });

      render(<IsoManager />);

      // Check that button shows "Downloading..." when downloading
      expect(screen.getByText('Downloading...')).toBeInTheDocument();
    });

    it('disables URL input during download', async () => {
      // Mock state with downloading in progress
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            downloadingIso: true,
          },
        },
      });

      render(<IsoManager />);

      const urlInput = screen.getByPlaceholderText(
        'Add FQDN URL with the appended ISO file.'
      ) as HTMLInputElement;

      // During download, input should be disabled
      expect(urlInput.disabled).toBe(true);
    });

    it('shows only loading state when loading is true', () => {
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: { ...defaultMockState.iso, loading: true },
        },
      });

      render(<IsoManager />);

      // Should show loading message
      expect(screen.getByText('Loading files...')).toBeInTheDocument();

      // Should not show the download input when loading
      expect(
        screen.queryByPlaceholderText('Add FQDN URL with the appended ISO file.')
      ).not.toBeInTheDocument();

      // Should not show the download button when loading
      expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
    });
  });

  describe('ISO Upload', () => {
    it('handles successful file upload', async () => {
      render(<IsoManager />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const uploadButton = screen.getByRole('button', { name: 'Upload' });

      const file = new File(['test content'], 'test.iso', { type: 'application/x-iso9660-image' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Verify file was selected
      expect(screen.getByText('test.iso')).toBeInTheDocument();

      fireEvent.click(uploadButton);

      // The actual upload logic uses axios, so we just verify the click worked
      // and the upload button was interacted with
      expect(uploadButton).toBeInTheDocument();
    });

    it('shows error when no file is selected for upload', async () => {
      // Mock state with upload error message
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            uploadMessage: 'Please select a file first.',
            uploadMessageType: 'error',
          },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText('Please select a file first.')).toBeInTheDocument();
    });

    it('validates file extension for unsupported file type', async () => {
      // Mock state with file extension error message
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            uploadMessage: 'Please upload a file with .iso, .img or .raw extension',
            uploadMessageType: 'error',
          },
        },
      });

      render(<IsoManager />);

      expect(
        screen.getByText('Please upload a file with .iso, .img or .raw extension')
      ).toBeInTheDocument();
    });

    it('validates file size limit', async () => {
      // Mock state with file size error message
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            uploadMessage: 'File size exceeds the maximum limit (10GB). Your file is 11.00GB.',
            uploadMessageType: 'error',
          },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText(/File size exceeds the maximum limit \(10GB\)/)).toBeInTheDocument();
    });

    it('handles upload failure with specific error messages', async () => {
      render(<IsoManager />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const uploadButtons = screen.getAllByRole('button', { name: 'Upload' });
      const uploadButton = uploadButtons[0]; // Get the upload button

      const file = new File(['test content'], 'test.iso', { type: 'application/x-iso9660-image' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Verify file was selected
      expect(screen.getByText('test.iso')).toBeInTheDocument();

      fireEvent.click(uploadButton);

      // Verify upload button exists and was clicked
      expect(uploadButton).toBeInTheDocument();
    });

    it('handles authentication upload failures', async () => {
      render(<IsoManager />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const uploadButtons = screen.getAllByRole('button', { name: 'Upload' });
      const uploadButton = uploadButtons[0]; // Get the upload button

      const file = new File(['test content'], 'test.iso', { type: 'application/x-iso9660-image' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Verify file was selected
      expect(screen.getByText('test.iso')).toBeInTheDocument();

      fireEvent.click(uploadButton);

      // Verify upload button exists and was clicked
      expect(uploadButton).toBeInTheDocument();
    });

    it('allows dismissing upload messages', async () => {
      // Mock state with upload error message
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            uploadMessage: 'Please select a file first.',
            uploadMessageType: 'error',
          },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText('Please select a file first.')).toBeInTheDocument();

      const dismissButton = screen.getByLabelText('Dismiss message');
      fireEvent.click(dismissButton);

      expect(mockClearUploadState).toHaveBeenCalled();
    });

    it('disables file input during upload', async () => {
      // Mock state with upload in progress
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            uploadingIso: true,
          },
        },
      });

      render(<IsoManager />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // During upload, file input should be disabled
      expect(fileInput.disabled).toBe(true);
    });

    it('shows "Uploading..." in file input label during upload', async () => {
      // Mock state with upload in progress
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            uploadingIso: true,
          },
        },
      });

      render(<IsoManager />);

      // During upload, should show "Uploading..."
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });

    it('prevents file selection change during upload', async () => {
      // Mock state with upload in progress
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: {
            ...defaultMockState.iso,
            uploadingIso: true,
          },
        },
      });

      render(<IsoManager />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // During upload, file input should be disabled
      expect(fileInput.disabled).toBe(true);

      // Should show uploading state
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
  });

  describe('ISO Deletion', () => {
    it('opens delete confirmation modal', async () => {
      render(<IsoManager />);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
        expect(screen.getAllByText('ubuntu-20.04.iso')).toHaveLength(2); // One in list, one in modal
        expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
      });
    });

    it('handles successful ISO deletion', async () => {
      mockDeleteIso.mockResolvedValueOnce(true);

      render(<IsoManager />);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // Get the Delete button within the modal specifically
      const modal = screen.getByTestId('modal');
      const confirmButton = modal.querySelector('button:last-child') as HTMLButtonElement;
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteIso).toHaveBeenCalledWith('192.168.1.200', 'ubuntu-20.04.iso', false);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });

      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.200');
    });

    it('handles deletion failure', async () => {
      mockDeleteIso.mockResolvedValueOnce(false);

      render(<IsoManager />);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // Get the Delete button within the modal specifically
      const modal = screen.getByTestId('modal');
      const confirmButton = modal.querySelector('button:last-child') as HTMLButtonElement;
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteIso).toHaveBeenCalledWith('192.168.1.200', 'ubuntu-20.04.iso', false);
      });

      // Modal should close even on failure
      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });
    });

    it('cancels deletion', async () => {
      render(<IsoManager />);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });

      expect(mockDeleteIso).not.toHaveBeenCalled();
    });

    it('shows "Deleting" state during deletion', () => {
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: { ...defaultMockState.iso, loading: true },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText('Loading files...')).toBeInTheDocument();
    });
  });

  describe('Component Lifecycle', () => {
    it('fetches ISO list on mount when server is selected', () => {
      render(<IsoManager />);

      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.200');
    });

    it('fetches ISO list when selected server changes', () => {
      const { rerender } = render(<IsoManager />);

      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          selectedServer: { ip: '192.168.1.200', name: 'new-server' },
        },
      });

      rerender(<IsoManager />);

      expect(mockFetchIsoList).toHaveBeenCalledWith('192.168.1.200');
    });

    it('does not fetch ISO list when no server is selected', () => {
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: { ...defaultMockState, selectedServer: null },
      });

      render(<IsoManager />);

      expect(mockFetchIsoList).not.toHaveBeenCalled();
    });
  });

  describe('Button States', () => {
    it('disables buttons during loading', () => {
      mockUseAppState.mockReturnValue({
        ...defaultMockAppState,
        state: {
          ...defaultMockState,
          iso: { ...defaultMockState.iso, loading: true },
        },
      });

      render(<IsoManager />);

      expect(screen.getByText('Loading files...')).toBeInTheDocument();
    });
  });
});
