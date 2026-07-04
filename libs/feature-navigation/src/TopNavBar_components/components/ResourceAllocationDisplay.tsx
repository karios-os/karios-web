import React from 'react';
import { NodeResources, VMResourceConfig } from '../services/resourceAllocationService';
import ResourceAllocationService from '../services/resourceAllocationService';

interface ResourceAllocationDisplayProps {
  nodeResources: NodeResources;
  existingConfigs?: VMResourceConfig[];
  serverId?: string;
  showDetailed?: boolean;
  className?: string;
}

/**
 * Component to display resource allocation information
 * Shows available vs. used/allocated resources in a clean format
 */
export const ResourceAllocationDisplay: React.FC<ResourceAllocationDisplayProps> = ({
  nodeResources,
  existingConfigs = [],
  serverId,
  showDetailed = false,
  className = '',
}) => {
  const available = ResourceAllocationService.getAvailableResources(
    nodeResources,
    existingConfigs,
    serverId
  );

  const { cpus: allocatedCpus, memory: allocatedMemory } =
    ResourceAllocationService.calculateTotalAllocated(existingConfigs, serverId);

  const remainingCpus = available.totalCpus - available.usedCpus;
  const remainingMemory = available.totalMemoryGB - available.usedMemoryGB;

  const cpuPercentage = (available.usedCpus / available.totalCpus) * 100;
  const memoryPercentage = (available.usedMemoryGB / available.totalMemoryGB) * 100;

  const getCpuColor = (percentage: number) => {
    if (percentage > 80) return 'bg-red-200';
    if (percentage > 60) return 'bg-yellow-200';
    return 'bg-green-200';
  };

  const getMemoryColor = (percentage: number) => {
    if (percentage > 80) return 'bg-red-200';
    if (percentage > 60) return 'bg-yellow-200';
    return 'bg-green-200';
  };

  return (
    <div className={`p-4 bg-gray-50 rounded-lg border border-gray-200 ${className}`}>
      <div className="space-y-3">
        {/* CPU Section */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">CPU Cores</span>
            <span className="text-xs font-medium text-gray-600">
              {remainingCpus} / {available.totalCpus} available
            </span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getCpuColor(cpuPercentage)}`}
              style={{ width: `${Math.min(cpuPercentage, 100)}%` }}
            />
          </div>
          {showDetailed && (
            <div className="text-xs text-gray-600 mt-1">
              Used: {available.usedCpus} | Allocated: {allocatedCpus} | Total: {available.totalCpus}
            </div>
          )}
        </div>

        {/* Memory Section */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">Memory (GB)</span>
            <span className="text-xs font-medium text-gray-600">
              {remainingMemory.toFixed(1)} / {available.totalMemoryGB.toFixed(1)} available
            </span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getMemoryColor(memoryPercentage)}`}
              style={{ width: `${Math.min(memoryPercentage, 100)}%` }}
            />
          </div>
          {showDetailed && (
            <div className="text-xs text-gray-600 mt-1">
              Used: {available.usedMemoryGB.toFixed(1)}GB | Allocated: {allocatedMemory.toFixed(1)}
              GB | Total: {available.totalMemoryGB.toFixed(1)}GB
            </div>
          )}
        </div>

        {/* Status Indicator */}
        <div className="pt-2">
          {remainingCpus <= 0 || remainingMemory <= 0 ? (
            <div className="text-xs text-red-600 font-medium">
              ⚠️ Insufficient resources available
            </div>
          ) : (
            <div className="text-xs text-green-600 font-medium">
              ✓ Resources available for allocation
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourceAllocationDisplay;
