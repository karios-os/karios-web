/**
 * Resource Allocation System - Central Export Point
 *
 * Import any of these modules for resource validation:
 *
 * import ResourceAllocationService from './services/resourceAllocationService';
 * import { useResourceAllocation } from './hooks/useResourceAllocation';
 * import { ResourceAllocationDisplay } from './components/ResourceAllocationDisplay';
 * import { vmProvisioningService } from './services/vmProvisioningService';
 */

// Core Service
export { default as ResourceAllocationService } from './services/resourceAllocationService';
export type {
  NodeResources,
  VMResourceConfig,
  AllocationResult,
} from './services/resourceAllocationService';

// React Hook
export { default as useResourceAllocation } from './hooks/useResourceAllocation';

// React Component
export { ResourceAllocationDisplay } from './components/ResourceAllocationDisplay';

// Enhanced Service
export { vmProvisioningService } from './services/vmProvisioningService';
export type {
  VMProvisioningPayload,
  VMProvisioningResponse,
  NodeInfo,
} from './services/vmProvisioningService';

/**
 * Quick Start Guide
 *
 * 1. Single VM Validation:
 *    const result = ResourceAllocationService.checkAllocation(vmConfig, nodeResources);
 *
 * 2. In React Component:
 *    const { validateAllocation } = useResourceAllocation(nodeResources);
 *
 * 3. Display Resource Info:
 *    <ResourceAllocationDisplay nodeResources={nodeResources} existingConfigs={vms} />
 *
 * See RESOURCE_ALLOCATION.md for complete documentation.
 */
