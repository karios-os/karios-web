import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { logger } from '../../../shared-state/src/utils/logger';

interface ClusterDataState {
  clusters: any[];
  error?: string;
}

const API_CALL_DEBOUNCE_MS = 1000;

export const useClusterDataManagement = (
  refreshClusterDataApi: (forceRefresh?: boolean) => Promise<any>,
  getClusterDataApi: () => Promise<any>,
  activeSection?: string,
  isRedirecting?: boolean,
  redirectToK8sProvisioning?: (message: string) => void,
  navigate?: (path: string) => void,
  location?: any
) => {
  const [clusterData, setClusterData] = useState<ClusterDataState | null>(null);
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const clusterDataRef = useRef<ClusterDataState | null>(null);
  const lastApiCallRef = useRef<number>(0);

  const updateClusterDataIfChanged = useCallback((newData: ClusterDataState) => {
    const currentDataString = JSON.stringify(clusterDataRef.current);
    const newDataString = JSON.stringify(newData);
    if (currentDataString !== newDataString) {
      clusterDataRef.current = newData;
      setClusterData(newData);
    }
  }, []);

  const fetchClusterData = useCallback(async () => {
    if (isLoadingClusters) return;

    setIsLoadingClusters(true);
    setClusterError(null);

    try {
      const data = await getClusterDataApi();

      if (data && data.error) {
        updateClusterDataIfChanged({ clusters: [], error: data.error });

        if (activeSection === 'clusters' && !isRedirecting) {
          redirectToK8sProvisioning?.('No clusters available during initial fetch');
        }
        return;
      }

      if (data && data.clusters && Array.isArray(data.clusters)) {
        const normalizedData = normalizeClusterData(data);
        updateClusterDataIfChanged(normalizedData);

        if (normalizedData.clusters.length > 0) {
          const currentPath = location?.pathname;
          if (
            (currentPath === '/k8s-provisioning' || currentPath === '/') &&
            activeSection === 'clusters'
          ) {
            const firstCluster = normalizedData.clusters[0];
            navigate?.(`/cluster/${firstCluster.KubernetesClusterName}/details`);
          }
        }
      } else {
        updateClusterDataIfChanged(data || { clusters: [] });
      }
    } catch (error) {
      logger.error('Error fetching cluster data:', error);

      if (error instanceof Error && error.message.includes('no clusters found')) {
        updateClusterDataIfChanged({ clusters: [], error: 'No clusters found' });

        if (activeSection === 'clusters' && !isRedirecting) {
          redirectToK8sProvisioning?.('No clusters found during initial fetch');
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
    redirectToK8sProvisioning,
    navigate,
    location,
    getClusterDataApi,
    updateClusterDataIfChanged,
  ]);

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
          const normalizedData = normalizeClusterData(data);
          updateClusterDataIfChanged(normalizedData);

          if (normalizedData.clusters.length > 0) {
            const currentPath = location?.pathname;
            if (
              (currentPath === '/k8s-provisioning' || currentPath === '/') &&
              activeSection === 'clusters'
            ) {
              const firstCluster = normalizedData.clusters[0];
              navigate?.(`/cluster/${firstCluster.KubernetesClusterName}/details`);
            }
          }

          setClusterError(null);
          setIsLoadingClusters(false);
          return normalizedData;
        } else {
          updateClusterDataIfChanged(data);
          setClusterError(null);
          setIsLoadingClusters(false);
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
      location?.pathname,
      isRedirecting,
      refreshClusterDataApi,
    ]
  );

  return {
    clusterData,
    isLoadingClusters,
    clusterError,
    setClusterError,
    setIsLoadingClusters,
    fetchClusterData,
    refreshClusterData,
    updateClusterDataIfChanged,
  };
};

function normalizeClusterData(data: any) {
  return {
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
}
