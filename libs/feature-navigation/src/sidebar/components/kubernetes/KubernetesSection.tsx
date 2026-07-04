import React, { useRef } from 'react';
import { More, ArrowDown2 } from 'iconsax-react';
import { AiOutlineSync } from 'react-icons/ai';
import { toast } from 'react-toastify';
import { RiNodeTree, RiServerFill } from 'react-icons/ri';
import { GrCubes } from 'react-icons/gr';
import { MdOutlineCalendarToday } from 'react-icons/md';
import { VirtualMachine, ServerNode, DataCenter } from '../../../SideBar-types';
import { isVmNameRestricted, sortClusterVMs } from '../../../utils/vmHandlers';

// Helper function to check if state is locked (case-insensitive)
const isLockedState = (state: string | undefined): boolean => {
  if (!state) return false;
  return state.toLowerCase().startsWith('locked');
};

// Helper function to extract "used by" information from locked state
// Example: "Locked (smc_mlx)" -> "smc_mlx"
const getLockedUsedBy = (state: string | undefined): string | null => {
  if (!state) return null;
  const lowerState = state.toLowerCase();
  if (!lowerState.startsWith('locked')) return null;

  // Extract content from parentheses: "Locked (smc_mlx)" -> "smc_mlx"
  const match = state.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
};

interface VmWebSocketState {
  name: string;
  datastore: string;
  state: string;
}

interface KubernetesSectionProps {
  dataCenters: DataCenter[];
  isLoadingClusters: boolean;
  clusterError: string | null;
  clusterData: any;
  expandedClusters: Record<string, boolean>;
  dropdownOpen: string | null;
  loadingClusterVms: Record<string, boolean>;
  clusterVmsData: Record<string, any>;
  vmActionStatuses: Record<string, any>;
  refreshingVms: Record<string, boolean>;
  searchTerm?: string;
  wsVmStates: Record<string, VmWebSocketState>; // WebSocket VM states from multiple nodes
  vmsList?: VirtualMachine[]; // Global VM list from control node

  // Handlers
  onGetAllClusters: () => {
    [clusterName: string]: { server: ServerNode; vms: VirtualMachine[] }[];
  };
  onHandleClusterNameClick: (clusterName: string) => void;
  onHandleClusterDropdownToggle: (clusterName: string) => void;
  onHandleDashboardClick: () => void;
  onSetDropdownOpen: (key: string | null) => void;
  onToggleVmPower: (
    vmName: string,
    isOn: boolean,
    serverIp: string,
    vmUuid?: string
  ) => Promise<void>;
  onRestartVm: (vmName: string, serverIp: string, vmUuid?: string) => Promise<void>;
  onResetVm: (vmName: string, serverIp: string, vmUuid?: string) => Promise<void>;
  onPowerOffVm: (vmName: string, serverIp: string, vmUuid?: string) => Promise<void>;
  onUnlockVm: (vmName: string, serverIp: string) => Promise<void>;
  onDeleteVm: (vm: VirtualMachine, serverIp: string) => Promise<void>;
  onVmClickFromModal: (vmName: string, nodeIp: string) => Promise<void>;
  onVmClick: (vm: VirtualMachine, server: ServerNode) => void;

  // Helper functions
  onGetVmStatusColor: (vmName: string, vmState: string) => string;
  onIsVmInAnyTransition: (vmName: string, vmState?: string) => boolean;
  onGetUpdatedVmStateForCluster: (
    vmName: string,
    vmNodeIp: string,
    fallbackState: string
  ) => string;
  onGetServerIpForClusterVm: (vmName: string, vmNodeIp: string) => string | null;
  onGetServerForClusterVm: (vmName: string, vmNodeIp: string) => ServerNode | null; // New function to get full server object
}

export const KubernetesSection: React.FC<KubernetesSectionProps> = ({
  dataCenters,
  isLoadingClusters,
  clusterError,
  clusterData,
  expandedClusters,
  dropdownOpen,
  loadingClusterVms,
  clusterVmsData,
  vmActionStatuses,
  refreshingVms,
  searchTerm = '',
  wsVmStates,
  vmsList = [],
  onGetAllClusters,
  onHandleClusterNameClick,
  onHandleClusterDropdownToggle,
  onHandleDashboardClick,
  onSetDropdownOpen,
  onToggleVmPower,
  onRestartVm,
  onResetVm,
  onPowerOffVm,
  onUnlockVm,
  onDeleteVm,
  onVmClickFromModal,
  onVmClick,
  onGetVmStatusColor,
  onIsVmInAnyTransition,
  onGetUpdatedVmStateForCluster,
  onGetServerIpForClusterVm,
  onGetServerForClusterVm, // Add new prop
}) => {
  return (
    <div className="space-y-2">
      {/* Dashboard Section */}
      <div
        className="p-3 rounded cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onHandleDashboardClick}
      >
        <div className="flex items-center gap-3">
          <MdOutlineCalendarToday size={24} color="#000000" className="flex-shrink-0" />
          <span className="text-base font-medium text-black">Dashboard</span>
        </div>
      </div>

      {isLoadingClusters && (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-1 text-blue-600">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs">Loading...</span>
          </div>
        </div>
      )}

      {clusterError && !isLoadingClusters && (
        <div className="py-4 text-center">
          <div className="text-gray-700 text-xs">{clusterError}</div>
        </div>
      )}

      {/* Display API error message */}
      {!isLoadingClusters && !clusterError && clusterData && clusterData.error && (
        <div className="py-4 text-center">
          <div className="text-yellow-600 text-xs">{clusterData.error}</div>
        </div>
      )}

      {!isLoadingClusters &&
        !clusterError &&
        !(clusterData && clusterData.error) &&
        (() => {
          const clusters = onGetAllClusters();
          let clusterNames = Object.keys(clusters).sort((a, b) => {
            // Special handling for omni - always first
            if (a === 'omni' && b !== 'omni') return -1;
            if (b === 'omni' && a !== 'omni') return 1;

            // Group clusters by type based on prefix
            const getClusterType = (name: string) => {
              if (name.startsWith('an-')) return 'anthos';
              if (name.startsWith('op-')) return 'openshift';
              if (name.startsWith('ub-')) return 'ubuntu';
              if (name.startsWith('k3s-')) return 'k3s';
              return 'other';
            };

            const typeA = getClusterType(a);
            const typeB = getClusterType(b);

            // Sort by type first, then by name within type
            if (typeA !== typeB) {
              const typeOrder = ['anthos', 'openshift', 'ubuntu', 'k3s', 'other'];
              return typeOrder.indexOf(typeA) - typeOrder.indexOf(typeB);
            }

            return a.localeCompare(b);
          });

          // Filter clusters by search term
          if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            clusterNames = clusterNames.filter((clusterName) =>
              clusterName.toLowerCase().includes(lowerSearch)
            );
          }

          if (clusterNames.length === 0) {
            return (
              <div className="text-center py-4">
                <div className="text-gray-500 text-xs mb-3">No clusters available</div>
              </div>
            );
          }

          return clusterNames.map((clusterName) => {
            const isOmniServer = clusterName === 'omni';

            return (
              <div key={clusterName} className="bg-gray-50 rounded border border-gray-100">
                <div className="flex items-center justify-between p-2">
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors duration-[1000ms] min-w-0 flex-1"
                    onClick={() => onHandleClusterNameClick(clusterName)}
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
                        onHandleClusterDropdownToggle(clusterName);
                      }}
                      className={`p-1 rounded transition-all duration-[1000ms] ease-in-out hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                      title={expandedClusters[clusterName] ? 'Collapse cluster' : 'Expand cluster'}
                    >
                      <ArrowDown2
                        size={12}
                        color="#6B7280"
                        className={`transition-all duration-[1000ms] ease-in-out ${
                          expandedClusters[clusterName] ? 'rotate-0' : 'rotate-[-90deg]'
                        }`}
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

                    {clusterVmsData[clusterName] && !loadingClusterVms[clusterName] && (
                      <div className="space-y-1">
                        {/* Render VMs */}
                        {clusterVmsData[clusterName].vms &&
                          clusterVmsData[clusterName].vms.length > 0 &&
                          sortClusterVMs(clusterVmsData[clusterName].vms || [])
                            .filter(
                              (vm: any) => vm && vm.vmName && !vm.vmName.includes('virtual-ip')
                            )
                            .map((vm: any, index: number) => {
                              // Guard against undefined/null vm or vmName
                              if (!vm || !vm.vmName) {
                                return null;
                              }
                              const vmKey = `${clusterName}-vm-${index}`;

                              // Priority 1: Get state from global vmsList (same as ControlCenter)
                              const globalVm = vmsList.find((v) => v.name === vm.vmName);
                              const stateFromGlobalList = globalVm?.state;

                              // Priority 2: Get state from WebSocket if not in global list
                              const wsVmState = wsVmStates[vm.vmName];
                              const stateFromWebSocket = wsVmState?.state;

                              // Priority 3: Use the state from cluster API as fallback
                              const updatedVmState =
                                stateFromGlobalList ||
                                stateFromWebSocket ||
                                onGetUpdatedVmStateForCluster(vm.vmName, vm.nodeIp, vm.state);

                              const isVmOn = updatedVmState?.toLowerCase() === 'running';
                              const isInTransition = onIsVmInAnyTransition(
                                vm.vmName,
                                updatedVmState
                              );
                              const isVipVm = vm.vmName.includes('-vip');

                              return (
                                <div key={vmKey} className="relative">
                                  <div
                                    className={`flex items-center gap-1 py-1 px-1 rounded cursor-pointer min-w-0 ${
                                      isVipVm ? 'opacity-50 hover:bg-gray-100' : 'hover:bg-blue-100'
                                    }`}
                                  >
                                    {updatedVmState === 'migrating' ? (
                                      <div className="relative flex-shrink-0 w-3 h-3">
                                        <AiOutlineSync className="w-full h-full text-blue-500 animate-spin" />
                                      </div>
                                    ) : (
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${onGetVmStatusColor(vm.vmName, updatedVmState)}`}
                                      />
                                    )}
                                    <span
                                      className={`text-xs flex-1 truncate ${isVipVm ? 'text-gray-400' : 'text-gray-700'}`}
                                      title={
                                        isVipVm ? 'VIP VMs are read-only' : vm.vmName || 'Unknown'
                                      }
                                      onClick={() => {
                                        if (isVipVm) return;
                                        // Get the actual server object that hosts this VM
                                        const server = onGetServerForClusterVm(
                                          vm.vmName,
                                          vm.nodeIp
                                        );
                                        if (server) {
                                          // Create a VM object to pass to the handler
                                          const vmObject: VirtualMachine = {
                                            id: vm.id || `vm-${vm.vmName}`,
                                            name: vm.vmName,
                                            isOn: isVmOn,
                                            state: updatedVmState,
                                            datastore: vm.datastore || 'default',
                                          };
                                          // Use the proper VM click handler from parent (like ControlCenter does)
                                          onVmClick(vmObject, server);
                                        } else {
                                          toast.error(
                                            `Cannot navigate to VM: No server information found for ${vm.vmName}`
                                          );
                                        }
                                      }}
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
                                            onSetDropdownOpen(
                                              dropdownOpen === vmKey ? null : vmKey
                                            );
                                          }
                                        }}
                                        className={`p-1 rounded transition-colors duration-[1000ms] ${
                                          isInTransition || isVmNameRestricted(vm.vmName) || isVipVm
                                            ? 'cursor-not-allowed opacity-50'
                                            : 'hover:bg-blue-100'
                                        }`}
                                        disabled={
                                          isInTransition || isVmNameRestricted(vm.vmName) || isVipVm
                                        }
                                        title={
                                          isVipVm
                                            ? 'VIP VMs are not configurable'
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
                                            isInTransition ||
                                            isVmNameRestricted(vm.vmName) ||
                                            isVipVm
                                              ? '#9CA3AF'
                                              : '#718096'
                                          }
                                          variant="Outline"
                                          style={{ transform: 'rotate(90deg)' }}
                                          className={`${
                                            isInTransition ||
                                            isVmNameRestricted(vm.vmName) ||
                                            isVipVm
                                              ? 'opacity-50'
                                              : 'hover:opacity-70'
                                          }`}
                                          data-dropdown-button
                                        />
                                      </button>

                                      {dropdownOpen === vmKey &&
                                        !isVmNameRestricted(vm.vmName) &&
                                        !isVipVm && (
                                          <div
                                            data-dropdown-menu
                                            className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-20"
                                          >
                                            {isInTransition && (
                                              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-200 bg-yellow-50">
                                                {updatedVmState === 'migrating'
                                                  ? 'VM is migrating...'
                                                  : 'VM in transition...'}
                                              </div>
                                            )}
                                            {isLockedState(vm.state) && (
                                              <>
                                                {getLockedUsedBy(vm.state) && (
                                                  <div className="px-3 py-1.5 text-xs text-gray-600 border-b border-gray-200 bg-gray-50">
                                                    Currently used by:{' '}
                                                    <span className="font-medium">
                                                      {getLockedUsedBy(vm.state)}
                                                    </span>
                                                  </div>
                                                )}
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const server = onGetServerForClusterVm(
                                                      vm.vmName,
                                                      vm.nodeIp
                                                    );
                                                    if (server) {
                                                      const serverAddress =
                                                        server.fqdn || server.ip;
                                                      onUnlockVm(vm.vmName, serverAddress);
                                                    } else {
                                                      toast.error(
                                                        `Cannot unlock VM: No server information found for ${vm.vmName}`
                                                      );
                                                    }
                                                    onSetDropdownOpen(null);
                                                  }}
                                                  className={`block w-full text-left px-3 py-1.5 text-sm ${
                                                    isInTransition
                                                      ? 'text-gray-400 cursor-not-allowed'
                                                      : 'hover:bg-gray-100 text-blue-600'
                                                  }`}
                                                  disabled={isInTransition}
                                                  title={
                                                    isInTransition
                                                      ? 'VM is currently in transition'
                                                      : ''
                                                  }
                                                >
                                                  Unlock
                                                </button>
                                              </>
                                            )}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const server = onGetServerForClusterVm(
                                                  vm.vmName,
                                                  vm.nodeIp
                                                );
                                                if (server) {
                                                  const serverAddress = server.fqdn || server.ip;
                                                  onToggleVmPower(
                                                    vm.vmName,
                                                    !!isVmOn,
                                                    serverAddress,
                                                    vm.uuid
                                                  );
                                                } else {
                                                  toast.error(
                                                    `Cannot ${isVmOn ? 'stop' : 'start'} VM: No server information found for ${vm.vmName}`
                                                  );
                                                }
                                                onSetDropdownOpen(null);
                                              }}
                                              className={`block w-full text-left px-3 py-1.5 text-sm ${
                                                isInTransition
                                                  ? 'text-gray-400 cursor-not-allowed'
                                                  : 'hover:bg-gray-100 text-gray-700'
                                              }`}
                                              disabled={isInTransition}
                                              title={
                                                isInTransition
                                                  ? 'VM is currently in transition'
                                                  : ''
                                              }
                                            >
                                              {isVmOn ? 'Stop' : 'Start'}
                                            </button>
                                            {isVmOn && (
                                              <>
                                                <button
                                                  className={`block w-full text-left px-3 py-1.5 text-sm ${
                                                    isInTransition
                                                      ? 'text-gray-400 cursor-not-allowed'
                                                      : 'hover:bg-gray-100 text-gray-700'
                                                  }`}
                                                  disabled={isInTransition}
                                                  title={
                                                    isInTransition
                                                      ? 'VM is currently in transition'
                                                      : ''
                                                  }
                                                >
                                                  Restart
                                                </button>
                                              </>
                                            )}
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();

                                                // Get the server object with FQDN
                                                let server = onGetServerForClusterVm(
                                                  vm.vmName,
                                                  vm.nodeIp
                                                );

                                                if (!server) {
                                                  toast.error(
                                                    `Cannot delete VM: No server information found`
                                                  );
                                                  onSetDropdownOpen(null);
                                                  return;
                                                }

                                                // Use FQDN with fallback to IP
                                                const serverAddress = server.fqdn || server.ip;

                                                const getDatastoreForClusterVM = (
                                                  vmName: string,
                                                  serverObj: ServerNode
                                                ): string => {
                                                  const vmData = serverObj?.vms?.find(
                                                    (v) => v.name === vmName
                                                  );
                                                  if (vmData?.datastore) {
                                                    return vmData.datastore;
                                                  }
                                                  return 'default';
                                                };

                                                const vmObject = {
                                                  id: vm.id || `vm-${vm.vmName}`,
                                                  name: vm.vmName,
                                                  isOn: isVmOn,
                                                  state: updatedVmState,
                                                  datastore: getDatastoreForClusterVM(
                                                    vm.vmName,
                                                    server
                                                  ),
                                                };

                                                onDeleteVm(
                                                  vmObject as VirtualMachine,
                                                  serverAddress
                                                );
                                                onSetDropdownOpen(null);
                                              }}
                                              className={`block w-full text-left px-3 py-1.5 text-sm ${
                                                isInTransition
                                                  ? 'text-gray-400 cursor-not-allowed'
                                                  : 'hover:bg-gray-100 text-red-600'
                                              }`}
                                              disabled={isInTransition}
                                              title={
                                                isInTransition
                                                  ? 'VM is currently in transition'
                                                  : ''
                                              }
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                        {/* Render BMS entries (grayed out) - Only once */}
                        {clusterVmsData[clusterName].bmsInfo &&
                          clusterVmsData[clusterName].bmsInfo.length > 0 &&
                          clusterVmsData[clusterName].bmsInfo.map((bms: any, index: number) => {
                            const bmsKey = `${clusterName}-bms-${index}`;
                            return (
                              <div key={bmsKey} className="relative">
                                <div className="flex items-center gap-1 py-1 px-1 rounded min-w-0 opacity-50">
                                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0 bg-gray-900" />
                                  <span
                                    className="text-xs text-primary flex-1 truncate"
                                    title={bms.name || 'Unknown BMS'}
                                  >
                                    {bms.name || 'Unknown BMS'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Show message only when there's truly nothing to display */}
                    {!loadingClusterVms[clusterName] &&
                      (!clusterVmsData[clusterName] ||
                        ((!clusterVmsData[clusterName].vms ||
                          clusterVmsData[clusterName].vms.length === 0) &&
                          (!clusterVmsData[clusterName].bmsInfo ||
                            clusterVmsData[clusterName].bmsInfo.length === 0))) && (
                        <div className="text-xs text-gray-500 italic py-1">
                          No VMs or BMS servers
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          });
        })()}
    </div>
  );
};

export default KubernetesSection;
