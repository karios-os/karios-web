import api from '../../../../shared-state/src/utils/interceptor';
import { logger } from '../../../../shared-state/src/utils/logger';
import envConfig from '../../../../../runtime-config';
import ResourceAllocationService, {
  NodeResources,
  VMResourceConfig,
  AllocationResult,
} from './resourceAllocationService';

// API Endpoints
export const VM_PROVISIONING_ENDPOINTS = {
  CLOUD_PROVISION: `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/cloudprovision`,
  NODE_INFO: `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/nodes`,
} as const;

// Types
export interface VMProvisioningPayload {
  os_type: string;
  image_name: string;
  username: string;
  password: string;
  kubernetes_cluster_name: string;
  kubernetes_type: string;
  datastore: string;
  vm_name: string;
  cpu: number;
  memory: string;
  disk_size: string;
  nw_switch: string;
  kubernetes_bootstrap?: boolean;
  kubernetes_control_plane?: boolean;
  kubernetes_worker?: boolean;
  // Anthos specific fields
  anthos_project_id?: string;
  admin_email?: string;
  anthos_cluster_type?: string;
  anthos_cluster_profile?: string;
}

export interface VMProvisioningResponse {
  message: string;
}

export interface NodeInfo {
  ip: string;
  fqdn?: string;
  hostname: string;
  cpu_cores: number;
  memory_gb: number;
  available_storage: string[];
  network_switches: string[];
}

// VM Provisioning Service
export const vmProvisioningService = {
  /**
   * Provision a cloud VM
   * @param payload - VM provisioning configuration
   * @param serverIp - Server IP address to target for provisioning
   */
  async provisionVM(
    payload: VMProvisioningPayload,
    serverIp: string
  ): Promise<VMProvisioningResponse> {
    try {
      const cloudProvisionUrl = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/cloudprovision`;
      logger.info('Provisioning VM', {
        vmName: payload.vm_name,
        serverIp: serverIp,
        url: cloudProvisionUrl,
      });

      const response = await api.fetch(cloudProvisionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `VM provisioning failed with status ${response.status}`
        );
      }

      const result: VMProvisioningResponse = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to provision VM', error);
      throw error;
    }
  },

  /**
   * Provision multiple VMs concurrently
   * @param payloads - Array of VM provisioning configurations
   * @param serverIps - Array of server IPs corresponding to each payload
   */
  async provisionMultipleVMs(
    payloads: VMProvisioningPayload[],
    serverIps: string[]
  ): Promise<VMProvisioningResponse[]> {
    try {
      const promises = payloads.map((payload, index) =>
        this.provisionVM(payload, serverIps[index])
      );
      const results = await Promise.all(promises);
      return results;
    } catch (error) {
      logger.error('Failed to provision multiple VMs', error);
      throw error;
    }
  },

  /**
   * Get available node information
   */
  async getNodeInfo(): Promise<NodeInfo[]> {
    try {
      const response = await api.fetch(VM_PROVISIONING_ENDPOINTS.NODE_INFO, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to fetch node info with status ${response.status}`
        );
      }

      const result: NodeInfo[] = await response.json();
      return result;
    } catch (error) {
      logger.error('Failed to fetch node info', error);
      throw error;
    }
  },

  /**
   * Validate resource allocation for a VM against available node resources
   * Accounts for existing allocations (control planes and worker nodes)
   */
  validateVMAllocation(
    vmConfig: VMResourceConfig,
    nodeResources: NodeResources,
    existingConfigs: VMResourceConfig[] = [],
    serverId?: string,
    excludeConfigId?: string,
    minCpuRequirement?: number,
    minMemoryRequirement?: number
  ): AllocationResult {
    return ResourceAllocationService.checkAllocation(
      vmConfig,
      nodeResources,
      existingConfigs,
      serverId,
      excludeConfigId,
      minCpuRequirement,
      minMemoryRequirement
    );
  },

  /**
   * Validate multiple VM allocations sequentially
   * Returns validation status and per-VM error details
   */
  validateMultipleVMAllocations(
    vmConfigs: VMResourceConfig[],
    nodeResources: NodeResources,
    minCpuRequirement?: number,
    minMemoryRequirement?: number
  ) {
    return ResourceAllocationService.validateProvisioning(
      vmConfigs,
      nodeResources,
      minCpuRequirement,
      minMemoryRequirement
    );
  },

  /**
   * Get available resources after existing allocations
   */
  getAvailableResources(
    nodeResources: NodeResources,
    existingConfigs: VMResourceConfig[] = [],
    serverId?: string
  ): NodeResources {
    return ResourceAllocationService.getAvailableResources(
      nodeResources,
      existingConfigs,
      serverId
    );
  },

  /**
   * Calculate total allocated resources across configurations
   */
  calculateAllocatedResources(
    configs: VMResourceConfig[],
    serverId?: string,
    excludeConfigId?: string
  ) {
    return ResourceAllocationService.calculateTotalAllocated(configs, serverId, excludeConfigId);
  },

  /**
   * Get human-readable resource summary
   */
  getResourceSummary(
    nodeResources: NodeResources,
    existingConfigs: VMResourceConfig[] = [],
    serverId?: string
  ): string {
    return ResourceAllocationService.getResourceSummary(nodeResources, existingConfigs, serverId);
  },
};
