import { useState, useCallback, useMemo } from 'react';
import ResourceAllocationService, {
  NodeResources,
  VMResourceConfig,
  AllocationResult,
} from '../services/resourceAllocationService';

/**
 * Hook for managing resource allocation validation
 * Provides methods to validate VM allocations and track available resources
 */
export const useResourceAllocation = (nodeResources?: NodeResources) => {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [lastValidationResult, setLastValidationResult] = useState<AllocationResult | null>(null);

  /**
   * Check if a single VM can be allocated
   */
  const validateAllocation = useCallback(
    (
      vmConfig: VMResourceConfig,
      existingConfigs: VMResourceConfig[] = [],
      serverId?: string,
      excludeConfigId?: string,
      minCpuRequirement?: number,
      minMemoryRequirement?: number
    ): AllocationResult | null => {
      if (!nodeResources) {
        setValidationErrors(['Node resources not available']);
        return null;
      }

      const result = ResourceAllocationService.checkAllocation(
        vmConfig,
        nodeResources,
        existingConfigs,
        serverId,
        excludeConfigId,
        minCpuRequirement,
        minMemoryRequirement
      );

      setValidationErrors(result.errors);
      setLastValidationResult(result);
      return result;
    },
    [nodeResources]
  );

  /**
   * Validate multiple VMs to be provisioned
   */
  const validateMultipleVMs = useCallback(
    (vmConfigs: VMResourceConfig[], minCpuRequirement?: number, minMemoryRequirement?: number) => {
      if (!nodeResources) {
        setValidationErrors(['Node resources not available']);
        return null;
      }

      const { isValid, results } = ResourceAllocationService.validateProvisioning(
        vmConfigs,
        nodeResources,
        minCpuRequirement,
        minMemoryRequirement
      );

      // Collect all errors from validation results
      const allErrors: string[] = [];
      results.forEach((result) => {
        if (!result.isValid) {
          allErrors.push(...result.errors);
        }
      });

      setValidationErrors(allErrors);
      return { isValid, results };
    },
    [nodeResources]
  );

  /**
   * Get available resources
   */
  const getAvailable = useCallback(
    (existingConfigs: VMResourceConfig[] = [], serverId?: string) => {
      if (!nodeResources) return null;
      return ResourceAllocationService.getAvailableResources(
        nodeResources,
        existingConfigs,
        serverId
      );
    },
    [nodeResources]
  );

  /**
   * Get human-readable resource summary
   */
  const getResourceSummary = useCallback(
    (existingConfigs: VMResourceConfig[] = [], serverId?: string): string => {
      if (!nodeResources) return 'Node resources not available';
      return ResourceAllocationService.getResourceSummary(nodeResources, existingConfigs, serverId);
    },
    [nodeResources]
  );

  /**
   * Calculate total allocated resources
   */
  const calculateAllocated = useCallback(
    (configs: VMResourceConfig[], serverId?: string, excludeConfigId?: string) => {
      return ResourceAllocationService.calculateTotalAllocated(configs, serverId, excludeConfigId);
    },
    []
  );

  /**
   * Determine if allocation is possible for quick checks
   */
  const canAllocate = useCallback(
    (
      cpuCores: number,
      memoryGB: number,
      existingConfigs: VMResourceConfig[] = [],
      serverId?: string
    ): boolean => {
      if (!nodeResources) return false;

      const result = ResourceAllocationService.checkAllocation(
        { cpuCores, memoryGB },
        nodeResources,
        existingConfigs,
        serverId
      );

      return result.isValid;
    },
    [nodeResources]
  );

  return {
    validateAllocation,
    validateMultipleVMs,
    getAvailable,
    getResourceSummary,
    calculateAllocated,
    canAllocate,
    validationErrors,
    lastValidationResult,
    isReady: !!nodeResources,
  };
};

export default useResourceAllocation;
