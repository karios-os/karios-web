import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { useAppState, ActionTypes } from '@karios-monorepo/shared-state';
import { createComponentLogger } from '@karios-monorepo/shared-state';
import { toast } from 'react-toastify';
import {
  fetchVmInfo,
  fetchClusterVMs,
  fetchNodeInfo,
  fetchVmNetworkSwitches,
  fetchSwitchInfo,
  fetchNetworkDrivers,
  fetchUnusedDisks,
  fetchPcieDevices,
  fetchPciSliceableInfo,
  fetchSystemInfo,
} from '@karios-monorepo/shared-state';
import { isClusterVM, getFullClusterName, getClusterName } from './hardwareHelpers';

const logger = createComponentLogger('HardwareHooks');

export interface ResourceInfo {
  isClusterVM: boolean;
  clusterName: string;
  totalNodeCpu: number;
  totalNodeMemoryGB: number;
  usedNodeCpu: number;
  usedNodeMemoryGB: number;
  clusterCpuUsage: number;
  clusterMemoryUsage: number;
  availableCpu: number;
  availableMemoryGB: number;
}

// ===== VM Info Hook =====
export const useVmInfo = (selectedServer: any, selectedVm: any) => {
  const isMountedRef = useRef(true);
  const isCurrentlyFetchingRef = useRef(false);
  const ongoingVmInfoRequestRef = useRef<Promise<void> | null>(null);
  const lastGetVmInfoTimeRef = useRef<number>(0);
  const getVmInfoRef = useRef<any>(null);

  const [vmDetails, setVmDetails] = useState<any>(null);
  const [networkInterfaces, setNetworkInterfaces] = useState<any[]>([]);
  const [interfacesWithPorts, setInterfacesWithPorts] = useState<any[]>([]);
  const [datastore, setDatastore] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stableServerAddress = useMemo(
    () => selectedServer?.fqdn || selectedServer?.ip,
    [selectedServer]
  );

  const getVmInfo = useCallback(
    async (retry: boolean = false, reason?: string): Promise<void> => {
      const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
      if (!serverAddress || !selectedVm?.name) {
        logger.debug('getVmInfo skipped - missing params');
        return;
      }

      if (isCurrentlyFetchingRef.current) {
        return ongoingVmInfoRequestRef.current?.catch(() => {}) || Promise.resolve();
      }

      const now = Date.now();
      const timeSinceLastCall = now - lastGetVmInfoTimeRef.current;

      if (timeSinceLastCall < 3000 && !retry) {
        return;
      }

      isCurrentlyFetchingRef.current = true;
      lastGetVmInfoTimeRef.current = now;
      setIsLoading(true);
      setError(null);

      const requestPromise = (async () => {
        try {
          const data = await fetchVmInfo(serverAddress, selectedVm.name);

          if (isMountedRef.current) {
            setVmDetails(data);
            setDatastore(data.datastore);
            setError(null);
            setIsLoading(false);

            const interfaces = data['network-interface'] || [];
            setNetworkInterfaces(interfaces);

            Promise.all(
              interfaces.map(async (iface) => {
                try {
                  const switchInfo = await fetchSwitchInfo(serverAddress, iface['virtual-switch']);
                  return {
                    ...iface,
                    physicalPorts: switchInfo ? switchInfo['physical-ports'] : null,
                  };
                } catch {
                  return { ...iface, physicalPorts: null };
                }
              })
            )
              .then((interfacesWithPortsData) => {
                if (isMountedRef.current) {
                  setInterfacesWithPorts(interfacesWithPortsData);
                }
              })
              .catch((err) => logger.warn('Failed to fetch switch info', err));
          }
        } catch (err) {
          if (isMountedRef.current) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load VM details';
            setError(errorMessage);
            setIsLoading(false);
          }
        } finally {
          isCurrentlyFetchingRef.current = false;
          ongoingVmInfoRequestRef.current = null;
        }
      })();

      ongoingVmInfoRequestRef.current = requestPromise;
      return requestPromise;
    },
    [selectedServer?.fqdn, selectedServer?.ip, selectedVm?.name]
  );

  useEffect(() => {
    getVmInfoRef.current = getVmInfo;
  }, [getVmInfo]);

  return {
    vmDetails,
    setVmDetails,
    networkInterfaces,
    interfacesWithPorts,
    datastore,
    setDatastore,
    isLoading,
    error,
    getVmInfo,
    getVmInfoRef,
    stableServerAddress,
  };
};

// ===== Cluster Details Hook =====
export const useClusterDetails = (selectedServer: any, selectedVm: any, dispatch: any) => {
  const [isLoadingClusterDetails, setIsLoadingClusterDetails] = useState(false);
  const lastClusterCallRef = useRef<number>(0);

  const getClusterDetails = useCallback(async (): Promise<void> => {
    if (!selectedVm?.name || !isClusterVM(selectedVm.name)) {
      dispatch({ type: ActionTypes.SET_SELECTED_VM_DETAILS, payload: null });
      return;
    }

    const now = Date.now();
    if (now - lastClusterCallRef.current < 1000) {
      return;
    }
    lastClusterCallRef.current = now;

    try {
      setIsLoadingClusterDetails(true);

      const clusterName = getFullClusterName(selectedVm.name);
      const clusterData = await fetchClusterVMs(clusterName);

      // clusterData now contains the full cluster object with metadata
      // Structure: { KubernetesClusterName, zoneName, vms: [...], entities: [...], bmsInfo: [...] }

      let vmDetails = null;
      if (clusterData?.vms && Array.isArray(clusterData.vms)) {
        vmDetails = clusterData.vms.find((vm: any) => vm.vmName === selectedVm.name);

        if (vmDetails) {
          // Merge VM details with cluster metadata
          vmDetails = {
            ...vmDetails,
            ClusterName: clusterData.KubernetesClusterName,
            ZoneName: clusterData.zoneName,
            MACAddress: vmDetails.vmMacAddress,
            IPAddress: vmDetails.vmIpAddress,
            FQDN: vmDetails.fqdn,
          };
        }
      }

      dispatch({ type: ActionTypes.SET_SELECTED_VM_DETAILS, payload: vmDetails });
    } catch (error) {
      dispatch({ type: ActionTypes.SET_SELECTED_VM_DETAILS, payload: null });
    } finally {
      setIsLoadingClusterDetails(false);
    }
  }, [selectedVm?.name, dispatch]);

  return { getClusterDetails, isLoadingClusterDetails };
};

// ===== Node Info Hook =====
export const useNodeInfo = (selectedServer: any, selectedVm: any) => {
  const [nodeInfo, setNodeInfo] = useState<any>(null);
  const [maxCpus, setMaxCpus] = useState(0);
  const [maxMemoryGB, setMaxMemoryGB] = useState(0);
  const [maxSockets, setMaxSockets] = useState(1);
  const [isLoadingNodeInfo, setIsLoadingNodeInfo] = useState(false);
  const [resourceInfo, setResourceInfo] = useState<ResourceInfo>({
    isClusterVM: false,
    clusterName: '',
    totalNodeCpu: 0,
    totalNodeMemoryGB: 0,
    usedNodeCpu: 0,
    usedNodeMemoryGB: 0,
    clusterCpuUsage: 0,
    clusterMemoryUsage: 0,
    availableCpu: 0,
    availableMemoryGB: 0,
  });

  const calculateClusterResourceUsage = useCallback(
    (clusterVMs: any[], currentVmName: string): { totalCpu: number; totalMemoryGB: number } => {
      let totalCpu = 0;
      let totalMemoryGB = 0;

      clusterVMs.forEach((vm) => {
        if (vm.vmName === currentVmName) return;

        if (vm.vmCpu && typeof vm.vmCpu === 'number') {
          totalCpu += vm.vmCpu;
        }

        if (vm.vmMemory) {
          if (typeof vm.vmMemory === 'string') {
            const memoryStr = vm.vmMemory.toUpperCase();
            if (memoryStr.endsWith('G')) {
              totalMemoryGB += parseInt(memoryStr.replace('G', '')) || 0;
            } else if (memoryStr.endsWith('M')) {
              totalMemoryGB += Math.floor((parseInt(memoryStr.replace('M', '')) || 0) / 1024);
            } else {
              totalMemoryGB += parseInt(memoryStr) || 0;
            }
          } else if (typeof vm.vmMemory === 'number') {
            totalMemoryGB += vm.vmMemory;
          }
        }
      });

      return { totalCpu, totalMemoryGB };
    },
    []
  );

  const loadNodeInfo = useCallback(async (): Promise<void> => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (!serverAddress || !selectedVm?.name) return;

    setIsLoadingNodeInfo(true);
    try {
      const data = await fetchNodeInfo(serverAddress);
      setNodeInfo(data);

      const totalCpus = data.cpus || 0;
      const totalMemoryMB = data.memory || 0;
      const totalMemoryGB = Math.floor(totalMemoryMB / 1024);
      const usedCpus = data.cpus_in_use || 0;
      const usedMemoryMB = data.memory_in_use || 0;
      const usedMemoryGB = Math.floor(usedMemoryMB / 1024);

      let clusterCpuUsage = 0;
      let clusterMemoryUsage = 0;
      const vmIsClusterVM = isClusterVM(selectedVm.name);
      const vmClusterName = vmIsClusterVM ? getClusterName(selectedVm.name) : '';
      const fullClusterName = vmIsClusterVM ? getFullClusterName(selectedVm.name) : '';

      if (vmIsClusterVM && fullClusterName) {
        try {
          const clusterData = await fetchClusterVMs(fullClusterName);
          // clusterData now contains the full cluster object with vms array
          const clusterVMs = clusterData?.vms || [];
          const clusterUsage = calculateClusterResourceUsage(clusterVMs, selectedVm.name);
          clusterCpuUsage = clusterUsage.totalCpu;
          clusterMemoryUsage = clusterUsage.totalMemoryGB;
        } catch {
          // Continue with node-only calculation
        }
      }

      const availableCpus = Math.max(0, totalCpus - usedCpus - clusterCpuUsage);
      const availableMemoryGB = Math.max(0, totalMemoryGB - usedMemoryGB - clusterMemoryUsage);

      setResourceInfo({
        isClusterVM: vmIsClusterVM,
        clusterName: vmClusterName,
        totalNodeCpu: totalCpus,
        totalNodeMemoryGB: totalMemoryGB,
        usedNodeCpu: usedCpus,
        usedNodeMemoryGB: usedMemoryGB,
        clusterCpuUsage: clusterCpuUsage,
        clusterMemoryUsage: clusterMemoryUsage,
        availableCpu: availableCpus,
        availableMemoryGB: availableMemoryGB,
      });

      setMaxCpus(availableCpus);
      setMaxSockets(data.sockets || 1);
      setMaxMemoryGB(availableMemoryGB);
    } catch (error) {
      toast.error('Failed to fetch server specifications');
    } finally {
      setIsLoadingNodeInfo(false);
    }
  }, [selectedServer?.fqdn, selectedServer?.ip, selectedVm?.name, calculateClusterResourceUsage]);

  return {
    nodeInfo,
    maxCpus,
    maxMemoryGB,
    maxSockets,
    isLoadingNodeInfo,
    resourceInfo,
    loadNodeInfo,
  };
};

// ===== PCIe Devices Hook =====
export const usePcieDevices = (selectedServer: any, selectedVm: any) => {
  const [pcieInventory, setPcieInventory] = useState<any>(null);
  const [pcieLoading, setPcieLoading] = useState(true);
  const [pcieError, setPcieError] = useState<string | null>(null);
  const [pcieSliceable, setPcieSliceable] = useState<any>(null);
  const [systemModelName, setSystemModelName] = useState<string | null>(null);
  const [selectedPcieDevices, setSelectedPcieDevices] = useState<string[]>([]);

  const ongoingPcieRequestRef = useRef<Promise<void> | null>(null);
  const lastPcieFetchTimeRef = useRef<number>(0);
  const ongoingSystemInfoRequestRef = useRef<Promise<void> | null>(null);
  const lastSystemInfoFetchTimeRef = useRef<number>(0);

  const stableServerAddress = useMemo(
    () => selectedServer?.fqdn || selectedServer?.ip,
    [selectedServer]
  );

  const loadPcieDevices = useCallback(async (): Promise<void> => {
    if (!stableServerAddress) return;

    const now = Date.now();
    if (ongoingPcieRequestRef.current) {
      return ongoingPcieRequestRef.current;
    }

    if (now - lastPcieFetchTimeRef.current < 500) {
      return Promise.resolve();
    }

    lastPcieFetchTimeRef.current = now;
    setPcieLoading(true);
    setPcieError(null);

    const requestPromise = (async () => {
      try {
        const data = await fetchPcieDevices(stableServerAddress);
        setPcieInventory(data);

        try {
          const sliceableData = await fetchPciSliceableInfo(stableServerAddress);
          setPcieSliceable(sliceableData || null);
        } catch {
          setPcieSliceable(null);
        }
      } catch (error) {
        setPcieError(error instanceof Error ? error.message : 'Failed to fetch PCIe devices');
        toast.error('Failed to load PCIe devices');
      } finally {
        setPcieLoading(false);
        ongoingPcieRequestRef.current = null;
      }
    })();

    ongoingPcieRequestRef.current = requestPromise;
    return requestPromise;
  }, [stableServerAddress]);

  const loadSystemInfo = useCallback(async (): Promise<void> => {
    if (!stableServerAddress) return;

    const now = Date.now();
    if (ongoingSystemInfoRequestRef.current) {
      return ongoingSystemInfoRequestRef.current;
    }

    if (now - lastSystemInfoFetchTimeRef.current < 500) {
      return Promise.resolve();
    }

    lastSystemInfoFetchTimeRef.current = now;

    const requestPromise = (async () => {
      try {
        const systemData = await fetchSystemInfo(stableServerAddress);
        setSystemModelName(systemData.model_name || null);
      } catch {
        // Silent fail
      } finally {
        ongoingSystemInfoRequestRef.current = null;
      }
    })();

    ongoingSystemInfoRequestRef.current = requestPromise;
    return requestPromise;
  }, [stableServerAddress]);

  return {
    pcieInventory,
    setPcieInventory,
    pcieLoading,
    pcieError,
    pcieSliceable,
    setPcieSliceable,
    systemModelName,
    selectedPcieDevices,
    setSelectedPcieDevices,
    loadPcieDevices,
    loadSystemInfo,
    stableServerAddress,
  };
};

// ===== Network Switches Hook =====
export const useNetworkSwitches = (selectedServer: any) => {
  const [networkDrivers, setNetworkDrivers] = useState<any[]>([]);
  const [switchesWithPorts, setSwitchesWithPorts] = useState<any[]>([]);
  const [switchInfoCache, setSwitchInfoCache] = useState<Record<string, any>>({});

  const stableServerAddress = useMemo(
    () => selectedServer?.fqdn || selectedServer?.ip,
    [selectedServer]
  );

  useEffect(() => {
    setSwitchInfoCache({});
  }, [stableServerAddress]);

  const loadSwitchInfo = useCallback(
    async (switchName: string) => {
      if (switchInfoCache[switchName]) {
        return switchInfoCache[switchName];
      }

      try {
        const data = await fetchSwitchInfo(stableServerAddress, switchName);
        setSwitchInfoCache((prev) => ({
          ...prev,
          [switchName]: data,
        }));
        return data;
      } catch {
        return null;
      }
    },
    [stableServerAddress, switchInfoCache]
  );

  const fetchNetworkData = useCallback(
    async (isFormOpen: boolean) => {
      if (!stableServerAddress || !isFormOpen) return;

      try {
        const driversData = await fetchNetworkDrivers(stableServerAddress);
        setNetworkDrivers(driversData.drivers || []);

        const switchesData = await fetchVmNetworkSwitches(stableServerAddress);
        const switchesList = Array.isArray(switchesData) ? switchesData : [];

        const switchesWithPortsData = await Promise.all(
          switchesList.map(async (sw) => {
            const switchInfo = await fetchSwitchInfo(stableServerAddress, sw.name);
            return {
              ...sw,
              physicalPorts: switchInfo ? switchInfo['physical-ports'] : null,
            };
          })
        );

        setSwitchesWithPorts(switchesWithPortsData);
      } catch {
        // Silent fail
      }
    },
    [stableServerAddress, loadSwitchInfo]
  );

  return {
    networkDrivers,
    setNetworkDrivers,
    switchesWithPorts,
    setSwitchesWithPorts,
    loadSwitchInfo,
    fetchNetworkData,
    stableServerAddress,
  };
};

// ===== Unused Disks Hook =====
export const useUnusedDisks = (selectedServer: any, selectedVm: any, vmDetails: any) => {
  const [unusedDisks, setUnusedDisks] = useState<any[]>([]);

  const loadUnusedDisks = useCallback(async (): Promise<void> => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (!selectedVm?.name || !vmDetails?.datastore || !serverAddress) return;

    try {
      const data = await fetchUnusedDisks(serverAddress, selectedVm.name, vmDetails.datastore);
      setUnusedDisks(data || []);
    } catch {
      // Silent fail
    }
  }, [selectedVm?.name, vmDetails?.datastore, selectedServer?.ip, selectedServer?.fqdn]);

  return { unusedDisks, setUnusedDisks, loadUnusedDisks };
};
