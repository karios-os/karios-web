import { VirtualMachine, ServerNode } from '../../SideBar-types';

/**
 * Check if a VM should be highlighted based on current URL
 */
export const shouldHighlightVmFromUrl = (
  server: ServerNode,
  vm: VirtualMachine,
  pathname: string
): boolean => {
  const pathParts = pathname.split('/');
  const serverNameFromUrl = pathParts.includes('server')
    ? pathParts[pathParts.indexOf('server') + 1]
    : null;
  const vmNameFromUrl = pathParts.includes('vm') ? pathParts[pathParts.indexOf('vm') + 1] : null;

  return server.name === serverNameFromUrl && vm.name === vmNameFromUrl;
};

/**
 * Get updated VM state for cluster VMs from Redux data
 */
export const getUpdatedVmStateForCluster = (
  vmName: string,
  vmNodeIp: string,
  fallbackState: string,
  dataCenters: any[]
): string => {
  // First, try to find the VM in the Redux dataCenters (updated by WebSocket)
  if (dataCenters) {
    for (const dc of dataCenters) {
      for (const server of dc.servers || []) {
        // Match by server IP and find the VM
        if (server.ip === vmNodeIp) {
          const vmInServer = server.vms?.find((vm: any) => vm.name === vmName);
          if (vmInServer && vmInServer.state) {
            return vmInServer.state;
          }
        }
      }
    }
  }

  return fallbackState || 'Unknown';
};

/**
 * Get the correct server IP for cluster VMs
 */
export const getServerIpForClusterVm = (
  vmName: string,
  vmNodeIp: string,
  clusterData: any,
  dataCenters: any[]
): string | null => {
  // If we have a valid nodeIp, use it
  if (vmNodeIp && vmNodeIp.trim() !== '') {
    return vmNodeIp;
  }

  // Search through cluster API data to find this VM
  if (clusterData?.clusters) {
    for (const cluster of clusterData.clusters) {
      const vmInCluster = cluster.vms?.find((v: any) => v.vmName === vmName);
      if (vmInCluster && vmInCluster.nodeIp && vmInCluster.nodeIp.trim() !== '') {
        return vmInCluster.nodeIp;
      }
    }
  }

  // Search through all servers in all data centers to find this VM
  if (dataCenters) {
    for (const dc of dataCenters) {
      for (const server of dc.servers || []) {
        const vmInServer = server.vms?.find((vm: any) => vm.name === vmName);
        if (vmInServer) {
          return server.ip;
        }
      }
    }
  }

  // If still no server found, use the first available server as fallback
  const fallbackServer = dataCenters?.[0]?.servers?.[0];
  if (fallbackServer) {
    return fallbackServer.ip;
  }
  return null;
};

/**
 * Extract server name and VM name from URL path
 */
export const extractServerAndVmFromUrl = (pathname: string) => {
  const pathParts = pathname.split('/');
  const serverName = pathParts.includes('server')
    ? pathParts[pathParts.indexOf('server') + 1]
    : null;
  const vmName = pathParts.includes('vm') ? pathParts[pathParts.indexOf('vm') + 1] : null;

  return { serverName, vmName };
};

/**
 * Check if current path is a server page
 */
export const isServerPage = (pathname: string): boolean => {
  const pathParts = pathname.split('/');
  return pathParts.includes('server');
};
