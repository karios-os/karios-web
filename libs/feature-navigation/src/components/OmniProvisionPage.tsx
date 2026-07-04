import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Modal from '../../../shared-state/src/widgets/Modal';
import OmniProvisionModal from './OmniProvisionModal';
import envConfig from '../../../../runtime-config';
import { useAppState } from '../../../shared-state/src';
import { logger } from '../../../shared-state/src/utils/logger';
import { DnsZoneDropdown } from '../TopNavBar_components/shared/DnsZoneDropdown';

interface StatusLog {
  id: number;
  message: string;
  timestamp: string;
  isSystemMessage?: boolean;
  isError?: boolean;
}

interface UploadFile {
  file: File | null;
  name: string;
  type: 'cert' | 'key';
}

interface OmniServer {
  id: string;
  vm_name: string;
  status: string;
  serverIp: string;
}

export default function OmniProvisionPage() {
  const { state: appState } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState<'setup' | 'provision'>(() => {
    const stored = localStorage.getItem('omniCurrentPage');
    return stored ? (stored as 'setup' | 'provision') : 'setup';
  });

  // Step navigation state - tracks which step user is currently on
  const [currentStep, setCurrentStep] = useState<'keycloak' | 'certificates' | 'omni-server'>(
    () => {
      const stored = localStorage.getItem('omniCurrentStep');
      if (stored) {
        return stored as 'keycloak' | 'certificates' | 'omni-server';
      }

      // Auto-determine step based on prerequisites completion
      try {
        const prereqsStored = localStorage.getItem('omniPrerequisites');
        if (prereqsStored) {
          const prereqs = JSON.parse(prereqsStored);
          if (prereqs.OmniServer) return 'omni-server';
          if (prereqs.Certs) return 'omni-server';
          if (prereqs.Keycloak) return 'certificates';
        }
      } catch (e) {
        logger.error('Error parsing prerequisites for step determination:', e);
      }

      return 'keycloak';
    }
  );

  const [isKeycloakModalOpen, setIsKeycloakModalOpen] = useState(false);

  // Upload files state
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([
    { file: null, name: '', type: 'cert' },
    { file: null, name: '', type: 'key' },
  ]);
  const [isUploading, setIsUploading] = useState(false);

  // Prerequisites state to force re-render when they change
  const [prerequisitesUpdateCount, setPrerequisitesUpdateCount] = useState(0);

  // Omni server provisioning state
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [serverForm, setServerForm] = useState({
    vm_name: 'omniserver', // Fixed VM name
    datastore: '/zroot/vm',
    os_type: 'ubuntu-server',
    image_name: '',
    cpu: 2,
    memory: '6G',
    disk_size: '40G',
    nw_switch: 'public',
    username: '',
    password: '',
    cluster_name: 'omni', // Fixed cluster name
    auth0_domain: '',
    auth0_client: '',
    admin_email: '',
    domain: '',
  });

  // Omni VM configuration state
  const [omniVMs, setOmniVMs] = useState<any[]>([]);

  // Server and resource data
  const [availableServers, setAvailableServers] = useState<any[]>([]);
  const [pools, setPools] = useState<any[]>([]);
  const [networkSwitches, setNetworkSwitches] = useState<string[]>([]);
  const [serverResources, setServerResources] = useState<{ [key: string]: any }>({});
  const [availableImages, setAvailableImages] = useState<any[]>([]);

  // Ref to track if cloud images have been fetched to prevent duplicate calls
  const cloudImagesFetched = useRef(false);
  const lastFetchTime = useRef(0);

  // Ubuntu-style modal state for VM editing
  const [isOmniVMModalOpen, setIsOmniVMModalOpen] = useState(false);
  const [isOmniProvisionModalOpen, setIsOmniProvisionModalOpen] = useState(false);
  const [editingVMId, setEditingVMId] = useState<string | null>(null);
  const [currentOmniVMConfig, setCurrentOmniVMConfig] = useState<any>({
    selectedServerIp: '',
    selectedNetworkSwitch: '',
    vm_name: '',
    cpu: 4,
    memoryGB: 8,
    diskSizeGB: 40,
  });

  // Password visibility state for Omni server creation
  const [showOmniPassword, setShowOmniPassword] = useState<boolean>(false);

  // Field validation errors for Omni server creation
  const [omniFieldErrors, setOmniFieldErrors] = useState<{ [key: string]: string }>({});

  // Resource validation state for Omni VM configuration (similar to K8s setup)
  const [resourceValidationErrors, setResourceValidationErrors] = useState<{
    [key: string]: string;
  }>({});
  const [isLoadingNodeInfo, setIsLoadingNodeInfo] = useState(false);

  // Track Keycloak modal interaction for TLS certificate display - persist in localStorage
  const [hasKeycloakModalBeenOpened, setHasKeycloakModalBeenOpened] = useState(() => {
    const stored = localStorage.getItem('hasKeycloakModalBeenOpened');
    return stored ? JSON.parse(stored) : false;
  });

  // Track if upload certificates button has been clicked - persist in localStorage
  const [showUploadCertificatesSection, setShowUploadCertificatesSection] = useState(() => {
    const stored = localStorage.getItem('showUploadCertificatesSection');
    return stored ? JSON.parse(stored) : false;
  });

  // TLS certificate check state - persist in localStorage to prevent resets
  const [tlsCertsExist, setTlsCertsExist] = useState<boolean | null>(() => {
    const stored = localStorage.getItem('tlsCertsExist');
    return stored ? JSON.parse(stored) : null;
  });
  const [isCheckingCerts, setIsCheckingCerts] = useState(false);

  // Helper function to validate Omni username
  const validateOmniUsername = (username: string): string | undefined => {
    if (!username) return undefined;
    const lowerUsername = username.toLowerCase().trim();
    if (lowerUsername === 'admin' || lowerUsername === 'root') {
      return 'For Omni, the username cannot be admin or root';
    }
    return undefined;
  };

  // Helper function to validate Omni password
  const validateOmniPassword = (password: string): string | undefined => {
    if (!password) return undefined;
    if (password.length < 6) {
      return 'Password must be at least 6 characters for Omni provisioning';
    }
    return undefined;
  };

  // Resource validation functions (similar to K8s setup)
  const validateOmniVMResources = (cpuCores: number, memoryGB: number, serverIp: string) => {
    const errors: { [key: string]: string } = {};

    if (!serverIp) {
      errors['cpu'] = 'Please select a server first to validate CPU availability';
      errors['memory'] = 'Please select a server first to validate memory availability';
      return errors;
    }

    // Get server resource data
    const serverResourceData = serverResources[serverIp];
    if (!serverResourceData) {
      errors['cpu'] = 'Unable to validate resources - server data not loaded';
      errors['memory'] = 'Unable to validate resources - server data not loaded';
      return errors;
    }

    // Calculate available resources
    const totalCpus = serverResourceData.cpus || 0;
    const totalMemoryMB = serverResourceData.memory || 0;
    const totalMemoryGB = Math.floor(totalMemoryMB / 1024);
    const usedCpus = serverResourceData.cpus_in_use || 0;
    const usedMemoryMB = serverResourceData.memory_in_use || 0;
    const usedMemoryGB = Math.floor(usedMemoryMB / 1024);

    // CRITICAL FIX: Calculate allocated resources from other saved Omni VMs on this server
    let allocatedCpus = 0;
    let allocatedMemoryGB = 0;

    savedOmniVMs.forEach((vm) => {
      if (vm.selectedServerIp === serverIp) {
        // Exclude the VM being edited if we're in edit mode
        if (editingVMId && vm.id === editingVMId) {
          return; // Skip this VM
        }
        allocatedCpus += vm.cpu || 0;
        allocatedMemoryGB += vm.memoryGB || 0;
      }
    });

    // Calculate what's actually available (total - used - allocated by other VMs)
    const availableCpus = totalCpus - usedCpus - allocatedCpus;
    const availableMemoryGB = totalMemoryGB - usedMemoryGB - allocatedMemoryGB;

    // Minimum requirements for Omni VMs (similar to Ubuntu)
    const minCpu = 4;
    const minMemory = 8;

    // Check minimum requirements first
    if (cpuCores < minCpu) {
      errors['cpu'] = `Omni VM requires minimum ${minCpu} CPUs`;
    }
    if (memoryGB < minMemory) {
      errors['memory'] = `Omni VM requires minimum ${minMemory}GB memory`;
    }

    // Check resource availability (only if minimum requirements pass)
    if (!errors['cpu'] && cpuCores > availableCpus) {
      errors['cpu'] =
        `Only ${availableCpus} CPUs available (${totalCpus} total - ${usedCpus} used - ${allocatedCpus} allocated)`;
    }
    if (!errors['memory'] && memoryGB > availableMemoryGB) {
      errors['memory'] =
        `Only ${availableMemoryGB}GB memory available (${totalMemoryGB}GB total - ${usedMemoryGB}GB used - ${allocatedMemoryGB}GB allocated)`;
    }

    return errors;
  };

  // Update resource validation when configuration changes
  const updateResourceValidation = () => {
    if (currentOmniVMConfig.selectedServerIp) {
      const validationErrors = validateOmniVMResources(
        currentOmniVMConfig.cpu,
        currentOmniVMConfig.memoryGB,
        currentOmniVMConfig.selectedServerIp
      );
      setResourceValidationErrors(validationErrors);
    } else {
      setResourceValidationErrors({});
    }
  };

  // Wrapper functions to persist state changes to localStorage
  const updateHasKeycloakModalBeenOpened = (value: boolean) => {
    setHasKeycloakModalBeenOpened(value);
    localStorage.setItem('hasKeycloakModalBeenOpened', JSON.stringify(value));
  };

  const updateShowUploadCertificatesSection = (value: boolean) => {
    setShowUploadCertificatesSection(value);
    localStorage.setItem('showUploadCertificatesSection', JSON.stringify(value));
  };

  const updateTlsCertsExist = (value: boolean | null) => {
    setTlsCertsExist(value);
    if (value !== null) {
      localStorage.setItem('tlsCertsExist', JSON.stringify(value));
    } else {
      localStorage.removeItem('tlsCertsExist');
    }

    // Hide upload section when certificates exist
    if (value === true) {
      updateShowUploadCertificatesSection(false);
    }
  };

  const updateCurrentPage = (page: 'setup' | 'provision') => {
    setCurrentPage(page);
    localStorage.setItem('omniCurrentPage', page);
  };

  const updateCurrentStep = (step: 'keycloak' | 'certificates' | 'omni-server') => {
    setCurrentStep(step);
    localStorage.setItem('omniCurrentStep', step);
  };

  // Clear localStorage on component unmount or navigation away
  useEffect(() => {
    return () => {
      // Don't clear on unmount - we want persistence
    };
  }, []);

  const handleKeycloakClick = async () => {
    setIsKeycloakModalOpen(true);
    updateHasKeycloakModalBeenOpened(true); // Mark that Keycloak modal has been opened
    // Refresh prerequisites to update button visibility
    await refreshPrerequisites();
  };

  // Omni VM management functions - single server only
  const handleAddOmniVM = async () => {
    // Check if we already have a server (only one allowed)
    if (savedOmniVMs.length > 0) {
      alert('Only one Omni server is allowed');
      return;
    }

    // Reset VM config to fresh state - let user select server
    setCurrentOmniVMConfig({
      vm_name: 'omniserver', // Fixed VM name
      selectedServerIp: '',
      selectedNetworkSwitch: '',
      cpu: 4,
      memoryGB: 8,
      diskSizeGB: 40,
    });
    setEditingVMId(null); // Ensure we're in add mode

    setIsOmniVMModalOpen(true);
  };

  const handleRemoveOmniVM = (vmId: string) => {
    // Remove from editing list (current behavior for unsaved VMs)
    setOmniVMs((prev) => prev.filter((vm) => vm.id !== vmId));

    // Cancel edit if this was the VM being edited
    // This function is now replaced by the modal-based approach
  };

  // Ubuntu pattern - no longer need inline VM editing functions

  // VM state management (exactly like Ubuntu control plane)
  const [savedOmniVMs, setSavedOmniVMs] = useState<any[]>([]);
  const [editingVMOriginal, setEditingVMOriginal] = useState<any | null>(null);

  // Handle VM save (exactly like Ubuntu control plane Save)
  const handleSaveOmniVM = () => {
    // Validate required fields (Ubuntu pattern)
    if (!currentOmniVMConfig.selectedServerIp || !currentOmniVMConfig.selectedNetworkSwitch) {
      alert('Please fill in all required fields');
      return;
    }

    // Check for resource validation errors
    const validationErrors = validateOmniVMResources(
      currentOmniVMConfig.cpu,
      currentOmniVMConfig.memoryGB,
      currentOmniVMConfig.selectedServerIp
    );

    if (validationErrors['cpu'] || validationErrors['memory']) {
      alert('Please fix the resource allocation errors before saving');
      return;
    }

    // Fixed VM name
    const fixedVMName = 'omniserver';

    if (editingVMId) {
      // Update existing VM config - preserve original ID and use fixed name
      const updatedConfig = {
        ...currentOmniVMConfig,
        id: editingVMId,
        vm_name: fixedVMName,
      };
      setSavedOmniVMs((prev) => [...prev, updatedConfig]);
      setEditingVMOriginal(null);
    } else {
      // Add new VM config with fixed name
      const newConfig = {
        ...currentOmniVMConfig,
        id: `vm-${Date.now()}`,
        vm_name: fixedVMName,
      };
      setSavedOmniVMs((prev) => [...prev, newConfig]);
    }

    setIsOmniVMModalOpen(false);
    setEditingVMId(null);

    // Reset form (Ubuntu pattern)
    setCurrentOmniVMConfig({
      vm_name: 'omniserver', // Fixed VM name
      selectedServerIp: '',
      selectedNetworkSwitch: '',
      cpu: 4,
      memoryGB: 8,
      diskSizeGB: 40,
    });
  };

  // Handle VM edit (exactly like Ubuntu control plane Edit)
  const handleEditVM = async (savedVM: any) => {
    // Store original configuration before editing (Ubuntu pattern)
    setEditingVMOriginal({ ...savedVM });
    // Remove from list temporarily while editing (Ubuntu pattern)
    setSavedOmniVMs((prev) => prev.filter((v) => v.id !== savedVM.id));

    // Set edit mode first (Ubuntu pattern)
    setEditingVMId(savedVM.id);

    // Fetch server data for the selected server BEFORE setting form data (Ubuntu pattern)
    if (savedVM.selectedServerIp) {
      await fetchServerResources(savedVM.selectedServerIp);
      await fetchNetworkSwitches(savedVM.selectedServerIp);

      // Add a small delay to ensure state updates are processed (Ubuntu pattern)
      setTimeout(() => {
        // Load the config into the current form for editing AFTER data is fetched (Ubuntu pattern)
        setCurrentOmniVMConfig({
          vm_name: 'omniserver', // Fixed VM name
          selectedServerIp: savedVM.selectedServerIp,
          selectedNetworkSwitch: savedVM.selectedNetworkSwitch,
          cpu: savedVM.cpu,
          memoryGB: savedVM.memoryGB,
          diskSizeGB: savedVM.diskSizeGB,
        });

        // Open modal after everything is loaded (Ubuntu pattern)
        setIsOmniVMModalOpen(true);
      }, 100);
    } else {
      // If no server IP, set form data immediately (Ubuntu pattern)
      setCurrentOmniVMConfig({
        vm_name: 'omniserver', // Fixed VM name
        selectedServerIp: savedVM.selectedServerIp,
        selectedNetworkSwitch: savedVM.selectedNetworkSwitch,
        cpu: savedVM.cpu,
        memoryGB: savedVM.memoryGB,
        diskSizeGB: savedVM.diskSizeGB,
      });
      setIsOmniVMModalOpen(true);
    }
  };

  // Function to handle canceling VM add/edit (exactly like Ubuntu)
  const cancelOmniVMOperation = () => {
    if (editingVMId && editingVMOriginal) {
      // If we were editing, restore the original VM to the list (Ubuntu pattern)
      setSavedOmniVMs((prev) => [...prev, editingVMOriginal]);
      setEditingVMId(null);
      setEditingVMOriginal(null);
    }
    // Reset the current VM form (Ubuntu pattern)
    setCurrentOmniVMConfig({
      vm_name: '',
      selectedServerIp: '',
      selectedNetworkSwitch: '',
      cpu: 4,
      memoryGB: 8,
      diskSizeGB: 40,
    });
    setIsOmniVMModalOpen(false);
  };

  // Handle VM remove (like Ubuntu control plane Remove)
  const handleRemoveVM = (vmId: string) => {
    setSavedOmniVMs((prev) => prev.filter((v) => v.id !== vmId));
  };

  // API Functions
  const fetchServerResources = async (serverIp: string) => {
    try {
      // Get server address (FQDN with IP fallback)
      const serverAddress = getServerAddress(serverIp);

      const response = await fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/nodeinfo`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setServerResources((prev) => ({ ...prev, [serverIp]: data }));
      }
    } catch (error) {
      logger.error('Failed to fetch server resources:', error);
    }
  };

  const fetchServerPools = async (serverIp: string) => {
    try {
      // Get server address (FQDN with IP fallback)
      const serverAddress = getServerAddress(serverIp);

      const response = await fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Handle both array format and new object format with datastores property
        const datastoresArray = Array.isArray(data) ? data : data.datastores || [];
        setPools(datastoresArray);
      }
    } catch (error) {
      logger.error('Failed to fetch VM datastores:', error);
    }
  };

  const fetchNetworkSwitches = async (serverIp: string) => {
    try {
      // Get server address (FQDN with IP fallback)
      const serverAddress = getServerAddress(serverIp);

      const response = await fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Handle the response structure: [{"name":"public","private":"no","active":"yes","interface":"igc0"}]
        const switches = Array.isArray(data) ? data.map((sw) => sw.name) : [];
        setNetworkSwitches(switches);
      }
    } catch (error) {
      logger.error('Failed to fetch network switches:', error);
    }
  };

  // Fetch available servers from app state
  const fetchAvailableServers = useCallback(() => {
    try {
      // Extract servers from dataCenters state (configured nodes)
      const servers =
        appState.dataCenters?.flatMap(
          (dc) =>
            dc.servers?.map((server) => {
              // Extract just the base server name without domain (e.g., "protectcli" from "protectcli.karios.com")
              const baseServerName = server.name.split('.')[0];
              return {
                ip: server.ip,
                name: `${baseServerName} (${server.ip})`,
                fqdn: server.fqdn, // Include fqdn for address resolution
              };
            }) || []
        ) || [];

      setAvailableServers(servers);
    } catch (error) {
      logger.error('Error extracting servers from state:', error);
    }
  }, [appState.dataCenters]);

  // Helper function to get server address (FQDN with IP fallback)
  const getServerAddress = (serverIp: string): string => {
    const server = availableServers.find((s) => s.ip === serverIp || s.fqdn === serverIp);
    return server ? server.fqdn || server.ip : serverIp;
  };

  // Fetch cloud images directly from API for Omni Server
  const fetchCloudImages = async () => {
    try {
      const now = Date.now();
      // Prevent multiple concurrent calls and rate limit to max once per 5 seconds
      if (cloudImagesFetched.current || now - lastFetchTime.current < 5000) {
        return;
      }

      const firstServer = availableServers[0];
      if (!firstServer) {
        logger.error('No servers available to fetch cloud images');
        return;
      }

      cloudImagesFetched.current = true;
      lastFetchTime.current = now;

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
        // Response format: {"raws": ["freebsd-cloud.raw", "jammy-server-cloudimg-amd64.img"]}
        const images = data?.raws || [];
        setAvailableImages(images);
      } else {
        logger.error(`Failed to fetch cloud images: ${response.status} ${response.statusText}`);
        setAvailableImages([]);
        cloudImagesFetched.current = false; // Reset on failure
      }
    } catch (error) {
      logger.error('Failed to fetch cloud images:', error);
      setAvailableImages([]);
      cloudImagesFetched.current = false; // Reset on error
    }
  };

  // Fetch available servers when component mounts or when dataCenters change
  useEffect(() => {
    fetchAvailableServers();
  }, [fetchAvailableServers]);

  // Fetch cloud images when entering provision page
  useEffect(() => {
    if (currentPage === 'provision' && availableServers.length > 0 && !cloudImagesFetched.current) {
      fetchCloudImages();
    }

    // Reset fetch flag when leaving provision page to allow refetch if needed
    if (currentPage !== 'provision') {
      cloudImagesFetched.current = false;
    }
  }, [currentPage, availableServers.length]); // Use length instead of the entire array to prevent unnecessary re-renders

  // Debug effect to monitor availableImages state
  useEffect(() => {}, [availableImages]);

  // Update resource validation when VM configuration changes
  useEffect(() => {
    updateResourceValidation();
  }, [
    currentOmniVMConfig.cpu,
    currentOmniVMConfig.memoryGB,
    currentOmniVMConfig.selectedServerIp,
    serverResources,
    savedOmniVMs,
    editingVMId,
  ]);

  // Process TLS API result from TopNavBar when component mounts
  useEffect(() => {
    // Check for prerequisites from TopNavBar
    const storedPrereqs = localStorage.getItem('omniPrerequisites');
    const skipTLS = localStorage.getItem('omniSkipTLS');

    if (storedPrereqs && skipTLS) {
      try {
        const prerequisites = JSON.parse(storedPrereqs);

        // Keep prerequisites in localStorage for button rendering
        // Only clear skip TLS flag
        localStorage.removeItem('omniSkipTLS');

        if (skipTLS === 'true' && prerequisites.Certs === true) {
          updateTlsCertsExist(true);
          // Stay on setup page to show Create Omni Server form since OmniServer is false
          updateCurrentPage('setup');
          return; // Exit early, don't process the old TLS check
        } else if (skipTLS === 'false' && prerequisites.Certs === false) {
          updateTlsCertsExist(false);
          updateCurrentPage('setup');
          return; // Exit early, don't process the old TLS check
        }
      } catch (e) {
        logger.error('❌ Error parsing prerequisites:', e);
        localStorage.removeItem('omniPrerequisites');
        localStorage.removeItem('omniSkipTLS');
      }
    }

    // Fallback to old TLS check if no prerequisites from TopNavBar
    const storedResult = localStorage.getItem('omniTlsCheckResult');

    if (storedResult) {
      try {
        const parsedResult = JSON.parse(storedResult);
        const { success, response, timestamp, error } = parsedResult;
        const isRecent = Date.now() - timestamp < 30000;

        if (isRecent) {
          // Clear the stored result immediately
          localStorage.removeItem('omniTlsCheckResult');

          if (success && response?.message === 'TLS cert and key found') {
            updateTlsCertsExist(true);
            // Certificates exist - go directly to Create Omni Cluster page
            updateCurrentPage('provision');
          } else {
            updateTlsCertsExist(false);
            // Stay on setup page - upload section will show after Keycloak modal
          }
        } else {
          localStorage.removeItem('omniTlsCheckResult');
        }
      } catch (e) {
        localStorage.removeItem('omniTlsCheckResult');
      }
    }
  }, []); // Run once when component mounts

  // Refresh prerequisites when component mounts to ensure button visibility is correct
  useEffect(() => {
    const initializePrerequisites = async () => {
      const storedPrereqs = localStorage.getItem('omniPrerequisites');

      if (!storedPrereqs) {
        await refreshPrerequisites();
      } else {
        // Trigger a re-render to ensure buttons show correctly
        setPrerequisitesUpdateCount((prev) => prev + 1);
      }
    };

    initializePrerequisites();
  }, []); // Run once on mount

  const handleKeycloakModalClose = async (wasDisconnected: boolean = false) => {
    setIsKeycloakModalOpen(false);
    updateHasKeycloakModalBeenOpened(true); // Mark that user has interacted with Keycloak

    // Refresh prerequisites from API to get updated Keycloak status
    await refreshPrerequisites();

    // Check for prerequisites from TopNavBar first
    const storedPrereqs = localStorage.getItem('omniPrerequisites');
    if (storedPrereqs) {
      try {
        const prerequisites = JSON.parse(storedPrereqs);

        if (prerequisites.Certs === true) {
          updateTlsCertsExist(true);
          updateCurrentPage('setup'); // Stay on setup page to show Create Omni Server form
          // Keep prerequisites for button rendering

          return; // Exit early
        }
      } catch (e) {
        localStorage.removeItem('omniPrerequisites');
      }
    }

    // Check for prerequisites from Keycloak API call
    const keycloakPrereqs = localStorage.getItem('omniPrerequisitesKeycloak');
    if (keycloakPrereqs) {
      try {
        const prerequisites = JSON.parse(keycloakPrereqs);

        // Clean up the stored result immediately
        localStorage.removeItem('omniPrerequisitesKeycloak');

        if (prerequisites.Certs === true) {
          updateTlsCertsExist(true);
          updateCurrentPage('setup'); // Stay on setup page to show Create Omni Server form
        } else {
          updateTlsCertsExist(false);
          // Stay on setup page, upload section will show automatically
        }

        return; // Exit early, we've processed the new API result
      } catch (e) {
        localStorage.removeItem('omniPrerequisitesKeycloak');
      }
    }

    updateTlsCertsExist(false);
  };

  const handleSetupOmniServerClick = async () => {
    // Check if both Keycloak and Certificates are completed first
    const prerequisites = getCurrentPrerequisites();
    if (!prerequisites.Keycloak) {
      alert('Please complete Keycloak setup first before setting up Omni Server.');
      return;
    }
    if (!prerequisites.Certs) {
      alert('Please upload certificates first before setting up Omni Server.');
      return;
    }

    // Navigate to provision page to show Omni server configuration form
    setCurrentPage('provision');
    // Refresh prerequisites to update button visibility
    await refreshPrerequisites();
  };

  const handleUploadCertificatesClick = async () => {
    // Check if Keycloak is completed first
    const prerequisites = getCurrentPrerequisites();
    if (!prerequisites.Keycloak) {
      alert('Please complete Keycloak setup first before uploading certificates.');
      return;
    }

    // Show the upload certificates section
    updateShowUploadCertificatesSection(true);
    // Force showing upload section by setting tlsCertsExist to false
    updateTlsCertsExist(false);
    // Make sure we're on setup page and not hiding upload section
    setCurrentPage('setup');
    // Refresh prerequisites to update button visibility
    await refreshPrerequisites();
  };

  // Function to get current prerequisites from localStorage
  const getCurrentPrerequisites = () => {
    // Use prerequisitesUpdateCount to ensure this function is reactive to state changes
    try {
      const storedPrereqs = localStorage.getItem('omniPrerequisites');
      if (storedPrereqs) {
        const parsed = JSON.parse(storedPrereqs);
        return parsed;
      }
    } catch (e) {
      logger.error('Error parsing prerequisites:', e);
    }
    return { Certs: false, Keycloak: false, OmniServer: false }; // Default values
  };

  // Function to refresh prerequisites from API
  const refreshPrerequisites = async () => {
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
        localStorage.setItem('omniPrerequisites', JSON.stringify(result));
        // Force re-render by updating the counter
        setPrerequisitesUpdateCount((prev) => prev + 1);
        return result;
      } else {
        logger.error('Failed to refresh prerequisites:', response.status);
        return { Certs: false, Keycloak: false, OmniServer: false };
      }
    } catch (error) {
      logger.error('Error refreshing prerequisites:', error);
      return { Certs: false, Keycloak: false, OmniServer: false };
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
      updateTlsCertsExist(true); // Mark that certs now exist
      updateShowUploadCertificatesSection(false); // Hide upload section on success

      // Refresh prerequisites to update the state from API
      await refreshPrerequisites();

      // Don't auto-navigate - let the step navigation handle it with the Next button
    } catch (error) {
      logger.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const isUploadReady = uploadFiles.every((f) => f.file !== null);

  const handleFormChange = (field: string, value: string | number) => {
    // Since cluster name is fixed, only allow changes to other fields
    if (field === 'cluster_name') {
      return; // Ignore cluster name changes since it's fixed
    }

    setServerForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Validate fields and update errors
    if (field === 'username' && typeof value === 'string') {
      const error = validateOmniUsername(value);
      setOmniFieldErrors((prev) => ({ ...prev, ['username']: error || '' }));
    }

    if (field === 'password' && typeof value === 'string') {
      const error = validateOmniPassword(value);
      setOmniFieldErrors((prev) => ({ ...prev, ['password']: error || '' }));
    }

    // COMMENTED OUT: Auto-update VM names - using fixed names now
    // if (field === 'cluster_name' && typeof value === 'string') {
    //   regenerateVMNames(value);
    // }
  };

  const handleCreateServer = async () => {
    setIsCreatingServer(true);

    try {
      // Create concurrent API calls for all saved VMs (like Ubuntu/OpenShift)
      const vmCreationPromises = savedOmniVMs.map(async (vm) => {
        const vmPayload = {
          vm_name: vm.vm_name,
          datastore: 'default', // Always use "default" storage pool
          os_type: serverForm.os_type,
          image_name: serverForm.image_name,
          cpu: vm.cpu,
          memory: `${vm.memoryGB}G`,
          disk_size: `${vm.diskSizeGB}G`,
          username: serverForm.username,
          password: serverForm.password,
          kubernetes_cluster_name: serverForm.cluster_name,
          nw_switch: vm.selectedNetworkSwitch,
          domain: serverForm.domain,
        };

        // Make API call to the new Omni provisioning endpoint
        const response = await fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/omni/server-setup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
            body: JSON.stringify(vmPayload),
          }
        );

        const result = await response.json();

        // Store job information in localStorage if job_id is present
        if (result.job_id && response.ok) {
          const storageKey = `cluster-job-${serverForm.cluster_name}`;
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              jobId: result.job_id,
              jobType: 'omni-server',
              clusterName: serverForm.cluster_name,
              vmName: result.vm_name,
              timestamp: Date.now(),
            })
          );
        }

        return {
          vmName: vm.vm_name,
          serverIp: vm.selectedServerIp,
          success: response.ok,
          result,
        };
      });

      // Wait for all concurrent VM creations to complete
      const results = await Promise.all(vmCreationPromises);

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      if (failureCount === 0) {
        // Get the job_id from the first successful result
        const firstSuccessResult = results.find((r) => r.success)?.result;

        // Refresh prerequisites to update button visibility (OmniServer should now be true)
        await refreshPrerequisites();

        // Dispatch custom event to trigger sidebar cluster data refresh (like Ubuntu)
        window.dispatchEvent(
          new CustomEvent('clusterCreated', {
            detail: { clusterName: serverForm.cluster_name },
          })
        );

        // Navigate to cluster details page with job status
        if (firstSuccessResult?.job_id) {
          navigate(`/cluster/${serverForm.cluster_name}/details`, {
            replace: true,
            state: {
              showJobStatus: true,
              jobId: firstSuccessResult.job_id,
              jobType: 'omni-server',
            },
          });
        } else {
          // Fallback to navigation without job status
          setTimeout(() => {
            navigate(`/cluster/${serverForm.cluster_name}/details`, { replace: true });
          }, 2000);
        }
      } else {
        alert(
          `${successCount} VMs created successfully, ${failureCount} failed. Check console for details.`
        );
      }
    } catch (error) {
      logger.error('Server creation error:', error);
      alert(`Failed to create servers: ${error.message}`);
    } finally {
      setIsCreatingServer(false);
    }
  };

  const isFormValid = () => {
    return (
      serverForm.cluster_name.trim() !== '' &&
      serverForm.username.trim() !== '' &&
      serverForm.password.trim() !== '' &&
      serverForm.image_name.trim() !== '' &&
      serverForm.domain.trim() !== '' &&
      savedOmniVMs.length > 0
    );
  };

  const renderProvisionPage = () => (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-3 sm:p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Create Omni Server</h1>
              <p className="text-sm text-gray-600 mt-1">Configure your Omni server settings</p>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="p-4 sm:p-6 space-y-6">
              {/* Cluster Name - Fixed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Omni server</label>
                <div className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 font-semibold">
                  omni
                </div>
              </div>

              {/* User Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username <span className="text-red-500">*</span>{' '}
                    <span className="text-xs text-gray-500">
                      (For omni, the username cannot be admin or root)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={serverForm.username}
                    onChange={(e) => handleFormChange('username', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent ${
                      omniFieldErrors['username'] ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter username"
                  />
                  {omniFieldErrors['username'] && (
                    <p className="mt-1 text-sm text-red-600">{omniFieldErrors['username']}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showOmniPassword ? 'text' : 'password'}
                      value={serverForm.password}
                      onChange={(e) => handleFormChange('password', e.target.value)}
                      className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent ${
                        omniFieldErrors['password'] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOmniPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                      aria-label={showOmniPassword ? 'Hide password' : 'Show password'}
                    >
                      {showOmniPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {omniFieldErrors['password'] && (
                    <p className="mt-1 text-sm text-red-600">{omniFieldErrors['password']}</p>
                  )}
                </div>
              </div>

              {/* Attach ISO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attach IMG <span className="text-red-500">*</span>
                </label>
                <select
                  value={serverForm.image_name}
                  onChange={(e) => handleFormChange('image_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select IMG</option>
                  {Array.isArray(availableImages) && availableImages.length > 0 ? (
                    availableImages.map((image, index) => (
                      <option key={index} value={image}>
                        {image}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      No ISOs available
                    </option>
                  )}
                </select>
              </div>

              {/* DNS Zone */}
              <DnsZoneDropdown
                value={serverForm.domain || ''}
                onChange={(value) => handleFormChange('domain', value)}
                label="DNS Zone"
                required={true}
              />

              {/* Omni Cluster */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Omni Cluster</h3>
                  {/* Only allow single server - show button if no server configured */}
                  {savedOmniVMs.length === 0 && (
                    <button
                      onClick={handleAddOmniVM}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      + Setup Omni Server
                    </button>
                  )}
                </div>

                {/* Display saved VMs grouped by configuration (Ubuntu/OpenShift style) */}
                {savedOmniVMs.length > 0 && (
                  <div className="space-y-4 mb-6">
                    {(() => {
                      // Include the VM being edited in count display (if any)
                      const allVMsForDisplay = [...savedOmniVMs];
                      if (editingVMId && editingVMOriginal) {
                        allVMsForDisplay.push(editingVMOriginal);
                      }

                      const groups: { [key: string]: typeof savedOmniVMs } = {};
                      allVMsForDisplay.forEach((vm, index) => {
                        const configKey = `${vm.selectedServerIp}-${vm.selectedPool}-${vm.selectedNetworkSwitch}-${vm.cpu}-${vm.memoryGB}-${vm.diskSizeGB}`;
                        if (!groups[configKey]) {
                          groups[configKey] = [];
                        }
                        groups[configKey].push(vm);
                      });
                      return Object.entries(groups).map(([configKey, vms]) => {
                        const sampleVM = vms[0];
                        return (
                          <div
                            key={`${configKey}-${sampleVM.id}-${sampleVM.cpu}-${sampleVM.memoryGB}`}
                            className="bg-white border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              {/* OpenShift Pattern: Numbered circle + title + count controls */}
                              <div className="flex items-center space-x-3">
                                {/* Numbered circle */}
                                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                                  1
                                </div>
                                <h4 className="text-base font-medium text-gray-900">omniserver</h4>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center space-x-4">
                                <button
                                  onClick={() => handleEditVM(sampleVM)}
                                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    // Remove this group of VMs
                                    const vmIdsToRemove = vms.map((v) => v.id);
                                    const updatedVMs = savedOmniVMs.filter(
                                      (vm) => !vmIdsToRemove.includes(vm.id)
                                    );
                                    setSavedOmniVMs(updatedVMs);
                                  }}
                                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 text-sm text-gray-600 mb-4">
                              <div>
                                <span className="font-medium">Server:</span>{' '}
                                {sampleVM.selectedServerIp}
                              </div>
                              <div>
                                <span className="font-medium">CPU:</span> {sampleVM.cpu} CPU`&apos;`s
                              </div>
                              <div>
                                <span className="font-medium">Memory:</span> {sampleVM.memoryGB}GB
                              </div>
                              <div>
                                <span className="font-medium">Disk:</span> {sampleVM.diskSizeGB}GB
                              </div>
                              <div>
                                <span className="font-medium">Network:</span>{' '}
                                {sampleVM.selectedNetworkSwitch}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Inline VM Configuration Form (Ubuntu pattern) */}
                {isOmniVMModalOpen && (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {editingVMId ? 'Edit VM Configuration' : 'Add New VM'}
                      </h3>
                    </div>

                    <div className="px-4 sm:px-6 py-4 space-y-4">
                      {/* Server Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Server <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={currentOmniVMConfig.selectedServerIp}
                          onChange={async (e) => {
                            const selectedServerIp = e.target.value;
                            setCurrentOmniVMConfig((prev) => ({
                              ...prev,
                              selectedServerIp,
                              selectedNetworkSwitch: '', // Reset network switch when server changes
                            }));

                            // Fetch server-specific data when server is selected
                            if (selectedServerIp) {
                              await fetchServerResources(selectedServerIp);
                              await fetchNetworkSwitches(selectedServerIp);
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select server</option>
                          {availableServers.map((server) => (
                            <option key={server.ip} value={server.ip}>
                              {server.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Network Switch */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Network Switch <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={currentOmniVMConfig.selectedNetworkSwitch}
                          onChange={(e) =>
                            setCurrentOmniVMConfig((prev) => ({
                              ...prev,
                              selectedNetworkSwitch: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={!currentOmniVMConfig.selectedServerIp}
                        >
                          <option value="">Select switch</option>
                          {networkSwitches.map((switchName) => (
                            <option key={switchName} value={switchName}>
                              {switchName}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* VM Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          VM Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={currentOmniVMConfig.vm_name}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                          placeholder="omniserver"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          VM name is fixed as `&apos;`omniserver`&apos;`
                        </p>
                      </div>

                      {/* Hardware Configuration */}
                      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            CPU`&apos;`s <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="4"
                            value={currentOmniVMConfig.cpu}
                            onChange={(e) =>
                              setCurrentOmniVMConfig((prev) => ({
                                ...prev,
                                cpu: parseInt(e.target.value) || 4,
                              }))
                            }
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                              resourceValidationErrors['cpu']
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-gray-300 focus:ring-blue-500'
                            }`}
                          />
                          {/* Resource availability info */}
                          {currentOmniVMConfig.selectedServerIp &&
                            serverResources[currentOmniVMConfig.selectedServerIp] && (
                              <div className="bg-blue-50 p-2 rounded-md mt-1">
                                <p className="text-xs text-gray-700">
                                  <strong>Available Resources:</strong>{' '}
                                  {(() => {
                                    const serverData =
                                      serverResources[currentOmniVMConfig.selectedServerIp];
                                    const totalCpus = serverData.cpus || 0;
                                    const usedCpus = serverData.cpus_in_use || 0;

                                    // Calculate allocated CPUs from other saved VMs
                                    let allocatedCpus = 0;
                                    savedOmniVMs.forEach((vm) => {
                                      if (
                                        vm.selectedServerIp ===
                                          currentOmniVMConfig.selectedServerIp &&
                                        (!editingVMId || vm.id !== editingVMId)
                                      ) {
                                        allocatedCpus += vm.cpu || 0;
                                      }
                                    });

                                    const availableCpus = totalCpus - usedCpus - allocatedCpus;
                                    return `${availableCpus} CPUs available (${totalCpus} total - ${usedCpus} used - ${allocatedCpus} allocated)`;
                                  })()}
                                </p>
                              </div>
                            )}
                          {/* Validation error message */}
                          {resourceValidationErrors['cpu'] ? (
                            <p className="text-xs text-red-500 mt-1">
                              {resourceValidationErrors['cpu']}
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
                            min="8"
                            value={currentOmniVMConfig.memoryGB}
                            onChange={(e) =>
                              setCurrentOmniVMConfig((prev) => ({
                                ...prev,
                                memoryGB: parseInt(e.target.value) || 8,
                              }))
                            }
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                              resourceValidationErrors['memory']
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-gray-300 focus:ring-blue-500'
                            }`}
                          />
                          {/* Resource availability info */}
                          {currentOmniVMConfig.selectedServerIp &&
                            serverResources[currentOmniVMConfig.selectedServerIp] && (
                              <div className="bg-blue-50 p-2 rounded-md mt-1">
                                <p className="text-xs text-gray-700">
                                  <strong>Available Resources:</strong>{' '}
                                  {(() => {
                                    const serverData =
                                      serverResources[currentOmniVMConfig.selectedServerIp];
                                    const totalMemoryGB = Math.floor(
                                      (serverData.memory || 0) / 1024
                                    );
                                    const usedMemoryGB = Math.floor(
                                      (serverData.memory_in_use || 0) / 1024
                                    );

                                    // Calculate allocated memory from other saved VMs
                                    let allocatedMemoryGB = 0;
                                    savedOmniVMs.forEach((vm) => {
                                      if (
                                        vm.selectedServerIp ===
                                          currentOmniVMConfig.selectedServerIp &&
                                        (!editingVMId || vm.id !== editingVMId)
                                      ) {
                                        allocatedMemoryGB += vm.memoryGB || 0;
                                      }
                                    });

                                    const availableMemoryGB =
                                      totalMemoryGB - usedMemoryGB - allocatedMemoryGB;
                                    return `${availableMemoryGB}GB memory available (${totalMemoryGB}GB total - ${usedMemoryGB}GB used - ${allocatedMemoryGB}GB allocated)`;
                                  })()}
                                </p>
                              </div>
                            )}
                          {/* Validation error message */}
                          {resourceValidationErrors['memory'] ? (
                            <p className="text-xs text-red-500 mt-1">
                              {resourceValidationErrors['memory']}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-500 mt-1">Min: 8 GB for Omni</p>
                          )}
                        </div>

                        <div className="sm:col-span-1 md:col-span-2 lg:col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Disk Size (GB) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="40"
                            value={currentOmniVMConfig.diskSizeGB}
                            onChange={(e) =>
                              setCurrentOmniVMConfig((prev) => ({
                                ...prev,
                                diskSizeGB: parseInt(e.target.value) || 40,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">Min: 40 GB for Ubuntu</p>
                        </div>
                      </div>
                    </div>

                    {/* Form Footer */}
                    <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                      <button
                        onClick={cancelOmniVMOperation}
                        className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveOmniVM}
                        className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                      >
                        {editingVMId ? 'Update' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty state when no server configured */}
                {savedOmniVMs.length === 0 && !isOmniVMModalOpen && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <p className="text-gray-500">No Omni server configured</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Click `&apos;`Add Omni Server`&apos;` to configure your server
                    </p>
                  </div>
                )}
              </div>

              {/* Create Button */}
              <div className="border-t pt-6">
                <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                  <button
                    onClick={() => setCurrentPage('setup')}
                    className="w-full sm:w-auto px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateServer}
                    disabled={!isFormValid() || isCreatingServer}
                    className={`w-full sm:w-auto px-6 py-2 rounded-md font-medium transition-colors ${
                      isFormValid() && !isCreatingServer
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isCreatingServer ? 'Creating...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMainView = () => (
    <div className="min-h-screen max-h-screen bg-gray-50 p-3 sm:p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          {/* Main Section */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Provision VM with Omni ISO</h1>
            <p className="text-sm text-gray-600">
              Choose an action to configure your Omni environment
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4 mb-4">
              {/* Step 1: Keycloak */}
              <div className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    getCurrentPrerequisites().Keycloak
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-500 text-white'
                  }`}
                >
                  {getCurrentPrerequisites().Keycloak ? '✓' : '1'}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    getCurrentPrerequisites().Keycloak ? 'text-green-600' : 'text-blue-600'
                  }`}
                >
                  Keycloak
                </span>
              </div>

              {/* Arrow */}
              <div
                className={`w-6 h-0.5 ${
                  getCurrentPrerequisites().Keycloak ? 'bg-green-300' : 'bg-gray-300'
                }`}
              ></div>

              {/* Step 2: Certificates */}
              <div className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    getCurrentPrerequisites().Certs
                      ? 'bg-green-500 text-white'
                      : getCurrentPrerequisites().Keycloak
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {getCurrentPrerequisites().Certs ? '✓' : '2'}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    getCurrentPrerequisites().Certs
                      ? 'text-green-600'
                      : getCurrentPrerequisites().Keycloak
                        ? 'text-blue-600'
                        : 'text-gray-400'
                  }`}
                >
                  Certificates
                </span>
              </div>

              {/* Arrow */}
              <div
                className={`w-6 h-0.5 ${
                  getCurrentPrerequisites().Certs ? 'bg-green-300' : 'bg-gray-300'
                }`}
              ></div>

              {/* Step 3: Omni Server */}
              <div className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    getCurrentPrerequisites().OmniServer
                      ? 'bg-green-500 text-white'
                      : getCurrentPrerequisites().Keycloak && getCurrentPrerequisites().Certs
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {getCurrentPrerequisites().OmniServer ? '✓' : '3'}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    getCurrentPrerequisites().OmniServer
                      ? 'text-green-600'
                      : getCurrentPrerequisites().Keycloak && getCurrentPrerequisites().Certs
                        ? 'text-purple-600'
                        : 'text-gray-400'
                  }`}
                >
                  Omni Server
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons - Step-by-step navigation */}
          {!(
            getCurrentPrerequisites().Keycloak &&
            getCurrentPrerequisites().Certs &&
            getCurrentPrerequisites().OmniServer
          ) && (
            <div className="max-w-2xl mx-auto mb-8">
              {/* Step 1: Keycloak */}
              {currentStep === 'keycloak' && !getCurrentPrerequisites().Keycloak && (
                <div className="space-y-4">
                  <button
                    onClick={handleKeycloakClick}
                    className="w-full group p-6 border-2 border-blue-200 rounded-lg transition-all duration-200 text-left hover:border-blue-400 hover:bg-blue-50"
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
                        <h3 className="text-base font-semibold text-gray-900 mb-1">
                          Setup Keycloak
                        </h3>
                        <p className="text-xs text-gray-600">
                          Setup and configure Keycloak authentication
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 1 Completed - Show Next Button */}
              {currentStep === 'keycloak' && getCurrentPrerequisites().Keycloak && (
                <div className="text-center space-y-4">
                  <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
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
                          d="M9 12l2 2 4-4"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-green-900 mb-2">
                      Keycloak Setup Complete!
                    </h3>
                    <p className="text-sm text-green-700 mb-4">
                      Keycloak has been configured successfully. Click Next to proceed with
                      certificate upload.
                    </p>
                  </div>
                  <button
                    onClick={() => updateCurrentStep('certificates')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                  >
                    Next: Upload Certificates
                  </button>
                </div>
              )}

              {/* Step 2: Certificates */}
              {currentStep === 'certificates' && !getCurrentPrerequisites().Certs && (
                <div className="space-y-4">
                  <button
                    onClick={handleUploadCertificatesClick}
                    className="w-full group p-6 border-2 border-blue-200 rounded-lg transition-all duration-200 text-left hover:border-blue-400 hover:bg-blue-50"
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
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">
                          Upload Certificates
                        </h3>
                        <p className="text-xs text-gray-600">
                          Upload TLS certificates for Omni setup
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="text-center">
                    <button
                      onClick={() => updateCurrentStep('keycloak')}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                    >
                      ← Back to Keycloak
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 Completed - Show Next Button */}
              {currentStep === 'certificates' && getCurrentPrerequisites().Certs && (
                <div className="text-center space-y-4">
                  <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
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
                          d="M9 12l2 2 4-4"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-green-900 mb-2">
                      Certificates Uploaded!
                    </h3>
                    <p className="text-sm text-green-700 mb-4">
                      TLS certificates have been uploaded successfully. Click Next to setup the Omni
                      server.
                    </p>
                  </div>
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => updateCurrentStep('keycloak')}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => updateCurrentStep('omni-server')}
                      className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                    >
                      Next: Setup Omni Server
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Omni Server */}
              {currentStep === 'omni-server' && !getCurrentPrerequisites().OmniServer && (
                <div className="space-y-4">
                  <button
                    onClick={handleSetupOmniServerClick}
                    className="w-full group p-6 border-2 border-purple-200 rounded-lg transition-all duration-200 text-left hover:border-purple-400 hover:bg-purple-50"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200">
                        <svg
                          className="w-6 h-6 text-purple-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">
                          Setup Omni Server
                        </h3>
                        <p className="text-xs text-gray-600">
                          Configure and create your Omni server
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="text-center">
                    <button
                      onClick={() => updateCurrentStep('certificates')}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                    >
                      ← Back to Certificates
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 Completed - Show success message */}
              {currentStep === 'omni-server' && getCurrentPrerequisites().OmniServer && (
                <div className="text-center space-y-4">
                  <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
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
                          d="M9 12l2 2 4-4"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-green-900 mb-2">
                      Omni Server Setup Complete!
                    </h3>
                    <p className="text-sm text-green-700 mb-4">
                      Your Omni server has been configured successfully. All setup steps are now
                      complete.
                    </p>
                  </div>
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => updateCurrentStep('certificates')}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => updateCurrentPage('provision')}
                      className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                    >
                      Continue to Provision
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show success message when all steps are completed */}
          {getCurrentPrerequisites().Keycloak &&
            getCurrentPrerequisites().Certs &&
            getCurrentPrerequisites().OmniServer && (
              <div className="border-t pt-6">
                <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200 max-w-md mx-auto">
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
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-green-900 mb-2">Setup Complete!</h3>
                  <p className="text-sm text-green-700 mb-4">
                    All prerequisites have been completed successfully. Your Omni environment is
                    ready to use.
                  </p>
                </div>
              </div>
            )}

          {/* TLS Upload Section - Only show when upload certificates button is clicked */}
          {showUploadCertificatesSection && tlsCertsExist === false && (
            <div className="border-t pt-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Upload TLS Certificates</h2>
                <p className="text-sm text-gray-600">
                  Please upload your .crt and .key files to complete the setup
                </p>
              </div>

              <div className="max-w-2xl mx-auto space-y-4">
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
                        <h3 className="text-base font-medium text-gray-900 mb-2">
                          {uploadFile.type === 'cert'
                            ? 'Certificate File (.crt)'
                            : 'Key File (.key)'}
                        </h3>
                        {uploadFile.file ? (
                          <p className="text-sm text-green-600 font-medium">{uploadFile.name}</p>
                        ) : (
                          <p className="text-xs text-gray-600">
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
                    <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm text-blue-700">Uploading certificates...</p>
                  </div>
                )}

                {/* Create Button */}
                <div className="flex justify-center pt-4">
                  <button
                    onClick={handleUpload}
                    disabled={!isUploadReady || isUploading}
                    className={`px-6 py-2 text-sm rounded-md transition-colors ${
                      isUploadReady && !isUploading
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {currentPage === 'setup' ? renderMainView() : renderProvisionPage()}

      {/* Keycloak WebSocket Modal */}
      <KeycloakSetupModal isOpen={isKeycloakModalOpen} onClose={handleKeycloakModalClose} />

      {/* Omni Provision Modal with ISO functionality */}
      <OmniProvisionModal
        isOpen={isOmniProvisionModalOpen}
        onClose={() => setIsOmniProvisionModalOpen(false)}
      />
    </>
  );
}

// Keycloak WebSocket Modal Component
interface KeycloakSetupModalProps {
  isOpen: boolean;
  onClose: (wasDisconnected?: boolean) => void;
}

function KeycloakSetupModal({ isOpen, onClose }: KeycloakSetupModalProps) {
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number>(0);
  const [wasDisconnected, setWasDisconnected] = useState<boolean>(false);
  const [hadConnection, setHadConnection] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const logCounterRef = useRef<number>(0);
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAutoCloseCountdown = () => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
    }

    setAutoCloseCountdown(3);

    const countdownInterval = setInterval(() => {
      setAutoCloseCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          handleClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleClose = () => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
    }
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close(1000, 'User closed modal');
    }
    socketRef.current = null;
    setIsConnected(false);
    setAutoCloseCountdown(0);
    setStatusLogs([]);
    onClose(wasDisconnected);
    setWasDisconnected(false); // Reset for next time
    setHadConnection(false); // Reset for next time
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [statusLogs]);

  useEffect(() => {
    if (isOpen && (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED)) {
      setStatusLogs([]);
      setIsConnected(false);
      setHadConnection(false);
      setWasDisconnected(false);
      setAutoCloseCountdown(0);
      logCounterRef.current = 0;

      // Connect to Keycloak WebSocket
      const token = localStorage.getItem('accessToken');
      const wsUrl = `${envConfig().WS_PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/keycloak/setup?token=${token}`;

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          setHadConnection(true);
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

              // Check if this is a completion message and call omni_prereqs API
              if (
                messageText.toLowerCase().includes('installing base system') ||
                messageText.toLowerCase().includes('setup complete') ||
                (messageText.toLowerCase().includes('keycloak') &&
                  messageText.toLowerCase().includes('ready')) ||
                (messageText.toLowerCase().includes('keycloak') &&
                  messageText.toLowerCase().includes('running')) ||
                (messageText.toLowerCase().includes('jail') &&
                  messageText.toLowerCase().includes('keycloak') &&
                  messageText.toLowerCase().includes('running'))
              ) {
                // Call the omni_prereqs API
                const checkOmniPrereqs = async () => {
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

                      // Store the prerequisites result for the modal close handler
                      localStorage.setItem('omniPrerequisitesKeycloak', JSON.stringify(result));
                    } else {
                      // Set default values if API fails
                      localStorage.setItem(
                        'omniPrerequisitesKeycloak',
                        JSON.stringify({ Certs: false, Keycloak: false, OmniServer: false })
                      );
                    }
                  } catch (error) {
                    logger.error('Error calling omni_prereqs API:', error);
                    // Set default values if error occurs
                    localStorage.setItem(
                      'omniPrerequisitesKeycloak',
                      JSON.stringify({ Certs: false, Keycloak: false, OmniServer: false })
                    );
                  }
                };

                // Call the API function
                checkOmniPrereqs();
              }
            }

            // Only log messages, don't trigger auto-close based on message content
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
          const previouslyConnected = isConnected;
          setIsConnected(false);
          socketRef.current = null;

          // Only auto-close if we had an established connection that got disconnected
          // and it wasn't a normal close (code 1000 is normal closure)
          if (hadConnection && previouslyConnected && event.code !== 1000) {
            setWasDisconnected(true);
            startAutoCloseCountdown();
          }
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
    }

    // Cleanup WebSocket when modal closes
    return () => {
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        socketRef.current.close(1000, 'Modal closed');
        socketRef.current = null;
      }
      setIsConnected(false);
      setAutoCloseCountdown(0);
    };
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Keycloak Setup Monitor" width="700px">
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

        {/* Auto-close countdown notification */}
        {autoCloseCountdown > 0 && (
          <div className="flex items-center justify-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">
                Closing automatically in {autoCloseCountdown} seconds...
              </span>
            </div>
          </div>
        )}

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

        {/* Action Buttons */}
        <div className="flex justify-between gap-3">
          <button
            onClick={() => {
              setStatusLogs([]);
              logCounterRef.current = 0;
              logCounterRef.current += 1;
              setStatusLogs((prev) => [
                ...prev,
                {
                  id: logCounterRef.current,
                  message: `🔄 Log cleared by user`,
                  timestamp: new Date().toLocaleTimeString(),
                  isSystemMessage: true,
                },
              ]);
            }}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Clear Log
          </button>

          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
