import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../../shared-state/src/widgets/Modal';
import envConfig from '../../../../runtime-config';
import api from '../../../shared-state/src/utils/interceptor';
import { useAppState } from '@karios-monorepo/shared-state';
import { logger } from '../../../shared-state/src/utils/logger';

interface StatusLog {
  id: number;
  message: string;
  timestamp: string;
  isSystemMessage?: boolean;
  isError?: boolean;
}

interface OmniProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadFile {
  file: File | null;
  name: string;
  type: 'cert' | 'key';
}

export default function OmniProvisionModal({ isOpen, onClose }: OmniProvisionModalProps) {
  const [currentView, setCurrentView] = useState<'main' | 'keycloak' | 'upload'>('main');
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const { state, dispatch } = useAppState();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const logCounterRef = useRef<number>(0);

  // Upload files state
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([
    { file: null, name: '', type: 'cert' },
    { file: null, name: '', type: 'key' },
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Cloud Image state (changed from ISO to cloud images)
  const [selectedISO, setSelectedISO] = useState('');
  const [availableISOs, setAvailableISOs] = useState<string[]>([]);
  const [isLoadingISOs, setIsLoadingISOs] = useState(false);
  const [clusterName, setClusterName] = useState('');

  const handleClose = () => {
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close(1000, 'User closed modal');
    }
    socketRef.current = null;
    setIsConnected(false);
    setCurrentView('main');
    setStatusLogs([]);
    setUploadFiles([
      { file: null, name: '', type: 'cert' },
      { file: null, name: '', type: 'key' },
    ]);
    setUploadSuccess(false);

    // Reset cloud image state
    setSelectedISO('');
    setAvailableISOs([]);
    setIsLoadingISOs(false);
    setClusterName('');

    onClose();
  };

  // Function to fetch Omni dashboard URL from API
  const fetchOmniDashboardUrl = async () => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`
      );

      if (!response.ok) {
        logger.error('Failed to fetch cluster info for Omni dashboard URL');
        return;
      }

      const clusterInfo = await response.json();

      if (clusterInfo && clusterInfo.clusters && Array.isArray(clusterInfo.clusters)) {
        // Look for the "omni" cluster first
        const omniCluster = clusterInfo.clusters.find(
          (cluster: any) => cluster.KubernetesClusterName === 'omni'
        );

        if (omniCluster && omniCluster.vms && omniCluster.vms.length > 0) {
          // Look for "omniserver" VM first, or take the first VM
          const omniVM =
            omniCluster.vms.find((vm: any) => vm.vmName === 'omniserver') || omniCluster.vms[0];

          if (omniVM && omniVM.fqdn) {
            const url = `https://${omniVM.fqdn}`;
            dispatch({ type: 'SET_OMNI_DASHBOARD_URL', payload: url });
            return;
          }
        }

        // If no "omni" cluster found, look for any cluster with "omniserver" VM
        for (const cluster of clusterInfo.clusters) {
          if (cluster.vms && cluster.vms.length > 0) {
            const omniVM = cluster.vms.find((vm: any) => vm.vmName === 'omniserver');
            if (omniVM && omniVM.fqdn) {
              const url = `https://${omniVM.fqdn}`;
              dispatch({ type: 'SET_OMNI_DASHBOARD_URL', payload: url });
              return;
            }
          }
        }
      }

      logger.error('No Omni server found in cluster info');
    } catch (error) {
      logger.error('Error fetching Omni dashboard URL:', error);
    }
  };

  const handleKeycloakClick = () => {
    setCurrentView('keycloak');
    setStatusLogs([]);
    setIsConnected(false);
    logCounterRef.current = 0;

    // Connect to Keycloak WebSocket
    const token = localStorage.getItem('accessToken');
    const wsUrl = `${envConfig().WS_PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/keycloak/setup?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          let message: any;

          try {
            message = JSON.parse(event.data);
          } catch {
            message = { status: event.data, message: event.data };
          }

          const messageText = message.message || message.status || message.Status || event.data;
          if (messageText) {
            logCounterRef.current += 1;
            setStatusLogs((prev) => [
              ...prev,
              {
                id: logCounterRef.current,
                message: messageText,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }

          // Check for disconnected status and switch to upload view
          const lowerMessage = String(messageText).toLowerCase();
          if (lowerMessage.includes('disconnected') || lowerMessage.includes('connection closed')) {
            setTimeout(() => {
              setCurrentView('upload');
              if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
              }
              setIsConnected(false);
            }, 2000);
          }
        } catch (error) {
          logger.error('Error parsing Keycloak WebSocket message:', error);
          logCounterRef.current += 1;
          setStatusLogs((prev) => [
            ...prev,
            {
              id: logCounterRef.current,
              message: `Error processing message: ${error.message}`,
              timestamp: new Date().toLocaleTimeString(),
              isError: true,
            },
          ]);
        }
      };

      ws.onerror = (error) => {
        logger.error('Keycloak WebSocket error:', error);
        logCounterRef.current += 1;
        setStatusLogs((prev) => [
          ...prev,
          {
            id: logCounterRef.current,
            message: `⚠️ Connection error: Unable to connect to Keycloak setup service`,
            timestamp: new Date().toLocaleTimeString(),
            isError: true,
          },
        ]);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        socketRef.current = null;
      };
    } catch (error) {
      logger.error('Error creating Keycloak WebSocket:', error);
      logCounterRef.current += 1;
      setStatusLogs((prev) => [
        ...prev,
        {
          id: logCounterRef.current,
          message: `❌ Failed to establish connection: ${error.message}`,
          timestamp: new Date().toLocaleTimeString(),
          isError: true,
        },
      ]);
    }
  };

  const handleOmniDashboardClick = () => {
    const dashboardUrl = state['omniDashboardUrl'] || 'https://omni.karios.com/';
    window.open(dashboardUrl, '_blank');
  };

  // Fetch Cloud Images from API when dropdown is clicked
  const fetchISOs = async () => {
    try {
      setIsLoadingISOs(true);

      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/cloudimages`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        logger.info('Cloud images API response:', data);

        // Handle response format: {"raws": ["freebsd-cloud.raw", "jammy-server-cloudimg-amd64.img"]}
        if (data && data.raws && Array.isArray(data.raws)) {
          setAvailableISOs(data.raws);
        } else {
          logger.error('Unexpected cloud images API response format:', data);
          setAvailableISOs([]);
        }
      } else {
        logger.error(`Failed to fetch cloud images: ${response.status} ${response.statusText}`);
        setAvailableISOs([]);
      }
    } catch (error) {
      logger.error('Failed to fetch cloud images:', error);
      setAvailableISOs([]);
    } finally {
      setIsLoadingISOs(false);
    }
  };

  const handleFileChange = (index: number, file: File | null) => {
    if (!file) return;

    const newFiles = [...uploadFiles];
    const expectedExtension = newFiles[index].type === 'cert' ? '.crt' : '.key';

    if (!file.name.toLowerCase().endsWith(expectedExtension)) {
      alert(`Please select a ${expectedExtension} file`);
      return;
    }

    newFiles[index] = {
      ...newFiles[index],
      file: file,
      name: file.name,
    };
    setUploadFiles(newFiles);
  };

  const handleUpload = async () => {
    const certFile = uploadFiles.find((f) => f.type === 'cert')?.file;
    const keyFile = uploadFiles.find((f) => f.type === 'key')?.file;

    if (!certFile || !keyFile) {
      alert('Please select both .crt and .key files');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('cert', certFile);
      formData.append('key', keyFile);

      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/sidero/uploadtls`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      setUploadSuccess(true);

      // Auto close after successful upload
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      logger.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const isUploadReady = uploadFiles.every((f) => f.file !== null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [statusLogs]);

  // Fetch Omni dashboard URL when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchOmniDashboardUrl();
    }
  }, [isOpen]);

  // Cleanup WebSocket when modal closes
  useEffect(() => {
    return () => {
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        socketRef.current.close(1000, 'Modal closed');
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, []);

  const renderMainView = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Provision VM with Omni ISO</h2>
        <p className="text-gray-600">Choose an action to configure your Omni environment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleKeycloakClick}
          className="p-6 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 text-left group"
        >
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200">
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
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3.586l4.293-4.293A6 6 0 0118 9z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Keycloak</h3>
              <p className="text-sm text-gray-600">Setup and configure Keycloak authentication</p>
            </div>
          </div>
        </button>

        <button
          onClick={handleOmniDashboardClick}
          className="p-6 border-2 border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all duration-200 text-left group"
        >
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Omni Dashboard</h3>
              <p className="text-sm text-gray-600">Access the Omni management dashboard</p>
            </div>
          </div>
        </button>
      </div>

      {/* Create New Omni Cluster Section */}
      <div className="border-t border-gray-200 pt-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Omni Cluster</h3>
          <p className="text-sm text-gray-600 mb-6">Configure your Omni VM cluster settings</p>

          <div className="space-y-4">
            {/* Cluster Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cluster Name <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-l-md">
                  om-
                </span>
                <input
                  type="text"
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value)}
                  placeholder="cluster name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Attach IMG */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attach IMG <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedISO}
                onChange={(e) => setSelectedISO(e.target.value)}
                onClick={() => {
                  // Fetch cloud images when user clicks on the dropdown
                  if (availableISOs.length === 0 && !isLoadingISOs) {
                    fetchISOs();
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                disabled={isLoadingISOs}
              >
                <option value="">
                  {isLoadingISOs ? 'Loading Cloud Images...' : 'Select Cloud Image'}
                </option>
                {availableISOs.map((iso, index) => (
                  <option key={index} value={iso}>
                    {iso}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Create Omni VM Section */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-semibold text-gray-900">Create Omni VM</h4>
              <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Add VM
              </button>
            </div>

            <div className="flex justify-between items-center">
              <button className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!clusterName.trim() || !selectedISO}
              >
                Create Omni VMs
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderKeycloakView = () => (
    <div className="space-y-4">
      {/* Connection Status Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Keycloak Setup Service</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          ></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* WebSocket Messages Container */}
      <div
        ref={scrollContainerRef}
        className="border border-gray-300 rounded-lg p-4 bg-white max-h-96 overflow-y-auto"
      >
        <div className="text-sm space-y-2">
          {statusLogs.length === 0 ? (
            <div className="text-gray-500 italic">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Waiting for Keycloak setup messages...</span>
              </div>
            </div>
          ) : (
            statusLogs.map((log) => (
              <div
                key={log.id}
                className={`flex flex-col ${
                  log.isError
                    ? 'text-red-600'
                    : log.isSystemMessage
                      ? 'text-blue-600'
                      : 'text-black'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 text-xs mt-0.5 font-mono whitespace-nowrap">
                    {log.timestamp}
                  </span>
                  <span className="flex-1 break-words">{log.message}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          onClick={() => setCurrentView('main')}
          className="px-6 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Back to Main
        </button>
      </div>
    </div>
  );

  const renderUploadView = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload TLS Certificates</h2>
        <p className="text-gray-600">
          Please upload your .crt and .key files to complete the setup
        </p>
      </div>

      {uploadSuccess ? (
        <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-900 mb-2">Upload Successful!</h3>
          <p className="text-green-700">
            TLS certificates uploaded successfully. This window will close automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File Upload Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {uploadFiles.map((uploadFile, index) => (
              <div
                key={index}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
              >
                <input
                  type="file"
                  id={`file-${index}`}
                  accept={uploadFile.type === 'cert' ? '.crt' : '.key'}
                  onChange={(e) => handleFileChange(index, e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor={`file-${index}`} className="cursor-pointer">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg
                      className="w-6 h-6 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {uploadFile.type === 'cert' ? 'Certificate File (.crt)' : 'Key File (.key)'}
                  </h3>
                  {uploadFile.file ? (
                    <p className="text-sm text-green-600 font-medium">{uploadFile.name}</p>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Click to select {uploadFile.type === 'cert' ? '.crt' : '.key'} file
                    </p>
                  )}
                </label>
              </div>
            ))}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-blue-700">Uploading certificates...</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between gap-4">
            <button
              onClick={() => setCurrentView('main')}
              className="px-6 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isUploading}
            >
              Back to Main
            </button>

            <button
              onClick={handleUpload}
              disabled={!isUploadReady || isUploading}
              className={`px-6 py-2 text-sm rounded-md transition-colors ${
                isUploadReady && !isUploading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isUploading ? 'Uploading...' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderCurrentView = () => {
    switch (currentView) {
      case 'keycloak':
        return renderKeycloakView();
      case 'upload':
        return renderUploadView();
      default:
        return renderMainView();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Provision VM with Omni ISO" width="800px">
      {renderCurrentView()}
    </Modal>
  );
}
