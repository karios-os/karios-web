import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useAppState, useVm, ActionTypes } from '@karios-monorepo/shared-state';
import { useApprovalFlow } from '../../../shared-state/src/hooks/useApprovalFlow';
import ApprovalModal from '../../../shared-state/src/components/ApprovalModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createComponentLogger } from '../../../shared-state/src/utils/logger';
import api from '../../../shared-state/src/utils/interceptor';

// Import components for each step
import VmDetails from './VmSteps/VmDetails';
import VmHardware from './VmSteps/VmHardware';
import VmStorage from './VmSteps/VmStorage';
import VmNetwork from './VmSteps/VmNetwork';
import CloudInitBasic from './VmSteps/CloudInitBasic';
import CloudInitHardware from './VmSteps/CloudInitHardware';
import CloudInitStorageNetwork from './VmSteps/CloudInitStorageNetwork';
import CloudInitUser from './VmSteps/CloudInitUser';
import CloudInitNetwork from './VmSteps/CloudInitNetwork';
import SinglePageVMSetup from './VmSteps/SinglePageVMSetup';

// Import types
import { NodeLimits, StoragePool, Server, DataCenter, VM } from './VmSteps/vm-types';
import envConfig from '../../../../runtime-config';

// Additional types specific to this component
interface VMPayload {
  vm_name: string;
  os_types: string;
  loader: string;
  datastore: string;
  uefi_vars: string;
  graphics: string;
  xhci_mouse: string;
  sockets: number;
  cpu: number;
  memory: string;
  network0_type: string;
  network0_switch: string;
  disk0_type: string;
  disk0_name: string;
  disk0_size: string;
  domain?: string;
}

// Extended types for validation
interface ServerWithVMs extends Server {
  vms?: VM[];
}

interface DataCenterWithVMs extends DataCenter {
  servers: ServerWithVMs[];
}

export default function VMProvision(): React.JSX.Element {
  const logger = createComponentLogger('VmSetup');

  // Get state from consolidated context
  const { state, dispatch, fetchVMsForServer, fetchGlobalVmList } = useAppState();
  const { dataCenters, selectedServer } = state;
  const { setSelectedVm } = useVm();

  // Initialize approval flow hook
  const { requiresApproval, isModalOpen, modalProps, executeWithApproval } = useApprovalFlow();

  // All hooks must be declared before any early returns
  const navigate = useNavigate();
  const location = useLocation();

  // Use selectedServer.fqdn (or ip fallback) from global state if available, otherwise fallback to local state
  const [selectedServerIp, setSelectedServerIp] = useState<string | undefined>(
    selectedServer?.fqdn || selectedServer?.ip
  );

  // Provisioning type: 'standard' or 'cloud-init'
  const [provisioningType, setProvisioningType] = useState<'standard' | 'cloud-init'>('standard');

  // Single-page mode toggle
  const [useSinglePageMode, setUseSinglePageMode] = useState<boolean>(false);

  const [step, setStep] = useState<number>(0);

  // Check URL parameters to set initial provisioning type and step
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const typeParam = urlParams.get('type');
    const modeParam = urlParams.get('mode');

    // Use single-page mode for standard VM setup (type=standard or mode=single or no params)
    if (modeParam === 'single' || typeParam === 'standard' || !typeParam) {
      setUseSinglePageMode(true);
      setProvisioningType('standard');
      setStep(1);
    } else if (typeParam === 'cloudinit') {
      setUseSinglePageMode(false);
      setProvisioningType('cloud-init');
      setStep(1); // Skip selection step and go directly to first setup step
    }
  }, [location.search]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [vmName, setVmName] = useState<string>('');
  const [loader, setLoader] = useState<string>('uefi');
  const [uefiVars, setUefiVars] = useState<string>('yes');
  const [osType, setOsType] = useState<string>('');
  const [sockets, setSockets] = useState<number>(1);
  const [memory, setMemory] = useState<number>(1);

  const [networkDrivers, setNetworkDrivers] = useState<string[]>([]);
  const [networkSwitches, setNetworkSwitches] = useState<string[]>([]);
  const [network0Type, setNetwork0Type] = useState<string>('');
  const [network0Switch, setNetwork0Switch] = useState<string>('');
  const [dnsZones, setDnsZones] = useState<string[]>([]);
  const [selectedDnsZone, setSelectedDnsZone] = useState<string>('');

  const [disk0Type] = useState<string>('virtio-blk');
  const [disk0Size, setDisk0Size] = useState<number | undefined>(20);
  const [disk0SizeError, setDisk0SizeError] = useState<string>('');
  const [pools, setPools] = useState<StoragePool[]>([]);
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [datastore, setDatastore] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [permissionError] = useState<string>('');
  const [nameError, setNameError] = useState<string>('');
  const [value, setValue] = useState<number>(1);
  const [nodeLimits, setNodeLimits] = useState<NodeLimits>({
    cpus: 0,
    sockets: 0,
    memoryGB: 0,
  });

  // Cloud Init specific state
  const [cloudInitUsername, setCloudInitUsername] = useState<string>('');
  const [cloudInitPassword, setCloudInitPassword] = useState<string>('');
  const [cloudInitHashedPassword, setCloudInitHashedPassword] = useState<string>('');
  const [cloudInitSshKey, setCloudInitSshKey] = useState<string>('');
  const [cloudInitDomain, setCloudInitDomain] = useState<string>('');
  const [cloudInitIp, setCloudInitIp] = useState<string>('');
  const [cloudInitGateway, setCloudInitGateway] = useState<string>('');
  const [cloudInitNameservers, setCloudInitNameservers] = useState<string>('');

  // Cloud Init image selection
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [imagesLoading, setImagesLoading] = useState<boolean>(false);

  // VM name validation state for Cloud Init (WebSocket-based duplicate check)
  const [vmNameUniqueCheck, setVmNameUniqueCheck] = useState<boolean>(true);
  const [isCheckingVmNameUniqueness, setIsCheckingVmNameUniqueness] = useState<boolean>(false);

  // Callback to handle VM name validation from CloudInitBasic
  const handleVmNameValidation = useCallback((isValid: boolean, isChecking: boolean) => {
    setVmNameUniqueCheck(isValid);
    setIsCheckingVmNameUniqueness(isChecking);
  }, []);

  // Helper function to check if server is selected
  const isServerSelected = useCallback(() => {
    return selectedServerIp && selectedServerIp !== '';
  }, [selectedServerIp]);

  // Single effect to handle server selection
  useEffect(() => {
    if (selectedServer?.fqdn || selectedServer?.ip) {
      setSelectedServerIp(selectedServer.fqdn || selectedServer.ip);
    }
  }, [selectedServer?.fqdn, selectedServer?.ip]);

  // Effect to fetch VMs for selected server on mount/server change
  useEffect(() => {
    if (selectedServerIp) {
      fetchVMsForServer(selectedServerIp);
    }
  }, [selectedServerIp, fetchVMsForServer]);

  useEffect(() => {
    fetchGlobalVmList();
  }, [fetchGlobalVmList]);

  // Effect to fetch cloud images from control node
  useEffect(() => {
    const fetchCloudImages = async () => {
      if (provisioningType !== 'cloud-init') {
        setAvailableImages([]);
        setSelectedImage('');
        return;
      }

      setImagesLoading(true);
      try {
        const res = await api.fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/cloudimages`
        );
        if (!res.ok) {
          logger.error('Error fetching cloud images:', res.status);
          setAvailableImages([]);
          return;
        }
        const result = await res.json();
        const images = result.raws || [];
        setAvailableImages(images);
        if (images.length > 0 && !selectedImage) {
          setSelectedImage(images[0]);
        }
      } catch (error) {
        logger.error('Error fetching cloud images:', error);
        setAvailableImages([]);
      } finally {
        setImagesLoading(false);
      }
    };
    fetchCloudImages();
  }, [provisioningType]); // Fetch when provisioning type changes

  // Effect to fetch network drivers from control node
  useEffect(() => {
    const fetchNetworkDrivers = async () => {
      try {
        const res = await api.fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/drivers`
        );
        if (!res.ok) {
          logger.error('Error fetching network drivers:', res.status);
          return;
        }
        const result = await res.json();
        const newDrivers = Array.isArray(result.drivers) ? result.drivers : [];
        // Filter out 'e1000' driver from the list
        const filteredDrivers = newDrivers.filter((driver: string) => driver !== 'e1000');
        setNetworkDrivers(filteredDrivers);
      } catch (error) {
        logger.error('Error fetching network drivers:', error);
      }
    };
    fetchNetworkDrivers();
  }, []); // Fetch once on component mount

  // Effect to fetch network switches from control node
  useEffect(() => {
    const fetchNetworkSwitches = async () => {
      try {
        const res = await api.fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`
        );
        if (!res.ok) {
          logger.error('Error fetching network switches:', res.status);
          return;
        }
        const data = await res.json();
        const switches = Array.isArray(data) ? data.map((sw: any) => sw.name) : [];
        setNetworkSwitches(switches);
      } catch (error) {
        logger.error('Error fetching network switches:', error);
      }
    };
    fetchNetworkSwitches();
  }, []); // Fetch once on component mount

  // Effect to fetch DNS zones from control node
  useEffect(() => {
    const fetchDnsZones = async () => {
      try {
        const res = await api.fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/ipam/dns/zones?status=active`
        );
        if (!res.ok) {
          logger.error('Error fetching DNS zones:', res.status);
          return;
        }
        const data = await res.json();
        const zones = Array.isArray(data.zones) ? data.zones.map((zone: any) => zone.name) : [];
        setDnsZones(zones);
      } catch (error) {
        logger.error('Error fetching DNS zones:', error);
      }
    };
    fetchDnsZones();
  }, []); // Fetch once on component mount

  // Effect to fetch VM datastores from control node
  useEffect(() => {
    const fetchStoragePools = async () => {
      try {
        const res = await api.fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores`
        );
        if (!res.ok) {
          logger.error('Error fetching VM datastores:', res.status);
          return;
        }
        const data = await res.json();
        // Handle both array format and new object format with datastores property
        const datastoresArray = Array.isArray(data) ? data : data.datastores || [];
        setPools(datastoresArray);
      } catch (error) {
        logger.error('Error fetching VM datastores:', error);
      }
    };
    fetchStoragePools();
  }, []); // Fetch once on component mount

  // Effect to update datastore based on selected pool
  useEffect(() => {
    if (!selectedPool || pools.length === 0) return;
    const pool = pools.find((p) => (p.name || p.NAME) === selectedPool);
    if (pool) {
      const poolName = pool.name || pool.NAME;
      setDatastore(poolName); // Use the datastore name directly from the new API
    }
  }, [selectedPool, pools]);

  const validateVmName = (name: string): string => {
    if (/\s/.test(name)) return 'Spaces are not allowed.';
    if (/[.@_:]/.test(name)) return 'Special characters (@, ., _, :) are not allowed.';
    if (/^-|-$/.test(name)) return 'Hyphen cannot be the first or last character.';

    // Check if VM name already exists globally using the global VM list
    if (name?.trim() && state.globalVmList?.vms && Array.isArray(state.globalVmList.vms)) {
      const vmExists = state.globalVmList.vms.some(
        (vm: any) => vm?.name && vm.name.toLowerCase() === name.trim().toLowerCase()
      );

      if (vmExists) {
        return 'VM name already exists in the system. Please choose a different name.';
      }
    }

    return '';
  };

  // Re-validate VM name whenever global VM list changes or VM name changes
  useEffect(() => {
    if (vmName.trim()) {
      setNameError(validateVmName(vmName));
    }
  }, [vmName, state.globalVmList?.vms]);

  // Re-validate VM name whenever selected server or dataCenters change
  useEffect(() => {
    if (vmName.trim()) {
      setNameError(validateVmName(vmName));
    }
  }, [selectedServerIp, dataCenters]);

  // Effect to fetch node info only when server is selected
  useEffect(() => {
    const fetchNodeInfo = async () => {
      if (!isServerSelected()) return;
      try {
        const res = await api.fetch(
          `${envConfig().PROTOCOL}://${selectedServerIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/nodeinfo`
        );
        if (!res.ok) {
          logger.error('Error fetching node info:', res.status);
          return;
        }
        const data = await res.json();
        setNodeLimits({
          cpus: data.cpus || 0,
          sockets: data.sockets || 0,
          memoryGB: Math.floor((data.memory || 0) / 1024),
        });
      } catch (error) {
        logger.error('Error fetching node info:', error);
      }
    };
    fetchNodeInfo();
  }, [selectedServerIp, isServerSelected]);

  // Check if user has permission to manage VMs
  const canManageVMs = true;

  // Return null if user doesn't have VM management permissions
  if (!canManageVMs) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600">
              You don&apos;t have permission to create virtual machines. Please contact your
              administrator to request VM management access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleVmNameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const name = e.target.value;
    setVmName(name);
    setNameError(validateVmName(name));
  };

  const handleDiskSizeChange = (value: number | undefined): void => {
    // Allow clearing the field (undefined), validation will happen on blur/submit
    setDisk0Size(value);
    // Clear error when user is typing
    if (value !== undefined && value > 0) {
      setDisk0SizeError('');
    }
  };

  const validateAllFields = () => {
    // Check VM name
    if (!vmName) {
      return 'Please enter a name for the VM';
    }
    if (nameError) {
      return nameError;
    }

    // Check OS selection
    if (!osType) {
      return 'Please select an operating system';
    }

    // Check CPU cores and memory - only minimum validation
    if (isNaN(value)) {
      return 'Please enter a valid number for CPU cores';
    }
    if (value < 1) {
      return 'Minimum value allowed for cores is 1';
    }
    if (memory < 1) {
      return 'Memory size cannot be less than 1G';
    }

    // Check network
    if (!network0Type || !network0Switch) {
      return 'Please select both network driver and network switch';
    }

    // Check DNS Zone
    if (!selectedDnsZone) {
      return 'Please select a DNS zone';
    }

    // All validations passed
    return null;
  };

  const validateCloudInitFields = () => {
    // Check server selection
    if (!selectedServerIp) {
      return 'Please select a server';
    }

    // Check VM name
    if (!vmName) {
      return 'Please enter a name for the VM';
    }
    if (nameError) {
      return nameError;
    }

    // Check OS selection
    if (!osType) {
      return 'Please select an operating system';
    }

    // Check image selection
    if (!selectedImage) {
      return 'Please select an image';
    }

    // Check CPU cores and memory - only minimum validation
    if (isNaN(value)) {
      return 'Please enter a valid number for CPU cores';
    }
    if (value < 1) {
      return 'Minimum value allowed for cores is 1';
    }
    if (memory < 1) {
      return 'Memory size cannot be less than 1G';
    }

    // Check network switch
    if (!network0Switch) {
      return 'Please select a network switch';
    }

    // Check DNS Zone
    if (!selectedDnsZone) {
      return 'Please select a DNS zone';
    }

    // Check cloud init user details
    if (!cloudInitUsername) {
      return 'Please enter a username';
    }
    if (!cloudInitPassword) {
      return 'Please enter a password';
    }

    // All validations passed
    return null;
  };

  // Get validation error message for current step
  const getCurrentStepError = () => {
    if (provisioningType === 'cloud-init') {
      switch (step) {
        case 1:
          if (!selectedServerIp) return 'Please select a server';
          if (!vmName) return 'Please enter a VM name';
          if (nameError) return nameError;
          if (isCheckingVmNameUniqueness) return 'Checking VM name availability...';
          if (!vmNameUniqueCheck) return 'VM name already exists. Please choose a different name.';
          if (!osType) return 'Please select an operating system';
          if (!selectedImage) return 'Please select a cloud image';
          return null;

        case 2:
          if (!disk0Size || disk0Size <= 0) return 'Please enter a valid disk size';
          if (!network0Switch) return 'Please select a network switch';
          return null;

        case 3:
          if (value < 1) return 'Minimum value allowed for cores is 1';
          if (memory < 1) return 'Memory size cannot be less than 1G';
          return null;

        case 4:
          if (!cloudInitUsername) return 'Please enter a username';
          if (!cloudInitPassword) return 'Please enter a password';
          return null;

        default:
          return null;
      }
    }

    switch (step) {
      case 0:
        return null; // Selection step

      case 1:
        if (!isServerSelected()) return 'Please select a server first';
        if (!vmName) return 'Please enter a VM name';
        if (nameError) return nameError;
        if (!osType) return 'Please select an operating system';
        return null;

      case 2:
        if (!isServerSelected()) return 'Please select a server first';
        if (sockets < 1 || sockets > nodeLimits.sockets)
          return `Sockets must be between 1 and ${nodeLimits.sockets}`;
        if (value < 1 || value > nodeLimits.cpus)
          return `CPU cores must be between 1 and ${nodeLimits.cpus}`;
        if (memory < 1 || memory > nodeLimits.memoryGB)
          return `Memory must be between 1G and ${nodeLimits.memoryGB}G`;
        return null;

      case 3:
        if (!isServerSelected()) return 'Please select a server first';
        if (!disk0Size || disk0Size <= 0) return 'Please enter a valid disk size';
        return null;

      case 4:
        if (!isServerSelected()) return 'Please select a server first';
        if (!network0Type) return 'Please select a network driver';
        if (!network0Switch) return 'Please select a network switch';
        return null;

      default:
        return null;
    }
  };

  // Handle step advancement with validation
  const handleNextStep = (): void => {
    const error = getCurrentStepError();
    if (error) {
      setStatusMessage(error);
      return;
    }

    setStatusMessage('');
    setStep(step + 1);
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      // Validate all fields using the comprehensive validation function
      const validationError =
        provisioningType === 'cloud-init' ? validateCloudInitFields() : validateAllFields();
      if (validationError) {
        setStatusMessage(validationError);
        return;
      }

      // Set loading state
      setIsSubmitting(true);
      setStatusMessage('Creating VM, please wait...');

      let payload;
      let apiEndpoint;

      if (provisioningType === 'cloud-init') {
        // Cloud Init payload
        payload = {
          cpu: value,
          datastore: selectedPool,
          disk_size: `${disk0Size}G`,
          memory: `${memory}G`,
          nw_switch: network0Switch,
          os_type: osType,
          password: cloudInitPassword || '', // Changed from hashed_password to password
          username: cloudInitUsername,
          vm_name: vmName,
          image_name: selectedImage,
        };

        // Add optional fields only if they have values
        if (cloudInitSshKey) payload.ssh_key = cloudInitSshKey;
        if (selectedDnsZone) payload.domain = selectedDnsZone;
        if (cloudInitIp) payload.ip = cloudInitIp;
        if (cloudInitGateway) payload.gateway = cloudInitGateway;
        if (cloudInitNameservers) payload.nameservers = cloudInitNameservers;
        apiEndpoint = `/api/v1/compute/vms/cloudprovision`;
      } else {
        // Standard VM payload
        payload = {
          vm_name: vmName,
          os_types: osType,
          loader,
          datastore: selectedPool,
          uefi_vars: uefiVars,
          graphics: 'yes',
          xhci_mouse: 'yes',
          sockets,
          cpu: value,
          memory: memory.toString() + 'G',
          network0_type: network0Type,
          network0_switch: network0Switch,
          disk0_type: disk0Type,
          disk0_name: 'disk0.img',
          disk0_size: `${disk0Size}G`,
        };

        // Add optional DNS zone if selected
        if (selectedDnsZone) {
          payload.domain_name = selectedDnsZone;
        }

        apiEndpoint = `/api/v1/compute/vms/provision`;
      }

      // Use approval flow to handle the API call
      await executeWithApproval(async (approver?: string) => {
        // Use the selected server for both standard and cloud-init VMs
        const targetServerForApi = selectedServerIp || envConfig().CONTROL_NODE_IP.URL;

        // Build the full URL with approver as query parameter if provided
        let fullUrl = `${envConfig().PROTOCOL}://${targetServerForApi}${envConfig().CONTROL_NODE_IP.PORT}${apiEndpoint}`;
        if (approver) {
          const urlParams = new URLSearchParams();
          urlParams.append('approver', approver);
          fullUrl += `?${urlParams.toString()}`;
        }

        const response = await api.fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        // First try to get response as text
        const responseText = await response.text();
        let responseData;
        try {
          // Then try to parse as JSON if possible
          responseData = JSON.parse(responseText);
        } catch {
          // If parsing fails, we'll just use the text
          responseData = null;
        }

        if (!response.ok) {
          let errorMessage;
          if (responseData?.error || responseData?.message) {
            errorMessage = responseData.error || responseData.message;
          } else if (responseText) {
            errorMessage = responseText;
          } else {
            errorMessage = 'Failed to create VM';
          }

          // Handle permission errors specifically
          if (response.status === 401 || response.status === 403) {
            errorMessage = "You don't have permission to create virtual machines on this server.";
          } else if (response.status === 500) {
            // Handle 500 Internal Server Error with the actual error from response
            errorMessage = `Server error: ${errorMessage || 'The server encountered an error while processing your request.'}`;
          } else if (
            errorMessage.includes('Datastore:') &&
            errorMessage.includes('does not exist')
          ) {
            setStatusMessage(
              `Please create a datastore for ${selectedPool} to perform this action.`
            );
            return;
          }

          // Display the error message to user
          setStatusMessage(errorMessage);
          throw new Error(errorMessage);
        }

        if (requiresApproval && approver) {
          setStatusMessage(
            `VM '${vmName}' creation request submitted for approval. The VM will be created once approved.`
          );
          // Don't navigate - keep user on the current page
          return;
        } else {
          setStatusMessage(
            `VM '${vmName}' provisioned successfully! Redirecting to VM hardware page...`
          );
        }

        // Create VM object with provisioning details (only for non-approval flow)
        const newVm = {
          id: (responseData && responseData.id) || `vm-${Date.now()}`,
          name: vmName,
          datastore: datastore,
          state: 'Stopped',
          isOn: false,
          os: osType,
          cpu: value,
          memory: memory.toString() + 'G',
          server: selectedServerIp || '',
        };

        // Find and set the selected server in global state first
        // For cloud-init VMs, use control node as the server
        const serverToUse = selectedServerIp || envConfig().CONTROL_NODE_IP.URL;
        const targetServer = state.dataCenters
          .flatMap((dc) => dc.servers)
          .find((s) => s.ip === serverToUse || s.fqdn === serverToUse);

        if (targetServer) {
          // Set the selected server in global state first using dispatch
          dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: targetServer });

          // Fetch VMs again to update the list
          await fetchVMsForServer(targetServer);
        }

        // Update global state with the new VM synchronously and navigate
        setSelectedVm(newVm);
        // Use targetServer name if found, otherwise use control node URL or the IP
        const serverHostname =
          targetServer?.name || envConfig().CONTROL_NODE_IP.URL || serverToUse || 'control-node';
        navigate(`/server/${serverHostname}/vm/${vmName}/hardware`, {
          replace: true,
          state: { fromProvision: true },
        });
        setStatusMessage(
          `VM '${vmName}' provisioned successfully! Redirecting to VM hardware page...`
        );

        // Show success toast with next steps
        toast.info('VM created successfully! Next step is to mount an ISO / Virtual Drive.', {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });

        navigate(`/server/${serverHostname}/vm/${vmName}/hardware`, {
          replace: true,
          state: { fromProvision: true },
        });
      });
    } catch (error: unknown) {
      logger.error('VM Provisioning Error:', error);

      // Type guard for error handling
      const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) {
          return error.message;
        }
        if (typeof error === 'string') {
          return error;
        }
        return 'Unknown error occurred';
      };

      // Provide more specific error messages based on the error type
      let errorMessage = 'An unexpected error occurred while provisioning the VM.';
      const errorMsg = getErrorMessage(error);

      if (
        errorMsg.includes('permission') ||
        errorMsg.includes('Permission') ||
        errorMsg.includes('Unauthorized') ||
        errorMsg.includes('Forbidden')
      ) {
        errorMessage = `Permission error: ${errorMsg}`;
      } else if (errorMsg.includes('Datastore')) {
        errorMessage = `Storage error: ${errorMsg}`;
      } else if (errorMsg.includes('network') || errorMsg.includes('switch')) {
        errorMessage = `Network error: ${errorMsg}`;
      } else if (errorMsg.includes('name')) {
        errorMessage = `VM name error: ${errorMsg}`;
      } else if (errorMsg) {
        errorMessage = errorMsg;
      }

      setStatusMessage(errorMessage);

      // Clear error message after 5 seconds
      setTimeout(() => {
        setStatusMessage('');
      }, 5000);
    } finally {
      // Check if component is still mounted before updating state
      if (setIsSubmitting) {
        setIsSubmitting(false);
      }
    }
  };

  // Validation functions for each step
  const isVmNameValid = () => {
    return vmName && validateVmName(vmName) === '';
  };

  const isOSValid = () => {
    return osType !== '';
  };

  const isCpuMemoryValid = () => {
    return (
      sockets >= 1 &&
      sockets <= nodeLimits.sockets &&
      value >= 1 &&
      value <= nodeLimits.cpus &&
      memory >= 1 &&
      memory <= nodeLimits.memoryGB
    );
  };

  const isStorageStepValid = () => {
    return disk0Size !== undefined && disk0Size > 0;
  };

  const isNetworkStepValid = () => {
    return network0Type !== '' && network0Switch !== '';
  };

  // Check if there are any error messages that should disable navigation
  const hasErrorMessages = () => {
    if (!statusMessage) return false;

    // Only check for permission-related errors that should disable navigation
    const permissionErrorIndicators = [
      "don't have permission",
      'Permission denied',
      'Access denied',
      'Unauthorized',
      'Forbidden',
    ];

    return permissionErrorIndicators.some((indicator) =>
      statusMessage.toLowerCase().includes(indicator.toLowerCase())
    );
  };

  // Validate current step's data
  const isCurrentStepValid = () => {
    // If there are error messages (like permission errors), disable the button
    if (hasErrorMessages()) {
      return false;
    }

    if (provisioningType === 'cloud-init') {
      switch (step) {
        case 1:
          // For Cloud Init step 1, ensure server is selected and VM name is unique and not being checked
          return (
            selectedServerIp !== '' &&
            isVmNameValid() &&
            isOSValid() &&
            selectedImage !== '' &&
            vmNameUniqueCheck &&
            !isCheckingVmNameUniqueness
          );
        case 2:
          return disk0Size !== undefined && disk0Size > 0 && network0Switch !== '';
        case 3:
          return value >= 1 && memory >= 1;
        case 4:
          return cloudInitUsername !== '' && cloudInitPassword !== '';
        case 5:
          return true;
        default:
          return false;
      }
    }

    switch (step) {
      case 0:
        return true; // Selection step
      case 1:
        return isServerSelected() && isVmNameValid() && isOSValid();
      case 2:
        return isCpuMemoryValid();
      case 3:
        return isStorageStepValid();
      case 4:
        return isNetworkStepValid();
      default:
        return false;
    }
  };

  const renderStep = () => {
    // If no provisioning type is selected, show the selection screen
    if (step === 0) {
      return (
        <div className="text-center">
          <h2 className="text-lg font-bold mb-6">Standard VM Provisioning</h2>
          <p className="text-gray-600 mb-8">
            Begin the step-by-step process to create your virtual machine.
          </p>

          <div className="flex justify-center gap-5">
            <div
              className={`p-2 border-2 rounded-md cursor-pointer transition-all w-48 ${
                provisioningType === 'standard'
                  ? 'border-karios-blue bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                setProvisioningType('standard');
                setVmName('');
                setNameError('');
                setStep(1);
              }}
            >
              <div className="text-center">
                <div className="w-6 h-6 mx-auto mb-1 bg-karios-blue rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-medium mb-0.5">Standard VM</h3>
                <p className="text-gray-600 text-xs leading-tight">Multi-step configuration</p>
              </div>
            </div>
            <div
              className={`p-2 border-2 rounded-md cursor-pointer transition-all w-48 ${
                provisioningType === 'cloud-init'
                  ? 'border-karios-blue bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                setProvisioningType('cloud-init');
                setVmName('');
                setNameError('');
                setStep(1);
              }}
            >
              <div className="text-center">
                <div className="w-6 h-6 mx-auto mb-1 bg-karios-green rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-medium mb-0.5">Cloud-init VM</h3>
                <p className="text-gray-600 text-xs leading-tight">Pre-configured</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Cloud Init functionality temporarily disabled
    if (provisioningType === 'cloud-init') {
      // Cloud Init multi-step flow
      switch (step) {
        case 1:
          return (
            <CloudInitBasic
              vmName={vmName}
              handleVmNameChange={handleVmNameChange}
              nameError={nameError}
              osType={osType}
              setOsType={setOsType}
              selectedServerIp={selectedServerIp || ''}
              setSelectedServerIp={setSelectedServerIp}
              availableImages={availableImages}
              selectedImage={selectedImage}
              setSelectedImage={setSelectedImage}
              imagesLoading={imagesLoading}
              onVmNameValidation={handleVmNameValidation} // Pass the callback handler
            />
          );
        case 2:
          return (
            <CloudInitStorageNetwork
              selectedPool={selectedPool}
              setSelectedPool={setSelectedPool}
              pools={pools}
              datastore={datastore}
              network0Switch={network0Switch}
              setNetwork0Switch={setNetwork0Switch}
              networkSwitches={networkSwitches}
              dnsZones={dnsZones}
              selectedDnsZone={selectedDnsZone}
              setSelectedDnsZone={setSelectedDnsZone}
            />
          );
        case 3:
          return (
            <CloudInitHardware
              value={value}
              setValue={setValue}
              memory={memory}
              setMemory={setMemory}
              disk0Size={disk0Size}
              handleDiskSizeChange={handleDiskSizeChange}
            />
          );
        case 4:
          return (
            <CloudInitUser
              cloudInitUsername={cloudInitUsername}
              setCloudInitUsername={setCloudInitUsername}
              cloudInitPassword={cloudInitPassword}
              setCloudInitPassword={setCloudInitPassword}
              cloudInitHashedPassword={cloudInitHashedPassword}
              setCloudInitHashedPassword={setCloudInitHashedPassword}
              cloudInitSshKey={cloudInitSshKey}
              setCloudInitSshKey={setCloudInitSshKey}
            />
          );
        default:
          return null;
      }
    }

    // Standard VM setup steps (step is 1-based for standard setup after selection)
    switch (step) {
      case 1:
        return (
          <VmDetails
            vmName={vmName}
            handleVmNameChange={handleVmNameChange}
            nameError={nameError}
            loader={loader}
            setLoader={setLoader}
            setUefiVars={setUefiVars}
            osType={osType}
            setOsType={setOsType}
            selectedServerIp={selectedServerIp || ''}
            setSelectedServerIp={setSelectedServerIp}
          />
        );
      case 2:
        return (
          <VmHardware
            sockets={sockets}
            setSockets={setSockets}
            value={value}
            setValue={setValue}
            memory={memory}
            setMemory={setMemory}
            nodeLimits={nodeLimits}
          />
        );
      case 3:
        return (
          <VmStorage
            selectedPool={selectedPool}
            setSelectedPool={setSelectedPool}
            disk0Size={disk0Size}
            handleDiskSizeChange={handleDiskSizeChange}
            pools={pools}
          />
        );
      case 4:
        return (
          <VmNetwork
            network0Type={network0Type}
            setNetwork0Type={setNetwork0Type}
            network0Switch={network0Switch}
            setNetwork0Switch={setNetwork0Switch}
            networkDrivers={networkDrivers}
            networkSwitches={networkSwitches}
          />
        );
      default:
        return null;
    }
  };

  // Check if all fields are valid for single-page mode
  const isAllFieldsValid = () => {
    if (hasErrorMessages()) {
      return false;
    }

    // Validate all required fields
    if (!selectedServerIp) return false; // Server must be selected
    if (!vmName || nameError) return false;
    if (!osType) return false;
    // Check CPU and memory - only minimum validation
    if (sockets < 1) return false;
    if (value < 1) return false;
    if (memory < 1) return false;
    if (!isStorageStepValid()) return false;
    if (!isNetworkStepValid()) return false;
    // Check DNS Zone is selected
    if (!selectedDnsZone) return false;

    return true;
  };

  // Single-page mode rendering
  // If using single page mode (Standard VM), show all fields on one page
  if (useSinglePageMode) {
    return (
      <div className="min-h-screen bg-white">
        {/* Page Header - White Background */}
        <div className="px-8 py-2 bg-white">
          <h1 className="text-2xl font-bold text-gray-900">Create Virtual Machine</h1>
          <p className="mt-0.5 text-xs text-gray-600">
            Configure all your VM settings on this page
          </p>
        </div>

        {/* Form Container - Gray Background */}
        <div className="px-8 pb-4">
          <div className="w-full bg-gray-50 rounded-lg p-4 space-y-3 border-2 border-gray-200">
            {/* Form Content */}
            <SinglePageVMSetup
              // VM Details
              vmName={vmName}
              handleVmNameChange={handleVmNameChange}
              nameError={nameError}
              loader={loader}
              setLoader={setLoader}
              setUefiVars={setUefiVars}
              osType={osType}
              setOsType={setOsType}
              selectedServerIp={selectedServerIp || ''}
              setSelectedServerIp={setSelectedServerIp}
              dataCenters={dataCenters}
              // Hardware
              sockets={sockets}
              setSockets={setSockets}
              value={value}
              setValue={setValue}
              memory={memory}
              setMemory={setMemory}
              nodeLimits={nodeLimits}
              // Storage
              selectedPool={selectedPool}
              setSelectedPool={setSelectedPool}
              disk0Size={disk0Size}
              handleDiskSizeChange={handleDiskSizeChange}
              pools={pools}
              // Network
              network0Type={network0Type}
              setNetwork0Type={setNetwork0Type}
              network0Switch={network0Switch}
              setNetwork0Switch={setNetwork0Switch}
              networkDrivers={networkDrivers}
              networkSwitches={networkSwitches}
              dnsZones={dnsZones}
              selectedDnsZone={selectedDnsZone}
              setSelectedDnsZone={setSelectedDnsZone}
            />

            {/* Status/Error Message */}
            {(permissionError ||
              (statusMessage &&
                !statusMessage.includes('success') &&
                !statusMessage.includes('wait') &&
                !statusMessage.includes('Creating'))) && (
              <div className="mt-8 p-4 rounded-md text-center bg-red-100 text-red-800 border border-red-200">
                {permissionError || statusMessage}
              </div>
            )}
            {/* Success/info message */}
            {!permissionError &&
              statusMessage &&
              (statusMessage.includes('success') ||
                statusMessage.includes('wait') ||
                statusMessage.includes('Creating')) && (
                <div
                  className={`mt-8 p-4 rounded-md text-center ${
                    statusMessage.includes('success')
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  {statusMessage}
                </div>
              )}
            {/* Action Buttons */}
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-1.5 text-gray-700 hover:text-gray-900 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  !isAllFieldsValid() || isSubmitting || hasErrorMessages() || !!statusMessage
                }
                className="px-8 py-1.5 bg-karios-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {isSubmitting ? 'Creating VM...' : 'Create VM'}
              </button>
            </div>

            {/* Approval Modal */}
            {isModalOpen && <ApprovalModal {...modalProps} />}
          </div>
        </div>
      </div>
    );
  }

  // Multi-step mode (Cloud-init or Standard with multi-step)
  return (
    <div className="min-h-screen bg-white">
      {/* Page Header */}
      <div className="px-8 py-4 bg-white border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Create Virtual Machine</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          {step === 0
            ? 'Select VM Type'
            : `Step ${step} of ${provisioningType === 'cloud-init' ? 4 : 4}`}
        </p>
      </div>

      {/* Form Container */}
      <div className="px-8 py-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8 border border-gray-200">
          {/* Render the current step */}
          {renderStep()}

          {/* Status/Error Messages */}
          {statusMessage && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                statusMessage.includes('error') || statusMessage.includes('Error')
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-blue-50 border border-blue-200 text-blue-700'
              }`}
            >
              {statusMessage}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg mt-6 flex justify-between">
            {step === 0 ? (
              // Initial selection screen
              <div></div>
            ) : (
              <button
                onClick={() => {
                  if (step === 1) {
                    // For cloud-init, go back to home page; for standard, go back to selection
                    if (provisioningType === 'cloud-init') {
                      navigate('/');
                    } else {
                      setStep(0);
                    }
                  } else {
                    setStep(step - 1);
                  }
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Back
              </button>
            )}

            {step === 0 ? (
              // Provisioning type selection - Continue button
              <button
                onClick={() => setStep(1)}
                disabled={!provisioningType || !!statusMessage}
                className="px-6 py-2 bg-karios-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            ) : provisioningType === 'cloud-init' && step < 4 ? (
              // Cloud init - navigation between steps 1-3
              <button
                onClick={handleNextStep}
                disabled={!isCurrentStepValid() || hasErrorMessages() || !!statusMessage}
                className="px-6 py-2 bg-karios-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            ) : provisioningType === 'cloud-init' && step === 4 ? (
              // Cloud init - final step
              <button
                onClick={handleSubmit}
                disabled={
                  !isCurrentStepValid() || isSubmitting || hasErrorMessages() || !!statusMessage
                }
                className="px-6 py-2 bg-karios-green text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Creating VM...' : 'Create VM'}
              </button>
            ) : step < 4 ? (
              // Standard VM setup navigation
              <button
                onClick={handleNextStep}
                disabled={!isCurrentStepValid() || hasErrorMessages() || !!statusMessage}
                className="px-6 py-2 bg-karios-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            ) : (
              // Final step for standard VM setup
              <button
                onClick={handleSubmit}
                disabled={
                  !isNetworkStepValid() || isSubmitting || hasErrorMessages() || !!statusMessage
                }
                className="px-6 py-2 bg-karios-green text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Creating VM...' : 'Create VM'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      {isModalOpen && <ApprovalModal {...modalProps} />}
    </div>
  );
}
