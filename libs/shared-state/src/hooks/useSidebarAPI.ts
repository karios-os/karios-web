import { useCallback } from 'react';
import api from '../utils/interceptor';
import { logger } from '../utils/logger';
import { getCachedResponse, setCachedResponse } from '../utils/apiService';
import envConfig from '../../../../runtime-config';

interface VmPcieDevicesResult {
  hasDevices: boolean;
  devices: Array<{
    device: string;
    bdf: string;
    category: string;
    vendor: string;
  }>;
}

interface ClusterData {
  clusters: Array<{
    KubernetesClusterName: string;
    vms: Array<{
      vmName: string;
      vmIpAddress: string;
      vmMacAddress: string;
      fqdn: string;
      nodeIp: string;
    }>;
    bmsInfo?: Array<{
      name: string;
      ipAddress: string;
      nodeIp: string;
    }>;
  }>;
  limit?: number;
  offset?: number;
  total?: number;
  error?: string;
}

/**
 * Hook for VM and Cluster API operations
 * Centralizes all API calls used by the Sidebar component
 */
export const useSidebarAPI = () => {
  // Create console for VM (API: POST /api/v1/console/create)
  const createConsole = useCallback(async (serverIp: string, vmName: string): Promise<void> => {
    try {
      const body = JSON.stringify({
        vm_name: vmName,
        vm_host: serverIp,
      });
      const res = await fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/console/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body,
        }
      );
      if (!res.ok) {
        logger.error('Failed to create console session:', res.statusText);
        return;
      }
      await res.json();
    } catch (error) {
      logger.error('Error creating console session:', error);
    }
  }, []);

  // Check VM for PCIe devices attached
  const checkVmPcieDevices = useCallback(
    async (vmName: string, serverIp: string): Promise<VmPcieDevicesResult> => {
      try {
        const response = await fetch(
          `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/pci_devices`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          return { hasDevices: false, devices: [] };
        }

        const pcieInventory = await response.json();
        const attachedDevices: VmPcieDevicesResult['devices'] = [];

        // Check if any PCIe device is attached to the VM
        Object.entries(pcieInventory).forEach(([_deviceKey, info]: any) => {
          const funcs = info?.funcs || {};
          Object.values(funcs).forEach((fn: any) => {
            if (fn.guest_vms && fn.guest_vms.includes(vmName)) {
              attachedDevices.push({
                device: fn.device || 'Unknown Device',
                bdf: fn.bdf,
                category: info?.category || 'unknown',
                vendor: info?.vendor || 'Unknown Vendor',
              });
            }
          });
        });

        return { hasDevices: attachedDevices.length > 0, devices: attachedDevices };
      } catch (error) {
        logger.error('Error checking PCIe devices for VM:', error);
        return { hasDevices: false, devices: [] };
      }
    },
    []
  );
  // Fetch cluster data from API
  const fetchClusterData = useCallback(
    async (params?: {
      kubernetes_type?: string;
      offset?: number;
      limit?: number;
    }): Promise<ClusterData | null> => {
      try {
        let url = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`;

        // Add query parameters if provided
        if (params) {
          const queryParams = new URLSearchParams();
          if (params.kubernetes_type) queryParams.append('kubernetes_type', params.kubernetes_type);
          if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
          if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());

          const queryString = queryParams.toString();
          if (queryString) {
            url += `?${queryString}`;
          }
        }

        // Check cache first
        let data = getCachedResponse(url);
        if (!data) {
          const response = await api.fetch(url);

          if (!response.ok) {
            throw new Error(
              `Failed to fetch cluster data: ${response.status} ${response.statusText}`
            );
          }

          data = await response.json();
          setCachedResponse(url, data);
        }

        return data;
      } catch (error) {
        logger.error('Error fetching cluster data:', error);
        throw error;
      }
    },
    []
  );

  // Refresh cluster data (bypassing cache for forced refreshes)
  const refreshClusterData = useCallback(
    async (forceRefresh: boolean = false): Promise<ClusterData | null> => {
      try {
        const url = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`;

        // For forced refresh operations, bypass cache to get fresh data
        let data = forceRefresh ? null : getCachedResponse(url);
        if (!data) {
          const response = await api.fetch(url);

          if (!response.ok) {
            throw new Error(
              `Failed to refresh cluster data: ${response.status} ${response.statusText}`
            );
          }

          data = await response.json();
          setCachedResponse(url, data);
        }

        return data;
      } catch (error) {
        logger.error('Error refreshing cluster data:', error);
        throw error;
      }
    },
    []
  );

  // Fetch cluster VMs for a specific cluster
  const fetchClusterVMs = useCallback(
    async (clusterName: string, forceRefresh: boolean = false): Promise<any> => {
      try {
        const url = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info?cluster_name=${clusterName}`;

        // Check cache first (bypass cache if forceRefresh is true)
        let data = forceRefresh ? null : getCachedResponse(url);
        if (!data) {
          const response = await api.fetch(url);

          if (!response.ok) {
            throw new Error(
              `Failed to fetch cluster VMs: ${response.status} ${response.statusText}`
            );
          }

          data = await response.json();
          setCachedResponse(url, data);
        }

        return data;
      } catch (err) {
        logger.error(`Error fetching cluster VMs for ${clusterName}:`, err);
        throw err;
      }
    },
    []
  );

  // Unlock a VM
  const unlockVm = useCallback(async (vmName: string, serverIp: string): Promise<void> => {
    try {
      const response = await fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}/unlock`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to unlock VM: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Error unlocking VM:', error);
      throw error;
    }
  }, []);

  return {
    createConsole,
    checkVmPcieDevices,
    fetchClusterData,
    refreshClusterData,
    fetchClusterVMs,
    unlockVm,
  };
};
