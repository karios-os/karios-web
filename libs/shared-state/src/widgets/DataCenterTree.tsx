/**
 * DataCenter Tree Component
 * Displays hierarchical view of datacenters, servers, and VMs
 */
import React from 'react';
import { FolderOpen, FolderMinus, Cpu } from 'iconsax-react';
import { RiServerFill } from 'react-icons/ri';

export interface VMTreeItem {
  id: string;
  name: string;
  status?: string;
  isOn?: boolean;
  type: 'vm';
}

export interface ServerTreeItem {
  id: string;
  name: string;
  ip: string;
  isLoading?: boolean;
  isExpanded?: boolean;
  vms?: VMTreeItem[];
  type: 'server';
  onToggleExpand?: () => void;
  onSelect?: () => void;
  onVmSelect?: (vm: VMTreeItem) => void;
}

export interface DataCenterTreeItem {
  id: string;
  name: string;
  isExpanded?: boolean;
  isVisible?: boolean;
  servers?: ServerTreeItem[];
  type: 'datacenter';
  onToggleExpand?: () => void;
  onToggleVisibility?: () => void;
  onSelect?: () => void;
}

export interface DataCenterTreeProps {
  dataCenters: DataCenterTreeItem[];
  selectedServerId?: string;
  selectedVmId?: string;
  className?: string;
}

const VMTreeNode: React.FC<{
  vm: VMTreeItem;
  isSelected?: boolean;
  onSelect: (vm: VMTreeItem) => void;
}> = ({ vm, isSelected, onSelect }) => (
  <div
    className={`px-4 py-1 pl-12 cursor-pointer text-sm flex items-center gap-2 transition-colors ${
      isSelected ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
    }`}
    onClick={() => onSelect(vm)}
  >
    <Cpu size={14} />
    <span className="truncate">{vm.name}</span>
    {vm.status && <span className="text-xs text-gray-500">({vm.status})</span>}
  </div>
);

const ServerTreeNode: React.FC<{
  server: ServerTreeItem;
  isSelected?: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}> = ({ server, isSelected, onSelect, onToggleExpand }) => (
  <div className="flex flex-col">
    <div
      className={`px-4 py-1 pl-8 cursor-pointer flex items-center gap-2 transition-colors ${
        isSelected ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
      }`}
    >
      <button
        className="p-0 hover:bg-gray-200 rounded"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        {server.isExpanded ? <FolderMinus size={16} /> : <FolderOpen size={16} />}
      </button>
      <RiServerFill size={16} />
      <span className="flex-1 text-sm font-medium truncate">{server.name}</span>
      <span className="text-xs text-gray-500">{server.ip}</span>
    </div>
    {server.isExpanded && server.vms && (
      <div className="bg-gray-50">
        {server.vms.map((vm) => (
          <VMTreeNode
            key={vm.id}
            vm={vm}
            isSelected={false}
            onSelect={server.onVmSelect || (() => {})}
          />
        ))}
      </div>
    )}
  </div>
);

export const DataCenterTree: React.FC<DataCenterTreeProps> = ({
  dataCenters,
  selectedServerId,
  selectedVmId,
  className = 'flex flex-col gap-1 bg-white',
}) => {
  return (
    <div className={className}>
      {dataCenters.map((dc) => (
        <div key={dc.id} className="flex flex-col">
          <div
            className="px-2 py-1 cursor-pointer flex items-center gap-2 hover:bg-gray-100 transition-colors font-semibold text-sm"
            onClick={dc.onSelect}
          >
            <button
              className="p-0 hover:bg-gray-200 rounded"
              onClick={(e) => {
                e.stopPropagation();
                dc.onToggleExpand?.();
              }}
            >
              {dc.isExpanded ? <FolderMinus size={18} /> : <FolderOpen size={18} />}
            </button>
            <span>{dc.name}</span>
            {dc.isVisible !== undefined && (
              <button
                className="ml-auto text-xs opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  dc.onToggleVisibility?.();
                }}
              >
                {dc.isVisible ? '👁️' : '👁️‍🗨️'}
              </button>
            )}
          </div>
          {dc.isExpanded && dc.servers && (
            <div className="pl-2 border-l border-gray-200">
              {dc.servers.map((server) => (
                <ServerTreeNode
                  key={server.id}
                  server={server}
                  isSelected={server.id === selectedServerId}
                  onSelect={server.onSelect || (() => {})}
                  onToggleExpand={server.onToggleExpand || (() => {})}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DataCenterTree;
