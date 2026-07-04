/**
 * DataCenterSection Component
 * Renders the control-center section with data centers, servers, and VMs
 * Handles all the tree-like navigation logic for the control center
 */
import React from 'react';
import { ArrowDown2, ExternalDrive } from 'iconsax-react';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

export interface DataCenterSectionProps {
  dataCenters: any[] | null;
  openServers: Record<string, boolean>;
  loadingServers: Record<string, boolean>;
  nodeStatuses: Record<string, string>;
  selectedVm: any | null;
  selectedServer: any | null;
  onServerClick: (server: any) => void;
  onToggleServer: (serverId: string) => void;
  onVmClick: (vm: any, server: any) => void;
  onDataCenterClick: (dc: any) => void;
  onToggleDataCenter: (dcId: string) => void;
  isClusterVM: (vmName: string) => boolean;
  renderVMItem: (vm: any, server: any) => React.ReactNode;
  openDataCenters?: Record<string, boolean>;
  isLoading?: boolean;
}

export const DataCenterSection: React.FC<DataCenterSectionProps> = ({
  dataCenters,
  openServers,
  loadingServers,
  nodeStatuses,
  selectedVm,
  selectedServer,
  onServerClick,
  onToggleServer,
  onVmClick,
  onDataCenterClick,
  onToggleDataCenter,
  isClusterVM,
  renderVMItem,
  openDataCenters = {},
  isLoading = false,
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

  if (!dataCenters || dataCenters.length === 0) {
    return (
      <div className="p-2 sm:p-4 text-center">
        <div className="text-gray-500 text-xs">No data centers available</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2 sm:p-4 overflow-y-auto flex-1">
      {dataCenters.map((dc) => (
        <div key={dc.id} className="space-y-1">
          {/* Data Center Header */}
          <div
            className="flex items-center justify-between p-1 sm:p-2 cursor-pointer hover:bg-blue-100 rounded transition-colors duration-200"
            onClick={() => onDataCenterClick(dc)}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-bold text-base text-black truncate">{dc.name || dc.id}</span>
            </div>
            <ArrowDown2
              className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-[1000ms] flex-shrink-0 ${
                openDataCenters[dc.id] ? '' : 'transform -rotate-90'
              }`}
              color="#718096"
              variant="Outline"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDataCenter(dc.id);
              }}
            />
          </div>

          {/* Servers List */}
          {openDataCenters[dc.id] && dc.servers && (
            <div className="space-y-1 ml-2">
              {dc.servers.map((server) => (
                <div key={server.id} className="bg-gray-50 rounded border border-gray-100">
                  {/* Server Header */}
                  <div
                    className="flex items-center justify-between p-1 sm:p-2 cursor-pointer hover:bg-blue-100 rounded transition-colors duration-200"
                    onClick={() => onServerClick(server)}
                  >
                    <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                      <span
                        className={`h-2 w-2 rounded-full flex-shrink-0 ${
                          (nodeStatuses as unknown as Record<string, string>)?.[server.id] ===
                          'online'
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      ></span>
                      <ExternalDrive
                        className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0"
                        color="currentColor"
                      />
                      <span
                        className="text-sm sm:text-base font-medium truncate text-black"
                        title={server.name.replace(/\.karios\.ai$/, '')}
                      >
                        {server.name.replace(/\.karios\.ai$/, '')}
                      </span>
                    </div>

                    <ArrowDown2
                      className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-[1000ms] ${openServers[server.id] ? '' : 'transform -rotate-90'}`}
                      color="#718096"
                      variant="Outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleServer(server.id);
                      }}
                    />
                  </div>

                  {/* VM List */}
                  {openServers[server.id] && (
                    <div className="px-1 sm:px-2 py-1 border-t border-gray-100 bg-white">
                      {loadingServers[server.id] ? (
                        <div className="text-xs text-gray-500 italic py-1 flex items-center gap-1">
                          <AiOutlineLoading3Quarters className="animate-spin h-2 w-2 sm:h-3 sm:w-3 text-gray-500" />
                          Loading...
                        </div>
                      ) : !server.vms || server.vms.length === 0 ? (
                        <div className="text-xs text-gray-500 italic py-1">No VMs</div>
                      ) : (
                        <div className="space-y-1">
                          {server.vms
                            .filter((vm: any) => !isClusterVM(vm.name))
                            .map((vm: any) => renderVMItem(vm, server))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DataCenterSection;
