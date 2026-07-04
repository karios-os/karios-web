/**
 * Cluster Utilities
 * Functions for working with Kubernetes cluster VM naming conventions and management
 */

/**
 * Determines if a VM is part of a Kubernetes cluster based on naming patterns
 */
export const isClusterVM = (vmName: string): boolean => {
  // Check for Anthos, OpenShift, Ubuntu, Kubernetes, K3s, or Omni cluster VMs with prefixes
  if (
    vmName.startsWith('an-') ||
    vmName.startsWith('op-') ||
    vmName.startsWith('ub-') ||
    vmName.startsWith('k8s-') ||
    vmName.startsWith('k3s-') ||
    vmName.startsWith('om-')
  ) {
    return true;
  }

  // Check for Omni servers by name pattern (omni, omniserver, omni1, omni2, etc.)
  if (vmName.toLowerCase().startsWith('omniserver')) {
    return true;
  }

  return false;
};

/**
 * Get cluster prefix based on cluster type
 */
export const getClusterPrefix = (vmName: string): string => {
  if (vmName.startsWith('an-')) return 'an-';
  if (vmName.startsWith('op-')) return 'op-';
  if (vmName.startsWith('ub-')) return 'ub-';
  if (vmName.startsWith('k8s-')) return 'k8s-';
  if (vmName.startsWith('k3s-')) return 'k3s-';
  if (vmName.startsWith('om-')) return 'om-';
  // Handle Omni servers with non-prefix naming (omni, omniserver, omni1, etc.)
  if (vmName.toLowerCase().startsWith('omniserver')) return 'omniserver';
  return '';
};

/**
 * Extract cluster name from VM name
 * Examples: op-test-master -> test, ub-ubuntu-ms -> ubuntu, k8s-production-worker1 -> production
 */
export const getClusterName = (vmName: string): string => {
  if (!isClusterVM(vmName)) return '';
  const prefix = getClusterPrefix(vmName);
  if (!prefix) return '';

  // Handle Omni servers without prefixes - treat all as "omni" cluster
  if (prefix === 'omniserver') {
    return 'omniserver';
  }

  // Remove prefix and split by '-'
  const withoutPrefix = vmName.substring(prefix.length);
  const parts = withoutPrefix.split('-');

  // For cluster VMs, the cluster name is typically the first part after prefix
  return parts[0] || '';
};

/**
 * Get the full cluster name including prefix (for API calls and events)
 * Examples: op-test-master -> op-test, ub-ubuntu-ms -> ub-ubuntu, k3s-test60-worker1 -> k3s-test60
 */
export const getFullClusterName = (vmName: string): string => {
  if (!isClusterVM(vmName)) return '';
  const prefix = getClusterPrefix(vmName);
  const baseName = getClusterName(vmName);

  if (!prefix || !baseName) return '';

  // Handle Omni servers
  if (prefix === 'omniserver') {
    return 'omniserver';
  }

  // Return full cluster name: prefix + baseName
  return prefix + baseName;
};

/**
 * Check if this is the last cluster VM being deleted
 * Used for notifications and cleanup logic
 */
export const isLastClusterVM = (vmName: string, dataCenters: any[]): boolean => {
  if (!isClusterVM(vmName)) return false;

  const clusterName = getClusterName(vmName);
  if (!clusterName) return false;

  // Count total cluster VMs across all servers for this cluster
  let totalClusterVMs = 0;

  dataCenters?.forEach((dc) => {
    dc.servers?.forEach((server) => {
      server.vms?.forEach((vm: any) => {
        if (getClusterName(vm.name) === clusterName) {
          totalClusterVMs++;
        }
      });
    });
  });

  // True if only 1 cluster VM exists (the one being deleted)
  return totalClusterVMs === 1;
};

/**
 * Extract cluster VMs from dataCenters organized by cluster name
 */
export const getClusterVMs = (vmName: string, dataCenters: any[]): any[] => {
  if (!isClusterVM(vmName)) return [];

  const clusterName = getClusterName(vmName);
  if (!clusterName) return [];

  const clusterVMs: any[] = [];

  dataCenters?.forEach((dc) => {
    dc.servers?.forEach((server) => {
      server.vms?.forEach((vm: any) => {
        if (getClusterName(vm.name) === clusterName) {
          clusterVMs.push(vm);
        }
      });
    });
  });

  return clusterVMs;
};

/**
 * Get all unique cluster names from dataCenters
 */
export const getAllClusterNames = (dataCenters: any[]): string[] => {
  const clusterNames = new Set<string>();

  dataCenters?.forEach((dc) => {
    dc.servers?.forEach((server) => {
      server.vms?.forEach((vm: any) => {
        if (isClusterVM(vm.name)) {
          const clusterName = getClusterName(vm.name);
          if (clusterName) {
            clusterNames.add(clusterName);
          }
        }
      });
    });
  });

  return Array.from(clusterNames);
};

/**
 * Get all VMs for a specific cluster across all servers
 */
export const getVMsForCluster = (clusterName: string, dataCenters: any[]): any[] => {
  const vms: any[] = [];

  dataCenters?.forEach((dc) => {
    dc.servers?.forEach((server) => {
      server.vms?.forEach((vm: any) => {
        if (getClusterName(vm.name) === clusterName) {
          vms.push({ ...vm, serverIp: server.ip });
        }
      });
    });
  });

  return vms;
};

/**
 * Count VMs for a specific cluster
 */
export const getClusterVMCount = (clusterName: string, dataCenters: any[]): number => {
  return getVMsForCluster(clusterName, dataCenters).length;
};
