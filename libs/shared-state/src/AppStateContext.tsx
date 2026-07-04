import React, {
  useReducer,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
  ChangeEvent,
  FormEvent,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import jwt_decode from 'jwt-decode';
import envConfig from '../../../runtime-config';
import { logger } from './utils/logger';
import { AppStateContext } from './AppStateContextInstance';
export { AppStateContext } from './AppStateContextInstance';

// Import TypeScript types
import {
  AppStateContextType,
  AppStateProviderProps,
  WebSocketOptions,
  JwtPayload,
  FormChangeEvent,
  RegisterUserForm,
  FormErrors,
} from './types/AppStateContext.types';

// Extended WebSocket interface to include custom properties
interface ExtendedWebSocket extends WebSocket {
  manualClose?: boolean;
}

// Import utility files
import { initialState } from './utils/initialState';
import { ActionTypes } from './utils/actionTypes';
import appReducer from './utils/reducer';
import api from './utils/interceptor';
import { fetchNodeTopInfo } from './utils/landingPageApiService';

import {
  fetchObservabilityServicesStatus,
  startObservabilityService,
  stopObservabilityService,
  restartObservabilityService,
  launchGrafanaDashboard,
} from './utils/observabilityApiService';
import {
  fetchNodeStatsHistory,
  fetchNodeStatsRecommendations,
  fetchHistoricalVmStats,
} from './utils/DcStatsApiService';
import { fetchVMRecommendations } from './utils/vmRecommendationsApiService';
import {
  fetchObservabilityEvents,
  fetchComponentTypes,
  approveObservabilityEvent,
  rejectObservabilityEvent,
  updateObservabilityFilters,
  setObservabilityPagination,
} from './utils/observabilityApiService';
import {
  fetchObservabilityActivityLogs,
  fetchObservabilityComponentTypes,
  approveObservabilityActivityEvent,
  rejectObservabilityActivityEvent,
  updateObservabilityActivityFilters,
  setObservabilityActivityPagination,
} from './utils/observabilityEventsApiService';
import {
  fetchServerInventory,
  fetchServerSystemInfo,
  fetchServerAddinCards,
  fetchServerStorageCards,
} from './utils/serverApiService';
import {
  // Main app state functions
  fetchInitialDataCenters as fetchDataCenters,
  fetchVMsForServer as fetchVMsForSpecificServer,
  performVmAction,
  renameVmInContext as renameVm,
  cloneVmInContext as cloneVm,
  checkNodeStatuses as checkStatuses,
  fetchVMs,
  setConfiguredNodes as setNodes,
  setupVmWebSocket,
  setupVmListWebSocket,
  handleUrlBasedStateUpdates,
  handleAdminPageChange as adminPageChange,

  // DataCenter specific functions
  fetchInventory,
  pingNode,

  // Navigation
  setDataCenterView,
  setServerView,

  // Role Management functions
  fetchRoles,
  fetchPermissions,
  setRoleForm,
  resetRoleForm,
  setEditingRoleId,
  handlePermissionChange,
  submitRole,
  deleteRole,
  editRole,

  // User Management functions
  fetchUsers,
  registerUser,
  deleteUser as removeUser,
  toggleUserStatus,
  updateUserRoles,
  updateUserApprovers as updateUserApproversApi,
  fetchApproversForUser,

  // Authentication functions
  loginUser,
  signupUser,
  verify2FA,

  // Metrics (Observability) functions
  fetchMetricsUid,
  setMetricsViewingPanel,

  // Network Management functions
  fetchNetworkInterfaces,
  fetchSwitches,
  createSwitch,
  deleteSwitch,
  setNetworkDropdown,
  setShowCreateSwitchForm,
  setSwitchName,
  setSelectedInterface,

  // Snapshot Management functions
  fetchSnapshots,
  createSnapshot,
  rollbackSnapshot,
  takeZfsSnapshot,

  // Firewall Management functions
  fetchFirewallRules,
  updateFirewallRules,
  cancelFirewallRevert,
  setFirewallNotification,
  setFirewallRevertCountdown,
  setFirewallId,

  // Logs Management functions
  fetchLogs,
  setLogsLevel,
  setLogsContains,

  // Storage / Disk Attach functions
  fetchStoragePools as apiServiceFetchStoragePools,
  fetchDatastores,
  fetchVmDatastores,
  fetchZfsDatasets,
  fetchVmDisks,
  attachDisk,
  setDiskFormField,

  // ISO Management functions
  fetchIsoList,
  fetchCloudImages,
  downloadIso,
  uploadIso,
  deleteIso,
  setIsoField,
  setUploadProgress,
  setUploadMessage,
  clearUploadState,
  setDownloadProgress,
  setDownloadMessage,
  clearDownloadState,
  setSelectedIso,

  // Datacenter ISO Management functions
  setDcIsoUploadProgress,
  setDcIsoUploadMessage,
  clearDcIsoUploadState,
  setDcIsoDownloadProgress,
  setDcIsoDownloadMessage,
  clearDcIsoDownloadState,
  fetchDcIsoListShared,
  fetchDcCloudImagesListShared,
  reassignDisk,

  // VM Details functions
  fetchVmDetails,

  // VM Hardware Data Management functions
  fetchVmHardwareData,
  getVmHardwareDataCached,
} from './utils/apiService';

// Import VLAN API services
import {
  fetchVLANs,
  fetchVLANDetails,
  fetchVLANAvailableTags,
  fetchVLANStats,
  pingVLAN,
  createVLAN,
  configureVLANIP,
  getVLANDeletionPrompt,
  deleteVLAN,
  resetVLANState,
  setVLANForm,
  clearVLANForm,
} from './utils/networkAPIService';


// ====================================
// Main App State Provider Component
// ====================================
export const AppStateProvider = ({ children }: AppStateProviderProps) => {
  // Main state using reducer
  const [state, dispatch] = useReducer(appReducer, initialState);
  const location = useLocation();

  // ====================================
  // Permissions Context State
  // ====================================
  const [permissions, setPermissions] = useState<Record<string, boolean>>({}); // Empty object - no hardcoded defaults
  const [userName, setUserName] = useState('');
  const [seedUser, setSeedUser] = useState(false);
  // const [requiresApproval, setRequiresApproval] = useState(false);
  // const [approvers, setApprovers] = useState<string[]>([]);

  // Temporary test data for approval flow - REMOVE IN PRODUCTION
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [approvers, setApprovers] = useState<string[]>(['']);

  // ====================================
  // DataCenter Context State
  // ====================================
  const [scannedData, setScannedData] = useState<string>('');
  const pingIntervalsRef = useRef<Record<string, number>>({});

  // ====================================
  // Auth Timer Ref
  // ====================================
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef<boolean>(false);
  const lastRefreshAttemptRef = useRef<number>(0);

  // ====================================
  // WebSocket Context State
  // ====================================
  const [socket, setSocket] = useState<ExtendedWebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [wsMessages, setWsMessages] = useState<any[]>([]);
  const [wsError, setWsError] = useState<Event | null>(null);

  // ====================================
  // Notification WebSocket Context State
  // ====================================
  const [notificationSocket, setNotificationSocket] = useState<WebSocket | null>(null);
  const [notificationIsConnected, setNotificationIsConnected] = useState<boolean>(false);

  // Storage Context State
  const [availableDisks, setAvailableDisks] = useState<any[]>([]);
  const [storagePools, setStoragePools] = useState<any[]>([]);
  const [datastores, setDatastores] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<Record<string, any>>({});
  const [datasetsVersion, setDatasetsVersion] = useState<number>(0); // Track version for forced refreshes
  const [zpoolStatus, setZpoolStatus] = useState<Record<string, any>>({});
  const [deduplicationStatus, setDeduplicationStatus] = useState<Record<string, any>>({});
  const [compressionStatus, setCompressionStatus] = useState<Record<string, any>>({});
  const [selectedView, setSelectedView] = useState<string>('storage_pools');
  const [currentPool, setCurrentPool] = useState<string | null>(null);
  const [selectedDatasetTypes, setSelectedDatasetTypes] = useState<Record<string, any>>({});
  const [selectedDatasetType, setSelectedDatasetType] = useState<string | null>(null);

  // Loading states
  const [loadingDatastores, setLoadingDatastores] = useState<boolean>(false);
  const [loadingDatasets, setLoadingDatasets] = useState<string | null>(null);
  const [deletingPool, setDeletingPool] = useState<string | null>(null);
  const [creatingDataset, setCreatingDataset] = useState<string | null>(null);
  const [creatingZvol, setCreatingZvol] = useState<boolean>(false);
  const [creatingZpool, setCreatingZpool] = useState<boolean>(false);
  const [isTogglingDeduplication, setIsTogglingDeduplication] = useState<Record<string, boolean>>(
    {}
  );
  const [isTogglingCompression, setIsTogglingCompression] = useState<Record<string, boolean>>({});

  // Form states
  const [datasetName, setDatasetName] = useState<string>('');
  const [datasetEncryption, setDatasetEncryption] = useState<boolean>(false);
  const [datasetPassphrase, setDatasetPassphrase] = useState<string>('');
  const [zvolPool, setZvolPool] = useState<string | null>(null);
  const [zvolName, setZvolName] = useState<string>('');
  const [zvolSize, setZvolSize] = useState<number>(1);
  const [compressionValue, setCompressionValue] = useState<string>('lz4');
  const [creatingDatastore, setCreatingDatastore] = useState<boolean>(false);

  // Storage functions
  const fetchAvailableDisks = async (serverIp: string): Promise<void> => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/available_disks`
      );
      const data = await response.json();
      setAvailableDisks(data.available);
    } catch (error) {
      logger.error('Error fetching available disks', error);
    }
  };

  const fetchStoragePools = async (serverIp: string): Promise<any> => {
    try {
      // Use the imported API service function directly
      return await apiServiceFetchStoragePools(serverIp, dispatch);
    } catch (error) {
      logger.error('Error fetching storage pools', error);
    }
  };

  const fetchZpoolStatus = async (serverIp: string, zpool: string): Promise<void> => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/pool_status/${zpool}`
      );
      if (!response.ok) throw new Error(`Failed to fetch status for ${zpool}`);
      const data = await response.json();
      setZpoolStatus((prevState) => ({
        ...prevState,
        [zpool]: data[zpool] || data,
      }));
    } catch (error) {
      logger.error(`Error fetching zpool status for ${zpool}`, error);
    }
  };

  const fetchDatastores = async (serverAddress: string): Promise<void> => {
    return await fetchVmDatastores(serverAddress, dispatch);
  };

  /**
   * Fetch VM datastores from /api/v1/compute/vms/datastores endpoint
   * This is the new shared state approach for VM creation workflows
   * Used by: VmSetup, K8sSetup, K3sSetup, CloudInit, Kubernetes (all distributions)
   */
  const fetchVmDatastoresWrapper = async (serverIp: string): Promise<any> => {
    try {
      return await fetchVmDatastores(serverIp, dispatch);
    } catch (error) {
      logger.error('Error fetching VM datastores', error);
      return null;
    }
  };

  const fetchZfsDatasetWrapper = async (serverIp: string, poolName: string): Promise<any> => {
    try {
      return await fetchZfsDatasets(serverIp, poolName, dispatch);
    } catch (error) {
      logger.error('Error fetching ZFS datasets', error);
      return null;
    }
  };

  const handleDeleteDatastore = async (
    serverAddress: string,
    datastoreName: string,
    approver?: string
  ): Promise<void> => {
    if (datastoreName === 'default') {
      alert('Cannot delete default datastore.');
      return;
    }

    try {
      let url = `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores/remove/${datastoreName}`;
      if (approver) {
        url += `?approver=${encodeURIComponent(approver)}`;
      }

      const response = await api.fetch(url, { method: 'DELETE' });

      if (response.ok) {
        alert(`Datastore "${datastoreName}" deleted successfully.`);
        await fetchDatastores(serverAddress);
      } else {
        alert('Failed to delete datastore. Please try again.');
      }
    } catch (error) {
      logger.error('Error deleting datastore', error);
      alert('An error occurred while deleting the datastore.');
    }
  };

  // Dataset operations
  const fetchDatasets = useCallback(
    async (serverIp: string, poolName: string, type?: string | null): Promise<void> => {
      setCurrentPool(poolName);
      setLoadingDatasets(poolName);
      setCreatingDataset(null);
      setZvolPool(null);

      try {
        let url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/list?pool=${poolName}`;
        if (type) {
          url += `&type=${type}`;
        }

        const response = await api.fetch(url);
        const data = await response.json();

        // Force a refresh by incrementing the version
        setDatasetsVersion((prevVersion) => prevVersion + 1);

        // Update datasets with fresh data
        setDatasets((prev) => ({ ...prev, [poolName]: data }));

        // Extract dedup and compression status from the response
        // These are now included in the /storage/zfs/list [get] response
        data.forEach((dataset: any) => {
          if (dataset.dedup !== undefined) {
            setDeduplicationStatus((prev) => ({
              ...prev,
              [dataset.name]: dataset.dedup.toLowerCase() === 'on',
            }));
          }
          if (dataset.compression !== undefined) {
            setCompressionStatus((prev) => ({
              ...prev,
              [dataset.name]: dataset.compression.toLowerCase() !== 'off',
            }));
          }
        });
      } catch (error) {
        logger.error(`Error fetching datasets for ${poolName}`, error);
        setDatasets((prev) => ({ ...prev, [poolName]: [] }));
      } finally {
        setLoadingDatasets(null);
      }
       
    },
    []
  );

  const createDataset = async (
    serverIp: string,
    poolName: string,
    datasetName: string,
    encryption?: boolean,
    passphrase?: string
  ): Promise<void> => {
    if (!datasetName) {
      alert('Please enter a dataset name.');
      return;
    }

    // Validate encryption passphrase if encryption is enabled
    if (encryption && (!passphrase || passphrase.length < 8)) {
      alert('Please enter a passphrase with at least 8 characters for encryption.');
      return;
    }

    setCreatingDataset(poolName);
    try {
      // Prepare request body
      const requestBody: any = {
        zpool_name: poolName,
        dataset_name: datasetName,
      };

      // Add encryption fields if encryption is enabled
      if (encryption && passphrase) {
        requestBody.encryption = true;
        requestBody.passphrase = passphrase;
      }

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/create_dataset`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData?.error || 'Failed to create dataset.');
        return;
      }

      const responseData = await response.json();
      alert(responseData?.status || 'Dataset created successfully.');

      // Clear form fields
      setDatasetName('');
      setDatasetEncryption(false);
      setDatasetPassphrase('');

      // Refresh datasets with filesystem type filter to show the newly created dataset
      await fetchDatasets(serverIp, poolName, 'filesystem');
      // Update the selectedDatasetTypes to show the filesystem type
      setSelectedDatasetTypes((prev) => ({ ...prev, [poolName]: 'filesystem' }));
    } catch (error) {
      logger.error('Error creating dataset', error);
      alert('Failed to create dataset.');
    } finally {
      setCreatingDataset(null);
    }
  };

  const unloadDatasetKey = async (
    serverIp: string,
    datasetName: string,
    zpoolName: string
  ): Promise<boolean> => {
    try {
      const requestBody = {
        dataset_name: datasetName,
        zpool_name: zpoolName,
      };

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/unload_key`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData?.error || 'Failed to unload dataset key.');
        return false;
      }

      const responseData = await response.json();
      alert(responseData?.status || 'Dataset key unloaded successfully.');

      // Refresh the datasets to get updated key status
      await fetchDatasets(serverIp, zpoolName);

      return true;
    } catch (error) {
      logger.error('Error unloading dataset key', error);
      alert('Failed to unload dataset key.');
      return false;
    }
  };

  const loadDatasetKey = async (
    serverIp: string,
    datasetName: string,
    zpoolName: string,
    passphrase: string
  ): Promise<boolean> => {
    try {
      if (!passphrase || passphrase.length < 8) {
        alert('Please enter a passphrase with at least 8 characters.');
        return false;
      }

      const requestBody = {
        dataset_name: datasetName,
        zpool_name: zpoolName,
        encryption: true,
        passphrase: passphrase,
      };

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/load_key`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData?.error || 'Failed to load dataset key.');
        return false;
      }

      const responseData = await response.json();
      alert(responseData?.status || 'Dataset key loaded successfully.');

      // Refresh the datasets to get updated key status
      await fetchDatasets(serverIp, zpoolName);

      return true;
    } catch (error) {
      logger.error('Error loading dataset key', error);
      alert('Failed to load dataset key.');
      return false;
    }
  };

  const deleteDataset = async (
    serverIp: string,
    poolName: string,
    datasetName: string,
    approver?: string
  ): Promise<boolean> => {
    // Skip confirmation as it's already confirmed in the DatasetItem component
    try {
      // Determine if we're deleting a ZVOL or regular dataset
      const isZvol = datasetName.includes('zvol/');

      const requestBody = {
        dataset_name: datasetName,
        pool_name: poolName,
      };

      let url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/destroy_dataset`;
      if (approver) {
        url += `?approver=${encodeURIComponent(approver)}`;
      }

      const response = await api.fetch(url, {
        method: 'DELETE',
        body: JSON.stringify(requestBody),
      });
      if (response.ok) {
        // MODIFICATION: Commented out alert for cleaner UX - dataset disappears immediately from UI
        // Original code: alert("Dataset deleted successfully.");
        // Uncomment the line above if you want to show success notification

        // Determine the dataset type that was deleted
        // Check if there was an explicit dataset type selected for this pool
        const currentType = selectedDatasetTypes[poolName] || null;

        // First, update the local state to make UI responsive
        setDatasets((prevDatasets) => {
          const updatedDatasets = { ...prevDatasets };
          if (updatedDatasets[poolName]) {
            updatedDatasets[poolName] = updatedDatasets[poolName].filter(
              (dataset: any) => dataset.name !== datasetName
            );
          }
          return updatedDatasets;
        });

        // Force version increment to trigger re-renders
        setDatasetsVersion((prev) => prev + 1);

        // If we deleted a ZVOL, make sure we're still showing volumes
        const typeToFetch = isZvol ? 'volume' : currentType;

        // Then fetch the latest data from server to ensure we're in sync
        await fetchDatasets(serverIp, poolName, typeToFetch);

        // If we deleted a ZVOL, ensure we're still showing volumes in the filter
        if (isZvol) {
          setSelectedDatasetTypes((prev) => ({ ...prev, [poolName]: 'volume' }));
        }

        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Dataset deletion failed', errorData);
        alert(errorData?.error || 'Failed to delete dataset.');
        return false;
      }
    } catch (error) {
      logger.error('Error deleting dataset', error);
      alert(`Failed to delete dataset: ${error.message}`);
      return false;
    }
  };

  const fetchDeduplicationStatus = async (serverIp: string, datasetName: string): Promise<void> => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/get_dedup?dataset=${datasetName}`
      );
      if (response.ok) {
        const data = await response.json();
        setDeduplicationStatus((prev) => ({
          ...prev,
          [datasetName]: data.value.toLowerCase() === 'on',
        }));
      }
    } catch (error) {
      logger.error(`Error fetching deduplication status for ${datasetName}`, error);
    }
  };

  const fetchCompressionStatus = async (serverIp: string, datasetName: string): Promise<void> => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/get_compression?dataset=${datasetName}`
      );
      if (response.ok) {
        const data = await response.json();
        setCompressionStatus((prev) => ({
          ...prev,
          [datasetName]: data.value.toLowerCase() === 'lz4',
        }));
      }
    } catch (error) {
      logger.error(`Error fetching compression status for ${datasetName}`, error);
    }
  };

  const fetchAllDeduplicationStatuses = async (
    serverIp: string,
    datasets: any[]
  ): Promise<void> => {
    const statusPromises = datasets.map((dataset) =>
      fetchDeduplicationStatus(serverIp, dataset.name)
    );
    await Promise.all(statusPromises);
  };

  const handleDeduplicationToggle = async (
    serverIp: string,
    datasetName: string,
    _poolName?: string
  ): Promise<void> => {
    setIsTogglingDeduplication((prev) => ({ ...prev, [datasetName]: true }));

    try {
      const newStatus = deduplicationStatus[datasetName] ? 'off' : 'on';
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/set_dedup`,
        {
          method: 'POST',
          body: JSON.stringify({
            dataset: datasetName,
            Deduplication: newStatus,
          }),
        }
      );

      if (response.ok) {
        // Update only the specific dataset's deduplication status
        setDeduplicationStatus((prev) => ({
          ...prev,
          [datasetName]: newStatus === 'on',
        }));

        alert(`Deduplication turned ${newStatus.toUpperCase()} successfully.`);
      } else {
        alert(`Failed to turn ${newStatus.toUpperCase()} deduplication.`);
      }
    } catch (error) {
      logger.error(`Error toggling deduplication for ${datasetName}`, error);
      alert('An error occurred while toggling deduplication.');
    } finally {
      setIsTogglingDeduplication((prev) => ({ ...prev, [datasetName]: false }));
    }
  };

  const handleCompressionToggle = async (
    serverIp: string,
    datasetName: string,
    _poolName?: string
  ): Promise<void> => {
    setIsTogglingCompression((prev) => ({ ...prev, [datasetName]: true }));

    try {
      const newStatus = compressionStatus[datasetName] ? 'off' : 'lz4';
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/set_compression`,
        {
          method: 'POST',
          body: JSON.stringify({
            dataset: datasetName,
            compression: newStatus,
          }),
        }
      );

      if (response.ok) {
        // Update only the specific dataset's compression status
        setCompressionStatus((prev) => ({
          ...prev,
          [datasetName]: newStatus === 'lz4',
        }));

        alert(`Compression turned ${newStatus.toUpperCase()} successfully.`);
      } else {
        alert(`Failed to turn ${newStatus.toUpperCase()} compression.`);
      }
    } catch (error) {
      logger.error(`Error toggling compression for ${datasetName}`, error);
      alert('An error occurred while toggling compression.');
    } finally {
      setIsTogglingCompression((prev) => ({ ...prev, [datasetName]: false }));
    }
  };

  const createZpool = async (serverIp, poolName, disks, raidLevel) => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/create_pool`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: poolName,
            disks,
            raid_level: raidLevel,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create zpool');
      }

      // Refresh storage pools
      await fetchStoragePools(serverIp);
      alert('Zpool created successfully!');
      return true;
    } catch (error) {
      logger.error('Error creating zpool', error);
      alert('Failed to create zpool.');
      return false;
    }
  };

  const deletePool = async (serverIp, poolName, approver?: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the pool "${poolName}"? This action cannot be undone.`
      )
    ) {
      return false;
    }

    setDeletingPool(poolName);
    try {
      let url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/destroy_pool/${poolName}`;
      if (approver) {
        url += `?approver=${encodeURIComponent(approver)}`;
      }

      const response = await api.fetch(url, { method: 'DELETE' });

      if (response.ok) {
        alert(`Pool "${poolName}" deleted successfully.`);
        // Refresh pool list
        await fetchStoragePools(serverIp);
        return true;
      } else {
        alert('Failed to delete pool. Please try again.');
        return false;
      }
    } catch (error) {
      logger.error('Error deleting pool', error);
      alert('An error occurred while deleting the pool.');
      return false;
    } finally {
      setDeletingPool(null);
    }
  };

  const createZvol = async (serverIp, poolName, zvolName, size) => {
    // Set state to indicate ZVOL creation in progress
    setCreatingZvol(true);
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/create_zvol`,
        {
          method: 'POST',
          body: JSON.stringify({
            zpool_name: poolName,
            zvol_name: zvolName,
            size: size,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('ZVOL creation failed', errorData);
        throw new Error(errorData?.error || 'Failed to create zvol');
      }

      alert('Zvol created successfully!');

      // Force version increment to trigger re-renders
      setDatasetsVersion((prev) => prev + 1);

      // Refresh datasets for this pool and set the type to "volume" to show the newly created ZVOL
      await fetchDatasets(serverIp, poolName, 'volume');

      // Update the selectedDatasetTypes to show the volume type
      setSelectedDatasetTypes((prev) => ({ ...prev, [poolName]: 'volume' }));
      return true;
    } catch (error) {
      logger.error('Error creating zvol', error);
      alert(`Failed to create zvol: ${error.message}`);
      return false;
    } finally {
      // Reset ZVOL creation state
      setCreatingZvol(false);
      // Reset the ZVOL pool to close the form
      setZvolPool(null);
    }
  };

  const normalizeValue = (value) => {
    const units = {
      K: 1024,
      M: 1024 * 1024,
      G: 1024 * 1024 * 1024,
      T: 1024 * 1024 * 1024 * 1024,
    };

    if (typeof value !== 'string') return value;

    const match = value.match(/^(\d+(?:\.\d+)?)\s*([KMGT])?/i);
    if (!match) return parseFloat(value);

    const [, num, unit] = match;
    const multiplier = unit ? units[unit.toUpperCase()] : 1;
    return parseFloat(num) * multiplier;
  };

  // ====================================
  // Authentication Functions & Effects
  // ====================================

  // Validate access token
  //SM
  const validateToken = (token: string): boolean => {
    try {
      const decodedToken = jwt_decode<JwtPayload>(token);
      const expiryTime = decodedToken.exp ? decodedToken.exp * 1000 : 0; // Convert to milliseconds
      const currentTime = Date.now();
      return expiryTime > currentTime;
    } catch (error) {
      logger.error('Error validating token', error);
      return false;
    }
  };

  // Clear all authentication data
  const clearAllAuthData = (): void => {
    // Clear access token from localStorage
    localStorage.removeItem('accessToken');
    // Clear refresh token from localStorage for 2FA security requirement
    localStorage.removeItem('refreshToken');
    // sessionStorage.clear(); // if using sessionStorage for auth data
  };

  // Function to refresh access token
  //SM
  const refreshAccessToken = async (): Promise<boolean> => {
    // Prevent multiple simultaneous refresh attempts
    if (isRefreshingRef.current) {
      return false;
    }
    isRefreshingRef.current = true;

    try {
      const refreshToken = localStorage.getItem('refreshToken');

      // If no refresh token exists, immediately fail and logout
      if (!refreshToken || refreshToken === 'undefined') {
        handleSessionExpired();
        return false;
      }

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/refresh`,
        {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.access_token) {
        // Update access token in localStorage
        localStorage.setItem('accessToken', data.access_token);

        try {
          // Update permissions from the new token
          const decodedToken = jwt_decode<JwtPayload>(data.access_token);
          const userPermissions = decodedToken.permissions || [];
          const username = decodedToken.username || '';
          const requiresApproval = decodedToken.requires_approval || false;
          const approversList = decodedToken.approvers || [];

          // Convert array of permission strings to an object
          const permissionsObject = userPermissions.reduce((obj: any, perm: string) => {
            obj[perm] = true;
            return obj;
          }, {}); // Empty object - no hardcoded defaults

          setPermissions(permissionsObject);
          setUserName(username);
          setRequiresApproval(requiresApproval);
          setApprovers(approversList);
          dispatch({ type: ActionTypes.LOGIN_SUCCESS });
          return true;
        } catch (error) {
          logger.error('Error decoding refreshed token', error);
          return false;
        }
      } else if (response.status === 401) {
        // Refresh token is expired
        handleSessionExpired();
        return false;
      } else {
        logger.error('Failed to refresh token', data.error || 'Unknown error');
        handleSessionExpired();
        return false;
      }
    } catch (error) {
      logger.error('Error refreshing access token', error);
      if (error.response?.status === 401) {
        handleSessionExpired();
      }
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  };

  // Handle expired session
  //SM
  const handleSessionExpired = () => {
    clearAllAuthData();

    dispatch({ type: ActionTypes.LOGOUT });

    //
    setPermissions({}); // Empty object - no hardcoded defaults

    // Clear user info
    setUserName('');
    setSeedUser(false);
    setRequiresApproval(false);
    setApprovers([]);

    // Clear timer
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }

    // Reset refresh flag and last attempt time
    isRefreshingRef.current = false;
    lastRefreshAttemptRef.current = 0;

    // Navigate to login page if user acknowledged
    navigate('/login');
  };

  // SM
  // Check refresh token expiry (now using the refresh endpoint directly)
  const checkRefreshTokenExpiry = async () => {
    try {
      // Since the refresh token is in an HTTP-only cookie,
      // we can't decode it directly. Instead, we attempt a refresh.
      const result = await refreshAccessToken();
      return result; // Returns true if refresh was successful
    } catch (error) {
      logger.error('Error checking refresh token expiry', error);
      return false;
    }
  };

  //sm
  // Logout function
  const handleLogout = () => {
    // Clear all authentication data
    clearAllAuthData();

    // Clear token refresh timer if it exists
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }

    // Reset refresh flag and last attempt time
    isRefreshingRef.current = false;
    lastRefreshAttemptRef.current = 0;

    // Clear access token from localStorage
    localStorage.removeItem('accessToken');
    // Clear refresh token from localStorage for 2FA security requirement
    localStorage.removeItem('refreshToken');

    // Make a request to clear the HTTP-only refresh token cookie on the server
    // api.fetch(`${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/logout`, {
    //   method: 'POST',
    //   credentials: 'include'
    // }).catch(error => {
    //   logger.error("Error during logout:", error);
    // });

    dispatch({ type: ActionTypes.LOGOUT });
    // Set auth loading to false after logout to prevent stuck loading screen
    dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: false });
    // setPermissions({
    //   VM_VIEW: false,
    //   VM_MANAGE: false,
    //   VM_BACKUP: false,
    //   NETWORK_VIEW: false,
    //   NETWORK_MANAGE: false,
    //   ZFS_VIEW: false,
    //   ZFS_MANAGE: false,
    //   UM_ADMIN: false,
    //   LOGS_VIEW: false
    // });
    setPermissions({}); // Empty object - no hardcoded defaults

    setUserName('');
    setSeedUser(false); // Reset seedUser state on logout
    setRequiresApproval(false);
    setApprovers([]);

    // Navigate to login page
    navigate('/login');
  };
  //SM

  // Around line 2150-2200, after the fetchVMsWebSocket function

  // Function to fetch global VM list via WebSocket for real-time updates
  const fetchGlobalVmList = useCallback(async () => {
    return new Promise((resolve, reject) => {
      try {
        // Set loading state
        dispatch({ type: ActionTypes.FETCH_GLOBAL_VM_LIST_START });

        const authToken = localStorage.getItem('accessToken');
        // Use WebSocket protocol for real-time VM list updates
        const wsUrl = `${envConfig().WS_PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list/ws?token=${authToken}`;

        logger.info('[fetchGlobalVmList] Connecting to WebSocket:', wsUrl);

        // Create WebSocket connection for real-time VM list
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          logger.info('[fetchGlobalVmList] WebSocket connection established');
        };

        ws.onmessage = (event) => {
          try {
            const wsData = JSON.parse(event.data);

            // Transform the data to match expected format
            let vmList = [];

            if (Array.isArray(wsData)) {
              vmList = wsData;
            } else if (wsData.vms && Array.isArray(wsData.vms)) {
              vmList = wsData.vms;
            } else if (typeof wsData === 'object' && !Array.isArray(wsData)) {
              vmList = Object.values(wsData);
            }

            // Map to consistent format
            const vms = vmList.map((vm: any, index: number) => ({
              id: vm.uuid || `vm-${index}`,
              name: vm.name,
              datastore: vm.datastore,
              state: vm.state,
              uuid: vm.uuid,
              isOn: vm.state === 'Running',
            }));

            // Dispatch success with VM data
            dispatch({
              type: ActionTypes.FETCH_GLOBAL_VM_LIST_SUCCESS,
              payload: vms,
            });

            logger.info(
              `[fetchGlobalVmList] Successfully received ${vms.length} VMs from WebSocket`
            );

            // Close WebSocket after receiving data (optional - depends on your use case)
            // ws.close();

            resolve(vms);
          } catch (parseError) {
            logger.error('[fetchGlobalVmList] Error parsing WebSocket data:', parseError);
            reject(parseError);
          }
        };

        ws.onerror = (error) => {
          logger.error('[fetchGlobalVmList] WebSocket error:', error);
          dispatch({
            type: ActionTypes.FETCH_GLOBAL_VM_LIST_SUCCESS,
            payload: 'WebSocket connection error',
          });
          reject(error);
        };

        ws.onclose = (event) => {
          logger.info(
            `[fetchGlobalVmList] WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`
          );
        };
      } catch (error) {
        logger.error('[fetchGlobalVmList] Error creating WebSocket:', error);
        dispatch({
          type: ActionTypes.FETCH_GLOBAL_VM_LIST_SUCCESS,
          payload: error.message,
        });
        reject(error);
      }
    });
  }, [dispatch]);
  // Handle login
  const handleLogin = async (e) => {
    if (e) e.preventDefault();

    const result = await loginUser(state.loginForm, dispatch);

    if (result.success) {
      if (result.requires_2fa) {
        // Extract user info from access_token for immediate display
        const accessToken = result.data.access_token;
        if (accessToken) {
          try {
            const decodedToken = jwt_decode<JwtPayload>(accessToken);
            const username = decodedToken.username || '';

            // Set username immediately so it appears in navbar
            setUserName(username);
          } catch (error) {
            logger.error('Error decoding access token', error);
          }
        }

        set2FARequired(true);
        return result;
      } else {
        // No 2FA required - complete login process
        const token = result.data.jwt_token;

        try {
          const decodedToken = jwt_decode<JwtPayload>(token);
          const userPermissions = decodedToken.permissions || [];
          const username = decodedToken.username || '';
          const requiresApproval = decodedToken.requires_approval || false;
          const approversList = decodedToken.approvers || [];

          // Convert array of permission strings to an object
          const permissionsObject = userPermissions.reduce((obj: any, perm: string) => {
            obj[perm] = true;
            return obj;
          }, {}); // Empty object - no hardcoded defaults

          // Check if this is a seed user
          const isSeedUser =
            decodedToken.email === 'admin@karios.com' || decodedToken.isSeed === true;
          setSeedUser(isSeedUser);

          setPermissions(permissionsObject);
          setUserName(username);
          setRequiresApproval(requiresApproval);
          setApprovers(approversList);

          // Set up token refresh before expiry
          setupTokenRefresh(token);

          // Mark as authenticated since no 2FA is required
          dispatch({ type: ActionTypes.SET_2FA_COMPLETED, payload: true });

          navigate('/');
        } catch (error) {
          logger.error('Error decoding token:', error);
        }
      }
    }

    return result;
  };

  // Handle 2FA verification
  const handle2FAVerification = async (twoFactorCode) => {
    const result = await verify2FA(twoFactorCode, dispatch);

    if (result.success) {
      const token = result.data.jwt_token;

      try {
        const decodedToken = jwt_decode<JwtPayload>(token);
        const userPermissions = decodedToken.permissions || [];
        const username = decodedToken.username || '';
        const requiresApproval = decodedToken.requires_approval || false;
        const approversList = decodedToken.approvers || [];

        // Convert array of permission strings to an object
        const permissionsObject = userPermissions.reduce((obj: any, perm: string) => {
          obj[perm] = true;
          return obj;
        }, {}); // Empty object - no hardcoded defaults

        // Check if this is a seed user
        const isSeedUser =
          decodedToken.email === 'admin@karios.com' || decodedToken.isSeed === true;
        setSeedUser(isSeedUser);

        setPermissions(permissionsObject);
        setUserName(username);
        setRequiresApproval(requiresApproval);
        setApprovers(approversList);

        // Set up token refresh before expiry
        setupTokenRefresh(token);

        setTimeout(() => {
          navigate('/');
        }, 100);
      } catch (error) {
        logger.error('Error decoding token after 2FA', error);
      }
    }

    return result;
  };

  // Update signup form
  const updateSignupForm = (formData) => {
    dispatch({ type: ActionTypes.UPDATE_SIGNUP_FORM, payload: formData });
  };

  // Handle signup form field change
  const handleSignupFormChange = (e) => {
    const { name, value } = e.target;
    updateSignupForm({ ...state.signupForm, [name]: value });
  };

  // Set signup errors
  const setSignupErrors = (errors) => {
    dispatch({ type: ActionTypes.SET_SIGNUP_ERRORS, payload: errors });
  };

  // Validate signup form
  const validateSignupForm = (): boolean => {
    const { email, password, confirmPassword, first_name, last_name } = state.signupForm;
    const newErrors: FormErrors = {};

    // Name validation pattern (only letters, accented characters, apostrophes, hyphens, 1-50 chars)
    const namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ''-]{1,50}$/;

    // Email validation pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Password validation pattern (8+ chars, 1 number, 1 uppercase, 1 special char)
    const passwordPattern = /^(?=.*\d)(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;

    // Validate first name
    if (!namePattern.test(first_name)) {
      newErrors.first_name =
        'First name must contain only letters, accented characters, apostrophes, or hyphens (1-50 characters)';
    }

    // Validate last name
    if (!namePattern.test(last_name)) {
      newErrors.last_name =
        'Last name must contain only letters, accented characters, apostrophes, or hyphens (1-50 characters)';
    }

    // Validate email
    if (!emailPattern.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Validate password
    if (!passwordPattern.test(password)) {
      newErrors.password =
        'Password must contain at least 8 characters, 1 number, 1 uppercase letter, and 1 special character';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setSignupErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  //SM
  // Handle signup
  const handleSignup = async (e?: FormEvent): Promise<any> => {
    if (e) e.preventDefault();

    if (!validateSignupForm()) return { success: false };

    const result = await signupUser(state.signupForm, dispatch);

    if (result.success) {
      navigate('/login');
    }

    return result;
  };

  // Additional Authentication Functions
  const setAdditionalAuthRequired = (required: boolean) => {
    dispatch({ type: ActionTypes.SET_ADDITIONAL_AUTH_REQUIRED, payload: required });
  };

  const setAdditionalAuthCompleted = (completed: boolean) => {
    dispatch({ type: ActionTypes.SET_ADDITIONAL_AUTH_COMPLETED, payload: completed });

    // Navigate to main app when additional auth is completed
    if (completed) {
      setAdditionalAuthRequired(false);
      navigate('/');
    }
  };

  // Two-Factor Authentication Functions
  const set2FARequired = (required: boolean) => {
    dispatch({ type: ActionTypes.SET_2FA_REQUIRED, payload: required });
  };

  const set2FACompleted = (completed: boolean) => {
    dispatch({ type: ActionTypes.SET_2FA_COMPLETED, payload: completed });

    // Navigate to main app when 2FA is completed
    if (completed) {
      set2FARequired(false);
      navigate('/');
    }
  };

  // Clear signup errors
  const clearSignupErrors = () => {
    dispatch({ type: ActionTypes.CLEAR_SIGNUP_ERRORS });
  };

  // SM
  // Setup token refresh timer
  const setupTokenRefresh = (token: string) => {
    try {
      const decodedToken = jwt_decode<JwtPayload>(token);
      const expiryTime = decodedToken.exp ? decodedToken.exp * 1000 : 0; // Convert to milliseconds
      const currentTime = Date.now();
      const timeToRefresh = expiryTime - currentTime - 3 * 60 * 1000; // 3 minutes before expiry
      // Add cooldown to prevent rapid successive refreshs
      const REFRESH_COOLDOWN = 30 * 1000; // 30 seconds cooldown
      const timeSinceLastRefresh = currentTime - lastRefreshAttemptRef.current;

      if (timeToRefresh > 0) {
        // Clear any existing timer
        if (tokenRefreshTimerRef.current) {
          clearTimeout(tokenRefreshTimerRef.current);
        }

        // Set new timer
        tokenRefreshTimerRef.current = setTimeout(() => {
          lastRefreshAttemptRef.current = Date.now();
          refreshAccessToken().then((success) => {
            if (success) {
              const newToken = localStorage.getItem('accessToken');
              if (newToken) {
                setupTokenRefresh(newToken);
              }
            }
          });
        }, timeToRefresh);
      } else {
        // Token is about to expire or already expired
        // Only attempt refresh if not already refreshing AND enough time has passed since last attempt
        if (!isRefreshingRef.current && timeSinceLastRefresh > REFRESH_COOLDOWN) {
          lastRefreshAttemptRef.current = currentTime;

          refreshAccessToken().then((success) => {
            if (success) {
              const newToken = localStorage.getItem('accessToken');
              if (newToken) {
                setupTokenRefresh(newToken);
              }
            } else {
              // If refresh failed, don't retry immediately to prevent infinite loops
              handleLogout();
            }
          });
        }
      }
    } catch (error) {
      logger.error('Error setting up token refresh', error);
    }
  };

  //SM
  // Authentication Effect - Initial Auth Check
  useEffect(() => {
    const checkInitialAuth = async () => {
      // Set loading to true at the start of auth check
      dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: true });

      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      // If no refresh token exists, completely block access and redirect to login
      if (!refreshToken || refreshToken === 'undefined') {
        localStorage.clear(); // Clear any potentially corrupted tokens
        dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: false });
        handleLogout();
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          navigate('/login');
        }
        return;
      }

      // If no access token, redirect to login
      if (!accessToken) {
        dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: false });
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          navigate('/login');
        }
        return;
      }

      // Check if access token is valid
      if (validateToken(accessToken)) {
        try {
          // Token is valid, extract user info and permissions
          const decodedToken = jwt_decode<JwtPayload>(accessToken);
          const userPermissions = decodedToken.permissions || [];
          const username = decodedToken.username || '';
          const requiresApproval = decodedToken.requires_approval || false;
          const approversList = decodedToken.approvers || [];

          // Convert array of permission strings to an object
          const permissionsObject = userPermissions.reduce((obj: any, perm: string) => {
            obj[perm] = true;
            return obj;
          }, {}); // Empty object - no hardcoded defaults

          // Check if this is a seed user
          const isSeedUser =
            decodedToken.email === 'admin@karios.com' || decodedToken.isSeed === true;
          setSeedUser(isSeedUser);

          setPermissions(permissionsObject);
          setUserName(username);
          setRequiresApproval(requiresApproval);
          setApprovers(approversList);
          dispatch({ type: ActionTypes.LOGIN_SUCCESS });

          // Set up token refresh before expiry
          setupTokenRefresh(accessToken);

          dispatch({ type: ActionTypes.SET_ADDITIONAL_AUTH_COMPLETED, payload: true });
          dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: false });
          if (location.pathname === '/login' || location.pathname === '/signup') {
            navigate('/');
          }
        } catch (error) {
          logger.error('Error decoding token', error);
          // Try to refresh token if decoding fails
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: false });
            handleLogout();
            navigate('/login');
          } else {
            dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: false });
          }
        }
      } else {
        logger.info('Access token invalid, attempting to refresh');
        // Try to refresh the token
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: false });
          handleLogout();
          navigate('/login');
        } else {
          // Token refreshed successfully
          const newToken = localStorage.getItem('accessToken');
          if (newToken) {
            setupTokenRefresh(newToken);
          }
          dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: false });
        }
      }
    };

    checkInitialAuth();
    // Cleanup function to clear token refresh timer
    return () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }
      // Reset refresh flag and last attempt time to allow fresh attempts on component remount
      isRefreshingRef.current = false;
      lastRefreshAttemptRef.current = 0;
    };
  }, []);

  // Notification WebSocket connection management
  // ====================================
  useEffect(() => {
    if (state.isAuthenticated) {
      connectNotificationWebSocket();
    } else {
      closeNotificationWebSocket();
    }

    return () => {
      closeNotificationWebSocket();
    };
  }, [state.isAuthenticated]);

  // ====================================
  // Fetch Omni Dashboard URL on app load
  // ====================================
  useEffect(() => {
    if (state.isAuthenticated) {
      // Call the function directly since it will be defined later
      const loadOmniUrl = async () => {
        try {
          const response = await api.fetch(
            `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`
          );

          if (!response.ok) {
            logger.warn('Failed to fetch cluster info for Omni dashboard URL');
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
                dispatch({ type: ActionTypes.SET_OMNI_DASHBOARD_URL, payload: url });
                logger.info('Omni Dashboard URL set to:', url);
                return;
              }
            }

            // If no "omni" cluster found, look for any cluster with "omniserver" VM
            for (const cluster of clusterInfo.clusters) {
              if (cluster.vms && cluster.vms.length > 0) {
                const omniVM = cluster.vms.find((vm: any) => vm.vmName === 'omniserver');
                if (omniVM && omniVM.fqdn) {
                  const url = `https://${omniVM.fqdn}`;
                  dispatch({ type: ActionTypes.SET_OMNI_DASHBOARD_URL, payload: url });
                  logger.info('Omni Dashboard URL set to:', url);
                  return;
                }
              }
            }
          }

          logger.warn('No Omni server found in cluster info');
        } catch (error) {
          logger.error('Error fetching Omni dashboard URL:', error);
        }
      };

      loadOmniUrl();
    }
  }, [state.isAuthenticated]);

  // ====================================
  const updatePermissions = (newPermissions) => {
    setPermissions((prev) => ({
      ...prev,
      ...newPermissions,
    }));
  };

  // ====================================
  // Effect to handle URL-based state updates
  // ====================================
  useEffect(() => {
    handleUrlBasedStateUpdates(location, state, dispatch);
  }, [location, state.dataCenters]);

  // ====================================
  // Effect to fetch initial data centers and VMs when a server is selected
  // ====================================
  useEffect(() => {
    const serverAddress = state.selectedServer?.fqdn || state.selectedServer?.ip;
    if (serverAddress) {
      fetchDataCenters(serverAddress, state, dispatch);
    }
  }, [state.selectedServer?.fqdn, state.selectedServer?.ip]);

  // ====================================
  // Effect to handle component display based on TopNavBar selection
  // ====================================
  useEffect(() => {
    if (state.selected_MainTopBar_Component) {
      dispatch({
        type: ActionTypes.SET_ACTIVE_COMPONENT,
        payload: state.selected_MainTopBar_Component,
      });
    }
  }, [state.selected_MainTopBar_Component]);

  // ====================================
  // DataCenter Context Effects
  // ====================================
  // Effect to monitor nodes in REBOOTING status
  useEffect(() => {
    const rebootingNodes = state.inventory.filter((item) => item.status === 'Rebooting');

    // Clear existing intervals first
    Object.values(pingIntervalsRef.current).forEach((interval) => clearInterval(interval));
    pingIntervalsRef.current = {};

    rebootingNodes.forEach((node) => {
      const pingInterval = setInterval(async () => {
        try {
          const pingSuccessful = await pingNode(node.os_ip);
          if (pingSuccessful) {
            // Get the job context for this node to determine the appropriate action
            const jobType = state.nodeJobContext?.[node.ip];

            logger.info(`Ping successful for ${node.ip}, job context: ${jobType}`);

            // Stop polling
            clearInterval(pingIntervalsRef.current[node.ip]);
            delete pingIntervalsRef.current[node.ip];

            // Clear the job context since we're done with this ping cycle
            dispatch({
              type: ActionTypes.SET_NODE_JOB_CONTEXT,
              payload: {
                ip: node.ip,
                jobType: null,
              },
            });

            // Handle different job types
            if (jobType === 'Provisioning') {
              // After Provision job → Rebooting → Ping success → Set to "Provisioned"
              logger.info(`Setting node ${node.ip} to Provisioned after Provision job`);

              dispatch({
                type: ActionTypes.UPDATE_NODE,
                payload: {
                  ip: node.ip,
                  updates: {
                    status: 'PROVISIONED',
                    stage: 'Provisioned',
                    lastUpdated: getFormattedTimestamp(),
                  },
                },
              });

              // BMC status sync removed - function not available
            } else if (jobType === 'Configuring') {
              // After Configure job → Rebooting → Ping success → Set to "Configured" (backend should handle this)
              logger.info(
                `Node ${node.ip} ping successful after Configure job - letting backend handle final status`
              );

              // Don't set to "Provisioned" again, let the backend determine the final status
              // The backend should transition to "Configured" status
              // Just refresh inventory to get the latest status from backend
              setTimeout(async () => {
                try {
                  await fetchInventory(dispatch);
                  logger.info(`Refreshed inventory for node ${node.ip} after Configure completion`);
                } catch (error) {
                  logger.error(
                    `Error refreshing inventory after Configure completion for ${node.ip}:`,
                    error
                  );
                }
              }, 2000); // Give backend some time to update
            } else {
              // Default behavior for nodes without specific job context (fallback to Provisioned)
              logger.info(`No job context found for ${node.ip}, defaulting to Provisioned`);

              dispatch({
                type: ActionTypes.UPDATE_NODE,
                payload: {
                  ip: node.ip,
                  updates: {
                    status: 'PROVISIONED',
                    stage: 'Provisioned',
                    lastUpdated: getFormattedTimestamp(),
                  },
                },
              });

              // BMC status sync removed - function not available
            }
          }
        } catch {
          logger.info(`Ping failed for ${node.ip}, retrying...`);
        }
      }, 5000);

      // Store interval for cleanup
      pingIntervalsRef.current[node.ip] = pingInterval as unknown as number;
    });
  }, [state.inventory, state.nodeJobContext]);

  // ====================================
  // Helper Functions for AppState
  // ====================================
  // Wrapper functions that inject state and dispatch
  const fetchInitialDataCenters = (currentSelectedServerIp) => {
    return fetchDataCenters(currentSelectedServerIp, state, dispatch);
  };

  const fetchVMsForServer = (server) => {
    return fetchVMsForSpecificServer(server, dispatch, state);
  };

  const fetchOmniDashboardUrl = useCallback(async () => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`
      );

      if (!response.ok) {
        logger.warn('Failed to fetch cluster info for Omni dashboard URL');
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
            dispatch({ type: ActionTypes.SET_OMNI_DASHBOARD_URL, payload: url });
            logger.info('Omni Dashboard URL set to:', url);
            return;
          }
        }

        // If no "omni" cluster found, look for any cluster with "omniserver" VM
        for (const cluster of clusterInfo.clusters) {
          if (cluster.vms && cluster.vms.length > 0) {
            const omniVM = cluster.vms.find((vm: any) => vm.vmName === 'omniserver');
            if (omniVM && omniVM.fqdn) {
              const url = `https://${omniVM.fqdn}`;
              dispatch({ type: ActionTypes.SET_OMNI_DASHBOARD_URL, payload: url });
              logger.info('Omni Dashboard URL set to:', url);
              return;
            }
          }
        }
      }

      logger.warn('No Omni server found in cluster info');
    } catch (error) {
      logger.error('Error fetching Omni dashboard URL:', error);
    }
  }, [dispatch]);

  const performVmActionWrapper = (serverIp, vmName, action, body = null, approver?: string) => {
    logger.info(`[DEBUG] performVmActionWrapper called:`, {
      serverIp,
      vmName,
      action,
      body,
      approver,
      hasApprover: !!approver,
    });
    return performVmAction(serverIp, vmName, action, body, state, dispatch, approver);
  };

  // WebSocket-based VM action for start/stop operations
  const performVmActionWebSocket = (serverAddress, vmName, action, onStatusUpdate, vmUuid) => {
    return new Promise((resolve, reject) => {
      // Create WebSocket URL using UUID instead of vmName
      const authToken = localStorage.getItem('accessToken');
      const identifier = vmName; // Fallback to vmName if uuid not provided
      logger.info(
        `[DEBUG] performVmActionWebSocket - serverAddress: ${serverAddress}, vmName: ${vmName}, vmUuid: ${vmUuid}, identifier: ${identifier}, action: ${action}`
      );
      const wsUrl = `${envConfig().WS_PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${identifier}/action/${action}/ws?token=${authToken}`;
      logger.info(`[DEBUG] performVmActionWebSocket - WebSocket URL: ${wsUrl}`);

      // Create a dedicated WebSocket for this action (not using the shared connectWebSocket)
      const actionWs = new WebSocket(wsUrl);
      let connectionEstablished = false;

      actionWs.onopen = () => {
        connectionEstablished = true;
        logger.info(`VM action WebSocket connected: ${action} ${vmName}`);

        // Call status update to indicate loading state
        if (onStatusUpdate) {
          onStatusUpdate({
            status: `${action}ing VM...`,
            is_final: false,
            error: false,
          });
        }
      };

      actionWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Call the status update callback
          if (onStatusUpdate) {
            onStatusUpdate(data);
          }

          // If this is the final message, resolve or reject based on error status
          if (data.is_final) {
            actionWs.close();
            if (!data.error) {
              // VM action completed successfully - dispatch event to force reconnect all cluster websockets
              logger.info(`[performVmActionWebSocket] VM action ${action} completed for ${vmName} on ${serverAddress}`, {
                vmName,
                action,
                serverAddress,
                status: data.status,
              });
              const reconnectEvent = new CustomEvent('forceClusterReconnect', {
                detail: {
                  vmName,
                  action,
                  serverAddress,
                  timestamp: Date.now(),
                },
              });
              window.dispatchEvent(reconnectEvent);
            }
            if (data.error) {
              reject(new Error(data.status || `Failed to ${action} VM`));
            } else {
              resolve(data);
            }
          }
        } catch (error) {
          logger.error('Error parsing VM action WebSocket message:', error);
          actionWs.close();
          reject(new Error('Failed to parse server response'));
        }
      };

      actionWs.onerror = (error) => {
        logger.error(`VM action WebSocket error for ${action} ${vmName}:`, error);
        reject(new Error(`WebSocket connection failed for ${action} action`));
      };

      actionWs.onclose = (event) => {
        logger.info(`VM action WebSocket closed: ${action} ${vmName}`);
        // Only reject if connection was never established
        if (!connectionEstablished) {
          reject(new Error(`Failed to establish WebSocket connection for ${action} action`));
        }
      };
    });
  };

  // WebSocket-based VM list fetching for real-time updates
  const fetchVMsWebSocket = (server) => {
    const serverAddress = server?.fqdn || server?.ip;
    if (!server || !serverAddress) {
      logger.error('fetchVMsWebSocket called without valid server or server address');
      return;
    }

    logger.info(
      `Starting WebSocket VM list fetch for server: ${server.name} (ID: ${server.id}) at ${serverAddress}`
    );

    // Dispatch loading state
    dispatch({ type: ActionTypes.WEBSOCKET_VM_LIST_START, payload: server.id });

    // Create WebSocket URL
    const authToken = localStorage.getItem('accessToken');
    const wsUrl = `${envConfig().WS_PROTOCOL}://${server.fqdn}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list/ws?token=${authToken}`;

    // Use the shared WebSocket connection function with retry mechanism
    connectWebSocket(wsUrl, {
      onConnect: (ws) => {
        logger.info(`WebSocket connected for VM list on server: ${server.name}`);
      },
      onMessage: (data: any) => {
        try {
          // Transform VM data - handle both array and object responses
          let vmList = [];

          if (Array.isArray(data)) {
            // Direct array response
            vmList = data;
          } else if (data.vms && Array.isArray(data.vms)) {
            // Nested vms array
            vmList = data.vms;
          } else if (typeof data === 'object' && !Array.isArray(data)) {
            // Object with numbered keys (like the example: 1: {name: ...}, 2: {name: ...})
            vmList = Object.values(data);
          }

          const vms = vmList.map((vm, index) => ({
            id: `vm-${index}`,
            name: vm.name,
            datastore: vm.datastore,
            state: vm.state,
            uuid: vm.uuid, // Store the UUID from WebSocket response
            isOn: vm.state === 'Running',
          }));

          // Dispatch success with VM data
          dispatch({
            type: ActionTypes.WEBSOCKET_VM_LIST_UPDATE,
            payload: { serverId: server.id, vms },
          });

          // If this server is currently selected and we have a selected VM, update its details
          if (
            state &&
            state.selectedServer &&
            state.selectedServer.id === server.id &&
            state.selectedVm
          ) {
            const updatedVm = vmList.find((vm) => vm.name === state.selectedVm.name);
            if (updatedVm) {
              dispatch({
                type: ActionTypes.SET_SELECTED_VM,
                payload: {
                  ...state.selectedVm,
                  datastore: updatedVm.datastore,
                  state: updatedVm.state,
                  isOn: updatedVm.state === 'Running',
                },
              });
            }
          }
        } catch (error) {
          logger.error('Error processing WebSocket VM list data:', error);
          dispatch({ type: ActionTypes.WEBSOCKET_VM_LIST_ERROR, payload: server.id });
        }
      },
      onError: (error) => {
        logger.error(`WebSocket error for VM list on server ${server.name}:`, error);
        dispatch({ type: ActionTypes.WEBSOCKET_VM_LIST_ERROR, payload: server.id });
      },
      onClose: (event) => {
        // Don't dispatch error on normal close
      },
      reconnect: true, // Enable auto-reconnect for list fetching
      reconnectInterval: 5000, // Reconnect every 5 seconds
      manualClose: false,
    });
  };

  const renameVmInContext = (serverIp, vmName, datastore, newVmName, approver?: string) => {
    return renameVm(serverIp, vmName, datastore, newVmName, state, dispatch, approver);
  };

  const cloneVmInContext = (serverIp, vmName, datastore, newVmName, approver?: string) => {
    return cloneVm(serverIp, vmName, datastore, newVmName, state, dispatch, approver);
  };

  const checkNodeStatuses = () => {
    return checkStatuses(state, dispatch);
  };

  const fetchVMsWrapper = () => {
    // logger.info("AppStateContext: fetchVMsWrapper called with state:",
    //   state ? `dataCenters: ${state.dataCenters?.length || 0}, servers: ${state.dataCenters?.[0]?.servers?.length || 0}` : "no state");
    return fetchVMs(state, dispatch);
  };

  // Set the active component from MainTopBar
  const setMainTopBarComponent = (component) => {
    dispatch({ type: ActionTypes.SET_SELECTED_MAIN_TOP_BAR_COMPONENT, payload: component });
  };

  // Handle admin page changes
  const handleAdminPageChange = (component) => {
    adminPageChange(component, dispatch);
  };

  // Memoized getVmSnapshots function to prevent unnecessary re-renders
  const getVmSnapshots = useCallback(
    (serverIp: string, vmName: string) => {
      const vmKey = `${serverIp}:${vmName}`;
      return state.vmSnapshots[vmKey] || [];
    },
    [state.vmSnapshots]
  );

  // Memoized snapshot functions to prevent unnecessary re-renders
  const memoizedFetchSnapshots = useCallback(
    (serverIp: string, vmName: string) => {
      return fetchSnapshots(serverIp, vmName, dispatch);
    },
    [dispatch]
  );

  const memoizedCreateSnapshot = useCallback(
    (serverIp: string, vmName: string, snapshotName: string) => {
      return createSnapshot(serverIp, vmName, snapshotName, dispatch);
    },
    [dispatch]
  );

  const memoizedRollbackSnapshot = useCallback(
    (serverIp: string, vmName: string, snapshotName: string) => {
      return rollbackSnapshot(serverIp, vmName, snapshotName, dispatch);
    },
    [dispatch]
  );

  const memoizedTakeZfsSnapshot = useCallback(
    (serverIp: string, datasetName: string, snapshotName: string) => {
      return takeZfsSnapshot(serverIp, datasetName, snapshotName, dispatch);
    },
    [dispatch]
  );

  // ====================================
  // Helper Functions for DataCenter
  // ====================================
  // Helper function for formatted timestamp
  const getFormattedTimestamp = () => {
    const now = new Date();
    return now.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Function to get the full VNC console URL with parameters
  const getVncConsoleUrl = () => {
    const { vncConsoleUrl, vncConsoleOptions } = state;
    if (!vncConsoleUrl) return '';

    // Convert options to URL parameters
    const params = new URLSearchParams();
    Object.entries(vncConsoleOptions || {}).forEach(([key, value]) => {
      params.append(key, String(value));
    });

    return `${vncConsoleUrl}?${params.toString()}`;
  };

  // ====================================
  // WebSocket Helper Functions
  // ====================================
  // WebSocket connect function with retry mechanism
  const connectWebSocket = (
    url: string,
    options: WebSocketOptions = {},
    retryCount: number = 0
  ): WebSocket | undefined => {
    if (!url) return undefined;

    const maxRetries = 2; // Maximum 2 additional retries after initial attempt

    // Close existing connection first
    if (socket) {
      socket.close();
      setSocket(null);
    }

    // Create a new WebSocket connection
    const ws = new WebSocket(url);
    let connectionEstablished = false;

    // Set up event handlers
    ws.onopen = () => {
      connectionEstablished = true;
      setIsConnected(true);
      setWsError(null);
      logger.info('WebSocket connection established:', url);

      // Call the onConnect callback if provided
      if (options.onConnect) options.onConnect(ws);
    };

    ws.onclose = (event) => {
      setIsConnected(false);

      // If connection was closed before being established and we haven't exceeded retries
      if (!connectionEstablished && retryCount < maxRetries) {
        logger.info(
          `WebSocket closed before connection established. Retry attempt ${retryCount + 1}/${maxRetries}`
        );
        setTimeout(
          () => {
            connectWebSocket(url, options, retryCount + 1);
          },
          1000 * (retryCount + 1)
        ); // Exponential backoff: 1s, 2s, 3s
        return;
      }

      // Call the onClose callback if provided
      if (options.onClose) options.onClose(event);

      // Only attempt to reconnect if it's not a manual close and reconnect is enabled
      // Also check if the WebSocket is still the current one to prevent stale reconnections
      // And only if connection was properly established before
      if (options.reconnect && !options.manualClose && ws === socket && connectionEstablished) {
        setTimeout(() => {
          logger.info('Attempting to reconnect...');
          connectWebSocket(url, options, 0); // Reset retry count for reconnection
        }, options.reconnectInterval || 3000);
      }
    };

    ws.onerror = (error) => {
      setWsError(error);
      logger.error('WebSocket error:', error);

      // Call the onError callback if provided
      if (options.onError) options.onError(error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setWsMessages((prevMessages) => [...prevMessages, message]);

        // Call the onMessage callback if provided
        if (options.onMessage) options.onMessage(message);
      } catch (error) {
        logger.error('Error parsing WebSocket message:', error);
      }
    };

    // Save the socket to state
    setSocket(ws);
    return ws;
  };

  // Send a message through the WebSocket
  const sendMessage = (message: any): boolean => {
    if (socket && isConnected) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      socket.send(messageStr);
      return true;
    }
    return false;
  };

  // Close the WebSocket connection
  const closeConnection = () => {
    if (socket) {
      // Mark as manual close to prevent reconnection
      (socket as ExtendedWebSocket).manualClose = true;
      socket.close();
      setSocket(null);
      setIsConnected(false);
    }
  };

  // ====================================
  // Notification WebSocket Functions
  // ====================================
  const connectNotificationWebSocket = () => {
    const authToken = localStorage.getItem('accessToken');
    if (!authToken || !state.isAuthenticated) return;

    const controlNodeConfig = envConfig().CONTROL_NODE_IP;
    const wsUrl = `${envConfig().WS_PROTOCOL}://${controlNodeConfig.URL}${controlNodeConfig.PORT}/api/v1/user/ws?token=${authToken}`;

    logger.info('Establishing notification WebSocket connection to:', wsUrl);

    // Close existing connection first
    if (notificationSocket) {
      notificationSocket.close();
      setNotificationSocket(null);
    }

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      logger.info('Notification WebSocket connected successfully');
      setNotificationSocket(ws);
      setNotificationIsConnected(true);
      dispatch({ type: ActionTypes.NOTIFICATION_WEBSOCKET_CONNECT });
    };

    ws.onmessage = (event) => {
      dispatch({ type: ActionTypes.NOTIFICATION_MESSAGE_RECEIVED, payload: event.data });
    };

    ws.onerror = (error) => {
      logger.error('Notification WebSocket error:', error);
    };

    ws.onclose = (event) => {
      setNotificationSocket(null);
      setNotificationIsConnected(false);
      dispatch({ type: ActionTypes.NOTIFICATION_WEBSOCKET_DISCONNECT });

      // Attempt to reconnect if not intentionally closed and user is still authenticated
      if (event.code !== 1000 && state.isAuthenticated) {
        logger.info('Attempting to reconnect notification WebSocket in 3 seconds...');
        setTimeout(connectNotificationWebSocket, 3000);
      }
    };
  };

  const closeNotificationWebSocket = () => {
    if (notificationSocket) {
      logger.info('Closing notification WebSocket connection');
      notificationSocket.close(1000, 'User logging out');
      setNotificationSocket(null);
      setNotificationIsConnected(false);
      dispatch({ type: ActionTypes.NOTIFICATION_WEBSOCKET_DISCONNECT });
    }
  };

  // ====================================
  // Role Management Functions
  // ====================================
  // Fetch roles and permissions
  const fetchRolesData = () => {
    return fetchRoles(dispatch);
  };

  const fetchPermissionsData = () => {
    return fetchPermissions(dispatch);
  };

  // Handle form changes
  const updateRoleForm = (formData) => {
    setRoleForm(formData, dispatch);
  };

  const clearRoleForm = () => {
    resetRoleForm(dispatch);
  };

  // Handle permission checkbox change
  const togglePermission = (permId, permName) => {
    handlePermissionChange(permId, permName, state.roleForm, dispatch);
  };

  // Submit role (create/update)
  const saveRole = () => {
    return submitRole(state.roleForm, state.editingRoleId, dispatch);
  };

  // Delete a role
  const removeRole = (roleId) => {
    return deleteRole(roleId, dispatch);
  };

  // Edit a role
  const startEditingRole = (role) => {
    editRole(role, dispatch);
  };

  // ====================================
  // User Management Functions
  // ====================================
  // Fetch all users
  const fetchAllUsers = () => {
    return fetchUsers(dispatch);
  };

  // Set selected user for editing
  const setSelectedUser = (user) => {
    dispatch({ type: ActionTypes.SET_SELECTED_USER, payload: user });
  };

  // Toggle edit user modal
  const setEditUserModal = (isOpen) => {
    dispatch({ type: ActionTypes.SET_EDIT_USER_MODAL, payload: isOpen });
  };

  // Toggle register user modal
  const setRegisterUserModal = (isOpen) => {
    dispatch({ type: ActionTypes.SET_REGISTER_USER_MODAL, payload: isOpen });
  };

  // Set user view filter (active/all)
  const setUserViewFilter = (filter) => {
    dispatch({ type: ActionTypes.SET_USER_VIEW_FILTER, payload: filter });
  };

  // Update register user form
  const updateRegisterUserForm = (formData) => {
    dispatch({ type: ActionTypes.UPDATE_REGISTER_USER_FORM, payload: formData });
  };

  // Handle form field change
  const handleRegisterFormChange = (e) => {
    const { name, value } = e.target;
    updateRegisterUserForm({ ...state.registerUserForm, [name]: value });
  };

  // Reset register user form
  const resetRegisterUserForm = () => {
    dispatch({ type: ActionTypes.RESET_REGISTER_USER_FORM });
  };

  // Register a new user
  const createUser = async () => {
    // Validate form fields
    const { username, email, first_name, last_name, password } = state.registerUserForm;

    // Check if all fields are filled
    const allFieldsFilled = [username, email, first_name, last_name, password].every(
      (val) => val.trim() !== ''
    );
    if (!allFieldsFilled) {
      dispatch({
        type: ActionTypes.SET_USER_FORM_ERROR,
        payload: 'Please fill in all fields before registering.',
      });
      return null;
    }

    // Name validation pattern (only letters, accented characters, apostrophes, hyphens, 1-50 chars)
    const namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ''-]{1,50}$/;

    // Email validation pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Password validation pattern (8+ chars, 1 number, 1 uppercase, 1 special char)
    const passwordPattern = /^(?=.*\d)(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;

    // Validate first name
    if (!namePattern.test(first_name)) {
      dispatch({
        type: ActionTypes.SET_USER_FORM_ERROR,
        payload:
          'First name must contain only letters, accented characters, apostrophes, or hyphens (1-50 characters).',
      });
      return null;
    }

    // Validate last name
    if (!namePattern.test(last_name)) {
      dispatch({
        type: ActionTypes.SET_USER_FORM_ERROR,
        payload:
          'Last name must contain only letters, accented characters, apostrophes, or hyphens (1-50 characters).',
      });
      return null;
    }

    // Validate email
    if (!emailPattern.test(email)) {
      dispatch({
        type: ActionTypes.SET_USER_FORM_ERROR,
        payload: 'Please enter a valid email address.',
      });
      return null;
    }

    // Validate password
    if (!passwordPattern.test(password)) {
      dispatch({
        type: ActionTypes.SET_USER_FORM_ERROR,
        payload:
          'Password must contain at least 8 characters, 1 number, 1 uppercase letter, and 1 special character.',
      });
      return null;
    }

    // Clear any existing error
    dispatch({ type: ActionTypes.SET_USER_FORM_ERROR, payload: '' });

    // Register the user
    const result = await registerUser(state.registerUserForm, dispatch);
    if (result) {
      setRegisterUserModal(false);
    }
    return result;
  };

  // Delete a user
  const deleteSelectedUser = async (username) => {
    const result = await removeUser(username, dispatch);
    return result;
  };

  // Toggle user active status
  const toggleUserActiveStatus = async (username, newStatus) => {
    const result = await toggleUserStatus(username, newStatus, dispatch);
    return result;
  };

  // Update user roles
  const updateSelectedUserRoles = async (username, roleIds) => {
    const result = await updateUserRoles(username, roleIds, dispatch);
    if (result) {
      setEditUserModal(false);
    }
    return result;
  };

  // Fetch approvers for a specific user
  const fetchApproversForUserContext = async (username) => {
    const result = await fetchApproversForUser(username);
    return result;
  };

  // Update user approvers and approval requirements
  const updateUserApprovers = async (
    username,
    approvers,
    requiresApproval,
    isActive,
    userId,
    is2FARequired = null
  ) => {
    const result = await updateUserApproversApi(
      username,
      approvers,
      requiresApproval,
      isActive,
      userId,
      dispatch,
      is2FARequired
    );
    return result;
  };

  // ====================================
  // Authentication Functions
  // ====================================
  // Navigate is needed for redirects
  const navigate = useNavigate();

  // Update login form
  const updateLoginForm = (formData) => {
    dispatch({ type: ActionTypes.UPDATE_LOGIN_FORM, payload: formData });
  };

  // Handle login form field change
  const handleLoginFormChange = (e) => {
    const { name, value } = e.target;
    updateLoginForm({ ...state.loginForm, [name]: value });
  };

  // Clear login form
  const clearLoginForm = () => {
    dispatch({ type: ActionTypes.CLEAR_LOGIN_FORM });
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    dispatch({ type: ActionTypes.TOGGLE_PASSWORD_VISIBILITY });
  };

  // ====================================
  // Prepare Single Context Value
  // ====================================
  const appStateValue = {
    // General state and dispatch
    state,
    dispatch,
    // Main App State methods
    fetchInitialDataCenters,
    fetchVMsForServer,
    fetchOmniDashboardUrl,
    fetchVMs: fetchVMsWrapper,
    performVmAction: performVmActionWrapper,
    performVmActionWebSocket,
    fetchVMsWebSocket,
    setupVmListWebSocket: (server) => setupVmListWebSocket(server, dispatch),
    renameVmInContext,
    cloneVmInContext,
    checkNodeStatuses,
    setConfiguredNodes: (nodes) => setNodes(nodes, dispatch),
    setMainTopBarComponent,
    handleAdminPageChange,
    setDataCenterView: (view) => setDataCenterView(view, dispatch),
    setServerView: (view) => setServerView(view, dispatch),

    // DataCenter related values and methods
    selectedDataCenter: state.selectedDataCenter,
    setSelectedDataCenter: (datacenter) =>
      dispatch({ type: ActionTypes.SET_SELECTED_DATACENTER, payload: datacenter }),
    scannedData,
    setScannedData,
    inventory: state.inventory,
    setInventory: (inventory) => dispatch({ type: ActionTypes.SET_INVENTORY, payload: inventory }),
    subnet: state.subnet,
    loading: state.isLoading || state.scanLoading,
    error: state.error || state.scanError,
    configuredNodes: state.configuredNodes,
    fetchInventory: (options = {}) => fetchInventory(dispatch, options),
    vncConsoleUrl: state.vncConsoleUrl,
    vncConsoleOptions: state.vncConsoleOptions,
    getVncConsoleUrl,

    // Server related values and methods
    selectedServer: state.selectedServer,
    setSelectedServer: (server) => {
      dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: server });
    },
    dataCenters: state.dataCenters,
    openDataCenters: state.openDataCenters,
    toggleDatacenterVisibility: (dcId) =>
      dispatch({ type: ActionTypes.TOGGLE_DATACENTER_VISIBILITY, payload: dcId }),

    // Server API Functions for LandingPage
    serverData: state.serverData,
    fetchServerInventory: (selectedServerIp) => fetchServerInventory(dispatch, selectedServerIp),
    fetchServerSystemInfo: (selectedServerIp) => fetchServerSystemInfo(dispatch, selectedServerIp),
    fetchServerAddinCards: (selectedServerIp) => fetchServerAddinCards(dispatch, selectedServerIp),
    fetchServerStorageCards: (selectedServerIp) =>
      fetchServerStorageCards(dispatch, selectedServerIp),
    // VM related values and methods
    selectedVm: state.selectedVm,
    setSelectedVm: (vm) => dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: vm }),

    // VM Details related values and methods
    selectedVmDetails: state.selectedVmDetails,
    setSelectedVmDetails: (vmDetails) =>
      dispatch({ type: ActionTypes.SET_SELECTED_VM_DETAILS, payload: vmDetails }),
    fetchVmDetails,

    // VM Hardware Data Management
    vmHardwareData: state.vmHardwareData,
    vmHardwareLoading: state.vmHardwareLoading,
    vmHardwareError: state.vmHardwareError,
    fetchVmHardwareData: (vmName, serverIp, forceRefresh) =>
      fetchVmHardwareData(vmName, serverIp, dispatch, forceRefresh),
    getVmHardwareDataCached: (vmName, serverIp, maxAge) =>
      getVmHardwareDataCached(vmName, serverIp, state, dispatch, maxAge),
    setVmHardwareCache: (vmKey, data) =>
      dispatch({ type: ActionTypes.SET_VM_HARDWARE_CACHE, payload: { vmKey, data } }),
    clearVmHardwareCache: (vmKey) =>
      dispatch({ type: ActionTypes.CLEAR_VM_HARDWARE_CACHE, payload: vmKey }),

    // Permissions related values and methods
    userPermissions: permissions, // User's actual permissions
    // Enhanced helper functions that work with dynamic permissions
    hasPermission: (permissionName: string) => permissions[permissionName] === true,
    getPermissionNames: () => Object.keys(permissions).filter((key) => permissions[key]),
    isAuthenticated: state.isAuthenticated,
    isAuthLoading: state.isAuthLoading,
    userName,
    seedUser,
    requiresApproval,
    approvers,
    updatePermissions,
    handleLogout,
    validateToken,
    refreshAccessToken,
    handleSessionExpired,
    setupTokenRefresh,
    checkRefreshTokenExpiry,
    fetchGlobalVmList,

    // WebSocket related values and methods
    socket,
    isConnected,
    wsMessages,
    wsError,
    sendMessage,
    closeConnection,
    connectWebSocket,

    // Notification WebSocket Functions
    connectNotificationWebSocket,
    closeNotificationWebSocket,
    notificationSocket,
    notificationIsConnected,

    // Role Management Functions
    fetchRolesData,
    fetchPermissionsData,
    updateRoleForm,
    clearRoleForm,
    togglePermission,
    saveRole,
    removeRole,
    startEditingRole,
    // User Management Functions
    fetchAllUsers,
    setSelectedUser,
    setEditUserModal,
    setRegisterUserModal,
    setUserViewFilter,
    updateRegisterUserForm,
    handleRegisterFormChange,
    resetRegisterUserForm,
    createUser,
    deleteSelectedUser,
    toggleUserActiveStatus,
    updateSelectedUserRoles,
    updateUserApprovers,
    fetchApproversForUser: fetchApproversForUserContext,
    // Authentication Functions
    updateLoginForm,
    handleLoginFormChange,
    clearLoginForm,
    togglePasswordVisibility,
    handleLogin,
    handle2FAVerification,
    updateSignupForm,
    handleSignupFormChange,
    setSignupErrors,
    validateSignupForm,
    handleSignup,

    setAdditionalAuthRequired,
    setAdditionalAuthCompleted,
    set2FARequired,
    set2FACompleted,

    clearSignupErrors,

    // Metrics (Observability) state and actions
    metrics: state.metrics,
    fetchMetricsUid: (serverIp) => fetchMetricsUid(serverIp, dispatch),
    setMetricsViewingPanel: (panelId) =>
      dispatch({ type: ActionTypes.SET_METRICS_VIEWING_PANEL, payload: panelId }),

    // Observability Services state and actions
    observabilityServices: state.observabilityServices,
    fetchObservabilityServicesStatus: (serverIp) =>
      fetchObservabilityServicesStatus(serverIp, dispatch),
    startObservabilityService: (serverIp, serviceName) =>
      startObservabilityService(serverIp, serviceName, dispatch),
    stopObservabilityService: (serverIp, serviceName) =>
      stopObservabilityService(serverIp, serviceName, dispatch),
    restartObservabilityService: (serverIp, serviceName) =>
      restartObservabilityService(serverIp, serviceName, dispatch),
    launchGrafanaDashboard: (serverIp) => launchGrafanaDashboard(serverIp, dispatch),

    // Observability Events state and actions
    observabilityEvents: state.observabilityEvents,
    fetchObservabilityEvents: (host, options = {}) =>
      fetchObservabilityEvents(dispatch, host, options),
    fetchComponentTypes: (host) => fetchComponentTypes(dispatch, host),
    approveEvent: (host, eventId) => approveObservabilityEvent(dispatch, host, eventId),
    rejectEvent: (host, eventId) => rejectObservabilityEvent(dispatch, host, eventId),
    updateObservabilityFilters: (filters) => updateObservabilityFilters(dispatch, filters),
    setObservabilityPagination: (pagination) => setObservabilityPagination(dispatch, pagination),

    // Observability Activity Logs state and actions (for Notifications component)
    fetchObservabilityActivityLogs: (host, options = {}) =>
      fetchObservabilityActivityLogs(dispatch, host, options),
    fetchObservabilityComponentTypes: (host) => fetchObservabilityComponentTypes(dispatch, host),
    approveActivityEvent: (host, eventId) =>
      approveObservabilityActivityEvent(dispatch, host, eventId),
    rejectActivityEvent: (host, eventId) =>
      rejectObservabilityActivityEvent(dispatch, host, eventId),
    updateObservabilityActivityFilters: (filters) =>
      updateObservabilityActivityFilters(dispatch, filters),
    setObservabilityActivityPagination: (pagination) =>
      setObservabilityActivityPagination(dispatch, pagination),

    // Node Top Info Metrics
    nodeTopInfo: state.nodeTopInfo || { loading: false, data: null, error: null },
    fetchNodeTopInfo: (serverIp) => fetchNodeTopInfo(serverIp, dispatch),
    // Storage context value
    availableDisks,
    storagePools,
    datastores,
    datasets,
    zpoolStatus,
    deduplicationStatus,
    compressionStatus,
    selectedView,
    currentPool,
    selectedDatasetTypes,
    selectedDatasetType,
    loadingDatastores,
    loadingDatasets,
    deletingPool,
    creatingDataset,
    creatingZvol,
    creatingZpool,
    isTogglingDeduplication,
    isTogglingCompression,
    datasetName,
    datasetEncryption,
    datasetPassphrase,
    zvolPool,
    zvolName,
    zvolSize,
    compressionValue,
    creatingDatastore,

    // State setters
    setSelectedView,
    setSelectedDatasetTypes,
    setSelectedDatasetType,
    setDatasetName,
    setDatasetEncryption,
    setDatasetPassphrase,
    setZvolPool,
    setZvolName,
    setZvolSize,
    setCompressionValue,
    setCreatingZpool,
    setCreatingDatastore,

    // Functions
    fetchAvailableDisks,
    fetchStoragePools,
    fetchZpoolStatus,
    fetchDatastores,
    fetchVmDatastoresWrapper,
    fetchZfsDatasetWrapper,
    handleDeleteDatastore,
    fetchDatasets,
    createDataset,
    unloadDatasetKey,
    loadDatasetKey,
    deleteDataset,
    fetchDeduplicationStatus,
    fetchCompressionStatus,
    handleDeduplicationToggle,
    handleCompressionToggle,
    createZpool,
    deletePool,
    createZvol,
    normalizeValue,

    // Network Management
    network: state.network,
    fetchNetworkInterfaces: (serverIp) => fetchNetworkInterfaces(serverIp, dispatch),
    fetchSwitches: (serverIp) => fetchSwitches(serverIp, dispatch),
    createSwitch: (serverIp, switchName, selectedInterface, switches) =>
      createSwitch(serverIp, switchName, selectedInterface, switches, dispatch),
    deleteSwitch: (serverIp, switchName, approver) =>
      deleteSwitch(serverIp, switchName, dispatch, approver),
    setNetworkDropdown: (value) => setNetworkDropdown(value, dispatch),
    setShowCreateSwitchForm: (value) => setShowCreateSwitchForm(value, dispatch),
    setSwitchName: (value) => setSwitchName(value, dispatch),
    setSelectedInterface: (value) => setSelectedInterface(value, dispatch),

    // Firewall Management
    firewall: state.firewall,
    fetchFirewallRules: (serverIp) => fetchFirewallRules(serverIp, dispatch),
    updateFirewallRules: (serverIp, rules, approver) =>
      updateFirewallRules(serverIp, rules, dispatch, approver),
    cancelFirewallRevert: (serverIp, id) => cancelFirewallRevert(serverIp, id, dispatch),
    setFirewallNotification: (serverIp, notification) =>
      setFirewallNotification(serverIp, notification, dispatch),
    setFirewallRevertCountdown: (serverIp, countdown) =>
      setFirewallRevertCountdown(serverIp, countdown, dispatch),
    setFirewallId: (serverIp, id) => setFirewallId(serverIp, id, dispatch),

    // System Logs
    logs: state.logs,
    fetchLogs: (serverIp, level, contains, page, limit, order) =>
      fetchLogs(serverIp, level, contains, page, limit, order, dispatch),
    setLogsLevel: (level) => setLogsLevel(level, dispatch),
    setLogsContains: (contains) => setLogsContains(contains, dispatch),

    // Storage and Disk Management
    storage: state.storage,
    // Disk operations
    fetchVmDisks: (serverIp, vmName) => fetchVmDisks(serverIp, vmName, dispatch),
    attachDisk: (serverIp, payload) => attachDisk(serverIp, payload, dispatch),
    reassignDisk: (serverIp, payload) => reassignDisk(serverIp, payload, dispatch),
    setDiskFormField: (field, value) => setDiskFormField(field, value, dispatch),

    // ISO Management
    iso: {
      isoList: state.iso?.isoList || [],
      loading: state.iso?.loading || false,
      error: state.iso?.error || null,
      selectedIso: state.iso?.selectedIso || '',
      // Upload progress tracking
      uploadingIso: state.iso?.uploadingIso || false,
      uploadProgress: state.iso?.uploadProgress || 0,
      uploadMessage: state.iso?.uploadMessage || '',
      uploadMessageType: state.iso?.uploadMessageType || '',
      // Download progress tracking
      downloadingIso: state.iso?.downloadingIso || false,
      downloadProgress: state.iso?.downloadProgress || 0,
      downloadMessage: state.iso?.downloadMessage || '',
      downloadMessageType: state.iso?.downloadMessageType || '',
    },
    cloudImages: {
      cloudImagesList: state.cloudImages?.cloudImagesList || [],
      loading: state.cloudImages?.loading || false,
      error: state.cloudImages?.error || null,
    },
    fetchIsoList: (serverIp) => fetchIsoList(serverIp, dispatch),
    fetchCloudImages: (serverIp) => fetchCloudImages(serverIp, dispatch),
    downloadIso: (serverIp, isoUrl) => downloadIso(serverIp, isoUrl, dispatch),
    uploadIso: (serverIp, file, isoType = 'local') => uploadIso(serverIp, file, dispatch, isoType),
    deleteIso: (serverIp, isoName, isCloudImage = false) =>
      deleteIso(serverIp, isoName, dispatch, isCloudImage),
    setIsoField: (field, value) => setIsoField(field, value, dispatch),
    // Upload/Download progress helpers
    setUploadProgress: (progress) => setUploadProgress(progress, dispatch),
    setUploadMessage: (message, messageType) => setUploadMessage(message, messageType, dispatch),
    clearUploadState: () => clearUploadState(dispatch),
    setDownloadProgress: (progress) => setDownloadProgress(progress, dispatch),
    setDownloadMessage: (message, messageType) =>
      setDownloadMessage(message, messageType, dispatch),
    clearDownloadState: () => clearDownloadState(dispatch),

    // Datacenter ISO Management
    setDcIsoUploadProgress: (progress) => setDcIsoUploadProgress(progress, dispatch),
    setDcIsoUploadMessage: (message, messageType) =>
      setDcIsoUploadMessage(message, messageType, dispatch),
    clearDcIsoUploadState: () => clearDcIsoUploadState(dispatch),
    setDcIsoDownloadProgress: (progress) => setDcIsoDownloadProgress(progress, dispatch),
    setDcIsoDownloadMessage: (message, messageType) =>
      setDcIsoDownloadMessage(message, messageType, dispatch),
    clearDcIsoDownloadState: () => clearDcIsoDownloadState(dispatch),
    fetchDcIsoListShared: () => fetchDcIsoListShared(dispatch),
    fetchDcCloudImagesListShared: () => fetchDcCloudImagesListShared(dispatch),

    // Snapshot Management
    snapshots: state.snapshots,
    snapshotMessage: state.snapshotMessage,
    getVmSnapshots,
    fetchSnapshots: memoizedFetchSnapshots,
    createSnapshot: memoizedCreateSnapshot,
    rollbackSnapshot: memoizedRollbackSnapshot,
    takeZfsSnapshot: memoizedTakeZfsSnapshot,

    // DCStats Management
    nodeStatsHistory: state.nodeStatsHistory,
    isLoadingNodeStatsHistory: state.isLoadingNodeStatsHistory,
    nodeStatsHistoryError: state.nodeStatsHistoryError,
    fetchNodeStatsHistory: (serverIp, startTime, endTime) =>
      fetchNodeStatsHistory(serverIp, startTime, endTime, dispatch),

    nodeStatsRecommendations: state.nodeStatsRecommendations,
    isLoadingNodeStatsRecommendations: state.isLoadingNodeStatsRecommendations,
    nodeStatsRecommendationsError: state.nodeStatsRecommendationsError,
    fetchNodeStatsRecommendations: (startTime, endTime) =>
      fetchNodeStatsRecommendations(startTime, endTime, dispatch),

    historicalVmStats: state.historicalVmStats,
    isLoadingHistoricalVmStats: state.isLoadingHistoricalVmStats,
    historicalVmStatsError: state.historicalVmStatsError,
    fetchHistoricalVmStats: (nodeIp, startTime, endTime) =>
      fetchHistoricalVmStats(nodeIp, startTime, endTime, dispatch),

    vmRecommendations: state.vmRecommendations,
    isLoadingVmRecommendations: state.isLoadingVmRecommendations,
    vmRecommendationsError: state.vmRecommendationsError,
    fetchVMRecommendations: (nodeIp, startDate, endDate) =>
      fetchVMRecommendations(nodeIp, startDate, endDate, dispatch),

    // VLAN Management
    vlans: state.vlans,
    fetchVLANs: () => fetchVLANs(dispatch),
    fetchVLANDetails: (vlanName) => fetchVLANDetails(dispatch, vlanName),
    fetchVLANAvailableTags: () => fetchVLANAvailableTags(dispatch),
    fetchVLANStats: (vlanName) => fetchVLANStats(dispatch, vlanName),
    pingVLAN: (vlanName) => pingVLAN(dispatch, vlanName),
    createVLAN: (vlanData) => createVLAN(dispatch, vlanData),
    configureVLANIP: (vlanName, ipConfig) => configureVLANIP(dispatch, vlanName, ipConfig),
    getVLANDeletionPrompt: (vlanName) => getVLANDeletionPrompt(dispatch, vlanName),
    deleteVLAN: (vlanName, deleteData) => deleteVLAN(dispatch, vlanName, deleteData),
    resetVLANState: () => resetVLANState(dispatch),
    setVLANForm: (formData) => setVLANForm(dispatch, formData),
    clearVLANForm: () => clearVLANForm(dispatch),


    // NetBox Device Onboarding Modal
    netboxShowDeviceOnboardingModal: (state.netbox as any).showDeviceOnboardingModal || false,
    closeNetBoxModal: () => dispatch({ type: ActionTypes.NETBOX_DEVICE_ONBOARDING_MODAL_CLOSE }),
  };

  // ====================================

  // Render Single Provider
  // ====================================
  return <AppStateContext.Provider value={appStateValue}>{children}</AppStateContext.Provider>;
};

// ====================================
// Custom Hooks
// ====================================
// Main App State Hook - Returns the entire context
export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (context === null || context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

// DataCenter Hook - Extract only DataCenter-related props from the unified context
export const useDataCenter = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useDataCenter must be used within an AppStateProvider');
  }

  // Return only DataCenter-related properties and functions
  return {
    selectedDataCenter: context.selectedDataCenter,
    setSelectedDataCenter: context.setSelectedDataCenter,
    scannedData: context.scannedData,
    setScannedData: context.setScannedData,
    inventory: context.inventory,
    setInventory: context.setInventory,
    subnet: context.subnet,
    loading: context.loading,
    error: context.error,
    setError: (error: string | null) =>
      context.dispatch({ type: ActionTypes.SET_DATACENTER_ERROR, payload: error }),
    configuredNodes: context.configuredNodes,
    fetchInventory: context.fetchInventory,
    vncConsoleUrl: context.vncConsoleUrl,
    vncConsoleOptions: context.vncConsoleOptions,
    getVncConsoleUrl: context.getVncConsoleUrl,
  };
};

// Server Hook - Extract only Server-related props from the unified context
export const useServer = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useServer must be used within an AppStateProvider');
  }

  // Return only Server-related properties and functions
  return {
    selectedServer: context.selectedServer,
    setSelectedServer: context.setSelectedServer,
    dataCenters: context.dataCenters,
  };
};

// VM Hook - Extract only VM-related props from the unified context
export const useVm = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useVm must be used within an AppStateProvider');
  }

  // Return only VM-related properties and functions
  return {
    selectedVm: context.selectedVm,
    setSelectedVm: context.setSelectedVm,
    fetchVMs: context.fetchVMs,
    fetchVMsWebSocket: context.fetchVMsWebSocket,
    setupVmListWebSocket: context.setupVmListWebSocket,
    performVmActionWebSocket: context.performVmActionWebSocket,
    dataCenters: context.dataCenters,
  };
};

// Permissions Hook - Extract only Permission-related props from the unified context
export const usePermissions = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('usePermissions must be used within an AppStateProvider');
  }

  // Enhanced helper functions that work with dynamic permissions
  const hasPermission = useCallback(
    (permissionName: string): boolean => {
      return context.userPermissions[permissionName] === true;
    },
    [context.userPermissions]
  );

  const getPermissionNames = useCallback((): string[] => {
    return Object.keys(context.userPermissions).filter((key) => context.userPermissions[key]);
  }, [context.userPermissions]);

  // Return only Permission-related properties and functions
  return {
    permissions: context.userPermissions, // Keep 'permissions' for backward compatibility
    hasPermission, // Enhanced: Check any permission (including new ones)
    getPermissionNames, // Enhanced: Get all permission names
    isAuthenticated: context.isAuthenticated,
    isAuthLoading: context.isAuthLoading,
    userName: context.userName,
    seedUser: context.seedUser,
    updatePermissions: context.updatePermissions,
    handleLogout: context.handleLogout,
    validateToken: context.validateToken,
    refreshAccessToken: context.refreshAccessToken,
    handleSessionExpired: context.handleSessionExpired,
    setupTokenRefresh: context.setupTokenRefresh,
    checkRefreshTokenExpiry: context.checkRefreshTokenExpiry,
    twoFactorAuthRequired: context.state.twoFactorAuthRequired,
    twoFactorAuthCompleted: context.state.twoFactorAuthCompleted,
  };
};

// Firewall Hook - Extract firewall-related props from the unified context
export const useFirewall = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useFirewall must be used within an AppStateProvider');
  }

  const selectedServerIp = context.selectedServer?.fqdn || context.selectedServer?.ip;

  // Get the default firewall state for servers that don't have firewall state yet
  const getDefaultFirewallState = () => ({
    rules: '',
    originalRules: '',
    loading: false,
    notification: null,
    revertCountdown: null,
    revertEndTime: null,
    isCancellingRevert: false,
    id: null,
    copied: false,
  });

  // Get firewall state for the selected server, or default state if no server is selected
  const firewallState = selectedServerIp
    ? context.firewall[selectedServerIp] || getDefaultFirewallState()
    : getDefaultFirewallState();

  return {
    firewall: firewallState,
    fetchFirewallRules: context.fetchFirewallRules,
    updateFirewallRules: context.updateFirewallRules,
    cancelFirewallRevert: context.cancelFirewallRevert,
    setFirewallNotification: (notification: any) => {
      if (selectedServerIp) {
        context.setFirewallNotification(selectedServerIp, notification);
      }
    },
    setFirewallRevertCountdown: (countdown: number) => {
      if (selectedServerIp) {
        context.setFirewallRevertCountdown(selectedServerIp, countdown);
      }
    },
    setFirewallId: (id: string) => {
      if (selectedServerIp) {
        context.setFirewallId(selectedServerIp, id);
      }
    },
  };
};

// WebSocket Hook - Extract only WebSocket-related props from the unified context
export const useWebSocket = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useWebSocket must be used within an AppStateProvider');
  }

  // Return only WebSocket-related properties and functions
  return {
    socket: context.socket,
    isConnected: context.isConnected,
    messages: context.wsMessages,
    error: context.wsError,
    sendMessage: context.sendMessage,
    closeConnection: context.closeConnection,
    connectWebSocket: context.connectWebSocket,
  };
};

// Storage Hook - Extract only Storage-related props from the unified context
export const useStorage = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useStorage must be used within an AppStateProvider');
  }

  return {
    availableDisks: context.availableDisks,
    storagePools: context.storagePools,
    datastores: context.datastores,
    datasets: context.datasets,
    zpoolStatus: context.zpoolStatus,
    deduplicationStatus: context.deduplicationStatus,
    compressionStatus: context.compressionStatus,
    selectedView: context.selectedView,
    currentPool: context.currentPool,
    selectedDatasetTypes: context.selectedDatasetTypes,
    selectedDatasetType: context.selectedDatasetType,
    loadingDatastores: context.loadingDatastores,
    loadingDatasets: context.loadingDatasets,
    deletingPool: context.deletingPool,
    creatingDataset: context.creatingDataset,
    creatingZvol: context.creatingZvol,
    creatingZpool: context.creatingZpool,
    isTogglingDeduplication: context.isTogglingDeduplication,
    isTogglingCompression: context.isTogglingCompression,
    datasetName: context.datasetName,
    datasetEncryption: context.datasetEncryption,
    datasetPassphrase: context.datasetPassphrase,
    zvolPool: context.zvolPool,
    zvolName: context.zvolName,
    zvolSize: context.zvolSize,
    compressionValue: context.compressionValue,
    creatingDatastore: context.creatingDatastore,
    dropdownOpen: context.dropdownOpen,

    // State setters
    setSelectedView: context.setSelectedView,
    setSelectedDatasetTypes: context.setSelectedDatasetTypes,
    setSelectedDatasetType: context.setSelectedDatasetType,
    setDatasetName: context.setDatasetName,
    setDatasetEncryption: context.setDatasetEncryption,
    setDatasetPassphrase: context.setDatasetPassphrase,
    setZvolPool: context.setZvolPool,
    setZvolName: context.setZvolName,
    setZvolSize: context.setZvolSize,
    setCompressionValue: context.setCompressionValue,
    setCreatingZpool: (value) =>
      context.dispatch({ type: ActionTypes.SET_CREATING_ZPOOL, payload: value }),
    setCreatingDatastore: (value) =>
      context.dispatch({ type: ActionTypes.SET_CREATING_DATASTORE, payload: value }),
    setDropdownOpen: (value) =>
      context.dispatch({ type: ActionTypes.SET_DROPDOWN_OPEN, payload: value }),

    // Functions
    fetchAvailableDisks: context.fetchAvailableDisks,
    fetchStoragePools: context.fetchStoragePools,
    fetchZpoolStatus: context.fetchZpoolStatus,
    fetchDatastores: context.fetchDatastores,
    fetchVmDatastoresWrapper: context.fetchVmDatastoresWrapper,
    fetchZfsDatasetWrapper: context.fetchZfsDatasetWrapper,
    handleDeleteDatastore: context.handleDeleteDatastore,
    fetchDatasets: context.fetchDatasets,
    createDataset: context.createDataset,
    unloadDatasetKey: context.unloadDatasetKey,
    loadDatasetKey: context.loadDatasetKey,
    deleteDataset: context.deleteDataset,
    fetchDeduplicationStatus: context.fetchDeduplicationStatus,
    fetchCompressionStatus: context.fetchCompressionStatus,
    handleDeduplicationToggle: context.handleDeduplicationToggle,
    handleCompressionToggle: context.handleCompressionToggle,
    createZpool: context.createZpool,
    deletePool: context.deletePool,
    createZvol: context.createZvol,
    normalizeValue: context.normalizeValue,
    takeSnapshot: context.createSnapshot,
    takeZfsSnapshot: context.takeZfsSnapshot,
  };
};

// Simple WebSocket Provider for compatibility
export const SimpleWebSocketProvider = ({ children }: { children: ReactNode }) => children;

// Export action types for components that need them
export { ActionTypes } from './utils/actionTypes';

// Add PermissionProvider for backward compatibility
export const PermissionProvider = ({ children }: { children: ReactNode }) => {
  // For backward compatibility, we wrap the children in the full AppStateProvider
  // This allows existing code that expects PermissionProvider to continue working
  return <AppStateProvider>{children}</AppStateProvider>;
};

// Notification WebSocket Hook - Extract only notification WebSocket related props
export const useNotifications = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useNotifications must be used within an AppStateProvider');
  }

  return {
    notificationMessages: context.state.notificationMessages,
    hasNotifications: context.state.hasNotifications,
    isConnected: context.notificationIsConnected,
    connectNotificationWebSocket: context.connectNotificationWebSocket,
    closeNotificationWebSocket: context.closeNotificationWebSocket,
    setHasNotifications: (value: boolean) =>
      context.dispatch({ type: ActionTypes.SET_HAS_NOTIFICATIONS, payload: value }),
    clearNotificationMessages: () =>
      context.dispatch({ type: ActionTypes.CLEAR_NOTIFICATION_MESSAGES }),
  };
};

// Install Updates hook
export const useInstallUpdates = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useInstallUpdates must be used within an AppStateProvider');
  }

  return {
    installUpdates: context.state.installUpdates,
    dispatch: context.dispatch,
  };
};

