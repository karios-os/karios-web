/**
 * KubernetesSection Component
 * Renders the kubernetes/clusters section with cluster VMs
 */
import React from 'react';
import { ArrowDown2 } from 'iconsax-react';
import { RiNodeTree, RiServerFill } from 'react-icons/ri';
import { AiOutlineSync } from 'react-icons/ai';

export interface KubernetesSSectionProps {
  clusterNames: string[];
  expandedClusters: Record<string, boolean>;
  loadingClusterVms: Record<string, boolean>;
  clusterVmsData: Record<string, any>;
  onClusterNameClick: (clusterName: string) => void;
  onToggleCluster: (clusterName: string) => void;
  onVmClick: (vmName: string) => void;
  renderVMRow?: (vm: any, clusterName: string, index: number) => React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
}

export const KubernetesSection: React.FC<KubernetesSSectionProps> = ({
  clusterNames,
  expandedClusters,
  loadingClusterVms,
  clusterVmsData,
  onClusterNameClick,
  onToggleCluster,
  onVmClick,
  renderVMRow,
  isLoading = false,
  isEmpty = false,
}) => {
  if (isLoading) {
    return (
      <div className="p-2 sm:p-4 text-center flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1 text-blue-600">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs">Loading...</span>
        </div>
      </div>
    );
  }

  if (isEmpty || clusterNames.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-gray-500 text-xs mb-3">No clusters available</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2 sm:p-4 overflow-y-auto flex-1">
      {clusterNames.map((clusterName) => {
        const isOmniServer = clusterName === 'omni';

        return (
          <div key={clusterName} className="bg-gray-50 rounded border border-gray-100">
            {/* Cluster Header */}
            <div className="flex items-center justify-between p-2">
              <div
                className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors duration-[1000ms] min-w-0 flex-1"
                onClick={() => onClusterNameClick(clusterName)}
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
                    onToggleCluster(clusterName);
                  }}
                  className="p-1 rounded transition-all duration-[1000ms] ease-in-out hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
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

            {/* Cluster VMs */}
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
                      {clusterVmsData[clusterName].vms.map((vm: any, index: number) => {
                        if (renderVMRow) {
                          return renderVMRow(vm, clusterName, index);
                        }
                        return (
                          <div
                            key={`${clusterName}-vm-${index}`}
                            className="flex items-center gap-1 py-1 px-1 rounded text-xs"
                          >
                            <span className="text-gray-700 truncate">{vm.vmName}</span>
                          </div>
                        );
                      })}
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

export default KubernetesSection;
