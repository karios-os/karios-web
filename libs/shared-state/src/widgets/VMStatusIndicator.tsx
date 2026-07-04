import React from 'react';
import { Lock } from 'iconsax-react';
import { AiOutlineSync } from 'react-icons/ai';

export interface VMStatusIndicatorProps {
  vmName: string;
  vmState: string;
  isVmInTransition: boolean;
  getVmStatusColor: (vmName: string, vmState: string) => string;
}

/**
 * VM Status Indicator - Shows the status icon (green/red/yellow/sync) for a VM
 * Reusable component for both Control Center and Kubernetes sections
 */
export const VMStatusIndicator: React.FC<VMStatusIndicatorProps> = ({
  vmName,
  vmState,
  isVmInTransition,
  getVmStatusColor,
}) => {
  if (vmState === 'Locked') {
    return (
      <Lock
        className="mx-[-2px] flex-shrink-0 w-3 h-3 sm:w-4 sm:h-4 text-gray-500"
        variant="Bold"
      />
    );
  }

  if (vmState === 'migrating') {
    return (
      <div className="relative flex-shrink-0 w-3 h-3 sm:w-4 sm:h-4">
        <AiOutlineSync className="w-full h-full text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <span
      className={`h-10 w-10 rounded-full flex-shrink-0 ${getVmStatusColor(vmName, vmState)}`}
    ></span>
  );
};

export default VMStatusIndicator;
