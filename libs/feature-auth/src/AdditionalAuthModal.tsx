import React, { useState, useEffect } from 'react';
import { FaUpload, FaSpinner, FaCheckCircle, FaExclamationTriangle, FaCopy } from 'react-icons/fa';
import envConfig from '../../../runtime-config';
import { createComponentLogger } from '@karios-monorepo/shared-state';

interface AdditionalAuthModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface UploadInfoResponse {
  message: string;
  signature: string;
  status: string;
  timestamp: string;
}

interface UploadResponse {
  success: boolean;
  message: string;
  filename?: string;
}
const URL = `${envConfig().CONTROL_NODE_IP.LICENSE_URL}${envConfig().LICENSE_PORT}`; // Use the LICENSE_PORT from runtime config

const AdditionalAuthModal: React.FC<AdditionalAuthModalProps> = ({ isOpen, onComplete }) => {
  const logger = createComponentLogger('AdditionalAuthModal');

  const [uploadInfo, setUploadInfo] = useState<UploadInfoResponse | null>(null);
  const [uploadInfoLoading, setUploadInfoLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [installMessage, setInstallMessage] = useState('');

  // API to fetch upload info
  const fetchUploadInfo = async (): Promise<UploadInfoResponse> => {
    const response = await fetch(`${envConfig().PROTOCOL}://${URL}/api/v1/license/upload/info`);
    if (!response.ok) {
      throw new Error('Failed to fetch upload info');
    }
    return response.json();
  };

  // API to upload JSON file to /upload/license endpoint
  const uploadJsonFile = async (file: File): Promise<UploadResponse> => {
    // Validate file type before sending
    if (!file.name.toLowerCase().endsWith('.json')) {
      throw new Error('Please upload a valid JSON file');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${envConfig().PROTOCOL}://${URL}/api/v1/license/upload/license`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${errorText || response.statusText}`);
    }

    const result = await response.json();

    return {
      success: true,
      message: result.message || 'License uploaded successfully!',
      filename: file.name,
    };
  };

  // API to install Karios
  const installKarios = async (): Promise<void> => {
    const response = await fetch(`${envConfig().PROTOCOL}://${URL}/api/v1/license/install/karios`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Installation failed: ${errorText || response.statusText}`);
    }
  };

  // Fetch upload info when modal opens
  useEffect(() => {
    if (isOpen && !uploadInfo) {
      setUploadInfoLoading(true);

      fetchUploadInfo()
        .then((uploadInfoResponse) => {
          setUploadInfo(uploadInfoResponse);
        })
        .catch((error) => {
          logger.error('Error fetching upload info', { error: error.message });
        })
        .finally(() => {
          setUploadInfoLoading(false);
        });
    }
  }, [isOpen, uploadInfo]);

  // Handle copying message to clipboard
  const handleCopyMessage = async () => {
    if (!uploadInfo?.message) return;

    try {
      await navigator.clipboard.writeText(uploadInfo.message);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      logger.warn('Failed to copy to clipboard, using fallback', { error: error.message });
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = uploadInfo.message;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus('idle');
      setUploadMessage('');
    }
  };

  // Handle drag and drop
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
        setSelectedFile(file);
        setUploadStatus('idle');
        setUploadMessage('');
      } else {
        setUploadStatus('error');
        setUploadMessage('Please select a JSON file');
      }
    }
  };

  // Handle file upload and installation
  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('error');
      setUploadMessage('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadStatus('idle');
    setInstallStatus('idle');
    setInstallMessage('');

    try {
      // Upload and validate the license file
      const response = await uploadJsonFile(selectedFile);
      // If upload is successful, wait then automatically start installation in background
      if (response.success) {
        // Wait before starting background installation
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setInstalling(true);
        try {
          await installKarios();
          setUploadStatus('success');
          setUploadMessage("Validated, You're All Set");
          // Installation successful but don't show installation messages
          // Wait a moment then complete the process
          setTimeout(() => {
            onComplete();
          }, 1500);
        } catch (installError) {
          setUploadStatus('error');
          setUploadMessage('Invalid License');
          // If installation fails, we still show validation success but handle silently
          logger.error('Background installation failed', { error: installError.message });
        } finally {
          setInstalling(false);
        }
      } else {
        setUploadStatus('error');
        setUploadMessage('Invalid License');
      }
    } catch (error) {
      setUploadStatus('error');
      setUploadMessage('Invalid License');
    } finally {
      setUploading(false);
    }
  };

  // Handle installation
  const handleInstall = async () => {
    setInstalling(true);
    setInstallStatus('idle');
    setInstallMessage('');

    try {
      await installKarios();
      setInstallStatus('success');
      setInstallMessage("Validated, You're All Set");

      // Wait a moment then complete the process
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      setInstallStatus('error');
      setInstallMessage('Upload valid License file');
    } finally {
      setInstalling(false);
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] backdrop-blur-sm bg-black/50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Modal header - no close button as it's non-closable */}
        <div className="bg-karios-blue text-white p-6 rounded-t-lg">
          <h2 id="auth-modal-title" className="text-xl font-semibold flex items-center">
            <FaExclamationTriangle className="mr-2" />
            Access Karios
          </h2>
        </div>

        {/* Modal body */}
        <div className="p-6 space-y-6">
          {/* Instructions for user */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-2 text-md text-blue-900">
            <strong>Instructions:</strong>
            <ol className="list-decimal ml-5 mt-2 space-y-1">
              <li>Copy the token below.</li>
              <li>
                Go to the{' '}
                <a
                  href="https://billing.zohosecure.com/subscribe/c0c0b64f61f8f4b88d1aecb1b2f1701d8dcfc5faa1a502c5ad482bf477cf719e/Free_Trial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline hover:text-blue-900"
                >
                  license request portal
                </a>
                .
              </li>
              <li>
                Paste this token into the portal (token field) to generate your license JSON file.
              </li>
              <li>Please check your email for License file</li>
              <li>Upload the License file here to continue.</li>
            </ol>
          </div>

          {/* Upload Info Message Display */}
          {uploadInfo && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              {/* Info icon and message about copying the token exactly */}
              <div className="flex items-center mb-2 text-red-700 text-md">
                <FaExclamationTriangle size={32} className="mr-2" />
                <span>
                  Make sure to copy the token exactly. Any mismatch will restrict you from accessing
                  Karios.
                </span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Token</h3>
              <div className="flex items-center justify-between bg-white border rounded-lg p-3">
                <code className="text-md text-gray-800 flex-1 mr-3 break-all font-mono">
                  {uploadInfo.message}
                </code>
                <button
                  onClick={handleCopyMessage}
                  className={`flex items-center gap-2 px-3 py-1 rounded text-md font-medium transition-colors ${
                    copySuccess
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-karios-blue hover:bg-karios-blue/90 text-white border border-karios-blue'
                  }`}
                  title="Copy to clipboard"
                >
                  {copySuccess ? (
                    <>
                      <FaCheckCircle className="text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <FaCopy />
                      Copy
                    </>
                  )}
                </button>
              </div>
              {/* License request link */}
              <div className="mt-4 text-center">
                <a
                  href="https://billing.zohosecure.com/subscribe/c0c0b64f61f8f4b88d1aecb1b2f1701d8dcfc5faa1a502c5ad482bf477cf719e/Free_Trial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-karios-blue text-white rounded hover:bg-blue-700 font-medium transition-colors"
                >
                  Request a License
                </a>
              </div>
              {uploadInfoLoading && (
                <div className="flex items-center mt-2 text-gray-600">
                  <FaSpinner className="animate-spin mr-2" />
                  <span className="text-md">Loading token...</span>
                </div>
              )}
            </div>
          )}

          {uploadInfoLoading && !uploadInfo && (
            <div className="flex items-center justify-center py-8">
              <FaSpinner className="animate-spin text-2xl text-blue-600 mr-3" />
              <span className="text-gray-600">Loading authentication token...</span>
            </div>
          )}

          <div className="space-y-4">
            <label className="block text-md font-medium text-gray-700">
              Security Configuration File (JSON)
            </label>

            {/* Drag and drop area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors relative ${
                dragOver
                  ? 'border-blue-400 bg-blue-50'
                  : selectedFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-2 relative bg-white rounded-lg shadow p-4 border border-green-200">
                  <button
                    type="button"
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-md font-bold focus:outline-none"
                    aria-label="Remove file"
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadStatus('idle');
                      setUploadMessage('');
                    }}
                  >
                    &times;
                  </button>
                  <FaCheckCircle className="mx-auto text-2xl text-green-600" />
                  <p className="text-md font-medium text-green-800">{selectedFile.name}</p>
                  <p className="text-md text-green-600">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <FaUpload className="mx-auto text-2xl text-gray-400" />
                  <p className="text-md text-gray-600">
                    Drag and drop your JSON file here, or{' '}
                    <label className="text-karios-blue hover:text-karios-blue/80 cursor-pointer underline">
                      click to browse
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  </p>
                </div>
              )}
            </div>

            {/* Upload status */}
            {uploadMessage && (
              <div
                className={`text-md p-3 rounded ${
                  uploadStatus === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {uploadMessage}
              </div>
            )}

            {/* Install status */}
            {installMessage && (
              <div
                className={`text-md p-3 rounded ${
                  installStatus === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {installMessage}
              </div>
            )}

            {/* Upload button */}
            {uploadStatus !== 'success' && installStatus !== 'success' && (
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading || installing}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center ${
                  !selectedFile || uploading || installing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-karios-blue hover:bg-karios-blue/90 text-white'
                }`}
              >
                {uploading ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Validating license...
                  </>
                ) : installing ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <FaUpload className="mr-2" />
                    Validate license
                  </>
                )}
              </button>
            )}

            {/* Success message - shows after successful installation */}
            {installStatus === 'success' && (
              <div className="text-center py-4">
                <FaCheckCircle className="mx-auto text-4xl text-green-600 mb-2" />
                <p className="text-md font-medium text-green-800">Welcome to Karios!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdditionalAuthModal;
