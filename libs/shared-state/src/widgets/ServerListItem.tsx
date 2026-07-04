/**
 * Server List Item Component
 * Displays a single server in the sidebar list
 */
import React from 'react';
import { ExternalDrive, ArrowDown2, ArrowUp2 } from 'iconsax-react';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

export interface ServerListItemProps {
  serverId: string;
  serverName: string;
  serverIp: string;
  status: 'online' | 'offline' | 'checking' | 'blocked';
  isExpanded?: boolean;
  isSelected?: boolean;
  hasVMs?: boolean;
  vmCount?: number;
  onSelect: () => void;
  onToggleExpand?: () => void;
  onVmCountClick?: () => void;
}

export const ServerListItem: React.FC<ServerListItemProps> = ({
  serverId,
  serverName,
  serverIp,
  status,
  isExpanded,
  isSelected,
  hasVMs,
  vmCount = 0,
  onSelect,
  onToggleExpand,
  onVmCountClick,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-red-500';
      case 'checking':
        return 'animate-spin text-yellow-500';
      case 'blocked':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getBackgroundClass = () => {
    if (status === 'blocked') return 'cursor-not-allowed bg-red-50';
    if (status === 'checking') return 'cursor-wait bg-gray-100';
    return isSelected ? 'bg-blue-100' : 'cursor-pointer hover:bg-blue-100';
  };

  const displayName = serverName.replace(/\.karios\.ai$/, '');

  return (
    <div
      className={`bg-gray-50 rounded border border-gray-100 ${status === 'blocked' ? 'opacity-50' : ''}`}
    >
      <div
        className={`flex items-center justify-between p-1 sm:p-2 ${getBackgroundClass()}`}
        onClick={() => status !== 'blocked' && onSelect()}
      >
        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
          {status === 'checking' ? (
            <AiOutlineLoading3Quarters className="animate-spin h-2 w-2 sm:h-3 sm:w-3 text-yellow-500 flex-shrink-0" />
          ) : (
            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${getStatusColor()}`}></span>
          )}
          <ExternalDrive className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" color="currentColor" />
          <span
            className={`text-sm sm:text-base font-medium truncate ${
              status === 'blocked' ? 'text-gray-500' : 'text-black'
            }`}
            title={displayName}
          >
            {displayName}
          </span>
          {status === 'blocked' && <span className="text-xs text-red-500 flex-shrink-0">*</span>}
        </div>

        {hasVMs && onToggleExpand && (
          <div className="flex items-center gap-1 ml-2">
            <button
              className="text-xs bg-white px-1 py-0.5 rounded border border-gray-300 hover:bg-blue-50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onVmCountClick?.();
              }}
              title={`${vmCount} VMs`}
            >
              <span className="font-semibold text-gray-700">{vmCount}</span>
            </button>
            <button
              className="p-0.5 hover:bg-gray-200 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ArrowUp2 size={14} /> : <ArrowDown2 size={14} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerListItem;
