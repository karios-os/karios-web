/**
 * VM List Item Component
 * Displays a single VM in the sidebar list
 */
import React from 'react';
import { Cpu, MoreCircle } from 'iconsax-react';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

export interface VMListItemProps {
  vmId: string;
  vmName: string;
  status: 'running' | 'stopped' | 'refreshing' | 'migrating';
  isSelected?: boolean;
  isRefreshing?: boolean;
  onSelect: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const VMListItem: React.FC<VMListItemProps> = ({
  vmId,
  vmName,
  status,
  isSelected,
  isRefreshing,
  onSelect,
  onContextMenu,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'stopped':
        return 'bg-red-500';
      case 'refreshing':
        return 'bg-yellow-500';
      case 'migrating':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div
      className={`flex items-center justify-between p-1 sm:p-2 rounded text-sm cursor-pointer transition-colors border-l-3 ${
        isSelected
          ? 'bg-blue-50 text-karios-blue border-l-blue-600'
          : 'border-l-transparent hover:bg-blue-100'
      } ${isRefreshing ? 'bg-yellow-50' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
        {isRefreshing ? (
          <AiOutlineLoading3Quarters className="animate-spin h-2 w-2 sm:h-3 sm:w-3 text-yellow-500 flex-shrink-0" />
        ) : (
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${getStatusColor()}`}></span>
        )}
        <Cpu className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" color="currentColor" />
        <span
          className={`truncate text-xs sm:text-sm ${isSelected ? 'font-bold text-gray-900' : 'font-medium'}`}
          title={vmName}
        >
          {vmName}
        </span>
      </div>

      {onContextMenu && (
        <button
          className="p-0 ml-1 hover:bg-gray-200 rounded"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
          title="VM options"
        >
          <MoreCircle size={14} />
        </button>
      )}
    </div>
  );
};

export default VMListItem;
