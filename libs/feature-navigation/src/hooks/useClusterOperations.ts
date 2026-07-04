import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { setupVmListWebSocket } from '../../../shared-state/src/utils/apiService';

type ServerNode = any;
type VirtualMachine = any;

const API_CALL_DEBOUNCE_MS = 3000;

interface UseClusterOperationsProps {
  clusterData: any;
  clusterVmsData: any;
  dataCenters: any[];
  activeSection: 'control-center' | 'clusters' | 'migrate' | 'licenses' | null;
  expandedClusters: any;
  isLoadingClusters: boolean;
  isRedirecting: boolean;
  lastApiCallRef: React.MutableRefObject<number>;
  activeWebSocketsRef: React.MutableRefObject<any>;
  setIsLoadingClusters: (value: boolean) => void;
  setClusterError: (error: string | null) => void;
  setLoadingServers: (callback: any) => void;
  setClusterVmsData: (value: any) => void;
  setLoadingClusterVms: (value: any) => void;
  updateClusterDataIfChanged: (data: any) => void;
  redirectToK8sProvisioning: (reason: string) => void;
  redirectToControlCenter: (reason?: string) => void;
  refreshClusterDataApi: (forceRefresh?: boolean) => Promise<any>;
  getClusterDataApi: () => Promise<any>;
  fetchClusterVMs: (clusterName: string, forceRefresh?: boolean) => Promise<any>;
  fetchVMsForServer: (server: ServerNode) => Promise<any>;
  dispatch: any;
  navigate: any;
  logger: any;
}

export const useClusterOperations = ({
  clusterData,
  clusterVmsData,
  dataCenters,
  activeSection,
  expandedClusters,
  isLoadingClusters,
  isRedirecting,
  lastApiCallRef,
  activeWebSocketsRef,
  setIsLoadingClusters,
  setClusterError,
  setLoadingServers,
  setClusterVmsData,
  setLoadingClusterVms,
  updateClusterDataIfChanged,
  redirectToK8sProvisioning,
  redirectToControlCenter,
  refreshClusterDataApi,
  getClusterDataApi,
  fetchClusterVMs,
  fetchVMsForServer,
  dispatch,
  navigate,
  logger,
}: UseClusterOperationsProps) => {
  // Function to fetch initial cluster data
  const fetchClusterData = useCallback(async () => {
    if (isLoadingClusters) return;

    setIsLoadingClusters(true);
    setClusterError(null);

    try {
      const data = await getClusterDataApi();

      if (data && data.error) {
        updateClusterDataIfChanged({ clusters: [], error: data.error });

        if (activeSection === 'clusters' && !isRedirecting) {
          redirectToK8sProvisioning('No clusters available during initial fetch');
        }
        return;
      }

      if (data && data.clusters && Array.isArray(data.clusters)) {
        const normalizedData = {
          ...data,
          clusters: data.clusters.map((cluster: any) => ({
            ...cluster,
            vms: cluster.vms
              ? cluster.vms.map((vm: any) => ({
                  ...vm,
                  vmName: vm.vmName || vm.VMName,
                  vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
                  vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
                  fqdn: vm.fqdn || vm.FQDN,
                  nodeIp: vm.nodeIp || vm.NodeIp,
                  clusterName: vm.clusterName || vm.ClusterName || cluster.KubernetesClusterName,
                }))
              : [],
          })),
        };
        updateClusterDataIfChanged(normalizedData);

        if (normalizedData.clusters.length > 0) {
          const currentPath = location.pathname;
          if (
            (currentPath === '/k8s-provisioning' || currentPath === '/') &&
            activeSection === 'clusters'
          ) {
            const firstCluster = normalizedData.clusters[0];
            const firstClusterName = firstCluster.KubernetesClusterName;
            navigate(`/cluster/${firstClusterName}/details`);
          }
        }
      } else {
        updateClusterDataIfChanged(data);
      }
    } catch (error) {
      logger.error('Error fetching cluster data:', error);

      if (error instanceof Error && error.message.includes('no clusters found')) {
        updateClusterDataIfChanged({ clusters: [], error: 'No clusters found' });

        if (activeSection === 'clusters' && !isRedirecting) {
          redirectToK8sProvisioning('No clusters found during initial fetch');
        }
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to load cluster data';

      if (errorMessage.includes('Cluster not found') || errorMessage.includes('not found')) {
        setClusterError(null);
      } else {
        setClusterError(errorMessage);
      }
    } finally {
      setIsLoadingClusters(false);
    }
  }, [
    isLoadingClusters,
    activeSection,
    isRedirecting,
    setIsLoadingClusters,
    setClusterError,
    updateClusterDataIfChanged,
    redirectToK8sProvisioning,
    getClusterDataApi,
    navigate,
    logger,
  ]);

  // Function to refresh cluster data - can be called from multiple places
  const refreshClusterData = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!forceRefresh) {
        const now = Date.now();
        if (now - lastApiCallRef.current < API_CALL_DEBOUNCE_MS) {
          return null;
        }
        lastApiCallRef.current = now;
      }

      try {
        const data = await refreshClusterDataApi(forceRefresh);

        if (data && data.error) {
          const errorMessage = data.error;

          if (
            errorMessage &&
            (errorMessage.includes('Cluster not found') ||
              errorMessage.includes('not found') ||
              errorMessage.includes('No clusters found'))
          ) {
            updateClusterDataIfChanged({ clusters: [] });
            setClusterError(null);
            return { clusters: [] };
          } else {
            updateClusterDataIfChanged({ clusters: [] });
            setClusterError(null);
            return { clusters: [] };
          }
        }

        if (data && data.clusters && Array.isArray(data.clusters) && data.clusters.length === 0) {
          updateClusterDataIfChanged({ clusters: [] });
          setClusterError(null);
          return { clusters: [] };
        }

        if (data && !data.clusters) {
          updateClusterDataIfChanged({ clusters: [] });
          setClusterError(null);
          return { clusters: [] };
        }

        if (data && data.clusters && Array.isArray(data.clusters)) {
          const normalizedData = {
            ...data,
            clusters: data.clusters.map((cluster: any) => ({
              ...cluster,
              vms: cluster.vms
                ? cluster.vms.map((vm: any) => ({
                    ...vm,
                    vmName: vm.vmName || vm.VMName,
                    vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
                    vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
                    fqdn: vm.fqdn || vm.FQDN,
                    nodeIp: vm.nodeIp || vm.NodeIp,
                    clusterName: vm.clusterName || vm.ClusterName || cluster.KubernetesClusterName,
                  }))
                : [],
            })),
          };
          updateClusterDataIfChanged(normalizedData);

          if (normalizedData.clusters.length > 0) {
            const currentPath = location.pathname;
            if (
              (currentPath === '/k8s-provisioning' || currentPath === '/') &&
              activeSection === 'clusters'
            ) {
              const firstCluster = normalizedData.clusters[0];
              const firstClusterName = firstCluster.KubernetesClusterName;
              navigate(`/cluster/${firstClusterName}/details`);
            }
          }

          setClusterError(null);

          if (activeSection === 'clusters') {
            setIsLoadingClusters(false);
          }

          return normalizedData;
        } else {
          updateClusterDataIfChanged(data);

          setClusterError(null);

          if (activeSection === 'clusters') {
            setIsLoadingClusters(false);
          }

          return data || { clusters: [] };
        }
      } catch (error) {
        logger.error('Error refreshing cluster data:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes('Cluster not found') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('No clusters found')
        ) {
          updateClusterDataIfChanged({ clusters: [] });
          setClusterError(null);
          return { clusters: [] };
        }

        updateClusterDataIfChanged({ clusters: [] });
        setClusterError(null);

        if (
          activeSection === 'clusters' &&
          !errorMessage.includes('404') &&
          !errorMessage.includes('Not Found')
        ) {
          toast.error('Failed to refresh cluster data');
        }

        return { clusters: [] };
      }
    },
    [
      activeSection,
      updateClusterDataIfChanged,
      navigate,
      logger,
      lastApiCallRef,
      setClusterError,
      setIsLoadingClusters,
      refreshClusterDataApi,
    ]
  );

  // Enhanced function to refresh cluster data for specific server operations
  const refreshClusterDataForServer = useCallback(
    async (serverIp: string, operation: string) => {
      const currentlyExpandedClusters = Object.keys(expandedClusters).filter(
        (clusterName) => expandedClusters[clusterName]
      );

      try {
        const data = await refreshClusterDataApi(true);

        if (data && data.error) {
          updateClusterDataIfChanged({ clusters: [], error: data.error });

          if (activeSection === 'clusters' && !isRedirecting) {
            redirectToK8sProvisioning('No clusters available after server operation');
          }
        } else {
          if (data && data.clusters && Array.isArray(data.clusters)) {
            const normalizedData = {
              ...data,
              clusters: data.clusters.map((cluster: any) => ({
                ...cluster,
                vms: cluster.vms
                  ? cluster.vms.map((vm: any) => ({
                      ...vm,
                      vmName: vm.vmName || vm.VMName,
                      vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
                      vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
                      fqdn: vm.fqdn || vm.FQDN,
                      nodeIp: vm.nodeIp || vm.NodeIp,
                      clusterName:
                        vm.clusterName || vm.ClusterName || cluster.KubernetesClusterName,
                    }))
                  : [],
              })),
            };
            updateClusterDataIfChanged(normalizedData);

            if (
              normalizedData.clusters.length === 0 &&
              activeSection === 'clusters' &&
              !isRedirecting
            ) {
              redirectToK8sProvisioning('No clusters remaining after server operation');
            }
          } else {
            updateClusterDataIfChanged(data);
          }
        }

        setClusterVmsData({});
        setLoadingClusterVms({});

        if (currentlyExpandedClusters.length > 0) {
          currentlyExpandedClusters.forEach((clusterName) => {
            fetchClusterVMs(clusterName, true);
          });
        }
      } catch (error) {
        logger.error('Error refreshing cluster data after VM operation:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes('Cluster not found') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('No clusters found')
        ) {
          updateClusterDataIfChanged({ clusters: [] });
          return;
        }

        if (
          activeSection === 'clusters' &&
          !errorMessage.includes('404') &&
          !errorMessage.includes('Not Found')
        ) {
          toast.error(`Failed to refresh cluster data after ${operation}`);
        }
      }
    },
    [
      activeSection,
      isRedirecting,
      expandedClusters,
      setClusterVmsData,
      setLoadingClusterVms,
      updateClusterDataIfChanged,
      redirectToK8sProvisioning,
      refreshClusterDataApi,
      fetchClusterVMs,
      logger,
    ]
  );

  // Setup WebSocket connections for cluster servers
  const setupClusterWebSocketConnections = useCallback(
    (clusterName: string) => {
      const clusterServers = new Set<any>();

      if (clusterData?.clusters) {
        const cluster = clusterData.clusters.find((c: any) => c.name === clusterName);
        if (cluster?.vms) {
          cluster.vms.forEach((vm: any) => {
            if (vm.nodeIp && vm.nodeIp.trim() !== '') {
              if (dataCenters) {
                for (const dc of dataCenters) {
                  for (const server of dc.servers || []) {
                    if (server.ip === vm.nodeIp) {
                      clusterServers.add(server);
                      break;
                    }
                  }
                }
              }
            }
          });
        }
      }

      const clusterVMs = clusterVmsData[clusterName];
      if (clusterVMs?.vms) {
        clusterVMs.vms.forEach((vm: any) => {
          if (vm.nodeIp && vm.nodeIp.trim() !== '') {
            if (dataCenters) {
              for (const dc of dataCenters) {
                for (const server of dc.servers || []) {
                  if (server.ip === vm.nodeIp) {
                    clusterServers.add(server);
                    break;
                  }
                }
              }
            }
          }
        });
      }

      const serversArray = Array.from(clusterServers);

      if (serversArray.length === 0) {
        return;
      }

      for (const server of serversArray) {
        const serverKey = server.id;

        if (activeWebSocketsRef.current[serverKey]) {
          continue;
        }

        setLoadingServers((prev: any) => ({ ...prev, [serverKey]: true }));

        const wsConnection = setupVmListWebSocket(server, dispatch);

        if (wsConnection) {
          activeWebSocketsRef.current[serverKey] = wsConnection;

          wsConnection.onerror = () => {
            logger.error(`WebSocket error for server ${serverKey} in cluster ${clusterName}`);
            setLoadingServers((prev: any) => {
              const updated = { ...prev };
              delete updated[serverKey];
              return updated;
            });
          };

          wsConnection.onopen = () => {};
        } else {
          setLoadingServers((prev: any) => {
            const updated = { ...prev };
            delete updated[serverKey];
            return updated;
          });
        }
      }
    },
    [
      clusterData,
      clusterVmsData,
      dataCenters,
      activeWebSocketsRef,
      setLoadingServers,
      dispatch,
      logger,
    ]
  );

  // Function to get clusters from API data
  const getClustersFromAPI = useCallback(() => {
    const clusters: { [clusterName: string]: { server: ServerNode; vms: VirtualMachine[] }[] } = {};

    if (!clusterData || !clusterData.clusters) {
      return clusters;
    }

    clusterData.clusters.forEach((cluster: any) => {
      const clusterName = cluster.KubernetesClusterName || cluster.name;
      if (!clusters[clusterName]) {
        clusters[clusterName] = [];
      }

      if (cluster.vms && Array.isArray(cluster.vms)) {
        cluster.vms.forEach((vm: any) => {
          const nodeIp = vm.nodeIp || vm.NodeIp;
          if (nodeIp) {
            const server = dataCenters
              .flatMap((dc: any) => dc.servers)
              .find((s: any) => s.ip === nodeIp);

            if (server) {
              clusters[clusterName].push({
                server,
                vms: [vm],
              });
            }
          }
        });
      }
    });

    return clusters;
  }, [clusterData, dataCenters]);

  return {
    fetchClusterData,
    refreshClusterData,
    refreshClusterDataForServer,
    setupClusterWebSocketConnections,
    getClustersFromAPI,
  };
};
