import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppState, ActionTypes } from '@karios-monorepo/shared-state';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import envConfig from '../../../../runtime-config';
import { toast } from 'react-toastify';
import K3sSetup from './K3sSetup';
import OpenShiftSetup from './OpenShiftSetup';
import { DnsZoneDropdown } from './shared';
import BootstrapControlPlaneConfiguration from './BootstrapControlPlaneConfiguration';
import AdditionalControlPlaneConfiguration from './AdditionalControlPlaneConfiguration';
import WorkerConfiguration from './WorkerConfiguration';
import { logger } from '../../../shared-state/src/utils/logger';
import api from '../../../shared-state/src/utils/interceptor';
import { FaChevronDown, FaExclamationCircle } from 'react-icons/fa';
import JobStatusModal from '../../../feature-datacenter/src/JobStatusModal';

interface K8sSetupProps {
  dataCenters?: any[];
}
interface OmniPrereqs {
  Certs: boolean;
  Keycloak: boolean;
  OmniServer: boolean;
}

const K8sSetup: React.FC<K8sSetupProps> = ({ dataCenters = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch, performVmActionWebSocket, fetchVMsForServer } = useAppState();
  const [step, setStep] = useState<number>(0);
  const [provisioningType, setProvisioningType] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastOperationTimestamp, setLastOperationTimestamp] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isNavigatingToCluster, setIsNavigatingToCluster] = useState<boolean>(false);

  // Job Status Modal state
  const [isJobModalOpen, setIsJobModalOpen] = useState<boolean>(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentJobType, setCurrentJobType] = useState<string | null>(null);

  // VM management state
  const [refreshingVms, setRefreshingVms] = useState<{ [vmName: string]: boolean }>({});
  const [createdVms, setCreatedVms] = useState<
    Array<{
      name: string;
      serverIp: string;
      state: string;
      clusterName: string;
    }>
  >([]);

  // Track creation errors for individual VMs/nodes
  const [creationErrors, setCreationErrors] = useState<
    Array<{
      nodeName: string;
      nodeType: string; // 'control-plane', 'worker', etc.
      error: string;
    }>
  >([]);

  // WebSocket connections for VM list updates
  const [activeWebSockets, setActiveWebSockets] = useState<{ [serverIp: string]: boolean }>({});

  // Track last sync time to prevent too frequent updates
  const lastSyncRef = useRef<number>(0);
  const SYNC_THROTTLE_MS = 1000; // Minimum 1 second between syncs

  // Track VMs in transition states
  const isVmInTransition = (vmName: string): boolean => {
    return refreshingVms[vmName] || false;
  };

  // Omni prerequisites state
  const [omniPrereqs, setOmniPrereqs] = useState<OmniPrereqs | null>(null);
  const [isLoadingOmniPrereqs, setIsLoadingOmniPrereqs] = useState<boolean>(false);

  // Function to get real-time VM state from datacenter data
  const getRealTimeVmState = (vmName: string, serverIp: string): string => {
    const server = dataCenters.flatMap((dc) => dc.servers).find((s) => s.ip === serverIp);

    if (server && server.vms) {
      const vm = server.vms.find((vm) => vm.name === vmName);
      if (vm) {
        return vm.state || 'Unknown';
      }
    }

    // Fallback to local state if not found in datacenter data
    const localVm = createdVms.find((vm) => vm.name === vmName && vm.serverIp === serverIp);
    const localState = localVm?.state || 'Unknown';
    return localState;
  };

  // Memoize VM states to prevent unnecessary effect runs
  const vmStatesSignature = useMemo(() => {
    if (dataCenters.length === 0) return '';
    return dataCenters
      .flatMap((dc) => dc.servers)
      .flatMap((server) => server.vms || [])
      .map((vm) => `${vm.name}:${vm.state}`)
      .sort()
      .join('|');
  }, [dataCenters]);

  // Sync local VM states with datacenter data
  useEffect(() => {
    const now = Date.now();

    // Throttle sync to prevent excessive updates
    if (now - lastSyncRef.current < SYNC_THROTTLE_MS) {
      return;
    }

    if (createdVms.length > 0 && dataCenters.length > 0) {
      let hasChanges = false;
      const updatedVms = createdVms.map((localVm) => {
        const realTimeState = getRealTimeVmState(localVm.name, localVm.serverIp);
        if (realTimeState !== 'Unknown' && realTimeState !== localVm.state) {
          hasChanges = true;
          return { ...localVm, state: realTimeState };
        }
        return localVm;
      });

      // Only update if there are actual changes
      if (hasChanges) {
        setCreatedVms(updatedVms);
        lastSyncRef.current = now;
      }
    }
  }, [vmStatesSignature]); // Only trigger when VM states actually change

  // Memoize created VMs signature to prevent unnecessary WebSocket setup
  const createdVmsSignature = useMemo(() => {
    return createdVms
      .map((vm) => `${vm.name}-${vm.serverIp}`)
      .sort()
      .join('|');
  }, [createdVms]);

  // Setup WebSocket connections for real-time VM updates when VMs are created
  // Setup WebSocket connections for real-time VM updates when VMs are created or when performing actions
  useEffect(() => {
    if (createdVms.length > 0) {
      // Get unique server IPs from created VMs
      const uniqueServerIps = [...new Set(createdVms.map((vm) => vm.serverIp))];

      uniqueServerIps.forEach((serverIp) => {
        // Check if WebSocket is already active for this server
        if (!activeWebSockets[serverIp]) {
          // Find the server object
          const server = dataCenters.flatMap((dc) => dc.servers).find((s) => s.ip === serverIp);

          if (server) {
            // Mark this server as having an active WebSocket connection
            setActiveWebSockets((prev) => ({ ...prev, [serverIp]: true }));
          }
        }
      });
    }

    // Also setup WebSocket connections for servers that have any cluster VMs (not just newly created ones)
    // This ensures real-time updates for existing VMs when performing actions
    if (dataCenters && dataCenters.length > 0) {
      dataCenters.forEach((dc) => {
        if (dc.servers && Array.isArray(dc.servers)) {
          dc.servers.forEach((server) => {
            if (server && server.vms && Array.isArray(server.vms)) {
              // Check if this server has any VMs that match our cluster naming pattern
              const hasClusterVms = server.vms.some(
                (vm) =>
                  vm.name &&
                  (vm.name.includes('k8s-') || vm.name.includes('ub-') || vm.name.includes('op-'))
              );

              if (hasClusterVms && !activeWebSockets[server.ip]) {
                setActiveWebSockets((prev) => ({ ...prev, [server.ip]: true }));
              }
            }
          });
        }
      });
    }
  }, [createdVmsSignature]); // Only trigger when created VMs actually change, not on every render
  // Cleanup WebSocket connections when component unmounts
  useEffect(() => {
    return () => {
      // Clear active WebSocket tracking on unmount
      setActiveWebSockets({});
    };
  }, []);

  // Check URL parameters to set initial provisioning type and step
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const typeParam = urlParams.get('type');

    if (
      typeParam === 'openshift' ||
      typeParam === 'ubuntu' ||
      typeParam === 'k3s' ||
      typeParam === 'anthos'
    ) {
      setProvisioningType(typeParam);
      // No need to set step since we're using single-page interfaces
    }
  }, [location.search]);

  // Separate basic configuration state for Ubuntu and OpenShift
  const [ubuntuBasicConfig, setUbuntuBasicConfig] = useState({
    k8sName: '',
    selectedServerIp: '',
    selectedPool: '',
    selectedNetworkSwitch: '',
    datastore: '',
  });

  const [k3sBasicConfig, setK3sBasicConfig] = useState({
    k8sName: '',
    selectedServerIp: '',
    selectedPool: '',
    selectedNetworkSwitch: '',
    datastore: '',
  });

  const [openshiftBasicConfig, setOpenshiftBasicConfig] = useState({
    k8sName: '',
    selectedServerIp: '',
    selectedPool: '',
    selectedNetworkSwitch: '',
    datastore: '',
  });

  // Storage & Network configuration state
  const [pools, setPools] = useState<any[]>([]);
  const [networkSwitches, setNetworkSwitches] = useState<string[]>([]);

  // Separate storage & network state for control plane
  const [controlPlanePools, setControlPlanePools] = useState<any[]>([]);
  const [controlPlaneNetworkSwitches, setControlPlaneNetworkSwitches] = useState<string[]>([]);

  // Hardware configuration state - separate for Ubuntu, K3S and OpenShift
  const [ubuntuMaster, setUbuntuMaster] = useState({
    name: '',
    cpuCores: 4,
    memoryGB: 8,
    diskSizeGB: 40,
    prometheusandgrafanaEnabled: false,
    argocdEnabled: false,
    frigateEnabled: false,
    frigateGpuEnabled: false,
    frigateCpuEnabled: false,
    frigateCameraIp: '',
    frigateCameraUsername: '',
    frigateCameraPassword: '',
  });

  const [k3sMaster, setK3sMaster] = useState({
    name: '',
    cpuCores: 2,
    memoryGB: 4,
    diskSizeGB: 40,
    prometheusandgrafanaEnabled: false,
    argocdEnabled: false,
  });

  // OpenShift supports multiple masters - array of master configurations
  const [openshiftMasterNodes, setOpenshiftMasterNodes] = useState<
    Array<{
      id: string;
      name: string;
      selectedServerIp?: string;
      selectedPool?: string;
      selectedNetworkSwitch?: string;
      cpuCores: number;
      memoryGB: number;
      diskSizeGB: number;
    }>
  >([]);

  // Current master being configured for OpenShift
  const [openshiftCurrentMaster, setOpenshiftCurrentMaster] = useState({
    name: '',
    selectedServerIp: '',
    selectedPool: '',
    selectedNetworkSwitch: '',
    cpuCores: 4,
    memoryGB: 16,
    diskSizeGB: 120,
  });

  const [isAddingMaster, setIsAddingMaster] = useState<boolean>(false);

  // Worker configuration state - separate for Ubuntu, K3S and OpenShift
  const [ubuntuWorkerNodes, setUbuntuWorkerNodes] = useState<
    Array<{
      id: string;
      cpuCores: number;
      memoryGB: number;
      diskSizeGB: number;
      name: string;
    }>
  >([]);

  const [k3sWorkerNodes, setK3sWorkerNodes] = useState<
    Array<{
      id: string;
      cpuCores: number;
      memoryGB: number;
      diskSizeGB: number;
      name: string;
      selectedServerIp?: string;
      selectedPool?: string;
      selectedNetworkSwitch?: string;
    }>
  >([]);

  const [openshiftWorkerNodes, setOpenshiftWorkerNodes] = useState<
    Array<{
      id: string;
      selectedServerIp?: string;
      selectedPool?: string;
      selectedNetworkSwitch?: string;
      cpuCores: number;
      memoryGB: number;
      diskSizeGB: number;
      name: string;
      masterId: string; // Associate worker with a specific master
      domain?: string; // DNS domain for the worker
    }>
  >([]);

  // Separate current worker states for Ubuntu, K3S and OpenShift
  const [ubuntuCurrentWorker, setUbuntuCurrentWorker] = useState<{
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
    name: string;
  }>({
    cpuCores: 4,
    memoryGB: 8,
    diskSizeGB: 40,
    name: '',
  });

  const [openshiftCurrentWorker, setOpenshiftCurrentWorker] = useState<{
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
    name: string;
    masterId: string; // Track which master this worker is being added to
    domain: string; // DNS domain for the worker
  }>({
    selectedServerIp: '',
    selectedPool: '',
    selectedNetworkSwitch: '',
    cpuCores: 4,
    memoryGB: 8,
    diskSizeGB: 120,
    name: '',
    masterId: '',
    domain: '',
  });

  // HAProxy setup state for OpenShift
  const [setupHAProxy, setSetupHAProxy] = useState<boolean>(false);
  const [haproxyStatus, setHAProxyStatus] = useState<{
    isLoading: boolean;
    success: boolean;
    response: any;
    error: string | null;
    progress: number;
    progressMessage: string;
  }>({
    isLoading: false,
    success: false,
    response: null,
    error: null,
    progress: 0,
    progressMessage: '',
  });

  // User Configuration state (Ubuntu only)
  const [ubuntuUser, setUbuntuUser] = useState({
    username: '',
    password: '',
    sshKey: '',
  });

  // User Configuration state (K3S only)
  const [k3sUser, setK3sUser] = useState({
    username: '',
    password: '',
    sshKey: '',
  });

  // ISO-related state for Ubuntu
  const [isoList, setIsoList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedIso, setSelectedIso] = useState<string>('');
  const [isoLoading, setIsoLoading] = useState<boolean>(false);
  const [isoDropdownOpen, setIsoDropdownOpen] = useState<boolean>(false);

  // Password visibility state for Ubuntu
  const [showUbuntuPassword, setShowUbuntuPassword] = useState<boolean>(false);
  const [showFrigateCameraPassword, setShowFrigateCameraPassword] = useState<boolean>(false);

  // Field-level validation errors state
  const [fieldErrors, setFieldErrors] = useState<{
    [key: string]: string | undefined;
    clusterName?: string;
    serverIp?: string;
    storagePool?: string;
    networkSwitch?: string;
    controlPlaneName?: string;
    cpuCores?: string;
    memory?: string;
    diskSize?: string;
    username?: string;
    password?: string;
    workerNodes?: string;
  }>({});

  // Network Configuration state - separate for Ubuntu and OpenShift
  const [ubuntuNetwork, setUbuntuNetwork] = useState({
    domainName: '',
    staticIp: '',
    gateway: '',
    nameservers: '',
  });

  // Get all available servers from data centers
  const allServers =
    state.dataCenters && Array.isArray(state.dataCenters)
      ? state.dataCenters.flatMap((dc: any) =>
          Array.isArray(dc.servers) ? dc.servers.filter((server: any) => server && server.ip) : []
        )
      : [];

  // Helper function to get server address (FQDN with IP fallback)
  const getServerAddress = (serverIp: string): string => {
    const server = allServers.find((s) => s.ip === serverIp || s.fqdn === serverIp);
    return server ? server.fqdn || server.ip : serverIp;
  };

  // Cache for server-specific data to avoid redundant API calls
  const [serverDataCache, setServerDataCache] = useState<{
    [serverIp: string]: {
      nodeInfo: any;
      pools: any[];
      networkSwitches: string[];
    };
  }>({});

  // Cluster name validation state (similar to VM name validation)
  const [validationTimeouts, setValidationTimeouts] = useState<{ [key: string]: number }>({});
  const [allClusters, setAllClusters] = useState<any[]>([]);

  // Function to validate cluster name (similar to VM name validation pattern)
  const validateClusterName = (
    value: string,
    clusterType: 'ubuntu' | 'openshift' | 'omni' | 'k3s'
  ): string => {
    // Basic validation - check if there's content after prefix
    const prefix = clusterType === 'ubuntu' ? 'ub-' : clusterType === 'openshift' ? 'op-' : 'om-';

    // Extract the base name (without prefix)
    const baseName = value.substring(prefix.length).trim();
    if (!baseName) {
      return `Please enter a cluster name`;
    }

    // OpenShift specific validation - cluster name cannot exceed 6 characters
    if (clusterType === 'openshift' && baseName.length > 6) {
      return `OpenShift cluster name cannot exceed 6 characters (currently ${baseName.length})`;
    }

    // Check against existing clusters
    if (allClusters.length > 0) {
      const existingCluster = allClusters.find(
        (cluster: any) => cluster.KubernetesClusterName === value.trim()
      );

      if (existingCluster) {
        return `Cluster name '${value}' already exists. Please choose a different name.`;
      }
    }

    return '';
  };

  // Function to handle cluster name validation with debouncing for API calls
  const handleClusterNameValidation = React.useCallback(
    async (value: string, clusterType: 'ubuntu' | 'openshift' | 'omni' | 'k3s') => {
      // Clear existing timeout for this field
      if (validationTimeouts['clusterName']) {
        clearTimeout(validationTimeouts['clusterName']);
      }

      // Immediate basic validation (like VM name validation)
      const basicError = validateClusterName(value, clusterType);
      setFieldErrors((prev) => ({ ...prev, clusterName: basicError }));

      // If basic validation fails, don't proceed with API call
      if (basicError) {
        return;
      }

      // Set a timeout for API validation to debounce the request (only for API refresh)
      const timeoutId = window.setTimeout(async () => {
        try {
          // Call API to get latest cluster list
          const response = await fetch(
            `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            setAllClusters(data.clusters || []);

            // Re-validate with fresh data
            const freshError = validateClusterName(value, clusterType);
            setFieldErrors((prev) => ({ ...prev, clusterName: freshError }));
          } else {
            logger.warn('Failed to fetch cluster info', { status: response.statusText });
            // Don't show error to user for API failures during validation
          }
        } catch (error) {
          logger.error('Error fetching cluster info', error);
          // Don't show error to user for API failures during validation
        }
      }, 500); // 500ms debounce

      setValidationTimeouts((prev) => ({
        ...prev,
        clusterName: timeoutId,
      }));
    },
    [validationTimeouts, allClusters]
  );

  // Fetch initial cluster data when component mounts
  useEffect(() => {
    const fetchInitialClusterData = async () => {
      try {
        const response = await fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setAllClusters(data.clusters || []);
        }
      } catch (error) {
        logger.error('Error fetching initial cluster data', error);
      }
    };

    fetchInitialClusterData();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clean up validation timeouts
      Object.values(validationTimeouts).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [validationTimeouts]);

  // Function to check Omni prerequisites
  const checkOmniPrereqs = async () => {
    if (isLoadingOmniPrereqs) return; // Prevent multiple concurrent calls

    setIsLoadingOmniPrereqs(true);
    try {
      const url = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/check/omni_prereqs`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setOmniPrereqs(result);
      } else {
        logger.error('Failed to check Omni prerequisites', { status: response.status });
        // Set default values if API fails
        setOmniPrereqs({ Certs: false, Keycloak: false, OmniServer: false });
      }
    } catch (error) {
      logger.error('Error checking Omni prerequisites', error);
      // Set default values if API fails
      setOmniPrereqs({ Certs: false, Keycloak: false, OmniServer: false });
    } finally {
      setIsLoadingOmniPrereqs(false);
    }
  };

  // Check prerequisites when component mounts
  useEffect(() => {
    checkOmniPrereqs();
  }, []);

  // Track server resource usage for validation
  const [serverResourceUsage, setServerResourceUsage] = useState<{
    [serverIp: string]: {
      totalCpus: number;
      totalMemory: number;
      usedCpus: number;
      usedMemory: number;
      allocatedCpus: number; // Resources allocated by current configuration
      allocatedMemory: number;
    };
  }>({});

  // Helper functions to get current configuration based on provisioning type
  const getCurrentBasicConfig = () => {
    return provisioningType === 'ubuntu'
      ? ubuntuBasicConfig
      : provisioningType === 'k3s'
        ? k3sBasicConfig
        : openshiftBasicConfig;
  };

  const updateCurrentBasicConfig = (field: string, value: string) => {
    if (provisioningType === 'ubuntu') {
      setUbuntuBasicConfig((prev) => ({ ...prev, [field]: value }));
    } else if (provisioningType === 'k3s') {
      setK3sBasicConfig((prev) => ({ ...prev, [field]: value }));
    } else {
      setOpenshiftBasicConfig((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Helper function to validate Ubuntu username
  const validateUbuntuUsername = (username: string): string | undefined => {
    if (!username) return undefined;
    const lowerUsername = username.toLowerCase().trim();
    if (lowerUsername === 'admin' || lowerUsername === 'root') {
      return 'For Ubuntu, the username cannot be admin or root';
    }
    return undefined;
  };

  // Helper function to validate Ubuntu password
  const validateUbuntuPassword = (password: string): string | undefined => {
    if (!password) return undefined;
    if (password.length < 6) {
      return 'Password must be at least 6 characters for Ubuntu provisioning';
    }
    return undefined;
  };

  // Function to handle canceling control plane add/edit for Ubuntu
  const cancelControlPlaneOperation = () => {
    if (editingControlPlaneId && editingControlPlaneOriginal) {
      // If we were editing, restore the original control plane to the list
      setAdditionalControlPlaneConfigs((prev) => [...prev, editingControlPlaneOriginal]);
      setEditingControlPlaneId(null);
      setEditingControlPlaneOriginal(null);
    }
    // Reset the current control plane form
    setCurrentAdditionalControlPlaneConfig({
      name: '',
      selectedServerIp: '',
      selectedPool: '',
      selectedNetworkSwitch: '',
      cpuCores: 4,
      memoryGB: 8,
      diskSizeGB: 40,
    });
    setIsAdditionalControlPlaneModalOpen(false);
  };

  // Function to handle canceling worker add/edit for Ubuntu
  const cancelWorkerOperation = () => {
    if (isEditingWorker && editingWorkerOriginal) {
      // If we were editing, restore the original worker to the list
      setConfiguredWorkers((prev) => [...prev, editingWorkerOriginal]);
      setIsEditingWorker(false);
      setEditingWorkerOriginal(null);
    }
    // Reset the current worker form
    setCurrentWorkerConfig({
      name: '',
      selectedServerIp: '',
      selectedPool: '',
      selectedNetworkSwitch: '',
      cpuCores: 2,
      memoryGB: 4,
      diskSizeGB: 40,
    });
    setIsWorkerModalOpen(false);
  };

  // Helper function to count total control planes for Ubuntu
  const getUbuntuControlPlaneCount = () => {
    let count = 0;
    // Count bootstrap control plane (controlPlaneConfig represents the main/bootstrap control plane)
    if (controlPlaneConfig) {
      count += 1;
    }
    // Count additional control planes
    count += additionalControlPlaneConfigs.length;
    return count;
  };

  // Helper function to count total control planes for OpenShift
  const getOpenshiftControlPlaneCount = () => {
    let count = openshiftMasterNodes.length;
    // Add current master if it's valid but not yet added
    if (
      openshiftCurrentMaster.selectedServerIp &&
      openshiftCurrentMaster.selectedNetworkSwitch &&
      openshiftCurrentMaster.cpuCores >= 4 &&
      openshiftCurrentMaster.memoryGB >= 16 &&
      openshiftCurrentMaster.diskSizeGB >= 120
    ) {
      count += 1;
    }
    return count;
  };

  // Get control plane validation error message without updating state
  const getControlPlaneValidationError = () => {
    if (provisioningType === 'ubuntu') {
      const count = getUbuntuControlPlaneCount();
      if (count > 0 && count % 2 === 0) {
        return `You have created ${count} control plane${count === 1 ? '' : 's'}. It should be an odd number of control planes (1, 3, 5, …)`;
      }
    } else if (provisioningType === 'openshift') {
      const count = getOpenshiftControlPlaneCount();
      if (count > 0 && count % 2 === 0) {
        return `You have created ${count} control plane${count === 1 ? '' : 's'}. It should be an odd number of control planes (1, 3, 5, …)`;
      }
    }
    return '';
  };

  // Validation function for odd number of control planes
  const validateOddControlPlanes = () => {
    return getControlPlaneValidationError() === '';
  };

  // Check if HAProxy can be enabled (requires at least 1 control plane and 1 worker)
  const canEnableHAProxy = () => {
    // Check if we have at least one control plane
    const hasControlPlane =
      openshiftMasterNodes.length > 0 ||
      (openshiftCurrentMaster.selectedServerIp && openshiftCurrentMaster.selectedNetworkSwitch);

    // Check if we have at least one worker
    const hasWorker = openshiftWorkerNodes.length > 0;

    return hasControlPlane && hasWorker;
  };

  // Node info state for selected server
  const [nodeInfo, setNodeInfo] = useState<{
    cpus: number;
    sockets: number;
    memory: number;
    cpus_in_use: number;
    memory_in_use: number;
    min_cpu_control_plane?: number;
    min_memory_control_plane?: number;
    min_disk_control_plane?: number;
    min_cpu_worker?: number;
    min_memory_worker?: number;
    min_disk_worker?: number;
  } | null>(null);

  // Separate node info state for control plane
  const [controlPlaneNodeInfo, setControlPlaneNodeInfo] = useState<{
    cpus: number;
    sockets: number;
    memory: number;
    cpus_in_use: number;
    memory_in_use: number;
    min_cpu_control_plane?: number;
    min_memory_control_plane?: number;
    min_disk_control_plane?: number;
    min_cpu_worker?: number;
    min_memory_worker?: number;
    min_disk_worker?: number;
  } | null>(null);

  // Master control plane configuration modal state
  const [isControlPlaneModalOpen, setIsControlPlaneModalOpen] = useState<boolean>(false);
  const [controlPlaneConfig, setControlPlaneConfig] = useState<{
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
    prometheusandgrafanaEnabled: boolean;
    argocdEnabled: boolean;
    frigateEnabled: boolean;
    frigateGpuEnabled: boolean;
    frigateCpuEnabled: boolean;
    frigateCameraIp: string;
    frigateCameraUsername: string;
    frigateCameraPassword: string;
  } | null>(null);

  // Control plane current configuration state (separate from worker)
  const [currentControlPlaneConfig, setCurrentControlPlaneConfig] = useState<{
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
  }>({
    name: '',
    selectedServerIp: '',
    selectedPool: '',
    selectedNetworkSwitch: '',
    cpuCores: 4,
    memoryGB: 8,
    diskSizeGB: 40,
  });

  // Additional Control Plane configuration modal state (for Ubuntu)
  const [isAdditionalControlPlaneModalOpen, setIsAdditionalControlPlaneModalOpen] =
    useState<boolean>(false);
  const [editingControlPlaneId, setEditingControlPlaneId] = useState<string | null>(null);
  const [editingControlPlaneOriginal, setEditingControlPlaneOriginal] = useState<{
    id: string;
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
  } | null>(null);
  const [additionalControlPlaneConfigs, setAdditionalControlPlaneConfigs] = useState<
    Array<{
      id: string;
      name: string;
      selectedServerIp: string;
      selectedPool: string;
      selectedNetworkSwitch: string;
      cpuCores: number;
      memoryGB: number;
      diskSizeGB: number;
    }>
  >([]);

  // Additional Control plane current configuration state
  const [currentAdditionalControlPlaneConfig, setCurrentAdditionalControlPlaneConfig] = useState<{
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
  }>({
    name: '',
    selectedServerIp: '',
    selectedPool: '',
    selectedNetworkSwitch: '',
    cpuCores: 4,
    memoryGB: 8,
    diskSizeGB: 40,
  });

  // Worker configuration modal state
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState<boolean>(false);
  const [isEditingWorker, setIsEditingWorker] = useState<boolean>(false);
  const [editingWorkerOriginal, setEditingWorkerOriginal] = useState<any>(null);
  const [currentWorkerConfig, setCurrentWorkerConfig] = useState<{
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
  }>({
    name: '',
    selectedServerIp: '',
    selectedPool: '',
    selectedNetworkSwitch: '',
    cpuCores: 2,
    memoryGB: 4,
    diskSizeGB: 40,
  });

  const [configuredWorkers, setConfiguredWorkers] = useState<
    Array<{
      id: string;
      name: string;
      selectedServerIp: string;
      selectedPool: string;
      selectedNetworkSwitch: string;
      cpuCores: number;
      memoryGB: number;
      diskSizeGB: number;
    }>
  >([]);

  // States for editing workers
  const [isEditingOpenshiftWorker, setIsEditingOpenshiftWorker] = useState<boolean>(false);
  const [editingOpenshiftWorkerOriginal, setEditingOpenshiftWorkerOriginal] = useState<any>(null);

  // Worker group count tracking for inline count inputs
  const [workerGroupCounts, setWorkerGroupCounts] = useState<{ [configKey: string]: number }>({});

  // Track input field values (can be empty string while typing)
  const [workerGroupInputs, setWorkerGroupInputs] = useState<{ [configKey: string]: string }>({});

  // Control plane group count tracking for inline count inputs
  const [controlPlaneGroupCounts, setControlPlaneGroupCounts] = useState<{
    [configKey: string]: number;
  }>({});

  // Track control plane input field values (can be empty string while typing)
  const [controlPlaneGroupInputs, setControlPlaneGroupInputs] = useState<{
    [configKey: string]: string;
  }>({});

  // Helper function to generate next worker name
  const getNextWorkerName = (isUbuntu: boolean, clusterName: string) => {
    if (!clusterName) {
      return isUbuntu ? 'ub-clustername-worker1' : 'op-clustername-worker1';
    }

    // The cluster name should already have the prefix from the input field
    const existingWorkers = isUbuntu ? configuredWorkers : openshiftWorkerNodes;
    const maxNumber = existingWorkers
      .map((w) => {
        // Extract number from worker names with various formats
        const match = w.name.match(/worker(\d+)$/) || w.name.match(/-worker(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .reduce((max, num) => Math.max(max, num), 0);
    return `${clusterName}-worker${maxNumber + 1}`;
  };

  // Helper function to generate next Ubuntu additional control plane name
  const getNextUbuntuControlPlaneName = (clusterName: string) => {
    if (!clusterName) {
      return 'ub-clustername-controlplane2';
    }

    // Start from 2 since master is controlplane1 (implied)
    const existingNumbers = additionalControlPlaneConfigs
      .map((cp) => {
        // Extract number from controlplane names
        const match = cp.name.match(/controlplane(\d+)$/) || cp.name.match(/-controlplane(\d+)$/);
        if (match) {
          return parseInt(match[1]);
        }
        // If no number, check if it's just "controlplane" (which should be treated as 1)
        if (cp.name.endsWith('controlplane') || cp.name.endsWith('-controlplane')) {
          return 1;
        }
        return 0;
      })
      .filter((num) => num > 0);

    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 1;
    const nextNumber = maxNumber + 1;

    return `${clusterName}-controlplane${nextNumber}`;
  };

  // Helper function to generate Ubuntu control plane name
  const getUbuntuControlPlaneName = (clusterName: string) => {
    if (!clusterName) {
      return 'ub-clustername-controlplane';
    }

    // The cluster name should already have the prefix from the input field
    // Just append controlplane to the cluster name
    return `${clusterName}-controlplane`;
  };

  // Helper function to renumber Ubuntu control planes after deletion
  const renumberUbuntuControlPlanes = (
    controlPlanes: typeof additionalControlPlaneConfigs,
    clusterName: string
  ) => {
    // Sort control planes by their current number to maintain order
    const sortedControlPlanes = controlPlanes
      .map((cp) => {
        const match = cp.name.match(/controlplane(\d+)$/) || cp.name.match(/-controlplane(\d+)$/);
        const currentNumber = match ? parseInt(match[1]) : 1;
        return { ...cp, currentNumber };
      })
      .sort((a, b) => a.currentNumber - b.currentNumber);

    // Renumber starting from 2 (since main control plane is 1)
    return sortedControlPlanes.map((cp, index) => {
      const newNumber = index + 2;
      const baseName = clusterName || 'ub-clustername';
      const newName = `${baseName}-controlplane${newNumber}`;

      return {
        ...cp,
        name: newName,
      };
    });
  };

  // Helper function to renumber legacy Ubuntu workers (configuredWorkers) after deletion
  const renumberConfiguredWorkers = (workers: typeof configuredWorkers, clusterName: string) => {
    // Sort workers by their current number to maintain order
    const sortedWorkers = workers
      .map((worker) => {
        const match = worker.name.match(/worker(\d+)$/) || worker.name.match(/-worker(\d+)$/);
        const currentNumber = match ? parseInt(match[1]) : 1;
        return { ...worker, currentNumber };
      })
      .sort((a, b) => a.currentNumber - b.currentNumber);

    // Renumber starting from 1
    return sortedWorkers.map((worker, index) => {
      const newNumber = index + 1;
      const baseName = clusterName || 'ub-clustername';
      const newName = `${baseName}-worker${newNumber}`;

      // Remove the temporary currentNumber property and return proper worker object
      const { currentNumber, ...workerWithoutTempProp } = worker;
      return {
        ...workerWithoutTempProp,
        name: newName,
      };
    });
  };

  // Reset selections when component mounts
  useEffect(() => {
    dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: null });
    dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: null });
  }, [dispatch]);

  // Set default cluster names with proper prefixes
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const typeParam = urlParams.get('type');

    if (typeParam === 'ubuntu' && !ubuntuBasicConfig.k8sName) {
      setUbuntuBasicConfig((prev) => ({ ...prev, k8sName: 'ub-' }));
    } else if (typeParam === 'k3s' && !k3sBasicConfig.k8sName) {
      setK3sBasicConfig((prev) => ({ ...prev, k8sName: 'k3s-' }));
    } else if (typeParam === 'openshift' && !openshiftBasicConfig.k8sName) {
      setOpenshiftBasicConfig((prev) => ({ ...prev, k8sName: 'op-' }));
    }
  }, [location.search]); // Remove the cluster name dependencies to prevent infinite re-renders

  // Fetch node info when server is selected
  const fetchNodeInfo = async (serverIp: string) => {
    if (!serverIp) {
      setNodeInfo(null);
      return;
    }

    // Check cache first
    if (serverDataCache[serverIp]?.nodeInfo) {
      setNodeInfo(serverDataCache[serverIp].nodeInfo);
      // Also update resource usage state from cache
      const nodeData = serverDataCache[serverIp].nodeInfo;
      setServerResourceUsage((prev) => ({
        ...prev,
        [serverIp]: {
          totalCpus: nodeData.cpus || 0,
          totalMemory: nodeData.memory || 0,
          usedCpus: nodeData.cpus_in_use || 0,
          usedMemory: nodeData.memory_in_use || 0,
          allocatedCpus: 0, // Will be calculated separately
          allocatedMemory: 0,
        },
      }));
      return;
    }

    try {
      // Get server address (FQDN with IP fallback)
      const serverAddress = getServerAddress(serverIp);

      const res = await fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/nodeinfo`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      setNodeInfo(data);

      // Update server resource usage state
      setServerResourceUsage((prev) => ({
        ...prev,
        [serverIp]: {
          totalCpus: data.cpus || 0,
          totalMemory: data.memory || 0,
          usedCpus: data.cpus_in_use || 0,
          usedMemory: data.memory_in_use || 0,
          allocatedCpus: 0, // Will be calculated separately
          allocatedMemory: 0,
        },
      }));

      // Cache the result
      setServerDataCache((prev) => ({
        ...prev,
        [serverIp]: {
          ...prev[serverIp],
          nodeInfo: data,
        },
      }));
    } catch (error) {
      setNodeInfo(null);
    }
  };

  // Fetch server-specific data (storage pools and network switches)
  const fetchServerSpecificData = async (serverIp: string) => {
    if (!serverIp) {
      setPools([]);
      setNetworkSwitches([]);
      return;
    }

    // Check cache first
    if (serverDataCache[serverIp]?.pools && serverDataCache[serverIp]?.networkSwitches) {
      setPools(serverDataCache[serverIp].pools);
      setNetworkSwitches(serverDataCache[serverIp].networkSwitches);
      return;
    }

    try {
      // Get server address (FQDN with IP fallback)
      const serverAddress = getServerAddress(serverIp);

      // Fetch VM datastores (replaces old pools API)
      const poolsRes = await fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      let poolsData: any = [];
      if (poolsRes.ok) {
        const data = await poolsRes.json();
        // Handle both array format and new object format with datastores property
        poolsData = Array.isArray(data) ? data : data.datastores || [];
        setPools(poolsData);
      }

      // Fetch network switches
      const switchesRes = await fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      let switches = [];
      if (switchesRes.ok) {
        const switchesData = await switchesRes.json();
        switches = Array.isArray(switchesData) ? switchesData.map((sw: any) => sw.name) : [];
        setNetworkSwitches(switches);
      }

      // Cache the results
      setServerDataCache((prev) => ({
        ...prev,
        [serverIp]: {
          ...prev[serverIp],
          pools: poolsData,
          networkSwitches: switches,
        },
      }));
    } catch (error) {
      logger.error('Error fetching server-specific data', error);
    }
  };

  // Separate fetch functions for control plane
  const fetchControlPlaneServerData = async (serverIp: string) => {
    if (!serverIp) {
      setControlPlanePools([]);
      setControlPlaneNetworkSwitches([]);
      return;
    }

    try {
      // Get server address (FQDN with IP fallback)
      const serverAddress = getServerAddress(serverIp);

      // Fetch VM datastores for control plane (replaces old pools API)
      const poolsRes = await fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      if (poolsRes.ok) {
        const poolsData = await poolsRes.json();
        // Handle both array format and new object format with datastores property
        const datastoresArray = Array.isArray(poolsData) ? poolsData : poolsData.datastores || [];
        setControlPlanePools(datastoresArray);
      }

      // Fetch network switches for control plane
      const switchesRes = await fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      if (switchesRes.ok) {
        const switchesData = await switchesRes.json();
        const switches = Array.isArray(switchesData) ? switchesData.map((sw: any) => sw.name) : [];
        setControlPlaneNetworkSwitches(switches);
      }
    } catch (error) {
      logger.error('Error fetching control plane server data', error);
    }
  };

  // Separate fetch function for control plane node info
  const fetchControlPlaneNodeInfo = async (serverIp: string) => {
    if (!serverIp) {
      setControlPlaneNodeInfo(null);
      return;
    }

    try {
      // Get server address (FQDN with IP fallback)
      const serverAddress = getServerAddress(serverIp);

      const res = await fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/nodeinfo`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      if (!res.ok) {
        logger.error('Error fetching control plane node info', { status: res.status });
        return;
      }
      const data = await res.json();
      setControlPlaneNodeInfo(data);

      // Also cache the node info in serverDataCache for validation
      setServerDataCache((prev) => ({
        ...prev,
        [serverIp]: {
          ...prev[serverIp],
          nodeInfo: data,
        },
      }));
    } catch (error) {
      logger.error('Error fetching control plane node info', error);
      setControlPlaneNodeInfo(null);
    }
  };

  // Resource validation functions
  const validateControlPlaneResources = (
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number
  ) => {
    const errors: { [key: string]: string } = {};

    // Only validate that values are not empty/zero
    if (!cpuCores || cpuCores <= 0) {
      errors['cpuCores'] = 'CPU cores is required';
    }

    if (!memoryGB || memoryGB <= 0) {
      errors['memory'] = 'Memory is required';
    }

    if (!diskSizeGB || diskSizeGB <= 0) {
      errors['diskSize'] = 'Disk size is required';
    }

    return errors;
  };

  const validateWorkerResources = (cpuCores: number, memoryGB: number, diskSizeGB: number) => {
    const errors: { [key: string]: string } = {};

    // Only validate that values are not empty/zero
    if (!cpuCores || cpuCores <= 0) {
      errors['cpuCores'] = 'CPU cores is required';
    }

    if (!memoryGB || memoryGB <= 0) {
      errors['memory'] = 'Memory is required';
    }

    if (!diskSizeGB || diskSizeGB <= 0) {
      errors['diskSize'] = 'Disk size is required';
    }

    return errors;
  };

  // Additional Control Plane resource validation function
  const validateAdditionalControlPlaneResources = (
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number
  ) => {
    const errors: { [key: string]: string } = {};

    // Only validate that values are not empty/zero
    if (!cpuCores || cpuCores <= 0) {
      errors['cpuCores'] = 'CPU cores is required';
    }

    if (!memoryGB || memoryGB <= 0) {
      errors['memory'] = 'Memory is required';
    }

    if (!diskSizeGB || diskSizeGB <= 0) {
      errors['diskSize'] = 'Disk size is required';
    }

    return errors;
  };

  // Helper function to check if there are any validation errors
  const hasValidationErrors = () => {
    return Object.values(fieldErrors).some((error) => error && error.trim() !== '');
  };

  // Batch validation function for multiple identical nodes
  const validateBatchNodeCreation = (
    nodeType: 'control-plane' | 'worker',
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number,
    serverIp: string,
    targetCount: number
  ) => {
    const errors: { [key: string]: string } = {};

    if (!serverIp) {
      return errors; // No validation needed if no server selected
    }

    // Use the appropriate node info based on provisioning type and server selection
    const nodeInfoToUse =
      provisioningType === 'ubuntu'
        ? serverDataCache[serverIp]?.nodeInfo || nodeInfo
        : serverDataCache[serverIp]?.nodeInfo || nodeInfo;

    if (!nodeInfoToUse) {
      return errors; // No validation possible without node info
    }
    // Only validate that values are not empty/zero
    if (!cpuCores || cpuCores <= 0) {
      errors['cpuCores'] = 'CPU cores is required';
    }

    if (!memoryGB || memoryGB <= 0) {
      errors['memory'] = 'Memory is required';
    }

    if (!diskSizeGB || diskSizeGB <= 0) {
      errors['diskSize'] = 'Disk size is required';
    }
    return errors;
  };

  // Calculate allocated resources from current configuration
  const calculateAllocatedResources = (serverIp: string, excludeCurrentEdit = false) => {
    let allocatedCpus = 0;
    let allocatedMemory = 0;

    // Check control plane allocations for this server
    if (provisioningType === 'ubuntu') {
      if (controlPlaneConfig && controlPlaneConfig.selectedServerIp === serverIp) {
        allocatedCpus += controlPlaneConfig.cpuCores;
        allocatedMemory += controlPlaneConfig.memoryGB;
      }

      // CRITICAL FIX: Include additional control planes for Ubuntu
      additionalControlPlaneConfigs.forEach((controlPlane) => {
        if (controlPlane.selectedServerIp === serverIp) {
          // Exclude the control plane being edited if we're in edit mode
          if (
            excludeCurrentEdit &&
            editingControlPlaneId &&
            controlPlane.id === editingControlPlaneId
          ) {
            return; // Skip this control plane
          }
          allocatedCpus += controlPlane.cpuCores;
          allocatedMemory += controlPlane.memoryGB;
        }
      });

      // Check worker allocations for this server
      configuredWorkers.forEach((worker) => {
        if (worker.selectedServerIp === serverIp) {
          // Exclude the worker being edited if we're in edit mode
          if (
            excludeCurrentEdit &&
            isEditingWorker &&
            editingWorkerOriginal &&
            worker.id === editingWorkerOriginal.id
          ) {
            return; // Skip this worker
          }
          allocatedCpus += worker.cpuCores;
          allocatedMemory += worker.memoryGB;
        }
      });
    } else {
      // OpenShift masters (exclude current one being edited if in edit mode)
      openshiftMasterNodes.forEach((master) => {
        if (master.selectedServerIp === serverIp) {
          allocatedCpus += master.cpuCores;
          allocatedMemory += master.memoryGB;
        }
      });

      // OpenShift workers (exclude current one being edited if in edit mode)
      openshiftWorkerNodes.forEach((worker) => {
        if (worker.selectedServerIp === serverIp) {
          // Exclude the worker being edited if we're in edit mode
          if (
            excludeCurrentEdit &&
            isEditingOpenshiftWorker &&
            editingOpenshiftWorkerOriginal &&
            worker.id === editingOpenshiftWorkerOriginal.id
          ) {
            return; // Skip this worker
          }
          allocatedCpus += worker.cpuCores;
          allocatedMemory += worker.memoryGB;
        }
      });
    }

    return { allocatedCpus, allocatedMemory };
  };

  // Update server resource usage with allocated resources
  const updateServerResourceUsage = (serverIp: string) => {
    if (!serverResourceUsage[serverIp]) return;

    const { allocatedCpus, allocatedMemory } = calculateAllocatedResources(serverIp);

    setServerResourceUsage((prev) => ({
      ...prev,
      [serverIp]: {
        ...prev[serverIp],
        allocatedCpus,
        allocatedMemory,
      },
    }));
  };

  // Fetch network switches when server is selected
  useEffect(() => {
    const fetchNetworkSwitches = async () => {
      const currentConfig = getCurrentBasicConfig();
      if (!currentConfig.selectedServerIp || currentConfig.selectedServerIp === '') {
        setNetworkSwitches([]);
        updateCurrentBasicConfig('selectedNetworkSwitch', '');
        return;
      }
      try {
        // Get server address (FQDN with IP fallback)
        const serverAddress = getServerAddress(currentConfig.selectedServerIp);

        const res = await fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
          }
        );
        if (!res.ok) {
          logger.error('Error fetching network switches', { status: res.status });
          return;
        }
        const data = await res.json();
        const switches = Array.isArray(data) ? data.map((sw: any) => sw.name) : [];
        setNetworkSwitches(switches);
      } catch (error) {
        logger.error('Error fetching network switches', error);
        setNetworkSwitches([]);
      }
    };

    // Also fetch for any server IP that might be selected in modals
    if (controlPlaneConfig?.selectedServerIp || configuredWorkers.some((w) => w.selectedServerIp)) {
      fetchNetworkSwitches();
    } else {
      fetchNetworkSwitches();
    }
  }, [
    provisioningType,
    provisioningType === 'ubuntu'
      ? ubuntuBasicConfig.selectedServerIp
      : openshiftBasicConfig.selectedServerIp,
    controlPlaneConfig?.selectedServerIp,
    configuredWorkers,
  ]);

  // Fetch storage pools when server is selected
  useEffect(() => {
    const fetchStoragePools = async () => {
      const currentConfig = getCurrentBasicConfig();
      if (!currentConfig.selectedServerIp || currentConfig.selectedServerIp === '') {
        setPools([]);
        updateCurrentBasicConfig('selectedPool', '');
        updateCurrentBasicConfig('datastore', '');
        return;
      }
      try {
        // Get server address (FQDN with IP fallback)
        const serverAddress = getServerAddress(currentConfig.selectedServerIp);

        const res = await fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
          }
        );
        if (!res.ok) {
          logger.error('Error fetching VM datastores', { status: res.status });
          return;
        }
        const data = await res.json();
        // Handle both array format and new object format with datastores property
        const datastoresArray = Array.isArray(data) ? data : data.datastores || [];
        setPools(datastoresArray);
      } catch (error) {
        logger.error('Error fetching storage pools', error);
        setPools([]);
      }
    };

    // Also fetch for any server IP that might be selected in modals
    if (controlPlaneConfig?.selectedServerIp || configuredWorkers.some((w) => w.selectedServerIp)) {
      fetchStoragePools();
    } else {
      fetchStoragePools();
    }
  }, [
    provisioningType,
    provisioningType === 'ubuntu'
      ? ubuntuBasicConfig.selectedServerIp
      : openshiftBasicConfig.selectedServerIp,
    controlPlaneConfig?.selectedServerIp,
    configuredWorkers,
  ]);

  // Update datastore based on selected pool
  useEffect(() => {
    const currentConfig = getCurrentBasicConfig();
    if (!currentConfig.selectedPool || pools.length === 0) return;
    const pool = pools.find((p) => (p.name || p.NAME) === currentConfig.selectedPool);
    if (pool) {
      updateCurrentBasicConfig('datastore', `/${currentConfig.selectedPool}/vm`);
    }
  }, [
    provisioningType,
    provisioningType === 'ubuntu'
      ? ubuntuBasicConfig.selectedPool
      : openshiftBasicConfig.selectedPool,
    pools,
  ]);

  // Clear form values when switching provisioning type
  useEffect(() => {
    if (provisioningType) {
      // Reset step to 1 when switching provisioning type
      if (step > 0) {
        setStep(1);
      }

      // Reset current worker defaults based on provisioning type
      const defaultCpu = provisioningType === 'openshift' ? 4 : 2;
      const defaultMemory = provisioningType === 'openshift' ? 8 : 4;
      const defaultDisk = provisioningType === 'openshift' ? 120 : 40;

      setCurrentWorker({
        cpuCores: defaultCpu,
        memoryGB: defaultMemory,
        diskSizeGB: defaultDisk,
        name: '',
      });
    }
  }, [provisioningType]);

  // Update allocated resources when configurations change
  useEffect(() => {
    // Update for all servers that have resource usage data
    Object.keys(serverResourceUsage).forEach((serverIp) => {
      updateServerResourceUsage(serverIp);
    });
  }, [
    controlPlaneConfig,
    configuredWorkers,
    openshiftMasterNodes,
    openshiftWorkerNodes,
    provisioningType,
  ]);

  // Fetch available ISOs for Ubuntu
  const fetchIsoList = async () => {
    setIsoLoading(true);
    try {
      // Check if access token exists
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        toast.error('Authentication required. Please log in again.');
        setIsoList([]);
        return;
      }

      // Get the appropriate server IP based on provisioning type
      // For Ubuntu, use the selected server IP from basic config, fallback to control node
      const currentConfig = getCurrentBasicConfig();
      const serverIp = currentConfig.selectedServerIp || envConfig().CONTROL_NODE_IP.URL;

      if (!serverIp) {
        toast.error('Please select a server first before fetching ISOs.');
        setIsoList([]);
        return;
      }

      // Get server address (FQDN with IP fallback) if using selected server
      const serverAddress = currentConfig.selectedServerIp
        ? getServerAddress(currentConfig.selectedServerIp)
        : envConfig().CONTROL_NODE_IP.URL;

      // Use the selected server address for the API call (similar to other API calls in this component)
      const apiUrl = `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/cloudimages`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Handle the actual API response format: {"raws":["ubuntu-server-cloud.raw"]}
        const rawImages = data.raws || [];
        const isoData = Array.isArray(rawImages)
          ? rawImages.map((imageName) => ({
              id: imageName,
              name: imageName,
            }))
          : [];

        setIsoList(isoData);
      } else {
        // Get response text for more detailed error info
        const errorText = await response.text().catch(() => 'Unable to read error response');
        logger.error('Cloud images API failed', {
          status: response.status,
          statusText: response.statusText,
          responseText: errorText,
          url: apiUrl,
        });

        // Handle authorization errors specifically
        if (response.status === 401 || response.status === 403) {
          toast.error(
            "You don't have permission to access cloud images. Please check your credentials."
          );
        } else {
          toast.error(`Failed to fetch available images: ${response.statusText}`);
        }
        setIsoList([]);
      }
    } catch (error) {
      logger.error('Error fetching ISO list', error);
      setIsoList([]);
    } finally {
      setIsoLoading(false);
    }
  };

  // Fetch ISO list when Ubuntu provisioning type is selected and server is available
  useEffect(() => {
    if (provisioningType === 'ubuntu') {
      const currentConfig = getCurrentBasicConfig();
      if (currentConfig.selectedServerIp) {
        fetchIsoList();
      }
    } else {
      // Reset ISO selection when switching away from Ubuntu
      setSelectedIso('');
      setIsoList([]);
    }
  }, [provisioningType, ubuntuBasicConfig.selectedServerIp]);

  // Simplified Ubuntu single-page interface
  const renderUbuntuSinglePage = () => {
    return (
      <div className="space-y-8">
        {/* Cluster Name */}
        <div className="space-y-4">
          <div>
            <label htmlFor="clusterName" className="block text-sm font-medium text-gray-700 mb-2">
              Cluster Name <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center">
              <div className="bg-gray-100 border border-gray-300 border-r-0 rounded-l-md px-3 py-2 text-gray-600 font-medium">
                ub-
              </div>
              <input
                type="text"
                id="clusterName"
                value={
                  ubuntuBasicConfig.k8sName.startsWith('ub-')
                    ? ubuntuBasicConfig.k8sName.substring(3)
                    : ubuntuBasicConfig.k8sName
                }
                onChange={(e) => {
                  const value = e.target.value;
                  // Combine prefix with user input
                  setUbuntuBasicConfig((prev) => ({ ...prev, k8sName: `ub-${value}` }));
                  // Trigger validation with the full cluster name (including prefix)
                  const fullClusterName = `ub-${value}`;
                  handleClusterNameValidation(fullClusterName, 'ubuntu');
                }}
                placeholder="clustername"
                className={`flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 ${
                  fieldErrors.clusterName
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'focus:ring-karios-blue focus:border-transparent'
                }`}
              />
            </div>
            {fieldErrors.clusterName && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.clusterName}</p>
            )}
          </div>

          {/* Username and Password */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username <span className="text-red-500">*</span>{' '}
                <span className="text-xs text-gray-500">
                  (For ubuntu, the username cannot be admin or root)
                </span>
              </label>
              <input
                type="text"
                id="username"
                value={ubuntuUser.username}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setUbuntuUser((prev) => ({ ...prev, username: newValue }));

                  // Validate username and update field errors
                  const error = validateUbuntuUsername(newValue);
                  setFieldErrors((prev) => ({ ...prev, username: error }));
                }}
                placeholder="Enter username"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent ${
                  fieldErrors.username ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {fieldErrors.username && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showUbuntuPassword ? 'text' : 'password'}
                  id="password"
                  value={ubuntuUser.password}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setUbuntuUser((prev) => ({ ...prev, password: newValue }));

                    // Validate password and update field errors
                    const error = validateUbuntuPassword(newValue);
                    setFieldErrors((prev) => ({ ...prev, password: error }));
                  }}
                  placeholder="Enter password"
                  className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent ${
                    fieldErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowUbuntuPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  aria-label={showUbuntuPassword ? 'Hide password' : 'Show password'}
                >
                  {showUbuntuPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>
          </div>

          {/* Attach IMG */}
          <div>
            <label htmlFor="img" className="block text-sm font-medium text-gray-700 mb-2">
              Attach IMG <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (isoList.length === 0) {
                    fetchIsoList();
                  }
                  setIsoDropdownOpen(!isoDropdownOpen);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent text-left bg-white flex items-center justify-between"
                disabled={isoLoading}
              >
                <span className={selectedIso ? 'text-gray-900' : 'text-gray-500'}>
                  {isoLoading
                    ? 'Loading ISOs...'
                    : selectedIso
                      ? isoList.find((iso) => iso.id === selectedIso)?.name || 'Select ISO'
                      : 'Select IMG'}
                </span>
                <FaChevronDown
                  className={`w-4 h-4 transition-transform ${isoDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isoDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {isoList.length === 0 ? (
                    <div className="px-3 py-2 text-gray-500 text-sm">
                      No ISOs are available. Please upload the ISO and create Ubuntu.
                    </div>
                  ) : (
                    isoList.map((iso) => (
                      <button
                        key={iso.id}
                        type="button"
                        onClick={() => {
                          setSelectedIso(iso.id);
                          setIsoDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${
                          selectedIso === iso.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                        }`}
                      >
                        {iso.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* DNS Zone Dropdown */}
          <DnsZoneDropdown
            value={ubuntuNetwork.domainName}
            onChange={(value) => setUbuntuNetwork((prev) => ({ ...prev, domainName: value }))}
            label="DNS Zone"
            required={true}
          />
        </div>

        {/* Master Control Plane Configuration */}
        <BootstrapControlPlaneConfiguration
          controlPlaneConfig={controlPlaneConfig}
          setControlPlaneConfig={setControlPlaneConfig}
          isControlPlaneModalOpen={isControlPlaneModalOpen}
          setIsControlPlaneModalOpen={setIsControlPlaneModalOpen}
          currentControlPlaneConfig={currentControlPlaneConfig}
          setCurrentControlPlaneConfig={setCurrentControlPlaneConfig}
          controlPlaneNodeInfo={controlPlaneNodeInfo}
          controlPlanePools={controlPlanePools}
          controlPlaneNetworkSwitches={controlPlaneNetworkSwitches}
          allServers={allServers}
          ubuntuBasicConfig={ubuntuBasicConfig}
          ubuntuMaster={ubuntuMaster}
          setUbuntuMaster={setUbuntuMaster}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          hasValidationErrors={hasValidationErrors}
          showFrigateCameraPassword={showFrigateCameraPassword}
          setShowFrigateCameraPassword={setShowFrigateCameraPassword}
          fetchControlPlaneNodeInfo={fetchControlPlaneNodeInfo}
          fetchControlPlaneServerData={fetchControlPlaneServerData}
          validateControlPlaneResources={validateControlPlaneResources}
          validateBatchNodeCreation={validateBatchNodeCreation}
          getUbuntuControlPlaneName={getUbuntuControlPlaneName}
        />

        {/* Additional Control Plane Configuration */}
        <AdditionalControlPlaneConfiguration
          isAdditionalControlPlaneModalOpen={isAdditionalControlPlaneModalOpen}
          setIsAdditionalControlPlaneModalOpen={setIsAdditionalControlPlaneModalOpen}
          currentAdditionalControlPlaneConfig={currentAdditionalControlPlaneConfig}
          setCurrentAdditionalControlPlaneConfig={setCurrentAdditionalControlPlaneConfig}
          additionalControlPlaneConfigs={additionalControlPlaneConfigs}
          setAdditionalControlPlaneConfigs={setAdditionalControlPlaneConfigs}
          editingControlPlaneId={editingControlPlaneId}
          setEditingControlPlaneId={setEditingControlPlaneId}
          editingControlPlaneOriginal={editingControlPlaneOriginal}
          setEditingControlPlaneOriginal={setEditingControlPlaneOriginal}
          controlPlanePools={controlPlanePools}
          controlPlaneNetworkSwitches={controlPlaneNetworkSwitches}
          serverDataCache={serverDataCache}
          controlPlaneNodeInfo={controlPlaneNodeInfo}
          nodeInfo={nodeInfo}
          ubuntuBasicConfig={ubuntuBasicConfig}
          allServers={allServers}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          hasValidationErrors={hasValidationErrors}
          fetchControlPlaneNodeInfo={fetchControlPlaneNodeInfo}
          fetchControlPlaneServerData={fetchControlPlaneServerData}
          validateAdditionalControlPlaneResources={validateAdditionalControlPlaneResources}
          validateBatchNodeCreation={validateBatchNodeCreation}
          getNextUbuntuControlPlaneName={getNextUbuntuControlPlaneName}
          renumberUbuntuControlPlanes={renumberUbuntuControlPlanes}
          calculateAllocatedResources={calculateAllocatedResources}
          cancelControlPlaneOperation={cancelControlPlaneOperation}
          controlPlaneConfig={controlPlaneConfig}
          controlPlaneGroupCounts={controlPlaneGroupCounts}
          setControlPlaneGroupCounts={setControlPlaneGroupCounts}
          controlPlaneGroupInputs={controlPlaneGroupInputs}
          setControlPlaneGroupInputs={setControlPlaneGroupInputs}
        />

        {/* Control Plane Validation Error for Ubuntu */}
        {provisioningType === 'ubuntu' && getControlPlaneValidationError() && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FaExclamationCircle className="h-4 w-4 text-red-400" />
              </div>
              <div className="ml-2">
                <p className="text-sm text-red-700">{getControlPlaneValidationError()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Worker Configuration */}
        <WorkerConfiguration
          isWorkerModalOpen={isWorkerModalOpen}
          setIsWorkerModalOpen={setIsWorkerModalOpen}
          currentWorkerConfig={currentWorkerConfig}
          setCurrentWorkerConfig={setCurrentWorkerConfig}
          configuredWorkers={configuredWorkers}
          setConfiguredWorkers={setConfiguredWorkers}
          isEditingWorker={isEditingWorker}
          setIsEditingWorker={setIsEditingWorker}
          editingWorkerOriginal={editingWorkerOriginal}
          setEditingWorkerOriginal={setEditingWorkerOriginal}
          workerGroupCounts={workerGroupCounts}
          setWorkerGroupCounts={setWorkerGroupCounts}
          workerGroupInputs={workerGroupInputs}
          setWorkerGroupInputs={setWorkerGroupInputs}
          pools={pools}
          networkSwitches={networkSwitches}
          nodeInfo={nodeInfo}
          ubuntuBasicConfig={ubuntuBasicConfig}
          allServers={allServers}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          hasValidationErrors={hasValidationErrors}
          fetchNodeInfo={fetchNodeInfo}
          fetchServerSpecificData={fetchServerSpecificData}
          validateWorkerResources={validateWorkerResources}
          validateBatchNodeCreation={validateBatchNodeCreation}
          getNextWorkerName={getNextWorkerName}
          renumberConfiguredWorkers={renumberConfiguredWorkers}
          cancelWorkerOperation={cancelWorkerOperation}
        />

        {/* Remove the modal components since we're using inline forms */}
      </div>
    );
  };
  // Simplified Ubuntu cluster creation function
  const createUbuntuCluster = async (): Promise<void> => {
    // Prevent duplicate calls if already submitting or called recently
    setIsNavigatingToCluster(true);
    const now = Date.now();
    if (isSubmitting || now - lastOperationTimestamp < 2000) {
      logger.warn(
        'Ubuntu cluster creation already in progress or called too recently, ignoring duplicate call'
      );
      return;
    }

    try {
      // Clear previous creation errors
      clearCreationErrors();

      // Set loading state and timestamp
      setIsSubmitting(true);
      setLastOperationTimestamp(now);
      setStatusMessage('Creating Ubuntu Kubernetes cluster, please wait...');

      // Validate required fields for simplified interface
      if (
        !ubuntuBasicConfig.k8sName ||
        !ubuntuUser.username ||
        !ubuntuUser.password ||
        !selectedIso
      ) {
        throw new Error('Please fill in all required fields including ISO selection');
      }

      // Dispatch optimistic clusterCreated event immediately for sidebar update
      window.dispatchEvent(
        new CustomEvent('clusterCreated', {
          detail: {
            clusterName: ubuntuBasicConfig.k8sName,
            optimistic: true,
            status: 'provisioning',
          },
        })
      );

      if (!controlPlaneConfig) {
        throw new Error('Please configure the control plane');
      }

      // Validate that control plane has a selected server
      if (!controlPlaneConfig.selectedServerIp) {
        throw new Error('Please select a server for the control plane');
      }

      // Validate that all workers have selected servers
      for (const worker of configuredWorkers) {
        if (!worker.selectedServerIp) {
          throw new Error(`Please select a server for worker: ${worker.name}`);
        }
      }

      // Validate that all additional control planes have selected servers
      for (const additionalCP of additionalControlPlaneConfigs) {
        if (!additionalCP.selectedServerIp) {
          throw new Error(
            `Please select a server for additional control plane: ${additionalCP.name}`
          );
        }
      }

      // Prepare base payload with common fields
      const selectedIsoName =
        isoList.find((iso) => iso.id === selectedIso)?.name || 'ubuntu-server-cloud.raw';
      const basePayload = {
        os_type: 'ubuntu-server',
        image_name: selectedIsoName,
        username: ubuntuUser.username,
        password: ubuntuUser.password,
        kubernetes_cluster_name: ubuntuBasicConfig.k8sName,
        kubernetes_type: 'ubuntu-kubernetes',
      };

      // Create control plane node payload
      const controlPlanePayload = {
        ...basePayload,
        datastore: 'default',
        vm_name: controlPlaneConfig.name,
        cpu: controlPlaneConfig.cpuCores,
        memory: `${controlPlaneConfig.memoryGB}G`,
        disk_size: `${controlPlaneConfig.diskSizeGB}G`,
        nw_switch: controlPlaneConfig.selectedNetworkSwitch,
        kubernetes_control_plane: true,
        node_ip: getServerAddress(controlPlaneConfig.selectedServerIp),
        domain: ubuntuNetwork.domainName,
      };

      // Add control plane specific options
      if (controlPlaneConfig.prometheusandgrafanaEnabled) {
        (controlPlanePayload as any).prometheus_and_grafana = true;
      }
      if (controlPlaneConfig.argocdEnabled) {
        (controlPlanePayload as any).argocd = true;
      }

      // Add Frigate specific fields
      if (controlPlaneConfig.frigateEnabled) {
        if (controlPlaneConfig.frigateGpuEnabled) {
          (controlPlanePayload as any).frigate_gpu = true;
        }
        if (controlPlaneConfig.frigateCpuEnabled) {
          (controlPlanePayload as any).frigate_cpu = true;
        }
        (controlPlanePayload as any).frigate_camera_ip = controlPlaneConfig.frigateCameraIp;
        (controlPlanePayload as any).frigate_camera_username =
          controlPlaneConfig.frigateCameraUsername;
        (controlPlanePayload as any).frigate_camera_password =
          controlPlaneConfig.frigateCameraPassword;
      }
      // Create worker payloads array
      const workerPayloads = configuredWorkers.map((worker) => {
        // Ensure consistent naming - construct the VM name to avoid any naming issues
        const workerVmName = worker.name.startsWith('ub-')
          ? worker.name
          : `ub-${ubuntuBasicConfig.k8sName || 'clustername'}-${worker.name}`;
        return {
          ...basePayload,
          datastore: 'default',
          vm_name: workerVmName,
          cpu: worker.cpuCores,
          memory: `${worker.memoryGB}G`,
          disk_size: `${worker.diskSizeGB}G`,
          nw_switch: worker.selectedNetworkSwitch,
          kubernetes_worker: true,
          node_ip: getServerAddress(worker.selectedServerIp),
          domain: ubuntuNetwork.domainName,
        };
      });
      // Create additional control plane payloads array (using worker format but with different settings)
      const additionalControlPlanePayloads = additionalControlPlaneConfigs.map((additionalCP) => {
        // Ensure consistent naming
        const additionalCPVmName = additionalCP.name.startsWith('ub-')
          ? additionalCP.name
          : `ub-${ubuntuBasicConfig.k8sName || 'clustername'}-${additionalCP.name}`;
        return {
          ...basePayload,
          datastore: 'default',
          vm_name: additionalCPVmName,
          cpu: additionalCP.cpuCores,
          memory: `${additionalCP.memoryGB}G`,
          disk_size: `${additionalCP.diskSizeGB}G`,
          nw_switch: additionalCP.selectedNetworkSwitch,
          kubernetes_worker: true, // Using worker format as requested,
          node_ip: getServerAddress(additionalCP.selectedServerIp),
          domain: ubuntuNetwork.domainName,
        };
      });

      // Add control plane promise
      setStatusMessage(
        `Creating control plane, ${additionalControlPlanePayloads.length} additional control planes, and ${workerPayloads.length} worker nodes concurrently...`
      );

      const combinedPayload = {
        bootstrap: controlPlanePayload,
        control_plane: additionalControlPlanePayloads,
        worker: workerPayloads,
      };

      try {
        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/provision`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(combinedPayload),
          }
        );
        if (!response.ok) throw new Error('Failed to create K8S');

        const responseData = await response.json();
        logger.debug('Cluster creation response:', responseData);

        // Dispatch updated clusterCreated event with job info
        if (responseData && responseData.job_id) {
          window.dispatchEvent(
            new CustomEvent('clusterCreated', {
              detail: {
                clusterName: ubuntuBasicConfig.k8sName,
                jobId: responseData.job_id,
                jobType: 'ubuntu-cluster-creation',
                status: 'provisioning',
              },
            })
          );
        }

        // If response contains job_id, save it and show JobStatusModal
        if (responseData && responseData.job_id) {
          const storageKey = `cluster-job-${ubuntuBasicConfig.k8sName}`;
          const jobData = {
            jobId: responseData.job_id,
            jobType: 'ubuntu-cluster-creation',
            clusterName: ubuntuBasicConfig.k8sName,
            timestamp: Date.now(),
          };
          localStorage.setItem(storageKey, JSON.stringify(jobData));

          setStatusMessage(
            `Ubuntu Kubernetes cluster '${ubuntuBasicConfig.k8sName}' creation job started.`
          );

          // Set navigation flag to disable create button during redirect

          // Wait 5 seconds before navigating to cluster details page
          setTimeout(() => {
            navigate(`/cluster/${ubuntuBasicConfig.k8sName}/details`, { replace: true });

            // Then open JobStatusModal with job info after navigation
            setTimeout(() => {
              setCurrentJobId(responseData.job_id);
              setCurrentJobType('ubuntu-cluster-creation');
              setIsJobModalOpen(true);
              // Reset navigation flag after modal opens
              setIsNavigatingToCluster(false);
            }, 100);
          }, 0);

          return; // Exit early
        }
      } catch (error) {
        logger.error('Error in cluster flow:', error);
        return;
      }

      const newCreatedVms = [];
      setCreatedVms((prev) => [...prev, ...newCreatedVms]);

      // Refresh VM lists for affected servers to get latest status
      const uniqueServerIps = [...new Set(newCreatedVms.map((vm) => vm.serverIp))];
      for (const serverIp of uniqueServerIps) {
        const serverToRefresh = dataCenters
          .flatMap((dc) => dc.servers)
          .find((server) => server.ip === serverIp);

        if (serverToRefresh && fetchVMsForServer) {
          // Immediate refresh to show VMs in sidebar quickly
          fetchVMsForServer(serverToRefresh);

          // Additional delayed refresh to get updated status
          setTimeout(async () => {
            await fetchVMsForServer(serverToRefresh);
          }, 2000);
        }
      }

      // Dispatch immediate VM data refresh event for sidebar
      window.dispatchEvent(new CustomEvent('vmDataRefreshNeeded'));

      // Success message
      if (workerPayloads.length > 0) {
        setStatusMessage(
          `Ubuntu Kubernetes cluster '${ubuntuBasicConfig.k8sName}' created successfully! Control plane and ${workerPayloads.length} worker(s) deployed. Redirecting to cluster details...`
        );
      } else {
        // No workers configured - control plane only
        setStatusMessage(
          `Ubuntu Kubernetes cluster '${ubuntuBasicConfig.k8sName}' created successfully! Control plane deployed (no workers). Redirecting to cluster details...`
        );
      }

      // Dispatch custom event to trigger sidebar cluster data refresh
      window.dispatchEvent(
        new CustomEvent('clusterCreated', {
          detail: { clusterName: ubuntuBasicConfig.k8sName },
        })
      );

      // Also dispatch cluster VM operation events for each created VM for immediate sidebar updates
      newCreatedVms.forEach((vm) => {
        window.dispatchEvent(
          new CustomEvent('clusterVmOperation', {
            detail: {
              vmName: vm.name,
              operation: 'create',
              clusterName: ubuntuBasicConfig.k8sName,
            },
          })
        );
      });

      // Navigate to cluster details page with shorter delay
      setTimeout(() => {
        navigate(`/cluster/${ubuntuBasicConfig.k8sName}/details`, { replace: true });
      }, 1500);
    } catch (error: unknown) {
      logger.error('Ubuntu Kubernetes Cluster Creation Error', error);

      // Dispatch clusterCreationFailed event to remove optimistic entry from sidebar
      window.dispatchEvent(
        new CustomEvent('clusterCreationFailed', {
          detail: { clusterName: ubuntuBasicConfig.k8sName },
        })
      );

      const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) {
          return error.message;
        }
        if (typeof error === 'string') {
          return error;
        }
        return 'Unknown error occurred';
      };

      setStatusMessage(`Error: ${getErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
      setIsNavigatingToCluster(false); // Reset navigation flag on error
    }
  };
  // Clear status message when form changes
  useEffect(() => {
    if (statusMessage && !statusMessage.includes('partially failed')) {
      const timer = setTimeout(() => {
        setStatusMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
    return () => {}; // Return empty cleanup function when no timer is set
  }, [statusMessage]);

  // Function to clear creation errors when starting a new creation attempt
  const clearCreationErrors = () => {
    setCreationErrors([]);
    setStatusMessage('');
    // Reset HAProxy status when starting a new creation
    setHAProxyStatus({
      isLoading: false,
      success: false,
      response: null,
      error: null,
      progress: 0,
      progressMessage: '',
    });
  };

  // Clear creation errors when form configuration changes (user starts modifying the setup)
  useEffect(() => {
    if (creationErrors.length > 0) {
      // Clear errors when user modifies cluster configuration
      clearCreationErrors();
    }
  }, [
    provisioningType,
    step,
    ubuntuBasicConfig,
    openshiftBasicConfig,
    controlPlaneConfig,
    configuredWorkers,
    additionalControlPlaneConfigs,
    openshiftMasterNodes,
    openshiftWorkerNodes,
  ]);

  // Prevent navigation during HAProxy setup
  useEffect(() => {
    if (haproxyStatus.isLoading) {
      // Set a flag to prevent accidental navigation during HAProxy setup
      // HAProxy setup in progress - navigation locked
    }
  }, [haproxyStatus.isLoading]);

  // Auto-disable HAProxy checkbox if requirements are not met
  useEffect(() => {
    if (setupHAProxy && !canEnableHAProxy()) {
      setSetupHAProxy(false);
    }
  }, [openshiftMasterNodes, openshiftWorkerNodes, openshiftCurrentMaster]);

  const setCurrentWorker = (newWorker: {
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
    name: string;
    masterId?: string;
  }) => {
    if (provisioningType === 'ubuntu') {
      setUbuntuCurrentWorker({
        cpuCores: newWorker.cpuCores,
        memoryGB: newWorker.memoryGB,
        diskSizeGB: newWorker.diskSizeGB,
        name: newWorker.name,
      });
    } else {
      setOpenshiftCurrentWorker({
        selectedServerIp: '',
        selectedPool: '',
        selectedNetworkSwitch: '',
        cpuCores: newWorker.cpuCores,
        memoryGB: newWorker.memoryGB,
        diskSizeGB: newWorker.diskSizeGB,
        name: newWorker.name,
        masterId: newWorker.masterId || '',
        domain: '',
      });
    }
  };

  const handleContinue = () => {
    if (provisioningType) {
      setStep(1);
    }
  };

  const renderStep = () => {
    // If we have a provisioning type from URL params, skip the selection screen
    const urlParams = new URLSearchParams(location.search);
    const typeParam = urlParams.get('type');

    // Simplified single-page Ubuntu interface
    if (provisioningType === 'ubuntu' || typeParam === 'ubuntu') {
      return renderUbuntuSinglePage();
    }

    // Simplified single-page K3S interface
    if (provisioningType === 'k3s' || typeParam === 'k3s') {
      return <K3sSetup dataCenters={dataCenters} onBack={() => setProvisioningType('')} />;
    }

    // Simplified single-page OpenShift interface
    if (provisioningType === 'openshift' || typeParam === 'openshift') {
      // return renderOpenshiftSinglePage();
      return <OpenShiftSetup dataCenters={dataCenters} onBack={() => setProvisioningType('')} />;
    }
    return null;
  };

  const canContinue = () => {
    // Check for validation errors first
    if (hasValidationErrors()) {
      return false;
    }

    // For simplified Ubuntu interface, check if all required fields are filled
    if (
      provisioningType === 'ubuntu' ||
      new URLSearchParams(location.search).get('type') === 'ubuntu'
    ) {
      const basicValidation =
        ubuntuBasicConfig.k8sName.trim() !== '' &&
        ubuntuBasicConfig.k8sName.startsWith('ub-') &&
        ubuntuBasicConfig.k8sName.trim() !== 'ub-' &&
        ubuntuUser.username.trim() !== '' &&
        ubuntuUser.password.trim() !== '' &&
        ubuntuNetwork.domainName.trim() !== '' &&
        controlPlaneConfig !== null;

      // Also check for odd number of control planes
      return basicValidation && validateOddControlPlanes();
    }

    // For simplified K3S interface, check if all required fields are filled
    if (provisioningType === 'k3s' || new URLSearchParams(location.search).get('type') === 'k3s') {
      // Check basic required fields
      if (
        !k3sBasicConfig.k8sName.trim() ||
        !k3sBasicConfig.k8sName.startsWith('k3s-') ||
        k3sBasicConfig.k8sName.trim() === 'k3s-' ||
        !k3sUser.username.trim() ||
        !k3sUser.password.trim()
      ) {
        return false;
      }

      // Check username validation (same as K3S component - no admin/root)
      const lowerUsername = k3sUser.username.toLowerCase().trim();
      if (lowerUsername === 'admin' || lowerUsername === 'root') {
        return false;
      }

      // Check password validation (min 6 characters)
      if (k3sUser.password.length < 6) {
        return false;
      }

      // Check if control plane/master is configured
      if (!k3sMaster.cpuCores || !k3sMaster.memoryGB || !k3sMaster.diskSizeGB) {
        return false;
      }

      return true;
    }

    // For Anthos, check if upload was successful
    if (
      provisioningType === 'anthos' ||
      new URLSearchParams(location.search).get('type') === 'anthos'
    ) {
      const anthosState = (state as any)['anthos'];
      const credentialsExist = !!(
        anthosState?.credentialsCheck?.data && anthosState.credentialsCheck.data.credentials_exist
      );
      return (anthosState && anthosState.uploadSuccess && anthosState.config) || credentialsExist;
    }

    if (step === 0) return !!provisioningType;
    const currentConfig = getCurrentBasicConfig();
    if (step === 1) {
      const hasValidClusterName =
        currentConfig.k8sName.trim() !== '' &&
        ((provisioningType === 'ubuntu' && currentConfig.k8sName.trim() !== 'ub-') ||
          (provisioningType === 'k3s' && currentConfig.k8sName.trim() !== 'k3s-') ||
          (provisioningType === 'openshift' && currentConfig.k8sName.trim() !== 'op-'));
      return hasValidClusterName && currentConfig.selectedServerIp !== '';
    }
    if (step === 2)
      return currentConfig.selectedPool !== '' && currentConfig.selectedNetworkSwitch !== '';
    if (step === 3) {
      if (provisioningType === 'ubuntu') {
        return (
          ubuntuMaster.name.trim() !== '' &&
          ubuntuMaster.cpuCores >= 4 &&
          ubuntuMaster.memoryGB >= 8 &&
          ubuntuMaster.diskSizeGB >= 40
        );
      } else if (provisioningType === 'k3s') {
        return k3sMaster.cpuCores >= 1 && k3sMaster.memoryGB >= 2 && k3sMaster.diskSizeGB >= 20;
      } else {
        // For OpenShift, check if at least one master is configured
        return openshiftMasterNodes.length > 0;
      }
    }
    if (step === 4) {
      if (provisioningType === 'ubuntu') {
        return ubuntuWorkerNodes.length > 0;
      } else if (provisioningType === 'k3s') {
        return k3sWorkerNodes.length > 0;
      } else {
        // For OpenShift, check if at least one worker is configured for each master
        return openshiftMasterNodes.every((master) =>
          openshiftWorkerNodes.some((worker) => worker.masterId === master.id)
        );
      }
    }

    // User Configuration - only for Ubuntu and K3S at step 5
    if (step === 5 && (provisioningType === 'ubuntu' || provisioningType === 'k3s')) {
      if (provisioningType === 'ubuntu') {
        return ubuntuUser.username.trim() !== '' && ubuntuUser.password.trim() !== '';
      } else if (provisioningType === 'k3s') {
        return k3sUser.username.trim() !== '' && k3sUser.password.trim() !== '';
      }
    }

    // Network Configuration - final step for Ubuntu and K3S only (step 6)
    if (step === 6 && (provisioningType === 'ubuntu' || provisioningType === 'k3s')) {
      // Ubuntu/K3S - if static IP is set, require gateway and nameservers
      if (ubuntuNetwork.staticIp) {
        return ubuntuNetwork.gateway.trim() !== '' && ubuntuNetwork.nameservers.trim() !== '';
      }
      return true; // DHCP is valid
    }

    return false;
  };

  return (
    <div className="relative">
      <div>
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 md:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                    {provisioningType === 'openshift' ||
                    new URLSearchParams(location.search).get('type') === 'openshift'
                      ? 'Create New OpenShift Cluster'
                      : provisioningType === 'k3s' ||
                          new URLSearchParams(location.search).get('type') === 'k3s'
                        ? 'Create New K3S Kubernetes Cluster'
                        : provisioningType === 'anthos' ||
                            new URLSearchParams(location.search).get('type') === 'anthos'
                          ? 'Create New Google Anthos Kubernetes Cluster'
                          : 'Create New Ubuntu Kubernetes Cluster'}
                  </h1>
                  <p className="mt-2 text-xs md:text-sm text-gray-600">
                    {provisioningType === 'openshift' ||
                    new URLSearchParams(location.search).get('type') === 'openshift'
                      ? 'Configure your OpenShift cluster settings'
                      : provisioningType === 'anthos' ||
                          new URLSearchParams(location.search).get('type') === 'anthos'
                        ? 'Configure your Google Anthos cluster settings'
                        : 'Configure your k8s settings through the following steps'}
                  </p>
                </div>
              </div>

              {/* Progress Steps - only show for multi-step flows (not for single-page interfaces) */}
              {step > 0 &&
                !(
                  provisioningType === 'ubuntu' ||
                  new URLSearchParams(location.search).get('type') === 'ubuntu'
                ) &&
                !(
                  provisioningType === 'openshift' ||
                  new URLSearchParams(location.search).get('type') === 'openshift'
                ) && (
                  <div className="mt-4 md:mt-6">
                    {provisioningType === 'ubuntu' ? (
                      <div className="overflow-x-auto">
                        <div className="flex items-center justify-between min-w-max space-x-2 md:space-x-4 pb-2">
                          {[
                            'Basic',
                            'Storage & Network',
                            'Master Config',
                            'Worker Config',
                            'User Config',
                            'Network Config',
                          ].map((stepName, index) => (
                            <div key={stepName} className="flex items-center flex-shrink-0">
                              <div
                                className={`flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-medium ${
                                  index + 1 < step
                                    ? 'bg-orange-500 text-white'
                                    : index + 1 === step
                                      ? 'bg-orange-500 text-white'
                                      : 'bg-gray-200 text-gray-500'
                                }`}
                              >
                                {index + 1}
                              </div>
                              <span
                                className={`ml-1 md:ml-2 text-xs md:text-sm font-medium whitespace-nowrap ${
                                  index + 1 <= step ? 'text-orange-500' : 'text-gray-500'
                                }`}
                              >
                                {stepName}
                              </span>
                              {index < 5 && (
                                <div
                                  className={`ml-2 md:ml-3 w-4 md:w-6 h-0.5 ${
                                    index + 1 < step ? 'bg-orange-500' : 'bg-gray-200'
                                  }`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <div className="flex items-center justify-between min-w-max space-x-2 md:space-x-4 pb-2">
                          {['Basic', 'Storage & Network', 'Master Config', 'Worker Config'].map(
                            (stepName, index) => (
                              <div key={stepName} className="flex items-center flex-shrink-0">
                                <div
                                  className={`flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-medium ${
                                    index + 1 < step
                                      ? 'bg-red-600 text-white'
                                      : index + 1 === step
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-200 text-gray-500'
                                  }`}
                                >
                                  {index + 1}
                                </div>
                                <span
                                  className={`ml-1 md:ml-2 text-xs md:text-sm font-medium whitespace-nowrap ${
                                    index + 1 <= step ? 'text-red-600' : 'text-gray-500'
                                  }`}
                                >
                                  {stepName}
                                </span>
                                {index < 3 && (
                                  <div
                                    className={`ml-2 md:ml-4 w-4 md:w-8 h-0.5 ${
                                      index + 1 < step ? 'bg-red-600' : 'bg-gray-200'
                                    }`}
                                  />
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>

            <div className="p-4 md:p-6">
              {renderStep()}

              {/* Status Message - only show if no creation errors */}
              {statusMessage && creationErrors.length === 0 && (
                <div
                  className={`mt-4 p-3 rounded-md text-sm ${
                    statusMessage.includes('Error') ||
                    statusMessage.includes('Failed') ||
                    statusMessage.includes('partially failed')
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : statusMessage.includes('successfully')
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  <div className="whitespace-pre-line">{statusMessage}</div>
                </div>
              )}

              {/* Creation Errors Display */}
              {creationErrors.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <FaExclamationCircle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Creation Failed for Some Nodes
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p className="mb-2">The following nodes could not be created:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {creationErrors.map((error, index) => (
                            <li key={index}>
                              <span className="font-medium">{error.nodeType}</span> (
                              {error.nodeName}): {error.error}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 text-sm">
                          Please check the errors above and cancel to fix the issues before trying
                          again.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Bar - only show for Ubuntu, not for K3S, Anthos, or OpenShift */}
            {!(
              provisioningType === 'k3s' ||
              new URLSearchParams(location.search).get('type') === 'k3s' ||
              provisioningType === 'anthos' ||
              new URLSearchParams(location.search).get('type') === 'anthos' ||
              provisioningType === 'openshift' ||
              new URLSearchParams(location.search).get('type') === 'openshift'
            ) && (
              <div className="px-4 md:px-6 py-3 md:py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3">
                <button
                  onClick={() => {
                    // Clear any creation errors when canceling
                    clearCreationErrors();
                    navigate('/k8s-provisioning');
                  }}
                  disabled={isSubmitting || haproxyStatus.isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-karios-blue order-2 sm:order-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>

                {/* For simplified Ubuntu interface */}
                {provisioningType === 'ubuntu' ||
                new URLSearchParams(location.search).get('type') === 'ubuntu' ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const validationError = getControlPlaneValidationError();
                      if (
                        !isSubmitting &&
                        !haproxyStatus.isLoading &&
                        !isJobModalOpen &&
                        !isNavigatingToCluster &&
                        canContinue() &&
                        creationErrors.length === 0 &&
                        !validationError
                      ) {
                        createUbuntuCluster();
                      }
                    }}
                    disabled={
                      !canContinue() ||
                      isSubmitting ||
                      haproxyStatus.isLoading ||
                      isJobModalOpen ||
                      isNavigatingToCluster ||
                      creationErrors.length > 0 ||
                      !!getControlPlaneValidationError()
                    }
                    className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      canContinue() &&
                      !isSubmitting &&
                      !haproxyStatus.isLoading &&
                      !isJobModalOpen &&
                      !isNavigatingToCluster &&
                      creationErrors.length === 0 &&
                      !getControlPlaneValidationError()
                        ? 'bg-karios-green hover:bg-green-600 focus:ring-green-500'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting || isJobModalOpen || isNavigatingToCluster
                      ? 'Creating Cluster...'
                      : haproxyStatus.isLoading
                        ? 'HAProxy Setup in Progress...'
                        : getControlPlaneValidationError()
                          ? 'Fix Configuration Error'
                          : creationErrors.length > 0
                            ? 'Fix Errors to Continue'
                            : 'Create Ubuntu Cluster'}
                  </button>
                ) : step === 0 ? (
                  <button
                    onClick={handleContinue}
                    disabled={!canContinue() || isSubmitting}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-karios-blue order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      canContinue() && !isSubmitting
                        ? 'bg-karios-blue hover:bg-blue-600'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      // Check if this is the final step for either flow
                      const isFinalStep =
                        (provisioningType === 'ubuntu' && step === 6) ||
                        (provisioningType === 'openshift' && step === 4);

                      if (isFinalStep) {
                        // Final step - create cluster based on provisioning type (only if no creation errors)
                        if (creationErrors.length > 0 || isJobModalOpen || isNavigatingToCluster) {
                          return; // Don't proceed if there are creation errors, job modal is open, or navigating
                        }
                        if (provisioningType === 'ubuntu') {
                          createUbuntuCluster();
                        }
                      } else {
                        setStep(step + 1);
                      }
                    }}
                    disabled={
                      !canContinue() ||
                      isSubmitting ||
                      haproxyStatus.isLoading ||
                      isJobModalOpen ||
                      isNavigatingToCluster ||
                      (((provisioningType === 'ubuntu' && step === 6) ||
                        (provisioningType === 'openshift' && step === 4)) &&
                        creationErrors.length > 0)
                    }
                    className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      canContinue() &&
                      !isSubmitting &&
                      !haproxyStatus.isLoading &&
                      !isJobModalOpen &&
                      !isNavigatingToCluster &&
                      !(
                        ((provisioningType === 'ubuntu' && step === 6) ||
                          (provisioningType === 'openshift' && step === 4)) &&
                        creationErrors.length > 0
                      )
                        ? (provisioningType === 'ubuntu' && step === 6) ||
                          (provisioningType === 'openshift' && step === 4)
                          ? 'bg-karios-green hover:bg-green-600 focus:ring-green-500'
                          : 'bg-karios-blue hover:bg-blue-600 focus:ring-karios-blue'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {(provisioningType === 'ubuntu' && step === 6) ||
                    (provisioningType === 'openshift' && step === 4)
                      ? isSubmitting || isJobModalOpen || isNavigatingToCluster
                        ? 'Creating Cluster...'
                        : haproxyStatus.isLoading
                          ? 'HAProxy Setup in Progress...'
                          : creationErrors.length > 0
                            ? 'Fix Errors to Continue'
                            : `Create ${provisioningType === 'ubuntu' ? 'Ubuntu' : 'OpenShift'} Cluster`
                      : 'Next'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Job Status Modal */}
      <JobStatusModal
        isOpen={isJobModalOpen}
        onClose={() => {
          setIsJobModalOpen(false);
          setCurrentJobId(null);
          setCurrentJobType(null);
        }}
        jobId={currentJobId}
        jobType={currentJobType}
        title="Cluster Creation Progress"
        onJobComplete={(jobId) => {
          // Dispatch events when job completes (whether success or failure)
          // Don't dispatch here - wait for onJobSuccess to avoid premature sidebar refresh
          logger.info(`Cluster creation job ${jobId} completed`);
        }}
        onJobSuccess={(jobId) => {
          // On successful completion, ensure sidebar refreshes THEN navigate
          logger.info(`Cluster ${ubuntuBasicConfig.k8sName} creation completed successfully`);

          // First, dispatch refresh events while still on K8sSetup page
          // This ensures sidebar refreshes before navigation
          window.dispatchEvent(
            new CustomEvent('clusterCreated', {
              detail: {
                clusterName: ubuntuBasicConfig.k8sName,
              },
            })
          );
          window.dispatchEvent(new CustomEvent('vmDataRefreshNeeded'));

          // Dispatch event to expand the newly created cluster in sidebar
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('expandClusterInSidebar', {
                detail: { clusterName: ubuntuBasicConfig.k8sName },
              })
            );
          }, 500);

          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('clusterDataRefreshNeeded', {
                detail: { clusterName: ubuntuBasicConfig.k8sName },
              })
            );
          }, 0);

          // Wait a bit for sidebar to process the event before navigating
          setTimeout(() => {
            // After navigation, dispatch cluster detail page refresh
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent('clusterDataRefreshNeeded', {
                  detail: { clusterName: ubuntuBasicConfig.k8sName },
                })
              );
            }, 300);
          }, 800); // Increased delay to ensure sidebar refresh completes
        }}
      />
    </div>
  );
};

export default K8sSetup;
