import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { FaChevronDown, FaChevronLeft } from 'react-icons/fa';
import { logger } from '../../../shared-state/src/utils/logger';
import { DnsZoneDropdown } from '../TopNavBar_components/shared';
import { useDataCenter } from '@karios-monorepo/shared-state';
import envConfig from '../../../../runtime-config';

/**
 * AddVmToClusterForm Component
 *
 * A reusable form component for adding VMs to a cluster.
 * Includes validation, resource checking, and server data fetching.
 *
 * Features:
 * - Auto-prefixes VM names based on cluster type
 * - Validates resources (CPU, memory, disk) against server capacity
 * - Fetches pools, switches, and node info from selected server
 * - Provides real-time validation feedback
 * - Supports both worker and control-plane node types
 */

interface ServerData {
  nodeInfo: any;
  pools: any[];
  networkSwitches: any[];
}

interface AddVmToClusterFormProps {
  clusterName: string;
  clusterType?: 'k3s' | 'k8s' | 'ubuntu' | 'openshift' | 'other';
  availableServers: Array<{ name: string; ip: string; fqdn?: string }>;
  availableImages?: string[];
  existingVMs?: Array<{ vmName: string; vm_type?: string }>;
  onSubmit: (vmConfig: VmConfig) => Promise<void>;
  onCancel: () => void;
  onBack?: () => void;
  isSubmitting?: boolean;
}

export interface VmConfig {
  vm_type: string;
  image_name: string;
  username: string;
  password: string;
  datastore: string;
  vm_name: string;
  cpu: number;
  memory: string;
  disk_size: string;
  nw_switch: string;
  node_ip: string;
  domain?: string;
}

const AddVmToClusterForm: React.FC<AddVmToClusterFormProps> = ({
  clusterName,
  clusterType = 'other',
  availableServers,
  availableImages = [],
  existingVMs = [],
  onSubmit,
  onCancel,
  onBack,
  isSubmitting = false,
}) => {
  // Get inventory from data center state for server selection
  const { inventory, fetchInventory, loading } = useDataCenter();

  // Form state
  const [vmConfig, setVmConfig] = useState<VmConfig>({
    vm_type: 'worker',
    image_name: '',
    username: '',
    password: '',
    datastore: '',
    vm_name: '',
    cpu: 2,
    memory: '',
    disk_size: '',
    nw_switch: '',
    node_ip: '',
    domain: '',
  });

  // Server data state
  const [serverData, setServerData] = useState<{ [serverIp: string]: ServerData }>({});
  const [isLoadingServerData, setIsLoadingServerData] = useState(false);

  // Cloud images state
  const [cloudImages, setCloudImages] = useState<string[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  // Validation state
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [showPassword, setShowPassword] = useState(false);

  // Dropdown states
  const [poolDropdownOpen, setPoolDropdownOpen] = useState(false);
  const [switchDropdownOpen, setSwitchDropdownOpen] = useState(false);
  const [imageDropdownOpen, setImageDropdownOpen] = useState(false);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);

  // Refs for dropdown click-outside handling
  const poolDropdownRef = useRef<HTMLDivElement>(null);
  const switchDropdownRef = useRef<HTMLDivElement>(null);
  const imageDropdownRef = useRef<HTMLDivElement>(null);
  const serverDropdownRef = useRef<HTMLDivElement>(null);

  // Get VM name prefix based on cluster type
  const getVmNamePrefix = (): string => {
    if (!clusterName) return '';

    // If cluster type is explicitly provided, use it
    if (clusterType === 'k3s') return 'k3s-';
    if (clusterType === 'k8s') return 'k8s-';
    if (clusterType === 'ubuntu') return 'ub-';
    if (clusterType === 'openshift') return 'op-';

    // Otherwise, try to infer from cluster name
    if (clusterName.startsWith('ub-')) return 'ub-';
    if (clusterName.startsWith('k3s-')) return 'k3s-';
    if (clusterName.startsWith('k8s-')) return 'k8s-';
    if (clusterName.startsWith('op-')) return 'op-';

    return '';
  };

  // Generate the next available VM name based on existing VMs and VM type
  const generateNextVmName = (vmType: string): string => {
    const prefix = getVmNamePrefix();

    // Extract cluster identifier from cluster name (e.g., "kj" from "k3s-kj")
    let clusterIdentifier = '';
    if (clusterName.startsWith('k3s-')) {
      clusterIdentifier = clusterName.substring(4); // Remove "k3s-"
    } else if (clusterName.startsWith('k8s-')) {
      clusterIdentifier = clusterName.substring(4); // Remove "k8s-"
    } else if (clusterName.startsWith('ub-')) {
      clusterIdentifier = clusterName.substring(3); // Remove "ub-"
    } else if (clusterName.startsWith('op-')) {
      clusterIdentifier = clusterName.substring(3); // Remove "op-"
    }

    // Build the base pattern based on VM type
    const vmTypeSuffix = vmType === 'control-plane' ? 'controlplane' : 'worker';
    const basePattern = clusterIdentifier
      ? `${prefix}${clusterIdentifier}-${vmTypeSuffix}`
      : `${prefix}${vmTypeSuffix}`;

    // Find all existing VMs with the same pattern
    const matchingVMs = existingVMs.filter((vm) => {
      const vmName = vm.vmName || '';
      return vmName.startsWith(basePattern);
    });

    if (matchingVMs.length === 0) {
      // No existing VMs with this pattern, start with number 1
      return `${basePattern}1`;
    }

    // Extract numbers from existing VM names
    const numbers = matchingVMs
      .map((vm) => {
        const vmName = vm.vmName || '';
        // Extract the number at the end of the VM name
        const match = vmName.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num) => !isNaN(num));

    // Find the highest number and increment by 1
    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNumber = maxNumber + 1;

    return `${basePattern}${nextNumber}`;
  };

  // Handle VM name change with auto-prefixing
  const handleVmNameChange = (value: string) => {
    const prefix = getVmNamePrefix();

    // If there's a prefix and the user is typing
    if (prefix) {
      // Remove any existing prefix first
      let cleanName = value;
      if (value.startsWith(prefix)) {
        cleanName = value.substring(prefix.length);
      }

      // Set the name with prefix
      setVmConfig({ ...vmConfig, vm_name: `${prefix}${cleanName}` });
    } else {
      setVmConfig({ ...vmConfig, vm_name: value });
    }
  };

  // Initialize VM name when component mounts or cluster/vmType changes
  useEffect(() => {
    const generatedName = generateNextVmName(vmConfig.vm_type);
    setVmConfig((prev) => ({ ...prev, vm_name: generatedName }));
  }, [clusterName, clusterType, existingVMs]);

  // Load inventory for server selection
  useEffect(() => {
    if (!inventory || inventory.length === 0) {
      fetchInventory();
    }
  }, [inventory, fetchInventory]);

  // Fetch cloud images on component mount
  useEffect(() => {
    const fetchCloudImages = async () => {
      setIsLoadingImages(true);
      try {
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
          // The API returns an object with a "raws" array containing image names
          const images: string[] = data.raws || [];
          setCloudImages(images);
          logger.info('Fetched cloud images:', images);
        } else {
          logger.error('Failed to fetch cloud images:', response.statusText);
          toast.error('Failed to load cloud images');
        }
      } catch (error) {
        logger.error('Error fetching cloud images:', error);
        toast.error('Error loading cloud images');
      } finally {
        setIsLoadingImages(false);
      }
    };

    fetchCloudImages();
  }, []);

  // Fetch server-specific data (nodeinfo, datastores, switches)
  const fetchServerData = async (serverAddress: string) => {
    if (serverData[serverAddress]) return; // Already fetched

    setIsLoadingServerData(true);
    try {
      // Fetch nodeinfo, datastores, and switches in parallel
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

      // Process switches data - store full objects for display
      const switches = Array.isArray(switchesData) ? switchesData : [];

      // Handle both array format and new object format with datastores property
      const datastoresArray = Array.isArray(pools) ? pools : pools.datastores || [];

      setServerData((prev) => ({
        ...prev,
        [serverAddress]: {
          nodeInfo,
          pools: datastoresArray || [],
          networkSwitches: switches,
        },
      }));

      // Auto-select first pool and switch if available and not already selected
      if (pools && pools.length > 0 && !vmConfig.datastore) {
        // API returns NAME (uppercase), not name
        setVmConfig((prev) => ({ ...prev, datastore: pools[0].NAME || pools[0].name }));
      }
      if (switches && switches.length > 0 && !vmConfig.nw_switch) {
        setVmConfig((prev) => ({ ...prev, nw_switch: switches[0].name }));
      }
    } catch (error) {
      logger.error('Error fetching server data', { serverAddress, error });
      toast.error(`Failed to fetch server data for ${serverAddress}`);
    } finally {
      setIsLoadingServerData(false);
    }
  };

  // Handle server selection change
  const handleServerChange = (serverAddress: string) => {
    setVmConfig((prev) => ({ ...prev, node_ip: serverAddress }));
    if (serverAddress) {
      fetchServerData(serverAddress);
    }
  };

  // Calculate resource requirements and validate
  const validateResourceRequirements = (
    serverAddress: string,
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number,
    nodeType: 'worker' | 'control-plane'
  ): string | undefined => {
    if (!serverAddress) {
      return 'Please select a server first';
    }

    const serverInfo = serverData[serverAddress];
    if (!serverInfo?.nodeInfo) {
      return 'Loading server information...';
    }

    const nodeInfo = serverInfo.nodeInfo;
    const totalCpus = nodeInfo.cpus || 0;
    const totalMemoryMB = nodeInfo.memory || 0;
    const totalMemory = Math.floor(totalMemoryMB / 1024);
    const usedCpus = nodeInfo.cpus_in_use || 0;
    const usedMemoryMB = nodeInfo.memory_in_use || 0;
    const usedMemory = Math.floor(usedMemoryMB / 1024);

    // Calculate available resources
    const availableCpus = totalCpus - usedCpus;
    const availableMemory = totalMemory - usedMemory;

    // Get minimum requirements based on cluster type and node type
    let minCpu = 2;
    let minMemory = 2;
    let minDisk = 20;

    if (nodeType === 'control-plane') {
      if (clusterType === 'k3s' || clusterType === 'k8s') {
        minCpu = 4;
        minMemory = 4;
        minDisk = 30;
      }
    }

    // Check minimum requirements
    if (cpuCores < minCpu) {
      return `${nodeType} requires minimum ${minCpu} CPU's`;
    }

    if (memoryGB < minMemory) {
      return `${nodeType} requires minimum ${minMemory}GB memory`;
    }

    if (diskSizeGB < minDisk) {
      return `${nodeType} requires minimum ${minDisk}GB disk space`;
    }

    // Check if resources would exceed available capacity
    if (cpuCores > availableCpus) {
      return `Need ${cpuCores} CPU's, but only ${availableCpus} available (${totalCpus} total - ${usedCpus} used)`;
    }

    if (memoryGB > availableMemory) {
      return `Need ${memoryGB}GB memory, but only ${availableMemory}GB available (${totalMemory}GB total - ${usedMemory}GB used)`;
    }

    return undefined;
  };

  // Validate username
  const validateUsername = (username: string): string | undefined => {
    if (!username) return undefined;
    const lowerUsername = username.toLowerCase().trim();
    if (lowerUsername === 'admin' || lowerUsername === 'root') {
      return 'Username cannot be admin or root';
    }
    return undefined;
  };

  // Validate password
  const validatePassword = (password: string): string | undefined => {
    if (!password) return undefined;
    if (password.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return undefined;
  };

  // Real-time validation when values change
  useEffect(() => {
    const errors: { [key: string]: string } = {};

    // Validate username
    const usernameError = validateUsername(vmConfig.username);
    if (usernameError) errors['username'] = usernameError;

    // Validate password
    const passwordError = validatePassword(vmConfig.password);
    if (passwordError) errors['password'] = passwordError;

    // Validate resources if server is selected
    if (vmConfig.node_ip && vmConfig.cpu && vmConfig.memory) {
      const memoryGB = parseFloat(vmConfig.memory);
      const diskGB = parseFloat(vmConfig.disk_size);

      if (!isNaN(memoryGB) && !isNaN(diskGB)) {
        const resourceError = validateResourceRequirements(
          vmConfig.node_ip,
          vmConfig.cpu,
          memoryGB,
          diskGB,
          vmConfig.vm_type as 'worker' | 'control-plane'
        );

        if (resourceError) {
          errors['resources'] = resourceError;
        }
      }
    }

    setFieldErrors(errors);
  }, [vmConfig, serverData]);

  // Handle form submission
  const handleSubmit = async () => {
    // Final validation
    if (
      !vmConfig.vm_name ||
      !vmConfig.node_ip ||
      !vmConfig.image_name ||
      !vmConfig.username ||
      !vmConfig.password ||
      !vmConfig.datastore ||
      !vmConfig.memory ||
      !vmConfig.disk_size ||
      !vmConfig.nw_switch ||
      !vmConfig.domain
    ) {
      toast.error('All fields are required');
      return;
    }

    // Check for validation errors
    if (Object.keys(fieldErrors).length > 0) {
      toast.error('Please fix all validation errors');
      return;
    }

    // Prepare payload with 'G' appended to memory and disk_size
    const payload = {
      ...vmConfig,
      memory: vmConfig.memory.toString().endsWith('G') ? vmConfig.memory : `${vmConfig.memory}G`,
      disk_size: vmConfig.disk_size.toString().endsWith('G')
        ? vmConfig.disk_size
        : `${vmConfig.disk_size}G`,
    };

    // Call parent submit handler with formatted payload
    await onSubmit(payload);
  };

  // Check if form is valid
  const isFormValid = () => {
    return (
      vmConfig.vm_name &&
      vmConfig.node_ip &&
      vmConfig.image_name &&
      vmConfig.username &&
      vmConfig.password &&
      vmConfig.datastore &&
      vmConfig.memory &&
      vmConfig.disk_size &&
      vmConfig.nw_switch &&
      vmConfig.domain &&
      Object.keys(fieldErrors).length === 0
    );
  };

  // Get current server data
  const currentServerData = vmConfig.node_ip ? serverData[vmConfig.node_ip] : null;

  // Filter configured servers from inventory
  const configuredServers = Array.isArray(inventory)
    ? inventory.filter((server) => server.stage?.toLowerCase() === 'configured')
    : [];

  // Handle server selection
  const handleServerSelection = (serverAddress: string) => {
    setVmConfig((prev) => ({ ...prev, node_ip: serverAddress, datastore: '', nw_switch: '' }));
    setServerDropdownOpen(false);

    // Fetch server data for the selected server
    if (serverAddress) {
      fetchServerData(serverAddress);
    }

    // Clear server-related field errors
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors['server'];
      delete newErrors['switch'];
      delete newErrors['cpu'];
      delete newErrors['memory'];
      delete newErrors['disk'];
      return newErrors;
    });
  };

  // Display resource availability info
  const getResourceAvailabilityInfo = () => {
    if (!vmConfig.node_ip || !currentServerData?.nodeInfo) {
      return null;
    }

    const nodeInfo = currentServerData.nodeInfo;
    const totalCpus = nodeInfo.cpus || 0;
    const totalMemoryMB = nodeInfo.memory || 0;
    const totalMemory = Math.floor(totalMemoryMB / 1024);
    const usedCpus = nodeInfo.cpus_in_use || 0;
    const usedMemoryMB = nodeInfo.memory_in_use || 0;
    const usedMemory = Math.floor(usedMemoryMB / 1024);
    const availableCpus = totalCpus - usedCpus;
    const availableMemory = totalMemory - usedMemory;

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
        <div className="font-medium text-blue-900 mb-1">Server Resources</div>
        <div className="text-blue-700 space-y-1">
          <div>
            CPU: {availableCpus} / {totalCpus} available ({usedCpus} used)
          </div>
          <div>
            Memory: {availableMemory}GB / {totalMemory}GB available ({usedMemory}GB used)
          </div>
        </div>
      </div>
    );
  };

  // Click outside handlers for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (poolDropdownRef.current && !poolDropdownRef.current.contains(event.target as Node)) {
        setPoolDropdownOpen(false);
      }
      if (switchDropdownRef.current && !switchDropdownRef.current.contains(event.target as Node)) {
        setSwitchDropdownOpen(false);
      }
      if (imageDropdownRef.current && !imageDropdownRef.current.contains(event.target as Node)) {
        setImageDropdownOpen(false);
      }
      if (serverDropdownRef.current && !serverDropdownRef.current.contains(event.target as Node)) {
        setServerDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Add a new node to cluster <strong>`&quot;`{clusterName}`&quot;`</strong>
      </p>

      {/* VM Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          VM Type <span className="text-red-500">*</span>
        </label>
        <select
          value={vmConfig.vm_type}
          onChange={(e) => {
            const newVmType = e.target.value;
            const newVmName = generateNextVmName(newVmType);
            setVmConfig({ ...vmConfig, vm_type: newVmType, vm_name: newVmName });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSubmitting}
        >
          <option value="worker">Worker Node</option>
          <option value="control-plane">Control Plane Node</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Select the type of node to add to the cluster.
        </p>
      </div>

      {/* Server Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Server <span className="text-red-500">*</span>
        </label>
        <div ref={serverDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => !loading && setServerDropdownOpen(!serverDropdownOpen)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left bg-white flex justify-between items-center ${
              fieldErrors['server'] ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting || loading}
          >
            <span className={vmConfig.node_ip ? 'text-gray-900' : 'text-gray-400'}>
              {vmConfig.node_ip
                ? configuredServers.find((s) => (s.fqdn || s.nodeIP) === vmConfig.node_ip)
                    ?.os_hostname ||
                  configuredServers.find((s) => (s.fqdn || s.nodeIP) === vmConfig.node_ip)
                    ?.nodeHostname ||
                  vmConfig.node_ip
                : loading
                  ? 'Loading servers...'
                  : configuredServers.length === 0
                    ? 'No configured servers available'
                    : 'Select a server'}
            </span>
            <FaChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {serverDropdownOpen && configuredServers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
              {configuredServers.map((server) => (
                <div
                  key={server.fqdn || server.nodeIP}
                  onClick={() => handleServerSelection(server.fqdn || server.nodeIP)}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                >
                  <div className="font-medium">
                    {server.os_hostname || server.nodeHostname || server.fqdn || server.nodeIP}
                  </div>
                  <div className="text-xs text-gray-500">{server.fqdn || server.nodeIP}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {fieldErrors['server'] && (
          <p className="mt-1 text-xs text-red-500">{fieldErrors['server']}</p>
        )}
        {loading && <p className="mt-1 text-xs text-blue-500">Loading servers...</p>}
        {!loading && configuredServers.length === 0 && (
          <p className="mt-1 text-xs text-gray-500">
            No configured servers available. Please configure servers first.
          </p>
        )}
      </div>
      {/* Resource Availability Info */}
      {getResourceAvailabilityInfo()}

      {/* VM Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          VM Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={vmConfig.vm_name}
          readOnly
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-not-allowed"
          disabled={isSubmitting}
        />
        <p className="mt-1 text-xs text-gray-500">
          Auto-generated based on existing VMs and VM type.
        </p>
      </div>

      {/* Image Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image Name <span className="text-red-500">*</span>
        </label>
        <div ref={imageDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => !isLoadingImages && setImageDropdownOpen(!imageDropdownOpen)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left bg-white flex justify-between items-center"
            disabled={isSubmitting || isLoadingImages}
          >
            <span className={vmConfig.image_name ? 'text-gray-900' : 'text-gray-400'}>
              {vmConfig.image_name || 'Select Cloud Image'}
            </span>
            <FaChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {imageDropdownOpen && cloudImages.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
              {cloudImages.map((image) => (
                <div
                  key={image}
                  onClick={() => {
                    setVmConfig({ ...vmConfig, image_name: image });
                    setImageDropdownOpen(false);
                  }}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                >
                  {image}
                </div>
              ))}
            </div>
          )}
        </div>
        {isLoadingImages && <p className="mt-1 text-xs text-blue-500">Loading cloud images...</p>}
        {!isLoadingImages && cloudImages.length === 0 && (
          <p className="mt-1 text-xs text-gray-500">No cloud images available</p>
        )}
      </div>

      {/* DNS Zone Dropdown */}
      <DnsZoneDropdown
        value={vmConfig.domain || ''}
        onChange={(value) => setVmConfig({ ...vmConfig, domain: value })}
        label="DNS Zone"
        required={true}
      />

      {/* Username and Password */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={vmConfig.username}
            onChange={(e) => setVmConfig({ ...vmConfig, username: e.target.value })}
            placeholder="e.g., karios"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              fieldErrors['username'] ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {fieldErrors['username'] && (
            <p className="mt-1 text-xs text-red-500">{fieldErrors['username']}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={vmConfig.password}
              onChange={(e) => setVmConfig({ ...vmConfig, password: e.target.value })}
              placeholder="Enter password"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors['password'] ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {fieldErrors['password'] && (
            <p className="mt-1 text-xs text-red-500">{fieldErrors['password']}</p>
          )}
        </div>
      </div>

      {/* Datastore (Pool) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Datastore <span className="text-red-500">*</span>
        </label>
        {currentServerData?.pools && currentServerData.pools.length > 0 ? (
          <div ref={poolDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setPoolDropdownOpen(!poolDropdownOpen)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left bg-white"
              disabled={isSubmitting || !vmConfig.node_ip}
            >
              {vmConfig.datastore || 'Select Pool'}
            </button>
            {poolDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                {currentServerData.pools.map((pool: any) => {
                  const poolName = pool.NAME || pool.name;
                  return (
                    <div
                      key={poolName}
                      onClick={() => {
                        setVmConfig({ ...vmConfig, datastore: poolName });
                        setPoolDropdownOpen(false);
                      }}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                    >
                      <div className="font-medium">{poolName}</div>
                      {pool.SIZE && pool.FREE && (
                        <div className="text-xs text-gray-500">
                          {pool.FREE} free of {pool.SIZE} ({pool.CAP || '0%'} used)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <input
            type="text"
            value={vmConfig.datastore}
            onChange={(e) => setVmConfig({ ...vmConfig, datastore: e.target.value })}
            placeholder="e.g., /zroot/vm"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
        )}
        {!vmConfig.node_ip && <p className="mt-1 text-xs text-gray-500">Select a server first</p>}
      </div>

      {/* Hardware Configuration - Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CPU Cores <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={vmConfig.cpu}
            onChange={(e) => setVmConfig({ ...vmConfig, cpu: parseInt(e.target.value) || 1 })}
            placeholder="e.g., 4"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Memory (GB) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            value={vmConfig.memory}
            onChange={(e) => setVmConfig({ ...vmConfig, memory: e.target.value })}
            placeholder="e.g., 8"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Disk Size (GB) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            value={vmConfig.disk_size}
            onChange={(e) => setVmConfig({ ...vmConfig, disk_size: e.target.value })}
            placeholder="e.g., 50"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Network Switch */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Network Switch <span className="text-red-500">*</span>
        </label>
        {currentServerData?.networkSwitches && currentServerData.networkSwitches.length > 0 ? (
          <div ref={switchDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setSwitchDropdownOpen(!switchDropdownOpen)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left bg-white"
              disabled={isSubmitting || !vmConfig.node_ip}
            >
              {vmConfig.nw_switch || 'Select Switch'}
            </button>
            {switchDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                {currentServerData.networkSwitches.map((switchObj: any) => {
                  const switchName = switchObj.name || switchObj;
                  return (
                    <div
                      key={switchName}
                      onClick={() => {
                        setVmConfig({ ...vmConfig, nw_switch: switchName });
                        setSwitchDropdownOpen(false);
                      }}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                    >
                      <div className="font-medium">{switchName}</div>
                      {switchObj.interface && (
                        <div className="text-xs text-gray-500">
                          Interface: {switchObj.interface}
                          {switchObj.active && ` • Status: ${switchObj.active}`}
                          {switchObj.private && ` • Private: ${switchObj.private}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <input
            type="text"
            value={vmConfig.nw_switch}
            onChange={(e) => setVmConfig({ ...vmConfig, nw_switch: e.target.value })}
            placeholder="e.g., public"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
        )}
        {!vmConfig.node_ip && <p className="mt-1 text-xs text-gray-500">Select a server first</p>}
      </div>

      {/* Resource Validation Error */}
      {fieldErrors['resources'] && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{fieldErrors['resources']}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t">
        {/* Back button on the left */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors duration-200 flex items-center gap-2"
          >
            <FaChevronLeft className="w-4 h-4" />
            <span>Back to Selection</span>
          </button>
        )}

        {/* Cancel and Submit buttons on the right */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !isFormValid()}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
              isSubmitting || !isFormValid()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{isSubmitting ? 'Adding...' : 'Add VM'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddVmToClusterForm;
