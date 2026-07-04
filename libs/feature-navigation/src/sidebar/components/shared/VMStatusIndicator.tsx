import React from 'react';
import { Lock } from 'iconsax-react';
import { AiOutlineSync as AiSyncIcon } from 'react-icons/ai';
import { VirtualMachine } from '../../../SideBar-types';

interface VMStatusIndicatorProps {
  vm: VirtualMachine;
  isInTransition?: boolean;
  getVmStatusColor: (vmName: string, vmState: string) => string;
}

/**
 * VMStatusIndicator Component
 * Displays the status of a VM with colored dot indicators:
 * - Lock icon for locked VMs
 * - Sync spinner for migrating VMs
 * - Colored dot for running/stopped/transitioning VMs
 */
export const VMStatusIndicator: React.FC<VMStatusIndicatorProps> = ({
  vm,
  isInTransition = false,
  getVmStatusColor,
}) => {
  // Handle locked state (case-insensitive and supports "Locked (user)")
  if (vm.state && vm.state.toLowerCase().startsWith('locked')) {
    return (
      <Lock
        className="mx-[-2px] flex-shrink-0 w-3 h-3 sm:w-4 sm:h-4"
        color="#718096"
        variant="Bold"
      />
    );
  }

  // Handle migrating state
  if ((vm.state as string) === 'migrating') {
    return (
      <div className="relative flex-shrink-0 w-3 h-3 sm:w-4 sm:h-4">
        <AiSyncIcon className="w-full h-full text-blue-500 animate-spin" />
      </div>
    );
  }

  // Default: colored status indicator dot only
  return (
    <span
      className={`h-2 w-2 rounded-full flex-shrink-0 ${getVmStatusColor(vm.name, vm.state)}`}
    ></span>
  );
};

export default VMStatusIndicator;
