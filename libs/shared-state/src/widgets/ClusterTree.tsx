/**
 * Kubernetes Cluster Tree Component
 * Displays cluster hierarchy with VMs
 */
import React from 'react';
import { FolderOpen, FolderMinus, Cpu } from 'iconsax-react';

export interface ClusterVM {
  id: string;
  name: string;
  ip?: string;
  status?: string;
  fqdn?: string;
}

export interface ClusterNode {
  id: string;
  name: string;
  isExpanded?: boolean;
  vms?: ClusterVM[];
  onToggleExpand?: () => void;
  onSelect?: () => void;
  onVmSelect?: (vm: ClusterVM) => void;
}

export interface ClusterTreeProps {
  clusters: ClusterNode[];
  selectedClusterId?: string;
  className?: string;
  emptyMessage?: string;
}

const VMNode: React.FC<{
  vm: ClusterVM;
  onSelect: (vm: ClusterVM) => void;
}> = ({ vm, onSelect }) => (
  <div
    className="px-4 py-1 pl-12 cursor-pointer text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors"
    onClick={() => onSelect(vm)}
  >
    <Cpu size={14} />
    <div className="flex-1 min-w-0">
      <span className="truncate block font-medium">{vm.name}</span>
      {vm.fqdn && <span className="truncate block text-xs text-gray-500">{vm.fqdn}</span>}
    </div>
    {vm.status && <span className="text-xs text-gray-500 ml-2">({vm.status})</span>}
  </div>
);

export const ClusterTree: React.FC<ClusterTreeProps> = ({
  clusters,
  selectedClusterId,
  className = 'flex flex-col gap-2 bg-white',
  emptyMessage = 'No clusters available',
}) => {
  if (!clusters || clusters.length === 0) {
    return (
      <div className={className}>
        <div className="px-4 py-2 text-sm text-gray-500 text-center">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      {clusters.map((cluster) => (
        <div key={cluster.id} className="flex flex-col border border-gray-200 rounded-lg">
          <div
            className={`px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors ${
              cluster.id === selectedClusterId ? 'bg-blue-100' : 'hover:bg-gray-100'
            }`}
            onClick={cluster.onSelect}
          >
            <button
              className="p-0 hover:bg-gray-300 rounded"
              onClick={(e) => {
                e.stopPropagation();
                cluster.onToggleExpand?.();
              }}
            >
              {cluster.isExpanded ? <FolderMinus size={16} /> : <FolderOpen size={16} />}
            </button>
            <span className="font-semibold text-sm flex-1">{cluster.name}</span>
            {cluster.vms && (
              <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                {cluster.isExpanded ? cluster.vms.length : '...'}
              </span>
            )}
          </div>
          {cluster.isExpanded && cluster.vms && cluster.vms.length > 0 && (
            <div className="bg-gray-50 border-t border-gray-200">
              {cluster.vms.map((vm) => (
                <VMNode key={vm.id} vm={vm} onSelect={cluster.onVmSelect || (() => {})} />
              ))}
            </div>
          )}
          {cluster.isExpanded && (!cluster.vms || cluster.vms.length === 0) && (
            <div className="px-4 py-2 text-sm text-gray-500 text-center bg-gray-50">
              No VMs in this cluster
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ClusterTree;
