import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../../../shared-state/src/utils/logger';
import type { VirtualMachine, ServerNode } from '../SideBar-types';

interface UseVmNavigationProps {
  dataCenters: any[];
  activeSection?: string;
  dispatch?: any;
  fetchVMsForServer?: (server: ServerNode) => Promise<void>;
  setIsUserInitiatedVmClick?: (value: boolean) => void;
  setNewServerDropdownSelected?: (value: boolean) => void;
  setOpenServers?: (servers: any) => void;
}

export const useVmNavigation = (props: UseVmNavigationProps) => {
  const {
    dataCenters,
    activeSection,
    dispatch,
    fetchVMsForServer,
    setIsUserInitiatedVmClick,
    setNewServerDropdownSelected,
    setOpenServers,
  } = props;

  const navigate = useNavigate();
  const location = useLocation();

  const handleVmClick = useCallback(
    async (vm: VirtualMachine, server: ServerNode) => {
      // Mark this as a user-initiated click to prevent automatic navigation conflicts
      setIsUserInitiatedVmClick?.(true);

      // Reset the new server dropdown selected state since we're selecting a VM
      setNewServerDropdownSelected?.(false);

      // Dispatch VM selection action
      dispatch?.({ type: 'SET_SELECTED_VM', payload: vm });

      // Make sure the server containing this VM is the only one open
      if (server && server.id) {
        const updatedOpenServers = { [server.id]: true };
        setOpenServers?.(updatedOpenServers);
      }

      // Find the enriched server object from dataCenters
      let enrichedServer = null;
      for (const dc of dataCenters) {
        const found = dc.servers.find((s: ServerNode) => s.id === server.id);
        if (found) {
          enrichedServer = found;
          break;
        }
      }

      if (!enrichedServer) {
        enrichedServer = server; // fallback to basic server
      }

      // Dispatch server selection action with enriched server
      dispatch?.({ type: 'SET_SELECTED_SERVER', payload: enrichedServer });

      // Fetch VMs for the server if not already loaded
      if (!server.vms || server.vms.length === 0) {
        await fetchVMsForServer?.(server);
      }

      // Navigate to VM page
      navigate(`/server/${server.name}/vm/${vm.name}/hardware`);

      // Reset the flag after a short delay to allow for subsequent automatic updates
      setTimeout(() => {
        setIsUserInitiatedVmClick?.(false);
      }, 1000);
    },
    [
      dataCenters,
      navigate,
      dispatch,
      fetchVMsForServer,
      setIsUserInitiatedVmClick,
      setNewServerDropdownSelected,
      setOpenServers,
    ]
  );

  const shouldHighlightVmFromUrl = useCallback(
    (server: ServerNode, vm: VirtualMachine): boolean => {
      const pathParts = location.pathname.split('/');
      const serverNameFromUrl = pathParts.includes('server')
        ? pathParts[pathParts.indexOf('server') + 1]
        : null;
      const vmNameFromUrl = pathParts.includes('vm')
        ? pathParts[pathParts.indexOf('vm') + 1]
        : null;

      return server.name === serverNameFromUrl && vm.name === vmNameFromUrl;
    },
    [location.pathname]
  );

  const handleSmartNavigationAfterVmDelete = useCallback(
    async (
      deletedVm: VirtualMachine,
      isLastVmInCluster: boolean,
      refreshClusterData?: (forceRefresh: boolean) => Promise<any>
    ) => {
      const { isClusterVM, getFullClusterName } = await import('../utils/clusterUtilities');

      if (activeSection !== 'clusters' || !isClusterVM(deletedVm.name)) {
        navigate('/');
        return;
      }

      const clusterName = getFullClusterName(deletedVm.name);

      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const clusterDataResult = await refreshClusterData?.(true);

        if (!clusterDataResult || !clusterDataResult.clusters) {
          navigate('/');
          return;
        }

        const clusters = clusterDataResult.clusters || [];
        const currentCluster = clusters.find((c: any) => c.KubernetesClusterName === clusterName);

        if (currentCluster && currentCluster.vms && currentCluster.vms.length > 0) {
          const firstVm = currentCluster.vms[0];
          const targetServer = dataCenters
            .flatMap((dc: any) => dc.servers)
            .find((server: ServerNode) => server.ip === firstVm.nodeIp);

          if (targetServer) {
            dispatch?.({ type: 'SET_SELECTED_VM', payload: { name: firstVm.vmName } });
            dispatch?.({ type: 'SET_SELECTED_SERVER', payload: targetServer });
            navigate(`/server/${firstVm.nodeIp}/vm/${firstVm.vmName}`);
          } else {
            navigate(`/cluster/${clusterName}/details`);
          }
        } else if (clusters.length > 0) {
          const nextCluster = clusters[0];
          navigate(`/cluster/${nextCluster.KubernetesClusterName}/details`);
        } else {
          navigate('/k8s-provisioning');
        }
      } catch (error) {
        logger.error('Error during smart navigation:', error);
        if (clusterName) {
          navigate(`/cluster/${clusterName}/details`);
        } else {
          navigate('/');
        }
      }
    },
    [activeSection, navigate, dataCenters, dispatch]
  );

  return {
    handleVmClick,
    shouldHighlightVmFromUrl,
    handleSmartNavigationAfterVmDelete,
  };
};
