/**
 * ServerItemWithVMs Component
 * Renders a server with its expandable VM list
 * Handles server status indicator, expansion toggle, and VM rendering
 */
import React from 'react';
import { ArrowDown2, ExternalDrive } from 'iconsax-react';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

export interface ServerItemWithVMsProps {
  server: any;
  isExpanded: boolean;
  isLoading: boolean;
  nodeStatus: string;
  isInitialPinging: boolean;
  onServerClick: () => void;
  onToggleExpand: () => void;
  renderVMList: () => React.ReactNode;
}

export const ServerItemWithVMs: React.FC<ServerItemWithVMsProps> = ({
  server,
  isExpanded,
  isLoading,
  nodeStatus,
  isInitialPinging,
  onServerClick,
  onToggleExpand,
  renderVMList,
}) => {
  return (
    <div className={`bg-gray-50 rounded border border-gray-100`}>
      <div
        className={`flex items-center justify-between p-1 sm:p-2 ${
          isInitialPinging ? 'cursor-wait bg-gray-50' : 'cursor-pointer hover:bg-blue-100'
        }`}
        onClick={onServerClick}
      >
        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
          {isInitialPinging ? (
            <AiOutlineLoading3Quarters className="animate-spin h-2 w-2 sm:h-3 sm:w-3 text-yellow-500 flex-shrink-0" />
          ) : (
            <span
              className={`h-2 w-2 rounded-full flex-shrink-0 ${nodeStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}
            ></span>
          )}
          <ExternalDrive className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" color="currentColor" />
          <span
            className="text-sm sm:text-base font-medium truncate text-black"
            title={server.name.replace(/\.karios\.ai$/, '')}
          >
            {server.name.replace(/\.karios\.ai$/, '')}
          </span>
        </div>

        <ArrowDown2
          className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-[1000ms] ${isExpanded ? '' : 'transform -rotate-90'}`}
          color="#718096"
          variant="Outline"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        />
      </div>

      {/* VM List */}
      {isExpanded && (
        <div className="px-1 sm:px-2 py-1 border-t border-gray-100 bg-white">
          {isLoading ? (
            <div className="text-xs text-gray-500 italic py-1 flex items-center gap-1">
              <AiOutlineLoading3Quarters className="animate-spin h-2 w-2 sm:h-3 sm:w-3 text-gray-500" />
              Loading...
            </div>
          ) : !server.vms || server.vms.length === 0 ? (
            <div className="text-xs text-gray-500 italic py-1">No VMs</div>
          ) : (
            <div className="space-y-1">{renderVMList()}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServerItemWithVMs;
