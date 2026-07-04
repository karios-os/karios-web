import React, { useState, useRef } from 'react';
import { ExternalDrive, ArrowDown2, More } from 'iconsax-react';
import { AiOutlineLoading3Quarters, AiOutlineSync } from 'react-icons/ai';
import { toast } from 'react-toastify';
import { VirtualMachine, ServerNode, DataCenter } from '../SideBar-types';
import { isClusterVM } from '../utils/clusterUtilities';
import { isVmNameRestricted } from '../utils/vmHandlers';

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

  return (
    <div data-testid="sidebar-server-list" className="space-y-1 sm:space-y-2">
      {(dataCenters || [])
        .flatMap((dc) => dc.servers || [])
        .map((server: ServerNode) => {
          const isInitialPinging = initialPingInProgress.has(server.id || server.ip);

          return (
            <div key={server.id} className={`bg-gray-50 rounded border border-gray-100`}>
              <div
                data-testid={`server-node-${server.id}`}
                className={`flex items-center justify-between p-1 sm:p-2 ${
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

                <ArrowDown2
                  className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-[1000ms] ${
                    openServers[server.id] ? '' : 'transform -rotate-90'
                  }`}
                  color="#718096"
                  variant="Outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleServerVisibility(server.id);
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
                        .filter((vm) => !isClusterVM(vm.name))
                        .map((vm: VirtualMachine) => onRenderVMItem(vm, server))}
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
