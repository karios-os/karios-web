import React from 'react';
import { VirtualMachine } from '../SideBar-types';
import { isClusterVM, getClusterName, getClusterPrefix } from '../utils/clusterUtilities';

interface VMNameDisplayProps {
  vm: VirtualMachine;
}

/**
 * VMNameDisplay Component
 * Renders VM name with special styling for cluster VMs:
 * - Regular VMs: Standard text
 * - Cluster VMs: Prefix in gray, cluster-node name in normal color
 */
export const VMNameDisplay: React.FC<VMNameDisplayProps> = ({ vm }) => {
  // Regular VM - just display the name
  if (!isClusterVM(vm.name)) {
    return (
      <span className="text-xs sm:text-sm text-slate-500 font-lexend font-medium truncate">
        {vm.name}
      </span>
    );
  }

  // Cluster VM - show prefix in gray, cluster-node in normal color
  const clusterName = getClusterName(vm.name);
  const prefix = getClusterPrefix(vm.name);
  const nodeName = vm.name.substring(prefix.length + clusterName.length + 1); // Remove 'prefix-clustername-'

  return (
    <span className="text-xs sm:text-sm font-lexend font-medium truncate">
      <span className="text-gray-400">{prefix}</span>
      <span className="text-slate-500">
        {clusterName}-{nodeName}
      </span>
    </span>
  );
};

export default VMNameDisplay;
