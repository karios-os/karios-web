import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { FaDatabase, FaPlus, FaHdd, FaChevronDown, FaTrash, FaEye, FaServer } from 'react-icons/fa';
import CreateZPool from './server_storage/createZpool';
import DatasetItem from './server_storage/DatasetItem';
import CreateDataset from './server_storage/CreateDataset';
import CreateZvol from './server_storage/CreateZvol';
import CreateDatastore from './server_storage/CreateDatastore';
import Modal from '../../shared-state/src/widgets/Modal';
import { useApprovalFlow } from '../../shared-state/src/hooks/useApprovalFlow';
import ApprovalModal from '../../shared-state/src/components/ApprovalModal';
import Tooltip from '../../shared-state/src/widgets/Tooltip';
import {
  useServer,
  usePermissions,
  api,
  useStorage,
  useAppState,
  createComponentLogger,
} from '@karios-monorepo/shared-state';
import Button from '../../shared-state/src/widgets/Button';
import {
  AddSquare,
  ElementPlus,
  Add,
  Eye,
  FolderAdd,
  Trash,
  Coin,
  DirectNormal,
} from 'iconsax-react';
import envConfig from '../../../runtime-config';

// Import new components
import StorageHeader from './components/StorageHeader';
import AvailableDisksView from './components/AvailableDisksView';
import DatastoresView from './components/DatastoresView';
import StoragePoolsView from './components/StoragePoolsView';
import ArcMemoryManagement from './components/ArcMemoryManagement';
import DeletePoolModal from './components/DeletePoolModal';
import DeleteDatastoreModal from './components/DeleteDatastoreModal';

export default function StorageDetails() {
  const logger = createComponentLogger('StorageDetails');
  const { selectedServer } = useServer();

  const {
    createZvol,
    datasets,
    fetchDatasets,
    loadingDatasets,
    setSelectedDatasetTypes,
    selectedDatasetTypes,
  } = useStorage();
  const { handleDeleteDatastore: deleteDatastore } = useAppState();
  const CAN_MANAGE = true;

  // State declarations
  const [availableDisks, setAvailableDisks] = useState([]);
  const [storagePools, setStoragePools] = useState([]);
  const [datastores, setDatastores] = useState([]);
  // Track version for forced refreshes
  const [selectedView, setSelectedView] = useState('storage_pools');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deletingPool, setDeletingPool] = useState(null);
  const [creatingDataset, setCreatingDataset] = useState(null);
  const [datasetName, setDatasetName] = useState('');
  const [datasetEncryption, setDatasetEncryption] = useState(false);
  const [datasetPassphrase, setDatasetPassphrase] = useState('');
  const [zvolPool, setZvolPool] = useState(null);
  const [zvolName, setZvolName] = useState('');
  const [zvolSize, setZvolSize] = useState(1);
  const [creatingZvol, _setCreatingZvol] = useState(false);
  const [zpoolStatus, setZpoolStatus] = useState({});
  const [creatingZpool, setCreatingZpool] = useState(false);
  const [creatingDatastore, setCreatingDatastore] = useState(false);

  // ARC info state
  const [arcInfo, setArcInfo] = useState(null);
  const [loadingArcInfo, setLoadingArcInfo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tempArcValue, setTempArcValue] = useState(null);
  const [pendingArcChange, setPendingArcChange] = useState(() => {
    // Load persisted pending change from localStorage
    try {
      const saved = localStorage.getItem(
        `pendingArcChange_${selectedServer?.fqdn || selectedServer?.ip}`
      );
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      logger.error('Failed to load pending ARC change from localStorage', {
        serverIp: selectedServer?.fqdn || selectedServer?.ip,
        error,
      });
      return null;
    }
  });

  // L2ARC device state
  const [addingL2Arc, setAddingL2Arc] = useState(null); // Pool name when adding L2ARC
  const [selectedL2ArcDevices, setSelectedL2ArcDevices] = useState([]);
  const [loadingL2Arc, setLoadingL2Arc] = useState(false);

  // SLOG device state
  const [addingSlog, setAddingSlog] = useState(null); // Pool name when adding SLOG
  const [selectedSlogDevices, setSelectedSlogDevices] = useState([]);
  const [loadingSlog, setLoadingSlog] = useState(false);
  const [slogMirrorEnabled, setSlogMirrorEnabled] = useState(false);

  // Remove devices state
  const [removingDevices, setRemovingDevices] = useState(null); // Pool name when removing devices
  const [selectedRemoveDevices, setSelectedRemoveDevices] = useState([]);
  const [loadingRemoveDevices, setLoadingRemoveDevices] = useState(false);

  // Local state to track which pools are showing datasets
  const [showingDatasets, setShowingDatasets] = useState({});

  // Performance dropdown state
  const [performanceDropdownOpen, setPerformanceDropdownOpen] = useState({});

  // Delete datastore modal state
  const [isDeleteDatastoreModalOpen, setIsDeleteDatastoreModalOpen] = useState(false);
  const [datastoreToDelete, setDatastoreToDelete] = useState(null);

  // Delete pool modal state
  const [showDeletePoolModal, setShowDeletePoolModal] = useState(false);
  const [poolToDelete, setPoolToDelete] = useState(null);
  const [poolConfirmationText, setPoolConfirmationText] = useState('');

  // Modal state for alert/confirmation dialogs
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'info', // 'info', 'success', 'error', 'confirm'
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
  });

  // Approval flow hooks for pool deletion
  const poolDeletionApprovalFlow = useApprovalFlow({
    title: 'ZFS Pool Deletion Approval Required',
    message:
      'This ZFS pool deletion requires approval. Please select an approver from the list below.',
  });

  // Approval flow hooks for datastore deletion
  const datastoreDeletionApprovalFlow = useApprovalFlow({
    title: 'Datastore Deletion Approval Required',
    message:
      'This datastore deletion requires approval. Please select an approver from the list below.',
  });

  const dropdownRef = useRef(null);

  // Modal helper functions
  const showModal = (type, title, message, onConfirm = null, onCancel = null) => {
    setModalState({
      isOpen: true,
      type,
      title,
      message,
      onConfirm,
      onCancel,
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      type: 'info',
      title: '',
      message: '',
      onConfirm: null,
      onCancel: null,
    });
  };

  const showAlert = (message, type = 'info') => {
    showModal(
      type,
      type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Information',
      message
    );
  };

  const showConfirm = (message, onConfirm, onCancel = null) => {
    showModal('confirm', 'Confirmation', message, onConfirm, onCancel);
  };

  // Memoize only the server identity (ip/fqdn) to prevent flickering from VM list updates
  const serverIdentity = useMemo(
    () => ({
      ip: selectedServer?.ip,
      fqdn: selectedServer?.fqdn,
      id: selectedServer?.id,
    }),
    [selectedServer?.ip, selectedServer?.fqdn, selectedServer?.id]
  );

  // Initial data fetching
  useEffect(() => {
    if (serverIdentity.fqdn || serverIdentity.ip) {
      fetchAvailableDisks();
      fetchStoragePools();
      fetchArcInfo();

      // Load persisted pending ARC change for this server
      try {
        const saved = localStorage.getItem(
          `pendingArcChange_${serverIdentity.fqdn || serverIdentity.ip}`
        );
        if (saved) {
          setPendingArcChange(JSON.parse(saved));
        }
      } catch (error) {
        logger.error('Failed to load pending ARC change for server', {
          serverIp: serverIdentity.fqdn || serverIdentity.ip,
          error,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverIdentity]);
  // Remove the effect that listens to datasetsVersion changes since
  // the shared state datasets should automatically trigger re-renders
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }

      // Close performance dropdowns when clicking outside
      const performanceDropdowns = document.querySelectorAll('.performance-dropdown');
      let clickedInsidePerformanceDropdown = false;

      performanceDropdowns.forEach((dropdown) => {
        if (dropdown.contains(event.target)) {
          clickedInsidePerformanceDropdown = true;
        }
      });

      if (!clickedInsidePerformanceDropdown) {
        setPerformanceDropdownOpen({});
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-disable mirror configuration when less than 2 disks available
  useEffect(() => {
    if (availableDisks.length < 2 && slogMirrorEnabled) {
      setSlogMirrorEnabled(false);
    }
  }, [availableDisks.length, slogMirrorEnabled]);

  // API functions
  const fetchAvailableDisks = async () => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/available_disks`
      );
      const data = await response.json();
      setAvailableDisks(data.available);
    } catch (error) {
      logger.error('Failed to fetch available disks', {
        serverIp: serverIdentity.fqdn || serverIdentity.ip,
        error,
      });
    }
  };

  const fetchStoragePools = async () => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/pools`
      );
      const data = await response.json();
      setStoragePools(data);
      const statusPromises = data.map((pool) => fetchZpoolStatus(pool.NAME));
      await Promise.all(statusPromises);
    } catch (error) {
      logger.error('Failed to fetch storage pools', {
        serverIp: serverIdentity.fqdn || serverIdentity.ip,
        error,
      });
    }
  };

  const fetchZpoolStatus = async (zpool) => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/pool_status/${zpool}`
      );
      if (!response.ok) throw new Error(`Failed to fetch status for ${zpool}`);
      const data = await response.json();
      // Store the complete response structure for the new API format
      setZpoolStatus((prevState) => ({
        ...prevState,
        [zpool]: data,
      }));
    } catch (error) {
      logger.error('Failed to fetch zpool status', {
        serverIp: serverIdentity.fqdn || serverIdentity.ip,
        zpool,
        error,
      });
    }
  };

  const fetchDatastores = async () => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores `
      );
      if (response.ok) {
        const data = await response.json();
        setDatastores(data.datastores || []);
      } else {
        logger.error('Failed to fetch datastores', {
          serverIp: serverIdentity.fqdn || serverIdentity.ip,
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      logger.error('Failed to fetch datastores', {
        serverIp: serverIdentity.fqdn || serverIdentity.ip,
        error,
      });
    }
  };

  const fetchArcInfo = async () => {
    setLoadingArcInfo(true);
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIdentity.fqdn || serverIdentity.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/arc_info`
      );
      if (response.ok) {
        const data = await response.json();
        setArcInfo(data);

        // Only clear pending change if the system has been rebooted and the ARC max has actually changed
        // This prevents immediate clearing and ensures persistence across tab switches
        if (pendingArcChange && data.arc_max === pendingArcChange.arc_max) {
          // Clear both state and localStorage
          setPendingArcChange(null);
          localStorage.removeItem(`pendingArcChange_${serverIdentity.fqdn || serverIdentity.ip}`);
        }
      } else {
        logger.error('Failed to fetch ARC info', {
          serverIp: serverIdentity.fqdn || serverIdentity.ip,
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      logger.error('Failed to fetch ARC info', {
        serverIp: serverIdentity.fqdn || serverIdentity.ip,
        error,
      });
    } finally {
      setLoadingArcInfo(false);
    }
  };

  // Helper functions for ARC info processing
  const parseMemorySize = (sizeStr) => {
    if (!sizeStr) return 0;
    const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?B?)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    switch (unit) {
      case 'TB':
      case 'T':
        return value * 1024 * 1024 * 1024 * 1024;
      case 'GB':
      case 'G':
        return value * 1024 * 1024 * 1024;
      case 'MB':
      case 'M':
        return value * 1024 * 1024;
      case 'KB':
      case 'K':
        return value * 1024;
      default:
        return value;
    }
  };

  const formatMemorySize = (bytes) => {
    if (bytes >= 1024 * 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
    } else if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${bytes} B`;
  };

  // ARC slider handlers
  const handleSliderMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    // Calculate initial position when clicking anywhere on the slider
    const slider = e.currentTarget;
    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const maxRAM = parseMemorySize(arcInfo.availabe_ram);
    const newArcValue = (percentage / 100) * maxRAM;
    setTempArcValue(newArcValue);
  };

  const handleSliderMouseMove = useCallback(
    (e) => {
      if (!isDragging || !arcInfo) return;

      const slider = document.querySelector('.arc-slider');
      if (!slider) return;

      const rect = slider.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const maxRAM = parseMemorySize(arcInfo.availabe_ram);
      const newArcValue = (percentage / 100) * maxRAM;

      setTempArcValue(newArcValue);
    },
    [isDragging, arcInfo]
  );

  const handleSliderMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleSubmitArcChange = async () => {
    if (tempArcValue !== null) {
      try {
        // Convert bytes to appropriate unit with full suffix (MB, GB, TB)
        let apiValue;
        if (tempArcValue >= 1024 * 1024 * 1024 * 1024) {
          // TB - allow decimal precision
          const tbValue = (tempArcValue / (1024 * 1024 * 1024 * 1024)).toFixed(2);
          apiValue = `${tbValue}TB`;
        } else if (tempArcValue >= 1024 * 1024 * 1024) {
          // GB - allow decimal precision
          const gbValue = (tempArcValue / (1024 * 1024 * 1024)).toFixed(2);
          apiValue = `${gbValue}GB`;
        } else {
          // MB - allow decimal precision
          const mbValue = (tempArcValue / (1024 * 1024)).toFixed(2);
          apiValue = `${mbValue}MB`;
        }

        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/set_arc_max`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              arc_max: apiValue,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();

          // Store the pending change info and persist to localStorage
          const pendingChangeData = {
            status: data.status,
            arc_max: data.arc_max,
            note: data.note,
            appliedValue: formatMemorySize(tempArcValue),
            timestamp: new Date().toISOString(),
          };

          setPendingArcChange(pendingChangeData);

          // Persist to localStorage so it survives tab changes and page refreshes
          localStorage.setItem(
            `pendingArcChange_${serverIdentity.fqdn || serverIdentity.ip}`,
            JSON.stringify(pendingChangeData)
          );

          setTempArcValue(null);

          // Remove the immediate refresh - let the message persist until system reboot
          // The message will only be cleared when fetchArcInfo detects the change is actually applied
        } else {
          const errorData = await response.json().catch(() => ({}));
          showAlert(
            errorData?.error || `Failed to set ARC max. Status: ${response.status}`,
            'error'
          );
        }
      } catch (error) {
        logger.error('Failed to set ARC max', {
          serverIp: serverIdentity.fqdn || serverIdentity.ip,
          tempArcValue,
          error,
        });
        showAlert(`Failed to set ARC max: ${error.message}`, 'error');
      }
    }
  };

  const handleCancelArcChange = () => {
    setTempArcValue(null);
  };

  const handleRebootNow = async () => {
    if (!selectedServer?.fqdn && !selectedServer?.ip) {
      showAlert('No server selected', 'error');
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      'Are you sure you want to reboot the server now? This will restart the system and apply the ARC changes. All running VMs will be affected.'
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/system/reboot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'Apply ARC memory configuration changes',
          }),
        }
      );

      if (response.ok) {
        showAlert(
          'Server reboot initiated successfully. The ARC changes will be applied after the system restarts.',
          'success'
        );

        // Don't clear the pending change or redirect - keep the button available
        // setPendingArcChange(null);
        // localStorage.removeItem(`pendingArcChange_${selectedServer?.fqdn || selectedServer.ip}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        showAlert(
          errorData?.error || `Failed to reboot server. Status: ${response.status}`,
          'error'
        );
      }
    } catch (error) {
      logger.error('Failed to reboot server', {
        serverIp: serverIdentity.fqdn || serverIdentity.ip,
        error,
      });
      showAlert(`Failed to reboot server: ${error.message}`, 'error');
    }
  };

  const handleArcInputChange = (e) => {
    const inputValue = e.target.value;
    const numericValue = parseFloat(inputValue);
    if (!isNaN(numericValue) && numericValue >= 0) {
      const maxRAM = parseMemorySize(arcInfo.availabe_ram);
      const newValueInBytes = numericValue * 1024 * 1024 * 1024; // Convert GB to bytes
      if (newValueInBytes <= maxRAM) {
        setTempArcValue(newValueInBytes);
      }
    }
  };

  // L2ARC device handlers
  const handleAddL2ArcDevice = async (poolName) => {
    logger.debug('Adding L2ARC device', { poolName, selectedDevices: selectedL2ArcDevices.length });

    if (selectedL2ArcDevices.length === 0) {
      showAlert('Please select at least one device for L2ARC.', 'error');
      return;
    }

    // Show warning modal before proceeding
    const deviceList = selectedL2ArcDevices.join(', ');
    const warningMessage = `Warning: Adding L2ARC device${selectedL2ArcDevices.length > 1 ? 's' : ''} will destroy all existing data on the following disk${selectedL2ArcDevices.length > 1 ? 's' : ''}:

${deviceList}

This action cannot be undone. Are you sure you want to continue?`;

    showModal(
      'confirm',
      'Add L2ARC Device',
      warningMessage,
      () => {
        // Proceed with adding L2ARC device
        addL2ArcDeviceConfirmed(poolName);
        closeModal();
      },
      () => {
        closeModal();
      }
    );
  };

  const addL2ArcDeviceConfirmed = async (poolName) => {
    setLoadingL2Arc(true);
    try {
      const url = `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/l2arc/add`;
      const payload = {
        device: selectedL2ArcDevices,
        pool: poolName,
      };

      const response = await api.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        logger.info('L2ARC device added successfully', { poolName, devices: selectedL2ArcDevices });
        showAlert(
          `${data.status}\n\nDevices: ${data.devices.join(', ')}\nPool: ${data.pool}\n\nNote: ${data.note}`,
          'success'
        );
        setSelectedL2ArcDevices([]);
        setAddingL2Arc(null);
        // Refresh available disks and pool status
        fetchAvailableDisks();
        fetchZpoolStatus(poolName);
      } else {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Failed to add L2ARC device', {
          poolName,
          devices: selectedL2ArcDevices,
          status: response.status,
          error: errorData,
        });
        showAlert(
          errorData?.error || `Failed to add L2ARC device(s). Status: ${response.status}`,
          'error'
        );
      }
    } catch (error) {
      logger.error('Failed to add L2ARC device', {
        poolName,
        devices: selectedL2ArcDevices,
        error,
      });
      showAlert(`Failed to add L2ARC device: ${error.message}`, 'error');
    } finally {
      setLoadingL2Arc(false);
    }
  };

  const handleCancelL2Arc = () => {
    setAddingL2Arc(null);
    setSelectedL2ArcDevices([]);
  };

  const handleDeviceSelection = (deviceName, isSelected) => {
    if (isSelected) {
      setSelectedL2ArcDevices((prev) => [...prev, deviceName]);
    } else {
      setSelectedL2ArcDevices((prev) => prev.filter((device) => device !== deviceName));
    }
  };

  // SLOG device handlers
  const handleAddSlogDevice = async (poolName) => {
    logger.debug('Adding SLOG device', {
      poolName,
      selectedDevices: selectedSlogDevices.length,
      mirrorEnabled: slogMirrorEnabled,
    });

    if (selectedSlogDevices.length === 0) {
      showAlert('Please select at least one device for SLOG.', 'error');
      return;
    }

    if (slogMirrorEnabled && selectedSlogDevices.length < 2) {
      showAlert('Mirror configuration requires at least 2 devices.', 'error');
      return;
    }

    // Show warning modal before proceeding
    const deviceList = selectedSlogDevices.join(', ');
    const warningMessage = `Warning: Adding SLOG device${selectedSlogDevices.length > 1 ? 's' : ''} will destroy all existing data on the following disk${selectedSlogDevices.length > 1 ? 's' : ''}:

${deviceList}

This action cannot be undone. Are you sure you want to continue?`;

    showModal(
      'confirm',
      'Add SLOG Device',
      warningMessage,
      () => {
        // Proceed with adding SLOG device
        addSlogDeviceConfirmed(poolName);
        closeModal();
      },
      () => {
        closeModal();
      }
    );
  };

  const addSlogDeviceConfirmed = async (poolName) => {
    setLoadingSlog(true);
    try {
      const url = `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/slog/add`;
      const payload = {
        device: selectedSlogDevices,
        mirror: slogMirrorEnabled,
        pool: poolName,
      };

      const response = await api.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        logger.info('SLOG device added successfully', {
          poolName,
          devices: selectedSlogDevices,
          mirrorEnabled: slogMirrorEnabled,
        });
        showAlert(
          `SLOG device(s) added successfully!\n\nDevices: ${selectedSlogDevices.join(', ')}\nPool: ${poolName}\nMirror: ${slogMirrorEnabled ? 'Enabled' : 'Disabled'}`,
          'success'
        );
        setSelectedSlogDevices([]);
        setAddingSlog(null);
        setSlogMirrorEnabled(false);
        // Refresh available disks and pool status
        fetchAvailableDisks();
        fetchZpoolStatus(poolName);
      } else {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Failed to add SLOG device', {
          poolName,
          devices: selectedSlogDevices,
          status: response.status,
          error: errorData,
        });
        showAlert(
          errorData?.error || `Failed to add SLOG device(s). Status: ${response.status}`,
          'error'
        );
      }
    } catch (error) {
      logger.error('Failed to add SLOG device', { poolName, devices: selectedSlogDevices, error });
      showAlert(`Failed to add SLOG device: ${error.message}`, 'error');
    } finally {
      setLoadingSlog(false);
    }
  };

  const handleCancelSlog = () => {
    setAddingSlog(null);
    setSelectedSlogDevices([]);
    setSlogMirrorEnabled(false);
  };

  const handleSlogDeviceSelection = (deviceName, isSelected) => {
    if (isSelected) {
      setSelectedSlogDevices((prev) => [...prev, deviceName]);
    } else {
      setSelectedSlogDevices((prev) => prev.filter((device) => device !== deviceName));
    }
  };

  // Remove devices function
  const handleRemoveDevices = async (poolName) => {
    logger.debug('Removing devices from pool', {
      poolName,
      selectedDevices: selectedRemoveDevices.length,
    });

    if (selectedRemoveDevices.length === 0) {
      showAlert('Please select at least one device to remove.', 'error');
      return;
    }

    setLoadingRemoveDevices(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/device/remove`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            device: selectedRemoveDevices,
            pool: poolName,
          }),
        }
      );

      // Response received

      if (response.ok) {
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          logger.info('Devices removed successfully', {
            poolName,
            devices: result.device || selectedRemoveDevices,
          });
          showAlert(`Devices removed successfully: ${result.device.join(', ')}`, 'success');
        } else {
          // Handle non-JSON success response
          const textResult = await response.text();
          logger.info('Devices removed successfully', { poolName, devices: selectedRemoveDevices });
          showAlert(`Devices removed successfully: ${selectedRemoveDevices.join(', ')}`, 'success');
        }

        // Refresh pool status after successful removal
        await fetchZpoolStatus(poolName);
        await fetchStoragePools();
        await fetchAvailableDisks();

        // Close the remove devices form
        setRemovingDevices(null);
        setSelectedRemoveDevices([]);
      } else {
        // Handle error response
        const contentType = response.headers.get('content-type');
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            logger.error('Failed to remove devices (JSON error)', {
              poolName,
              devices: selectedRemoveDevices,
              error: errorData,
            });
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (jsonError) {
            logger.error('Failed to parse remove devices error response', {
              poolName,
              error: jsonError,
            });
          }
        } else {
          try {
            const textError = await response.text();
            logger.error('Failed to remove devices (text error)', {
              poolName,
              devices: selectedRemoveDevices,
              error: textError,
            });
            errorMessage = textError || errorMessage;
          } catch (textError) {
            logger.error('Failed to read remove devices error response', {
              poolName,
              error: textError,
            });
          }
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      logger.error('Failed to remove devices', { poolName, devices: selectedRemoveDevices, error });
      showAlert(`Failed to remove devices: ${error.message}`, 'error');
    } finally {
      setLoadingRemoveDevices(false);
    }
  };

  const handleCancelRemoveDevices = () => {
    setRemovingDevices(null);
    setSelectedRemoveDevices([]);
  };

  const handleRemoveDeviceSelection = (deviceName, isSelected) => {
    if (isSelected) {
      setSelectedRemoveDevices((prev) => [...prev, deviceName]);
    } else {
      setSelectedRemoveDevices((prev) => prev.filter((device) => device !== deviceName));
    }
  };

  // Performance dropdown handlers
  const togglePerformanceDropdown = (poolName) => {
    setPerformanceDropdownOpen((prev) => ({
      ...prev,
      [poolName]: !prev[poolName],
    }));
  };

  // Helper function to check if any action is in progress for a pool
  const isPoolActionInProgress = (poolName) => {
    return (
      addingSlog === poolName ||
      addingL2Arc === poolName ||
      removingDevices === poolName ||
      loadingSlog ||
      loadingL2Arc ||
      loadingRemoveDevices ||
      deletingPool === poolName
    );
  };

  const handlePerformanceAction = (poolName, action) => {
    // Close any currently open action modals for this pool
    setAddingSlog((prev) => (prev === poolName ? null : prev));
    setAddingL2Arc((prev) => (prev === poolName ? null : prev));
    setRemovingDevices((prev) => (prev === poolName ? null : prev));

    setPerformanceDropdownOpen((prev) => ({
      ...prev,
      [poolName]: false,
    }));

    switch (action) {
      case 'add_slog':
        setAddingSlog(poolName);
        setSelectedSlogDevices([]);
        setSlogMirrorEnabled(false);
        // Fetch available disks when Add SLOG Device is clicked
        fetchAvailableDisks();
        break;
      case 'add_l2arc':
        setAddingL2Arc(poolName);
        setSelectedL2ArcDevices([]);
        // Fetch available disks when Add L2ARC Device is clicked
        fetchAvailableDisks();
        break;
      case 'remove':
        setRemovingDevices(poolName);
        setSelectedRemoveDevices([]);
        // Fetch available disks when Remove Devices is clicked
        fetchAvailableDisks();
        break;
      default:
        break;
    }
  };

  const getArcValueInGB = () => {
    const currentValue = tempArcValue !== null ? tempArcValue : parseMemorySize(arcInfo.arc_max);
    return (currentValue / (1024 * 1024 * 1024)).toFixed(2);
  };

  const setToRecommendedValue = () => {
    const recommendedValue = parseMemorySize(arcInfo.recommended_arc_max);
    setTempArcValue(recommendedValue);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleSliderMouseMove);
      document.addEventListener('mouseup', handleSliderMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleSliderMouseMove);
        document.removeEventListener('mouseup', handleSliderMouseUp);
      };
    }
    // Return undefined when isDragging is false
    return undefined;
  }, [isDragging, handleSliderMouseMove, handleSliderMouseUp]);

  const createDataset = async (poolName) => {
    if (!datasetName) {
      showAlert('Please enter a dataset name.', 'error');
      return;
    }

    // Validate encryption passphrase if encryption is enabled
    if (datasetEncryption && (!datasetPassphrase || datasetPassphrase.length < 8)) {
      showAlert('Please enter a passphrase with at least 8 characters for encryption.', 'error');
      return;
    }

    setCreatingDataset(poolName);
    try {
      // Using the correct pool name

      // Prepare request body
      const requestBody: any = {
        zpool_name: poolName,
        dataset_name: datasetName,
      };

      // Add encryption fields if encryption is enabled
      if (datasetEncryption && datasetPassphrase && datasetPassphrase.length >= 8) {
        requestBody.encryption = true;
        requestBody.passphrase = datasetPassphrase;
      }

      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/create_dataset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Dataset creation failed', {
          error: errorData?.error,
          status: response.status,
        });
        showAlert(
          errorData?.error || `Failed to create dataset. Status: ${response.status}`,
          'error'
        );
        return;
      }

      showAlert('Dataset created successfully.', 'success');
      setDatasetName('');
      setDatasetEncryption(false);
      setDatasetPassphrase('');

      // Set the type to 'filesystem' to show the newly created dataset
      setSelectedDatasetTypes({ ...selectedDatasetTypes, [poolName]: 'filesystem' });

      // Make sure we're showing datasets for this pool
      setShowingDatasets((prev) => ({ ...prev, [poolName]: true })); // Refresh datasets with filesystem type filter to show the newly created dataset
      fetchDatasets(selectedServer?.fqdn || selectedServer.ip, poolName, 'filesystem');
    } catch (error) {
      logger.error('Dataset creation error', error);
      showAlert(`Failed to create dataset: ${error.message}`, 'error');
    } finally {
      setCreatingDataset(null);
    }
  };
  const deletePool = async (poolName) => {
    setPoolToDelete(poolName);
    setShowDeletePoolModal(true);
    setPoolConfirmationText(''); // Reset confirmation text when opening modal
  };

  const confirmDeletePool = async () => {
    if (!poolToDelete) return;

    const performDeletion = async (approver?: string) => {
      setDeletingPool(poolToDelete);
      setShowDeletePoolModal(false);

      try {
        let url = `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/destroy_pool/${poolToDelete}`;
        if (approver) {
          url += `?approver=${encodeURIComponent(approver)}`;
        }

        const response = await api.fetch(url, { method: 'DELETE' });

        if (response.ok) {
          setStoragePools(storagePools.filter((pool) => pool.NAME !== poolToDelete));
          showAlert(`${poolToDelete} deleted successfully.`, 'success');
        } else {
          showAlert('Failed to delete pool. Please try again.', 'error');
        }
      } catch (error) {
        logger.error('Pool deletion error', { poolName: poolToDelete, error });
        showAlert(`Failed to delete ${poolToDelete}.`, 'error');
      } finally {
        setDeletingPool(null);
        setPoolToDelete(null);
        setPoolConfirmationText('');
      }
    };

    // Use approval flow if user requires approval
    if (poolDeletionApprovalFlow.requiresApproval) {
      await poolDeletionApprovalFlow.executeWithApproval(performDeletion, 'Delete ZFS Pool');
    } else {
      await performDeletion();
    }
  };

  const handleDeleteDatastore = async (datastoreName) => {
    setDatastoreToDelete(datastoreName);
    setIsDeleteDatastoreModalOpen(true);
  };

  const confirmDeleteDatastore = async () => {
    if (!datastoreToDelete) return;

    const performDeletion = async (approver?: string) => {
      try {
        // Call the handleDeleteDatastore function from shared-state with approver parameter
        if (approver) {
          // We need to create a modified version of the function that accepts approver
          // Since the shared-state function now supports approver parameter
          const response = await api.fetch(
            `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores/remove/${datastoreToDelete}?approver=${encodeURIComponent(approver)}`,
            { method: 'DELETE' }
          );
          if (response.ok) {
            showAlert(`Datastore "${datastoreToDelete}" deleted successfully.`, 'success');
          } else {
            showAlert('Failed to delete datastore. Please try again.', 'error');
          }
        } else {
          await deleteDatastore(selectedServer?.fqdn || selectedServer.ip, datastoreToDelete);
        }
        // Refresh the datastores list after deletion
        fetchDatastores();
      } catch (error) {
        logger.error('Datastore deletion error', { datastoreName: datastoreToDelete, error });
        showAlert('Failed to delete datastore. Please try again.', 'error');
      }
    };

    // Use approval flow if user requires approval
    if (datastoreDeletionApprovalFlow.requiresApproval) {
      await datastoreDeletionApprovalFlow.executeWithApproval(performDeletion, 'Delete Datastore');
    } else {
      await performDeletion();
    }

    setIsDeleteDatastoreModalOpen(false);
    setDatastoreToDelete(null);
  };

  const cancelDeleteDatastore = () => {
    setIsDeleteDatastoreModalOpen(false);
    setDatastoreToDelete(null);
  };

  const normalizeValue = (value) => {
    if (!value) return 0;
    const unit = value.slice(-1).toUpperCase();
    const numericValue = parseFloat(value);

    switch (unit) {
      case 'T':
        return numericValue * 1024 * 1024 * 1024 * 1024;
      case 'G':
        return numericValue * 1024 * 1024 * 1024;
      case 'M':
        return numericValue * 1024 * 1024;
      case 'K':
        return numericValue * 1024;
      default:
        return numericValue;
    }
  };

  const handleViewChange = (view: string) => {
    setSelectedView(view);
    if (view === 'datastores') {
      fetchDatastores();
    } else if (view === 'available_disks') {
      fetchAvailableDisks();
    }
  };

  return (
    <div className="w-full px-1 sm:px-2 md:px-4 lg:px-8" data-testid="storage-details-container">
      <StorageHeader
        canManage={CAN_MANAGE}
        selectedView={selectedView}
        dropdownOpen={dropdownOpen}
        setCreatingDatastore={setCreatingDatastore}
        setCreatingZpool={setCreatingZpool}
        setDropdownOpen={setDropdownOpen}
        dropdownRef={dropdownRef}
        onViewChange={handleViewChange}
      />
      {/* ARC Memory Management */}
      {(arcInfo || loadingArcInfo) && (
        <div data-testid="arc-memory-management-section">
          <ArcMemoryManagement
          arcInfo={arcInfo}
          loadingArcInfo={loadingArcInfo}
          isDragging={isDragging}
          tempArcValue={tempArcValue}
          pendingArcChange={pendingArcChange}
          formatMemorySize={formatMemorySize}
          parseMemorySize={parseMemorySize}
          formatPercentage={(current, total) => `${((current / total) * 100).toFixed(1)}%`}
          onSliderMouseDown={handleSliderMouseDown}
          onCancelArcChange={handleCancelArcChange}
          onSubmitArcChange={handleSubmitArcChange}
          onApplyPendingChange={handleRebootNow}
          onDiscardPendingChange={() => setPendingArcChange(null)}
          onRetryFetchArcInfo={fetchArcInfo}
        />
        </div>
      )}

      {/* Create ZPool Form */}
      {creatingZpool && (
        <div className="w-full p-2.5" data-testid="create-zpool-form">
          <CreateZPool
            setCreatingZpool={setCreatingZpool}
            existingPools={storagePools}
            fetchAvailableDisks={() => fetchAvailableDisks()}
            fetchStoragePools={() => fetchStoragePools()}
          />
        </div>
      )}

      {/* Create Datastore Form */}
      {creatingDatastore && (
        <div className="w-full p-2.5" data-testid="create-datastore-form">
          <CreateDatastore
            storagePools={storagePools}
            fetchDatastores={() => fetchDatastores()}
            onClose={() => setCreatingDatastore(false)}
            selectedServer={selectedServer}
            onError={(message) => showAlert(message, 'error')}
            onSuccess={(message) => showAlert(message, 'success')}
          />
        </div>
      )}

      <br />

      {/* Available Disks View */}
      {selectedView === 'available_disks' && <AvailableDisksView availableDisks={availableDisks} data-testid="available-disks-view" />}

      {/* Datastores View */}
      {selectedView === 'datastores' && (
        <div data-testid="datastores-view">
          <DatastoresView
          datastores={datastores}
          canManage={CAN_MANAGE}
          onDeleteDatastore={handleDeleteDatastore}
        />
        </div>
      )}

      {/* Storage Pools View */}
      {selectedView === 'storage_pools' && (
        <div className="p-2 sm:p-4" data-testid="storage-pools-view">
          <h3 className="text-lg sm:text-2xl font-semibold text-primary flex items-center mb-3 sm:mb-5" data-testid="storage-pools-header">
            <FaDatabase className="mr-2" /> Storage Pools
          </h3>
          <div className="space-y-6 sm:space-y-10">
            {storagePools.map((pool, index) => (
              <div
                key={index}
                className="border border-gray-100 rounded-md bg-white text-black p-2 sm:p-4 flex flex-col"
                data-testid={`storage-pool-card-${pool.NAME}`}
              >
                <div className="flex flex-col lg:flex-row justify-between gap-2 md:gap-0">
                  <div className="w-full">
                    <div className="flex justify-between items-start">
                      <span className="text-lg sm:text-xl" data-testid={`pool-name-${pool.NAME}`}>
                        {pool.NAME} <span className="text-xs sm:text-sm">({pool.SIZE})</span>
                      </span>

                      {/* Performance Configuration - Aligned with pool name */}
                      {CAN_MANAGE && (
                        <div className="relative performance-dropdown">
                          <button
                            className="flex items-center px-4 py-2 rounded-md border transition-colors min-w-[140px] justify-between text-gray-700 border-gray-300 bg-white hover:bg-gray-50"
                            onClick={() => togglePerformanceDropdown(pool.NAME)}
                            data-testid={`pool-actions-button-${pool.NAME}`}
                          >
                            <span>Actions</span>
                            <FaChevronDown
                              className={`ml-1 transition-transform ${performanceDropdownOpen[pool.NAME] ? 'rotate-180' : ''}`}
                            />
                          </button>

                          {performanceDropdownOpen[pool.NAME] && (
                            <div className="absolute right-0 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg z-10" data-testid={`pool-actions-dropdown-${pool.NAME}`}>
                              <button
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 text-black border-b border-gray-100 text-sm"
                                onClick={() => handlePerformanceAction(pool.NAME, 'add_slog')}
                              >
                                Add SLOG Device
                              </button>
                              <button
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 text-black border-b border-gray-100 text-sm"
                                onClick={() => handlePerformanceAction(pool.NAME, 'add_l2arc')}
                              >
                                Add L2ARC Device
                              </button>
                              <button
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 text-black text-sm"
                                onClick={() => handlePerformanceAction(pool.NAME, 'remove')}
                              >
                                Remove Devices
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 sm:mt-5" data-testid={`pool-info-${pool.NAME}`}>
                      <span className="text-xs sm:text-sm text-gray-600" data-testid={`pool-state-${pool.NAME}`}>
                        State: {zpoolStatus[pool.NAME]?.state || 'N/A'}
                      </span>
                      <div className="w-1/2 sm:w-1/4 mt-1" data-testid={`pool-usage-bar-${pool.NAME}`}>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-karios-green"
                            style={{
                              width:
                                pool.FREE && pool.ALLOC
                                  ? `${Math.max(
                                      (normalizeValue(pool.ALLOC) /
                                        (normalizeValue(pool.ALLOC) + normalizeValue(pool.FREE))) *
                                        100,
                                      0.5
                                    )}%`
                                  : '0%',
                            }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm text-gray-600 mt-1" data-testid={`pool-capacity-${pool.NAME}`}>
                        Free: {pool.FREE}, Allocated: {pool.ALLOC}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Disks Info */}
                {zpoolStatus[pool.NAME]?.config?.disks &&
                  zpoolStatus[pool.NAME].config.disks.length > 0 && (
                    <div className="mt-5">
                      <h5 className="text-xl">Disks</h5>
                      <ul className="list-disc pl-4 text-sm text-gray-600">
                        {zpoolStatus[pool.NAME].config.disks.map((disk, index) => (
                          <li key={index} className="flex items-center">
                            {disk.state.toLowerCase() === 'online' ? (
                              <div
                                className="w-2 h-2 bg-green-500 rounded-full mr-2"
                                title="Online"
                              ></div>
                            ) : null}
                            <span className={disk.state.toLowerCase() === 'online' ? '' : 'mr-2'}>
                              {disk.name}
                            </span>
                            {disk.state.toLowerCase() !== 'online' && (
                              <span>
                                - {disk.state} (Read: {disk.read}, Write: {disk.write}, Checksum:{' '}
                                {disk.cksum})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* RAID Info */}
                {zpoolStatus[pool.NAME]?.config?.raid && (
                  <div className="mt-7">
                    <h5 className="text-sm font-semibold">RAID Configuration</h5>
                    <ul className="list-disc pl-4 text-sm text-gray-600">
                      <li className="flex items-center">
                        {zpoolStatus[pool.NAME].config.raid.state.toLowerCase() === 'online' ? (
                          <div
                            className="w-2 h-2 bg-green-500 rounded-full mr-2"
                            title="Online"
                          ></div>
                        ) : null}
                        <span
                          className={
                            zpoolStatus[pool.NAME].config.raid.state.toLowerCase() === 'online'
                              ? ''
                              : 'mr-2'
                          }
                        >
                          {zpoolStatus[pool.NAME].config.raid.name}
                          {zpoolStatus[pool.NAME].config.raid.disks &&
                            zpoolStatus[pool.NAME].config.raid.disks.length > 0 && (
                              <span className="text-gray-500">
                                {' '}
                                (disks:{' '}
                                {zpoolStatus[pool.NAME].config.raid.disks
                                  .map((disk: any) => disk.name)
                                  .join(', ')}
                                )
                              </span>
                            )}
                        </span>
                        {zpoolStatus[pool.NAME].config.raid.state.toLowerCase() !== 'online' && (
                          <span>
                            - {zpoolStatus[pool.NAME].config.raid.state} (Read:{' '}
                            {zpoolStatus[pool.NAME].config.raid.read}, Write:{' '}
                            {zpoolStatus[pool.NAME].config.raid.write}, Checksum:{' '}
                            {zpoolStatus[pool.NAME].config.raid.cksum})
                          </span>
                        )}
                      </li>
                    </ul>
                  </div>
                )}

                {/* Cache Devices (L2ARC) Info */}
                {zpoolStatus[pool.NAME]?.config?.caches &&
                  zpoolStatus[pool.NAME].config.caches.length > 0 && (
                    <div className="mt-7">
                      <h5 className="text-sm font-semibold">Cache Devices (L2ARC)</h5>
                      <ul className="list-disc pl-4 text-sm text-gray-600">
                        {zpoolStatus[pool.NAME].config.caches.map((cache, index) => (
                          <li key={index} className="flex items-center">
                            {cache.state.toLowerCase() === 'online' ? (
                              <div
                                className="w-2 h-2 bg-green-500 rounded-full mr-2"
                                title="Online"
                              ></div>
                            ) : null}
                            <span className={cache.state.toLowerCase() === 'online' ? '' : 'mr-2'}>
                              {cache.name}
                            </span>
                            {cache.state.toLowerCase() !== 'online' && (
                              <span>
                                - {cache.state} (Read: {cache.read}, Write: {cache.write}, Checksum:{' '}
                                {cache.cksum}
                                {cache.block_size && `, Block Size: ${cache.block_size}`})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Log Devices (SLOG) Info */}
                {zpoolStatus[pool.NAME]?.config?.logs &&
                  zpoolStatus[pool.NAME].config.logs.length > 0 && (
                    <div className="mt-7">
                      <h5 className="text-sm font-semibold">Log Devices (SLOG)</h5>
                      <div className="pl-4 text-sm text-gray-600">
                        {zpoolStatus[pool.NAME].config.logs.map((log, index) => (
                          <div key={index} className="mb-2">
                            {log.name.toLowerCase().includes('mirror') &&
                            log.disks &&
                            log.disks.length > 1 ? (
                              // True mirror configuration with multiple devices - show mirror name and devices below
                              <div>
                                <div className="flex items-center mb-1">
                                  <span className="font-medium">{log.name}</span>
                                  {log.state.toLowerCase() !== 'online' && (
                                    <span className="ml-2 text-red-600">
                                      - {log.state} (Read: {log.read}, Write: {log.write}, Checksum:{' '}
                                      {log.cksum})
                                    </span>
                                  )}
                                </div>
                                <div className="pl-4">
                                  {log.disks.map((disk, diskIndex) => (
                                    <div key={diskIndex} className="text-xs flex items-center mb-1">
                                      {disk.state.toLowerCase() === 'online' ? (
                                        <div
                                          className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"
                                          title="Online"
                                        ></div>
                                      ) : null}
                                      <span
                                        className={
                                          disk.state.toLowerCase() === 'online' ? '' : 'mr-2'
                                        }
                                      >
                                        {disk.name}
                                      </span>
                                      {disk.state.toLowerCase() !== 'online' && (
                                        <span className="text-red-600">
                                          - {disk.state} (Read: {disk.read}, Write: {disk.write},
                                          Checksum: {disk.cksum}
                                          {disk.block_size && `, Block Size: ${disk.block_size}`})
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : log.disks && log.disks.length === 1 ? (
                              // Single device (even if it's in a mirror structure) - show just the device name
                              <div className="flex items-center">
                                {log.disks[0].state.toLowerCase() === 'online' ? (
                                  <div
                                    className="w-2 h-2 bg-green-500 rounded-full mr-2"
                                    title="Online"
                                  ></div>
                                ) : null}
                                <span
                                  className={
                                    log.disks[0].state.toLowerCase() === 'online' ? '' : 'mr-2'
                                  }
                                >
                                  {log.disks[0].name}
                                </span>
                                {log.disks[0].state.toLowerCase() !== 'online' && (
                                  <span className="text-red-600">
                                    - {log.disks[0].state} (Read: {log.disks[0].read}, Write:{' '}
                                    {log.disks[0].write}, Checksum: {log.disks[0].cksum}
                                    {log.disks[0].block_size &&
                                      `, Block Size: ${log.disks[0].block_size}`}
                                    )
                                  </span>
                                )}
                              </div>
                            ) : !log.disks ? (
                              // Individual SLOG device without disks array (directly attached)
                              <div className="flex items-center">
                                {log.state.toLowerCase() === 'online' ? (
                                  <div
                                    className="w-2 h-2 bg-green-500 rounded-full mr-2"
                                    title="Online"
                                  ></div>
                                ) : null}
                                <span
                                  className={log.state.toLowerCase() === 'online' ? '' : 'mr-2'}
                                >
                                  {log.name}
                                </span>
                                {log.state.toLowerCase() !== 'online' && (
                                  <span className="text-red-600">
                                    - {log.state} (Read: {log.read}, Write: {log.write}, Checksum:{' '}
                                    {log.cksum})
                                  </span>
                                )}
                              </div>
                            ) : (
                              // Fallback for any other configuration
                              <div className="flex items-center">
                                <span className="text-gray-600 mr-2">{log.name}</span>
                                <span className="text-xs text-gray-500">
                                  (Unknown configuration)
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* SLOG Device Configuration */}
                {addingSlog === pool.NAME && (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h6 className="text-lg font-semibold text-gray-800 mb-3">
                      Add SLOG Device to {pool.NAME}
                    </h6>
                    <p className="text-sm text-gray-700 mb-4">
                      SLOG (Separate Intent Log) devices improve synchronous write performance.
                      Mirror configuration provides redundancy but requires at least 2 devices.
                    </p>

                    {availableDisks.length === 0 ? (
                      <div className="text-center py-4">
                        <div className="text-gray-500 mb-4">No available disks for SLOG</div>
                        <Button
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                          onClick={handleCancelSlog}
                        >
                          Close
                        </Button>
                      </div>
                    ) : (
                      <>
                        {/* Mirror Configuration Toggle - Only show when 2+ disks available */}
                        {availableDisks.length >= 2 && (
                          <div className="mb-4">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={slogMirrorEnabled}
                                onChange={(e) => setSlogMirrorEnabled(e.target.checked)}
                                className="w-3 h-3 border border-gray-300 rounded focus:outline-none"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                Enable Mirror Configuration
                              </span>
                            </label>
                            <div className="text-xs text-gray-500 ml-5">
                              Provides redundancy for SLOG devices (requires minimum 2 devices)
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 mb-4">
                          {availableDisks.map((disk, index) => (
                            <label key={index} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedSlogDevices.includes(disk.name)}
                                onChange={(e) =>
                                  handleSlogDeviceSelection(disk.name, e.target.checked)
                                }
                                className="w-3 h-3 border border-gray-300 rounded focus:outline-none"
                              />
                              <span className="ml-2 text-sm text-gray-800">{disk.name}</span>
                              <span className="ml-2 text-xs text-gray-600">({disk.mediasize})</span>
                            </label>
                          ))}
                        </div>

                        {selectedSlogDevices.length > 0 && (
                          <div className="mb-4 p-2 bg-gray-50 border border-gray-200 rounded">
                            <div className="text-sm text-gray-800 mb-1">
                              <span className="font-medium">
                                Selected Devices ({selectedSlogDevices.length}):
                              </span>{' '}
                              {selectedSlogDevices.join(', ')}
                            </div>
                            {slogMirrorEnabled && selectedSlogDevices.length < 2 && (
                              <div className="text-sm text-orange-600">
                                ⚠️ Mirror configuration requires at least 2 devices
                              </div>
                            )}
                            <div className="text-xs text-gray-600">
                              Configuration: {slogMirrorEnabled ? 'Mirror' : 'Single'} | Devices:{' '}
                              {selectedSlogDevices.length}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <Button
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            onClick={handleCancelSlog}
                            disabled={loadingSlog}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="px-4 py-2 bg-karios-blue text-white rounded hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                            onClick={() => handleAddSlogDevice(pool.NAME)}
                            disabled={
                              loadingSlog ||
                              selectedSlogDevices.length === 0 ||
                              (slogMirrorEnabled && selectedSlogDevices.length < 2)
                            }
                          >
                            {loadingSlog ? (
                              <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Adding SLOG...
                              </div>
                            ) : (
                              `Add SLOG Device${selectedSlogDevices.length > 1 ? 's' : ''} ${slogMirrorEnabled ? '(Mirror)' : ''}`
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* L2ARC Device Configuration */}
                {addingL2Arc === pool.NAME && (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h6 className="text-lg font-semibold text-gray-800 mb-3">
                      Add L2ARC Device to {pool.NAME}
                    </h6>
                    <p className="text-sm text-gray-700 mb-4">
                      L2ARC is volatile and read-only; useful for large datasets with repeated
                      access patterns. Select one or more available devices to add as L2ARC cache.
                    </p>

                    {availableDisks.length === 0 ? (
                      <div className="text-center py-4">
                        <div className="text-gray-500 mb-4">No available disks for L2ARC</div>
                        <Button
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                          onClick={handleCancelL2Arc}
                        >
                          Close
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2 mb-4">
                          {availableDisks.map((disk, index) => (
                            <label key={index} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedL2ArcDevices.includes(disk.name)}
                                onChange={(e) => handleDeviceSelection(disk.name, e.target.checked)}
                                className="w-3 h-3 border border-gray-300 rounded focus:outline-none"
                              />
                              <span className="ml-2 text-sm text-gray-800">{disk.name}</span>
                              <span className="ml-2 text-xs text-gray-600">({disk.mediasize})</span>
                            </label>
                          ))}
                        </div>

                        {selectedL2ArcDevices.length > 0 && (
                          <div className="mb-4 p-2 bg-gray-50 border border-gray-200 rounded">
                            <div className="text-sm text-gray-800">
                              <span className="font-medium">
                                Selected Devices ({selectedL2ArcDevices.length}):
                              </span>{' '}
                              {selectedL2ArcDevices.join(', ')}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <Button
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            onClick={handleCancelL2Arc}
                            disabled={loadingL2Arc}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="px-4 py-2 bg-karios-blue text-white rounded hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                            onClick={() => handleAddL2ArcDevice(pool.NAME)}
                            disabled={loadingL2Arc || selectedL2ArcDevices.length === 0}
                          >
                            {loadingL2Arc ? (
                              <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Adding L2ARC...
                              </div>
                            ) : (
                              `Add L2ARC Device${selectedL2ArcDevices.length > 1 ? 's' : ''}`
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Remove Devices Configuration */}
                {removingDevices === pool.NAME && (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h6 className="text-lg font-semibold text-gray-800 mb-3">
                      Remove Devices from {pool.NAME}
                    </h6>
                    <p className="text-sm text-gray-700 mb-4">
                      Select devices to remove from this storage pool.
                      <span className="text-red-600 font-medium">
                        {' '}
                        Warning: Removing devices may affect pool performance and data redundancy.
                      </span>
                    </p>

                    {(() => {
                      // Collect removable devices from the pool (excluding data disks)
                      const removableDevices = [];

                      // Add L2ARC cache devices
                      if (zpoolStatus[pool.NAME]?.config?.caches) {
                        zpoolStatus[pool.NAME].config.caches.forEach((cache) => {
                          removableDevices.push({
                            name: cache.name,
                            state: cache.state,
                            type: 'L2ARC Cache',
                          });
                        });
                      }

                      // Add SLOG devices
                      if (zpoolStatus[pool.NAME]?.config?.logs) {
                        zpoolStatus[pool.NAME].config.logs.forEach((log) => {
                          // Handle both direct SLOG devices and SLOG with sub-disks
                          if (log.disks && log.disks.length > 0) {
                            log.disks.forEach((disk) => {
                              removableDevices.push({
                                name: disk.name,
                                state: disk.state,
                                type: 'SLOG Device',
                              });
                            });
                          } else {
                            removableDevices.push({
                              name: log.name,
                              state: log.state,
                              type: 'SLOG Device',
                            });
                          }
                        });
                      }

                      return removableDevices.length === 0 ? (
                        <div className="text-center py-4">
                          <div className="text-gray-500 mb-4">No devices available for removal</div>
                          <Button
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                            onClick={handleCancelRemoveDevices}
                          >
                            Close
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2 mb-4">
                            {removableDevices.map((device, index) => (
                              <label key={index} className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedRemoveDevices.includes(device.name)}
                                  onChange={(e) =>
                                    handleRemoveDeviceSelection(device.name, e.target.checked)
                                  }
                                  className="w-3 h-3 border border-gray-300 rounded focus:outline-none"
                                />
                                <span className="ml-2 text-sm text-gray-800 flex items-center">
                                  {device.state.toLowerCase() === 'online' ? (
                                    <div
                                      className="w-2 h-2 bg-green-500 rounded-full mr-2"
                                      title="Online"
                                    ></div>
                                  ) : null}
                                  <span>{device.name}</span>
                                  <span className="ml-2 text-xs text-gray-500">
                                    ({device.type})
                                  </span>
                                  {device.state.toLowerCase() !== 'online' && (
                                    <span className="ml-2 text-xs text-red-600">
                                      ({device.state})
                                    </span>
                                  )}
                                </span>
                              </label>
                            ))}
                          </div>

                          {selectedRemoveDevices.length > 0 && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                              <div className="text-sm font-medium text-red-800 mb-1">
                                Selected Devices for Removal: {selectedRemoveDevices.length}
                              </div>
                              <div className="text-sm text-red-700 mb-2">
                                {selectedRemoveDevices.map((device, index) => (
                                  <div key={index}>• {device}</div>
                                ))}
                              </div>
                              <div className="text-xs text-red-600">
                                This action will permanently remove these devices from the pool and
                                may affect data redundancy.
                              </div>
                            </div>
                          )}

                          <div className="flex gap-3">
                            <Button
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                              onClick={handleCancelRemoveDevices}
                              disabled={loadingRemoveDevices}
                            >
                              Cancel
                            </Button>
                            <Button
                              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                              onClick={() => handleRemoveDevices(pool.NAME)}
                              disabled={loadingRemoveDevices || selectedRemoveDevices.length === 0}
                            >
                              {loadingRemoveDevices ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Removing Devices...
                                </div>
                              ) : (
                                `Remove Device${selectedRemoveDevices.length > 1 ? 's' : ''}`
                              )}
                            </Button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="my-4 flex flex-col md:flex-row space-x-2 space-y-2" data-testid={`pool-action-buttons-${pool.NAME}`}>
                  {CAN_MANAGE && (
                    <Button
                      className="px-1 py-2 gap-1 h-full w-full lg:w-auto lg:h-auto text-white bg-emerald-600 rounded hover:bg-emerald-700 flex items-center"
                      onClick={() => setCreatingDataset(pool.NAME)}
                      data-testid={`create-dataset-button-${pool.NAME}`}
                    >
                      <Add size={24} color="#FFFFFF" /> Create Dataset
                      <Tooltip
                        iconColor="#FFFFFF"
                        text="Creating a ZFS dataset establishes a logical container within a pool for storing data, allowing you to apply specific properties like quotas, compression, and snapshots independently from the overall pool."
                      />
                    </Button>
                  )}

                  <Button
                    className="px-1 py-2 gap-2 text-white bg-karios-blue rounded hover:bg-blue-700 transition-opacity duration-200 flex items-center"
                    onClick={() => {
                      setShowingDatasets((prev) => ({ ...prev, [pool.NAME]: true }));
                      const selectedType = selectedDatasetTypes[pool.NAME] || null;
                      fetchDatasets(
                        selectedServer?.fqdn || selectedServer.ip,
                        pool.NAME,
                        selectedType
                      );
                    }}
                    disabled={loadingDatasets === pool.NAME}
                    data-testid={`view-datasets-button-${pool.NAME}`}
                  >
                    <Eye size={24} color="#FFFFFF" />
                    {loadingDatasets === pool.NAME ? 'Loading...' : 'View Datasets'}
                    <Tooltip
                      iconColor="#FFFFFF"
                      text="This will display Karios dataset, usage statistics, and other details, providing insight into its configuration and health within the ZFS storage system. You may also turn features like data deduplication and compression on/off here."
                    />
                  </Button>

                  {CAN_MANAGE && (
                    <Button
                      className="px-1 py-2 gap-2 text-white h-full w-full lg:w-auto lg:h-auto bg-yellow-500 rounded hover:bg-yellow-700 flex items-center"
                      onClick={() => setZvolPool(pool.NAME)}
                      data-testid={`create-zvol-button-${pool.NAME}`}
                    >
                      <FolderAdd size={24} color="#FFFFFF" /> Create Zvol
                      <Tooltip
                        iconColor="#FFFFFF"
                        text="Creating a ZVOL in ZFS establishes a block-level device within a pool, allowing you to present it as a virtual disk for applications like databases or virtualization."
                      />
                    </Button>
                  )}

                  {CAN_MANAGE && (
                    <Button
                      className="px-1 py-2 gap-2 h-full w-full lg:w-auto lg:h-full text-white bg-red-600 rounded hover:bg-red-700 flex items-center"
                      onClick={() => deletePool(pool.NAME)}
                      disabled={deletingPool === pool.NAME}
                      data-testid={`delete-pool-button-${pool.NAME}`}
                    >
                      <Trash size={24} color="#FFFFFF" />
                      {deletingPool === pool.NAME ? 'Deleting...' : 'Delete Pool'}
                      <Tooltip
                        iconColor="#FFFFFF"
                        text="Deleting a ZFS pool permanently removes all data and metadata stored within it, effectively destroying the entire storage volume."
                      />
                    </Button>
                  )}
                </div>

                {/* Dataset Creation Form */}
                {creatingDataset === pool.NAME && (
                  <div data-testid={`create-dataset-form-${pool.NAME}`}>
                    <CreateDataset
                    poolName={pool.NAME}
                    datasetName={datasetName}
                    setDatasetName={setDatasetName}
                    datasetEncryption={datasetEncryption}
                    setDatasetEncryption={setDatasetEncryption}
                    datasetPassphrase={datasetPassphrase}
                    setDatasetPassphrase={setDatasetPassphrase}
                    createDataset={() => createDataset(pool.NAME)}
                    setCreatingDataset={setCreatingDataset}
                  />
                  </div>
                )}

                {/* Zvol Creation Form */}
                {zvolPool === pool.NAME && (
                  <div data-testid={`create-zvol-form-${pool.NAME}`}>
                    <CreateZvol
                    pool={pool}
                    zvolName={zvolName}
                    setZvolName={setZvolName}
                    zvolSize={zvolSize}
                    setZvolSize={setZvolSize}
                    createZvol={(name, size) =>
                      createZvol(selectedServer?.fqdn || selectedServer.ip, pool.NAME, name, size)
                    }
                    setZvolPool={setZvolPool}
                    creatingZvol={creatingZvol}
                  />
                  </div>
                )}

                {/* Datasets View */}
                {showingDatasets[pool.NAME] && datasets[pool.NAME] && (
                  <div className="mt-3 bg-white p-2 rounded relative" data-testid={`datasets-section-${pool.NAME}`}>
                    <div className="flex justify-between items-center mb-2 gap-2">
                      <h4 className="text-lg font-semibold" data-testid={`datasets-header-${pool.NAME}`}>Datasets</h4>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedDatasetTypes[pool.NAME] || ''}
                          onChange={(e) => {
                            const newType = e.target.value || null;
                            setSelectedDatasetTypes({
                              ...selectedDatasetTypes,
                              [pool.NAME]: newType,
                            });
                            fetchDatasets(
                              selectedServer?.fqdn || selectedServer.ip,
                              pool.NAME,
                              newType
                            );
                          }}
                          className="text-lg border border-gray-100 rounded px-4 py-1"
                          data-testid={`dataset-type-filter-${pool.NAME}`}
                        >
                          <option value="">All Types</option>
                          <option value="filesystem">Filesystem</option>
                          <option value="volume">Volume</option>
                          <option value="snapshot">Snapshot</option>
                        </select>
                        <button
                          className="bg-red-700 text-white px-4 py-1 rounded"
                          onClick={() =>
                            setShowingDatasets((prev) => {
                              const updated = { ...prev };
                              delete updated[pool.NAME];
                              return updated;
                            })
                          }
                          data-testid={`datasets-close-button-${pool.NAME}`}
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {datasets[pool.NAME].length > 0 ? (
                      datasets[pool.NAME].map((dataset, i) => (
                        <DatasetItem
                          key={i}
                          dataset={dataset}
                          poolName={pool.NAME}
                          selectedDatasetType={selectedDatasetTypes[pool.NAME]}
                        />
                      ))
                    ) : (
                      <p className="text-xs text-gray-600">No datasets found.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for alerts and confirmations */}
      <Modal isOpen={modalState.isOpen} onClose={closeModal} title={modalState.title} data-testid="storage-modal">
        <div className="p-4">
          <p className="text-gray-700 mb-4">{modalState.message}</p>
          <div className="flex justify-end space-x-2">
            {modalState.type === 'confirm' ? (
              <>
                <button
                  onClick={() => {
                    if (modalState.onCancel) modalState.onCancel();
                    closeModal();
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (modalState.onConfirm) modalState.onConfirm();
                    closeModal();
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Confirm
                </button>
              </>
            ) : (
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                OK
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Datastore Confirmation Modal */}
      <DeleteDatastoreModal
        isOpen={isDeleteDatastoreModalOpen}
        datastoreToDelete={datastoreToDelete}
        onClose={cancelDeleteDatastore}
        onConfirmDelete={confirmDeleteDatastore}
      />

      {/* Delete Pool Confirmation Modal */}
      <DeletePoolModal
        isOpen={showDeletePoolModal}
        poolToDelete={poolToDelete}
        poolConfirmationText={poolConfirmationText}
        storagePools={storagePools}
        deletingPool={deletingPool}
        onClose={() => {
          setShowDeletePoolModal(false);
          setPoolToDelete(null);
          setPoolConfirmationText('');
        }}
        onConfirmationTextChange={setPoolConfirmationText}
        onConfirmDelete={confirmDeletePool}
      />

      {/* ZFS Pool Deletion Approval Modal */}
      <ApprovalModal
        isOpen={poolDeletionApprovalFlow.isModalOpen}
        onClose={poolDeletionApprovalFlow.closeModal}
        approvers={poolDeletionApprovalFlow.approvers}
        title="Approve ZFS Pool Deletion"
        message={`Please approve the deletion of the ZFS pool "${poolToDelete}".`}
        {...poolDeletionApprovalFlow.modalProps}
      />

      {/* Datastore Deletion Approval Modal */}
      <ApprovalModal
        isOpen={datastoreDeletionApprovalFlow.isModalOpen}
        onClose={datastoreDeletionApprovalFlow.closeModal}
        approvers={datastoreDeletionApprovalFlow.approvers}
        title="Approve Datastore Deletion"
        message={`Please approve the deletion of the datastore "${datastoreToDelete}".`}
        {...datastoreDeletionApprovalFlow.modalProps}
      />
    </div>
  );
}
