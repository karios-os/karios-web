import { logger } from '../../../../shared-state/src/utils/logger';

/**
 * Resource info from node
 */
export interface NodeResources {
  totalCpus: number;
  totalMemoryGB: number;
  usedCpus: number;
  usedMemoryGB: number;
}

/**
 * Configuration for a single VM/node
 */
export interface VMResourceConfig {
  cpuCores: number;
  memoryGB: number;
  serverId?: string; // Optional: track which server this config belongs to
  id?: string; // Optional: unique identifier for tracking edits
}

/**
 * Allocation result with available resources
 */
export interface AllocationResult {
  isValid: boolean;
  availableCpus: number;
  availableMemoryGB: number;
  totalCpus: number;
  totalMemoryGB: number;
  usedCpus: number;
  usedMemoryGB: number;
  allocatedCpus: number;
  allocatedMemoryGB: number;
  errors: string[];
}

/**
 * Resource Allocation Service
 * Manages resource availability checking based on node info and existing allocations
 * Accounts for control planes and worker nodes
 */
export class ResourceAllocationService {
  /**
   * Calculate total allocated resources across all configurations
   * Optionally exclude a specific configuration (useful for edit mode)
   */
  static calculateTotalAllocated(
    configs: VMResourceConfig[],
    serverId?: string,
    excludeConfigId?: string
  ): { cpus: number; memory: number } {
    let totalCpus = 0;
    let totalMemory = 0;

    configs.forEach((config) => {
      // Filter by server if provided
      if (serverId && config.serverId !== serverId) {
        return;
      }

      // Exclude specific config if provided (for edit mode)
      if (excludeConfigId && config.id === excludeConfigId) {
        return;
      }

      totalCpus += config.cpuCores;
      totalMemory += config.memoryGB;
    });

    return { cpus: totalCpus, memory: totalMemory };
  }

  /**
   * Check if resources are available for a new VM allocation
   * Returns availability status and errors if allocation would fail
   */
  static checkAllocation(
    requestedConfig: VMResourceConfig,
    nodeResources: NodeResources,
    existingConfigs: VMResourceConfig[] = [],
    serverId?: string,
    excludeConfigId?: string,
    minCpuRequirement?: number,
    minMemoryRequirement?: number
  ): AllocationResult {
    const errors: string[] = [];

    // Calculate currently allocated resources (excluding the item being validated if provided)
    const { cpus: allocatedCpus, memory: allocatedMemory } = this.calculateTotalAllocated(
      existingConfigs,
      serverId,
      excludeConfigId
    );

    // Calculate available resources
    const availableCpus = nodeResources.totalCpus - nodeResources.usedCpus - allocatedCpus;
    const availableMemoryGB =
      nodeResources.totalMemoryGB - nodeResources.usedMemoryGB - allocatedMemory;

    // Check minimum requirements first (if provided)
    if (minCpuRequirement !== undefined && requestedConfig.cpuCores < minCpuRequirement) {
      errors.push(
        `Minimum ${minCpuRequirement} CPU cores required (requested: ${requestedConfig.cpuCores})`
      );
    }

    if (minMemoryRequirement !== undefined && requestedConfig.memoryGB < minMemoryRequirement) {
      errors.push(
        `Minimum ${minMemoryRequirement}GB memory required (requested: ${requestedConfig.memoryGB}GB)`
      );
    }

    // Check if requested resources exceed available (only if minimum checks pass)
    if (errors.length === 0) {
      if (requestedConfig.cpuCores > availableCpus) {
        errors.push(
          `Insufficient CPU cores. Available: ${availableCpus} (Total: ${nodeResources.totalCpus} - Used: ${nodeResources.usedCpus} - Allocated: ${allocatedCpus})`
        );
      }

      if (requestedConfig.memoryGB > availableMemoryGB) {
        errors.push(
          `Insufficient memory. Available: ${availableMemoryGB}GB (Total: ${nodeResources.totalMemoryGB}GB - Used: ${nodeResources.usedMemoryGB}GB - Allocated: ${allocatedMemory}GB)`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      availableCpus,
      availableMemoryGB,
      totalCpus: nodeResources.totalCpus,
      totalMemoryGB: nodeResources.totalMemoryGB,
      usedCpus: nodeResources.usedCpus,
      usedMemoryGB: nodeResources.usedMemoryGB,
      allocatedCpus,
      allocatedMemoryGB: allocatedMemory,
      errors,
    };
  }

  /**
   * Validate a list of VMs to be provisioned
   * Returns overall validation status and per-VM errors
   */
  static validateProvisioning(
    vmConfigs: VMResourceConfig[],
    nodeResources: NodeResources,
    minCpuRequirement?: number,
    minMemoryRequirement?: number
  ): {
    isValid: boolean;
    results: Map<string, AllocationResult>;
  } {
    const results = new Map<string, AllocationResult>();
    let isValid = true;

    vmConfigs.forEach((config, index) => {
      const configId = config.id || `vm-${index}`;

      // Calculate already allocated by previous VMs in this batch
      const previousConfigs = vmConfigs.slice(0, index);
      const { cpus: priorAllocatedCpus, memory: priorAllocatedMemory } =
        this.calculateTotalAllocated(previousConfigs);

      // Adjust available resources for sequential validation
      const adjustedNode: NodeResources = {
        totalCpus: nodeResources.totalCpus,
        totalMemoryGB: nodeResources.totalMemoryGB,
        usedCpus: nodeResources.usedCpus + priorAllocatedCpus,
        usedMemoryGB: nodeResources.usedMemoryGB + priorAllocatedMemory,
      };

      const result = this.checkAllocation(
        config,
        adjustedNode,
        [],
        undefined,
        undefined,
        minCpuRequirement,
        minMemoryRequirement
      );

      results.set(configId, result);
      if (!result.isValid) {
        isValid = false;
      }
    });

    return { isValid, results };
  }

  /**
   * Calculate remaining available resources after allocation
   */
  static getAvailableResources(
    nodeResources: NodeResources,
    existingConfigs: VMResourceConfig[] = [],
    serverId?: string
  ): NodeResources {
    const { cpus: allocatedCpus, memory: allocatedMemory } = this.calculateTotalAllocated(
      existingConfigs,
      serverId
    );

    return {
      totalCpus: nodeResources.totalCpus,
      totalMemoryGB: nodeResources.totalMemoryGB,
      usedCpus: nodeResources.usedCpus + allocatedCpus,
      usedMemoryGB: nodeResources.usedMemoryGB + allocatedMemory,
    };
  }

  /**
   * Get a formatted summary of resource usage for UI display
   */
  static getResourceSummary(
    nodeResources: NodeResources,
    existingConfigs: VMResourceConfig[] = [],
    serverId?: string
  ): string {
    const available = this.getAvailableResources(nodeResources, existingConfigs, serverId);
    const remainingCpus = available.totalCpus - available.usedCpus;
    const remainingMemory = available.totalMemoryGB - available.usedMemoryGB;

    return `CPU: ${remainingCpus}/${available.totalCpus} available | Memory: ${remainingMemory}GB/${available.totalMemoryGB}GB available`;
  }
}

export default ResourceAllocationService;
