import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { Import, Export } from 'iconsax-react';
import { useAppState } from '@karios-monorepo/shared-state';
import Modal from '../../shared-state/src/widgets/Modal';
import Tooltip from '../../shared-state/src/widgets/Tooltip';
import axios from 'axios';
import envConfig from '../../../runtime-config';
import { createComponentLogger } from '@karios-monorepo/shared-state';

function IsoManager() {
  const [isoUrl, setIsoUrl] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [cloudImageErrorMessage, setCloudImageErrorMessage] = useState<string>(''); // For showing cloud image errors
  const [cloudImageMessageType, setCloudImageMessageType] = useState<string>(''); // For cloud image error type
  const [isoType, setIsoType] = useState<string>('local'); // Will be determined by file extension
  const [viewMode, setViewMode] = useState<string>('isos'); // New state for view toggle

  // Modal state for delete confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isoToDelete, setIsoToDelete] = useState<string | null>(null);

  // Refs to prevent duplicate API calls
  const isoListFetched = useRef(false);
  const cloudImagesFetched = useRef(false);
  const lastIsoFetchTime = useRef(0);
  const lastCloudImagesFetchTime = useRef(0);

  // Initialize logger for this component
  const logger = createComponentLogger('IsoManager');

  const {
    state,
    fetchIsoList,
    fetchCloudImages,
    uploadIso,
    downloadIso,
    deleteIso,
    setUploadProgress,
    setUploadMessage,
    clearUploadState,
    setDownloadProgress,
    setDownloadMessage,
    clearDownloadState,
  } = useAppState();
  const { selectedServer } = state;

  // Get progress states from shared state
  const {
    uploadingIso,
    uploadProgress,
    uploadMessage,
    uploadMessageType,
    downloadingIso,
    downloadProgress,
    downloadMessage,
    downloadMessageType,
  } = state.iso;

  // Local functions for ISO management will be replaced with API service functions

  // Smart fetch functions with duplicate prevention
  const fetchIsoListSafely = async (serverIp: string) => {
    const now = Date.now();
    if (isoListFetched.current || now - lastIsoFetchTime.current < 3000) {
      logger.debug('ISO list fetch skipped - already fetched or rate limited');
      return;
    }

    logger.info('Fetching ISO list', { serverIp });
    isoListFetched.current = true;
    lastIsoFetchTime.current = now;

    try {
      await fetchIsoList(serverIp);
    } catch (error) {
      logger.error('Failed to fetch ISO list', error);
      isoListFetched.current = false; // Reset on error
    }
  };

  const fetchCloudImagesSafely = async (serverIp: string) => {
    const now = Date.now();
    if (cloudImagesFetched.current || now - lastCloudImagesFetchTime.current < 3000) {
      logger.debug('Cloud images fetch skipped - already fetched or rate limited');
      return;
    }

    logger.info('Fetching cloud images', { serverIp });
    cloudImagesFetched.current = true;
    lastCloudImagesFetchTime.current = now;

    try {
      await fetchCloudImages(serverIp);
    } catch (error) {
      logger.error('Failed to fetch cloud images', error);
      cloudImagesFetched.current = false; // Reset on error
    }
  };

  useEffect(() => {
    // Reset fetch flags when server changes to allow fresh data
    isoListFetched.current = false;
    cloudImagesFetched.current = false;

    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (serverAddress) {
      logger.info('Server changed, fetching ISO list', { serverAddress });
      // Only fetch ISOs initially, cloud images will be fetched when switching to that view
      fetchIsoListSafely(serverAddress);
    }
  }, [selectedServer?.fqdn, selectedServer?.ip]);

  useEffect(() => {
    // If we successfully loaded cloud images, we can clear any previous error messages
    if (state.cloudImages?.cloudImagesList && !state.cloudImages?.error) {
      setCloudImageErrorMessage('');
    }
  }, [state.cloudImages]);

  const handleDownload = async () => {
    if (!isoUrl.trim()) {
      setDownloadMessage('Please enter a valid URL.', 'error');
      // Auto-close the error message after 5 seconds
      setTimeout(() => {
        clearDownloadState();
      }, 5000);
      return;
    }

    // No file extension restrictions for downloads - accept any file type

    try {
      // Use the shared state downloadIso function
      await downloadIso(selectedServer.fqdn || selectedServer.ip, isoUrl);

      // If we reach here, the download was successful
      setIsoUrl('');
    } catch (error) {
      logger.error('ISO download failed', error);
      // Error is already handled by the shared state downloadIso function
    }
  };

  const handleUpload = async () => {
    // Validate if a file is selected
    if (!file) {
      setUploadMessage('Please select a file first.', 'error');
      setTimeout(() => {
        clearUploadState();
      }, 5000);
      return;
    }
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    let currentIsoType = 'local';
    if (fileExt === 'iso') {
      currentIsoType = 'local';
    } else if (fileExt === 'img' || fileExt === 'raw') {
      currentIsoType = 'cloud-init';
    } else {
      setUploadMessage('Please upload a file with .iso, .img or .raw extension', 'error');
      setTimeout(() => {
        clearUploadState();
      }, 5000);
      return;
    }
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB in bytes
    if (file.size > maxSize) {
      setUploadMessage(
        `File size exceeds the maximum limit (10GB). Your file is ${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB.`,
        'error'
      );
      setTimeout(() => {
        clearUploadState();
      }, 5000);
      return;
    }

    try {
      // Use shared state to track upload progress
      setUploadMessage('Uploading file...', 'info');
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', currentIsoType);
      const uploadUrl =
        state?.selectedServer?.fqdn || state?.selectedServer?.ip
          ? `${envConfig().PROTOCOL}://${state.selectedServer.fqdn || state.selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/iso/upload`
          : undefined;
      const authToken = localStorage.getItem('accessToken');
      if (!uploadUrl || !authToken) {
        setUploadMessage('Upload URL or authentication token is missing.', 'error');
        return;
      }

      // Use axios for progress tracking
      await axios.post(uploadUrl, formData, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentComplete = (progressEvent.loaded / progressEvent.total) * 100;
            setUploadProgress(Math.min(percentComplete, 99));
          }
        },
      });

      setUploadProgress(100);
      setFile(null);
      setUploadMessage(
        currentIsoType === 'local'
          ? 'ISO file uploaded successfully!'
          : 'Cloud image uploaded successfully!',
        'success'
      );
      // Reset fetch flags to allow fresh data after upload
      isoListFetched.current = false;
      if (currentIsoType === 'cloud-init') {
        cloudImagesFetched.current = false;
      }
      fetchIsoListSafely(state.selectedServer.fqdn || state.selectedServer.ip);
      if (currentIsoType === 'cloud-init') {
        fetchCloudImagesSafely(state.selectedServer.fqdn || state.selectedServer.ip);
      }
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Reset progress after a short delay to show completion
      setTimeout(() => {
        clearUploadState();
      }, 2000);
    } catch (error) {
      setUploadProgress(0);
      if (axios.isAxiosError(error)) {
        setUploadMessage(
          error.response?.data?.error || error.message || 'Unknown error occurred.',
          'error'
        );
      } else {
        setUploadMessage(
          `Error uploading ISO: ${error.message || 'Unknown error occurred.'}`,
          'error'
        );
      }
    }
  };

  const handleDeleteIso = async (isoName: string, isCloudImage: boolean = false) => {
    setIsoToDelete(isoName);
    setIsDeleteModalOpen(true);
    // Store whether this is a cloud image in state
    setIsoType(isCloudImage ? 'cloud-image' : 'local');
  };

  const confirmDeleteIso = async () => {
    if (!isoToDelete) return;

    try {
      const isCloudImage = isoType === 'cloud-image';
      await deleteIso(selectedServer.fqdn || selectedServer.ip, isoToDelete, isCloudImage);
      // If we reach here, the delete was successful
      // Reset fetch flags to allow fresh data after delete
      isoListFetched.current = false;
      if (isCloudImage) {
        cloudImagesFetched.current = false;
      }
      fetchIsoListSafely(selectedServer.fqdn || selectedServer.ip);
      // Also refresh cloud images list if we deleted a cloud image
      if (isCloudImage) {
        fetchCloudImagesSafely(selectedServer.fqdn || selectedServer.ip);
      }
    } catch (error) {
      const err = error as Error;
      const isCloudImage = isoType === 'cloud-image';
      logger.error('Failed to delete file', {
        fileName: isoToDelete,
        fileType: isCloudImage ? 'cloud-image' : 'iso',
        error: err.message,
      });

      // Clean up the error message
      let errorMsg = err.message;
      // Remove common prefixes
      errorMsg = errorMsg
        .replace(/^Error: /i, '')
        .replace(/^Failed to delete ISO: /i, '')
        .replace(/^Delete failed: /i, '');

      // Display the error in the appropriate location based on what type we're deleting
      if (isCloudImage) {
        setCloudImageErrorMessage(errorMsg);
        setCloudImageMessageType('error');
      } else {
        setDownloadMessage(errorMsg, 'error');
      }
    } finally {
      setIsDeleteModalOpen(false);
      setIsoToDelete(null);
    }
  };

  const cancelDeleteIso = () => {
    setIsDeleteModalOpen(false);
    setIsoToDelete(null);
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

  const {
    isoList,
    loading: isLoading,
    error,
  } = state.iso || { isoList: [], loading: false, error: null };
  const cloudImagesLoading = state.cloudImages?.loading || false;
  const combinedLoading = isLoading || cloudImagesLoading;

  return (
    <div className="p-6 space-y-6">
      {/* ISO Description */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
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
              An ISO file is a digital copy of an optical disc that allows Karios`&apos;` hypervisor to
              insert installation media into a virtual machine virtually.
            </p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-4">
          <p className="text-gray-600">Loading files...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Download ISO */}
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Import size={24} color="#666666" /> Download
            </h2>
            <div className="flex gap-4 flex-col xl:flex-row xl:items-center">
              <input
                type="text"
                placeholder="Add FQDN URL with the appended ISO file."
                value={isoUrl}
                disabled={downloadingIso || isLoading}
                onChange={(e) => setIsoUrl(e.target.value)}
                className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring ${
                  downloadingIso || isLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white'
                }`}
              />
              <button
                onClick={handleDownload}
                disabled={downloadingIso || isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 h-10"
              >
                {downloadingIso ? 'Downloading...' : 'Download'}
              </button>
            </div>
            {downloadMessage && (
              <div
                className={`${getMessageStyle(downloadMessageType)} px-4 py-3 border rounded-md relative mt-2 flex justify-between items-center`}
              >
                <span className="text-sm font-medium">{downloadMessage}</span>
                <button
                  onClick={() => clearDownloadState()}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                  aria-label="Dismiss message"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Upload ISO */}
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Export size={24} color="#666666" /> Upload ISO12
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

                  // Validate file extension
                  if (
                    !fileName.endsWith('.iso') &&
                    !fileName.endsWith('.raw') &&
                    !fileName.endsWith('.img')
                  ) {
                    setUploadMessage(
                      'Please upload a file with .iso, .img or .raw extension',
                      'error'
                    );
                    e.target.value = ''; // Reset the input
                    return;
                  }

                  setFile(selectedFile);
                  clearUploadState(); // Clear any previous messages
                }}
                className="hidden"
                id="iso-file-input"
              />
              <label
                htmlFor="iso-file-input"
                className={`flex-1 px-4 py-2 border rounded-lg text-center ${
                  uploadingIso || isLoading
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                    : 'cursor-pointer bg-white hover:bg-gray-50 focus:outline-none'
                }`}
                title={
                  uploadingIso || isLoading ? 'Upload in progress...' : file ? file.name : undefined
                }
              >
                {uploadingIso || isLoading
                  ? 'Uploading...'
                  : file
                    ? file.name.length > 15
                      ? file.name.slice(0, 12) + '...'
                      : file.name
                    : 'Choose ISO, IMG or RAW File'}
              </label>
              <button
                onClick={handleUpload}
                disabled={isLoading || uploadingIso}
                className="bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 h-10"
              >
                Upload
              </button>
            </div>
            {uploadMessage && (
              <div
                className={`${getMessageStyle(uploadMessageType)} px-4 py-3 border rounded-md relative mt-2 flex justify-between items-center`}
              >
                <span className="text-sm font-medium">{uploadMessage}</span>
                <button
                  onClick={() => clearUploadState()}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                  aria-label="Dismiss message"
                >
                  ✕
                </button>
              </div>
            )}
            {uploadingIso && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mt-2">
                  <span>Upload Progress</span>
                  <span className="font-semibold">{Math.round(uploadProgress)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* View Toggle Dropdown */}
      {!combinedLoading && (
        <div className="flex justify-end mb-6">
          <div className="flex items-center">
            {/* <label className="text-sm text-gray-700 mr-2">View:</label> */}
            <div className="relative">
              <select
                value={viewMode}
                onChange={(e) => {
                  setViewMode(e.target.value);
                  // Clear error messages when changing view modes
                  clearDownloadState();
                  setCloudImageErrorMessage('');

                  // Fetch cloud images when switching to cloud-images view
                  if (
                    e.target.value === 'cloud-images' &&
                    (selectedServer?.fqdn || selectedServer?.ip)
                  ) {
                    fetchCloudImagesSafely(selectedServer.fqdn || selectedServer.ip);
                  }
                }}
                className="border-2 border-gray-400 rounded-lg px-6 py-3 pr-12 text-base font-medium bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:border-gray-500 transition-colors min-w-[220px]"
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
        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Available ISO&apos;s</h3>
          {isoList.length === 0 ? (
            <p className="text-gray-500 italic">No ISOs available.</p>
          ) : (
            <div className="space-y-4">
              {isoList.map((iso: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-gray-100 rounded-xl"
                >
                  <div>
                    <p className="text-gray-800 font-medium">{iso}</p>
                    <p className="text-black-600 text-sm">Mountable ISO</p>
                  </div>
                  <button
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                    onClick={() => handleDeleteIso(iso)}
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

      {/* Cloud Images List */}
      {!cloudImagesLoading && viewMode === 'cloud-images' && (
        <div className="bg-white rounded-2xl shadow p-6">
          {cloudImageErrorMessage && (
            <div
              className={`${getMessageStyle(cloudImageMessageType)} px-4 py-3 border rounded-md relative mb-4 flex justify-between items-center`}
            >
              <span className="text-sm font-medium">{cloudImageErrorMessage}</span>
              <button
                onClick={() => setCloudImageErrorMessage('')}
                className="ml-2 text-gray-500 hover:text-gray-700"
                aria-label="Dismiss message"
              >
                ✕
              </button>
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Cloud Images</h3>
          {Array.isArray(state.cloudImages?.raws) && state.cloudImages.raws.length > 0 ? (
            <div className="space-y-4">
              {state.cloudImages.raws.map((image: string, idx: number) => (
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
          ) : Array.isArray(state.cloudImages?.cloudImagesList) &&
            state.cloudImages.cloudImagesList.length > 0 ? (
            <div className="space-y-4">
              {state.cloudImages.cloudImagesList.map((image: string, idx: number) => (
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
          ) : (
            <p className="text-gray-500 italic">No cloud images available.</p>
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
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{isoToDelete}</strong>?
          </p>
          <p className="text-sm text-gray-500">This action cannot be undone.</p>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={cancelDeleteIso}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteIso}
              className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default React.memo(IsoManager);
// Set display name for better debugging
IsoManager.displayName = 'ImageManager'; // Updated to reflect both ISO and RAW handling
