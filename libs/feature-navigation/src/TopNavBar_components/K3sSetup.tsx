import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useAppState } from '@karios-monorepo/shared-state';
import { logger } from '../../../shared-state/src/utils/logger';
import envConfig from '../../../../runtime-config';
import JobStatusModal from '../../../feature-datacenter/src/JobStatusModal';
import { DnsZoneDropdown } from './shared';
import K3sControlPlaneForm from './K3sControlPlaneForm';
import K3sWorkerForm from './K3sWorkerForm';
import BootstrapNodeConfig from './BootstrapNodeConfig';
/**
 * K3S Cluster Setup Component
 *
 * Naming Conventions:
 * - Cluster Names: K3S-{clustername}
 * - Bootstrap Control Plane: K3S-controlplane1
 * - Additional Control Planes: K3S-controlplane2, K3S-controlplane3, etc.
 * - Worker Nodes: K3S-worker1, K3S-worker2, etc.
 *
 * This component handles the complete K3S cluster provisioning workflow
 * with modal-based configuration for control planes and workers.
 */

interface K3sSetupProps {
  dataCenters?: any[];
  onBack?: () => void;
}

interface K3sClusterConfig {
  clusterName: string;
  username: string;
  password: string;
  selectedImage: string;
  dnsZone: string;
}

interface K3sControlPlane {
  name: string;
  selectedServerIp: string;
  selectedPool: string;
  selectedNetworkSwitch: string;
  cpuCores: number;
  memoryGB: number;
  diskSizeGB: number;
  prometheusEnabled: boolean;
  argocdEnabled: boolean;
}

interface K3sAdditionalControlPlane {
  id: string;
  name: string;
  selectedServerIp: string;
  selectedPool: string;
  selectedNetworkSwitch: string;
  cpuCores: number;
  memoryGB: number;
  diskSizeGB: number;
}

interface K3sWorker {
  id: string;
  name: string;
  selectedServerIp: string;
  selectedPool: string;
  selectedNetworkSwitch: string;
  cpuCores: number;
  memoryGB: number;
  diskSizeGB: number;
}

const K3sSetup: React.FC<K3sSetupProps> = ({ dataCenters = [], onBack }) => {
  const navigate = useNavigate();

  // Shared state for cloud images
  const { state } = useAppState();
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState<boolean>(false);
  const [imageDropdownOpen, setImageDropdownOpen] = useState<boolean>(false);
  const imageDropdownRef = useRef<HTMLDivElement>(null);

  // Basic cluster configuration
  const [clusterConfig, setClusterConfig] = useState<K3sClusterConfig>({
    clusterName: '',
    username: '',
    password: '',
    selectedImage: '',
    dnsZone: '',
  });

  // Bootstrap Control Plane (there's only one)
  const [bootstrapControlPlane, setBootstrapControlPlane] = useState<K3sControlPlane | null>(null);
  const [isBootstrapModalOpen, setIsBootstrapModalOpen] = useState(false);
  const [showBootstrapForm, setShowBootstrapForm] = useState(false);
  const [showAdditionalControlPlaneForm, setShowAdditionalControlPlaneForm] = useState(false);
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [editingBootstrap, setEditingBootstrap] = useState(false);
  const [editingAdditionalIndex, setEditingAdditionalIndex] = useState<number | null>(null);
  const [editingWorkerIndex, setEditingWorkerIndex] = useState<number | null>(null);
  const [currentBootstrapConfig, setCurrentBootstrapConfig] = useState<K3sControlPlane>({
    name: 'K3S-controlplane1',
    selectedServerIp: '',
    selectedPool: '',
    selectedNetworkSwitch: '',
    cpuCores: 4,
    memoryGB: 4,
    diskSizeGB: 30,
    prometheusEnabled: false,
    argocdEnabled: false,
  });

  // Additional Control Planes
  const [additionalControlPlanes, setAdditionalControlPlanes] = useState<
    K3sAdditionalControlPlane[]
  >([]);
  const [isAdditionalControlPlaneModalOpen, setIsAdditionalControlPlaneModalOpen] = useState(false);
  const [currentAdditionalControlPlane, setCurrentAdditionalControlPlane] =
    useState<K3sAdditionalControlPlane>({
      id: '',
      name: '',
      selectedServerIp: '',
      selectedPool: '',
      selectedNetworkSwitch: '',
      cpuCores: 4,
      memoryGB: 4,
      diskSizeGB: 30,
    });

  // Workers
  const [workers, setWorkers] = useState<K3sWorker[]>([]);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [currentWorker, setCurrentWorker] = useState<K3sWorker>({
    id: '',
    name: '',
    selectedServerIp: '',
    selectedPool: '',
    selectedNetworkSwitch: '',
    cpuCores: 2,
    memoryGB: 2,
    diskSizeGB: 20,
  });

  // Server data
  const [serverData, setServerData] = useState<{
    [serverIp: string]: {
      nodeInfo: any;
      pools: any[];
      networkSwitches: string[];
    };
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigatingToCluster, setIsNavigatingToCluster] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [provisioningErrors, setProvisioningErrors] = useState<
    { name: string; error: string; message?: string }[]
  >([]);

  // K3s setup loading status (similar to HAProxy status)
  const [k3sSetupStatus, setK3sSetupStatus] = useState<{
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

  // Password visibility state
  const [showK3sPassword, setShowK3sPassword] = useState<boolean>(false);

  // Control plane and worker group count tracking for inline count inputs (like Ubuntu)
  const [controlPlaneGroupCounts, setControlPlaneGroupCounts] = useState<{
    [configKey: string]: number;
  }>({});
  const [controlPlaneGroupInputs, setControlPlaneGroupInputs] = useState<{
    [configKey: string]: string;
  }>({});
  const [workerGroupCounts, setWorkerGroupCounts] = useState<{ [configKey: string]: number }>({});
  const [workerGroupInputs, setWorkerGroupInputs] = useState<{ [configKey: string]: string }>({});

  // Job Status Modal state
  const [isJobModalOpen, setIsJobModalOpen] = useState<boolean>(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentJobType, setCurrentJobType] = useState<string | null>(null);

  // Update names when cluster name changes (similar to Ubuntu implementation)
  useEffect(() => {
    if (!clusterConfig.clusterName) return;

    // Update bootstrap control plane name if it exists
    if (bootstrapControlPlane) {
      const newBootstrapName = `k3s-${clusterConfig.clusterName}-controlplane`;
      if (bootstrapControlPlane.name !== newBootstrapName) {
        setBootstrapControlPlane((prev) => (prev ? { ...prev, name: newBootstrapName } : null));
      }
    }

    // Update additional control plane names with proper sequential numbering
    setAdditionalControlPlanes((prev) => {
      if (prev.length === 0) return prev;

      const updated = prev.map((cp, index) => {
        // Start from controlplane2 since bootstrap is controlplane (without number)
        const newName = `k3s-${clusterConfig.clusterName}-controlplane${index + 2}`;
        return { ...cp, name: newName };
      });

      return updated;
    });

    // Update worker names with proper sequential numbering
    setWorkers((prev) => {
      if (prev.length === 0) return prev;

      const updated = prev.map((worker, index) => {
        const newName = `k3s-${clusterConfig.clusterName}-worker${index + 1}`;
        return { ...worker, name: newName };
      });

      return updated;
    });
  }, [clusterConfig.clusterName]);

  // Helper function to validate K3S username (same as Ubuntu)
  const validateK3sUsername = (username: string): string | undefined => {
    if (!username) return undefined;
    const lowerUsername = username.toLowerCase().trim();
    if (lowerUsername === 'admin' || lowerUsername === 'root') {
      return 'For K3S, the username cannot be admin or root';
    }
    return undefined;
  };

  // Helper function to validate K3S password (same as Ubuntu)
  const validateK3sPassword = (password: string): string | undefined => {
    if (!password) return undefined;
    if (password.length < 6) {
      return 'Password must be at least 6 characters for K3S provisioning';
    }
    return undefined;
  };

  // Helper function to validate selected image
  const validateSelectedImage = (selectedImage: string): string | undefined => {
    if (!selectedImage) {
      return 'Please select a cloud image for K3S provisioning';
    }
    return undefined;
  };

  // Cluster name validation state (similar to K8sSetup validation pattern)
  const [validationTimeouts, setValidationTimeouts] = useState<{ [key: string]: number }>({});
  const [allClusters, setAllClusters] = useState<any[]>([]);

  // Function to validate cluster name (same as K8sSetup validation pattern)
  const validateClusterName = (value: string): string => {
    // Basic validation - check if there's content after prefix
    const prefix = 'k3s-';

    // Extract the base name (without prefix)
    const baseName = value.trim();
    if (!baseName) {
      return `Please enter a cluster name`;
    }

    // Check against existing clusters
    if (allClusters.length > 0) {
      const fullClusterName = `${prefix}${baseName}`;
      const existingCluster = allClusters.find(
        (cluster: any) => cluster.clusterName === fullClusterName
      );

      if (existingCluster) {
        return `Cluster name '${fullClusterName}' already exists. Please choose a different name.`;
      }
    }

    return '';
  };

  // Function to handle cluster name validation with debouncing for API calls
  const handleClusterNameValidation = React.useCallback(
    async (value: string) => {
      // Clear existing timeout for this field
      if (validationTimeouts['clusterName']) {
        clearTimeout(validationTimeouts['clusterName']);
      }

      // Immediate basic validation (like K8sSetup validation)
      const basicError = validateClusterName(value);
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
            const freshError = validateClusterName(value);
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

  // Fetch cloud images on component mount
  useEffect(() => {
    // Don't fetch on mount, wait for user to click dropdown
  }, [dataCenters, clusterConfig.selectedImage]);

  // Function to fetch cloud images when dropdown is clicked
  const fetchCloudImages = async () => {
    setImagesLoading(true);
    try {
      // Use control node IP like Ubuntu does
      const serverIp = envConfig().CONTROL_NODE_IP.URL;

      if (!serverIp) {
        toast.error('Control node not configured');
        return;
      }

      const response = await fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/cloudimages`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const images = data.raws || [];
        setAvailableImages(images);
        // Set first image as default if none selected
        if (images.length > 0 && !clusterConfig.selectedImage) {
          setClusterConfig((prev) => ({ ...prev, selectedImage: images[0] }));
        }
      } else {
        logger.error('Failed to fetch cloud images', {
          status: response.status,
          statusText: response.statusText,
        });
        toast.error('Failed to fetch available images');
      }
    } catch (error) {
      logger.error('Error fetching cloud images', error);
      toast.error('Failed to fetch available images');
    } finally {
      setImagesLoading(false);
    }
  };

  // Click outside handler for image dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (imageDropdownRef.current && !imageDropdownRef.current.contains(event.target as Node)) {
        setImageDropdownOpen(false);
      }
    };

    if (imageDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [imageDropdownOpen]);

  // Prevent navigation during K3s cluster creation (similar to HAProxy pattern)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (k3sSetupStatus.isLoading) {
        e.preventDefault();
        e.returnValue = 'K3s cluster setup is in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    if (k3sSetupStatus.isLoading) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [k3sSetupStatus.isLoading]);

  // Enhanced resource validation following Ubuntu/OpenShift pattern
  const calculateAllocatedResources = (
    serverIp: string,
    excludeCurrentEdit = false,
    excludeNodeId?: string
  ) => {
    let allocatedCpus = 0;
    let allocatedMemory = 0;

    // Check bootstrap control plane allocation for this server
    if (bootstrapControlPlane && bootstrapControlPlane.selectedServerIp === serverIp) {
      // Exclude if we're editing this specific node
      if (!(excludeCurrentEdit && excludeNodeId === 'bootstrap')) {
        allocatedCpus += bootstrapControlPlane.cpuCores;
        allocatedMemory += bootstrapControlPlane.memoryGB;
      }
    }

    // Check additional control planes allocation for this server
    additionalControlPlanes.forEach((controlPlane) => {
      if (controlPlane.selectedServerIp === serverIp) {
        // Exclude the control plane being edited if we're in edit mode
        if (excludeCurrentEdit && excludeNodeId && controlPlane.id === excludeNodeId) {
          return; // Skip this control plane
        }
        allocatedCpus += controlPlane.cpuCores;
        allocatedMemory += controlPlane.memoryGB;
      }
    });

    // Check worker allocations for this server
    workers.forEach((worker) => {
      if (worker.selectedServerIp === serverIp) {
        // Exclude the worker being edited if we're in edit mode
        if (excludeCurrentEdit && excludeNodeId && worker.id === excludeNodeId) {
          return; // Skip this worker
        }
        allocatedCpus += worker.cpuCores;
        allocatedMemory += worker.memoryGB;
      }
    });

    return { allocatedCpus, allocatedMemory };
  };

  // Enhanced batch validation for K3s following Ubuntu/OpenShift pattern
  const validateBatchNodeCreation = (
    nodeType: 'bootstrap' | 'control-plane' | 'worker',
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number,
    serverIp: string,
    targetCount: number = 1,
    excludeNodeId?: string
  ) => {
    const errors: { [key: string]: string } = {};

    if (!serverIp) {
      errors['cpuCores'] = 'Please select a server first';
      errors['memory'] = 'Please select a server first';
      errors['diskSize'] = 'Please select a server first';
      return errors;
    }

    const serverInfo = serverData[serverIp];
    if (!serverInfo?.nodeInfo) {
      errors['cpuCores'] = 'Unable to validate resources - server data not loaded';
      errors['memory'] = 'Unable to validate resources - server data not loaded';
      errors['diskSize'] = 'Unable to validate resources - server data not loaded';
      return errors;
    }

    const nodeInfo = serverInfo.nodeInfo;
    const totalCpus = nodeInfo.cpus || 0;
    const totalMemoryMB = nodeInfo.memory || 0;
    const totalMemory = Math.floor(totalMemoryMB / 1024);
    const usedCpus = nodeInfo.cpus_in_use || 0;
    const usedMemoryMB = nodeInfo.memory_in_use || 0;
    const usedMemory = Math.floor(usedMemoryMB / 1024);

    // Calculate already allocated resources
    // When excludeNodeId is provided, we're editing an existing node, so exclude it from allocation count
    const { allocatedCpus, allocatedMemory } = calculateAllocatedResources(
      serverIp,
      !!excludeNodeId,
      excludeNodeId
    );

    // Calculate resources needed for the batch of nodes
    const batchCpuNeeded = cpuCores * targetCount;
    const batchMemoryNeeded = memoryGB * targetCount;

    // Calculate truly available resources
    const availableCpus = totalCpus - usedCpus - allocatedCpus;
    const availableMemory = totalMemory - usedMemory - allocatedMemory;

    // Get minimum requirements for K3s
    const isControlPlane = nodeType === 'bootstrap' || nodeType === 'control-plane';
    const minCpu = isControlPlane ? 4 : 2;
    const minMemory = isControlPlane ? 4 : 2;
    const minDisk = isControlPlane ? 30 : 20;

    // Check minimum requirements per node
    if (cpuCores < minCpu) {
      errors['cpuCores'] = `K3s ${nodeType} requires minimum ${minCpu} CPU's`;
    }

    if (memoryGB < minMemory) {
      errors['memory'] = `K3s ${nodeType} requires minimum ${minMemory}GB memory`;
    }

    if (diskSizeGB < minDisk) {
      errors['diskSize'] = `K3s ${nodeType} requires minimum ${minDisk}GB disk space`;
    }

    // Check if batch creation would exceed available resources
    if (!errors['cpuCores'] && batchCpuNeeded > availableCpus) {
      errors['cpuCores'] =
        `Cannot create ${targetCount} ${nodeType}${targetCount > 1 ? 's' : ''}: Need ${batchCpuNeeded} CPU's total (${cpuCores} × ${targetCount}), but only ${availableCpus} CPU's available (${totalCpus} total - ${usedCpus} used - ${allocatedCpus} allocated)`;
    }

    if (!errors['memory'] && batchMemoryNeeded > availableMemory) {
      errors['memory'] =
        `Cannot create ${targetCount} ${nodeType}${targetCount > 1 ? 's' : ''}: Need ${batchMemoryNeeded}GB memory total (${memoryGB}GB × ${targetCount}), but only ${availableMemory}GB available (${totalMemory}GB total - ${usedMemory}GB used - ${allocatedMemory}GB allocated)`;
    }

    return errors;
  };

  // Helper function to calculate resource requirements and availability (enhanced)
  const validateResourceRequirements = (
    serverIp: string,
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number,
    nodeType: 'bootstrap' | 'control-plane' | 'worker' = 'worker',
    excludeNodeId?: string
  ): string | undefined => {
    // Use the enhanced batch validation for single node
    const errors = validateBatchNodeCreation(
      nodeType,
      cpuCores,
      memoryGB,
      diskSizeGB,
      serverIp,
      1,
      excludeNodeId
    );

    // Return the first error found (prioritizing CPU, then memory, then disk)
    if (errors['cpuCores']) return errors['cpuCores'];
    if (errors['memory']) return errors['memory'];
    if (errors['diskSize']) return errors['diskSize'];

    return undefined;
  };

  // Helper function to count total control planes for K3S
  const getK3sControlPlaneCount = () => {
    let count = 0;
    // Count bootstrap control plane (bootstrapControlPlane represents the main/bootstrap control plane)
    if (bootstrapControlPlane) {
      count += 1;
    }
    // Count additional control planes
    count += additionalControlPlanes.length;
    return count;
  };

  // Get control plane validation error message for K3S (odd numbers only)
  const getK3sControlPlaneValidationError = () => {
    const count = getK3sControlPlaneCount();
    if (count > 0 && count % 2 === 0) {
      return `You have created ${count} control plane${count === 1 ? '' : 's'}. It should be an odd number of control planes (1, 3, 5, …)`;
    }
    return undefined;
  };

  // Validate odd control planes for K3S
  const validateOddControlPlanes = () => {
    const count = getK3sControlPlaneCount();
    return count === 0 || count % 2 === 1;
  };

  // Comprehensive validation function to check if creation should be allowed
  const isCreateClusterDisabled = () => {
    // Check if submitting, loading, or navigating
    if (isSubmitting || k3sSetupStatus.isLoading || isNavigatingToCluster) return true;

    // Check for provisioning errors
    if (provisioningErrors.length > 0) return true;

    // Check required fields
    if (!clusterConfig.clusterName.trim()) return true;
    if (!clusterConfig.username.trim()) return true;
    if (!clusterConfig.password.trim()) return true;
    if (!clusterConfig.selectedImage.trim()) return true;
    if (!bootstrapControlPlane) return true;

    // Check for field errors
    if (fieldErrors['clusterName']) return true;
    if (fieldErrors['username']) return true;
    if (fieldErrors['password']) return true;
    if (fieldErrors['selectedImage']) return true;

    // Check control plane validation (odd number requirement)
    const controlPlaneError = getK3sControlPlaneValidationError();
    if (controlPlaneError) return true;

    return false;
  };

  // Helper function to check for additional control plane modal validation errors
  const hasAdditionalControlPlaneErrors = () => {
    // Only check for CPU, memory, disk, and network switch field errors
    const hasErrors = !!(
      fieldErrors['additionalCpu'] ||
      fieldErrors['additionalMemory'] ||
      fieldErrors['additionalDisk'] ||
      fieldErrors['additionalSwitch']
    );

    // Check basic validation requirements (fields filled and meet minimum values)
    const hasBasicErrors = !!(
      !currentAdditionalControlPlane.selectedNetworkSwitch ||
      currentAdditionalControlPlane.cpuCores < 4 ||
      currentAdditionalControlPlane.memoryGB < 4 ||
      currentAdditionalControlPlane.diskSizeGB < 30
    );

    return hasErrors || hasBasicErrors;
  };

  // Helper function to check for bootstrap control plane modal validation errors
  const hasBootstrapControlPlaneErrors = () => {
    // Only check for CPU, memory, disk, and network switch field errors
    const hasErrors = !!(
      fieldErrors['bootstrapCpu'] ||
      fieldErrors['bootstrapMemory'] ||
      fieldErrors['bootstrapDisk'] ||
      fieldErrors['bootstrapSwitch']
    );

    // Check basic validation requirements (fields filled and meet minimum values)
    const hasBasicErrors = !!(
      !currentBootstrapConfig.selectedNetworkSwitch ||
      currentBootstrapConfig.cpuCores < 4 ||
      currentBootstrapConfig.memoryGB < 4 ||
      currentBootstrapConfig.diskSizeGB < 30
    );

    return hasErrors || hasBasicErrors;
  };

  // Helper function to check for worker modal validation errors
  const hasWorkerErrors = () => {
    // Only check for empty fields - no min/max or resource validation
    const hasEmptyFields = !!(
      !currentWorker.selectedNetworkSwitch ||
      !currentWorker.cpuCores ||
      !currentWorker.memoryGB ||
      !currentWorker.diskSizeGB
    );

    return hasEmptyFields;
  };

  // Get all servers from dataCenters
  const allServers = dataCenters.flatMap((dc) => dc.servers || []);

  // Helper function to get server address (FQDN with IP fallback)
  const getServerAddress = (serverIp: string): string => {
    const server = allServers.find((s) => s.ip === serverIp || s.fqdn === serverIp);
    return server ? server.fqdn || server.ip : serverIp;
  };

  // Helper function to generate next worker name for K3S
  const getNextK3sWorkerName = (clusterName: string) => {
    if (!clusterName) {
      return 'k3s-cluster-worker1';
    }

    const existingWorkers = workers;
    const maxNumber = existingWorkers
      .map((w) => {
        // Extract number from worker names with various formats
        const match = w.name.match(/worker(\d+)$/) || w.name.match(/-worker(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .reduce((max, num) => Math.max(max, num), 0);
    return `k3s-${clusterName}-worker${maxNumber + 1}`;
  };

  // Helper function to generate next additional control plane name for K3S
  const getNextK3sControlPlaneName = (clusterName: string) => {
    if (!clusterName) {
      return 'k3s-cluster-controlplane2';
    }

    // Start from 2 since bootstrap is controlplane1 (implied)
    const existingNumbers = additionalControlPlanes
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

    return `k3s-${clusterName}-controlplane${nextNumber}`;
  };

  // Helper function to generate K3S bootstrap control plane name
  const getK3sBootstrapControlPlaneName = (clusterName: string) => {
    if (!clusterName) {
      return 'k3s-cluster-controlplane';
    }

    // Add k3s prefix to the cluster name for consistency
    return `k3s-${clusterName}-controlplane`;
  };

  // Fetch server-specific data (nodeinfo, pools, switches)
  const fetchServerData = async (serverIp: string) => {
    if (serverData[serverIp]) return; // Already fetched

    try {
      // Get server address (FQDN with IP fallback)
      const serverAddress = getServerAddress(serverIp);

      // Fetch nodeinfo, datastores, and switches in parallel using the new VM datastores endpoint
      const [nodeInfoResponse, poolsResponse, switchesResponse] = await Promise.all([
        fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/nodeinfo`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
          }
        ),
        fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
          }
        ),
        fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
          }
        ),
      ]);

      const [nodeInfo, pools, switchesData] = await Promise.all([
        nodeInfoResponse.json(),
        poolsResponse.json(),
        switchesResponse.json(),
      ]);

      // Process switches data the same way as Ubuntu
      const switches = Array.isArray(switchesData) ? switchesData.map((sw: any) => sw.name) : [];

      // Handle both array format and new object format with datastores property
      const datastoresArray = Array.isArray(pools) ? pools : pools.datastores || [];

      setServerData((prev) => ({
        ...prev,
        [serverIp]: {
          nodeInfo,
          pools: datastoresArray || [],
          networkSwitches: switches,
        },
      }));
    } catch (error) {
      const serverAddress = getServerAddress(serverIp);
      logger.error('Error fetching server data', { serverIp, serverAddress, error });
      toast.error(`Failed to fetch server data for ${serverAddress}`);
    }
  };

  // Handle server selection change
  const handleServerChange = (serverIp: string, configSetter: Function) => {
    configSetter((prev: any) => ({ ...prev, selectedServerIp: serverIp }));
    if (serverIp) {
      fetchServerData(serverIp);
    }
  };

  const saveBootstrapControlPlane = () => {
    // Validation
    // Storage pool validation removed - not required
    if (!currentBootstrapConfig.selectedNetworkSwitch) {
      setFieldErrors((prev) => ({ ...prev, bootstrapSwitch: 'Please select a network switch' }));
      return false; // Return false to indicate failure
    }

    // Resource validation with enhanced pattern
    const resourceError = validateResourceRequirements(
      currentBootstrapConfig.selectedServerIp,
      currentBootstrapConfig.cpuCores,
      currentBootstrapConfig.memoryGB,
      currentBootstrapConfig.diskSizeGB,
      'bootstrap',
      editingBootstrap ? 'bootstrap' : undefined
    );

    if (resourceError) {
      setFieldErrors((prev) => ({ ...prev, bootstrapResources: resourceError }));
      return false;
    }

    // Auto-generate name using the cluster name
    const autoGeneratedName = getK3sBootstrapControlPlaneName(clusterConfig.clusterName);
    const bootstrapWithName = {
      ...currentBootstrapConfig,
      name: autoGeneratedName,
    };

    setBootstrapControlPlane(bootstrapWithName);
    setIsBootstrapModalOpen(false);
    setShowBootstrapForm(false); // Close the form on success
    setEditingBootstrap(false); // Exit editing mode
    setFieldErrors({});
    return true; // Return true to indicate success
  };

  // Additional Control Plane handlers
  const handleAddAdditionalControlPlane = () => {
    const id = `cp-${Date.now()}`;

    // Set control node IP from envConfig
    const controlNodeIp = envConfig().CONTROL_NODE_IP.URL;
    setCurrentAdditionalControlPlane({
      id,
      name: '', // Will be auto-generated in save function
      selectedServerIp: controlNodeIp,
      selectedPool: '',
      selectedNetworkSwitch: '',
      cpuCores: 4,
      memoryGB: 4,
      diskSizeGB: 30,
    });
    // Fetch server data for control node
    if (controlNodeIp) {
      fetchServerData(controlNodeIp);
    }
    setIsAdditionalControlPlaneModalOpen(true);
  };

  const saveAdditionalControlPlane = () => {
    // Validation
    // Storage pool validation removed - not required
    if (!currentAdditionalControlPlane.selectedNetworkSwitch) {
      setFieldErrors((prev) => ({ ...prev, additionalSwitch: 'Please select a network switch' }));
      return false;
    }

    // Resource validation with enhanced pattern
    const resourceError = validateResourceRequirements(
      currentAdditionalControlPlane.selectedServerIp,
      currentAdditionalControlPlane.cpuCores,
      currentAdditionalControlPlane.memoryGB,
      currentAdditionalControlPlane.diskSizeGB,
      'control-plane',
      editingAdditionalIndex !== null ? currentAdditionalControlPlane.id : undefined
    );

    if (resourceError) {
      setFieldErrors((prev) => ({ ...prev, additionalResources: resourceError }));
      return false;
    }

    if (editingAdditionalIndex !== null) {
      // Edit existing control plane - preserve the original name
      const updatedControlPlanes = [...additionalControlPlanes];
      updatedControlPlanes[editingAdditionalIndex] = {
        ...currentAdditionalControlPlane,
        // Preserve the original name when editing
        name: currentAdditionalControlPlane.name,
        id: currentAdditionalControlPlane.id || Date.now().toString(),
      };
      setAdditionalControlPlanes(updatedControlPlanes);
      setEditingAdditionalIndex(null);
    } else {
      // Add new control plane
      const autoGeneratedName = getNextK3sControlPlaneName(clusterConfig.clusterName);
      const controlPlaneWithName = {
        ...currentAdditionalControlPlane,
        name: autoGeneratedName,
        id: Date.now().toString(),
      };
      setAdditionalControlPlanes((prev) => [...prev, controlPlaneWithName]);
    }

    // Close form and reset state
    setIsAdditionalControlPlaneModalOpen(false);
    setShowAdditionalControlPlaneForm(false);
    setFieldErrors({});

    // Reset current control plane
    setCurrentAdditionalControlPlane({
      id: '',
      name: '',
      selectedServerIp: '',
      selectedPool: '',
      selectedNetworkSwitch: '',
      cpuCores: 4,
      memoryGB: 4,
      diskSizeGB: 30,
    });

    return true;
  };

  // Worker handlers
  const handleAddWorker = () => {
    const name = getNextK3sWorkerName(clusterConfig.clusterName);
    const id = `worker-${Date.now()}`;

    // Set control node IP from envConfig
    const controlNodeIp = envConfig().CONTROL_NODE_IP.URL;
    setCurrentWorker({
      id,
      name,
      selectedServerIp: controlNodeIp,
      selectedPool: '',
      selectedNetworkSwitch: '',
      cpuCores: 2,
      memoryGB: 2,
      diskSizeGB: 20,
    });
    // Fetch server data for control node
    if (controlNodeIp) {
      fetchServerData(controlNodeIp);
    }
    setIsWorkerModalOpen(true);
  };

  const saveWorker = () => {
    // No validation - only check for empty fields in hasWorkerErrors()

    if (editingWorkerIndex !== null) {
      // Edit existing worker - preserve the original name
      const updatedWorkers = [...workers];
      updatedWorkers[editingWorkerIndex] = {
        ...currentWorker,
        // Preserve the original name when editing
        name: currentWorker.name,
        id: currentWorker.id || Date.now().toString(),
      };
      setWorkers(updatedWorkers);
      setEditingWorkerIndex(null);
    } else {
      // Add new worker
      const autoGeneratedName = getNextK3sWorkerName(clusterConfig.clusterName);
      const workerWithName = {
        ...currentWorker,
        name: autoGeneratedName,
        id: Date.now().toString(),
      };
      setWorkers((prev) => [...prev, workerWithName]);
    }

    // Close form and reset state (same as Control Plane)
    setIsWorkerModalOpen(false);
    setShowWorkerForm(false);
    setFieldErrors({});

    // Reset current worker
    setCurrentWorker({
      id: '',
      name: '',
      selectedServerIp: '',
      selectedPool: '',
      selectedNetworkSwitch: '',
      cpuCores: 2,
      memoryGB: 2,
      diskSizeGB: 20,
    });

    return true;
  };
  // Create cluster
  const createCluster = async () => {
    // Clear previous provisioning errors
    setProvisioningErrors([]);
    setIsNavigatingToCluster(true);

    // Validation
    if (!clusterConfig.clusterName.trim()) {
      return;
    }
    if (!clusterConfig.username.trim()) {
      return;
    }
    if (!clusterConfig.password.trim()) {
      return;
    }

    // Validate username (no admin/root)
    const usernameError = validateK3sUsername(clusterConfig.username);
    if (usernameError) {
      return;
    }

    // Validate password (min 6 chars)
    const passwordError = validateK3sPassword(clusterConfig.password);
    if (passwordError) {
      return;
    }

    // Validate selected image
    const imageError = validateSelectedImage(clusterConfig.selectedImage);
    if (imageError) {
      return;
    }

    if (!bootstrapControlPlane) {
      return;
    }

    // Validate odd number of control planes
    if (!validateOddControlPlanes()) {
      const controlPlaneError = getK3sControlPlaneValidationError();
      if (controlPlaneError) {
        return;
      }
    }

    setIsSubmitting(true);

    // Set loading status for K3s setup
    setK3sSetupStatus({
      isLoading: true,
      success: false,
      response: null,
      error: null,
      progress: 0,
      progressMessage: '',
    });

    // Prepare cluster name with k3s- prefix
    const fullClusterName = `k3s-${clusterConfig.clusterName}`;

    // Dispatch optimistic update event IMMEDIATELY to add cluster to sidebar
    window.dispatchEvent(
      new CustomEvent('clusterCreated', {
        detail: {
          clusterName: fullClusterName,
          optimistic: true,
          status: 'provisioning',
        },
      })
    );

    try {
      const baseUrl = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}`;

      // Prepare base payload with common fields
      const basePayload = {
        os_type: 'ubuntu-server',
        image_name: clusterConfig.selectedImage,
        username: clusterConfig.username,
        password: clusterConfig.password,
        kubernetes_cluster_name: fullClusterName,
        kubernetes_type: 'k3s-kubernetes',
      };

      // 1. Bootstrap Control Plane (with kubernetes_control_plane: true)
      let bootstrapPayload = null;
      if (bootstrapControlPlane) {
        bootstrapPayload = {
          ...basePayload,
          datastore: 'default',
          vm_name: getK3sBootstrapControlPlaneName(clusterConfig.clusterName),
          cpu: bootstrapControlPlane.cpuCores,
          memory: `${bootstrapControlPlane.memoryGB}G`,
          disk_size: `${bootstrapControlPlane.diskSizeGB}G`,
          nw_switch: bootstrapControlPlane.selectedNetworkSwitch,
          kubernetes_control_plane: true,
          node_ip: getServerAddress(bootstrapControlPlane.selectedServerIp),
          domain: clusterConfig.dnsZone,
        };

        // Add K3S specific options for bootstrap node
        if (bootstrapControlPlane.prometheusEnabled) {
          (bootstrapPayload as any).k3s_prometheus_and_grafana = true;
        }
        if (bootstrapControlPlane.argocdEnabled) {
          (bootstrapPayload as any).k3s_argocd = true;
        }
      }

      // 2. Additional Control Planes array (with kubernetes_control_plane: true)
      const controlPlanePayloads = additionalControlPlanes.map((controlPlane) => ({
        ...basePayload,
        datastore: 'default',
        vm_name: controlPlane.name,
        cpu: controlPlane.cpuCores,
        memory: `${controlPlane.memoryGB}G`,
        disk_size: `${controlPlane.diskSizeGB}G`,
        nw_switch: controlPlane.selectedNetworkSwitch,
        kubernetes_control_plane: true,
        node_ip: getServerAddress(controlPlane.selectedServerIp),
        domain: clusterConfig.dnsZone,
      }));

      // 3. Worker Nodes array (with kubernetes_worker: true)
      const workerPayloads = workers.map((worker) => ({
        ...basePayload,
        datastore: 'default',
        vm_name: worker.name,
        cpu: worker.cpuCores,
        memory: `${worker.memoryGB}G`,
        disk_size: `${worker.diskSizeGB}G`,
        nw_switch: worker.selectedNetworkSwitch,
        kubernetes_worker: true,
        node_ip: getServerAddress(worker.selectedServerIp),
        domain: clusterConfig.dnsZone,
      }));

      // Create combined payload structure (same as Ubuntu cluster creation)
      const combinedPayload = {
        bootstrap: bootstrapPayload,
        control_plane: controlPlanePayloads,
        worker: workerPayloads,
      };

      logger.info('Starting K3S cluster creation with unified endpoint', {
        clusterName: fullClusterName,
        hasBootstrap: !!bootstrapPayload,
        controlPlaneCount: controlPlanePayloads.length,
        workerCount: workerPayloads.length,
      });

      // Make single API call with combined payload
      try {
        const response = await fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/provision`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
            body: JSON.stringify(combinedPayload),
          }
        );

        if (!response.ok) {
          const errorData = await response.text();
          let parsedError;
          try {
            parsedError = JSON.parse(errorData);
          } catch {
            parsedError = { error: 'Failed to create K3S cluster', message: errorData };
          }
          throw new Error(
            parsedError.message || parsedError.error || 'Failed to create K3S cluster'
          );
        }

        const responseData = await response.json();
        logger.info('K3S cluster creation initiated successfully', {
          clusterName: fullClusterName,
          jobId: responseData.job_id,
        });

        // If response contains job_id, save it and open JobStatusModal immediately
        if (responseData && responseData.job_id) {
          const storageKey = `cluster-job-${fullClusterName}`;
          const jobData = {
            jobId: responseData.job_id,
            jobType: 'k3s-cluster-creation',
            clusterName: fullClusterName,
            timestamp: Date.now(),
          };
          localStorage.setItem(storageKey, JSON.stringify(jobData));

          // Dispatch event with job info for sidebar to update with real data
          window.dispatchEvent(
            new CustomEvent('clusterCreated', {
              detail: {
                clusterName: fullClusterName,
                jobId: responseData.job_id,
                status: 'provisioning',
              },
            })
          );

          // Clear loading state
          setK3sSetupStatus({
            isLoading: false,
            success: true,
            response: {
              message: 'K3s cluster creation initiated successfully',
              jobId: responseData.job_id,
              clusterName: fullClusterName,
            },
            error: null,
            progress: 100,
            progressMessage: '',
          });

          // Set navigation flag to disable create button during redirect

          // Wait 5 seconds before navigating to cluster details page
          setTimeout(() => {
            navigate(`/cluster/${fullClusterName}/details`, { replace: true });

            // Then open JobStatusModal with job info after navigation
            setTimeout(() => {
              setCurrentJobId(responseData.job_id);
              setCurrentJobType('k3s-cluster-creation');
              setIsJobModalOpen(true);
              // Reset navigation flag after modal opens
              setIsNavigatingToCluster(false);
            }, 100);
          }, 5000);
        } else {
          // Fallback: no job_id, show success and navigate after delay
          setK3sSetupStatus({
            isLoading: false,
            success: true,
            response: {
              message: 'K3s cluster created successfully',
              clusterName: fullClusterName,
            },
            error: null,
            progress: 100,
            progressMessage: '',
          });

          setTimeout(() => {
            navigate(`/cluster/${fullClusterName}/details`, { replace: true });
          }, 2000);
        }
      } catch (error: any) {
        logger.error('Error creating K3S cluster', error);

        // Set error status
        setK3sSetupStatus({
          isLoading: false,
          success: false,
          response: null,
          error: error.message || 'Failed to create K3s cluster',
          progress: 0,
          progressMessage: '',
        });

        setProvisioningErrors([
          {
            name: fullClusterName,
            error: error.message || 'Failed to create K3s cluster',
            message: 'Please check the configuration and try again',
          },
        ]);

        // Dispatch event to remove optimistic cluster on error
        window.dispatchEvent(
          new CustomEvent('clusterCreationFailed', {
            detail: {
              clusterName: fullClusterName,
              error: error.message,
            },
          })
        );

        // Reset navigation flag on error
        setIsNavigatingToCluster(false);
      }
    } catch (error: any) {
      logger.error('Error creating K3S cluster', error);

      // Set error status
      setK3sSetupStatus({
        isLoading: false,
        success: false,
        response: null,
        error: error.message || 'Failed to create K3s cluster',
        progress: 0,
        progressMessage: '',
      });

      // Reset navigation flag on error
      setIsNavigatingToCluster(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative">
      {/* K3s Setup Loading Overlay */}
      {k3sSetupStatus.isLoading && (
        <div className="fixed inset-0 z-50 backdrop-blur-sm bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <svg
                  className="animate-spin h-12 w-12 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Setting Up K3s Cluster</h3>
              <p className="text-sm text-gray-600 mb-4">
                Please wait while we configure your K3s cluster. This process may take a few
                minutes.
              </p>

              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                <strong>Important:</strong> Please do not close or refresh this page until the setup
                is complete.
              </div>
            </div>
          </div>
        </div>
      )}

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
        title="K3S Cluster Creation Progress"
        onJobComplete={(jobId) => {
          logger.info(`K3S cluster creation job ${jobId} completed`);
        }}
        onJobSuccess={(jobId) => {
          // On successful completion, ensure sidebar refreshes THEN navigate
          const clusterName =
            k3sSetupStatus.response?.clusterName || `k3s-${clusterConfig.clusterName}`;
          logger.info(`K3S cluster ${clusterName} creation completed successfully`);

          // First, dispatch refresh events while still on K3sSetup page
          // This ensures sidebar refreshes before navigation
          window.dispatchEvent(
            new CustomEvent('clusterCreated', {
              detail: {
                clusterName: clusterName,
                // Don't include optimistic flag - this is a real cluster now
              },
            })
          );
          window.dispatchEvent(new CustomEvent('vmDataRefreshNeeded'));

          // Dispatch event to expand the newly created cluster in sidebar
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('expandClusterInSidebar', {
                detail: { clusterName },
              })
            );
          }, 500);

          window.dispatchEvent(
            new CustomEvent('clusterDataRefreshNeeded', {
              detail: { clusterName },
            })
          );

          // Wait a bit for sidebar to process the event before navigating
          setTimeout(() => {
            // Navigate to cluster details page
            navigate(`/cluster/${clusterName}/details`, { replace: true });

            // After navigation, dispatch cluster detail page refresh
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent('clusterDataRefreshNeeded', {
                  detail: { clusterName },
                })
              );
            }, 300);
          }, 500);

          // Clean up localStorage
          const storageKey = `cluster-job-${clusterName}`;
          localStorage.removeItem(storageKey);
        }}
      />

      <div
        className={`transition-opacity duration-300 ${k3sSetupStatus.isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="space-y-8">
          {/* Cluster Basic Configuration */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">K3S Cluster Configuration</h2>

            {/* Cluster Name - Full Width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cluster Name <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center">
                <div className="bg-gray-100 border border-gray-300 border-r-0 rounded-l-md px-3 py-2 text-gray-600 font-medium">
                  k3s-
                </div>
                <input
                  type="text"
                  value={
                    clusterConfig.clusterName.startsWith('k3s-')
                      ? clusterConfig.clusterName.substring(4)
                      : clusterConfig.clusterName
                  }
                  onChange={async (e) => {
                    const value = e.target.value;
                    setClusterConfig((prev) => ({ ...prev, clusterName: value }));

                    // Validate cluster name for duplicates using new validation pattern
                    if (value.trim()) {
                      handleClusterNameValidation(value);
                    } else {
                      setFieldErrors((prev) => ({ ...prev, clusterName: undefined }));
                    }
                  }}
                  placeholder="clustername"
                  className={`flex-1 px-3 py-2 border rounded-r-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent ${
                    fieldErrors['clusterName'] ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {fieldErrors['clusterName'] && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors['clusterName']}</p>
              )}
            </div>

            {/* Username and Password - Half Width Each */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username <span className="text-red-500">*</span>{' '}
                  <span className="text-xs text-gray-500">
                    (For K3S, the username cannot be admin or root)
                  </span>
                </label>
                <input
                  type="text"
                  value={clusterConfig.username}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setClusterConfig((prev) => ({ ...prev, username: newValue }));

                    // Validate username and update field errors
                    const error = validateK3sUsername(newValue);
                    setFieldErrors((prev) => ({ ...prev, username: error }));
                  }}
                  placeholder="Enter username"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent ${
                    fieldErrors['username'] ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors['username'] && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors['username']}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showK3sPassword ? 'text' : 'password'}
                    value={clusterConfig.password}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setClusterConfig((prev) => ({ ...prev, password: newValue }));

                      // Validate password and update field errors
                      const error = validateK3sPassword(newValue);
                      setFieldErrors((prev) => ({ ...prev, password: error }));
                    }}
                    placeholder="Enter password (min 6 characters)"
                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent ${
                      fieldErrors['password'] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowK3sPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    aria-label={showK3sPassword ? 'Hide password' : 'Show password'}
                  >
                    {showK3sPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {fieldErrors['password'] && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors['password']}</p>
                )}
              </div>
            </div>

            {/* Attach IMG Dropdown - Full Width */}
            <div ref={imageDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attach IMG <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (availableImages.length === 0) {
                      fetchCloudImages();
                    }
                    setImageDropdownOpen(!imageDropdownOpen);
                  }}
                  className={`w-full px-3 py-2 text-left border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent flex items-center justify-between ${
                    fieldErrors['selectedImage'] ? 'border-red-500' : 'border-gray-300'
                  } bg-white`}
                  disabled={imagesLoading}
                >
                  <span className={clusterConfig.selectedImage ? 'text-gray-900' : 'text-gray-500'}>
                    {imagesLoading
                      ? 'Loading images...'
                      : clusterConfig.selectedImage
                        ? clusterConfig.selectedImage
                        : 'Select IMG'}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${imageDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {imageDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {availableImages.length === 0 ? (
                      <div className="px-3 py-2 text-gray-500 text-sm">
                        No images are available. Please upload cloud images first.
                      </div>
                    ) : (
                      availableImages.map((image) => (
                        <button
                          key={image}
                          type="button"
                          onClick={() => {
                            setClusterConfig((prev) => ({ ...prev, selectedImage: image }));
                            setImageDropdownOpen(false);
                            // Clear any validation errors
                            setFieldErrors((prev) => ({ ...prev, selectedImage: undefined }));
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm text-gray-900 border-b border-gray-100 last:border-b-0"
                        >
                          {image}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {fieldErrors['selectedImage'] && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors['selectedImage']}</p>
              )}
            </div>
          </div>
          <DnsZoneDropdown
            value={clusterConfig.dnsZone}
            onChange={(value) => setClusterConfig((prev) => ({ ...prev, dnsZone: value }))}
            required={true}
          />
          {/* Bootstrap Control Plane Configuration */}
          <BootstrapNodeConfig
            bootstrapControlPlane={bootstrapControlPlane}
            setBootstrapControlPlane={setBootstrapControlPlane}
            showBootstrapForm={showBootstrapForm}
            setShowBootstrapForm={setShowBootstrapForm}
            editingBootstrap={editingBootstrap}
            setEditingBootstrap={setEditingBootstrap}
            currentBootstrapConfig={currentBootstrapConfig}
            setCurrentBootstrapConfig={setCurrentBootstrapConfig}
            clusterConfig={clusterConfig}
            serverData={serverData}
            fetchServerData={fetchServerData}
            fieldErrors={fieldErrors}
            setFieldErrors={setFieldErrors}
            hasBootstrapControlPlaneErrors={hasBootstrapControlPlaneErrors}
            saveBootstrapControlPlane={saveBootstrapControlPlane}
            validateBatchNodeCreation={validateBatchNodeCreation}
            calculateAllocatedResources={calculateAllocatedResources}
          />

          {/* Control Plane Configuration */}
          <div className="border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Control Plane Configuration</h3>
              {!showAdditionalControlPlaneForm && (
                <button
                  onClick={() => {
                    // Set control node IP from envConfig and fetch server data
                    const controlNodeIp = envConfig().CONTROL_NODE_IP.URL;
                    setCurrentAdditionalControlPlane((prev) => ({
                      ...prev,
                      selectedServerIp: controlNodeIp,
                    }));
                    if (controlNodeIp) {
                      fetchServerData(controlNodeIp);
                    }
                    setShowAdditionalControlPlaneForm(true);
                    // Clear field errors when adding new control plane
                    setFieldErrors({});
                  }}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-karios-blue bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-karios-blue"
                >
                  <span className="mr-1">+</span>
                  Add Control Plane
                </button>
              )}
            </div>

            <p className="text-sm text-gray-500">
              Additional control planes are optional for cluster creation
            </p>

            {/* Display count summary for additional control planes */}
            {additionalControlPlanes.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-md p-3 space-y-2">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{additionalControlPlanes.length}</span> additional
                  control plane{additionalControlPlanes.length !== 1 ? 's' : ''} configured
                </div>
              </div>
            )}

            {additionalControlPlanes.length === 0 && (
              <div className="text-sm text-gray-500 italic">
                No additional control planes configured yet
              </div>
            )}

            {/* Inline Additional Control Plane Form */}
            {showAdditionalControlPlaneForm && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-lg font-semibold text-gray-900">
                  {editingAdditionalIndex !== null ? 'Edit Control Plane' : 'Add Control Plane'}
                </h4>

                {/* Reusable Control Plane Form */}
                <K3sControlPlaneForm
                  config={{
                    selectedServerIp: currentAdditionalControlPlane.selectedServerIp,
                    selectedNetworkSwitch: currentAdditionalControlPlane.selectedNetworkSwitch,
                    cpuCores: currentAdditionalControlPlane.cpuCores,
                    memoryGB: currentAdditionalControlPlane.memoryGB,
                    diskSizeGB: currentAdditionalControlPlane.diskSizeGB,
                  }}
                  editingName={
                    editingAdditionalIndex !== null ? currentAdditionalControlPlane.name : undefined
                  }
                  onConfigChange={(updates) =>
                    setCurrentAdditionalControlPlane((prev) => ({ ...prev, ...updates }))
                  }
                  serverIp={currentAdditionalControlPlane.selectedServerIp}
                  serverData={
                    currentAdditionalControlPlane.selectedServerIp
                      ? serverData[currentAdditionalControlPlane.selectedServerIp]
                      : undefined
                  }
                  fieldErrors={{
                    server: fieldErrors['additionalServer'],
                    switch: fieldErrors['additionalSwitch'],
                    cpu: fieldErrors['additionalCpu'],
                    memory: fieldErrors['additionalMemory'],
                    disk: fieldErrors['additionalDisk'],
                  }}
                  onFieldErrorChange={(field, error) => {
                    const fieldMap: { [key: string]: string } = {
                      server: 'additionalServer',
                      switch: 'additionalSwitch',
                      cpu: 'additionalCpu',
                      memory: 'additionalMemory',
                      disk: 'additionalDisk',
                    };
                    setFieldErrors((prev) => ({ ...prev, [fieldMap[field]]: error }));
                  }}
                  fetchServerData={fetchServerData}
                  validateBatchNodeCreation={validateBatchNodeCreation}
                  nodeType="control-plane"
                  isEditing={editingAdditionalIndex !== null}
                  excludeNodeId={
                    editingAdditionalIndex !== null ? currentAdditionalControlPlane.id : undefined
                  }
                  showAdditionalServices={false}
                  showServerSelection={true}
                  calculateAllocatedResources={calculateAllocatedResources}
                />

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowAdditionalControlPlaneForm(false);
                      setEditingAdditionalIndex(null); // Reset editing state
                      // Reset form
                      setCurrentAdditionalControlPlane({
                        id: '',
                        name: '',
                        selectedServerIp: '',
                        selectedPool: '',
                        selectedNetworkSwitch: '',
                        cpuCores: 4,
                        memoryGB: 4,
                        diskSizeGB: 30,
                      });
                    }}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Prevent action if there are validation errors
                      if (hasAdditionalControlPlaneErrors()) return;

                      // Only close the form if save is successful
                      saveAdditionalControlPlane();
                      // Form state is now handled inside the save function
                    }}
                    disabled={hasAdditionalControlPlaneErrors()}
                    className={`px-4 py-2 text-white rounded-md ${
                      hasAdditionalControlPlaneErrors()
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {editingAdditionalIndex !== null ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* Display Configured Additional Control Planes */}
            {additionalControlPlanes.length > 0 && (
              <div className="space-y-3">
                {additionalControlPlanes
                  .filter((controlPlane) => {
                    // Hide the control plane being edited
                    if (editingAdditionalIndex !== null) {
                      return controlPlane.id !== currentAdditionalControlPlane.id;
                    }
                    return true;
                  })
                  .map((controlPlane) => (
                    <div
                      key={controlPlane.id}
                      className="bg-white border border-gray-100 rounded-md p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{controlPlane.name}</h4>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => {
                              // Edit this control plane
                              setCurrentAdditionalControlPlane(controlPlane);
                              setEditingAdditionalIndex(
                                additionalControlPlanes.findIndex((cp) => cp.id === controlPlane.id)
                              );
                              setShowAdditionalControlPlaneForm(true);
                              // Clear field errors when starting to edit
                              setFieldErrors({});
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              // Remove this control plane
                              const updatedControlPlanes = additionalControlPlanes.filter(
                                (cp) => cp.id !== controlPlane.id
                              );
                              setAdditionalControlPlanes(updatedControlPlanes);
                            }}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 grid grid-cols-2 gap-4">
                        <div>Server: {controlPlane.selectedServerIp}</div>
                        <div>CPU: {controlPlane.cpuCores} cores</div>
                        <div>Memory: {controlPlane.memoryGB} GB</div>
                        <div>Disk: {controlPlane.diskSizeGB} GB</div>
                        <div>Network: {controlPlane.selectedNetworkSwitch}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Show message when no additional control planes configured */}
            {/* {additionalControlPlanes.length === 0 && !showAdditionalControlPlaneForm && (
          <div className="text-sm text-gray-500 italic">
            No additional control planes configured yet.
          </div>
        )} */}
          </div>

          {/* Control Plane Validation Warning */}
          {(() => {
            const validationError = getK3sControlPlaneValidationError();
            if (validationError) {
              return (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-orange-600"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-orange-800">
                        Control Plane Configuration Warning
                      </h3>
                      <div className="mt-2 text-sm text-orange-700">
                        <p>{validationError}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Worker Configuration */}
          <div className="border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Worker Configuration</h3>
              {!showWorkerForm && (
                <button
                  onClick={() => {
                    setShowWorkerForm(true);
                    // Clear field errors when adding new worker
                    setFieldErrors({});
                  }}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-karios-blue bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-karios-blue"
                >
                  <span className="mr-1">+</span>
                  Add Worker
                </button>
              )}
            </div>

            <p className="text-sm text-gray-500">Workers are optional for cluster creation</p>

            {/* Display count summary for workers */}
            {workers.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-md p-3 space-y-2">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{workers.length}</span> worker node
                  {workers.length !== 1 ? 's' : ''} configured
                </div>
              </div>
            )}

            {/* Worker Form */}
            {showWorkerForm && (
              <K3sWorkerForm
                currentWorker={currentWorker}
                setCurrentWorker={setCurrentWorker}
                controlNodeIp={currentBootstrapConfig.selectedServerIp}
                serverData={serverData}
                calculateAllocatedResources={calculateAllocatedResources}
                editingWorkerIndex={editingWorkerIndex}
                hasWorkerErrors={hasWorkerErrors}
                fetchServerData={fetchServerData}
                fieldErrors={{
                  server: fieldErrors['workerServer'],
                  switch: fieldErrors['workerSwitch'],
                  cpu: fieldErrors['workerCpu'],
                  memory: fieldErrors['workerMemory'],
                  disk: fieldErrors['workerDisk'],
                }}
                onFieldErrorChange={(field, error) => {
                  const fieldMap: { [key: string]: string } = {
                    server: 'workerServer',
                    switch: 'workerSwitch',
                    cpu: 'workerCpu',
                    memory: 'workerMemory',
                    disk: 'workerDisk',
                  };
                  setFieldErrors((prev) => ({ ...prev, [fieldMap[field]]: error }));
                }}
                showServerSelection={true}
                onCancel={() => {
                  setShowWorkerForm(false);
                  setEditingWorkerIndex(null);
                  setFieldErrors({});
                  setCurrentWorker({
                    id: '',
                    name: '',
                    selectedServerIp: '',
                    selectedPool: '',
                    selectedNetworkSwitch: '',
                    cpuCores: 2,
                    memoryGB: 2,
                    diskSizeGB: 20,
                  });
                }}
                onSave={() => {
                  if (hasWorkerErrors()) return;

                  const saveSuccess = saveWorker();
                  if (saveSuccess) {
                    setShowWorkerForm(false);
                    setIsWorkerModalOpen(false);
                    setEditingWorkerIndex(null);
                    setFieldErrors({});
                    setCurrentWorker({
                      id: '',
                      name: '',
                      selectedServerIp: '',
                      selectedPool: '',
                      selectedNetworkSwitch: '',
                      cpuCores: 2,
                      memoryGB: 2,
                      diskSizeGB: 20,
                    });
                  }
                }}
              />
            )}

            {/* Display Configured Workers */}
            {workers.length > 0 && (
              <div className="space-y-3">
                {/* Display each worker as a separate row */}
                {workers
                  .filter((worker) => {
                    // Hide the worker being edited
                    if (editingWorkerIndex !== null) {
                      return worker.id !== currentWorker.id;
                    }
                    return true;
                  })
                  .map((worker) => (
                    <div
                      key={worker.id}
                      className="bg-white border border-gray-100 rounded-md p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{worker.name}</h4>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => {
                              // Set up editing for this worker
                              setCurrentWorker(worker);
                              setEditingWorkerIndex(workers.findIndex((w) => w.id === worker.id));
                              setShowWorkerForm(true);
                              // Clear field errors when starting to edit
                              setFieldErrors({});
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              // Remove this specific worker
                              const updatedWorkers = workers.filter((w) => w.id !== worker.id);
                              setWorkers(updatedWorkers);
                            }}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 grid grid-cols-2 gap-4">
                        <div>Server: {worker.selectedServerIp}</div>
                        <div>CPU: {worker.cpuCores} cores</div>
                        <div>Memory: {worker.memoryGB} GB</div>
                        <div>Disk: {worker.diskSizeGB} GB</div>
                        <div>Network: {worker.selectedNetworkSwitch}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Show message when no workers configured */}
            {workers.length === 0 && !showWorkerForm && (
              <div className="text-sm text-gray-500 italic">No workers configured yet.</div>
            )}
          </div>

          {/* Error Display */}
          {provisioningErrors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Provisioning Errors</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="space-y-1">
                      {provisioningErrors.map((errorObj, index) => (
                        <li key={index}>
                          • {errorObj.name}: {errorObj.error}
                          {errorObj.message && ` - ${errorObj.message}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => navigate('/')}
              disabled={k3sSetupStatus.isLoading || isNavigatingToCluster}
              className={`px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${
                k3sSetupStatus.isLoading || isNavigatingToCluster
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              Cancel
            </button>
            <button
              onClick={createCluster}
              disabled={isCreateClusterDisabled()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || k3sSetupStatus.isLoading || isNavigatingToCluster
                ? 'Creating...'
                : 'Create K3S Cluster'}
            </button>
          </div>

          {/* Bootstrap Control Plane Modal */}
          {isBootstrapModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">Configure Bootstrap Control Plane</h3>

                <div className="space-y-6">
                  {/* Server Selection Row */}
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <label className="text-sm font-medium text-gray-700">
                      Select Server <span className="text-red-500">*</span>
                    </label>
                    <div className="col-span-3">
                      <select
                        value={currentBootstrapConfig.selectedServerIp}
                        onChange={(e) =>
                          handleServerChange(e.target.value, setCurrentBootstrapConfig)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a server</option>
                        {allServers.map((server: any) => (
                          <option key={server.fqdn || server.ip} value={server.fqdn || server.ip}>
                            {server.name} ({server.fqdn || server.ip})
                          </option>
                        ))}
                      </select>
                      {fieldErrors['bootstrapServer'] && (
                        <p className="text-red-500 text-sm mt-1">
                          {fieldErrors['bootstrapServer']}
                        </p>
                      )}
                      {/* Available Resources */}
                      {currentBootstrapConfig.selectedServerIp &&
                        serverData[currentBootstrapConfig.selectedServerIp] && (
                          <div className="mt-2 text-sm text-gray-600">
                            <strong>Available Resources:</strong> cpus:{' '}
                            {serverData[currentBootstrapConfig.selectedServerIp].nodeInfo?.cpus ||
                              'N/A'}{' '}
                            | memory:{' '}
                            {serverData[currentBootstrapConfig.selectedServerIp].nodeInfo?.memory ||
                              'N/A'}{' '}
                            MB
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Storage Pool Row */}
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <label className="text-sm font-medium text-gray-700">
                      Storage Pool <span className="text-red-500">*</span>
                    </label>
                    <div className="col-span-3">
                      <select
                        value={currentBootstrapConfig.selectedPool}
                        onChange={(e) =>
                          setCurrentBootstrapConfig((prev) => ({
                            ...prev,
                            selectedPool: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!currentBootstrapConfig.selectedServerIp}
                      >
                        <option value="">Select pool</option>
                        {currentBootstrapConfig.selectedServerIp &&
                          serverData[currentBootstrapConfig.selectedServerIp]?.pools.map(
                            (pool: any) => (
                              <option key={pool.NAME || pool.name} value={pool.NAME || pool.name}>
                                {pool.NAME || pool.name} -{' '}
                                {pool.available || pool.FREE || pool.free} free
                              </option>
                            )
                          )}
                      </select>
                      {fieldErrors['bootstrapPool'] && (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors['bootstrapPool']}</p>
                      )}
                    </div>
                  </div>

                  {/* Network Switch Row */}
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <label className="text-sm font-medium text-gray-700">
                      Network Switch <span className="text-red-500">*</span>
                    </label>
                    <div className="col-span-3">
                      <select
                        value={currentBootstrapConfig.selectedNetworkSwitch}
                        onChange={(e) =>
                          setCurrentBootstrapConfig((prev) => ({
                            ...prev,
                            selectedNetworkSwitch: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!currentBootstrapConfig.selectedServerIp}
                      >
                        <option value="">Select switch</option>
                        {currentBootstrapConfig.selectedServerIp &&
                          serverData[currentBootstrapConfig.selectedServerIp]?.networkSwitches.map(
                            (switchName: string) => (
                              <option key={switchName} value={switchName}>
                                {switchName}
                              </option>
                            )
                          )}
                      </select>
                      {fieldErrors['bootstrapSwitch'] && (
                        <p className="text-red-500 text-sm mt-1">
                          {fieldErrors['bootstrapSwitch']}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Hardware Configuration Row */}
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <label className="text-sm font-medium text-gray-700">Hardware</label>
                    <div className="col-span-3 grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CPU Cores
                        </label>
                        <input
                          type="number"
                          min="2"
                          value={currentBootstrapConfig.cpuCores}
                          onChange={(e) =>
                            setCurrentBootstrapConfig((prev) => ({
                              ...prev,
                              cpuCores: parseInt(e.target.value),
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Min: 2 cores for Control Plane</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Memory (GB)
                        </label>
                        <input
                          type="number"
                          min="2"
                          value={currentBootstrapConfig.memoryGB}
                          onChange={(e) =>
                            setCurrentBootstrapConfig((prev) => ({
                              ...prev,
                              memoryGB: parseInt(e.target.value),
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Min: 2 GB for Control Plane</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Disk (GB)
                        </label>
                        <input
                          type="number"
                          min="30"
                          value={currentBootstrapConfig.diskSizeGB}
                          onChange={(e) =>
                            setCurrentBootstrapConfig((prev) => ({
                              ...prev,
                              diskSizeGB: parseInt(e.target.value),
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Min: 30 GB for Control Plane</p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Services Row */}
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <label className="text-sm font-medium text-gray-700">Additional Services</label>
                    <div className="col-span-3 space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={currentBootstrapConfig.prometheusEnabled}
                          onChange={(e) =>
                            setCurrentBootstrapConfig((prev) => ({
                              ...prev,
                              prometheusEnabled: e.target.checked,
                            }))
                          }
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">
                          Install Prometheus and Grafana
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={currentBootstrapConfig.argocdEnabled}
                          onChange={(e) =>
                            setCurrentBootstrapConfig((prev) => ({
                              ...prev,
                              argocdEnabled: e.target.checked,
                            }))
                          }
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Install ArgoCD</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setIsBootstrapModalOpen(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Prevent action if there are validation errors
                      if (hasBootstrapControlPlaneErrors()) return;

                      saveBootstrapControlPlane();
                    }}
                    disabled={hasBootstrapControlPlaneErrors()}
                    className={`px-4 py-2 text-white rounded-md ${
                      hasBootstrapControlPlaneErrors()
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default K3sSetup;
