/**
 * SidebarClustersSection Component
 * Renders the clusters/Kubernetes view with cluster list, expansion, and VM actions
 */
import React from 'react';
import { ArrowDown2, More } from 'iconsax-react';
import { RiNodeTree, RiServerFill } from 'react-icons/ri';
import { AiOutlineSync } from 'react-icons/ai';

export interface SidebarClustersSectionProps {
  clusterData: any;
  clusterVmsData: Record<string, any>;
  expandedClusters: Record<string, boolean>;
  loadingClusterVms: Record<string, boolean>;
  dropdownOpen: string | null;
  isLoadingClusters: boolean;
  clusterError: string | null;
  onClusterNameClick: (clusterName: string) => void;
  onClusterDropdownToggle: (clusterName: string) => void;
  onDropdownOpen: (key: string | null) => void;
  getAllClusters: () => Record<string, any>;
  sortClusterVMs: (vms: any[]) => any[];
  isVmNameRestricted: (name: string) => boolean;
  renderClusterVMActions: (vm: any, clusterName: string, isVmOn: boolean) => React.ReactNode;
}

export const SidebarClustersSection: React.FC<SidebarClustersSectionProps> = ({
  clusterData,
  clusterVmsData,
  expandedClusters,
  loadingClusterVms,
  dropdownOpen,
  isLoadingClusters,
  clusterError,
  onClusterNameClick,
  onClusterDropdownToggle,
  onDropdownOpen,
  getAllClusters,
  sortClusterVMs,
  isVmNameRestricted,
  renderClusterVMActions,
}) => {
  if (isLoadingClusters) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center gap-1 text-blue-600">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs">Loading...</span>
        </div>
      </div>
    );
  }

  if (clusterError && !isLoadingClusters) {
    return (
      <div className="py-4 text-center">
        <div className="text-gray-700 text-xs">{clusterError}</div>
      </div>
    );
  }

  if (!isLoadingClusters && !clusterError && clusterData && clusterData.error) {
    return (
      <div className="py-4 text-center">
        <div className="text-yellow-600 text-xs">{clusterData.error}</div>
      </div>
    );
  }

  const clusters = getAllClusters();
  const clusterNames = Object.keys(clusters).sort((a, b) => {
    if (a === 'omni' && b !== 'omni') return -1;
    if (b === 'omni' && a !== 'omni') return 1;
    return a.localeCompare(b);
  });

  if (clusterNames.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-gray-500 text-xs mb-3">No clusters available</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {clusterNames.map((clusterName) => {
        const isOmniServer = clusterName === 'omni';
        const isVipCluster = clusterName.includes('-vip-');

        return (
          <div key={clusterName} className="bg-gray-50 rounded border border-gray-100">
            <div className="flex items-center justify-between p-2">
              <div
                className={`flex items-center gap-2 transition-colors duration-[1000ms] min-w-0 flex-1 ${
                  isVipCluster
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:text-blue-600'
                }`}
                onClick={() => !isVipCluster && onClusterNameClick(clusterName)}
                title={isVipCluster ? 'VIP clusters are read-only' : undefined}
              >
                {isOmniServer ? (
                  <RiServerFill size={12} color="currentColor" className="flex-shrink-0" />
                ) : (
                  <RiNodeTree size={12} color="currentColor" className="flex-shrink-0" />
                )}
                <span className="font-medium text-base text-black truncate">{clusterName}</span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClusterDropdownToggle(clusterName);
                  }}
                  className={`p-1 rounded transition-all duration-[1000ms] ease-in-out hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                  title={expandedClusters[clusterName] ? 'Collapse cluster' : 'Expand cluster'}
                >
                  <ArrowDown2
                    size={12}
                    color="#6B7280"
                    className={`transition-all duration-[1000ms] ease-in-out ${expandedClusters[clusterName] ? 'rotate-0' : 'rotate-[-90deg]'}`}
                  />
                </button>
              </div>
            </div>

            {expandedClusters[clusterName] && (
              <div className="px-2 py-1 border-t border-gray-100 bg-white">
                {loadingClusterVms[clusterName] && (
                  <div className="flex items-center gap-1 py-1 text-blue-600">
                    <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-blue-600"></div>
                    <span className="text-xs">Loading...</span>
                  </div>
                )}

                {clusterVmsData[clusterName] &&
                  !loadingClusterVms[clusterName] &&
                  clusterVmsData[clusterName].vms &&
                  clusterVmsData[clusterName].vms.length > 0 && (
                    <div className="space-y-1">
                      {sortClusterVMs(clusterVmsData[clusterName].vms || []).map(
                        (vm: any, index: number) => {
                          const vmKey = `${clusterName}-vm-${index}`;
                          const isVmOn = vm.state?.toLowerCase() === 'running';
                          const isInTransition = vm.state === 'migrating';
                          const isVipVm = vm.vmName?.includes('-vip');

                          return (
                            <div key={vmKey} className="relative">
                              <div
                                className={`flex items-center gap-1 py-1 px-1 rounded min-w-0 ${
                                  isVipVm
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-blue-100 cursor-pointer'
                                }`}
                                title={isVipVm ? 'VIP VMs are read-only' : undefined}
                              >
                                {isInTransition ? (
                                  <div className="relative flex-shrink-0 w-3 h-3">
                                    <AiOutlineSync className="w-full h-full text-blue-500 animate-spin" />
                                  </div>
                                ) : (
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isVmOn ? 'bg-green-500' : 'bg-red-500'}`}
                                  />
                                )}
                                <span
                                  className="text-xs text-gray-700 flex-1 truncate"
                                  title={vm.vmName || 'Unknown'}
                                >
                                  {vm.vmName || 'Unknown'}
                                </span>

                                {/* VM Actions Dropdown */}
                                <div className="relative">
                                  <button
                                    data-dropdown-button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        !isInTransition &&
                                        !isVmNameRestricted(vm.vmName) &&
                                        !isVipVm
                                      ) {
                                        onDropdownOpen(dropdownOpen === vmKey ? null : vmKey);
                                      }
                                    }}
                                    className={`p-1 rounded transition-colors duration-[1000ms] ${isInTransition || isVmNameRestricted(vm.vmName) || isVipVm ? 'cursor-not-allowed opacity-50' : 'hover:bg-blue-100'}`}
                                    disabled={
                                      isInTransition || isVmNameRestricted(vm.vmName) || isVipVm
                                    }
                                    title={
                                      isVipVm
                                        ? 'VIP VMs are read-only'
                                        : isInTransition
                                          ? 'VM is currently in transition'
                                          : isVmNameRestricted(vm.vmName)
                                            ? 'VM actions not available for technical VMs'
                                            : 'VM actions'
                                    }
                                  >
                                    <More
                                      size={12}
                                      color={
                                        isInTransition || isVmNameRestricted(vm.vmName) || isVipVm
                                          ? '#9CA3AF'
                                          : '#718096'
                                      }
                                      variant="Outline"
                                      style={{ transform: 'rotate(90deg)' }}
                                      className={`${isInTransition || isVmNameRestricted(vm.vmName) || isVipVm ? 'opacity-50' : 'hover:opacity-70'}`}
                                      data-dropdown-button
                                    />
                                  </button>

                                  {dropdownOpen === vmKey &&
                                    !isVmNameRestricted(vm.vmName) &&
                                    !isVipVm && (
                                      <div
                                        data-dropdown-menu
                                        className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-50"
                                      >
                                        {isInTransition && (
                                          <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-200 bg-yellow-50">
                                            {vm.state === 'migrating'
                                              ? 'VM is migrating...'
                                              : 'VM in transition...'}
                                          </div>
                                        )}
                                        {renderClusterVMActions(vm, clusterName, isVmOn)}
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SidebarClustersSection;
