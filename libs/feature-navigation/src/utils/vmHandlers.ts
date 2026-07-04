/**
 * VM & Cluster Handler Functions
 * Consolidated handler logic for SideBar operations
 *
 * This file consolidates complex handlers to reduce SideBar.tsx size
 */

import { VirtualMachine, DataCenter, ServerNode } from '../SideBar-types';
import { isClusterVM, getClusterName, getFullClusterName } from './clusterUtilities';

export interface HandlerDependencies {
  navigate: (path: string) => void;
  dispatch: any;
  state: any;
  activeSection: string | null;
  logger: any;
  refreshClusterData: (force?: boolean) => Promise<any>;
  redirectToK8sProvisioning: (reason: string) => void;
  ActionTypes: any;
}

/**
 * Smart navigation after VM deletion
 * Handles cluster VM removal and navigates to appropriate next view
 */
export const createHandleSmartNavigationAfterVmDelete = (deps: HandlerDependencies) => {
  return async (deletedVm: VirtualMachine, isLastVmInCluster: boolean) => {
    if (deps.activeSection !== 'clusters' || !isClusterVM(deletedVm.name)) {
      deps.navigate('/');
      return;
    }

    const clusterName = getFullClusterName(deletedVm.name);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const clusterData = await deps.refreshClusterData(true);

      if (!clusterData || !clusterData.clusters) {
        deps.navigate('/');
        return;
      }

      const clusters = clusterData.clusters || [];
      const currentCluster = clusters.find((c) => c.KubernetesClusterName === clusterName);

      if (currentCluster && currentCluster.vms && currentCluster.vms.length > 0) {
        const firstVm = currentCluster.vms[0];
        const targetServer = deps.state.dataCenters
          .flatMap((dc) => dc.servers)
          .find((server) => server.ip === firstVm.nodeIp);

        if (targetServer) {
          deps.dispatch({
            type: deps.ActionTypes.SET_SELECTED_VM,
            payload: { name: firstVm.vmName },
          });
          deps.dispatch({ type: deps.ActionTypes.SET_SELECTED_SERVER, payload: targetServer });
          deps.navigate(`/server/${firstVm.nodeIp}/vm/${firstVm.vmName}`);
        } else {
          deps.navigate(`/cluster/${clusterName}/details`);
        }
      } else if (clusters.length > 0) {
        const nextCluster = clusters[0];
        deps.navigate(`/cluster/${nextCluster.KubernetesClusterName}/details`);
      } else {
        deps.redirectToK8sProvisioning('No clusters remaining after VM deletion');
      }
    } catch (error) {
      deps.logger.error('Error during smart navigation:', error);
      if (clusterName) {
        deps.navigate(`/cluster/${clusterName}/details`);
      } else {
        deps.navigate('/');
      }
    }
  };
};

/**
 * Sort VMs with normal VMs first, then cluster VMs grouped by cluster
 */
export const sortVMs = (vms: VirtualMachine[]): VirtualMachine[] => {
  const normalVMs = vms.filter((vm) => !isClusterVM(vm.name));
  const clusterVMs = vms.filter((vm) => isClusterVM(vm.name));

  const clusterGroups: { [clusterName: string]: VirtualMachine[] } = {};
  clusterVMs.forEach((vm) => {
    const clusterName = getClusterName(vm.name);
    if (!clusterGroups[clusterName]) {
      clusterGroups[clusterName] = [];
    }
    clusterGroups[clusterName].push(vm);
  });

  Object.keys(clusterGroups).forEach((clusterName) => {
    clusterGroups[clusterName].sort((a, b) => {
      const aIsMaster =
        a.name.includes('master') ||
        a.name.includes('-ms') ||
        a.name.endsWith('-ms') ||
        a.name.includes('controlplane') ||
        a.name.includes('control-plane');
      const bIsMaster =
        b.name.includes('master') ||
        b.name.includes('-ms') ||
        b.name.endsWith('-ms') ||
        b.name.includes('controlplane') ||
        b.name.includes('control-plane');

      const aIsWorker = a.name.includes('worker') || a.name.includes('-wr') || /wr\d+/.test(a.name);
      const bIsWorker = b.name.includes('worker') || b.name.includes('-wr') || /wr\d+/.test(b.name);

      if (aIsMaster && !bIsMaster) return -1;
      if (!aIsMaster && bIsMaster) return 1;

      if (aIsWorker && !bIsWorker && !bIsMaster) return -1;
      if (!aIsWorker && bIsWorker && !aIsMaster) return 1;

      return a.name.localeCompare(b.name);
    });
  });

  const sortedClusterVMs = Object.keys(clusterGroups)
    .sort()
    .flatMap((clusterName) => clusterGroups[clusterName]);

  return [...normalVMs.sort((a, b) => a.name.localeCompare(b.name)), ...sortedClusterVMs];
};

/**
 * Organize VMs by type (normal VMs and cluster groups)
 */
export const organizeVMs = (vms: VirtualMachine[]) => {
  const normalVMs = vms.filter((vm) => !isClusterVM(vm.name));
  const clusterVMs = vms.filter((vm) => isClusterVM(vm.name));

  const clusterGroups: { [clusterName: string]: VirtualMachine[] } = {};
  clusterVMs.forEach((vm) => {
    const clusterName = getClusterName(vm.name);
    if (!clusterGroups[clusterName]) {
      clusterGroups[clusterName] = [];
    }
    clusterGroups[clusterName].push(vm);
  });

  Object.keys(clusterGroups).forEach((clusterName) => {
    clusterGroups[clusterName].sort((a, b) => {
      const aIsMaster =
        a.name.includes('master') ||
        a.name.includes('-ms') ||
        a.name.endsWith('-ms') ||
        a.name.includes('controlplane') ||
        a.name.includes('control-plane');
      const bIsMaster =
        b.name.includes('master') ||
        b.name.includes('-ms') ||
        b.name.endsWith('-ms') ||
        b.name.includes('controlplane') ||
        b.name.includes('control-plane');

      const aIsWorker = a.name.includes('worker') || a.name.includes('-wr') || /wr\d+/.test(a.name);
      const bIsWorker = b.name.includes('worker') || b.name.includes('-wr') || /wr\d+/.test(b.name);

      if (aIsMaster && !bIsMaster) return -1;
      if (!aIsMaster && bIsMaster) return 1;

      if (aIsWorker && !bIsWorker && !bIsMaster) return -1;
      if (!aIsWorker && bIsWorker && !aIsMaster) return 1;

      return a.name.localeCompare(b.name);
    });
  });

  return {
    normalVMs: normalVMs.sort((a, b) => a.name.localeCompare(b.name)),
    clusterGroups: clusterGroups,
  };
};

/**
 * Sort cluster VMs (control planes first, then workers, then others)
 */
export const sortClusterVMs = (vms: any[]): any[] => {
  if (!vms || vms.length === 0) return [];

  return [...vms].sort((a, b) => {
    const vmNameA = a.vmName || a.name || '';
    const vmNameB = b.vmName || b.name || '';

    const aIsMaster =
      vmNameA.includes('master') ||
      vmNameA.includes('-ms') ||
      vmNameA.endsWith('-ms') ||
      vmNameA.includes('controlplane') ||
      vmNameA.includes('control-plane');
    const bIsMaster =
      vmNameB.includes('master') ||
      vmNameB.includes('-ms') ||
      vmNameB.endsWith('-ms') ||
      vmNameB.includes('controlplane') ||
      vmNameB.includes('control-plane');

    const aIsWorker =
      vmNameA.includes('worker') || vmNameA.includes('-wr') || /wr\d+/.test(vmNameA);
    const bIsWorker =
      vmNameB.includes('worker') || vmNameB.includes('-wr') || /wr\d+/.test(vmNameB);

    if (aIsMaster && !bIsMaster) return -1;
    if (!aIsMaster && bIsMaster) return 1;

    if (aIsWorker && !bIsWorker && !bIsMaster) return -1;
    if (!aIsWorker && bIsWorker && !aIsMaster) return 1;

    return vmNameA.localeCompare(vmNameB);
  });
};

/**
 * Check if VM name is restricted (starts with 'techni')
 */
export const isVmNameRestricted = (vmName: string): boolean => {
  return vmName.toLowerCase().startsWith('techni');
};
