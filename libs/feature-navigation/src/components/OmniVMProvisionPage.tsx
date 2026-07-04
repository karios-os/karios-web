import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, ActionTypes } from '@karios-monorepo/shared-state';
import envConfig from '../../../../runtime-config';
import { logger } from '../../../shared-state/src/utils/logger';

interface ControlPlaneConfig {
  id: string;
  name: string;
  selectedServerIp: string;
  selectedPool: string;
  selectedNetworkSwitch: string;
  cpuCores: number;
  memoryGB: number;
  diskSizeGB: number;
  count: number;
  isSaved: boolean; // Track if configuration is saved
}

interface InventoryNode {
  ip: string;
  vendor: string;
  version: string;
  status: string;
  username: string;
  password: string;
  os_ip: string;
  os_hostname: string;
  os_username: string;
  os_password: string;
  last_updated: string;
  is_control_node: boolean;
  is_pikvm_connected: boolean;
  uuid: string;
}

interface InventoryResponse {
  inventory: InventoryNode[];
  total: number;
}

interface OmniVMProvisionPageProps {}

const OmniVMProvisionPage: React.FC<OmniVMProvisionPageProps> = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();

  // Basic Configuration
  const [clusterName, setClusterName] = useState('');
  const [selectedISO, setSelectedISO] = useState('');

  // Available ISOs and Cloud Images
  const [availableISOs, setAvailableISOs] = useState<string[]>([]);
  const [availableCloudImages, setAvailableCloudImages] = useState<string[]>([]);

  // Control Plane Configuration (renamed from VM Configuration)
  const [controlPlanes, setControlPlanes] = useState<ControlPlaneConfig[]>([]);

  // Track original config when editing (Ubuntu-style pattern)
  const [editingOriginals, setEditingOriginals] = useState<{ [id: string]: ControlPlaneConfig }>(
    {}
  );

  // Available servers
  const [availableServers, setAvailableServers] = useState<any[]>([]);

  // Server-specific data cache (like Ubuntu)
  const [serverDataCache, setServerDataCache] = useState<{
    [serverIp: string]: {
      pools: any[];
      networkSwitches: any[];
      nodeInfo: any;
    };
  }>({});

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoadingISOs, setIsLoadingISOs] = useState(true);
  const [isLoadingCloudImages, setIsLoadingCloudImages] = useState(true);

  // Refs to prevent duplicate API calls
  const isosFetched = useRef(false);
  const cloudImagesFetched = useRef(false);
  const lastIsoFetchTime = useRef(0);
  const lastCloudImagesFetchTime = useRef(0);

  // Cluster name validation state
  const [clusterNameError, setClusterNameError] = useState('');
  const [validationTimeouts, setValidationTimeouts] = useState<{ [key: string]: number }>({});
  const [allClusters, setAllClusters] = useState<any[]>([]);

  // Inventory/Node management state
  const [inventoryNodes, setInventoryNodes] = useState<InventoryNode[]>([]);
  const [selectedNodeIps, setSelectedNodeIps] = useState<string[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  const [inventoryError, setInventoryError] = useState<string>('');
  const [showSelectedNodes, setShowSelectedNodes] = useState(false);

  // Resource validation state (similar to K8s setup)
  const [resourceValidationErrors, setResourceValidationErrors] = useState<{
    [key: string]: string;
  }>({});
  const [serverResourceUsage, setServerResourceUsage] = useState<{
    [serverIp: string]: {
      totalCpus: number;
      totalMemory: number;
      usedCpus: number;
      usedMemory: number;
      allocatedCpus: number;
      allocatedMemory: number;
    };
  }>({});

  // Inventory API function
  const fetchInventory = async () => {
    setIsLoadingInventory(true);
    setInventoryError('');
    try {
      const protocol = envConfig().PROTOCOL || 'https';
      const baseUrl = envConfig().CONTROL_NODE_IP?.URL || 'localhost';
      const url = `${protocol}://${baseUrl}/api/v1/controlnode/inventory?offset=0&limit=10`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch inventory: ${response.status}`);
      }

      const data: InventoryResponse = await response.json();

      // Filter nodes with status "REGISTERED"
      const registeredNodes = data.inventory.filter((node) => node.status === 'REGISTERED');

      setInventoryNodes(registeredNodes);
    } catch (error) {
      logger.error('Error fetching inventory:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setInventoryError(`Failed to fetch inventory: ${errorMessage}`);
    } finally {
      setIsLoadingInventory(false);
    }
  };

  // Resource validation functions (similar to K8s setup)
  const calculateAllocatedResources = (serverIp: string, excludeControlPlaneId?: string) => {
    let allocatedCpus = 0;
    let allocatedMemory = 0;

    // Calculate resources allocated by all control planes on this server
    controlPlanes.forEach((cp) => {
      if (cp.selectedServerIp === serverIp) {
        // Exclude the control plane being edited if specified
        if (excludeControlPlaneId && cp.id === excludeControlPlaneId) {
          return; // Skip this control plane
        }
        allocatedCpus += cp.cpuCores || 0;
        allocatedMemory += cp.memoryGB || 0;
      }
    });

    return { allocatedCpus, allocatedMemory };
  };

  const validateControlPlaneResources = (
    cpuCores: number,
    memoryGB: number,
    serverIp: string,
    controlPlaneId?: string,
    count: number = 1
  ) => {
    const errors: { [key: string]: string } = {};

    if (!serverIp) {
      errors['cpuCores'] = 'Please select a server first to validate CPU availability';
      errors['memory'] = 'Please select a server first to validate memory availability';
      return errors;
    }

    // Get server resource data from cache
    const serverData = serverDataCache[serverIp];
    if (!serverData?.nodeInfo) {
      errors['cpuCores'] = 'Unable to validate resources - server data not loaded';
      errors['memory'] = 'Unable to validate resources - server data not loaded';
      return errors;
    }

    const nodeInfo = serverData.nodeInfo;
    const totalCpus = nodeInfo.cpus || 0;
    const totalMemoryMB = nodeInfo.memory || 0;
    const totalMemoryGB = Math.floor(totalMemoryMB / 1024);
    const usedCpus = nodeInfo.cpus_in_use || 0;
    const usedMemoryMB = nodeInfo.memory_in_use || 0;
    const usedMemoryGB = Math.floor(usedMemoryMB / 1024);

    // Calculate allocated resources from other control planes (excluding current one if editing)
    const { allocatedCpus, allocatedMemory } = calculateAllocatedResources(
      serverIp,
      controlPlaneId
    );

    // Calculate truly available resources
    const availableCpus = totalCpus - usedCpus - allocatedCpus;
    const availableMemoryGB = totalMemoryGB - usedMemoryGB - allocatedMemory;

    // Minimum requirements for Omni VMs (similar to Ubuntu control plane)
    const minCpu = nodeInfo.min_cpu_control_plane || 4;
    const minMemory = nodeInfo.min_memory_control_plane || 8;

    // Check minimum requirements first
    if (cpuCores < minCpu) {
      errors['cpuCores'] = `Omni VM requires minimum ${minCpu} CPUs`;
    }
    if (memoryGB < minMemory) {
      errors['memory'] = `Omni VM requires minimum ${minMemory}GB memory`;
    }

    // Calculate total resource requirement with count
    const totalCpuRequired = cpuCores * count;
    const totalMemoryRequired = memoryGB * count;

    // Check resource availability (only if minimum requirements pass)
    if (!errors['cpuCores'] && totalCpuRequired > availableCpus) {
      if (count > 1) {
        errors['cpuCores'] =
          `Only ${availableCpus} CPUs available, but ${totalCpuRequired} CPUs needed (${cpuCores} × ${count} VMs). Available: ${totalCpus} total - ${usedCpus} used - ${allocatedCpus} allocated`;
      } else {
        errors['cpuCores'] =
          `Only ${availableCpus} CPUs available (${totalCpus} total - ${usedCpus} used - ${allocatedCpus} allocated)`;
      }
    }
    if (!errors['memory'] && totalMemoryRequired > availableMemoryGB) {
      if (count > 1) {
        errors['memory'] =
          `Only ${availableMemoryGB}GB memory available, but ${totalMemoryRequired}GB needed (${memoryGB}GB × ${count} VMs). Available: ${totalMemoryGB}GB total - ${usedMemoryGB}GB used - ${allocatedMemory}GB allocated`;
      } else {
        errors['memory'] =
          `Only ${availableMemoryGB}GB memory available (${totalMemoryGB}GB total - ${usedMemoryGB}GB used - ${allocatedMemory}GB allocated)`;
      }
    }

    return errors;
  };

  // Function to validate cluster name (similar to VM name validation pattern)
  const validateClusterName = (
    value: string,
    clusterType: 'ubuntu' | 'openshift' | 'omni'
  ): string => {
    // Basic validation - check if there's content after prefix
    const prefix = clusterType === 'ubuntu' ? 'ub-' : clusterType === 'openshift' ? 'op-' : 'om-';

    // Extract the base name (without prefix)
    const baseName = value.substring(prefix.length).trim();
    if (!baseName) {
      return `Please enter a cluster name`;
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
    async (value: string, clusterType: 'ubuntu' | 'openshift' | 'omni') => {
      // Clear existing timeout for this field
      if (validationTimeouts['clusterName']) {
        clearTimeout(validationTimeouts['clusterName']);
      }

      // Immediate basic validation (like VM name validation)
      const basicError = validateClusterName(value, clusterType);
      setClusterNameError(basicError);

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
            setClusterNameError(freshError);
          } else {
            logger.error('Failed to fetch cluster info:', response.statusText);
            // Don't show error to user for API failures during validation
          }
        } catch (error) {
          logger.error('Error fetching cluster info:', error);
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
        logger.error('Error fetching initial cluster data:', error);
      }
    };

    fetchInitialClusterData();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(validationTimeouts).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [validationTimeouts]);

  // Get all available servers from data centers
  const getAllServers = () => {
    return state.dataCenters && Array.isArray(state.dataCenters)
      ? state.dataCenters.flatMap((dc: any) =>
          Array.isArray(dc.servers) ? dc.servers.filter((server: any) => server && server.ip) : []
        )
      : [];
  };

  // Refresh VM data for servers (similar to Ubuntu pattern)
  const refreshVMDataForServers = async (serverIps: string[]) => {
    // This mimics Ubuntu's pattern of refreshing VM lists after creation
    const uniqueServerIps = [...new Set(serverIps)];
    for (const serverIp of uniqueServerIps) {
      const serverToRefresh = getAllServers().find((server) => server.ip === serverIp);
      if (serverToRefresh) {
        // Dispatch an event to notify that VMs need refresh (like Ubuntu does)
        window.dispatchEvent(
          new CustomEvent('vmDataRefreshNeeded', {
            detail: { serverIp, serverName: serverToRefresh.name },
          })
        );
      }
    }
  };

  // Fetch available servers
  useEffect(() => {
    const servers = getAllServers();
    setAvailableServers(servers);
  }, [state.dataCenters]);

  // Fetch Cloud Images safely with duplicate prevention and rate limiting
  const fetchISOs = async () => {
    const now = Date.now();
    if (isosFetched.current || now - lastIsoFetchTime.current < 3000) {
      return;
    }

    try {
      setIsLoadingISOs(true);
      isosFetched.current = true;
      lastIsoFetchTime.current = now;

      const servers = getAllServers();
      if (servers.length === 0) {
        logger.error('No servers available to fetch cloud images');
        isosFetched.current = false; // Reset on failure
        return;
      }

      const firstServer = servers[0];
      const response = await fetch(
        `${envConfig().PROTOCOL}://${firstServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/iso`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Handle response format: {"raws": ["freebsd-cloud.raw", "jammy-server-cloudimg-amd64.img"]}
        let images = [];
        if (data.isos && Array.isArray(data.isos)) {
          images = data.isos;
        } else if (Array.isArray(data)) {
          images = data;
        }

        setAvailableISOs(images);
      } else {
        logger.error(`Failed to fetch cloud images: ${response.status} ${response.statusText}`);
        setAvailableISOs([]);
        isosFetched.current = false; // Reset on failure
      }
    } catch (error) {
      logger.error('Failed to fetch cloud images:', error);
      setAvailableISOs([]);
      isosFetched.current = false; // Reset on error
    } finally {
      setIsLoadingISOs(false);
    }
  };

  // Fetch Cloud Images safely with duplicate prevention (only when needed)
  const fetchCloudImages = async () => {
    const now = Date.now();
    if (cloudImagesFetched.current || now - lastCloudImagesFetchTime.current < 3000) {
      return;
    }

    try {
      setIsLoadingCloudImages(true);
      cloudImagesFetched.current = true;
      lastCloudImagesFetchTime.current = now;

      const servers = getAllServers();
      if (servers.length === 0) {
        logger.error('No servers available to fetch cloud images');
        cloudImagesFetched.current = false; // Reset on failure
        return;
      }

      const firstServer = servers[0];
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
        // Handle response as array
        const images = Array.isArray(data) ? data : [];
        setAvailableCloudImages(images);
      } else {
        logger.error(`Failed to fetch cloud images: ${response.status} ${response.statusText}`);
        setAvailableCloudImages([]);
        cloudImagesFetched.current = false; // Reset on failure
      }
    } catch (error) {
      logger.error('Failed to fetch cloud images:', error);
      setAvailableCloudImages([]);
      cloudImagesFetched.current = false; // Reset on error
    } finally {
      setIsLoadingCloudImages(false);
    }
  };

  // Fetch server-specific data (pools, switches, node info)
  const fetchServerData = async (serverIp: string) => {
    if (serverDataCache[serverIp]) {
      return serverDataCache[serverIp]; // Return cached data
    }

    try {
      const token = localStorage.getItem('accessToken');
      const baseUrl = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1`;

      // Fetch all data in parallel
      const [poolsResponse, switchesResponse, nodeInfoResponse] = await Promise.all([
        fetch(`${baseUrl}/storage/zfs/pools`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${baseUrl}/network/switches`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${baseUrl}/compute/vms/nodeinfo`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const pools = poolsResponse.ok ? await poolsResponse.json() : [];
      const switches = switchesResponse.ok ? await switchesResponse.json() : [];
      const nodeInfo = nodeInfoResponse.ok ? await nodeInfoResponse.json() : null;

      // Handle different response formats
      const poolsArray = Array.isArray(pools) ? pools : [pools];
      const switchesArray = Array.isArray(switches) ? switches : [switches];

      const serverData = {
        pools: poolsArray,
        networkSwitches: switchesArray,
        nodeInfo: nodeInfo,
      };

      // Cache the data
      setServerDataCache((prev) => ({
        ...prev,
        [serverIp]: serverData,
      }));

      return serverData;
    } catch (error) {
      logger.error(`Failed to fetch server data for ${serverIp}:`, error);
      return {
        pools: [],
        networkSwitches: [],
        nodeInfo: null,
      };
    }
  };

  // Only fetch ISOs when component mounts (cloud images only when specifically needed)
  useEffect(() => {
    // Only fetch ISOs initially - cloud images are rarely needed in this flow
    fetchISOs();
  }, []);

  // Update VM names when cluster name changes (similar to Ubuntu)
  useEffect(() => {
    if (clusterName.trim()) {
      const updatedControlPlanes = controlPlanes.map((cp, index) => ({
        ...cp,
        name: `om-${clusterName.trim()}-${cp.name.split('-').slice(-2).join('-')}`, // Keep the original suffix pattern
      }));
      setControlPlanes(updatedControlPlanes);
    }
  }, [clusterName]);

  // Update server resource usage when serverDataCache or controlPlanes change
  useEffect(() => {
    const updateResourceUsage = () => {
      const newResourceUsage: typeof serverResourceUsage = {};

      Object.keys(serverDataCache).forEach((serverIp) => {
        const nodeInfo = serverDataCache[serverIp]?.nodeInfo;
        if (nodeInfo) {
          const { allocatedCpus, allocatedMemory } = calculateAllocatedResources(serverIp);
          newResourceUsage[serverIp] = {
            totalCpus: nodeInfo.cpus || 0,
            totalMemory: Math.floor((nodeInfo.memory || 0) / 1024),
            usedCpus: nodeInfo.cpus_in_use || 0,
            usedMemory: Math.floor((nodeInfo.memory_in_use || 0) / 1024),
            allocatedCpus,
            allocatedMemory,
          };
        }
      });

      setServerResourceUsage(newResourceUsage);
    };

    updateResourceUsage();
  }, [serverDataCache, controlPlanes]);

  // Validate resources for all control planes when they change
  useEffect(() => {
    const newErrors: { [key: string]: string } = {};

    controlPlanes.forEach((cp) => {
      if (cp.selectedServerIp && cp.cpuCores && cp.memoryGB) {
        const validationErrors = validateControlPlaneResources(
          cp.cpuCores,
          cp.memoryGB,
          cp.selectedServerIp,
          cp.id,
          cp.count || 1 // Include count in validation
        );

        if (validationErrors['cpuCores']) {
          newErrors[`${cp.id}_cpuCores`] = validationErrors['cpuCores'];
        }
        if (validationErrors['memory']) {
          newErrors[`${cp.id}_memory`] = validationErrors['memory'];
        }
      }
    });

    setResourceValidationErrors(newErrors);
  }, [controlPlanes, serverDataCache]);

  // Remove control plane
  const removeControlPlane = (id: string) => {
    setControlPlanes(controlPlanes.filter((cp) => cp.id !== id));
  };

  // Validate configuration
  // Helper function to get appropriate button text based on configuration
  const getCreateButtonText = () => {
    const totalVMs = controlPlanes.reduce((sum, cp) => sum + (cp.count || 1), 0);
    const hasVMs = totalVMs > 0;
    const hasNodes = selectedNodeIps.length > 0;

    if (hasVMs && hasNodes) {
      return `Create Omni Cluster (${totalVMs} VM${totalVMs !== 1 ? 's' : ''} + ${selectedNodeIps.length} Node${selectedNodeIps.length !== 1 ? 's' : ''})`;
    } else if (hasVMs) {
      return `Create Omni Cluster with ${totalVMs} VM${totalVMs !== 1 ? 's' : ''}`;
    } else if (hasNodes) {
      return `Create Omni Cluster with ${selectedNodeIps.length} Node${selectedNodeIps.length !== 1 ? 's' : ''}`;
    } else {
      return 'Create Omni Cluster';
    }
  };

  const isConfigValid = () => {
    // Basic validation - cluster name and ISO are required
    if (clusterNameError || !clusterName.trim() || clusterName.trim() === '') {
      return false;
    }

    if (!selectedISO.trim()) {
      return false;
    }

    // Ensure cluster name starts with 'om-' and has content after the prefix
    const fullClusterName = `om-${clusterName}`;
    if (!fullClusterName.startsWith('om-') || fullClusterName.trim() === 'om-') {
      return false;
    }

    // Scenario validation:
    // 1. Cluster-only: Just cluster name + ISO (no VMs, no nodes) - VALID
    // 2. VMs-only: Cluster + ISO + VMs configured - VALID
    // 3. BMS-only: Cluster + ISO + Nodes selected - VALID
    // 4. Both: Cluster + ISO + VMs + Nodes - VALID

    // If VMs are configured, they must be properly configured
    if (controlPlanes.length > 0) {
      const validVMs = controlPlanes.every(
        (cp) =>
          cp.isSaved &&
          cp.name.trim() &&
          cp.selectedServerIp &&
          cp.selectedPool &&
          cp.selectedNetworkSwitch &&
          cp.cpuCores > 0 &&
          cp.memoryGB > 0 &&
          cp.diskSizeGB > 0
      );
      if (!validVMs) {
        return false;
      }
    }

    // At least one of: VMs configured, nodes selected, or cluster-only is acceptable
    return true;
  };

  // Create Omni Cluster (supports multiple scenarios)
  const createOmniCluster = async () => {
    if (!isConfigValid()) {
      alert('Please fill in all required fields');
      return;
    }

    const hasVMs = controlPlanes.length > 0;
    const hasNodes = selectedNodeIps.length > 0;

    let scenarioMessage = 'Creating Omni cluster';
    if (hasVMs && hasNodes) {
      scenarioMessage = 'Creating Omni cluster with VMs and nodes';
    } else if (hasVMs) {
      scenarioMessage = 'Creating Omni cluster with VMs';
    } else if (hasNodes) {
      scenarioMessage = 'Creating Omni cluster with nodes';
    } else {
      scenarioMessage = 'Creating Omni cluster (cluster-only)';
    }

    setIsLoading(true);
    setStatusMessage(`${scenarioMessage}, please wait...`);

    try {
      const servers = getAllServers();
      if (servers.length === 0) {
        throw new Error('No servers available');
      }

      const firstServer = servers[0];
      const promises: Promise<any>[] = [];
      const clusterFullName = `om-${clusterName}`;

      // Scenario 1: Cluster-only creation (no VMs, no nodes)
      // Note: For cluster to appear in sidebar, backend needs to implement cluster metadata storage
      if (!hasVMs && !hasNodes) {
        // For now, create a promise that resolves successfully
        // Backend team needs to implement cluster metadata endpoint
        const clusterPromise = Promise.resolve({
          type: 'cluster-metadata',
          result: {
            success: true,
            cluster_name: clusterFullName,
            message: `Cluster ${clusterFullName} created successfully (cluster-only mode)`,
            note: 'Backend needs /api/v1/compute/clusters/metadata endpoint for cluster to appear in sidebar',
          },
        });

        promises.push(clusterPromise);
      }

      // Provision selected nodes concurrently (if any)
      if (selectedNodeIps.length > 0) {
        selectedNodeIps.forEach((nodeIp, index) => {
          const node = inventoryNodes.find((n) => n.ip === nodeIp);
          const hostname = `${clusterFullName}-node${index + 1}`;

          const nodeProvisionPayload = {
            bmc_IP: nodeIp,
            kubernetes_cluster_name: clusterFullName,
            kubernetes_cluster_type: 'omni-server',
            vendor: node?.vendor || 'Dell',
            pxe_server: envConfig().CONTROL_NODE_IP?.URL || '192.168.116.208',
            pxe_path: '/usr/local/www/ipxe',
            controlnode_host: envConfig().CONTROL_NODE_IP?.URL || '192.168.116.208',
            controlnode_port: '8080',
            vm_slot: 'VirtualMedia1',
            sys_iuri: '/redfish/v1/Systems/1',
            output_iso: selectedISO,
            hostname: hostname,
          };

          const nodePromise = fetch(
            `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP?.URL}/api/v1/controlnode/provisionnode`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
              },
              body: JSON.stringify(nodeProvisionPayload),
            }
          ).then(async (response) => {
            if (!response.ok) {
              throw new Error(
                `Failed to provision node ${nodeIp}: ${response.status} ${response.statusText}`
              );
            }
            const result = await response.json();

            // Store job info for tracking
            const jobInfo = {
              job_id: result.job_id,
              message: result.message,
              nodeIp,
              hostname,
              timestamp: new Date().toISOString(),
              status: 'running',
            };

            return { nodeIp, hostname, result, jobInfo };
          });

          promises.push(nodePromise);
        });
      }
      const combinedPayload = [];
      // Create VMs for each control plane (considering count)
      controlPlanes.forEach((controlPlane) => {
        // Create multiple VMs based on count
        for (let i = 0; i < controlPlane.count; i++) {
          const vmName =
            controlPlane.count > 1
              ? `${controlPlane.name.replace(/-\d+$/, '')}-${i + 1}`
              : controlPlane.name;

          const payload = {
            vm_name: vmName,
            os_types: 'other',
            loader: 'uefi',
            datastore: 'default',
            uefi_vars: 'yes',
            graphics: 'yes',
            xhci_mouse: 'yes',
            sockets: 1,
            cpu: controlPlane.cpuCores,
            memory: `${controlPlane.memoryGB}G`,
            network0_type: 'virtio-net',
            network0_switch: controlPlane.selectedNetworkSwitch,
            disk0_type: 'virtio-blk',
            disk0_name: 'disk0.img',
            disk0_size: `${controlPlane.diskSizeGB}G`,
            kubernetes_cluster_name: `om-${clusterName}`,
            base_domain: '',
            kubernetes_type: 'omni-kubernetes',
            kubernetes_worker_type: 'control-plane',
            disk1_name: selectedISO,
          };
          combinedPayload.push(payload);
        }
      });

      // Send batch API call for VM provisioning
      if (combinedPayload.length > 0) {
        logger.info('Sending batch VM provisioning request:', {
          count: combinedPayload.length,
          payload: combinedPayload,
        });

        const batchResponse = await fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/omni/server-setup/batch`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
            body: JSON.stringify(combinedPayload),
          }
        );

        if (!batchResponse.ok) {
          throw new Error(
            `Batch VM provisioning failed: ${batchResponse.status} ${batchResponse.statusText}`
          );
        }

        const batchResult = await batchResponse.json();
        logger.info('Batch VM provisioning response:', batchResult);

        // Store batch job information in localStorage
        if (batchResult.batch_job_id) {
          const storageKey = `cluster-job-${clusterFullName}`;
          const jobData = {
            jobId: batchResult.batch_job_id,
            jobType: 'omni-batch-vm-provisioning',
            clusterName: clusterFullName,
            timestamp: Date.now(),
            totalVMs: batchResult.total_vms,
            vmJobs: batchResult.vm_jobs,
          };
          localStorage.setItem(storageKey, JSON.stringify(jobData));
          logger.info('Batch job stored in localStorage:', jobData);
        }
      }

      const results = await Promise.all(promises);

      const totalVMs = controlPlanes.length;
      const totalNodes = selectedNodeIps.length;

      // Success message for different scenarios
      let successMsg = `Omni cluster '${clusterFullName}' created successfully!`;
      if (totalVMs > 0 && totalNodes > 0) {
        successMsg += ` ${totalVMs} VM(s) deployed and ${totalNodes} node(s) provisioning started.`;
      } else if (totalVMs > 0) {
        successMsg += ` ${totalVMs} VM(s) deployed.`;
      } else if (totalNodes > 0) {
        successMsg += ` ${totalNodes} node(s) provisioning started.`;
      } else {
        successMsg += ' Cluster is ready for VM or node deployment.';
      }
      successMsg += ' Redirecting to cluster details...';

      setStatusMessage(successMsg);

      // Dispatch custom event to trigger sidebar cluster data refresh (same as Ubuntu/OpenShift)
      window.dispatchEvent(
        new CustomEvent('clusterCreated', {
          detail: { clusterName: clusterFullName },
        })
      );

      // Refresh VM data for affected servers (similar to Ubuntu pattern)
      const affectedServerIps = controlPlanes.map((cp) => cp.selectedServerIp);
      refreshVMDataForServers(affectedServerIps);

      // Navigate to cluster details page following the same pattern as Ubuntu and OpenShift
      setTimeout(() => {
        navigate(`/cluster/${clusterFullName}/details`, { replace: true });
      }, 2000); // Same delay as Ubuntu/OpenShift pattern
    } catch (error) {
      setStatusMessage(
        `Failed to create Omni VMs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setIsLoading(false);
    }
    // Note: setIsLoading(false) is handled in success case by navigation timeout
  };

  return (
    <div className="h-screen overflow-y-auto bg-gray-50 p-3 sm:p-4 md:p-6 pb-32">
      <div className="max-w-5xl mx-auto min-h-full">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-12">
          <div className="p-4 md:p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Create New Omni Cluster
                </h1>
                <p className="mt-2 text-xs md:text-sm text-gray-600">
                  Create a cluster with just metadata, VMs, physical nodes, or any combination2
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 space-y-8">
            {/* Basic Configuration */}
            <div className="space-y-6">
              {/* Cluster Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cluster Name <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-l-md">
                    om-
                  </span>
                  <input
                    type="text"
                    value={clusterName}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setClusterName(newValue);
                      // Trigger validation with the full cluster name (including prefix)
                      const fullClusterName = `om-${newValue}`;
                      handleClusterNameValidation(fullClusterName, 'omni');
                    }}
                    className={`flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 ${
                      clusterNameError
                        ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                        : 'focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    placeholder="cluster name"
                  />
                </div>
                {clusterNameError && (
                  <p className="mt-1 text-sm text-red-600">{clusterNameError}</p>
                )}
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

            {/* Control Plane Configuration */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Create Omni VM88</h2>
                  {/* <p className="text-sm text-gray-600 mt-1">Configure virtual machines for your cluster (optional)</p> */}
                </div>
                <button
                  onClick={() => {
                    const nextNumber = controlPlanes.length + 1;
                    const clusterPrefix = clusterName.trim() || 'cluster';
                    const newControlPlane: ControlPlaneConfig = {
                      id: `controlplane-${nextNumber}`,
                      name: `om-${clusterPrefix}-${nextNumber}`,
                      selectedServerIp: '',
                      selectedPool: '',
                      selectedNetworkSwitch: '',
                      cpuCores: 4,
                      memoryGB: 16,
                      diskSizeGB: 123,
                      count: 1,
                      isSaved: false,
                    };

                    // Note: No server validation here since server is selected after creation
                    // The validation will happen when user selects a server and configures resources
                    setControlPlanes([...controlPlanes, newControlPlane]);
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
                >
                  + Add VM
                </button>
              </div>

              <div className="space-y-4">
                {controlPlanes.map((controlPlane, index) => (
                  <div key={controlPlane.id}>
                    {controlPlane.isSaved ? (
                      // Saved VM Summary View (like Ubuntu/OpenShift)
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {/* Show all VM names based on count */}
                            <div className="mb-3">
                              {controlPlane.count === 1 ? (
                                <h3 className="text-sm font-medium text-gray-900">
                                  {controlPlane.name}
                                </h3>
                              ) : (
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900 mb-1">
                                    {controlPlane.name} (Base Configuration)
                                  </h3>
                                  <div className="text-xs text-gray-600 mb-1">
                                    VMs to be created:
                                  </div>
                                  <div className="text-xs text-gray-700 space-y-0.5">
                                    {Array.from({ length: controlPlane.count }, (_, i) => {
                                      // Replace the last number in the base name with the iteration number
                                      const baseName = controlPlane.name;
                                      const nameWithoutLastNumber = baseName.replace(/-\d+$/, '');
                                      return (
                                        <div key={i}>
                                          • {nameWithoutLastNumber}-{i + 1}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-gray-600">
                              <div>Server: {controlPlane.selectedServerIp}</div>
                              <div>Storage Pool: {controlPlane.selectedPool}</div>
                              <div>CPU: {controlPlane.cpuCores} CPU`&apos;`s</div>
                              <div>Memory: {controlPlane.memoryGB}GB</div>
                              <div>Disk: {controlPlane.diskSizeGB}GB</div>
                              <div>Network: {controlPlane.selectedNetworkSwitch}</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            {/* Count Controls */}
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-600">Count:</span>
                              <button
                                onClick={() => {
                                  const updatedControlPlanes = controlPlanes.map((cp) =>
                                    cp.id === controlPlane.id
                                      ? { ...cp, count: Math.max(1, cp.count - 1) }
                                      : cp
                                  );
                                  setControlPlanes(updatedControlPlanes);

                                  // Trigger validation for the updated control plane
                                  const updatedControlPlane = updatedControlPlanes.find(
                                    (cp) => cp.id === controlPlane.id
                                  );
                                  if (updatedControlPlane && updatedControlPlane.selectedServerIp) {
                                    const validationErrors = validateControlPlaneResources(
                                      updatedControlPlane.cpuCores,
                                      updatedControlPlane.memoryGB,
                                      updatedControlPlane.selectedServerIp,
                                      updatedControlPlane.id,
                                      updatedControlPlane.count
                                    );
                                    setResourceValidationErrors((prev) => ({
                                      ...prev,
                                      [`${updatedControlPlane.id}_cpuCores`]:
                                        validationErrors['cpuCores'] || '',
                                      [`${updatedControlPlane.id}_memory`]:
                                        validationErrors['memory'] || '',
                                    }));
                                  }
                                }}
                                className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-sm"
                                disabled={controlPlane.count <= 1}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={controlPlane.count}
                                onChange={(e) => {
                                  const newCount = parseInt(e.target.value) || 1;

                                  // Check if required fields are configured
                                  if (
                                    !controlPlane.selectedServerIp ||
                                    !controlPlane.cpuCores ||
                                    !controlPlane.memoryGB
                                  ) {
                                    alert(
                                      'Cannot change count: Please ensure server, CPU cores, and memory are configured for this VM first.'
                                    );
                                    setControlPlanes(controlPlanes); // Reset to original value
                                    return;
                                  }

                                  // SIMPLE VALIDATION: Check basic CPU availability
                                  const serverData =
                                    serverDataCache[controlPlane.selectedServerIp]?.nodeInfo;
                                  if (!serverData) {
                                    alert(
                                      'Cannot change count: Server data not available. Please refresh and try again.'
                                    );
                                    setControlPlanes(controlPlanes); // Reset to original value
                                    return;
                                  }

                                  const totalCpus = serverData.cpus || 0;
                                  const cpusInUse = serverData.cpus_in_use || 0;
                                  const availableCpus = totalCpus - cpusInUse;

                                  // Count existing VMs on this server (excluding current one)
                                  let existingVMsOnServer = 0;
                                  controlPlanes.forEach((cp) => {
                                    if (
                                      cp.selectedServerIp === controlPlane.selectedServerIp &&
                                      cp.id !== controlPlane.id
                                    ) {
                                      existingVMsOnServer += cp.count;
                                    }
                                  });

                                  // Calculate total CPUs needed for the NEW count
                                  const totalCpusNeeded = newCount * controlPlane.cpuCores;

                                  // Block if it would exceed available CPUs
                                  if (totalCpusNeeded > availableCpus) {
                                    alert(
                                      `Cannot set count to ${newCount}: Would need ${totalCpusNeeded} CPUs but only ${availableCpus} available (${totalCpus} total - ${cpusInUse} in use). Currently have ${existingVMsOnServer} other VMs on this server.`
                                    );
                                    setControlPlanes(controlPlanes); // Reset to original value
                                    return;
                                  }

                                  const updatedControlPlanes = controlPlanes.map((cp) =>
                                    cp.id === controlPlane.id ? { ...cp, count: newCount } : cp
                                  );
                                  setControlPlanes(updatedControlPlanes);

                                  // Trigger validation for the updated control plane
                                  const updatedControlPlane = updatedControlPlanes.find(
                                    (cp) => cp.id === controlPlane.id
                                  );
                                  if (updatedControlPlane && updatedControlPlane.selectedServerIp) {
                                    const validationErrors = validateControlPlaneResources(
                                      updatedControlPlane.cpuCores,
                                      updatedControlPlane.memoryGB,
                                      updatedControlPlane.selectedServerIp,
                                      updatedControlPlane.id,
                                      updatedControlPlane.count
                                    );
                                    setResourceValidationErrors((prev) => ({
                                      ...prev,
                                      [`${updatedControlPlane.id}_cpuCores`]:
                                        validationErrors['cpuCores'] || '',
                                      [`${updatedControlPlane.id}_memory`]:
                                        validationErrors['memory'] || '',
                                    }));
                                  }
                                }}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="1"
                              />
                              <button
                                onClick={() => {
                                  // Check if required fields are configured
                                  if (
                                    !controlPlane.selectedServerIp ||
                                    !controlPlane.cpuCores ||
                                    !controlPlane.memoryGB
                                  ) {
                                    alert(
                                      'Cannot add VM: Please ensure server, CPU cores, and memory are configured for this VM first.'
                                    );
                                    return;
                                  }

                                  // SIMPLE VALIDATION: Check basic CPU availability
                                  const serverData =
                                    serverDataCache[controlPlane.selectedServerIp]?.nodeInfo;
                                  if (!serverData) {
                                    alert(
                                      'Cannot add VM: Server data not available. Please refresh and try again.'
                                    );
                                    return;
                                  }

                                  const totalCpus = serverData.cpus || 0;
                                  const cpusInUse = serverData.cpus_in_use || 0;
                                  const availableCpus = totalCpus - cpusInUse;

                                  // Count existing VMs on this server
                                  let existingVMsOnServer = 0;
                                  controlPlanes.forEach((cp) => {
                                    if (cp.selectedServerIp === controlPlane.selectedServerIp) {
                                      existingVMsOnServer += cp.count;
                                    }
                                  });

                                  // Calculate total CPUs needed for the NEW count (current + 1)
                                  const newTotalCount = controlPlane.count + 1;
                                  const totalCpusNeeded = newTotalCount * controlPlane.cpuCores;

                                  // Block if it would exceed available CPUs
                                  if (totalCpusNeeded > availableCpus) {
                                    alert(
                                      `Cannot add VM: Would need ${totalCpusNeeded} CPUs but only ${availableCpus} available (${totalCpus} total - ${cpusInUse} in use). Currently have ${existingVMsOnServer} VMs on this server.`
                                    );
                                    return;
                                  }

                                  const updatedControlPlanes = controlPlanes.map((cp) =>
                                    cp.id === controlPlane.id ? { ...cp, count: cp.count + 1 } : cp
                                  );
                                  setControlPlanes(updatedControlPlanes);

                                  // Trigger validation for the updated control plane
                                  const updatedControlPlane = updatedControlPlanes.find(
                                    (cp) => cp.id === controlPlane.id
                                  );
                                  if (updatedControlPlane && updatedControlPlane.selectedServerIp) {
                                    const validationErrors = validateControlPlaneResources(
                                      updatedControlPlane.cpuCores,
                                      updatedControlPlane.memoryGB,
                                      updatedControlPlane.selectedServerIp,
                                      updatedControlPlane.id,
                                      updatedControlPlane.count
                                    );
                                    setResourceValidationErrors((prev) => ({
                                      ...prev,
                                      [`${updatedControlPlane.id}_cpuCores`]:
                                        validationErrors['cpuCores'] || '',
                                      [`${updatedControlPlane.id}_memory`]:
                                        validationErrors['memory'] || '',
                                    }));
                                  }
                                }}
                                className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-sm"
                              >
                                +
                              </button>
                            </div>

                            {/* Edit and Remove Buttons */}
                            <div className="flex space-x-2">
                              <button
                                onClick={async () => {
                                  // Store original config before editing (Ubuntu pattern)
                                  setEditingOriginals((prev) => ({
                                    ...prev,
                                    [controlPlane.id]: { ...controlPlane },
                                  }));

                                  // Fetch server data if needed
                                  if (controlPlane.selectedServerIp) {
                                    await fetchServerData(controlPlane.selectedServerIp);
                                  }

                                  // Switch to edit mode
                                  const updatedControlPlanes = controlPlanes.map((cp) =>
                                    cp.id === controlPlane.id ? { ...cp, isSaved: false } : cp
                                  );
                                  setControlPlanes(updatedControlPlanes);
                                }}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => removeControlPlane(controlPlane.id)}
                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Edit VM Configuration View
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium text-gray-900">
                            Edit VM Configuration
                          </h3>
                          <button
                            onClick={() => removeControlPlane(controlPlane.id)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>

                        {/* VM Name (Auto-generated, non-editable) */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            VM Name
                          </label>
                          <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                            {controlPlane.name}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Auto-generated based on cluster name
                          </p>
                        </div>

                        {/* Server Selection */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Server <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={controlPlane.selectedServerIp}
                            onChange={async (e) => {
                              const selectedServerIp = e.target.value;

                              const updatedControlPlanes = controlPlanes.map((cp) =>
                                cp.id === controlPlane.id
                                  ? {
                                      ...cp,
                                      selectedServerIp,
                                      selectedPool: '',
                                      selectedNetworkSwitch: '',
                                    }
                                  : cp
                              );
                              setControlPlanes(updatedControlPlanes);

                              if (selectedServerIp) {
                                await fetchServerData(selectedServerIp);
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select Server</option>
                            {availableServers.map((server) => (
                              <option key={server.ip} value={server.ip}>
                                {server.name} ({server.ip})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Storage Pool */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Storage Pool <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={controlPlane.selectedPool}
                            onChange={(e) => {
                              const updatedControlPlanes = controlPlanes.map((cp) =>
                                cp.id === controlPlane.id
                                  ? { ...cp, selectedPool: e.target.value }
                                  : cp
                              );
                              setControlPlanes(updatedControlPlanes);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={!controlPlane.selectedServerIp}
                          >
                            <option value="">
                              {!controlPlane.selectedServerIp
                                ? 'Select Server First'
                                : 'Select Storage Pool'}
                            </option>
                            {controlPlane.selectedServerIp &&
                              serverDataCache[controlPlane.selectedServerIp]?.pools?.map((pool) => (
                                <option key={pool.NAME || pool.name} value={pool.NAME || pool.name}>
                                  {pool.NAME || pool.name} (
                                  {pool.SIZE ? `${pool.SIZE} - ${pool.FREE} free` : 'Available'})
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Network Switch */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Network Switch <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={controlPlane.selectedNetworkSwitch}
                            onChange={(e) => {
                              const updatedControlPlanes = controlPlanes.map((cp) =>
                                cp.id === controlPlane.id
                                  ? { ...cp, selectedNetworkSwitch: e.target.value }
                                  : cp
                              );
                              setControlPlanes(updatedControlPlanes);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={!controlPlane.selectedServerIp}
                          >
                            <option value="">
                              {!controlPlane.selectedServerIp
                                ? 'Select Server First'
                                : 'Select Network Switch'}
                            </option>
                            {controlPlane.selectedServerIp &&
                              serverDataCache[controlPlane.selectedServerIp]?.networkSwitches?.map(
                                (networkSwitch) => (
                                  <option key={networkSwitch.name} value={networkSwitch.name}>
                                    {networkSwitch.name} ({networkSwitch.interface}) -{' '}
                                    {networkSwitch.active === 'yes' ? 'Active' : 'Inactive'}
                                  </option>
                                )
                              )}
                          </select>
                        </div>

                        {/* Resource Configuration */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              CPU Cores <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={controlPlane.cpuCores}
                              onChange={(e) => {
                                const updatedControlPlanes = controlPlanes.map((cp) =>
                                  cp.id === controlPlane.id
                                    ? { ...cp, cpuCores: parseInt(e.target.value) || 1 }
                                    : cp
                                );
                                setControlPlanes(updatedControlPlanes);
                              }}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                                resourceValidationErrors[`${controlPlane.id}_cpuCores`]
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-gray-300 focus:ring-blue-500'
                              }`}
                            />
                            {/* Validation error message */}
                            {resourceValidationErrors[`${controlPlane.id}_cpuCores`] ? (
                              <p className="text-xs text-red-500 mt-1">
                                {resourceValidationErrors[`${controlPlane.id}_cpuCores`]}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500 mt-1">Min: 4 cores for Omni</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Memory (GB) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={controlPlane.memoryGB}
                              onChange={(e) => {
                                const updatedControlPlanes = controlPlanes.map((cp) =>
                                  cp.id === controlPlane.id
                                    ? { ...cp, memoryGB: parseInt(e.target.value) || 1 }
                                    : cp
                                );
                                setControlPlanes(updatedControlPlanes);
                              }}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                                resourceValidationErrors[`${controlPlane.id}_memory`]
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-gray-300 focus:ring-blue-500'
                              }`}
                            />
                            {/* Validation error message */}
                            {resourceValidationErrors[`${controlPlane.id}_memory`] ? (
                              <p className="text-xs text-red-500 mt-1">
                                {resourceValidationErrors[`${controlPlane.id}_memory`]}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500 mt-1">Min: 8 GB for Omni</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Disk Size (GB) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={controlPlane.diskSizeGB}
                              onChange={(e) => {
                                const updatedControlPlanes = controlPlanes.map((cp) =>
                                  cp.id === controlPlane.id
                                    ? { ...cp, diskSizeGB: parseInt(e.target.value) || 1 }
                                    : cp
                                );
                                setControlPlanes(updatedControlPlanes);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        {/* Save and Cancel Buttons */}
                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => {
                              // Cancel operation - restore original or remove if new (Ubuntu pattern)
                              const originalConfig = editingOriginals[controlPlane.id];
                              if (originalConfig) {
                                // Restore original configuration
                                const updatedControlPlanes = controlPlanes.map((cp) =>
                                  cp.id === controlPlane.id
                                    ? { ...originalConfig, isSaved: true }
                                    : cp
                                );
                                setControlPlanes(updatedControlPlanes);

                                // Clear editing original
                                setEditingOriginals((prev) => {
                                  const newState = { ...prev };
                                  delete newState[controlPlane.id];
                                  return newState;
                                });
                              } else {
                                // Remove if it's a new unsaved VM
                                removeControlPlane(controlPlane.id);
                              }
                            }}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              // Validate configuration
                              if (
                                !controlPlane.selectedServerIp ||
                                !controlPlane.selectedPool ||
                                !controlPlane.selectedNetworkSwitch
                              ) {
                                alert('Please fill in all required fields');
                                return;
                              }

                              // Check for resource validation errors
                              const hasResourceErrors =
                                resourceValidationErrors[`${controlPlane.id}_cpuCores`] ||
                                resourceValidationErrors[`${controlPlane.id}_memory`];
                              if (hasResourceErrors) {
                                alert('Please fix resource validation errors before saving');
                                return;
                              }

                              // Save the configuration
                              const updatedControlPlanes = controlPlanes.map((cp) =>
                                cp.id === controlPlane.id ? { ...cp, isSaved: true } : cp
                              );
                              setControlPlanes(updatedControlPlanes);

                              // Clear editing original if exists
                              if (editingOriginals[controlPlane.id]) {
                                setEditingOriginals((prev) => {
                                  const newState = { ...prev };
                                  delete newState[controlPlane.id];
                                  return newState;
                                });
                              }
                            }}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {/* Show "Update" if editing existing config, "Save" if new (Ubuntu pattern) */}
                            {editingOriginals[controlPlane.id] ? 'Update' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {
              /* Bare Metal Servers */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Bare Metal</h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowNodeSelector(!showNodeSelector);
                      // When opening node selector, hide the selected nodes display until Done is clicked
                      if (!showNodeSelector) {
                        setShowSelectedNodes(false);
                      }
                      if (inventoryNodes.length === 0 && !isLoadingInventory && !showNodeSelector) {
                        fetchInventory();
                      }
                    }}
                    disabled={isLoadingInventory}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center"
                  >
                    {isLoadingInventory ? 'Loading...' : showNodeSelector ? 'Cancel' : '+ Add Node'}
                  </button>
                </div>

                {/* Inline Node Selector */}
                {showNodeSelector && (
                  <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      Select Nodes (Status: REGISTERED)
                    </h3>

                    {isLoadingInventory ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                        <span className="text-sm text-gray-600">Loading nodes...</span>
                      </div>
                    ) : inventoryError ? (
                      <div className="text-center py-8">
                        <div className="text-red-500 text-sm mb-2">⚠️ Error</div>
                        <p className="text-sm text-gray-600">{inventoryError}</p>
                        <button
                          onClick={() => fetchInventory()}
                          className="mt-3 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Retry
                        </button>
                      </div>
                    ) : inventoryNodes.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500">No registered nodes found</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {inventoryNodes.map((node) => (
                          <label
                            key={node.ip}
                            className="flex items-center space-x-3 p-3 hover:bg-gray-100 rounded cursor-pointer border border-gray-200 bg-white"
                          >
                            <input
                              type="checkbox"
                              checked={selectedNodeIps.includes(node.ip)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedNodeIps([...selectedNodeIps, node.ip]);
                                } else {
                                  setSelectedNodeIps(
                                    selectedNodeIps.filter((ip) => ip !== node.ip)
                                  );
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{node.ip}</div>
                              <div className="text-xs text-gray-500">
                                {node.vendor} | {node.version} | {node.status}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {inventoryNodes.length > 0 && (
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          {selectedNodeIps.length} node{selectedNodeIps.length !== 1 ? 's' : ''}{' '}
                          selected
                        </div>
                        <button
                          onClick={() => {
                            setShowNodeSelector(false);
                            setShowSelectedNodes(true);
                          }}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Nodes Display - Only show after clicking Done */}
                {showSelectedNodes && (
                  <div className="space-y-4">
                    {selectedNodeIps.length === 0 ? (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <p className="text-gray-500">No nodes added</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Click `&apos;`Add Node`&apos;` to select registered nodes
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedNodeIps.map((nodeIp) => {
                          const node = inventoryNodes.find((n) => n.ip === nodeIp);
                          return (
                            <div
                              key={nodeIp}
                              className="bg-white border border-gray-200 rounded-lg p-4"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h3 className="text-sm font-medium text-gray-900">{nodeIp}</h3>
                                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-gray-600 mt-2">
                                    <div>Vendor: {node?.vendor || 'Unknown'}</div>
                                    <div>Version: {node?.version || 'Unknown'}</div>
                                    <div>
                                      Status:{' '}
                                      <span className="text-green-600 font-medium">
                                        {node?.status || 'REGISTERED'}
                                      </span>
                                    </div>
                                    <div>Username: {node?.username || 'N/A'}</div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  <button
                                    onClick={() => {
                                      setSelectedNodeIps(
                                        selectedNodeIps.filter((ip) => ip !== nodeIp)
                                      );
                                    }}
                                    className="text-red-600 hover:text-red-800 text-sm px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            }

            {/* Status Message */}
            {statusMessage && (
              <div className="px-6 py-3 bg-blue-50 border-t border-gray-200">
                <div className="flex items-center">
                  {isLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  )}
                  <span className="text-sm text-blue-700">{statusMessage}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-4 md:px-6 py-6 md:py-8 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3">
            <button
              onClick={() => navigate('/k8s-provisioning')}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 order-2 sm:order-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>

            <button
              onClick={createOmniCluster}
              disabled={!isConfigValid() || isLoading}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isConfigValid() && !isLoading
                  ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Creating...' : getCreateButtonText()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OmniVMProvisionPage;
