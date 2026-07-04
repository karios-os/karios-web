import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SiRedhatopenshift } from 'react-icons/si';
import envConfig from '../../../../runtime-config';
import { toast } from 'react-toastify';
import { DnsZoneDropdown } from './shared';
import { logger } from '../../../shared-state/src/utils/logger';
import api from '../../../shared-state/src/utils/interceptor';
import ControlPlaneConfiguration from './ControlPlaneConfiguration';
import WorkerNodeConfiguration from './WorkerNodeConfiguration';

interface OpenShiftSetupProps {
  dataCenters?: any[];
  onBack?: () => void;
}

const OpenShiftSetup: React.FC<OpenShiftSetupProps> = ({ dataCenters = [], onBack }) => {
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastOperationTimestamp, setLastOperationTimestamp] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // VM management state
  const [refreshingVms, setRefreshingVms] = useState<{ [vmName: string]: boolean }>({});

  // Track creation errors for individual VMs/nodes
  const [creationErrors, setCreationErrors] = useState<
    Array<{
      nodeName: string;
      nodeType: string; // 'control-plane', 'worker', etc.
      error: string;
    }>
  >([]);

  // Track VMs in transition states
  const isVmInTransition = (vmName: string): boolean => {
    return refreshingVms[vmName] || false;
  };

  // OpenShift basic configuration state
  const [openshiftBasicConfig, setOpenshiftBasicConfig] = useState({
    k8sName: '',
    selectedServerIp: envConfig().CONTROL_NODE_IP.URL,
    selectedPool: '',
    selectedNetworkSwitch: '',
    datastore: 'default',
    domain_name: '', // DNS domain for the cluster
  });

  // Separate storage & network state for OpenShift master and worker
  const [openshiftMasterPools, setOpenshiftMasterPools] = useState<any[]>([]);
  const [openshiftMasterNetworkSwitches, setOpenshiftMasterNetworkSwitches] = useState<string[]>(
    []
  );
  const [openshiftWorkerPools, setOpenshiftWorkerPools] = useState<any[]>([]);
  const [openshiftWorkerNetworkSwitches, setOpenshiftWorkerNetworkSwitches] = useState<string[]>(
    []
  );

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
    selectedServerIp: envConfig()
      .CONTROL_NODE_IP.URL.replace(/https?:\/\//, '')
      .split(':')[0], // Extract IP from URL
    selectedPool: 'default',
    selectedNetworkSwitch: '',
    cpuCores: 4,
    memoryGB: 16,
    diskSizeGB: 120,
  });

  const [isAddingMaster, setIsAddingMaster] = useState<boolean>(false);

  // States for editing OpenShift master nodes
  const [isEditingMaster, setIsEditingMaster] = useState<boolean>(false);
  const [editingMasterOriginal, setEditingMasterOriginal] = useState<any>(null);

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
      domain_name?: string; // DNS domain for the worker
    }>
  >([]);

  const [openshiftCurrentWorker, setOpenshiftCurrentWorker] = useState<{
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
    name: string;
    masterId: string; // Track which master this worker is being added to
    domain_name: string; // DNS domain for the worker
  }>({
    selectedServerIp: envConfig().CONTROL_NODE_IP.URL, // Extract IP from URL
    selectedPool: 'default',
    selectedNetworkSwitch: '',
    cpuCores: 4,
    memoryGB: 8,
    diskSizeGB: 120,
    name: '',
    masterId: '',
    domain_name: '',
  });

  const [isAddingWorker, setIsAddingWorker] = useState<boolean>(false);
  const [selectedMasterForWorker, setSelectedMasterForWorker] = useState<string>(''); // Track which master is selected for adding workers
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set()); // Track which cluster dropdowns are expanded (unified for all cluster types)

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
  // Cluster name validation state
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [nodeInfo, setNodeInfo] = useState<any>(null);

  // States for editing OpenShift worker nodes
  const [isEditingOpenshiftWorker, setIsEditingOpenshiftWorker] = useState<boolean>(false);
  const [editingOpenshiftWorkerOriginal, setEditingOpenshiftWorkerOriginal] = useState<any>(null);

  // Get all available servers from data centers
  const allServers =
    dataCenters && Array.isArray(dataCenters)
      ? dataCenters.flatMap((dc: any) =>
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

  // Function to fetch server-specific data
  const fetchServerData = async (serverIp: string): Promise<void> => {
    // Check cache first
    if (serverDataCache[serverIp]) {
      const cached = serverDataCache[serverIp];
      setNodeInfo(cached.nodeInfo);
      setOpenshiftMasterNetworkSwitches(cached.networkSwitches);
      setOpenshiftMasterPools(cached.pools);
      return;
    }

    try {
      // Get server address (FQDN preferred, fallback to IP)
      const serverAddress = getServerAddress(serverIp);
      const port = envConfig().CONTROL_NODE_IP.PORT;

      // Fetch node info
      const nodeInfoResponse = await api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${port}/api/v1/compute/vms/nodeinfo`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let fetchedNodeInfo = null;
      if (nodeInfoResponse.ok) {
        fetchedNodeInfo = await nodeInfoResponse.json();
        setNodeInfo(fetchedNodeInfo);
      }

      // Fetch network switches
      const switchesResponse = await api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${port}/api/v1/network/switches`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let fetchedSwitches: string[] = [];
      if (switchesResponse.ok) {
        const switchesData = await switchesResponse.json();
        if (switchesData && Array.isArray(switchesData)) {
          fetchedSwitches = switchesData.map((sw: any) => sw.name).filter(Boolean);
          setOpenshiftMasterNetworkSwitches(fetchedSwitches);
        }
      }

      // Fetch storage pools
      const poolsResponse = await api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${port}/api/v1/compute/vms/datastores`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let fetchedPools: any[] = [];
      if (poolsResponse.ok) {
        fetchedPools = await poolsResponse.json();
        setOpenshiftMasterPools(fetchedPools);
      }

      // Cache the results
      setServerDataCache((prev) => ({
        ...prev,
        [serverIp]: {
          nodeInfo: fetchedNodeInfo,
          pools: fetchedPools,
          networkSwitches: fetchedSwitches,
        },
      }));
    } catch (error) {
      logger.error('Error fetching server data:', error);
      toast.error('Failed to fetch server resources');
    }
  };

  // Function to validate cluster name
  const validateClusterName = (value: string): string => {
    // Basic validation - check if there's content after prefix
    const prefix = 'op-';

    // Extract the base name (without prefix)
    const baseName = value.substring(prefix.length).trim();
    if (!baseName) {
      return `Please enter a cluster name`;
    }

    // OpenShift specific validation - cluster name cannot exceed 6 characters
    if (baseName.length > 6) {
      return `OpenShift cluster name cannot exceed 6 characters (currently ${baseName.length})`;
    }

    return '';
  };

  // Function to handle cluster name validation (local validation only)
  const handleClusterNameValidation = useCallback((value: string) => {
    // Immediate validation for format issues
    const immediateError = validateClusterName(value);
    if (immediateError) {
      setFieldErrors((prev) => ({ ...prev, clusterName: immediateError }));
      return;
    }

    // Clear error if validation passes
    setFieldErrors((prev) => ({ ...prev, clusterName: '' }));
  }, []);

  // Function to handle basic config field updates
  const updateBasicConfigField = (field: string, value: string) => {
    setOpenshiftBasicConfig((prev) => ({ ...prev, [field]: value }));

    // Handle cluster name validation
    if (field === 'k8sName') {
      handleClusterNameValidation(value);
    }
  };

  // Function to handle canceling master add/edit for OpenShift
  const cancelOpenshiftMasterOperation = () => {
    if (isEditingMaster) {
      // Just clear the editing state - node is already in the list
      setIsEditingMaster(false);
      setEditingMasterOriginal(null);
    }

    // Reset current master to empty state
    setOpenshiftCurrentMaster({
      name: '',
      selectedServerIp: '', // Start with empty server selection
      selectedPool: 'default',
      selectedNetworkSwitch: '',
      cpuCores: 4,
      memoryGB: 16,
      diskSizeGB: 120,
    });
    setIsAddingMaster(false);
    setNodeInfo(null); // Clear node info when canceling
  };

  // Function to handle canceling worker add/edit for OpenShift
  const cancelOpenshiftWorkerOperation = () => {
    if (isEditingOpenshiftWorker) {
      // Just clear the editing state - worker is already in the list
      setIsEditingOpenshiftWorker(false);
      setEditingOpenshiftWorkerOriginal(null);
    }

    // Reset current worker to empty state
    setOpenshiftCurrentWorker({
      selectedServerIp: envConfig()
        .CONTROL_NODE_IP.URL.replace(/https?:\/\//, '')
        .split(':')[0], // Extract IP from URL
      selectedPool: 'default',
      selectedNetworkSwitch: '',
      cpuCores: 4,
      memoryGB: 8,
      diskSizeGB: 120,
      name: '',
      masterId: '',
      domain_name: '',
    });
    setIsAddingWorker(false);
    setSelectedMasterForWorker('');
  };

  // Clear field errors
  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => ({
        ...prev,
        [fieldName]: undefined,
      }));
    }
  };

  // Handlers for ControlPlaneConfiguration component
  const handleStartAddingMaster = () => {
    // Generate the next control plane name for display
    const existingControlPlaneNames = openshiftMasterNodes.map((m) => m.name);
    let controlPlaneNumber = 1;
    let nextControlPlaneName = `${openshiftBasicConfig.k8sName}-controlplane${controlPlaneNumber}`;

    // Find the next available number
    while (existingControlPlaneNames.includes(nextControlPlaneName)) {
      controlPlaneNumber++;
      nextControlPlaneName = `${openshiftBasicConfig.k8sName}-controlplane${controlPlaneNumber}`;
    }

    // Reset OpenShift master config to empty state when opening modal
    setOpenshiftCurrentMaster({
      name: nextControlPlaneName, // Set the preview name with incremental number
      selectedServerIp: '', // Start with empty server selection
      selectedPool: 'default',
      selectedNetworkSwitch: '',
      cpuCores: 4,
      memoryGB: 16,
      diskSizeGB: 120,
    });
    setIsAddingMaster(true);
    setNodeInfo(null); // Clear node info when starting new
  };

  const handleUpdateCurrentMaster = (updates: Partial<typeof openshiftCurrentMaster>) => {
    setOpenshiftCurrentMaster((prev) => ({ ...prev, ...updates }));
  };

  const handleSaveMaster = () => {
    // Add validation logic
    if (!openshiftCurrentMaster.selectedServerIp) {
      setFieldErrors((prev) => ({ ...prev, selectedServerIp: 'Please select a server' }));
      toast.error('Please select a server');
      return;
    }

    if (!openshiftCurrentMaster.selectedNetworkSwitch) {
      toast.error('Please select a network switch');
      return;
    }

    if (isEditingMaster) {
      // Update existing master in place
      const updatedMaster = {
        ...editingMasterOriginal,
        selectedServerIp: openshiftCurrentMaster.selectedServerIp,
        selectedPool: openshiftCurrentMaster.selectedPool,
        selectedNetworkSwitch: openshiftCurrentMaster.selectedNetworkSwitch,
        cpuCores: openshiftCurrentMaster.cpuCores,
        memoryGB: openshiftCurrentMaster.memoryGB,
        diskSizeGB: openshiftCurrentMaster.diskSizeGB,
      };

      // Update the existing master in the array
      setOpenshiftMasterNodes((prev) =>
        prev.map((m) => (m.id === editingMasterOriginal.id ? updatedMaster : m))
      );

      setIsEditingMaster(false);
      setEditingMasterOriginal(null);
    } else {
      // Add new master with incremental numbering
      const existingControlPlaneNames = openshiftMasterNodes.map((m) => m.name);
      let controlPlaneNumber = 1;
      let newControlPlaneName = `${openshiftBasicConfig.k8sName}-controlplane${controlPlaneNumber}`;

      // Find the next available number
      while (existingControlPlaneNames.includes(newControlPlaneName)) {
        controlPlaneNumber++;
        newControlPlaneName = `${openshiftBasicConfig.k8sName}-controlplane${controlPlaneNumber}`;
      }

      const newMaster = {
        ...openshiftCurrentMaster,
        id: `master-${Date.now()}`,
        name: newControlPlaneName,
      };
      setOpenshiftMasterNodes((prev) => [...prev, newMaster]);
    }

    // Reset form
    cancelOpenshiftMasterOperation();
  };

  const handleEditMaster = (master: any) => {
    // Start editing this master
    setEditingMasterOriginal(master);
    setOpenshiftCurrentMaster({
      name: master.name,
      selectedServerIp: master.selectedServerIp || '',
      selectedPool: master.selectedPool || 'default',
      selectedNetworkSwitch: master.selectedNetworkSwitch || '',
      cpuCores: master.cpuCores,
      memoryGB: master.memoryGB,
      diskSizeGB: master.diskSizeGB,
    });
    setIsEditingMaster(true);
    setIsAddingMaster(true);

    // Fetch server data if server is selected
    if (master.selectedServerIp) {
      fetchServerData(master.selectedServerIp);
    }
  };

  const handleRemoveMaster = (masterId: string) => {
    // Remove master from list
    setOpenshiftMasterNodes((prev) => prev.filter((m) => m.id !== masterId));
    // Also remove associated workers
    setOpenshiftWorkerNodes((prev) => {
      const remainingWorkers = prev.filter((w) => w.masterId !== masterId);
      // If no workers remain, disable HAProxy
      if (remainingWorkers.length === 0) {
        setSetupHAProxy(false);
      }
      return remainingWorkers;
    });
  };

  // Handlers for WorkerNodeConfiguration component
  const handleStartAddingWorker = (masterId: string) => {
    startAddingWorkerForMaster(masterId);
  };

  const handleUpdateCurrentWorker = (updates: Partial<typeof openshiftCurrentWorker>) => {
    setOpenshiftCurrentWorker((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const handleCancelWorkerOperation = () => {
    cancelOpenshiftWorkerOperation();
  };

  const handleSaveWorker = () => {
    // Validation logic
    if (
      !openshiftCurrentWorker.selectedServerIp ||
      !openshiftCurrentWorker.selectedNetworkSwitch ||
      !openshiftCurrentWorker.name
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Extract the worker suffix from the current worker name
    const workerSuffix = openshiftCurrentWorker.name;
    const fullWorkerName = `${openshiftBasicConfig.k8sName}-${workerSuffix}`;

    if (isEditingOpenshiftWorker) {
      // Update existing worker in place
      const updatedWorker = {
        ...editingOpenshiftWorkerOriginal,
        selectedServerIp: openshiftCurrentWorker.selectedServerIp,
        selectedPool: openshiftCurrentWorker.selectedPool,
        selectedNetworkSwitch: openshiftCurrentWorker.selectedNetworkSwitch,
        cpuCores: openshiftCurrentWorker.cpuCores,
        memoryGB: openshiftCurrentWorker.memoryGB,
        diskSizeGB: openshiftCurrentWorker.diskSizeGB,
        name: fullWorkerName,
        domain_name: openshiftCurrentWorker.domain_name,
      };

      // Update the existing worker in the array
      setOpenshiftWorkerNodes((prev) =>
        prev.map((w) => (w.id === editingOpenshiftWorkerOriginal.id ? updatedWorker : w))
      );

      setIsEditingOpenshiftWorker(false);
      setEditingOpenshiftWorkerOriginal(null);
    } else {
      // Add new worker
      const newWorker = {
        ...openshiftCurrentWorker,
        id: `worker-${Date.now()}`,
        name: fullWorkerName, // Use the full name with cluster prefix
      };
      setOpenshiftWorkerNodes((prev) => [...prev, newWorker]);
    }

    // Reset form
    cancelOpenshiftWorkerOperation();
  };

  const handleEditWorker = (worker: any) => {
    // Start editing this worker
    setEditingOpenshiftWorkerOriginal(worker);
    // Extract worker name without cluster prefix
    const workerNameWithoutPrefix = worker.name.replace(`${openshiftBasicConfig.k8sName}-`, '');
    setOpenshiftCurrentWorker({
      selectedServerIp:
        worker.selectedServerIp ||
        envConfig()
          .CONTROL_NODE_IP.URL.replace(/https?:\/\//, '')
          .split(':')[0],
      selectedPool: worker.selectedPool || 'default',
      selectedNetworkSwitch: worker.selectedNetworkSwitch || '',
      cpuCores: worker.cpuCores,
      memoryGB: worker.memoryGB,
      diskSizeGB: worker.diskSizeGB,
      name: workerNameWithoutPrefix,
      masterId: worker.masterId,
      domain_name: worker.domain_name || '',
    });
    setIsEditingOpenshiftWorker(true);
    setIsAddingWorker(true);
    setSelectedMasterForWorker(worker.masterId);

    // Fetch server data if server is selected
    if (worker.selectedServerIp) {
      fetchServerData(worker.selectedServerIp);
    }
  };

  const handleRemoveWorker = (workerId: string) => {
    setOpenshiftWorkerNodes((prev) => {
      const remainingWorkers = prev.filter((w) => w.id !== workerId);
      // If no workers remain, disable HAProxy
      if (remainingWorkers.length === 0) {
        setSetupHAProxy(false);
      }
      return remainingWorkers;
    });
  };

  const handleToggleClusterExpanded = (masterId: string) => {
    toggleClusterExpanded(masterId);
  };

  // Validation functions
  const validateControlPlaneField = (fieldName: string, value: number) => {
    const errors: typeof fieldErrors = {};

    if (fieldName === 'cpuCores' && value < 4) {
      errors['controlPlane_cpuCores'] = 'OpenShift control plane requires minimum 4 CPUs';
    }
    if (fieldName === 'memory' && value < 16) {
      errors['controlPlane_memory'] = 'OpenShift control plane requires minimum 16GB memory';
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }));
  };

  const validateWorkerField = (fieldName: string, value: number) => {
    const errors: typeof fieldErrors = {};

    if (fieldName === 'cpuCores' && value < 4) {
      errors['worker_cpuCores'] = 'OpenShift worker requires minimum 4 CPUs';
    }
    if (fieldName === 'memory' && value < 8) {
      errors['worker_memory'] = 'OpenShift worker requires minimum 8GB memory';
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }));
  };

  // Function to get control plane validation error
  const getControlPlaneValidationError = (): string => {
    if (openshiftMasterNodes.length === 0) {
      return 'At least one control plane node is required';
    }
    if (openshiftMasterNodes.length > 1 && openshiftMasterNodes.length % 2 === 0) {
      return 'OpenShift requires an odd number of control plane nodes for proper etcd quorum (1, 3, 5, etc.)';
    }
    return '';
  };

  // Function to get worker validation error
  const getWorkerValidationError = (): string => {
    // OpenShift can run without dedicated worker nodes (workloads can run on control plane)
    return '';
  };

  // Function to toggle cluster expansion
  const toggleClusterExpanded = (masterId: string) => {
    setExpandedClusters((prev) => {
      const newExpanded = new Set(prev);

      if (newExpanded.has(masterId)) {
        // If clicking on an expanded cluster, close it
        newExpanded.delete(masterId);
        return newExpanded;
      } else {
        // If clicking on a collapsed cluster, close all others and open this one
        return new Set<string>([masterId]);
      }
    });
  };

  // Function to start adding worker for master
  const startAddingWorkerForMaster = (masterId: string) => {
    // Generate next worker name based on existing workers
    const nextWorkerName = getNextWorkerName(false, openshiftBasicConfig.k8sName);

    setSelectedMasterForWorker(masterId);
    setIsAddingWorker(true);
    setOpenshiftCurrentWorker({
      selectedServerIp: envConfig()
        .CONTROL_NODE_IP.URL.replace(/https?:\/\//, '')
        .split(':')[0], // Extract IP from URL
      selectedPool: 'default',
      selectedNetworkSwitch: '',
      cpuCores: 4,
      memoryGB: 8,
      diskSizeGB: 120,
      name: nextWorkerName,
      masterId: masterId,
      domain_name: '',
    });
  };

  // Helper function to get next worker name
  const getNextWorkerName = (isUbuntu: boolean, clusterName: string): string => {
    const workers = openshiftWorkerNodes;
    const existingNames = workers.map((w) => w.name);

    let counter = 1;
    const baseName = isUbuntu ? 'worker' : 'worker';
    let newName = `${clusterName}-${baseName}${counter}`;

    while (existingNames.includes(newName)) {
      counter++;
      newName = `${clusterName}-${baseName}${counter}`;
    }

    // Return just the worker part without the cluster prefix
    return `${baseName}${counter}`;
  };

  // Function to clear creation errors
  const clearCreationErrors = () => {
    setCreationErrors([]);
  };

  // Check if configuration is complete for deployment
  const isConfigurationComplete = (): boolean => {
    // Check basic configuration
    if (!openshiftBasicConfig.k8sName || fieldErrors['clusterName']) {
      return false;
    }

    // Check domain name
    if (!openshiftBasicConfig.domain_name) {
      return false;
    }

    // Check control plane nodes
    if (openshiftMasterNodes.length === 0) {
      return false;
    }

    // Check for odd number of control planes (required for etcd quorum)
    if (openshiftMasterNodes.length > 1 && openshiftMasterNodes.length % 2 === 0) {
      return false;
    }

    // Worker nodes are optional for OpenShift (can run workloads on control plane)

    // Validate all control plane nodes have required fields
    for (const master of openshiftMasterNodes) {
      if (!master.selectedNetworkSwitch) {
        return false;
      }
    }

    // Validate all worker nodes have required fields
    for (const worker of openshiftWorkerNodes) {
      if (!worker.selectedNetworkSwitch || !worker.name) {
        return false;
      }
    }

    // Check for any validation errors
    const hasErrors = Object.values(fieldErrors).some((error) => error && error.length > 0);
    if (hasErrors) {
      return false;
    }

    return true;
  };

  // Get missing configuration requirements
  const getMissingRequirements = (): string[] => {
    const missing: string[] = [];

    if (!openshiftBasicConfig.k8sName) {
      missing.push('Cluster name is required');
    }

    if (fieldErrors['clusterName']) {
      missing.push('Fix cluster name validation error');
    }

    if (!openshiftBasicConfig.domain_name) {
      missing.push('DNS zone is required');
    }

    if (openshiftMasterNodes.length === 0) {
      missing.push('At least one control plane node is required');
    }

    if (openshiftMasterNodes.length > 1 && openshiftMasterNodes.length % 2 === 0) {
      missing.push('OpenShift requires an odd number of control plane nodes (1, 3, 5, etc.)');
    }

    // Check control plane nodes
    const mastersWithoutSwitch = openshiftMasterNodes.filter((m) => !m.selectedNetworkSwitch);
    if (mastersWithoutSwitch.length > 0) {
      missing.push(`${mastersWithoutSwitch.length} control plane node(s) missing network switch`);
    }

    // Check worker nodes
    const workersWithoutSwitch = openshiftWorkerNodes.filter((w) => !w.selectedNetworkSwitch);
    if (workersWithoutSwitch.length > 0) {
      missing.push(`${workersWithoutSwitch.length} worker node(s) missing network switch`);
    }

    const workersWithoutName = openshiftWorkerNodes.filter((w) => !w.name);
    if (workersWithoutName.length > 0) {
      missing.push(`${workersWithoutName.length} worker node(s) missing name`);
    }

    // Check for field validation errors
    const errorFields = Object.entries(fieldErrors).filter(
      ([_, error]) => error && error.length > 0
    );
    if (errorFields.length > 0) {
      missing.push('Fix validation errors in form fields');
    }

    return missing;
  };

  // HAProxy setup function - disabled (no API call)
  const setupHAProxyForCluster = async (clusterName: string): Promise<void> => {
    try {
      setHAProxyStatus({
        isLoading: true,
        success: false,
        response: null,
        error: null,
        progress: 0,
        progressMessage: 'HAProxy setup skipped - functionality disabled',
      });

      // HAProxy API call removed - no longer needed
      logger.info('HAProxy setup skipped for cluster:', clusterName);

      setHAProxyStatus({
        isLoading: false,
        success: true,
        response: null,
        error: null,
        progress: 100,
        progressMessage: 'HAProxy setup skipped',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('HAProxy setup error:', error);

      setHAProxyStatus({
        isLoading: false,
        success: false,
        response: null,
        error: errorMessage,
        progress: 0,
        progressMessage: 'HAProxy setup failed',
      });

      throw error;
    }
  };

  // Main deployment handler
  const handleDeployCluster = async () => {
    // Prevent duplicate calls
    const now = Date.now();
    if (isSubmitting || now - lastOperationTimestamp < 2000) {
      logger.warn('OpenShift deployment already in progress...');
      return;
    }

    // Final validation check
    if (!isConfigurationComplete()) {
      toast.error('Please complete all required configurations before deploying');
      return;
    }

    try {
      setIsSubmitting(true);
      setLastOperationTimestamp(now);
      clearCreationErrors();

      setStatusMessage('Initiating OpenShift cluster deployment...');
      logger.info('Starting OpenShift cluster deployment', {
        clusterName: openshiftBasicConfig.k8sName,
        controlPlanes: openshiftMasterNodes.length,
        workers: openshiftWorkerNodes.length,
      });

      window.dispatchEvent(
        new CustomEvent('clusterCreated', {
          detail: {
            clusterName: openshiftBasicConfig.k8sName,
            optimistic: true,
            status: 'provisioning',
          },
        })
      );

      // Create deployment payload
      const masterPayloads = openshiftMasterNodes.map((master, index) => {
        // Find the server object to get FQDN
        const selectedServer = allServers.find((s) => s.ip === master.selectedServerIp);
        const nodeIp = selectedServer
          ? selectedServer.fqdn || selectedServer.ip
          : master.selectedServerIp;

        const masterPayload: any = {
          vm_name: master.name,
          os_types: 'other',
          loader: 'uefi',
          cpu: master.cpuCores,
          sockets: 1, // Required field - default to 1 socket
          memory: `${master.memoryGB}G`,
          disk0_size: `${master.diskSizeGB}G`,
          network0_switch: master.selectedNetworkSwitch,
          kubernetes_cluster_name: openshiftBasicConfig.k8sName,
          kubernetes_type: 'openshift-kubernetes',
          kubernetes_worker_type: 'control-plane',
          node_ip: nodeIp, // FQDN with IP fallback
          pool: master.selectedPool || 'default',
          domain_name: openshiftBasicConfig.domain_name || '',
          disk0_type: 'virtio-blk',
          disk0_name: 'disk0.img',
          datastore: 'default',
          graphics: "yes"
        };

        // Add haproxy_enabled if HAProxy is selected
        if (setupHAProxy) {
          masterPayload.haproxy_enabled = true;
        }

        return masterPayload;
      });

      const workerPayloads = openshiftWorkerNodes.map((worker) => {
        // Find the server object to get FQDN
        const selectedServer = allServers.find((s) => s.ip === worker.selectedServerIp);
        const nodeIp = selectedServer
          ? selectedServer.fqdn || selectedServer.ip
          : worker.selectedServerIp;

        const workerPayload: any = {
          vm_name: worker.name,
          os_types: 'other',
          loader: 'uefi',
          cpu: worker.cpuCores,
          sockets: 1, // Required field - default to 1 socket
          memory: `${worker.memoryGB}G`,
          disk0_size: `${worker.diskSizeGB}G`,
          network0_switch: worker.selectedNetworkSwitch,
          kubernetes_cluster_name: openshiftBasicConfig.k8sName,
          kubernetes_type: 'openshift-kubernetes',
          kubernetes_worker_type: 'worker',
          node_ip: nodeIp, // FQDN with IP fallback
          pool: worker.selectedPool || 'default',
          domain_name: worker.domain_name || openshiftBasicConfig.domain_name || '',
          disk0_type: 'virtio-blk',
          disk0_name: 'disk0.img',
          datastore: 'default',
          graphics: "yes"
        };

        // Add haproxy_enabled if HAProxy is selected
        if (setupHAProxy) {
          workerPayload.haproxy_enabled = true;
        }

        return workerPayload;
      });

      const combinedPayload = [...masterPayloads, ...workerPayloads];

      setStatusMessage(
        `Creating ${masterPayloads.length} control plane(s) and ${workerPayloads.length} worker(s)...`
      );

      // Make batch API call for cluster creation
      const batchEndpoint = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/openshift/provision/batch`;

      const batchResponse = await api.fetch(batchEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(combinedPayload),
      });

      if (!batchResponse.ok) {
        throw new Error(
          `Cluster creation failed: ${batchResponse.status} ${batchResponse.statusText}`
        );
      }

      const batchResult = await batchResponse.json();
      logger.info('Batch creation response:', batchResult);

      // Store job ID if available in response for job tracking
      let jobId = null;
      if (batchResult.batch_job_id) {
        jobId = batchResult.batch_job_id;
        const storageKey = `cluster-job-${openshiftBasicConfig.k8sName}`;
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            jobId: jobId,
            jobType: 'openshift-cluster-creation',
            clusterName: openshiftBasicConfig.k8sName,
            timestamp: Date.now(),
          })
        );
        logger.info(
          `Stored OpenShift job ${jobId} in localStorage for cluster ${openshiftBasicConfig.k8sName}`
        );

        // Dispatch event with job info for sidebar to update with real data
        window.dispatchEvent(
          new CustomEvent('clusterCreated', {
            detail: {
              clusterName: openshiftBasicConfig.k8sName,
              jobId: jobId,
              status: 'provisioning',
            },
          })
        );
      }

      setStatusMessage('Cluster nodes created successfully. Initializing cluster...');

      // Handle HAProxy setup if enabled
      if (setupHAProxy) {
        try {
          setStatusMessage('Setting up HAProxy load balancer...');
          await setupHAProxyForCluster(openshiftBasicConfig.k8sName);

          // Success path with HAProxy
          setStatusMessage('OpenShift cluster with HAProxy deployed successfully!');

          // Dispatch success events
          window.dispatchEvent(
            new CustomEvent('clusterCreated', {
              detail: { clusterName: openshiftBasicConfig.k8sName },
            })
          );
          window.dispatchEvent(
            new CustomEvent('haproxySetupCompleted', {
              detail: { clusterName: openshiftBasicConfig.k8sName },
            })
          );

          toast.success(
            `OpenShift cluster "${openshiftBasicConfig.k8sName}" with HAProxy deployed successfully!`
          );

          // Navigate after delay to ensure backend processing
          setTimeout(() => {
            setIsSubmitting(false);
            navigate(`/cluster/${openshiftBasicConfig.k8sName}/details`, {
              replace: true,
              state: jobId
                ? { showJobStatus: true, jobId, jobType: 'openshift-cluster-creation' }
                : undefined,
            });
          }, 3000);

          return;
        } catch (error) {
          // HAProxy failed but cluster might still be created
          const errorMessage = error instanceof Error ? error.message : 'HAProxy setup failed';
          logger.error('HAProxy setup failed:', error);

          setStatusMessage(`Cluster created but HAProxy setup failed: ${errorMessage}`);
          toast.error(`Cluster created but HAProxy setup failed: ${errorMessage}`);

          window.dispatchEvent(
            new CustomEvent('haproxySetupFailed', {
              detail: { clusterName: openshiftBasicConfig.k8sName, error: errorMessage },
            })
          );

          // Still navigate to show cluster details
          setTimeout(() => {
            setIsSubmitting(false);
            navigate(`/cluster/${openshiftBasicConfig.k8sName}/details`, {
              replace: true,
              state: jobId
                ? { showJobStatus: true, jobId, jobType: 'openshift-cluster-creation' }
                : undefined,
            });
          }, 3000);

          return;
        }
      } else {
        // No HAProxy - direct cluster creation completion
        setStatusMessage('OpenShift cluster deployed successfully!');

        window.dispatchEvent(
          new CustomEvent('clusterCreated', {
            detail: { clusterName: openshiftBasicConfig.k8sName },
          })
        );

        toast.success(`OpenShift cluster "${openshiftBasicConfig.k8sName}" deployed successfully!`);

        setTimeout(() => {
          setIsSubmitting(false);
          navigate(`/cluster/${openshiftBasicConfig.k8sName}/details`, {
            replace: true,
            state: jobId
              ? { showJobStatus: true, jobId, jobType: 'openshift-cluster-creation' }
              : undefined,
          });
        }, 1500);
      }
    } catch (error) {
      logger.error('OpenShift deployment failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatusMessage(`Deployment failed: ${errorMessage}`);
      toast.error(`Deployment failed: ${errorMessage}`);

      // Add to creation errors
      setCreationErrors((prev) => [
        ...prev,
        {
          nodeName: 'Cluster',
          nodeType: 'deployment',
          error: errorMessage,
        },
      ]);

      // Dispatch event to remove optimistic cluster on error
      window.dispatchEvent(
        new CustomEvent('clusterCreationFailed', {
          detail: {
            clusterName: openshiftBasicConfig.k8sName,
            error: errorMessage,
          },
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch network switches from control node on component mount
  useEffect(() => {
    const fetchNetworkSwitches = async () => {
      try {
        // Fetch network switches using the correct API endpoint structure
        const switchesResponse = await api.fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (switchesResponse.ok) {
          const switchesData = await switchesResponse.json();
          if (switchesData && Array.isArray(switchesData)) {
            // Extract switch names from the response array
            const switchNames = switchesData.map((sw: any) => sw.name).filter(Boolean);
            setOpenshiftMasterNetworkSwitches(switchNames);
            setOpenshiftWorkerNetworkSwitches(switchNames);
          }
        }
      } catch (error) {
        logger.error('Error fetching network switches from control node:', error);
      }
    };

    fetchNetworkSwitches();
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <SiRedhatopenshift className="w-8 h-8 text-red-600" />
          <h1 className="text-2xl font-bold text-gray-900">OpenShift Setup</h1>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">{statusMessage}</p>
        </div>
      )}

      {/* Creation Errors */}
      {creationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">Creation Errors:</h4>
          <ul className="list-disc list-inside space-y-1">
            {creationErrors.map((error, index) => (
              <li key={index} className="text-red-700 text-sm">
                <strong>
                  {error.nodeType}: {error.nodeName}
                </strong>{' '}
                - {error.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* HAProxy Loading Overlay */}
      {haproxyStatus.isLoading && (
        <div className="fixed inset-0 z-50 backdrop-blur-sm bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-karios-blue mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Setting Up HAProxy Load Balancer
              </h3>
              <p className="text-sm text-gray-600 mb-4">{haproxyStatus.progressMessage}</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-karios-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${haproxyStatus.progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{haproxyStatus.progress}% Complete</p>
              <p className="text-xs text-amber-600 mt-3">
                Please do not close or refresh this page
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Status */}
      {!isConfigurationComplete() && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-semibold text-amber-800 mb-2">Configuration Required:</h4>
          <ul className="list-disc list-inside space-y-1">
            {getMissingRequirements().map((requirement, index) => (
              <li key={index} className="text-amber-700 text-sm">
                {requirement}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-8">
        {/* Cluster Name */}
        <div className="space-y-4">
          <div>
            <label htmlFor="clusterName" className="block text-sm font-medium text-gray-700 mb-2">
              Cluster Name <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center">
              <div className="bg-gray-100 border border-gray-300 border-r-0 rounded-l-md px-3 py-2 text-gray-600 font-medium">
                op-
              </div>
              <input
                type="text"
                id="clusterName"
                value={
                  openshiftBasicConfig.k8sName.startsWith('op-')
                    ? openshiftBasicConfig.k8sName.substring(3)
                    : openshiftBasicConfig.k8sName
                }
                onChange={(e) => {
                  const value = e.target.value;
                  // Combine prefix with user input
                  updateBasicConfigField('k8sName', `op-${value}`);
                }}
                placeholder="clustername"
                className={`flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 ${
                  fieldErrors['clusterName']
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'focus:ring-karios-blue focus:border-transparent'
                }`}
              />
            </div>
            {fieldErrors['clusterName'] && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors['clusterName']}</p>
            )}
          </div>

          {/* DNS Zone Selection */}
          <div>
            <DnsZoneDropdown
              value={openshiftBasicConfig.domain_name}
              onChange={(domain: string) => {
                updateBasicConfigField('domain_name', domain);
              }}
              required={true}
            />
            {fieldErrors['domain_name'] && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors['domain_name']}</p>
            )}
          </div>
        </div>

        {/* Only show Control Plane and Worker Configuration if cluster name is valid */}
        {openshiftBasicConfig.k8sName &&
          openshiftBasicConfig.k8sName.length > 3 &&
          !fieldErrors['clusterName'] && (
            <>
              {/* Control Plane Configuration */}
              <ControlPlaneConfiguration
                clusterName={openshiftBasicConfig.k8sName}
                isAddingMaster={isAddingMaster}
                isEditingMaster={isEditingMaster}
                currentMaster={openshiftCurrentMaster}
                masterNodes={openshiftMasterNodes}
                networkSwitches={openshiftMasterNetworkSwitches}
                nodeInfo={nodeInfo}
                fieldErrors={fieldErrors}
                allServers={allServers}
                onStartAddingMaster={handleStartAddingMaster}
                onUpdateCurrentMaster={handleUpdateCurrentMaster}
                onClearFieldError={clearFieldError}
                onValidateField={validateControlPlaneField}
                onCancelOperation={cancelOpenshiftMasterOperation}
                onSaveMaster={handleSaveMaster}
                onEditMaster={handleEditMaster}
                onRemoveMaster={handleRemoveMaster}
                onFetchServerData={fetchServerData}
                getValidationError={getControlPlaneValidationError}
              />

              {/* Worker Node Configuration */}
              <WorkerNodeConfiguration
                clusterName={openshiftBasicConfig.k8sName}
                isAddingWorker={isAddingWorker}
                isEditingWorker={isEditingOpenshiftWorker}
                currentWorker={openshiftCurrentWorker}
                editingWorkerOriginal={editingOpenshiftWorkerOriginal}
                workerNodes={openshiftWorkerNodes}
                masterNodes={openshiftMasterNodes}
                networkSwitches={openshiftWorkerNetworkSwitches}
                nodeInfo={nodeInfo}
                fieldErrors={fieldErrors}
                expandedClusters={expandedClusters}
                allServers={allServers}
                onStartAddingWorker={handleStartAddingWorker}
                onUpdateCurrentWorker={handleUpdateCurrentWorker}
                onClearFieldError={clearFieldError}
                onValidateField={validateWorkerField}
                onCancelOperation={handleCancelWorkerOperation}
                onSaveWorker={handleSaveWorker}
                onEditWorker={handleEditWorker}
                onRemoveWorker={handleRemoveWorker}
                onToggleClusterExpanded={handleToggleClusterExpanded}
                onFetchServerData={fetchServerData}
                getValidationError={getWorkerValidationError}
              />
              {/* HAProxy Configuration */}
              <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Load Balancer Configuration</h3>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="setupHAProxy"
                    checked={setupHAProxy}
                    onChange={(e) => setSetupHAProxy(e.target.checked)}
                    className="h-4 w-4 text-karios-blue focus:ring-karios-blue border-gray-300 rounded"
                    disabled={
                      openshiftMasterNodes.length === 0 || openshiftWorkerNodes.length === 0
                    }
                  />
                  <label htmlFor="setupHAProxy" className="text-sm font-medium text-gray-700">
                    Setup HAProxy Load Balancer
                  </label>
                </div>

                <p className="text-sm text-gray-600">
                  Automatically configure HAProxy load balancer for high availability cluster
                  access.
                  {openshiftMasterNodes.length === 0 || openshiftWorkerNodes.length === 0
                    ? ' (Requires at least one control plane and one worker node)'
                    : ''}
                </p>

                {openshiftWorkerNodes.length === 0 && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-xs text-amber-700">
                      <strong>Note:</strong> HAProxy load balancer requires at least one worker node
                      to distribute traffic effectively. Add worker nodes to enable HAProxy
                      configuration.
                    </p>
                  </div>
                )}

                {/* HAProxy Status Display */}
                {haproxyStatus.error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-700">HAProxy Error: {haproxyStatus.error}</p>
                  </div>
                )}

                {haproxyStatus.success && haproxyStatus.response && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-sm text-green-700">HAProxy setup completed successfully!</p>
                  </div>
                )}
              </div>
            </>
          )}

        {/* Deploy Button Section */}
        <div className="border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Deploy OpenShift Cluster</h3>
              <p className="text-sm text-gray-600 mt-1">
                Review your configuration and deploy the cluster
              </p>
            </div>

            <button
              onClick={handleDeployCluster}
              disabled={!isConfigurationComplete() || isSubmitting}
              className={`px-6 py-3 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                isConfigurationComplete() && !isSubmitting
                  ? 'text-white bg-karios-blue border border-transparent hover:bg-blue-700 focus:ring-karios-blue'
                  : 'text-gray-500 bg-gray-100 border border-gray-300 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deploying...
                </div>
              ) : (
                'Deploy OpenShift Cluster'
              )}
            </button>
          </div>

          {/* Configuration Summary */}
          {isConfigurationComplete() && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h4 className="text-sm font-semibold text-green-800 mb-2">Configuration Summary:</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>Cluster Name: {openshiftBasicConfig.k8sName}</li>
                <li>DNS Zone: {openshiftBasicConfig.domain_name}</li>
                <li>Control Planes: {openshiftMasterNodes.length}</li>
                <li>Workers: {openshiftWorkerNodes.length}</li>
                <li>HAProxy: {setupHAProxy ? 'Enabled' : 'Disabled'}</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpenShiftSetup;
