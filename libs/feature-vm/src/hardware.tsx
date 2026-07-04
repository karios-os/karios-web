import React, { useState, useEffect, useCallback, FC, JSX, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { FaMicrochip } from 'react-icons/fa';
import { BsPciCardNetwork, BsGpuCard, BsFillNvmeFill } from 'react-icons/bs';
import {
  useVm,
  useServer,
  useApprovalFlow,
  ApprovalModal,
  useAppState,
  attachNetworkSwitch as attachNetworkSwitchService,
  updateNetworkSwitch as updateNetworkSwitchService,
  updateVmHardware as updateVmHardwareService,
} from '@karios-monorepo/shared-state';
import { toast } from 'react-toastify';

import { Refresh, Warning2 } from 'iconsax-react';

// Import reusable components
import VMDetailsCard from './components/VMDetailsCard';
import ClusterDetailsCard from './components/ClusterDetailsCard';
import CDDVDSection from './components/CDDVDSection';
import NetworkSection from './components/NetworkSection';
import PCIeDevicesSection from './components/PCIeDevicesSection';

import { Modal } from '@karios-monorepo/shared-state';

// Import helper functions and hooks
import { isClusterVM } from './utils/hardwareHelpers';

import {
  useVmInfo,
  useClusterDetails,
  useNodeInfo,
  usePcieDevices,
  useNetworkSwitches,
  useUnusedDisks,
} from './utils/hardwareHooks';

import {
  attachPcieDevices,
  detachPcieDevice,
  getAttachedPcieDevices,
} from './utils/pcieService';
const VmNetworkManager: FC = (): JSX.Element => {
  const { selectedVm } = useVm();
  const { selectedServer } = useServer();
  const { state, dispatch } = useAppState();
  const { fetchVMsForServer } = useAppState();
  const { executeWithApproval, isModalOpen, modalProps } = useApprovalFlow();

  // Use custom hooks for state management
  const {
    vmDetails,
    setVmDetails,
    networkInterfaces,
    interfacesWithPorts,
    datastore,
    isLoading,
    error,
    getVmInfo,
    getVmInfoRef,
    stableServerAddress,
  } = useVmInfo(selectedServer, selectedVm);

  const { getClusterDetails, isLoadingClusterDetails } = useClusterDetails(
    selectedServer,
    selectedVm,
    dispatch
  );

  const {
    nodeInfo,
    maxCpus,
    maxMemoryGB,
    maxSockets,
    isLoadingNodeInfo,
    resourceInfo,
    loadNodeInfo,
  } = useNodeInfo(selectedServer, selectedVm);

  const {
    pcieInventory,
    pcieLoading,
    pcieError,
    pcieSliceable,
    selectedPcieDevices,
    setSelectedPcieDevices,
    loadPcieDevices,
    loadSystemInfo,
  } = usePcieDevices(selectedServer, selectedVm);

  const {
    networkDrivers,
    switchesWithPorts,
    loadSwitchInfo,
    fetchNetworkData,
  } = useNetworkSwitches(selectedServer);


  // Local UI state
  const [selectedSection, setSelectedSection] = useState('All');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateCpu, setUpdateCpu] = useState<number | string>(0);
  const [updateMemory, setUpdateMemory] = useState<number | string>(0);
  const [updateSockets, setUpdateSockets] = useState<number | string>(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [networkFormOpen, setNetworkFormOpen] = useState(false);
  const [showSwitchForm, setShowSwitchForm] = useState(false);
  const [attachDrive, setAttachDrive] = useState(false);
  const [attachdisk, setAttachdisk] = useState(false);
  const [showPcieForm, setShowPcieForm] = useState(false);

  // PCIe state
  const [showAttachConfirmation, setShowAttachConfirmation] = useState(false);
  const [devicesToConfirm, setDevicesToConfirm] = useState<any[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const [showIntegratedWarning, setShowIntegratedWarning] = useState(false);
  const [integratedDevicesToConfirm, setIntegratedDevicesToConfirm] = useState<any[]>([]);
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const [showDetachConfirmation, setShowDetachConfirmation] = useState(false);
  const [detachDeviceToConfirm, setDetachDeviceToConfirm] = useState<any>(null);
  const [isPciePending, setIsPciePending] = useState(false);

  // Network form state
  const [formMode, setFormMode] = useState<'attach' | 'update' | null>(null);
  const [interfaceToUpdate, setInterfaceToUpdate] = useState<number | null>(null);

  // Refs for debouncing and preventing duplicate calls
  const lastVmInfoRefreshRef = useRef<number>(0);

  // Logger utility
  const logger = {
    debug: (msg: string, data?: any) => console.debug(msg, data),
    warn: (msg: string, err?: any) => console.warn(msg, err),
    error: (msg: string, err?: any) => console.error(msg, err),
  };

  const [previousVmState, setPreviousVmState] = useState<string | null>(null);

  // Permissions
  const canViewVM = true;
  const canViewNetwork = true;

  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [selectedSwitch, setSelectedSwitch] = useState<string>('');

  const [switchInfoCache, setSwitchInfoCache] = useState<Record<string, any>>({});

  // Clear cache when server changes
  useEffect(() => {
    setSwitchInfoCache({});
  }, [selectedServer]);
  // Handle opening the update modal and populating fields
  const handleOpenUpdateModal = async (): Promise<void> => {
    if (vmDetails) {
      try {
        // First, refresh the VM list to get the latest UUID for this VM
        if (selectedServer) {
          await fetchVMsForServer(selectedServer);
        }

        // Also refresh VM details to ensure we have the latest UUID
        await getVmInfo(false);

        // Parse current values from vmDetails
        setUpdateCpu(parseInt(vmDetails.cpu) || 0);
        setUpdateSockets(parseInt(vmDetails.sockets) || 1);

        // Parse memory - remove 'G' suffix if present
        const memoryValue =
          typeof vmDetails.memory === 'string'
            ? parseInt(vmDetails.memory.replace(/G$/i, ''))
            : parseInt(vmDetails.memory) || 0;
        setUpdateMemory(memoryValue);

        // Fetch node information for restrictions
        await loadNodeInfo();

        setShowUpdateModal(true);
      } catch (error) {
        toast.error('Failed to prepare VM update. Please try again.');
      }
    }
  };

  // Handle VM update API call
  const handleVmUpdate = async (): Promise<void> => {
    if (!selectedVm?.name || !vmDetails?.datastore) {
      toast.error('Missing VM name or datastore information');
      return;
    }

    // Validate against node restrictions
    if (nodeInfo) {
      if (typeof updateCpu === 'number' && updateCpu > maxCpus) {
        toast.error(`CPU cores cannot exceed ${maxCpus}`);
        return;
      }
      if (typeof updateSockets === 'number' && updateSockets > maxSockets) {
        toast.error(`Sockets cannot exceed ${maxSockets}`);
        return;
      }
      if (typeof updateMemory === 'number' && updateMemory > maxMemoryGB) {
        toast.error(`Memory cannot exceed ${maxMemoryGB} GB`);
        return;
      }
    }

    // Execute update with approval flow
    await executeWithApproval(async (approver?: string) => {
      setIsUpdating(true);

      try {
        // Get VM UUID for the payload
        const vmUuid = vmDetails['vm-uuid'] || vmDetails?.uuid || '';

        const payload: any = {
          vm_name: selectedVm.name,
          sockets: updateSockets,
          cpu: updateCpu,
          memory: `${updateMemory}G`,
          datastore: vmDetails.datastore,
        };

        // Add UUID if available
        if (vmUuid) {
          payload.vm_uuid = vmUuid;
        }

        // Build URL with approver as query parameter if provided
        const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
        await updateVmHardwareService(serverAddress, payload, approver);

        toast.success(`VM ${selectedVm.name} updated successfully!`);
        setShowUpdateModal(false);

        // Refresh VM list using the same pattern as start/stop operations
        if (selectedServer) {
          await fetchVMsForServer(selectedServer);
        }

        // Refresh VM details to show updated values
        await getVmInfo(false);
      } catch (error) {
        toast.error(
          `Failed to update VM: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        setIsUpdating(false);
      }
    }, 'Update VM Configuration');
  };

  // Store getVmInfo in ref to avoid dependency cycles
  useEffect(() => {
    getVmInfoRef.current = getVmInfo;
  }, [getVmInfo]);

  // Throttled VM info refresh to prevent excessive API calls
  const throttledVmInfoRefresh = useCallback(
    (force: boolean, reason: string) => {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastVmInfoRefreshRef.current;
      const minInterval = 5000; // Longer interval during migration


      // Only refresh if enough time has passed or if forced for migration completion
      if (
        (force && (reason.includes('100% completed') || reason.includes('fully completed'))) ||
        timeSinceLastRefresh >= minInterval
      ) {
        lastVmInfoRefreshRef.current = now;
        return getVmInfo(true, reason);
      }

      return Promise.resolve();
    },
    [lastVmInfoRefreshRef, getVmInfo]
  );

  useEffect(() => {
    if (!stableServerAddress || !selectedVm?.name) {
      logger.debug('Load VM effect skipped - missing params', {
        hasServer: !!stableServerAddress,
        hasVm: !!selectedVm?.name,
      });
      return;
    }

    // Fetch VM data and cluster details
    const loadVmData = async () => {
      try {
        await getVmInfo(false, 'initial-load');
        if (isClusterVM(selectedVm.name)) {
          await getClusterDetails();
        }
      } catch (err) {
        logger.error('Failed to load VM data', err);
      }
    };

    loadVmData();
  }, [selectedVm?.name, stableServerAddress]);

  // Listen for refresh event from top bar
  useEffect(() => {
    const handleRefreshHardwarePage = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { vmName: eventVmName, serverAddress: eventServerAddress } = customEvent.detail;

      // Only refresh if it's for this VM
      if (eventVmName === selectedVm?.name && eventServerAddress === stableServerAddress) {
        try {
          // Refresh all hardware page data - all API calls
          // These correspond to the API calls shown in the network tab:
          // - info (getVmInfo)
          // - pci_devices (loadPcieDevices)
          // - get_pci_sliceable (called within loadPcieDevices)
          // - inventory (loadSystemInfo)
          // - switch_info (called within getVmInfo for each interface, and fetchNetworkData for all switches)

          // VM info (info endpoint) - this also fetches switch_info for each interface
          await getVmInfo(false, 'manual-refresh');

          // Cluster details (if cluster VM)
          if (isClusterVM(selectedVm.name)) {
            await getClusterDetails();
          }

          // Node info
          if (loadNodeInfo) {
            await loadNodeInfo();
          }

          // PCIe devices (pci_devices endpoint) - this also fetches get_pci_sliceable
          if (loadPcieDevices) {
            await loadPcieDevices();
          }

          // System info (inventory endpoint)
          if (loadSystemInfo) {
            await loadSystemInfo();
          }

          // Network data (fetchNetworkDrivers and fetchVmNetworkSwitches with switch_info for each)
          // This fetches all network switches and their info
          if (fetchNetworkData) {
            await fetchNetworkData(true);
          }
        } catch (err) {
          logger.error('Failed to refresh hardware page data', err);
        }
      }
    };

    window.addEventListener('refreshHardwarePage', handleRefreshHardwarePage);

    return () => {
      window.removeEventListener('refreshHardwarePage', handleRefreshHardwarePage);
    };
  }, [
    selectedVm?.name,
    stableServerAddress,
    getVmInfo,
    getClusterDetails,
    loadNodeInfo,
    loadPcieDevices,
    loadSystemInfo,
    loadSwitchInfo,
    fetchNetworkData,
  ]);

  // Load PCIe Devices and System Info when VM is selected
  // Note: Node Info not needed as same data comes from VM info call
  useEffect(() => {
    if (!stableServerAddress || !selectedVm?.name) {
      return;
    }

    // Load PCIe devices for hardware configuration
    loadPcieDevices();
    loadSystemInfo();
  }, [selectedVm?.name, stableServerAddress, loadPcieDevices, loadSystemInfo]);

  // Network drivers and switches - only fetch when user actually needs network functionality
  useEffect(() => {
    if (!stableServerAddress) return;

    // Fetch network drivers and switches when user is working with network features
    if (networkFormOpen || showSwitchForm || selectedSection === 'Network') {
      fetchNetworkData(true);
    }
  }, [stableServerAddress, networkFormOpen, showSwitchForm, selectedSection, fetchNetworkData]);

  // PCIe devices and System info fetch on server change - consolidated to prevent triple calls
  useEffect(() => {
    if (!stableServerAddress) {
      logger.debug('PCIe/System fetch skipped - no server address');
      return;
    }

    loadPcieDevices();
    loadSystemInfo();
  }, [stableServerAddress, loadPcieDevices, loadSystemInfo]);

  // System info fetch effect for model_name detection
  // REMOVED - consolidated into PCIe devices effect above

  // Track VM state changes to detect migration completion
  useEffect(() => {
    const currentState = selectedVm?.state;
    const migrationRelatedStates = ['migrating', 'transferring', 'transferred'];

    // If VM state changed from any migration-related state to a non-migration state
    if (
      previousVmState &&
      migrationRelatedStates.includes(previousVmState) &&
      currentState &&
      !migrationRelatedStates.includes(currentState)
    ) {
      // Refresh VM details to get updated disk information
      const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
      if (serverAddress && selectedVm?.name) {
        throttledVmInfoRefresh(
          true,
          'migration completed - VM state changed from ' + previousVmState + ' to ' + currentState
        )
          .then(() => {
            // VM disk data refreshed
          })
          .catch((error) => {
            // Failed to refresh VM disk data
          });
      }
    }

    // Update previous state for next comparison
    setPreviousVmState(currentState || null);
  }, [
    selectedVm?.state,
    selectedServer?.ip,
    selectedServer?.fqdn,
    selectedVm?.name,
    previousVmState,
  ]);

 
  // Listen for cluster VM operation events to refresh cluster details immediately
  useEffect(() => {
    if (!selectedVm?.name || !isClusterVM(selectedVm.name)) {
      return undefined; // Explicit return for non-cluster VMs
    }

    const handleClusterVmOperation = (event: any) => {
      const { operation, vmName, clusterName } = event.detail || {};

      if (operation === 'delete') {
        // Small delay to ensure backend processing is complete, then immediate refresh
        setTimeout(() => {
          getClusterDetails();
        }, 500);
      }
    };

    window.addEventListener('clusterVmOperation', handleClusterVmOperation);

    return () => {
      window.removeEventListener('clusterVmOperation', handleClusterVmOperation);
    };
  }, [selectedVm?.name]); // Removed getClusterDetails dependency to prevent loop

  const handleSwitchAction = () => {
    if (!selectedSwitch || !selectedDriver) {
      toast.error('Please select a switch and network driver.');
      return;
    }

    if (formMode === 'update' && interfaceToUpdate === null) {
      toast.error('Please select an interface number for update.');
      return;
    }

    if (!vmDetails?.datastore) {
      toast.error('VM datastore info missing.');
      return;
    }
    const payload = {
      vm_name: selectedVm.name,
      switch_name: selectedSwitch,
      network_driver: selectedDriver,
      datastore: vmDetails.datastore,
      network_interface_number:
        formMode === 'attach' ? networkInterfaces.length : interfaceToUpdate,
    };

    if (formMode === 'attach') {
      const existingSwitch = networkInterfaces.find((i) => i['virtual-switch'] === selectedSwitch);
      if (existingSwitch) {
        toast.warning('Switch already exists. Choose a different one.');
        return;
      }

      attachNetworkSwitchService(selectedServer?.fqdn || selectedServer.ip, payload)
        .then(() => {
          toast.success('Switch attached successfully!');
          fetchAttachedSwitches();
          setShowSwitchForm(false);
        })
        .catch(() => {
          toast.error('An error occurred while attaching the switch.');
        });
    } else {
      const targetInterface = networkInterfaces.find((iface) => iface.number === interfaceToUpdate);
      if (
        targetInterface &&
        targetInterface['virtual-switch'] === selectedSwitch &&
        targetInterface['driver'] === selectedDriver
      ) {
        toast.warning(
          'This switch and driver are already assigned to the selected interface. Please choose a different switch.'
        );
        return;
      }

      updateNetworkSwitchService(selectedServer?.fqdn || selectedServer.ip, payload)
        .then(() => {
          toast.success('Switch updated successfully!');
          fetchAttachedSwitches();
          setShowSwitchForm(false);
        })
        .catch((err) => {
          toast.error('An error occurred while updating the switch.');
        });
    }
  };


  // Helper function to refresh attached switches
  const fetchAttachedSwitches = useCallback((): void => {
    getVmInfo(false, 'network-update').catch((err) => {
      logger.warn('Failed to refresh attached switches', err);
    });
  }, [getVmInfo]);

  // PCIe handler functions
  const handleAttachPcie = (): void => {
    if (selectedPcieDevices.length === 0) {
      toast.error('Select at least one PCIe device to attach');
      return;
    }

    // Map selected BDFs to actual device information
    const devicesToAttach: any[] = [];
    const integratedDevices: any[] = [];

    Object.entries(pcieInventory || {}).forEach(([key, device]: [string, any]) => {
      if (!device?.funcs) return;

      Object.entries(device.funcs).forEach(([funcKey, func]: [string, any]) => {
        if (selectedPcieDevices.includes(func.bdf)) {
          const deviceInfo = {
            key,
            funcKey,
            bdf: func.bdf,
            name: device.name || key,
            vendor: device.vendor || 'Unknown',
            device: func.device || 'Unknown',
            isIntegrated: device.integrated || false,
          };

          if (device.integrated) {
            integratedDevices.push(deviceInfo);
          } else {
            devicesToAttach.push(deviceInfo);
          }
        }
      });
    });

    setDevicesToConfirm(devicesToAttach);
    setIntegratedDevicesToConfirm(integratedDevices);

    if (integratedDevices.length > 0) {
      setShowIntegratedWarning(true);
    } else {
      setShowAttachConfirmation(true);
    }
  };

  const handlePcieGroupToggle = (deviceKey: string): void => {
    const device = pcieInventory?.[deviceKey];
    if (!device) return;

    const isSelected = selectedPcieDevices.some((bdf) =>
      Object.values(device.funcs || {}).some((fn: any) => fn.bdf === bdf)
    );

    if (isSelected) {
      setSelectedPcieDevices((prev) =>
        prev.filter((bdf) => !Object.values(device.funcs || {}).some((fn: any) => fn.bdf === bdf))
      );
    } else {
      setSelectedPcieDevices((prev) => [
        ...prev,
        ...Object.values(device.funcs || {}).map((fn: any) => fn.bdf),
      ]);
    }
  };

  const toggleDeviceExpansion = (deviceKey: string): void => {
    setExpandedDevices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(deviceKey)) {
        newSet.delete(deviceKey);
      } else {
        newSet.clear();
        newSet.add(deviceKey);
      }
      return newSet;
    });
  };

  const confirmAttachPcie = async (): Promise<void> => {
    try {
      if (!selectedServer || !selectedVm || !vmDetails?.datastore) {
        toast.error('Missing required information for PCIe attachment');
        return;
      }

      // Build PcieDeviceGroup array from devicesToConfirm
      const groupsToAttach = devicesToConfirm.reduce((acc: any[], device: any) => {
        // Find or create group for this device
        let group = acc.find((g: any) => g.key === device.key);

        if (!group) {
          group = {
            key: device.key,
            name: device.name,
            vendor: device.vendor,
            category:
              availableGroupedPcieDevices.find((d: any) => d.key === device.key)?.category ||
              'other',
            funcs: [],
            allBdfs: [],
          };
          acc.push(group);
        }

        // Add function to group
        const funcData = pcieInventory?.[device.key]?.funcs?.[device.funcKey];
        if (funcData) {
          group.funcs.push({ ...funcData, bdf: device.bdf });
          if (!group.allBdfs.includes(device.bdf)) {
            group.allBdfs.push(device.bdf);
          }
        }

        return acc;
      }, []);

      const serverAddress = selectedServer.fqdn || selectedServer.ip;

      // Make API call to attach devices
      await attachPcieDevices(serverAddress, selectedVm.name, groupsToAttach, vmDetails.datastore);

      // Clear selections and refresh data
      setSelectedPcieDevices([]);
      setShowAttachConfirmation(false);

      // Refresh PCIe inventory
      await loadPcieDevices();
    } catch (error) {
      logger.error('Failed to attach PCIe devices', error);
      toast.error(
        `Failed to attach PCIe devices: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const confirmDetachPcie = async (): Promise<void> => {
    try {
      if (!detachDeviceToConfirm || !selectedServer || !selectedVm || !vmDetails?.datastore) {
        toast.error('Missing required information for PCIe detachment');
        return;
      }

      const { bdf, key, name, vendor, category, funcs, allBdfs } = detachDeviceToConfirm;
      const serverAddress = selectedServer.fqdn || selectedServer.ip;

      // Build the group data for the API call
      const groupData: any = {
        key,
        name,
        vendor,
        category,
        funcs,
        allBdfs,
      };

      // Call the detach API
      await detachPcieDevice(serverAddress, selectedVm.name, groupData, bdf, vmDetails.datastore);

      // Clear selections and refresh data
      setDetachDeviceToConfirm(null);
      setShowDetachConfirmation(false);

      // Refresh PCIe inventory
      await loadPcieDevices();
    } catch (error) {
      logger.error('Failed to detach PCIe device', error);
      toast.error(
        `Failed to detach PCIe device: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleDetachPcie = async (bdf: string): Promise<void> => {
    try {
      // Find the device group that contains this BDF
      let deviceGroup = null;
      let deviceKey = null;

      Object.entries(pcieInventory || {}).forEach(([key, device]: [string, any]) => {
        if (!device?.funcs) return;

        const hasFunc = Object.values(device.funcs).some((func: any) => func.bdf === bdf);
        if (hasFunc) {
          deviceKey = key;
          deviceGroup = inUseGroupedPcieDevices.find((d: any) => d.key === key);
        }
      });

      if (!deviceGroup || !deviceKey) {
        toast.error('Device not found');
        return;
      }

      // Set the device to be detached and show confirmation
      setDetachDeviceToConfirm({
        deviceKey,
        bdf,
        ...deviceGroup, // Flatten the group data so all properties are accessible
      });

      setShowDetachConfirmation(true);
    } catch (error) {
      logger.error('Failed to prepare PCIe detach', error);
      toast.error('Failed to prepare PCIe detach');
    }
  };

  const confirmIntegratedDeviceWarning = (): void => {
    setShowIntegratedWarning(false);
    setShowAttachConfirmation(true);
  };

  // Process PCIe inventory into grouped devices
  const processPcieDevices = (): { available: any[]; inUse: any[] } => {
    if (!pcieInventory) {
      return { available: [], inUse: [] };
    }

    const available: any[] = [];
    const inUse: any[] = [];

    Object.entries(pcieInventory).forEach(([key, device]: [string, any]) => {
      if (!device) return;

      // Convert funcs object to array
      const funcsArray = Object.entries(device.funcs || {}).map(
        ([funcKey, func]: [string, any]) => ({
          ...func,
          key: funcKey,
        })
      );

      const groupedDevice = {
        key,
        name: device.name || key,
        vendor: device.vendor || 'Unknown',
        category: device.category || 'other',
        funcs: funcsArray,
        allBdfs: funcsArray.map((fn: any) => fn.bdf),
        isSliceable: pcieSliceable?.[key]?.sliceable || false,
        isIntegrated: funcsArray.some((fn: any) => fn.is_integrated === true),
      };

      // If device has any functions attached to VMs, it's in use
      // Check guest_vms array which contains VM names using the device
      const hasAttachedFuncs = funcsArray.some(
        (fn: any) => fn.guest_vms && Array.isArray(fn.guest_vms) && fn.guest_vms.length > 0
      );

      if (hasAttachedFuncs) {
        inUse.push(groupedDevice);
      } else {
        available.push(groupedDevice);
      }
    });

    return { available, inUse };
  };

  const { available: availableGroupedPcieDevices, inUse: inUseGroupedPcieDevices } =
    processPcieDevices();
  const groupedAttachedPcie: any[] = selectedVm?.name
    ? getAttachedPcieDevices(pcieInventory, selectedVm.name)
    : [];

  return (
    <div
      className={
        selectedSection === 'All'
          ? 'grid grid-cols-1 lg:grid-cols-2 gap-3 w-full bg-white p-0'
          : 'flex flex-col space-y-3 w-full bg-white p-0'
      }
    >
      <div className="flex items-center justify-between col-span-full mb-0">
        <h1 className="font-semibold text-lg sm:text-xl text-gray-800">
          {selectedSection === 'All' ? 'Resources Overview' : selectedSection}
        </h1>
      </div>

      {/* Loading/Error state */}
      {isLoading && !vmDetails && (
        <div className="flex items-center justify-center p-8 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <Refresh className="animate-spin" size={24} color="#3B82F6" />
            <p className="text-gray-600">Loading VM details...</p>
          </div>
        </div>
      )}

      {error && !isLoading && !vmDetails && (
        <div className="flex items-center justify-center p-8 bg-white rounded-xl border border-red-200">
          <div className="flex flex-col items-center gap-3">
            <p className="text-red-600 font-medium">Error loading VM details</p>
            <button
              onClick={() => getVmInfo(false)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* === CLUSTER DETAILS === */}
      {(selectedSection === 'All' ||
        selectedSection === 'VM Details' ||
        selectedSection === 'Cluster Details') &&
        canViewVM &&
        selectedVm?.name &&
        isClusterVM(selectedVm.name) && (
          <ClusterDetailsCard
            selectedVmDetails={state.selectedVmDetails}
            isLoadingClusterDetails={isLoadingClusterDetails}
          />
        )}

      {/* === VM DETAILS === */}
      {(selectedSection === 'All' || selectedSection === 'VM Details') &&
        canViewVM &&
        vmDetails && (
          <VMDetailsCard
            vmDetails={vmDetails}
            onUpdateClick={handleOpenUpdateModal}
          />
        )}

      {(selectedSection === 'All' || selectedSection === 'CD/DVD Drive') &&
        canViewVM &&
        vmDetails && (
          <CDDVDSection
            vmDetails={vmDetails}
            selectedVm={selectedVm}
            selectedServer={selectedServer}
            attachDrive={attachDrive}
            setAttachDrive={setAttachDrive}
            setVmDetails={setVmDetails}
            getVmInfo={getVmInfo}
          />
        )}

      {/* === NETWORK === */}
      {(selectedSection === 'All' || selectedSection === 'Network') && canViewNetwork && (
        <NetworkSection
          selectedVm={selectedVm}
          selectedServer={selectedServer}
          interfacesWithPorts={interfacesWithPorts}
          networkDrivers={networkDrivers}
          switchesWithPorts={switchesWithPorts}
          datastore={datastore}
          onRefresh={fetchAttachedSwitches}
          onFormVisibilityChange={setNetworkFormOpen}
        />
      )}

      {/* Update VM Modal */}
      <Modal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        title="Update VM Configuration"
      >
        <div className="space-y-6">
          {isLoadingNodeInfo ? (
            <div className="flex items-center justify-center p-8">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-karios-blue"></div>
                <p className="text-gray-600">Loading server specifications...</p>
              </div>
            </div>
          ) : (
            <>
              {resourceInfo.isClusterVM && (
                <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> Available resources shown below exclude usage by other
                    VMs in cluster &quot;{resourceInfo.clusterName}&quot; to prevent
                    over-allocation.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Sockets:
                    {maxSockets > 0 && (
                      <span className="text-sm text-gray-500 ml-1">(Max: {maxSockets})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={maxSockets || 32}
                    value={updateSockets}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string for user to clear and retype
                      if (value === '') {
                        setUpdateSockets('');
                      } else {
                        const numValue = parseInt(value);
                        if (!isNaN(numValue)) {
                          setUpdateSockets(numValue);
                        }
                      }
                    }}
                    className={`w-full p-3 border rounded-md focus:outline-none ${
                      updateSockets === '' ||
                      (typeof updateSockets === 'number' &&
                        (updateSockets < 1 || (maxSockets > 0 && updateSockets > maxSockets)))
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-gray-300 focus:border-karios-blue'
                    }`}
                  />
                  {updateSockets === '' && (
                    <p className="text-red-500 text-xs mt-1">Sockets value is required</p>
                  )}
                  {typeof updateSockets === 'number' && updateSockets < 1 && (
                    <p className="text-red-500 text-xs mt-1">Minimum value is 1</p>
                  )}
                  {typeof updateSockets === 'number' &&
                    maxSockets > 0 &&
                    updateSockets > maxSockets && (
                      <p className="text-red-500 text-xs mt-1">Maximum value is {maxSockets}</p>
                    )}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    CPU:
                    {maxCpus > 0 && (
                      <span className="text-sm text-gray-500 ml-1">(Max: {maxCpus})</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={updateCpu}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string for user to clear and retype
                      if (value === '') {
                        setUpdateCpu('');
                      } else {
                        // Only allow numeric input
                        const numValue = parseInt(value);
                        if (!isNaN(numValue)) {
                          setUpdateCpu(numValue);
                        }
                      }
                    }}
                    className={`w-full p-3 border rounded-md focus:outline-none ${
                      updateCpu === '' ||
                      (typeof updateCpu === 'number' &&
                        (updateCpu < 1 || (maxCpus > 0 && updateCpu > maxCpus)))
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-gray-300 focus:border-karios-blue'
                    }`}
                  />
                  {updateCpu === '' && (
                    <p className="text-red-500 text-xs mt-1">CPU value is required</p>
                  )}
                  {typeof updateCpu === 'number' && updateCpu < 1 && (
                    <p className="text-red-500 text-xs mt-1">Minimum value is 1</p>
                  )}
                  {typeof updateCpu === 'number' && maxCpus > 0 && updateCpu > maxCpus && (
                    <p className="text-red-500 text-xs mt-1 font-semibold">
                      CPU cannot exceed {maxCpus}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Memory (GB):
                  {maxMemoryGB > 0 && (
                    <span className="text-sm text-gray-500 ml-1">(Max: {maxMemoryGB} GB)</span>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxMemoryGB || 1024}
                  value={updateMemory}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty string for user to clear and retype
                    if (value === '') {
                      setUpdateMemory('');
                    } else {
                      const numValue = parseInt(value);
                      if (!isNaN(numValue)) {
                        setUpdateMemory(numValue);
                      }
                    }
                  }}
                  className={`w-full p-3 border rounded-md focus:outline-none ${
                    updateMemory === '' ||
                    (typeof updateMemory === 'number' &&
                      (updateMemory < 1 || (maxMemoryGB > 0 && updateMemory > maxMemoryGB)))
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-gray-300 focus:border-karios-blue'
                  }`}
                />
                {updateMemory === '' && (
                  <p className="text-red-500 text-xs mt-1">Memory value is required</p>
                )}
                {typeof updateMemory === 'number' && updateMemory < 1 && (
                  <p className="text-red-500 text-xs mt-1">Minimum value is 1 GB</p>
                )}
                {typeof updateMemory === 'number' &&
                  maxMemoryGB > 0 &&
                  updateMemory > maxMemoryGB && (
                    <p className="text-red-500 text-xs mt-1">Maximum value is {maxMemoryGB} GB</p>
                  )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  disabled={isUpdating}
                  className="px-6 py-2 bg-white text-gray-700 font-medium rounded-md hover:bg-gray-100 transition-colors border-2 border-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVmUpdate}
                  disabled={
                    isUpdating ||
                    isLoadingNodeInfo ||
                    updateSockets === '' ||
                    updateCpu === '' ||
                    updateMemory === '' ||
                    (typeof updateSockets === 'number' &&
                      (updateSockets < 1 || (maxSockets > 0 && updateSockets > maxSockets))) ||
                    (typeof updateCpu === 'number' &&
                      (updateCpu < 1 || (maxCpus > 0 && updateCpu > maxCpus))) ||
                    (typeof updateMemory === 'number' &&
                      (updateMemory < 1 || (maxMemoryGB > 0 && updateMemory > maxMemoryGB)))
                  }
                  className="px-6 py-2 bg-karios-blue text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <FaMicrochip size={16} />
                      Update VM
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {(selectedSection === 'All' || selectedSection === 'PCIe Devices') && canViewVM && (
        <PCIeDevicesSection
          selectedVm={selectedVm}
          pcieLoading={pcieLoading}
          pcieError={pcieError}
          groupedAttachedPcie={groupedAttachedPcie}
          showPcieForm={showPcieForm}
          setShowPcieForm={setShowPcieForm}
          availableGroupedPcieDevices={availableGroupedPcieDevices}
          inUseGroupedPcieDevices={inUseGroupedPcieDevices}
          expandedDevices={expandedDevices}
          selectedPcieDevices={selectedPcieDevices}
          isPciePending={isPciePending}
          onDetachPcie={handleDetachPcie}
          onAttachPcie={handleAttachPcie}
          onToggleGroupSelection={handlePcieGroupToggle}
          onToggleExpansion={toggleDeviceExpansion}
          isPhysicalFunctionWithExistingVfs={() => false}
          onAttachConfirm={confirmAttachPcie}
          isAttaching={isPciePending}
        />
      )}

      {/* === UNATTACHED DISK SECTION === */}
      {/* PCIe Detach Confirmation Modal (VM Off) */}
      <Modal
        isOpen={showDetachConfirmation}
        onClose={() => {
          setShowDetachConfirmation(false);
          setDetachDeviceToConfirm(null);
        }}
        title="Confirm PCIe Device Detachment"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-gray-600 text-sm mb-4">
                You are about to detach the following PCIe device from VM{' '}
                <strong>{selectedVm?.name}</strong>:
              </p>
            </div>
          </div>

          {detachDeviceToConfirm && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                  {detachDeviceToConfirm.category === 'network' ? (
                    <BsPciCardNetwork size={16} className="text-blue-600" />
                  ) : detachDeviceToConfirm.category === 'gpu' ? (
                    <BsGpuCard size={16} className="text-purple-600" />
                  ) : detachDeviceToConfirm.category === 'storage' ? (
                    <BsFillNvmeFill size={16} className="text-green-600" />
                  ) : (
                    <FaMicrochip size={16} className="text-gray-600" />
                  )}
                </div>
                <div className="flex-grow">
                  <div className="font-medium text-gray-800">
                    {detachDeviceToConfirm.funcs[0]?.device || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Category: <span className="font-medium">{detachDeviceToConfirm.category}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Vendor: <span className="font-medium">{detachDeviceToConfirm.vendor}</span>
                  </div>
                  {detachDeviceToConfirm.category === 'network' ? (
                    <div className="text-sm text-gray-500 mt-1">
                      Function:{' '}
                      <span className="font-medium">{detachDeviceToConfirm.funcs[0]?.bdf}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-gray-500 mt-1">
                        Functions:{' '}
                        <span className="font-medium">{detachDeviceToConfirm.funcs.length}</span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        BDFs:{' '}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {detachDeviceToConfirm.allBdfs.map((bdf: string, index: number) => (
                            <code key={index} className="bg-gray-200 px-2 py-1 rounded text-xs">
                              {bdf}
                            </code>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {detachDeviceToConfirm.isIntegrated && (
                    <div className="text-sm text-amber-600 mt-1">
                      <span className="font-medium">Host Integrated Device</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-green-800">
            <strong>Safe to Detach:</strong> The VM is powered off, so this operation is safe to
            perform.
          </div>

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setShowDetachConfirmation(false);
                setDetachDeviceToConfirm(null);
              }}
              className="px-4 py-2 bg-white text-gray-700 font-medium rounded-md hover:bg-gray-100 transition-colors border border-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={confirmDetachPcie}
              className="px-4 py-2 bg-karios-blue text-white font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              {detachDeviceToConfirm?.category === 'network' ? 'Detach Function' : 'Detach Device'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Integrated Device Warning Modal */}
      <Modal
        isOpen={showIntegratedWarning}
        onClose={() => {
          setShowIntegratedWarning(false);
          setIntegratedDevicesToConfirm([]);
          setDevicesToConfirm([]);
        }}
        title="Warning: Integrated Device Attachment"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
              <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Integrated Device Warning</h4>
              <p className="text-gray-600 text-sm mb-4">
                The following PCIe device{integratedDevicesToConfirm.length !== 1 ? 's are' : ' is'}{' '}
                currently in use by the host system:
              </p>
            </div>
          </div>

          {/* Device List */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h5 className="font-medium text-amber-800 mb-3">
              Integrated Device{integratedDevicesToConfirm.length !== 1 ? 's' : ''}:
            </h5>
            <div className="space-y-2">
              {integratedDevicesToConfirm.map((device, _index) => (
                <div
                  key={device.bdf}
                  className="flex items-center gap-3 p-2 bg-white rounded border border-amber-200"
                >
                  <div className="p-1 bg-amber-100 rounded">
                    {device.category === 'network' ? (
                      <BsPciCardNetwork size={16} className="text-amber-600" />
                    ) : device.category === 'gpu' ? (
                      <BsGpuCard size={16} className="text-amber-600" />
                    ) : device.category === 'storage' ? (
                      <BsFillNvmeFill size={16} className="text-amber-600" />
                    ) : (
                      <FaMicrochip size={16} className="text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{device.device}</div>
                    <div className="text-xs text-gray-500">
                      BDF: {device.bdf} • {device.category} • {device.vendor}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Host Integrated
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-1 bg-red-100 rounded flex-shrink-0">
                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="text-sm text-red-800">
                <strong>Risk Warning:</strong> Attaching integrated devices may cause system
                instability, performance degradation, or loss of host functionality. The host system
                currently relies on these devices for operation.
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setShowIntegratedWarning(false);
                setIntegratedDevicesToConfirm([]);
                setDevicesToConfirm([]);
                setSelectedPcieDevices([]);
              }}
              className="px-4 py-2 bg-white text-gray-700 font-medium rounded-md hover:bg-gray-100 transition-colors border border-gray-300"
            >
              Cancel Attachment
            </button>
            <button
              onClick={confirmIntegratedDeviceWarning}
              className="px-4 py-2 bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              I Understand - Proceed
            </button>
          </div>
        </div>
      </Modal>

      {/* PCIe Attach Confirmation Modal */}
      <Modal
        isOpen={showAttachConfirmation}
        onClose={() => {
          setShowAttachConfirmation(false);
          setDevicesToConfirm([]);
        }}
        title="Confirm PCIe Device Attachment"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-gray-600 text-sm mb-4">
                You are about to attach <strong>{devicesToConfirm.length}</strong> PCIe device
                {devicesToConfirm.length !== 1 ? 's' : ''} to VM <strong>{selectedVm?.name}</strong>
                .
              </p>
              <p className="text-gray-600 text-sm">
                This will make the selected devices available to the virtual machine.
              </p>
            </div>
          </div>

          {/* Device List */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h5 className="font-medium text-gray-800 mb-3">Devices to Attach:</h5>
            <div className="space-y-2">
              {devicesToConfirm.map((device, _index) => (
                <div
                  key={device.bdf}
                  className="flex items-center gap-3 p-2 bg-white rounded border"
                >
                  <div className="p-1 bg-gray-100 rounded">
                    {device.category === 'network' ? (
                      <BsPciCardNetwork size={16} className="text-blue-600" />
                    ) : device.category === 'gpu' ? (
                      <BsGpuCard size={16} className="text-purple-600" />
                    ) : device.category === 'storage' ? (
                      <BsFillNvmeFill size={16} className="text-green-600" />
                    ) : (
                      <FaMicrochip size={16} className="text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{device.device}</div>
                    <div className="text-xs text-gray-500">
                      BDF: {device.bdf} • {device.category}
                    </div>
                  </div>
                  {device.is_integrated && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Host Integrated
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-blue-600">
            <strong>Note:</strong> These devices will be immediately available to the VM after
            attachment.
          </div>

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setShowAttachConfirmation(false);
                setDevicesToConfirm([]);
              }}
              className="px-4 py-2 bg-white text-gray-700 font-medium rounded-md hover:bg-gray-100 transition-colors border border-gray-300"
              disabled={isAttaching}
            >
              Cancel
            </button>
            <button
              onClick={confirmAttachPcie}
              disabled={isAttaching}
              className="px-4 py-2 bg-karios-blue text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isAttaching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Attaching...
                </>
              ) : (
                <>Attach Devices</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Approval Modal */}
      {isModalOpen && <ApprovalModal {...modalProps} />}
    </div>
  );
};

export default VmNetworkManager;
