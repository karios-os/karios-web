/**
 * Cluster Management Service
 * Handles all cluster-related operations and logic
 * All API calls are routed through this service
 */

import { toast } from 'react-toastify';
import { logger } from '../utils/logger';

export interface ClusterData {
  clusters: Array<{
    KubernetesClusterName: string;
    vms: any[];
    bmsInfo?: any[];
  }>;
  limit?: number;
  offset?: number;
  total?: number;
  error?: string;
}

export interface ClusterOperationCallbacks {
  onClusterDataLoaded?: (data: ClusterData) => void;
  onClusterVMsLoaded?: (clusterName: string, vms: any[]) => void;
  onError?: (error: string) => void;
  onNavigateToCluster?: (clusterName: string) => void;
}

/**
 * Handles cluster name click - navigates to cluster details
 */
export const handleClusterNameClick = async (
  clusterName: string,
  navigate: (path: string) => void,
  callbacks: ClusterOperationCallbacks
) => {
  try {
    if (!clusterName || clusterName.trim() === '') {
      logger.warn('Invalid cluster name provided');
      return;
    }

    logger.info(`Navigating to cluster: ${clusterName}`);
    callbacks.onNavigateToCluster?.(clusterName);
    navigate(`/cluster/${clusterName}/details`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to navigate to cluster';
    logger.error('Error navigating to cluster:', error);
    toast.error(errorMessage);
    callbacks.onError?.(errorMessage);
  }
};

/**
 * Validates cluster data structure
 */
export const isClusterDataValid = (data: any): data is ClusterData => {
  return data && Array.isArray(data.clusters) && typeof data.clusters === 'object';
};

/**
 * Normalizes cluster VM data to consistent format
 */
export const normalizeClusterVMs = (cluster: any) => {
  if (!cluster.vms) return [];

  return cluster.vms.map((vm: any) => ({
    vmName: vm.vmName || vm.VMName,
    vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
    vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
    fqdn: vm.fqdn || vm.FQDN,
    nodeIp: vm.nodeIp || vm.NodeIp,
    clusterName: vm.clusterName || vm.ClusterName || cluster.KubernetesClusterName,
    ...vm,
  }));
};

/**
 * Normalizes full cluster data
 */
export const normalizeClusterData = (data: ClusterData): ClusterData => {
  if (!isClusterDataValid(data)) {
    return { clusters: [] };
  }

  return {
    ...data,
    clusters: data.clusters.map((cluster) => ({
      ...cluster,
      vms: normalizeClusterVMs(cluster),
    })),
  };
};

/**
 * Filters clusters by search term
 */
export const filterClustersBySearch = (clusters: any[], searchTerm: string) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return clusters;
  }

  const term = searchTerm.toLowerCase();
  return clusters.filter(
    (cluster) =>
      cluster.KubernetesClusterName?.toLowerCase().includes(term) ||
      cluster.vms?.some((vm: any) => vm.vmName?.toLowerCase().includes(term))
  );
};

/**
 * Gets cluster by name from cluster data
 */
export const getClusterByName = (clusters: any[], clusterName: string): any | null => {
  return clusters.find((cluster) => cluster.KubernetesClusterName === clusterName) || null;
};

/**
 * Gets all VMs in a cluster
 */
export const getClusterVMs = (cluster: any): any[] => {
  return cluster?.vms || [];
};
