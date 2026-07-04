import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import DcIsoManager from './DcISO';
import { usePermissions, useAppState } from '../../shared-state/src/AppStateContext';
import {
  fetchDcIsoList,
  fetchDcCloudImages,
  uploadDcIsoWithProgress,
  downloadDcIso,
  deleteDcIso,
} from '../../shared-state/src/utils/dcIsoApiService';
import axios from 'axios';

jest.mock('../../shared-state/src/AppStateContext', () => ({
  usePermissions: jest.fn(),
  useAppState: jest.fn(),
}));

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../shared-state/src/utils/dcIsoApiService', () => ({
  fetchDcIsoList: jest.fn(),
  fetchDcCloudImages: jest.fn(),
  uploadDcIsoWithProgress: jest.fn(),
  downloadDcIso: jest.fn(),
  deleteDcIso: jest.fn(),
}));

jest.mock('../../feature-server/src/widgets/Modal', () => ({
  __esModule: true,
  default: ({ children, isOpen, onClose, title }) =>
    isOpen ? (
      <div data-testid="mock-modal" aria-label={title}>
        <div>{title}</div>
        {children}
        <button onClick={onClose} data-testid="mock-modal-close">
          Close
        </button>
      </div>
    ) : null,
}));

jest.mock('iconsax-react', () => ({
  Import: () => <div data-testid="mock-import-icon">Import</div>,
  Export: () => <div data-testid="mock-export-icon">Export</div>,
}));

describe('DcIsoManager Component - Essential Coverage', () => {
  const mockDispatch = jest.fn();
  const mockIsoList = ['ubuntu-22.04.iso', 'centos-8.iso', 'debian-11.iso'];
  const mockCloudImagesList = ['ubuntu-cloud.img', 'centos-cloud.img'];

  const createMockAppState = (overrides = {}) => ({
    state: {
      dcIso: {
        uploadingIso: false,
        uploadProgress: 0,
        uploadMessage: '',
        uploadMessageType: 'info',
        downloadMessage: '',
        downloadMessageType: 'info',
        isoList: mockIsoList,
        cloudImagesList: [],
        loading: false,
        error: null,
        cloudImagesError: null,
        ...overrides,
      },
    },
    dispatch: mockDispatch,
    setDcIsoUploadProgress: jest.fn(),
    setDcIsoUploadMessage: jest.fn(),
    clearDcIsoUploadState: jest.fn(),
    setDcIsoDownloadMessage: jest.fn(),
    clearDcIsoDownloadState: jest.fn(),
    fetchDcIsoListShared: jest.fn(),
    fetchDcCloudImagesListShared: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });

    (usePermissions as jest.Mock).mockReturnValue({
      permissions: { VM_MANAGE: true },
    });

    (useAppState as jest.Mock).mockReturnValue(createMockAppState());

    (fetchDcIsoList as jest.Mock).mockResolvedValue(mockIsoList);
    (fetchDcCloudImages as jest.Mock).mockResolvedValue([]);
    (uploadDcIsoWithProgress as jest.Mock).mockResolvedValue({});
    (downloadDcIso as jest.Mock).mockResolvedValue({});
    (deleteDcIso as jest.Mock).mockResolvedValue({});
  });

  test('should render component regardless of permissions (no permission check in component)', () => {
    (usePermissions as jest.Mock).mockReturnValue({
      permissions: { VM_MANAGE: false },
    });

    const { container } = render(<DcIsoManager />);
    // Component renders regardless of permissions since there's no permission check implemented
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByText('About ISO Files')).toBeInTheDocument();
  });

  test('should render main interface when user has VM_MANAGE permission', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    expect(screen.getByText('About ISO Files')).toBeInTheDocument();
    expect(screen.getByText('Upload ISO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  test('should handle file upload with valid ISO file', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    const file = new File(['dummy content'], 'test.iso', { type: 'application/octet-stream' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    expect(uploadDcIsoWithProgress).toHaveBeenCalledWith(file, mockDispatch, 'local');
  });

  test('should handle file upload with RAW file as cloud-init', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    const file = new File(['dummy content'], 'test.raw', { type: 'application/octet-stream' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    expect(uploadDcIsoWithProgress).toHaveBeenCalledWith(file, mockDispatch, 'cloud-init');
  });

  test('should handle file upload with IMG file as cloud-init', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    const file = new File(['dummy content'], 'test.img', { type: 'application/octet-stream' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    expect(uploadDcIsoWithProgress).toHaveBeenCalledWith(file, mockDispatch, 'cloud-init');
  });

  test('should show error for invalid file extension', async () => {
    const mockSetDcIsoUploadMessage = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoUploadMessage: mockSetDcIsoUploadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const file = new File(['dummy content'], 'test.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(mockSetDcIsoUploadMessage).toHaveBeenCalledWith(
      'Please upload a file with .iso,.img or .raw extension',
      'error'
    );
  });

  test('should prevent upload when no file selected', async () => {
    const mockSetDcIsoUploadMessage = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoUploadMessage: mockSetDcIsoUploadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    await act(async () => {
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    expect(mockSetDcIsoUploadMessage).toHaveBeenCalledWith(
      'Please select an ISO or RAW file first.',
      'error'
    );
    expect(uploadDcIsoWithProgress).not.toHaveBeenCalled();
  });

  test('should handle download with valid URL', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    const input = screen.getByPlaceholderText('Add FQDN URL with the appended ISO file.');
    const downloadButton = screen.getByRole('button', { name: /download/i });

    await act(async () => {
      await userEvent.type(input, 'http://example.com/test.iso');
      fireEvent.click(downloadButton);
    });

    expect(downloadDcIso).toHaveBeenCalledWith('http://example.com/test.iso', mockDispatch);
  });

  test('should show error for empty download URL', async () => {
    const mockSetDcIsoDownloadMessage = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoDownloadMessage: mockSetDcIsoDownloadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const downloadButton = screen.getByRole('button', { name: /download/i });

    await act(async () => {
      fireEvent.click(downloadButton);
    });

    expect(downloadDcIso).not.toHaveBeenCalled();
    expect(mockSetDcIsoDownloadMessage).toHaveBeenCalledWith('Please enter a valid URL.', 'error');
  });

  test('should open delete confirmation modal', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    await waitFor(() => {
      expect(screen.getByText('ubuntu-22.04.iso')).toBeInTheDocument();
    });

    const deleteButtons = screen
      .getAllByText('Delete')
      .filter((button) => !button.className.includes('bg-red-600 rounded-lg'));

    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
  });

  test('should delete ISO when confirmed', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    await waitFor(() => {
      expect(screen.getByText('ubuntu-22.04.iso')).toBeInTheDocument();
    });

    const deleteButtons = screen
      .getAllByText('Delete')
      .filter((button) => !button.className.includes('bg-red-600 rounded-lg'));

    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await act(async () => {
      const modalDeleteButton = screen
        .getAllByText('Delete')
        .find(
          (button) =>
            button.className.includes('bg-red-600') && button.closest('[data-testid="mock-modal"]')
        );
      fireEvent.click(modalDeleteButton as HTMLElement);
    });

    expect(deleteDcIso).toHaveBeenCalledWith('ubuntu-22.04.iso', mockDispatch, false);
  });

  test('should handle file size validation', async () => {
    const mockSetDcIsoUploadMessage = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoUploadMessage: mockSetDcIsoUploadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const oversizedFile = new File(['content'], 'large.iso', { type: 'application/octet-stream' });
    Object.defineProperty(oversizedFile, 'size', {
      value: 11 * 1024 * 1024 * 1024, // 11GB
      writable: false,
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    expect(mockSetDcIsoUploadMessage).toHaveBeenCalledWith(
      expect.stringContaining('File size exceeds the maximum limit (10GB). Your file is 11.00GB.'),
      'error'
    );
    expect(uploadDcIsoWithProgress).not.toHaveBeenCalled();
  });

  test('should display different message types correctly', async () => {
    // Test success message
    (useAppState as jest.Mock).mockReturnValue(
      createMockAppState({
        uploadMessage: 'Upload successful!',
        uploadMessageType: 'success',
      })
    );

    await act(async () => {
      render(<DcIsoManager />);
    });

    expect(screen.getByText('Upload successful!')).toBeInTheDocument();
  });

  test('should handle error scenarios in download', async () => {
    const mockError = {
      response: { status: 500 },
    };
    (downloadDcIso as jest.Mock).mockRejectedValueOnce(mockError);

    await act(async () => {
      render(<DcIsoManager />);
    });

    const input = screen.getByPlaceholderText('Add FQDN URL with the appended ISO file.');
    const downloadButton = screen.getByRole('button', { name: /download/i });

    await act(async () => {
      await userEvent.type(input, 'http://example.com/test.iso');
      fireEvent.click(downloadButton);
    });

    expect(downloadDcIso).toHaveBeenCalled();
  });

  test('should handle upload error scenarios', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (uploadDcIsoWithProgress as jest.Mock).mockRejectedValueOnce(new Error('Upload failed'));

    await act(async () => {
      render(<DcIsoManager />);
    });

    const file = new File(['content'], 'test.iso', { type: 'application/octet-stream' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Upload error:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  test('should handle delete error scenarios', async () => {
    const mockSetDcIsoDownloadMessage = jest.fn();
    const mockError = new Error('Delete failed');
    (deleteDcIso as jest.Mock).mockRejectedValueOnce(mockError);

    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoDownloadMessage: mockSetDcIsoDownloadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    await waitFor(() => {
      expect(screen.getByText('ubuntu-22.04.iso')).toBeInTheDocument();
    });

    const deleteButtons = screen
      .getAllByText('Delete')
      .filter((button) => !button.className.includes('bg-red-600 rounded-lg'));

    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await act(async () => {
      const modalDeleteButton = screen
        .getAllByText('Delete')
        .find(
          (button) =>
            button.className.includes('bg-red-600') && button.closest('[data-testid="mock-modal"]')
        );
      fireEvent.click(modalDeleteButton as HTMLElement);
    });

    await waitFor(() => {
      expect(mockSetDcIsoDownloadMessage).toHaveBeenCalledWith(
        'Delete failed: Delete failed',
        'error'
      );
    });
  });

  test('should handle view mode switching', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    const viewDropdown = screen.getByRole('combobox');
    expect(viewDropdown).toHaveValue('isos');

    await act(async () => {
      fireEvent.change(viewDropdown, { target: { value: 'cloud-images' } });
    });

    expect(viewDropdown).toHaveValue('cloud-images');
    expect(screen.getAllByText('Available Cloud Images')[1]).toBeInTheDocument();
  });

  test('should show loading state', async () => {
    (useAppState as jest.Mock).mockReturnValue(createMockAppState({ loading: true }));

    await act(async () => {
      render(<DcIsoManager />);
    });

    expect(screen.getByText('Loading ISOs...')).toBeInTheDocument();
  });

  test('should show error state', async () => {
    const errorMessage = 'Failed to fetch ISOs';
    (useAppState as jest.Mock).mockReturnValue(createMockAppState({ error: errorMessage }));

    await act(async () => {
      render(<DcIsoManager />);
    });

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  test('should call fetch functions on mount', async () => {
    const mockFetchDcIsoListShared = jest.fn();
    const mockFetchDcCloudImagesListShared = jest.fn();

    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      fetchDcIsoListShared: mockFetchDcIsoListShared,
      fetchDcCloudImagesListShared: mockFetchDcCloudImagesListShared,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    expect(mockFetchDcIsoListShared).toHaveBeenCalled();
    expect(mockFetchDcCloudImagesListShared).toHaveBeenCalled();
  });

  test('should handle console errors in fetch functions', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockFetchDcIsoListShared = jest.fn().mockRejectedValue(new Error('Network error'));
    const mockFetchDcCloudImagesListShared = jest
      .fn()
      .mockRejectedValue(new Error('Network error'));

    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      fetchDcIsoListShared: mockFetchDcIsoListShared,
      fetchDcCloudImagesListShared: mockFetchDcCloudImagesListShared,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch ISO list:', expect.any(Error));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch cloud images:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  test('should auto-clear error message after timeout', async () => {
    jest.useFakeTimers();
    const mockClearDcIsoDownloadState = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      clearDcIsoDownloadState: mockClearDcIsoDownloadState,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const downloadButton = screen.getByRole('button', { name: /download/i });

    await act(async () => {
      fireEvent.click(downloadButton);
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockClearDcIsoDownloadState).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('should handle download error with response.data.message', async () => {
    const mockError = {
      response: {
        data: { message: 'Custom error message' },
      },
    };
    const mockSetDcIsoDownloadMessage = jest.fn();
    (downloadDcIso as jest.Mock).mockRejectedValueOnce(mockError);
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoDownloadMessage: mockSetDcIsoDownloadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const input = screen.getByPlaceholderText('Add FQDN URL with the appended ISO file.');
    const downloadButton = screen.getByRole('button', { name: /download/i });

    await act(async () => {
      await userEvent.type(input, 'http://example.com/test.iso');
      fireEvent.click(downloadButton);
    });

    await waitFor(() => {
      expect(mockSetDcIsoDownloadMessage).toHaveBeenCalledWith(
        'Download failed: Custom error message',
        'error'
      );
    });
  });

  test('should handle download error with response.data.error', async () => {
    const mockError = {
      response: {
        data: { error: 'Custom error from error field' },
      },
    };
    const mockSetDcIsoDownloadMessage = jest.fn();
    (downloadDcIso as jest.Mock).mockRejectedValueOnce(mockError);
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoDownloadMessage: mockSetDcIsoDownloadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const input = screen.getByPlaceholderText('Add FQDN URL with the appended ISO file.');
    const downloadButton = screen.getByRole('button', { name: /download/i });

    await act(async () => {
      await userEvent.type(input, 'http://example.com/test.iso');
      fireEvent.click(downloadButton);
    });

    await waitFor(() => {
      expect(mockSetDcIsoDownloadMessage).toHaveBeenCalledWith(
        'Download failed: Custom error from error field',
        'error'
      );
    });
  });

  test('should handle download error with error.message', async () => {
    const mockError = {
      message: 'Network connection failed',
    };
    const mockSetDcIsoDownloadMessage = jest.fn();
    (downloadDcIso as jest.Mock).mockRejectedValueOnce(mockError);
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoDownloadMessage: mockSetDcIsoDownloadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const input = screen.getByPlaceholderText('Add FQDN URL with the appended ISO file.');
    const downloadButton = screen.getByRole('button', { name: /download/i });

    await act(async () => {
      await userEvent.type(input, 'http://example.com/test.iso');
      fireEvent.click(downloadButton);
    });

    await waitFor(() => {
      expect(mockSetDcIsoDownloadMessage).toHaveBeenCalledWith(
        'Download failed: Network connection failed',
        'error'
      );
    });
  });

  test('should handle download error with 500 status code', async () => {
    const mockError = {
      response: { status: 500 },
    };
    const mockSetDcIsoDownloadMessage = jest.fn();
    (downloadDcIso as jest.Mock).mockRejectedValueOnce(mockError);
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoDownloadMessage: mockSetDcIsoDownloadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const input = screen.getByPlaceholderText('Add FQDN URL with the appended ISO file.');
    const downloadButton = screen.getByRole('button', { name: /download/i });

    await act(async () => {
      await userEvent.type(input, 'http://example.com/test.iso');
      fireEvent.click(downloadButton);
    });

    await waitFor(() => {
      expect(mockSetDcIsoDownloadMessage).toHaveBeenCalledWith(
        'Server error (500) occurred during download. Please try again later.',
        'error'
      );
    });
  });

  test('should handle unknown download error', async () => {
    const mockError = {};
    const mockSetDcIsoDownloadMessage = jest.fn();
    (downloadDcIso as jest.Mock).mockRejectedValueOnce(mockError);
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoDownloadMessage: mockSetDcIsoDownloadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const input = screen.getByPlaceholderText('Add FQDN URL with the appended ISO file.');
    const downloadButton = screen.getByRole('button', { name: /download/i });

    await act(async () => {
      await userEvent.type(input, 'http://example.com/test.iso');
      fireEvent.click(downloadButton);
    });

    await waitFor(() => {
      expect(mockSetDcIsoDownloadMessage).toHaveBeenCalledWith(
        'Download failed: Unknown error',
        'error'
      );
    });
  });

  test('should clear file input after successful upload', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    const file = new File(['dummy content'], 'test.iso', { type: 'application/octet-stream' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    await waitFor(() => {
      expect(uploadDcIsoWithProgress).toHaveBeenCalled();
      expect(fileInput.value).toBe('');
    });
  });

  test('should show cloud images error', async () => {
    const errorMessage = 'Failed to load cloud images';
    (useAppState as jest.Mock).mockReturnValue(
      createMockAppState({ cloudImagesError: errorMessage })
    );

    await act(async () => {
      render(<DcIsoManager />);
    });

    const viewDropdown = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(viewDropdown, { target: { value: 'cloud-images' } });
    });

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  test('should show empty state for cloud images', async () => {
    (useAppState as jest.Mock).mockReturnValue(createMockAppState({ cloudImagesList: [] }));

    await act(async () => {
      render(<DcIsoManager />);
    });

    const viewDropdown = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(viewDropdown, { target: { value: 'cloud-images' } });
    });

    expect(screen.getByText('No cloud images available.')).toBeInTheDocument();
  });

  test('should display cloud images correctly', async () => {
    (useAppState as jest.Mock).mockReturnValue(
      createMockAppState({ cloudImagesList: ['ubuntu-cloud.img', 'centos-cloud.img'] })
    );

    await act(async () => {
      render(<DcIsoManager />);
    });

    const viewDropdown = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(viewDropdown, { target: { value: 'cloud-images' } });
    });

    expect(screen.getByText('ubuntu-cloud.img')).toBeInTheDocument();
    expect(screen.getByText('centos-cloud.img')).toBeInTheDocument();
    expect(screen.getAllByText('Cloud Image')).toHaveLength(2);
  });

  test('should handle cloud image deletion', async () => {
    (useAppState as jest.Mock).mockReturnValue(
      createMockAppState({ cloudImagesList: ['ubuntu-cloud.img'] })
    );

    await act(async () => {
      render(<DcIsoManager />);
    });

    const viewDropdown = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(viewDropdown, { target: { value: 'cloud-images' } });
    });

    await waitFor(() => {
      expect(screen.getByText('ubuntu-cloud.img')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete/i });

    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(screen.getByTestId('mock-modal')).toBeInTheDocument();

    await act(async () => {
      const modalDeleteButton = screen
        .getAllByText('Delete')
        .find(
          (button) =>
            button.className.includes('bg-red-600') && button.closest('[data-testid="mock-modal"]')
        );
      fireEvent.click(modalDeleteButton as HTMLElement);
    });

    expect(deleteDcIso).toHaveBeenCalledWith('ubuntu-cloud.img', mockDispatch, true);
  });

  test('should close delete modal when cancel is clicked', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    await waitFor(() => {
      expect(screen.getByText('ubuntu-22.04.iso')).toBeInTheDocument();
    });

    const deleteButton = screen.getAllByText('Delete')[0];

    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(screen.getByTestId('mock-modal')).toBeInTheDocument();

    await act(async () => {
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
    });

    expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
  });

  test('should dismiss download message when close button clicked', async () => {
    const mockClearDcIsoDownloadState = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState({
        downloadMessage: 'Download completed successfully!',
        downloadMessageType: 'success',
      }),
      clearDcIsoDownloadState: mockClearDcIsoDownloadState,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    expect(screen.getByText('Download completed successfully!')).toBeInTheDocument();

    const dismissButton = screen.getByLabelText('Dismiss message');

    await act(async () => {
      fireEvent.click(dismissButton);
    });

    expect(mockClearDcIsoDownloadState).toHaveBeenCalled();
  });

  test('should dismiss upload message when close button clicked', async () => {
    const mockClearDcIsoUploadState = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState({
        uploadMessage: 'Upload completed successfully!',
        uploadMessageType: 'success',
      }),
      clearDcIsoUploadState: mockClearDcIsoUploadState,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    expect(screen.getByText('Upload completed successfully!')).toBeInTheDocument();

    const dismissButtons = screen.getAllByLabelText('Dismiss message');

    await act(async () => {
      fireEvent.click(dismissButtons[0]);
    });

    expect(mockClearDcIsoUploadState).toHaveBeenCalled();
  });

  test('should handle message style for different types', async () => {
    // Test info message style
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState({
        downloadMessage: 'Processing...',
        downloadMessageType: 'info',
      }),
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const messageDiv = screen.getByText('Processing...').closest('div');
    expect(messageDiv).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-300');
  });

  test('should handle default message style for unknown type', async () => {
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState({
        downloadMessage: 'Unknown status',
        downloadMessageType: 'unknown',
      }),
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const messageDiv = screen.getByText('Unknown status').closest('div');
    expect(messageDiv).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-300');
  });

  test('should show upload progress bar during upload', async () => {
    (useAppState as jest.Mock).mockReturnValue(
      createMockAppState({
        uploadingIso: true,
        uploadProgress: 45,
      })
    );

    await act(async () => {
      render(<DcIsoManager />);
    });

    expect(screen.getByText('Upload Progress')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();

    // Check that the progress bar exists and has the right content
    const progressContainer = document.querySelector('.bg-gray-200');
    expect(progressContainer).toBeInTheDocument();
  });

  test('should prevent file selection during upload', async () => {
    (useAppState as jest.Mock).mockReturnValue(createMockAppState({ uploadingIso: true }));

    await act(async () => {
      render(<DcIsoManager />);
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.iso', { type: 'application/octet-stream' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(fileInput.value).toBe('');
  });

  test('should show truncated filename for long filenames', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    const longFile = new File(['content'], 'very-long-filename-that-should-be-truncated.iso', {
      type: 'application/octet-stream',
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [longFile] } });
    });

    expect(screen.getByText('very-long-fi...')).toBeInTheDocument();
  });

  test('should handle modal close via modal component', async () => {
    await act(async () => {
      render(<DcIsoManager />);
    });

    const deleteButton = screen.getAllByText('Delete')[0];

    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(screen.getByTestId('mock-modal')).toBeInTheDocument();

    await act(async () => {
      const modalCloseButton = screen.getByTestId('mock-modal-close');
      fireEvent.click(modalCloseButton);
    });

    expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
  });

  test('should handle file with no extension', async () => {
    const mockSetDcIsoUploadMessage = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoUploadMessage: mockSetDcIsoUploadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const fileWithoutExt = new File(['content'], 'filename-without-extension', {
      type: 'application/octet-stream',
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fileWithoutExt] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    expect(mockSetDcIsoUploadMessage).toHaveBeenCalledWith(
      'Please upload a file with .iso,.img or .raw extension',
      'error'
    );
  });

  test('should handle file with empty extension', async () => {
    const mockSetDcIsoUploadMessage = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoUploadMessage: mockSetDcIsoUploadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const fileWithEmptyExt = new File(['content'], 'filename.', {
      type: 'application/octet-stream',
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fileWithEmptyExt] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    expect(mockSetDcIsoUploadMessage).toHaveBeenCalledWith(
      'Please upload a file with .iso,.img or .raw extension',
      'error'
    );
  });

  test('should test all message style cases', async () => {
    // Test success message
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState({
        uploadMessage: 'Success message',
        uploadMessageType: 'success',
      }),
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    let messageDiv = screen.getByText('Success message').closest('div');
    expect(messageDiv).toHaveClass('bg-green-100', 'text-green-800', 'border-green-300');
  });

  test('should cover file extension validation error for unsupported file', async () => {
    const mockSetDcIsoUploadMessage = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoUploadMessage: mockSetDcIsoUploadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const unsupportedFile = new File(['content'], 'test.exe', { type: 'application/octet-stream' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [unsupportedFile] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    expect(mockSetDcIsoUploadMessage).toHaveBeenCalledWith(
      'Please upload a file with .iso,.img or .raw extension',
      'error'
    );
    expect(uploadDcIsoWithProgress).not.toHaveBeenCalled();
  });

  test('should cover default case in message style function', async () => {
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState({
        uploadMessage: 'Custom message',
        uploadMessageType: 'warning', // unsupported type to trigger default case
      }),
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    const messageDiv = screen.getByText('Custom message').closest('div');
    expect(messageDiv).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-300');
  });

  test('should cover file without extension edge case', async () => {
    const mockSetDcIsoUploadMessage = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoUploadMessage: mockSetDcIsoUploadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    // Create a file without extension
    const fileWithoutExt = new File(['content'], 'filename_no_extension', {
      type: 'application/octet-stream',
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fileWithoutExt] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    expect(mockSetDcIsoUploadMessage).toHaveBeenCalledWith(
      'Please upload a file with .iso,.img or .raw extension',
      'error'
    );
  });

  test('should ensure return statement is covered in file validation', async () => {
    const mockSetDcIsoUploadMessage = jest.fn();
    const mockUploadDcIsoWithProgress = uploadDcIsoWithProgress as jest.Mock;
    mockUploadDcIsoWithProgress.mockClear();

    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState(),
      setDcIsoUploadMessage: mockSetDcIsoUploadMessage,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    // Test with a .pdf file to ensure the return statement is hit
    const pdfFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [pdfFile] } });
      const uploadButton = screen.getByText('Upload');
      fireEvent.click(uploadButton);
    });

    // Ensure error message was called and upload was NOT called (return statement worked)
    expect(mockSetDcIsoUploadMessage).toHaveBeenCalledWith(
      'Please upload a file with .iso,.img or .raw extension',
      'error'
    );
    expect(mockUploadDcIsoWithProgress).not.toHaveBeenCalled();
  });

  test('should test default message type thoroughly', async () => {
    const mockClearDcIsoUploadState = jest.fn();
    (useAppState as jest.Mock).mockReturnValue({
      ...createMockAppState({
        uploadMessage: 'Testing default style',
        uploadMessageType: 'undefined_type', // This should trigger default case
      }),
      clearDcIsoUploadState: mockClearDcIsoUploadState,
    });

    await act(async () => {
      render(<DcIsoManager />);
    });

    // Verify the message appears with default styling
    const messageDiv = screen.getByText('Testing default style').closest('div');
    expect(messageDiv).toHaveClass('bg-gray-100');
    expect(messageDiv).toHaveClass('text-gray-800');
    expect(messageDiv).toHaveClass('border-gray-300');

    // Also test the dismiss functionality to ensure full coverage
    const dismissButton = screen.getByLabelText('Dismiss message');

    await act(async () => {
      fireEvent.click(dismissButton);
    });

    expect(mockClearDcIsoUploadState).toHaveBeenCalled();
  });
});
