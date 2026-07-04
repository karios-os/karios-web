import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import { Import, Export } from 'iconsax-react';
import { usePermissions, useAppState } from '../../shared-state/src/AppStateContext';
import Modal from '../../shared-state/src/widgets/Modal';
import {
  fetchDcIsoList,
  fetchDcCloudImages,
  uploadDcIsoWithProgress,
  downloadDcIso,
  deleteDcIso,
} from '../../shared-state/src/utils/dcIsoApiService';
import { createComponentLogger } from '../../shared-state/src/utils/logger';
import axios from 'axios';
import envConfig from '../../../runtime-config';

function DcIsoManager() {
  const logger = createComponentLogger('DcIsoManager');
  const [isoUrl, setIsoUrl] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<string>('isos'); // New state for view toggle

  const {
    state,
    dispatch,
    setDcIsoUploadProgress,
    setDcIsoUploadMessage,
    clearDcIsoUploadState,
    setDcIsoDownloadMessage,
    clearDcIsoDownloadState,
    fetchDcIsoListShared,
    fetchDcCloudImagesListShared,
  } = useAppState();

  // Get progress states from shared state
  const {
    uploadingIso,
    uploadProgress,
    uploadMessage,
    uploadMessageType,
    downloadMessage,
    downloadMessageType,
    isoList,
    cloudImagesList,
    loading: isLoading,
    error,
    cloudImagesError,
  } = state.dcIso;

  // Modal state for delete confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isoToDelete, setIsoToDelete] = useState<string | null>(null);
  const [isCloudImage, setIsCloudImage] = useState<boolean>(false);

  // Refs to prevent duplicate API calls
  const dcIsoListFetched = useRef(false);
  const dcCloudImagesFetched = useRef(false);
  const lastDcIsoFetchTime = useRef(0);
  const lastDcCloudImagesFetchTime = useRef(0);

  // Smart fetch functions with duplicate prevention and rate limiting
  const fetchCloudImagesDataSafely = useCallback(async () => {
    const now = Date.now();
    if (dcCloudImagesFetched.current || now - lastDcCloudImagesFetchTime.current < 3000) {
      logger.debug('DC Cloud images already fetched or rate limited, skipping duplicate call');
      return;
    }

    logger.debug('Fetching DC cloud images');
    dcCloudImagesFetched.current = true;
    lastDcCloudImagesFetchTime.current = now;

    try {
      await fetchDcCloudImagesListShared();
    } catch (err) {
      logger.error('Failed to fetch cloud images', { error: err });
      dcCloudImagesFetched.current = false; // Reset on error
    }
  }, [fetchDcCloudImagesListShared]);

  const fetchIsoDataSafely = useCallback(async () => {
    const now = Date.now();
    if (dcIsoListFetched.current || now - lastDcIsoFetchTime.current < 3000) {
      logger.debug('ISO list fetch skipped - already fetched or rate limited');
      return;
    }

    logger.debug('Fetching ISO list');
    dcIsoListFetched.current = true;
    lastDcIsoFetchTime.current = now;

    try {
      await fetchDcIsoListShared();
    } catch (err) {
      logger.error('Failed to fetch ISO list', { error: err });
      dcIsoListFetched.current = false; // Reset on error
    }
  }, [fetchDcIsoListShared]);

  // Legacy functions for backward compatibility (now use safe versions)
  const fetchCloudImagesData = useCallback(async () => {
    await fetchCloudImagesDataSafely();
  }, [fetchCloudImagesDataSafely]);

  const fetchIsoData = useCallback(async () => {
    await fetchIsoDataSafely();
  }, [fetchIsoDataSafely]);

  // Fetch ISO list when component mounts (cloud images fetched only when switching to that view)
  useEffect(() => {
    logger.debug('ISO Manager mounted');
    fetchIsoDataSafely();
  }, [fetchIsoDataSafely]);

  // Fetch cloud images when switching to cloud images view
  useEffect(() => {
    if (viewMode === 'cloud-images') {
      fetchCloudImagesDataSafely();
    }
  }, [viewMode, fetchCloudImagesDataSafely]);

  const handleDownload = async () => {
    if (!isoUrl.trim()) {
      setDcIsoDownloadMessage('Please enter a valid URL.', 'error');
      // Auto-close the error message after 5 seconds
      setTimeout(() => {
        clearDcIsoDownloadState();
      }, 5000);
      return;
    }

    // Set downloading message
    setDcIsoDownloadMessage('Downloading...', 'info');

    try {
      // Use the simple download function without progress tracking
      await downloadDcIso(isoUrl, dispatch);

      // Clear the URL input on successful download
      setIsoUrl('');

      // Set success message
      setDcIsoDownloadMessage('Download completed successfully!', 'success');

      // Reset fetch flag and refresh the ISO list
      dcIsoListFetched.current = false;
      fetchIsoDataSafely();
    } catch (error) {
      logger.error('ISO download failed', { error });
      // Check for 500 status code specifically
      if (error.response && error.response.status === 500) {
        setDcIsoDownloadMessage(
          'Server error (500) occurred during download. Please try again later.',
          'error'
        );
      } else {
        // Extract backend error message if available
        let errorMessage = 'Unknown error';
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
        setDcIsoDownloadMessage(`Download failed: ${errorMessage}`, 'error');
      }
    }
  };

  const handleUpload = async () => {
    // Validate if a file is selected
    if (!file) {
      setDcIsoUploadMessage('Please select an ISO or RAW file first.', 'error');
      return;
    }

    // Validate file extension - accept both .iso and .raw
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'iso' && fileExt !== 'raw' && fileExt !== 'img') {
      setDcIsoUploadMessage('Please upload a file with .iso, .img or .raw extension', 'error');
      return;
    }

    // Determine ISO type based on file extension
    const currentIsoType = fileExt === 'iso' ? 'local' : 'cloud-init';

    // Validate file size (max 10GB)
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB in bytes
    if (file.size > maxSize) {
      setDcIsoUploadMessage(
        `File size exceeds the maximum limit (10GB). Your file is ${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB.`,
        'error'
      );
      return;
    }

    try {
      // Use the enhanced upload function with progress tracking
      await uploadDcIsoWithProgress(file, dispatch, currentIsoType);

      // Clear the file input on successful upload
      setFile(null);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Reset fetch flags to allow fresh data after upload
      dcIsoListFetched.current = false;
      if (currentIsoType === 'cloud-init') {
        dcCloudImagesFetched.current = false;
      }

      // Refresh the appropriate lists
      fetchIsoDataSafely();
      if (currentIsoType === 'cloud-init') {
        fetchCloudImagesDataSafely();
      }
    } catch (error) {
      logger.error('ISO upload failed', { error });
      // Error is already handled by the uploadDcIsoWithProgress function
    }
  };

  const handleDeleteIso = async (isoName: string, isCloudImage: boolean = false) => {
    setIsoToDelete(isoName);
    setIsDeleteModalOpen(true);
    // Store whether this is a cloud image for the modal
    setIsCloudImage(isCloudImage);
  };

  const confirmDeleteIso = async () => {
    if (!isoToDelete) return;

    try {
      await deleteDcIso(isoToDelete, dispatch, isCloudImage);

      // Reset fetch flags to allow fresh data after deletion
      if (isCloudImage) {
        dcCloudImagesFetched.current = false;
        fetchCloudImagesDataSafely();
      } else {
        dcIsoListFetched.current = false;
        fetchIsoDataSafely();
      }
    } catch (error) {
      logger.error('ISO deletion failed', { error });
      const err = error as Error;
      setDcIsoDownloadMessage(`Delete failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsDeleteModalOpen(false);
      setIsoToDelete(null);
      setIsCloudImage(false);
    }
  };

  const cancelDeleteIso = () => {
    setIsDeleteModalOpen(false);
    setIsoToDelete(null);
    setIsCloudImage(false);
  };

  // Helper function to get message style based on type
  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="dc-iso-manager">
      {/* ISO Description */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6" data-testid="dc-iso-description">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">About ISO Files</h2>
            </div>
            <p className="text-gray-600 text-sm mt-1">
              An ISO file is a digital copy of an optical disc that allows Karios hypervisor to
              insert installation media into a virtual machine virtually.
            </p>
          </div>
        </div>
      </div>
      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-4" data-testid="dc-iso-loading">
          <p className="text-gray-600">Loading ISOs...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" data-testid="dc-iso-error">
          {error}
        </div>
      )}

      {/* Main content */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Download ISO */}
          <div className="bg-white rounded-2xl shadow p-6 space-y-4" data-testid="dc-iso-download-section">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Import size={24} color="#666666" data-testid="import-icon" /> Download
            </h2>
            <div className="flex gap-4 flex-col xl:flex-row xl:items-center">
              <input
                type="text"
                placeholder="Add FQDN URL with the appended ISO file."
                value={isoUrl}
                onChange={(e) => setIsoUrl(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring bg-white h-10"
                data-testid="dc-iso-download-url-input"
              />
              <button
                onClick={handleDownload}
                disabled={isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 h-10"
                data-testid="dc-iso-download-button"
              >
                Download
              </button>
            </div>
            {downloadMessage && (
              <div
                className={`${getMessageStyle(downloadMessageType)} px-4 py-3 border rounded-md relative mt-2 flex justify-between items-center`}
                data-testid="dc-iso-download-message"
              >
                <span className="text-sm font-medium">{downloadMessage}</span>
                <button
                  onClick={() => clearDcIsoDownloadState()}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                  aria-label="Dismiss message"
                  data-testid="dc-iso-download-message-dismiss"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Upload ISO */}
          <div className="bg-white rounded-2xl shadow p-6 space-y-4" data-testid="dc-iso-upload-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Export size={24} color="#666666" data-testid="export-icon" /> Upload ISO
              </h2>
            </div>
            <div className="flex gap-4 flex-col xl:flex-row xl:items-center">
              <input
                type="file"
                accept=".iso,.raw,.img"
                disabled={uploadingIso || isLoading}
                onChange={(e) => {
                  // Prevent file selection during upload
                  if (uploadingIso || isLoading) {
                    e.target.value = '';
                    return;
                  }

                  const files = e.target.files;
                  if (!files) return;

                  const selectedFile = files[0];
                  const fileName = selectedFile?.name.toLowerCase();

                  // Validate file extension - accept both .iso and .raw
                  if (
                    !fileName.endsWith('.iso') &&
                    !fileName.endsWith('.raw') &&
                    !fileName.endsWith('.img')
                  ) {
                    setDcIsoUploadMessage(
                      'Please upload a file with .iso,.img or .raw extension',
                      'error'
                    );
                    e.target.value = ''; // Reset the input
                    return;
                  }

                  setFile(selectedFile);
                  clearDcIsoUploadState(); // Clear any previous messages
                }}
                className="hidden"
                id="iso-file-input"
                data-testid="dc-iso-upload-file-input"
              />
              <label
                htmlFor="iso-file-input"
                className={`flex-1 px-4 py-2 border rounded-lg text-center h-10 flex items-center justify-center ${
                  uploadingIso || isLoading
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                    : 'cursor-pointer bg-white hover:bg-gray-50 focus:outline-none'
                }`}
                title={
                  uploadingIso || isLoading ? 'Upload in progress...' : file ? file.name : undefined
                }
                data-testid="dc-iso-upload-file-label"
              >
                {uploadingIso || isLoading
                  ? 'Uploading...'
                  : file
                    ? file.name.length > 15
                      ? file.name.slice(0, 12) + '...'
                      : file.name
                    : 'Choose ISO or RAW File'}
              </label>
              <button
                onClick={handleUpload}
                disabled={isLoading || uploadingIso}
                className="bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 h-10"
                data-testid="dc-iso-upload-button"
              >
                Upload
              </button>
            </div>
            {uploadMessage && (
              <div
                className={`${getMessageStyle(uploadMessageType)} px-4 py-3 border rounded-md relative mt-2 flex justify-between items-center`}
                data-testid="dc-iso-upload-message"
              >
                <span className="text-sm font-medium">{uploadMessage}</span>
                <button
                  onClick={() => clearDcIsoUploadState()}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                  aria-label="Dismiss message"
                  data-testid="dc-iso-upload-message-dismiss"
                >
                  ✕
                </button>
              </div>
            )}
            {uploadingIso && (
              <div className="mt-4" data-testid="dc-iso-upload-progress">
                <div className="w-full bg-gray-200 rounded-full h-3" data-testid="dc-iso-upload-progress-bar-container">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                    data-testid="dc-iso-upload-progress-bar"
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mt-2">
                  <span>Upload Progress</span>
                  <span className="font-semibold" data-testid="dc-iso-upload-progress-percentage">{Math.round(uploadProgress)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Toggle Dropdown */}
      {!isLoading && !uploadingIso && (
        <div className="flex justify-end mb-6" data-testid="dc-iso-view-toggle-section">
          <div className="flex items-center">
            {/* <label className="text-sm text-gray-700 mr-2">View:</label> */}
            <div className="relative">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="border-2 border-gray-400 rounded-lg px-6 py-3 pr-12 text-base font-medium bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:border-gray-500 transition-colors min-w-[220px]"
                data-testid="dc-iso-view-mode-select"
              >
                <option value="isos">Available ISO&apos;s</option>
                <option value="cloud-images">Available Cloud Images</option>
              </select>
              {/* Custom dropdown arrow */}
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                <svg
                  className="w-5 h-5 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ISO List */}
      {!isLoading && viewMode === 'isos' && (
        <div className="bg-white rounded-2xl shadow p-6" data-testid="dc-iso-list-section">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Available ISO&apos;s</h3>
          {Array.isArray(isoList) ? (
            isoList.length === 0 ? (
              <p className="text-gray-500 italic" data-testid="dc-iso-list-empty">No ISOs available.</p>
            ) : (
              <div className="space-y-4" data-testid="dc-iso-list">
                {isoList.map((iso: string, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-gray-100 rounded-xl"
                    data-testid={`dc-iso-list-item-${idx}`}
                  >
                    <div>
                      <p className="text-gray-800 font-medium" data-testid={`dc-iso-list-item-name-${idx}`}>{iso}</p>
                      <p className="text-black-600 text-sm">Mountable ISO</p>
                    </div>
                    <button
                      className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                      onClick={() => handleDeleteIso(iso)}
                      disabled={isLoading}
                      data-testid={`dc-iso-delete-button-${idx}`}
                    >
                      {isLoading ? 'Deleting' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : typeof isoList === 'object' && isoList !== null && 'error' in isoList ? (
            <div className="text-gray-500 italic" data-testid="dc-iso-list-empty">No ISOs available.</div>
          ) : (
            <p className="text-gray-500 italic" data-testid="dc-iso-list-empty">No ISOs available.</p>
          )}
        </div>
      )}

      {/* Cloud Images List */}
      {!uploadingIso && viewMode === 'cloud-images' && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Cloud Images</h3>
          {cloudImagesError ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {cloudImagesError}
            </div>
          ) : cloudImagesList.length === 0 ? (
            <p className="text-gray-500 italic">No cloud images available.</p>
          ) : (
            <div className="space-y-4">
              {cloudImagesList.map((image: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-gray-100 rounded-xl"
                >
                  <div>
                    <p className="text-gray-800 font-medium">{image}</p>
                    <p className="text-green-600 text-sm">Cloud Image</p>
                  </div>
                  <button
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                    onClick={() => handleDeleteIso(image, true)}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Deleting' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={cancelDeleteIso}
        title="Confirm Delete"
        width="400px"
      >
        <div className="space-y-4" data-testid="dc-iso-delete-modal">
          <p className="text-gray-700" data-testid="dc-iso-delete-modal-message">
            Are you sure you want to delete <strong>{isoToDelete}</strong>?
          </p>
          <p className="text-sm text-gray-500">This action cannot be undone.</p>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={cancelDeleteIso}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none"
              data-testid="dc-iso-delete-modal-cancel-button"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteIso}
              className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none"
              data-testid="dc-iso-delete-modal-confirm-button"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default React.memo(DcIsoManager);
DcIsoManager.displayName = 'DcIsoManager';
