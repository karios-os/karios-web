import React, { useState, useRef } from 'react';
import { ExternalDrive, ArrowDown2, More } from 'iconsax-react';
import { AiOutlineLoading3Quarters, AiOutlineSync } from 'react-icons/ai';
import { toast } from 'react-toastify';
import { VirtualMachine, ServerNode, DataCenter } from '../../../SideBar-types';
import { isClusterVM } from '../../../utils/clusterUtilities';
import { isVmNameRestricted } from '../../../utils/vmHandlers';

interface ControlCenterProps {
  dataCenters: DataCenter[];
  openServers: Record<string, boolean>;
  loadingServers: Record<string, boolean>;
  dropdownVmName: string | null;
  nodeStatuses: Record<string, string> | any[];
  refreshingVms: Record<string, boolean>;
  vmActionStatuses: Record<string, any>;
  initialPingInProgress: Set<string>;
  selectedVm: VirtualMachine | null;
  newServerDropdownSelected: string | boolean | null;
  controlCenterTab: 'nodes' | 'vms';
  vmsList?: VirtualMachine[];
  isLoadingVmsList?: boolean;
  searchTerm?: string;

  // Handlers
  onToggleServerVisibility: (serverId: string) => Promise<void>;
  onServerClick: (server: ServerNode) => void;
  onVmClick: (vm: VirtualMachine, server: ServerNode) => void;
  onToggleVmDropdown: (vmName: string) => void;
  onToggleVmPower: (
    vmName: string,
    isOn: boolean,
    serverIp: string,
    vmUuid?: string
  ) => Promise<void>;
  onRenameVm: (vm: VirtualMachine, serverIp: string) => Promise<void>;
  onCloneVm: (vm: VirtualMachine, serverIp: string) => Promise<void>;
  onRestartVm: (vmName: string, serverIp: string, vmUuid?: string) => Promise<void>;
  onResetVm: (vmName: string, serverIp: string, vmUuid?: string) => Promise<void>;
  onPowerOffVm: (vmName: string, serverIp: string, vmUuid?: string) => Promise<void>;
  onUnlockVm: (vmName: string, serverIp: string) => Promise<void>;
  onDeleteVm: (vm: VirtualMachine, serverIp: string) => Promise<void>;

  // Helper functions
  onGetVmStatusColor: (vmName: string, vmState: string) => string;
  onIsVmInAnyTransition: (vmName: string, vmState?: string) => boolean;
  onRenderVMItem: (
    vm: VirtualMachine,
    server: ServerNode,
    extraClassName?: string
  ) => React.ReactNode;
  onShouldHighlightVmFromUrl: (server: ServerNode, vm: VirtualMachine) => boolean;
}

export const ControlCenter: React.FC<ControlCenterProps> = ({
  dataCenters,
  openServers,
  loadingServers,
  dropdownVmName,
  nodeStatuses,
  refreshingVms,
  vmActionStatuses,
  initialPingInProgress,
  selectedVm,
  newServerDropdownSelected,
  controlCenterTab,
  vmsList = [],
  isLoadingVmsList = false,
  searchTerm = '',
  onToggleServerVisibility,
  onServerClick,
  onVmClick,
  onToggleVmDropdown,
  onToggleVmPower,
  onRenameVm,
  onCloneVm,
  onRestartVm,
  onResetVm,
  onPowerOffVm,
  onUnlockVm,
  onDeleteVm,
  onGetVmStatusColor,
  onIsVmInAnyTransition,
  onRenderVMItem,
  onShouldHighlightVmFromUrl,
}) => {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [vmStatusTab, setVmStatusTab] = useState<'active' | 'inactive'>('active');

  // Filter servers and VMs within servers based on search term
  const filterServersAndVMs = (servers: ServerNode[]) => {
    if (!searchTerm.trim()) return servers;

    const lowerSearch = searchTerm.toLowerCase();

    return servers
      .map((server) => {
        // Check if server matches search
        const serverMatches =
          server.name.toLowerCase().includes(lowerSearch) ||
          server.ip?.toLowerCase().includes(lowerSearch);

        // Filter VMs under this server
        const filteredVms =
          server.vms?.filter((vm) => vm.name.toLowerCase().includes(lowerSearch)) || [];

        // Include server if:
        // 1. Server name/IP matches (show all its VMs), OR
        // 2. Any VMs under it match the search (show only matching VMs)
        if (serverMatches) {
          // Server matches - show it with all its original VMs
          return server;
        } else if (filteredVms.length > 0) {
          // VMs match but server doesn't - show server with only matching VMs
          return {
            ...server,
            vms: filteredVms,
          };
        }

        return null;
      })
      .filter((server): server is Exclude<typeof server, null> => server !== null);
  };

  // Filter VMs based on search term
  const filteredVmsList = vmsList.filter((vm) => {
    if (!searchTerm.trim()) return true;
    const lowerSearch = searchTerm.toLowerCase();
    return vm.name.toLowerCase().includes(lowerSearch);
  });

  // Show Nodes tab (server view with VMs under each server)
  if (controlCenterTab === 'nodes') {
    const allServers = (dataCenters || []).flatMap((dc) => dc.servers || []);
    const filteredServers = filterServersAndVMs(allServers);

    return (
      <div data-testid="sidebar-server-list" className="space-y-1 sm:space-y-2">
        {filteredServers.map((server: ServerNode) => {
          const isInitialPinging = initialPingInProgress.has(server.id || server.ip);

          return (
            <div key={server.id} className={`bg-gray-50 rounded border border-gray-100`}>
              <div
                data-testid={`server-node-${server.id}`}
                className={`flex items-center justify-between gap-2 px-1 sm:px-2 py-1 sm:py-1.5 ${
                  isInitialPinging ? 'cursor-wait bg-gray-50' : 'cursor-pointer hover:bg-blue-100'
                }`}
                onClick={() => onServerClick(server)}
              >
                <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                  {isInitialPinging ? (
                    <AiOutlineLoading3Quarters className="animate-spin h-2 w-2 sm:h-3 sm:w-3 text-yellow-500 flex-shrink-0" />
                  ) : (
                    <span
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        (nodeStatuses as unknown as Record<string, string>)?.[server.id] ===
                        'online'
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }`}
                    ></span>
                  )}
                  <ExternalDrive
                    className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0"
                    color="currentColor"
                  />
                  <span
                    className={`text-sm sm:text-base font-medium truncate text-black`}
                    title={server.name.replace(/\.karios\.ai$/, '')}
                  >
                    {server.name.replace(/\.karios\.ai$/, '')}
                  </span>
                </div>

                <button
                  className="flex-shrink-0 p-1 sm:p-1.5 hover:bg-gray-200 rounded transition-colors duration-200 flex items-center justify-center cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleServerVisibility(server.id);
                  }}
                  title={openServers[server.id] ? 'Collapse' : 'Expand'}
                >
                  <ArrowDown2
                    size={18}
                    color="#4B5563"
                    variant="Outline"
                    className={`transition-transform duration-300 ease-in-out flex-shrink-0 ${
                      openServers[server.id] ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
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
                      {server.vms.map((vm: VirtualMachine) => onRenderVMItem(vm, server))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Show VMs tab (flat list of all VMs from control node)
  if (controlCenterTab === 'vms') {
    // Get the first server as the source server for VM operations
    const sourceServer =
      (dataCenters && dataCenters.length > 0 && dataCenters[0].servers?.[0]) || null;

    // Separate VMs into active and inactive (normalize state to lowercase for comparison)
    const activeVms = filteredVmsList.filter(
      (vm) => vm.state?.toLowerCase() === 'running' || vm.isOn
    );
    const inactiveVms = filteredVmsList.filter(
      (vm) => vm.state?.toLowerCase() !== 'running' && !vm.isOn
    );

    return (
      <div data-testid="sidebar-vms-list" className="flex flex-col h-full">
        {isLoadingVmsList ? (
          <div className="text-xs text-gray-500 italic py-2 flex items-center gap-1">
            <AiOutlineLoading3Quarters className="animate-spin h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
            Loading VMs...
          </div>
        ) : !filteredVmsList || filteredVmsList.length === 0 ? (
          <div className="text-xs text-gray-500 italic py-2">No VMs available</div>
        ) : (
          <>
            {/* Status Tabs - Fixed Header */}
            <div className="flex-shrink-0 mb-2">
              <div className="flex gap-2 bg-gray-100 rounded">
                <button
                  onClick={() => setVmStatusTab('active')}
                  className={`flex items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors ${
                    vmStatusTab === 'active'
                      ? 'bg-green-200 text-green-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                  Active ({activeVms.length})
                </button>
                <button
                  onClick={() => setVmStatusTab('inactive')}
                  className={`flex items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors ${
                    vmStatusTab === 'inactive'
                      ? 'bg-red-100 text-red-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                  Inactive ({inactiveVms.length})
                </button>
              </div>
            </div>

            {/* Scrollable VM List Content */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {/* Active VMs */}
              {vmStatusTab === 'active' && activeVms.length > 0 && (
                <div className="space-y-1">
                  {activeVms.map((vm: VirtualMachine) =>
                    sourceServer ? (
                      onRenderVMItem(vm, sourceServer)
                    ) : (
                      <div key={vm.name} className="text-xs text-gray-400">
                        Server not found
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Inactive VMs */}
              {vmStatusTab === 'inactive' && inactiveVms.length > 0 && (
                <div className="space-y-1">
                  {inactiveVms.map((vm: VirtualMachine) =>
                    sourceServer ? (
                      onRenderVMItem(vm, sourceServer)
                    ) : (
                      <div key={vm.name} className="text-xs text-gray-400">
                        Server not found
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Empty state */}
              {vmStatusTab === 'active' && activeVms.length === 0 && (
                <div className="text-xs text-gray-400 italic py-2">No active VMs</div>
              )}
              {vmStatusTab === 'inactive' && inactiveVms.length === 0 && (
                <div className="text-xs text-gray-400 italic py-2">No inactive VMs</div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
};

export default ControlCenter;
