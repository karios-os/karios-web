import { ActionTypes } from './actionTypes';
import { initialState } from './initialState';
import { AppState } from '../types/AppState.types';
import { logger } from './logger';

// Base types for complex objects
interface InventoryItem {
  ip: string;
  status: string;
  os_ip?: string;
  os_hostname?: string;
  username?: string;
  password?: string;
}

interface ConfiguredNode {
  ip: string;
  nodeIP: string;
  nodeHostname: string;
  username: string;
  password: string;
}

interface VmData {
  name: string;
  datastore: string;
  state: string;
  uuid?: string; // Add uuid field as optional
}

interface FirewallNotification {
  message: string;
  type: 'success' | 'error';
}

// Helper function to get default firewall state for a server
const getDefaultFirewallState = () => ({
  rules: '',
  originalRules: '',
  loading: false,
  notification: null,
  revertCountdown: null,
  revertEndTime: null,
  isCancellingRevert: false,
  id: null,
  copied: false,
});

// Helper function to update firewall state for a specific server
const updateFirewallForServer = (
  firewallState: Record<string, any>,
  serverIp: string,
  updates: any
) => {
  return {
    ...firewallState,
    [serverIp]: {
      ...(firewallState[serverIp] || getDefaultFirewallState()),
      ...updates,
    },
  };
};

// Helper function to get default server data state
const getDefaultServerDataState = () => ({
  inventoryData: null,
  systemInfo: null,
  addinCards: null,
  storageCards: null,
  powerSupplyRatings: [],
  loading: {
    inventory: false,
    systemInfo: false,
    addinCards: false,
    storageCards: false,
    powerSupply: false,
  },
  errors: {
    inventory: null,
    systemInfo: null,
    addinCards: null,
    storageCards: null,
    powerSupply: null,
  },
});

// Generic action interface with proper typing
interface AppAction {
  type: ActionTypes;
  payload?: any; // We'll use type guards in the reducer for specific payload types
}

// Reducer for managing app state
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case ActionTypes.FETCH_DATA_START:
    case ActionTypes.VM_ACTION_START:
      return { ...state, isLoading: true, error: null };

    // VM Load Analysis Actions
    case ActionTypes.FETCH_VM_LOAD_ANALYSIS_START:
      return {
        ...state,
        stats: {
          ...state.stats,
          isLoading: true,
          error: null,
        },
      };

    case ActionTypes.FETCH_VM_LOAD_ANALYSIS_SUCCESS:
      return {
        ...state,
        stats: {
          ...state.stats,
          loadAnalysis: action.payload,
          isLoading: false,
          error: null,
        },
      };

    case ActionTypes.FETCH_VM_LOAD_ANALYSIS_FAILURE:
      return {
        ...state,
        stats: {
          ...state.stats,
          isLoading: false,
          error: action.payload,
        },
      };

    // Seaweed FS Master Config Actions
    case ActionTypes.FETCH_SEAWEED_MASTER_CONFIG_START:
      return {
        ...state,
        seaweedLoading: true,
        seaweedError: null,
      };

    case ActionTypes.FETCH_SEAWEED_MASTER_CONFIG_SUCCESS:
      return {
        ...state,
        seaweedMasterConfig: action.payload,
        seaweedLoading: false,
        seaweedError: null,
      };

    case ActionTypes.FETCH_SEAWEED_MASTER_CONFIG_FAILURE:
      return {
        ...state,
        seaweedLoading: false,
        seaweedError: action.payload,
      };

    case ActionTypes.CONFIGURE_SEAWEED_MASTER_START:
      return {
        ...state,
        seaweedConfiguring: true,
        seaweedConfigError: null,
      };

    case ActionTypes.CONFIGURE_SEAWEED_MASTER_SUCCESS:
      return {
        ...state,
        seaweedConfiguring: false,
        seaweedMasterConfig: {
          ...state.seaweedMasterConfig,
          master_configured: true,
          ...(action.payload || {}),
        },
        seaweedConfigError: null,
      };

    case ActionTypes.CONFIGURE_SEAWEED_MASTER_FAILURE:
      return {
        ...state,
        seaweedConfiguring: false,
        seaweedConfigError: action.payload,
      };

    case ActionTypes.DELETE_SEAWEED_CONFIG_START:
      return {
        ...state,
        seaweedDeleting: true,
        seaweedConfigError: null,
      };

    case ActionTypes.DELETE_SEAWEED_CONFIG_SUCCESS:
      return {
        ...state,
        seaweedDeleting: false,
        seaweedMasterConfig: null,
        seaweedVolumes: null,
        seaweedConfigError: null,
      };

    case ActionTypes.DELETE_SEAWEED_CONFIG_FAILURE:
      return {
        ...state,
        seaweedDeleting: false,
        seaweedConfigError: action.payload,
      };

    case ActionTypes.CLEAR_SEAWEED_CONFIG_ERROR:
      return {
        ...state,
        seaweedConfigError: null,
      };

    // Seaweed Volumes Actions
    case ActionTypes.FETCH_SEAWEED_VOLUMES_START:
      return {
        ...state,
        seaweedVolumesLoading: true,
        seaweedVolumesError: null,
      };

    case ActionTypes.FETCH_SEAWEED_VOLUMES_SUCCESS:
      return {
        ...state,
        seaweedVolumes: action.payload,
        seaweedVolumesLoading: false,
        seaweedVolumesError: null,
      };

    case ActionTypes.FETCH_SEAWEED_VOLUMES_FAILURE:
      return {
        ...state,
        seaweedVolumesLoading: false,
        seaweedVolumesError: action.payload,
      };

    // Seaweed Filers Actions
    // Filers related reducer cases removed

    // Seaweed Volume Mount Actions
    case ActionTypes.MOUNT_SEAWEED_VOLUME_START:
      return {
        ...state,
        mountingVolume: true,
        mountVolumeError: null,
      };

    case ActionTypes.MOUNT_SEAWEED_VOLUME_SUCCESS:
      return {
        ...state,
        mountingVolume: false,
        mountVolumeError: null,
      };

    case ActionTypes.MOUNT_SEAWEED_VOLUME_FAILURE:
      return {
        ...state,
        mountingVolume: false,
        mountVolumeError: action.payload,
      };

    case ActionTypes.CLEAR_SEAWEED_VOLUME_ERROR:
      return {
        ...state,
        mountVolumeError: null,
      };

    // Seaweed Volume Unmount Actions
    case ActionTypes.UNMOUNT_SEAWEED_VOLUME_START:
      return {
        ...state,
        unmountingVolume: true,
        unmountVolumeError: null,
      };

    case ActionTypes.UNMOUNT_SEAWEED_VOLUME_SUCCESS:
      return {
        ...state,
        unmountingVolume: false,
        unmountVolumeError: null,
      };

    case ActionTypes.UNMOUNT_SEAWEED_VOLUME_FAILURE:
      return {
        ...state,
        unmountingVolume: false,
        unmountVolumeError: action.payload,
      };

    // Power Ranking Actions
    case ActionTypes.FETCH_POWER_RANKING_START:
      return {
        ...state,
        powerRanking: {
          ...state.powerRanking,
          isLoading: true,
          error: null,
        },
      };

    case ActionTypes.FETCH_POWER_RANKING_SUCCESS:
      return {
        ...state,
        powerRanking: {
          current_time: action.payload.current_time,
          start_time: action.payload.start_time,
          end_time: action.payload.end_time,
          ratings: action.payload.ratings,
          isLoading: false,
          error: null,
        },
      };

    case ActionTypes.FETCH_POWER_RANKING_FAILURE:
      return {
        ...state,
        powerRanking: {
          ...state.powerRanking,
          isLoading: false,
          error: action.payload,
        },
      };

    // Control Center Actions
    case ActionTypes.FETCH_INVENTORY_START:
      return { ...state, isLoading: true, error: null };
    case ActionTypes.FETCH_INVENTORY_SUCCESS: {
      // Handle both old and new formats for backward compatibility
      const payload = action.payload;
      const inventoryPayload = payload.inventory ? payload.inventory : (payload as InventoryItem[]);
      const totalInventoryCount =
        payload.totalCount !== undefined ? payload.totalCount : inventoryPayload.length;

      return {
        ...state,
        isLoading: false,
        inventory: inventoryPayload,
        totalInventoryCount: totalInventoryCount,
        // If inventory contains configured nodes, update them
        configuredNodes: inventoryPayload
          .filter((node) => node.status === 'CONFIGURED')
          .map((node) => ({
            ip: node.ip,
            nodeIP: node.os_ip || '',
            nodeHostname: node.os_hostname || '',
            username: node.username || '',
            password: node.password || '',
          })),
      };
    }
    case ActionTypes.FETCH_INVENTORY_FAILURE:
      return { ...state, isLoading: false, error: action.payload };

    case ActionTypes.SET_DATACENTER_ERROR:
      return { ...state, error: action.payload };

    case ActionTypes.SET_INVENTORY:
      return { ...state, inventory: action.payload };

    case ActionTypes.SCAN_SUBNET_START:
      return { ...state, scanLoading: true, scanError: null, subnet: action.payload as string };
    case ActionTypes.SCAN_SUBNET_SUCCESS:
      return { ...state, scanLoading: false };
    case ActionTypes.SCAN_SUBNET_FAILURE:
      return { ...state, scanLoading: false, scanError: action.payload as string };

    case ActionTypes.UPDATE_NODE_STATUS: {
      const updateNodePayload = action.payload as { ip: string; updates: Partial<InventoryItem> };
      return {
        ...state,
        inventory: state.inventory.map((item: InventoryItem) =>
          item.ip === updateNodePayload.ip ? { ...item, ...updateNodePayload.updates } : item
        ),
      };
    }

    case ActionTypes.UPDATE_NODE: {
      const updatePayload = action.payload as { ip: string; updates: Partial<InventoryItem> };
      const updatedInventory = state.inventory.map((item: InventoryItem) =>
        item.ip === updatePayload.ip ? { ...item, ...updatePayload.updates } : item
      );
      return {
        ...state,
        inventory: updatedInventory,
        // If node was configured, update configuredNodes
        configuredNodes: updatedInventory
          .filter((node) => node.status === 'CONFIGURED')
          .map((node) => ({
            ip: node.ip,
            nodeIP: node.os_ip || '',
            nodeHostname: node.os_hostname || '',
            username: node.username || '',
            password: node.password || '',
          })),
      };
    }

    case ActionTypes.SET_NODE_JOB_CONTEXT: {
      const jobContextPayload = action.payload as { ip: string; jobType: string };
      return {
        ...state,
        nodeJobContext: {
          ...state.nodeJobContext,
          [jobContextPayload.ip]: jobContextPayload.jobType,
        },
      };
    }

    case ActionTypes.FETCH_DATACENTERS_SUCCESS: {
      const dataCentersPayload = action.payload as any[];
      // If we already have data centers with servers, merge them
      if (
        state.dataCenters &&
        state.dataCenters.length > 0 &&
        state.dataCenters[0].servers &&
        state.dataCenters[0].servers.length > 0
      ) {
        // Create a map of existing servers by ID for quick lookup
        const existingServersMap: Record<string, any> = {};
        state.dataCenters.forEach((dc: any) => {
          dc.servers.forEach((server: any) => {
            existingServersMap[server.id] = server;
          });
        });

        // Create a new merged data centers array
        const mergedDataCenters = dataCentersPayload.map((newDc) => {
          return {
            ...newDc,
            servers: newDc.servers.map((newServer) => {
              // If this server already exists and has VMs, preserve it
              const existingServer = existingServersMap[newServer.id];
              if (existingServer && existingServer.vms && existingServer.vms.length > 0) {
                return {
                  ...newServer,
                  vms: existingServer.vms,
                  isOpen: existingServer.isOpen,
                };
              }
              return newServer;
            }),
          };
        });

        return { ...state, isLoading: false, dataCenters: mergedDataCenters };
      }

      return { ...state, isLoading: false, dataCenters: dataCentersPayload };
    }

    case ActionTypes.FETCH_VMS_FOR_SERVER_SUCCESS: {
      const vmsPayload = action.payload as { serverId: string; vms: any[] };
      if (!vmsPayload || !vmsPayload.serverId) {
        logger.error('Invalid payload for FETCH_VMS_FOR_SERVER_SUCCESS:', action.payload);
        return state;
      }
      const { serverId: fetchServerId, vms: fetchedVms } = vmsPayload; // Only update if we have data centers
      if (!state.dataCenters || state.dataCenters.length === 0) {
        return state;
      }

      const updatedDataCentersForFetch = (state.dataCenters || []).map((dc) => {
        const updatedServers = dc.servers.map((s) =>
          s.id === fetchServerId ? { ...s, vms: fetchedVms, isOpen: true } : s
        );
        return {
          ...dc,
          servers: updatedServers,
        };
      });

      let updatedSelectedServerForFetch = state.selectedServer;
      if (state.selectedServer && state.selectedServer.id === fetchServerId) {
        updatedSelectedServerForFetch = { ...state.selectedServer, vms: fetchedVms, isOpen: true };
      }

      return {
        ...state,
        isLoading: false,
        dataCenters: updatedDataCentersForFetch,
        selectedServer: updatedSelectedServerForFetch,
      };
    }

    case ActionTypes.WEBSOCKET_VM_LIST_START: {
      const serverIdPayload = action.payload as string;
      // Set loading state for specific server
      if (!state.dataCenters || state.dataCenters.length === 0) {
        return state;
      }

      const updatedDataCentersForWsStart = state.dataCenters.map((dc) => {
        const updatedServers = dc.servers.map((s) =>
          s.id === serverIdPayload ? { ...s, isLoading: true } : s
        );
        return {
          ...dc,
          servers: updatedServers,
        };
      });

      return {
        ...state,
        dataCenters: updatedDataCentersForWsStart,
      };
    }

    case ActionTypes.WEBSOCKET_VM_LIST_UPDATE: {
      const wsVmsPayload = action.payload as {
        serverId: string;
        vms: any[];
        isOnConsolePage?: boolean;
      };
      if (!wsVmsPayload || !wsVmsPayload.serverId) {
        logger.error('Invalid payload for WEBSOCKET_VM_LIST_UPDATE:', action.payload);
        return state;
      }
      const { serverId: wsServerId, vms: wsVms, isOnConsolePage } = wsVmsPayload;

      // Only update if we have data centers
      if (!state.dataCenters || state.dataCenters.length === 0) {
        return state;
      }

      // If user is on console page, check for meaningful state changes only
      if (isOnConsolePage) {
        // Find current VM states to compare
        const currentServer = state.dataCenters
          .flatMap((dc) => dc.servers)
          .find((s) => s.id === wsServerId);

        if (currentServer && currentServer.vms) {
          // Check if any VM action states have actually changed (meaningful changes)
          const meaningfulChanges = wsVms.some((newVm) => {
            const currentVm = currentServer.vms?.find((vm) => vm.name === newVm.name);
            if (!currentVm) return true; // New VM is meaningful

            // Only consider these state transitions as meaningful (affecting console access)
            const meaningfulStates = [
              'Running',
              'Stopped',
              'PROVISIONING',
              'Provisioning',
              'Error',
              'Starting',
              'Stopping',
            ];
            const oldState = currentVm.state;
            const newState = newVm.state;

            // Check if transition between meaningful states occurred
            const isStateTransition =
              oldState !== newState &&
              (meaningfulStates.includes(oldState) || meaningfulStates.includes(newState));

            if (isStateTransition) {
              return true;
            }

            return false;
          });

          if (!meaningfulChanges) {
            return state; // No update needed, prevent console refresh
          }
        }
      }

      const updatedDataCentersForWs = state.dataCenters.map((dc) => {
        const updatedServers = dc.servers.map((s) => {
          if (s.id === wsServerId) {
            // Preserve UUIDs from existing VMs when updating from WebSocket
            const mergedVms = wsVms.map((newVm) => {
              const existingVm = s.vms?.find((vm) => vm.name === newVm.name);
              return {
                ...newVm,
                uuid: newVm.uuid || existingVm?.uuid, // Preserve UUID if it exists in old VM
              };
            });
            return { ...s, vms: mergedVms, isLoading: false, isOpen: true };
          }
          return s;
        });
        return {
          ...dc,
          servers: updatedServers,
        };
      });

      let updatedSelectedServerForWs = state.selectedServer;
      if (state.selectedServer && state.selectedServer.id === wsServerId) {
        // Preserve UUIDs for selected server as well
        const mergedVms = wsVms.map((newVm) => {
          const existingVm = state.selectedServer?.vms?.find((vm) => vm.name === newVm.name);
          return {
            ...newVm,
            uuid: newVm.uuid || existingVm?.uuid,
          };
        });
        updatedSelectedServerForWs = { ...state.selectedServer, vms: mergedVms, isOpen: true };
      }

      return {
        ...state,
        dataCenters: updatedDataCentersForWs,
        selectedServer: updatedSelectedServerForWs,
      };
    }

    case ActionTypes.WEBSOCKET_VM_LIST_ERROR: {
      const serverIdPayload = action.payload as string;
      // Clear loading state for specific server on error
      if (!state.dataCenters || state.dataCenters.length === 0) {
        return state;
      }

      const updatedDataCentersForWsError = state.dataCenters.map((dc) => {
        const updatedServers = dc.servers.map((s) =>
          s.id === serverIdPayload ? { ...s, isLoading: false } : s
        );
        return {
          ...dc,
          servers: updatedServers,
        };
      });

      return {
        ...state,
        dataCenters: updatedDataCentersForWsError,
      };
    }

    case ActionTypes.FETCH_GLOBAL_VM_LIST_START:
      return {
        ...state,
        globalVmList: {
          ...state.globalVmList,
          loading: true,
          error: null,
        },
      };

    case ActionTypes.FETCH_GLOBAL_VM_LIST_SUCCESS:
      return {
        ...state,
        globalVmList: {
          vms: action.payload,
          loading: false,
          error: null,
          lastFetched: Date.now(),
        },
      };

    case ActionTypes.FETCH_GLOBAL_VM_LIST_ERROR:
      return {
        ...state,
        globalVmList: {
          ...state.globalVmList,
          loading: false,
          error: action.payload,
        },
      };

    case ActionTypes.FETCH_DATA_FAILURE:
    case ActionTypes.VM_ACTION_FAILURE:
      return { ...state, isLoading: false, error: action.payload as string };

    case ActionTypes.SET_SELECTED_DATACENTER:
      return {
        ...state,
        selectedDataCenter: action.payload,
        selectedServer: null,
        selectedVm: null,
      };
    case ActionTypes.SET_SELECTED_SERVER:
      return { ...state, selectedServer: action.payload, selectedVm: null }; // Reset selected VM when server changes
    case ActionTypes.SET_SELECTED_VM:
      return { ...state, selectedVm: action.payload };
    case ActionTypes.SET_OMNI_DASHBOARD_URL:
      return { ...state, omniDashboardUrl: action.payload };
    case ActionTypes.SET_NODE_STATUSES:
      return { ...state, nodeStatuses: action.payload };
    case ActionTypes.SET_CONFIGURED_NODES:
      return { ...state, configuredNodes: action.payload as ConfiguredNode[] };

    case ActionTypes.SET_ACTIVE_COMPONENT:
      return { ...state, activeComponent: action.payload };
    case ActionTypes.SET_SELECTED_MAIN_TOP_BAR_COMPONENT:
      // This action might also set the activeComponent directly
      return {
        ...state,
        selected_MainTopBar_Component: action.payload,
        activeComponent: action.payload,
      };

    case ActionTypes.TOGGLE_DATACENTER_VISIBILITY: {
      const dcId = action.payload as string;
      if (!dcId) {
        logger.error('Invalid payload for TOGGLE_DATACENTER_VISIBILITY:', action.payload);
        return state;
      }
      return {
        ...state,
        openDataCenters: {
          ...(state.openDataCenters || {}),
          [dcId]: !(state.openDataCenters || {})[dcId],
        },
      };
    }
    case ActionTypes.TOGGLE_SERVER_VISIBILITY: {
      const togglePayload = action.payload as { dcId: string; serverId: string };
      if (!togglePayload || !togglePayload.dcId || !togglePayload.serverId) {
        logger.error('Invalid payload for TOGGLE_SERVER_VISIBILITY:', action.payload);
        return state;
      }
      const { dcId, serverId } = togglePayload;
      return {
        ...state,
        dataCenters: (state.dataCenters || []).map((dc) =>
          dc.id === dcId
            ? {
                ...dc,
                servers: (dc.servers || []).map((s) =>
                  s.id === serverId ? { ...s, isOpen: !s.isOpen } : s
                ),
              }
            : dc
        ),
      };
    }

    // Authentication actions
    case ActionTypes.LOGIN_START:
      return { ...state, loginLoading: true, loginError: '' };

    case ActionTypes.LOGIN_SUCCESS:
      return { ...state, loginLoading: false, loginError: '' };

    case ActionTypes.LOGIN_FAILURE:
      return { ...state, loginLoading: false, loginError: action.payload as string };

    case ActionTypes.CLEAR_LOGIN_FORM:
      return { ...state, loginForm: initialState.loginForm };

    case ActionTypes.LOGOUT:
      return {
        ...initialState,
        isAuthenticated: false,
        isAuthLoading: false, // Explicitly set to false to prevent infinite loading after logout
        unmountingVolumeId: undefined,
        seaweedError: '',
        seaweedLoading: undefined,
        seaweedMasterConfig: undefined,
        seaweedConfiguring: false,
        seaweedDeleting: false,
        seaweedConfigError: '',
        seaweedVolumes: undefined,
        seaweedVolumesLoading: false,
        seaweedVolumesError: '',
        seaweedFilers: undefined,
        seaweedFilersLoading: false,
        seaweedFilersError: '',
        mountingVolume: false,
        mountVolumeError: '',
        unmountingVolume: false,
        unmountVolumeError: '',
        dataCenters: [],
        selectedDataCenter: undefined,
        selectedServer: undefined,
        selectedVm: undefined,
        openDataCenters: undefined,
        activeComponent: '',
        selected_MainTopBar_Component: '',
        currentDataCenterView: '',
        currentServerView: '',
        // isAuthenticated: false,
        isLoading: false,
        error: '',
        nodeStatuses: undefined,
        configuredNodes: [],
        activityLogs: [],
        activityLogsLoading: false,
        activityLogsError: '',
        inventory: [],
        totalInventoryCount: 0,
        subnet: '',
        scanLoading: false,
        scanError: '',
        rebootingNodes: undefined,
        nodeJobContext: undefined,
        nodeTopInfo: {
          loading: false,
          data: undefined,
          error: '',
        },
        vncConsoleUrl: '',
        vncConsoleOptions: {
          autoconnect: false,
          reconnect: false,
          reconnect_delay: 0,
        },
        vncConsoleError: '',
        websocketConnected: false,
        roles: [],
        permissions: [],
        roleForm: {
          name: '',
          role: '',
          description: '',
          Permissions: [],
        },
        editingRoleId: '',
        allUsers: [],
        selectedUser: undefined,
        isEditUserOpen: false,
        isRegisterUserOpen: false,
        userViewFilter: '',
        registerUserForm: {
          username: '',
          email: '',
          first_name: '',
          last_name: '',
          password: '',
        },
        userFormError: '',
        osInstallation: {
          isoList: [],
          selectedIso: '',
          isInstalling: false,
          loadingIsos: false,
          startOnBoot: false,
          message: '',
        },
        loginForm: {
          username: '',
          password: '',
        },
        loginError: '',
        loginLoading: false,
        showPassword: false,
        signupForm: {
          username: '',
          email: '',
          first_name: '',
          last_name: '',
          password: '',
          confirmPassword: '',
        },
        signupErrors: undefined,
        signupLoading: false,
        metrics: {
          loading: false,
          error: '',
          uid: '',
          viewingPanel: '',
        },
        metricsData: undefined,
        // FRR Routes Management
        frrRoutes: {
          routes: [],
          loading: false,
          error: '',
        },
        // OSPF Summary Management
        ospfSummary: {
          data: [],
          loading: false,
          error: null,
        },
        // BGP Summary Management
        bgpSummary: {
          data: [],
          loading: false,
          error: null,
        },
        // Network Interfaces Management
        networkInterfaces: {
          data: [],
          loading: false,
          error: null,
        },
        network: {
          interfaces: [],
          switches: [],
          loadingInterfaces: false,
          loadingSwitches: false,
          loadingCreateSwitch: false,
          error: '',
          createSwitchError: '',
          createSwitchSuccess: '',
          dropdownSelection: '',
          showCreateSwitchForm: false,
          switchName: '',
          selectedInterface: '',
          // TAP Interface Management
          addTapLoading: false,
          addTapError: '',
          addTapSuccess: '',
          detachTapLoading: false,
          detachTapError: '',
          detachTapSuccess: '',
          bulkDetachTapLoading: false,
          bulkDetachTapError: '',
          bulkDetachTapSuccess: '',
          // Parent Interface Management
          addParentLoading: false,
          addParentError: '',
          addParentSuccess: '',
          vale: {
            config: undefined,
            connections: undefined,
            summary: undefined,
            details: undefined,
            loadingConfig: false,
            loadingConnections: false,
            loadingSummary: false,
            loadingDetails: false,
            detachLoading: false,
            attachLoading: false,
            detachParentLoading: false,
            destroyLoading: false,
            destroyAnalysisLoading: false,
            configError: '',
            connectionsError: '',
            summaryError: '',
            detailsError: '',
            detachError: '',
            attachError: '',
            detachParentError: '',
            destroyError: '',
            destroyAnalysisError: '',
            detachSuccess: '',
            attachSuccess: '',
            detachParentSuccess: '',
            destroySuccess: '',
            destroyAnalysis: null,
            destroyConfirmation: null,
            lastUpdated: new Date(),
          },
        },
        firewall: {}, // Per-server firewall state: Record<serverIp, FirewallState>
        logs: {
          logs: [],
          loading: false,
          error: '',
          level: '',
          contains: '',
          totalCount: 0,
        },
        storage: {
          pools: [],
          poolsTransformed: [],
          datastores: [],
          vmDisks: [],
          loadingPools: false,
          loadingDatastores: false,
          loadingVmDisks: false,
          attachLoading: false,
          attachError: '',
          attachSuccess: false,
          reassignLoading: false,
          reassignError: '',
          reassignSuccess: false,
          deleteLoading: false,
          deleteError: '',
          deleteSuccess: false,
          diskForm: {
            diskType: '',
            diskDev: '',
            diskSize: '',
            zfsPath: '',
            zpoolList: [],
            selectedZpool: '',
            zpoolFreeSpace: '',
            diskNo: '',
            datastore: '',
          },
        },
        iso: {
          isoList: [],
          selectedIso: '',
          loading: false,
          error: '',
          // Upload progress tracking
          uploadingIso: false,
          uploadProgress: 0,
          uploadMessage: '',
          uploadMessageType: '',
          // Download progress tracking
          downloadingIso: false,
          downloadProgress: 0,
          downloadMessage: '',
          downloadMessageType: '',
        },
        snapshots: [],
        snapshotsLoading: false,
        creatingSnapshot: false,
        rollingBackSnapshot: false,
        snapshotMessage: '',
        creatingZpool: false,
        creatingDatastore: false,
        dropdownOpen: false,
        power: {
          data: undefined,
          loading: false,
          error: '',
        },
        powerRanking: {
          current_time: '',
          start_time: '',
          end_time: '',
          ratings: [],
          isLoading: false,
          error: '',
        },
        stats: {
          loadAnalysis: undefined,
          isLoading: false,
          error: '',
        },
        vlans: {
          vlans: [],
          selectedVlan: undefined,
          vlanDetails: undefined,
          availableTags: undefined,
          vlanStats: undefined,
          pingResult: undefined,
          deletionPrompt: undefined,
          loadingVlans: false,
          loadingVlanDetails: false,
          loadingAvailableTags: false,
          loadingVlanStats: false,
          pingInProgress: false,
          configuringIP: false,
          loadingDeletionPrompt: false,
          creatingVlan: false,
          deletingVlan: false,
          error: '',
          vlanForm: {
            tag_id: 0,
            parent_nic: '',
            vlan_number: 0,
            static_ip: '',
            subnet_mask: '',
          },
          ipConfigForm: {
            use_dhcp: false,
            is_editable: true,
            static_ip: '',
            gateway: '',
            subnet_mask: '',
          },
        },
        cloudImages: {
          cloudImagesList: [],
          raws: [],
          loading: false,
          error: null,
        },
        nodeStatsHistory: [],
        isLoadingNodeStatsHistory: false,
        nodeStatsHistoryError: null,
      }; // Reset to initial on logout, clear all selections

    case ActionTypes.UPDATE_LOGIN_FORM:
      return { ...state, loginForm: action.payload };

    case ActionTypes.TOGGLE_PASSWORD_VISIBILITY:
      return { ...state, showPassword: !state.showPassword };

    // Additional Authentication actions
    case ActionTypes.SET_ADDITIONAL_AUTH_REQUIRED:
      return { ...state, additionalAuthRequired: action.payload };

    case ActionTypes.SET_ADDITIONAL_AUTH_COMPLETED:
      return {
        ...state,
        additionalAuthCompleted: action.payload,
        isAuthenticated: action.payload ? true : state.isAuthenticated,
        additionalAuthRequired: action.payload ? false : state.additionalAuthRequired,
      };

    // Two-Factor Authentication actions
    case ActionTypes.SET_2FA_REQUIRED:
      return { ...state, twoFactorAuthRequired: action.payload };

    case ActionTypes.SET_2FA_COMPLETED:
      return {
        ...state,
        twoFactorAuthCompleted: action.payload,
        isAuthenticated: action.payload ? true : state.isAuthenticated,
        twoFactorAuthRequired: action.payload ? false : state.twoFactorAuthRequired,
      };

    case ActionTypes.SET_AUTH_LOADING:
      return { ...state, isAuthLoading: action.payload };

    // Signup actions
    case ActionTypes.SIGNUP_START:
      return { ...state, signupLoading: true, signupErrors: {} };

    case ActionTypes.SIGNUP_SUCCESS:
      return {
        ...state,
        signupLoading: false,
        signupErrors: {},
        signupForm: initialState.signupForm,
      };

    case ActionTypes.SIGNUP_FAILURE:
      return { ...state, signupLoading: false };

    case ActionTypes.UPDATE_SIGNUP_FORM:
      return { ...state, signupForm: action.payload };

    case ActionTypes.SET_SIGNUP_ERRORS:
      return { ...state, signupErrors: action.payload, signupLoading: false };

    case ActionTypes.CLEAR_SIGNUP_ERRORS:
      return { ...state, signupErrors: {}, signupLoading: false };

    // URL-based state updates
    case ActionTypes.URL_UPDATE_SERVER:
      return { ...state, selectedServer: action.payload };
    case ActionTypes.URL_UPDATE_VM:
      return { ...state, selectedVm: action.payload };
    case ActionTypes.URL_UPDATE_DATACENTER:
      return { ...state, selectedDataCenter: action.payload };

    // WebSocket updates
    case ActionTypes.WEBSOCKET_CONNECT:
      return { ...state, websocketConnected: true };

    case ActionTypes.WEBSOCKET_DISCONNECT:
      return { ...state, websocketConnected: false };

    case ActionTypes.WEBSOCKET_VM_UPDATE: {
      const websocketPayload = action.payload as { serverIp: string; vmsData: VmData[] };
      if (!websocketPayload || !websocketPayload.serverIp) {
        return state;
      }
      const { serverIp, vmsData } = websocketPayload;

      // Ensure vmsData is an array
      const safeVmsData = Array.isArray(vmsData) ? vmsData : [];

      const updatedDCsFromWebsocket = (state.dataCenters || []).map((dc) => ({
        ...dc,
        servers: dc.servers.map((server) =>
          server.ip === serverIp
            ? {
                ...server,
                vms: safeVmsData.map((vm, index) => ({
                  id: `vm-${index}`,
                  name: vm.name,
                  datastore: vm.datastore,
                  state: vm.state,
                  uuid: vm.uuid, // Store the UUID from WebSocket response
                  isOn: vm.state === 'Running',
                })),
              }
            : server
        ),
      }));

      // Also update selectedVM if it exists
      let updatedSelectedVm = state.selectedVm;
      if (state.selectedVm) {
        const vmUpdate = safeVmsData.find((vm) => vm.name === state.selectedVm.name);
        if (vmUpdate) {
          updatedSelectedVm = {
            ...state.selectedVm,
            state: vmUpdate.state,
            uuid: vmUpdate.uuid, // Update UUID
            isOn: vmUpdate.state === 'Running',
            datastore: vmUpdate.datastore,
          };
        }
      }

      const newState = {
        ...state,
        dataCenters: updatedDCsFromWebsocket,
        selectedVm: updatedSelectedVm,
      };

      return newState;
    }

    // Role Management
    case ActionTypes.FETCH_ROLES_START:
      return { ...state, isLoading: true };

    case ActionTypes.FETCH_ROLES_SUCCESS:
      return { ...state, roles: action.payload as any[], isLoading: false };

    case ActionTypes.FETCH_ROLES_FAILURE:
      return { ...state, error: action.payload as string, isLoading: false };

    case ActionTypes.FETCH_PERMISSIONS_SUCCESS:
      return { ...state, permissions: action.payload as any[] };

    case ActionTypes.FETCH_PERMISSIONS_FAILURE:
      return { ...state, error: action.payload as string };

    case ActionTypes.SET_ROLE_FORM:
      return { ...state, roleForm: action.payload };

    case ActionTypes.RESET_ROLE_FORM:
      return {
        ...state,
        notificationMessages: [...state.notificationMessages, action.payload],
        hasNotifications: true,
        roleForm: initialState.roleForm,
        editingRoleId: null,
      };

    case ActionTypes.SET_EDITING_ROLE_ID:
      return { ...state, editingRoleId: action.payload as string };

    case ActionTypes.SET_DATACENTER_VIEW:
      return { ...state, currentDataCenterView: action.payload as string };

    case ActionTypes.SET_SERVER_VIEW:
      return { ...state, currentServerView: action.payload as string };

    // User Management
    case ActionTypes.FETCH_USERS_START:
      return { ...state, isLoading: true };

    case ActionTypes.FETCH_USERS_SUCCESS:
      return { ...state, allUsers: action.payload as any[], isLoading: false };

    case ActionTypes.FETCH_USERS_FAILURE:
      return { ...state, error: action.payload as string, isLoading: false };

    case ActionTypes.SET_SELECTED_USER:
      return { ...state, selectedUser: action.payload };

    case ActionTypes.SET_EDIT_USER_MODAL:
      return { ...state, isEditUserOpen: action.payload as boolean };

    case ActionTypes.SET_REGISTER_USER_MODAL:
      return { ...state, isRegisterUserOpen: action.payload as boolean };

    case ActionTypes.SET_USER_VIEW_FILTER:
      return { ...state, userViewFilter: action.payload as string };

    case ActionTypes.UPDATE_REGISTER_USER_FORM:
      return { ...state, registerUserForm: action.payload };

    case ActionTypes.RESET_REGISTER_USER_FORM:
      return { ...state, registerUserForm: initialState.registerUserForm, userFormError: '' };

    case ActionTypes.SET_USER_FORM_ERROR:
      return { ...state, userFormError: action.payload as string };

    case ActionTypes.SET_SELECTED_USER_ROLES: {
      const userRolePayload = action.payload as { id: string; selected: boolean };
      return {
        ...state,
        selectedUser: {
          ...state.selectedUser,
          roles: state.selectedUser.roles.map((r: any) =>
            r.id === userRolePayload.id ? { ...r, selected: userRolePayload.selected } : r
          ),
        },
      };
    }

    // Observability / Metrics
    case ActionTypes.FETCH_METRICS_UID_START:
      return {
        ...state,
        metrics: {
          ...state.metrics,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_METRICS_UID_SUCCESS:
      return {
        ...state,
        metrics: {
          ...state.metrics,
          loading: false,
          uid: action.payload,
          error: null,
        },
      };
    case ActionTypes.FETCH_METRICS_UID_FAILURE:
      return {
        ...state,
        metrics: {
          ...state.metrics,
          loading: false,
          uid: null,
          error: action.payload,
        },
      };
    case ActionTypes.SET_METRICS_VIEWING_PANEL:
      return {
        ...state,
        metrics: {
          ...state.metrics,
          viewingPanel: action.payload,
        },
      };
    case ActionTypes.UPDATE_METRICS:
      return {
        ...state,
        metricsData: action.payload,
      };

    // Observability Services
    case ActionTypes.FETCH_OBSERVABILITY_STATUS_START:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_OBSERVABILITY_STATUS_SUCCESS:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          loading: false,
          status: action.payload,
          error: null,
        },
      };
    case ActionTypes.FETCH_OBSERVABILITY_STATUS_FAILURE:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          loading: false,
          error: action.payload,
        },
      };
    case ActionTypes.START_OBSERVABILITY_SERVICE_START:
    case ActionTypes.STOP_OBSERVABILITY_SERVICE_START:
    case ActionTypes.RESTART_OBSERVABILITY_SERVICE_START:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          serviceLoading: {
            ...state.observabilityServices.serviceLoading,
            [action.payload]: true,
          },
          serviceErrors: {
            ...state.observabilityServices.serviceErrors,
            [action.payload]: null,
          },
        },
      };
    case ActionTypes.START_OBSERVABILITY_SERVICE_SUCCESS:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          serviceLoading: {
            ...state.observabilityServices.serviceLoading,
            [action.payload]: false,
          },
          status: {
            ...state.observabilityServices.status,
            [action.payload]: true,
          },
        },
      };
    case ActionTypes.STOP_OBSERVABILITY_SERVICE_SUCCESS:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          serviceLoading: {
            ...state.observabilityServices.serviceLoading,
            [action.payload]: false,
          },
          status: {
            ...state.observabilityServices.status,
            [action.payload]: false,
          },
        },
      };
    case ActionTypes.RESTART_OBSERVABILITY_SERVICE_SUCCESS:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          serviceLoading: {
            ...state.observabilityServices.serviceLoading,
            [action.payload]: false,
          },
        },
      };
    case ActionTypes.START_OBSERVABILITY_SERVICE_FAILURE:
    case ActionTypes.STOP_OBSERVABILITY_SERVICE_FAILURE:
    case ActionTypes.RESTART_OBSERVABILITY_SERVICE_FAILURE:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          serviceLoading: {
            ...state.observabilityServices.serviceLoading,
            [action.payload.service]: false,
          },
          serviceErrors: {
            ...state.observabilityServices.serviceErrors,
            [action.payload.service]: action.payload.error,
          },
        },
      };

    // Grafana Dashboard Launch
    case ActionTypes.LAUNCH_GRAFANA_DASHBOARD_START:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          dashboardLoading: true,
          dashboardError: null,
        },
      };
    case ActionTypes.LAUNCH_GRAFANA_DASHBOARD_SUCCESS:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          dashboardLoading: false,
          dashboardUrl: action.payload,
          dashboardError: null,
        },
      };
    case ActionTypes.LAUNCH_GRAFANA_DASHBOARD_FAILURE:
      return {
        ...state,
        observabilityServices: {
          ...state.observabilityServices,
          dashboardLoading: false,
          dashboardError: action.payload,
        },
      };

    // Activity Logs
    case ActionTypes.FETCH_ACTIVITY_LOGS_START:
      return {
        ...state,
        activityLogsLoading: true,
        activityLogsError: null,
      };

    case ActionTypes.FETCH_ACTIVITY_LOGS_SUCCESS:
      return {
        ...state,
        activityLogs: action.payload,
        activityLogsLoading: false,
      };

    case ActionTypes.FETCH_ACTIVITY_LOGS_FAILURE:
      return {
        ...state,
        activityLogsError: action.payload,
        activityLogsLoading: false,
      };

    // Observability Events
    case ActionTypes.FETCH_OBSERVABILITY_EVENTS_START:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          loading: true,
          error: null,
        },
      };

    case ActionTypes.FETCH_OBSERVABILITY_EVENTS_SUCCESS:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          events: action.payload.events,
          totalCount: action.payload.totalCount,
          totalPages: action.payload.totalPages,
          currentPage: action.payload.currentPage,
          loading: false,
          error: null,
        },
      };

    case ActionTypes.FETCH_OBSERVABILITY_EVENTS_FAILURE:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          loading: false,
          error: action.payload,
          events: [],
          totalCount: 0,
          totalPages: 1,
          currentPage: 1,
        },
      };

    case ActionTypes.FETCH_COMPONENT_TYPES_START:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          componentTypesLoading: true,
          componentTypesError: null,
        },
      };

    case ActionTypes.FETCH_COMPONENT_TYPES_SUCCESS:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          componentTypes: action.payload,
          componentTypesLoading: false,
          componentTypesError: null,
        },
      };

    case ActionTypes.FETCH_COMPONENT_TYPES_FAILURE:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          componentTypesLoading: false,
          componentTypesError: action.payload,
        },
      };

    case ActionTypes.UPDATE_OBSERVABILITY_FILTERS:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          filters: {
            ...state.observabilityEvents.filters,
            ...action.payload,
          },
        },
      };

    case ActionTypes.SET_OBSERVABILITY_PAGINATION:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          currentPage: action.payload.page,
          totalPages: action.payload.totalPages,
          totalCount: action.payload.totalCount,
        },
      };

    case ActionTypes.APPROVE_EVENT_START:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          approvingEvents: new Set([...state.observabilityEvents.approvingEvents, action.payload]),
        },
      };

    case ActionTypes.APPROVE_EVENT_SUCCESS:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          approvingEvents: new Set(
            [...state.observabilityEvents.approvingEvents].filter((id) => id !== action.payload)
          ),
        },
      };

    case ActionTypes.APPROVE_EVENT_FAILURE:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          approvingEvents: new Set(
            [...state.observabilityEvents.approvingEvents].filter(
              (id) => id !== action.payload.eventId
            )
          ),
        },
      };

    case ActionTypes.REJECT_EVENT_START:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          rejectingEvents: new Set([...state.observabilityEvents.rejectingEvents, action.payload]),
        },
      };

    case ActionTypes.REJECT_EVENT_SUCCESS:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          rejectingEvents: new Set(
            [...state.observabilityEvents.rejectingEvents].filter((id) => id !== action.payload)
          ),
        },
      };

    case ActionTypes.REJECT_EVENT_FAILURE:
      return {
        ...state,
        observabilityEvents: {
          ...state.observabilityEvents,
          rejectingEvents: new Set(
            [...state.observabilityEvents.rejectingEvents].filter(
              (id) => id !== action.payload.eventId
            )
          ),
        },
      };

    // OS Installation
    case ActionTypes.FETCH_ISO_LIST_START:
      return {
        ...state,
        osInstallation: {
          ...state.osInstallation,
          loadingIsos: true,
        },
        iso: {
          ...state.iso,
          loading: true,
        },
      };

    case ActionTypes.FETCH_ISO_LIST_SUCCESS:
      return {
        ...state,
        osInstallation: {
          ...state.osInstallation,
          isoList: action.payload,
          loadingIsos: false,
        },
        iso: {
          ...state.iso,
          isoList: action.payload,
          loading: false,
          error: null,
        },
      };

    case ActionTypes.FETCH_ISO_LIST_FAILURE:
      return {
        ...state,
        osInstallation: {
          ...state.osInstallation,
          loadingIsos: false,
          message: action.payload,
        },
        iso: {
          ...state.iso,
          loading: false,
          error: action.payload,
        },
      };

    case ActionTypes.ISO_UPLOAD_START:
      return {
        ...state,
        iso: {
          ...state.iso,
          loading: true,
          error: null,
        },
      };

    case ActionTypes.ISO_UPLOAD_SUCCESS:
      return {
        ...state,
        iso: {
          ...state.iso,
          loading: false,
          error: null,
          // Clear upload progress tracking on success
          uploadingIso: false,
          uploadProgress: 0,
          uploadMessage: '',
          uploadMessageType: '',
        },
      };

    case ActionTypes.ISO_UPLOAD_FAILURE:
      return {
        ...state,
        iso: {
          ...state.iso,
          loading: false,
          error: action.payload,
          uploadingIso: false,
        },
      };

    // Upload progress tracking cases
    case ActionTypes.ISO_UPLOAD_PROGRESS:
      return {
        ...state,
        iso: {
          ...state.iso,
          uploadProgress: action.payload.progress,
          uploadingIso: true,
        },
      };

    case ActionTypes.ISO_SET_UPLOAD_MESSAGE:
      return {
        ...state,
        iso: {
          ...state.iso,
          uploadMessage: action.payload.message,
          uploadMessageType: action.payload.messageType,
        },
      };

    case ActionTypes.ISO_CLEAR_UPLOAD_STATE:
      return {
        ...state,
        iso: {
          ...state.iso,
          uploadingIso: false,
          uploadProgress: 0,
          uploadMessage: '',
          uploadMessageType: '',
        },
      };

    // Download progress tracking cases
    case ActionTypes.ISO_DOWNLOAD_START:
      return {
        ...state,
        iso: {
          ...state.iso,
          downloadingIso: true,
          downloadProgress: 0,
          downloadMessage: 'Downloading...',
          downloadMessageType: 'info',
        },
      };

    case ActionTypes.ISO_DOWNLOAD_SUCCESS:
      return {
        ...state,
        iso: {
          ...state.iso,
          downloadingIso: false,
          downloadProgress: 100,
          downloadMessage: 'ISO downloaded successfully!',
          downloadMessageType: 'success',
        },
      };

    case ActionTypes.ISO_DOWNLOAD_FAILURE:
      return {
        ...state,
        iso: {
          ...state.iso,
          downloadingIso: false,
          downloadProgress: 0,
          downloadMessage: action.payload,
          downloadMessageType: 'error',
        },
      };

    case ActionTypes.ISO_DOWNLOAD_PROGRESS:
      return {
        ...state,
        iso: {
          ...state.iso,
          downloadProgress: action.payload.progress,
        },
      };

    case ActionTypes.ISO_SET_DOWNLOAD_MESSAGE:
      return {
        ...state,
        iso: {
          ...state.iso,
          downloadMessage: action.payload.message,
          downloadMessageType: action.payload.messageType,
        },
      };

    case ActionTypes.ISO_CLEAR_DOWNLOAD_STATE:
      return {
        ...state,
        iso: {
          ...state.iso,
          downloadingIso: false,
          downloadProgress: 0,
          downloadMessage: '',
          downloadMessageType: '',
        },
      };

    // Datacenter ISO Management Cases
    case ActionTypes.DC_ISO_FETCH_LIST_START:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          loading: true,
          error: null,
        },
      };

    case ActionTypes.DC_ISO_FETCH_LIST_SUCCESS:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          loading: false,
          error: null,
          isoList: action.payload,
        },
      };

    case ActionTypes.DC_ISO_FETCH_LIST_FAILURE:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          loading: false,
          error: action.payload,
        },
      };

    case ActionTypes.DC_ISO_FETCH_CLOUD_IMAGES_START:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          loading: true,
          cloudImagesError: null,
        },
      };

    case ActionTypes.DC_ISO_FETCH_CLOUD_IMAGES_SUCCESS:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          loading: false,
          cloudImagesError: null,
          cloudImagesList: action.payload,
        },
      };

    case ActionTypes.DC_ISO_FETCH_CLOUD_IMAGES_FAILURE:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          loading: false,
          cloudImagesError: action.payload,
        },
      };

    case ActionTypes.DC_ISO_UPLOAD_START:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          uploadingIso: true,
          uploadProgress: 0,
          uploadMessage: 'Uploading file...',
          uploadMessageType: 'info',
        },
      };

    case ActionTypes.DC_ISO_UPLOAD_SUCCESS:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          uploadingIso: false,
          uploadProgress: 0,
          uploadMessage: '',
          uploadMessageType: '',
        },
      };

    case ActionTypes.DC_ISO_UPLOAD_FAILURE:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          uploadingIso: false,
          uploadMessage: action.payload,
          uploadMessageType: 'error',
        },
      };

    case ActionTypes.DC_ISO_UPLOAD_PROGRESS:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          uploadProgress: action.payload.progress,
          uploadingIso: true,
        },
      };

    case ActionTypes.DC_ISO_SET_UPLOAD_MESSAGE:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          uploadMessage: action.payload.message,
          uploadMessageType: action.payload.messageType,
        },
      };

    case ActionTypes.DC_ISO_CLEAR_UPLOAD_STATE:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          uploadingIso: false,
          uploadProgress: 0,
          uploadMessage: '',
          uploadMessageType: '',
        },
      };

    case ActionTypes.DC_ISO_DOWNLOAD_START:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          downloadingIso: true,
          downloadProgress: 0,
          downloadMessage: 'Downloading...',
          downloadMessageType: 'info',
        },
      };

    case ActionTypes.DC_ISO_DOWNLOAD_SUCCESS:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          downloadingIso: false,
          downloadProgress: 100,
          downloadMessage: 'ISO downloaded successfully!',
          downloadMessageType: 'success',
        },
      };

    case ActionTypes.DC_ISO_DOWNLOAD_FAILURE:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          downloadingIso: false,
          downloadProgress: 0,
          downloadMessage: action.payload,
          downloadMessageType: 'error',
        },
      };

    case ActionTypes.DC_ISO_DOWNLOAD_PROGRESS:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          downloadProgress: action.payload.progress,
        },
      };

    case ActionTypes.DC_ISO_SET_DOWNLOAD_MESSAGE:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          downloadMessage: action.payload.message,
          downloadMessageType: action.payload.messageType,
        },
      };

    case ActionTypes.DC_ISO_CLEAR_DOWNLOAD_STATE:
      return {
        ...state,
        dcIso: {
          ...state.dcIso,
          downloadingIso: false,
          downloadProgress: 0,
          downloadMessage: '',
          downloadMessageType: '',
        },
      };

    case ActionTypes.SET_SELECTED_ISO:
      return {
        ...state,
        osInstallation: {
          ...state.osInstallation,
          selectedIso: action.payload,
        },
      };

    case ActionTypes.SET_OS_INSTALL_MESSAGE:
      return {
        ...state,
        osInstallation: {
          ...state.osInstallation,
          message: action.payload,
        },
      };

    case ActionTypes.SET_INSTALLING_STATE:
      return {
        ...state,
        osInstallation: {
          ...state.osInstallation,
          isInstalling: action.payload,
        },
      };

    case ActionTypes.TOGGLE_START_ON_BOOT:
      return {
        ...state,
        osInstallation: {
          ...state.osInstallation,
          startOnBoot: action.payload,
        },
      };

    // VNC Console
    case ActionTypes.SET_VNC_CONSOLE_URL:
      return {
        ...state,
        vncConsoleUrl: action.payload,
      };

    case ActionTypes.SET_VNC_CONSOLE_OPTIONS:
      return {
        ...state,
        vncConsoleOptions: action.payload,
      };

    case ActionTypes.VNC_CONSOLE_ERROR:
      return {
        ...state,
        vncConsoleError: action.payload,
      };

    // Network Management
    case ActionTypes.FETCH_NETWORK_INTERFACES_START:
      return {
        ...state,
        network: {
          ...state.network,
          loadingInterfaces: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_NETWORK_INTERFACES_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          loadingInterfaces: false,
          error: action.payload,
        },
      };
    case ActionTypes.FETCH_SWITCHES_START:
      return {
        ...state,
        network: {
          ...state.network,
          loadingSwitches: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_SWITCHES_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          loadingSwitches: false,
          switches: action.payload,
          error: null,
        },
      };
    case ActionTypes.FETCH_SWITCHES_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          loadingSwitches: false,
          error: action.payload,
        },
      };
    case ActionTypes.CREATE_SWITCH_START:
      return {
        ...state,
        network: {
          ...state.network,
          error: null,
        },
      };
    case ActionTypes.CREATE_SWITCH_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          error: null,
        },
      };
    case ActionTypes.CREATE_SWITCH_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          error: action.payload,
        },
      };
    case ActionTypes.DELETE_SWITCH_START:
      return {
        ...state,
        network: {
          ...state.network,
          error: null,
        },
      };
    case ActionTypes.DELETE_SWITCH_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          error: null,
        },
      };
    case ActionTypes.DELETE_SWITCH_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          error: action.payload,
        },
      };
    case ActionTypes.SET_NETWORK_DROPDOWN:
      return {
        ...state,
        network: {
          ...state.network,
          dropdownSelection: action.payload,
        },
      };
    case ActionTypes.SET_SHOW_CREATE_SWITCH_FORM:
      return {
        ...state,
        network: {
          ...state.network,
          showCreateSwitchForm: action.payload,
        },
      };
    case ActionTypes.SET_SWITCH_NAME:
      return {
        ...state,
        network: {
          ...state.network,
          switchName: action.payload,
        },
      };
    case ActionTypes.SET_SELECTED_INTERFACE:
      return {
        ...state,
        network: {
          ...state.network,
          selectedInterface: action.payload,
        },
      };

    // Network Switches Management
    case ActionTypes.FETCH_NETWORK_SWITCHES_START:
      return {
        ...state,
        network: {
          ...state.network,
          loadingSwitches: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_NETWORK_SWITCHES_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          loadingSwitches: false,
          switches: action.payload,
          error: null,
        },
      };
    case ActionTypes.FETCH_NETWORK_SWITCHES_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          loadingSwitches: false,
          error: action.payload,
        },
      };
    case ActionTypes.CREATE_NETWORK_SWITCH_START:
      return {
        ...state,
        network: {
          ...state.network,
          loadingCreateSwitch: true,
          createSwitchError: null,
          createSwitchSuccess: null,
        },
      };
    case ActionTypes.CREATE_NETWORK_SWITCH_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          loadingCreateSwitch: false,
          createSwitchSuccess: action.payload,
          createSwitchError: null,
        },
      };
    case ActionTypes.CREATE_NETWORK_SWITCH_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          loadingCreateSwitch: false,
          createSwitchError: action.payload,
          createSwitchSuccess: null,
        },
      };

    // TAP Interface Management
    case ActionTypes.ADD_TAP_INTERFACE_START:
      return {
        ...state,
        network: {
          ...state.network,
          addTapLoading: true,
          addTapError: null,
          addTapSuccess: null,
        },
      };
    case ActionTypes.ADD_TAP_INTERFACE_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          addTapLoading: false,
          addTapSuccess: action.payload,
          addTapError: null,
        },
      };
    case ActionTypes.ADD_TAP_INTERFACE_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          addTapLoading: false,
          addTapError: action.payload,
          addTapSuccess: null,
        },
      };
    case ActionTypes.DETACH_TAP_INTERFACE_START:
      return {
        ...state,
        network: {
          ...state.network,
          detachTapLoading: true,
          detachTapError: null,
          detachTapSuccess: null,
        },
      };
    case ActionTypes.DETACH_TAP_INTERFACE_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          detachTapLoading: false,
          detachTapSuccess: action.payload,
          detachTapError: null,
        },
      };
    case ActionTypes.DETACH_TAP_INTERFACE_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          detachTapLoading: false,
          detachTapError: action.payload,
          detachTapSuccess: null,
        },
      };
    case ActionTypes.BULK_DETACH_TAP_INTERFACES_START:
      return {
        ...state,
        network: {
          ...state.network,
          bulkDetachTapLoading: true,
          bulkDetachTapError: null,
          bulkDetachTapSuccess: null,
        },
      };
    case ActionTypes.BULK_DETACH_TAP_INTERFACES_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          bulkDetachTapLoading: false,
          bulkDetachTapSuccess: action.payload,
          bulkDetachTapError: null,
        },
      };
    case ActionTypes.BULK_DETACH_TAP_INTERFACES_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          bulkDetachTapLoading: false,
          bulkDetachTapError: action.payload,
          bulkDetachTapSuccess: null,
        },
      };

    // Parent Interface Management
    case ActionTypes.ADD_PARENT_INTERFACE_START:
      return {
        ...state,
        network: {
          ...state.network,
          addParentLoading: true,
          addParentError: null,
          addParentSuccess: null,
        },
      };
    case ActionTypes.ADD_PARENT_INTERFACE_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          addParentLoading: false,
          addParentSuccess: action.payload,
          addParentError: null,
        },
      };
    case ActionTypes.ADD_PARENT_INTERFACE_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          addParentLoading: false,
          addParentError: action.payload,
          addParentSuccess: null,
        },
      };

    // Firewall Management
    case ActionTypes.FETCH_FIREWALL_RULES_START:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          loading: true,
          notification: null,
        }),
      };
    case ActionTypes.FETCH_FIREWALL_RULES_SUCCESS:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          loading: false,
          rules: action.payload.rules,
          originalRules: action.payload.rules,
          notification: null,
        }),
      };
    case ActionTypes.FETCH_FIREWALL_RULES_FAILURE:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          loading: false,
          notification: { message: action.payload.error, type: 'error' },
        }),
      };
    case ActionTypes.UPDATE_FIREWALL_RULES_START:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          loading: true,
          notification: null,
        }),
      };
    case ActionTypes.UPDATE_FIREWALL_RULES_SUCCESS:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          loading: false,
          id: action.payload.id,
          rules: action.payload.rules,
          originalRules: action.payload.rules,
          revertCountdown: 59,
          revertEndTime: Date.now() + 59 * 1000, // Store end time instead of just countdown
          notification: null,
        }),
      };
    case ActionTypes.UPDATE_FIREWALL_RULES_FAILURE:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          loading: false,
          notification: { message: action.payload.error, type: 'error' },
        }),
      };
    case ActionTypes.CANCEL_FIREWALL_REVERT_START:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          isCancellingRevert: true,
        }),
      };
    case ActionTypes.CANCEL_FIREWALL_REVERT_SUCCESS:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          isCancellingRevert: false,
          revertCountdown: null,
          revertEndTime: null,
          notification: { message: 'Changes confirmed successfully.', type: 'success' },
        }),
      };
    case ActionTypes.CANCEL_FIREWALL_REVERT_FAILURE:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          isCancellingRevert: false,
          notification: { message: action.payload.error, type: 'error' },
        }),
      };
    case ActionTypes.SET_FIREWALL_NOTIFICATION:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          notification: action.payload.notification,
        }),
      };
    case ActionTypes.SET_FIREWALL_REVERT_COUNTDOWN:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          revertCountdown: action.payload.countdown,
          revertEndTime:
            action.payload.countdown !== null
              ? state.firewall[action.payload.serverIp]?.revertEndTime ||
                Date.now() + action.payload.countdown * 1000
              : null,
        }),
      };
    case ActionTypes.SET_FIREWALL_ID:
      return {
        ...state,
        firewall: updateFirewallForServer(state.firewall, action.payload.serverIp, {
          id: action.payload.id,
        }),
      };

    // System Logs
    case ActionTypes.FETCH_LOGS_START:
      return {
        ...state,
        logs: {
          ...state.logs,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_LOGS_SUCCESS: {
      // Handle both old and new formats
      const logsPayload = action.payload;
      const logs = logsPayload.logs ? logsPayload.logs : logsPayload;
      const totalLogsCount =
        logsPayload.totalCount !== undefined ? logsPayload.totalCount : logs.length;

      return {
        ...state,
        logs: {
          ...state.logs,
          loading: false,
          logs: logs,
          totalCount: totalLogsCount,
          error: null,
        },
      };
    }
    case ActionTypes.FETCH_LOGS_FAILURE:
      return {
        ...state,
        logs: {
          ...state.logs,
          loading: false,
          error: action.payload,
        },
      };
    case ActionTypes.SET_LOGS_LEVEL:
      return {
        ...state,
        logs: {
          ...state.logs,
          level: action.payload,
        },
      };
    case ActionTypes.SET_LOGS_CONTAINS:
      return {
        ...state,
        logs: {
          ...state.logs,
          contains: action.payload,
        },
      };

    // Storage / Disk Attach
    case ActionTypes.FETCH_STORAGE_POOLS_START:
      return {
        ...state,
        storage: {
          ...state.storage,
          loadingPools: true,
        },
      };
    case ActionTypes.FETCH_STORAGE_POOLS_SUCCESS:
      return {
        ...state,
        storage: {
          ...state.storage,
          loadingPools: false,
          pools: action.payload.original, // Use the original format
          poolsTransformed: action.payload.transformed, // Store transformed format separately
        },
      };
    case ActionTypes.FETCH_STORAGE_POOLS_FAILURE:
      return {
        ...state,
        storage: {
          ...state.storage,
          loadingPools: false,
        },
      };
    case ActionTypes.FETCH_DATASTORES_START:
      return {
        ...state,
        storage: {
          ...state.storage,
          loadingDatastores: true,
        },
      };
    case ActionTypes.FETCH_DATASTORES_SUCCESS:
      return {
        ...state,
        storage: {
          ...state.storage,
          loadingDatastores: false,
          datastores: action.payload,
        },
      };
    case ActionTypes.FETCH_DATASTORES_FAILURE:
      return {
        ...state,
        storage: {
          ...state.storage,
          loadingDatastores: false,
        },
      };
    case ActionTypes.FETCH_VM_DISKS_START:
      return {
        ...state,
        storage: {
          ...state.storage,
          loadingVmDisks: true,
        },
      };
    case ActionTypes.FETCH_VM_DISKS_SUCCESS:
      return {
        ...state,
        storage: {
          ...state.storage,
          loadingVmDisks: false,
          vmDisks: action.payload,
        },
      };
    case ActionTypes.FETCH_VM_DISKS_FAILURE:
      return {
        ...state,
        storage: {
          ...state.storage,
          loadingVmDisks: false,
        },
      };
    case ActionTypes.ATTACH_DISK_START:
      return {
        ...state,
        storage: {
          ...state.storage,
          attachLoading: true,
          attachError: null,
          attachSuccess: null,
        },
      };
    case ActionTypes.ATTACH_DISK_SUCCESS:
      return {
        ...state,
        storage: {
          ...state.storage,
          attachLoading: false,
          attachSuccess: true,
        },
      };
    case ActionTypes.ATTACH_DISK_FAILURE:
      return {
        ...state,
        storage: {
          ...state.storage,
          attachLoading: false,
          attachError: action.payload,
        },
      };
    case ActionTypes.REASSIGN_DISK_START:
      return {
        ...state,
        storage: {
          ...state.storage,
          reassignLoading: true,
          reassignError: null,
          reassignSuccess: null,
        },
      };
    case ActionTypes.REASSIGN_DISK_SUCCESS:
      return {
        ...state,
        storage: {
          ...state.storage,
          reassignLoading: false,
          reassignSuccess: true,
        },
      };
    case ActionTypes.REASSIGN_DISK_FAILURE:
      return {
        ...state,
        storage: {
          ...state.storage,
          reassignLoading: false,
          reassignError: action.payload,
        },
      };
    case ActionTypes.SET_DISK_FORM_FIELD:
      return {
        ...state,
        storage: {
          ...state.storage,
          diskForm: {
            ...state.storage.diskForm,
            [action.payload.field]: action.payload.value,
          },
        },
      };

    // ISO Management
    case ActionTypes.SET_ISO_FIELD:
      return {
        ...state,
        iso: {
          ...state.iso,
          [action.payload.field]: action.payload.value,
        },
      };

    case ActionTypes.DELETE_DATASET_START:
      return {
        ...state,
        storage: {
          ...state.storage,
          deleteLoading: true,
          deleteError: null,
          deleteSuccess: null,
        },
      };
    case ActionTypes.DELETE_DATASET_SUCCESS:
      return {
        ...state,
        storage: {
          ...state.storage,
          deleteLoading: false,
          deleteSuccess: true,
        },
      };
    case ActionTypes.DELETE_DATASET_FAILURE:
      return {
        ...state,
        storage: {
          ...state.storage,
          deleteLoading: false,
          deleteError: action.payload,
        },
      };

    // Snapshot Management
    case ActionTypes.FETCH_SNAPSHOTS_START:
      return { ...state, snapshotsLoading: true, error: null };

    case ActionTypes.FETCH_SNAPSHOTS_SUCCESS:
      return { ...state, snapshots: action.payload, snapshotsLoading: false };

    case ActionTypes.FETCH_VM_SNAPSHOTS_SUCCESS:
      return {
        ...state,
        vmSnapshots: {
          ...state.vmSnapshots,
          [action.payload.vmKey]: action.payload.snapshots,
        },
        snapshotsLoading: false,
      };

    case ActionTypes.FETCH_SNAPSHOTS_FAILURE:
      return { ...state, snapshotsLoading: false, error: action.payload };

    case ActionTypes.CREATE_SNAPSHOT_START:
      return { ...state, creatingSnapshot: true, error: null };

    case ActionTypes.CREATE_SNAPSHOT_SUCCESS:
      return { ...state, creatingSnapshot: false };

    case ActionTypes.CREATE_SNAPSHOT_FAILURE:
      return { ...state, creatingSnapshot: false, error: action.payload };

    case ActionTypes.ROLLBACK_SNAPSHOT_START:
      return { ...state, rollingBackSnapshot: true, error: null };

    case ActionTypes.ROLLBACK_SNAPSHOT_SUCCESS:
      return { ...state, rollingBackSnapshot: false };

    case ActionTypes.ROLLBACK_SNAPSHOT_FAILURE:
      return { ...state, rollingBackSnapshot: false, error: action.payload };

    case ActionTypes.SET_SNAPSHOT_MESSAGE:
      return { ...state, snapshotMessage: action.payload };

    case ActionTypes.SET_CREATING_ZPOOL:
      return {
        ...state,
        creatingZpool: action.payload,
      };

    case ActionTypes.SET_CREATING_DATASTORE:
      return {
        ...state,
        creatingDatastore: action.payload,
      };

    case ActionTypes.SET_DROPDOWN_OPEN:
      return {
        ...state,
        dropdownOpen: action.payload,
      };

    // Power Monitoring
    case ActionTypes.FETCH_POWER_DATA_START:
      return {
        ...state,
        power: {
          ...state.power,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_POWER_DATA_SUCCESS:
      return {
        ...state,
        power: {
          ...state.power,
          loading: false,
          data: action.payload,
          error: null,
        },
      };
    case ActionTypes.FETCH_POWER_DATA_FAILURE:
      return {
        ...state,
        power: {
          ...state.power,
          loading: false,
          error: action.payload,
        },
      };

    // Node Top Info metrics
    case ActionTypes.FETCH_NODE_TOP_INFO_START:
      return {
        ...state,
        nodeTopInfo: {
          ...state.nodeTopInfo,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_NODE_TOP_INFO_SUCCESS:
      return {
        ...state,
        nodeTopInfo: {
          ...state.nodeTopInfo,
          loading: false,
          data: action.payload,
          error: null,
        },
      };
    case ActionTypes.FETCH_NODE_TOP_INFO_FAILURE:
      return {
        ...state,
        nodeTopInfo: {
          ...state.nodeTopInfo,
          loading: false,
          error: action.payload,
        },
      };

    // Updates Management
    case ActionTypes.FETCH_UPDATES_START:
      return {
        ...state,
        updates: {
          ...state.updates,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_UPDATES_SUCCESS:
      return {
        ...state,
        updates: {
          ...state.updates,
          loading: false,
          data: action.payload.updates || action.payload, // Extract updates array for backwards compatibility
          status: action.payload.status, // Store the status field
          last_fetched_at: action.payload.last_fetched_at, // Store the last_fetched_at field
          error: null,
        },
      };
    case ActionTypes.FETCH_UPDATES_FAILURE:
      return {
        ...state,
        updates: {
          ...state.updates,
          loading: false,
          error: action.payload,
          data: [],
        },
      };
    case ActionTypes.SET_UPDATES_FILTER:
      return {
        ...state,
        updates: {
          ...state.updates,
          filter: action.payload,
        },
      };
    case ActionTypes.DOWNLOAD_UPDATE_START:
      return {
        ...state,
        updates: {
          ...state.updates,
          // Add this update to downloadingUpdates array
          downloadingUpdates: [...state.updates.downloadingUpdates, action.payload.type],
          downloading: true,
          downloadError: null,
          downloadSuccess: false,
        },
      };
    case ActionTypes.DOWNLOAD_UPDATE_SUCCESS:
      return {
        ...state,
        updates: {
          ...state.updates,
          // Remove from downloading array and add to downloaded array
          downloadingUpdates: Array.isArray(state.updates.downloadingUpdates)
            ? state.updates.downloadingUpdates.filter((id) => id !== action.payload.type)
            : [],
          downloadedUpdates: [
            ...(Array.isArray(state.updates.downloadedUpdates)
              ? state.updates.downloadedUpdates
              : []),
            action.payload.type,
          ],
          // Keep these for backwards compatibility
          downloading: false,
          downloadSuccess: true,
          downloadError: null,
          downloadedUpdateId: action.payload.type,
          // Remove the global canInstall flag that was causing all updates to show Install button
          // canInstall should be determined per-update based on downloadedUpdates array
          // Store the storedPath from the response
          storedPath: action.payload.storedPath,
        },
      };
    case ActionTypes.DOWNLOAD_UPDATE_FAILURE:
      return {
        ...state,
        updates: {
          ...state.updates,
          // Remove from downloading array - handle both old and new payload formats
          downloadingUpdates: Array.isArray(state.updates.downloadingUpdates)
            ? state.updates.downloadingUpdates.filter(
                (id) => id !== (action.payload.updateType || action.payload.type || action.payload)
              )
            : [],
          downloading: false,
          downloadSuccess: false,
          downloadError: action.payload.error || action.payload,
        },
      };
    case ActionTypes.INSTALL_UPDATE_START:
      return {
        ...state,
        updates: {
          ...state.updates,
          // Add to installing updates array
          installingUpdates: [
            ...state.updates.installingUpdates,
            `${action.payload.updateType}-${action.payload.version}`,
          ],
          // Keep for backwards compatibility
          installing: true,
          installError: null,
          installSuccess: false,
          pendingInstallId: `${action.payload.updateType}-${action.payload.version}`, // Track update type and version being installed
          installResults: [], // Clear any previous results
        },
      };
    case ActionTypes.INSTALL_UPDATE_SUCCESS: {
      const installUpdateId = `${action.payload.updateType}-${action.payload.version}`;
      return {
        ...state,
        updates: {
          ...state.updates,
          // Remove from installing array and add to installed array
          installingUpdates: state.updates.installingUpdates.filter((id) => id !== installUpdateId),
          installedUpdates: [...state.updates.installedUpdates, installUpdateId],
          // Keep for backwards compatibility
          installing: false,
          installSuccess: true,
          installError: null,
          installedUpdateId: installUpdateId,
          pendingInstallId: null, // Clear pending installation
          installResults: action.payload.results || [], // Store installation results by host
        },
      };
    }
    case ActionTypes.INSTALL_UPDATE_FAILURE:
      return {
        ...state,
        updates: {
          ...state.updates,
          // Remove from installing array
          installingUpdates: state.updates.installingUpdates.filter(
            (id) => id !== `${action.payload.updateType}-${action.payload.version}`
          ),
          // Keep for backwards compatibility
          installing: false,
          installSuccess: false,
          installError: action.payload.error,
          pendingInstallId: null, // Clear pending installation
          installResults: action.payload.results || [], // Store any available results
        },
      };

    // Schedule Update Management
    case ActionTypes.SCHEDULE_UPDATE_START:
      return {
        ...state,
        updates: {
          ...state.updates,
          // Add to scheduling updates array
          schedulingUpdates: [
            ...state.updates.schedulingUpdates,
            `${action.payload.updateType}-${action.payload.version}`,
          ],
          // Keep for backwards compatibility
          scheduling: true,
          scheduleError: null,
          scheduleSuccess: false,
          pendingScheduleId: `${action.payload.updateType}-${action.payload.version}`, // Track update type and version being scheduled
        },
      };
    case ActionTypes.SCHEDULE_UPDATE_SUCCESS: {
      const scheduleUpdateId = `${action.payload.updateType}-${action.payload.version}`;
      return {
        ...state,
        updates: {
          ...state.updates,
          // Remove from scheduling array and add to scheduled array
          schedulingUpdates: state.updates.schedulingUpdates.filter(
            (id) => id !== scheduleUpdateId
          ),
          scheduledUpdates: [...state.updates.scheduledUpdates, scheduleUpdateId],
          // Keep for backwards compatibility
          scheduling: false,
          scheduleSuccess: true,
          scheduleError: null,
          scheduledUpdateId: scheduleUpdateId,
          pendingScheduleId: null, // Clear pending schedule
          scheduleTime: action.payload.schedule_time, // Store the scheduled time
        },
      };
    }
    case ActionTypes.SCHEDULE_UPDATE_FAILURE: {
      const failedScheduleId = `${action.payload.updateType}-${action.payload.version}`;
      return {
        ...state,
        updates: {
          ...state.updates,
          // Remove from scheduling array
          schedulingUpdates: state.updates.schedulingUpdates.filter(
            (id) => id !== failedScheduleId
          ),
          // Keep for backwards compatibility
          scheduling: false,
          scheduleSuccess: false,
          scheduleError: action.payload.error,
          pendingScheduleId: null, // Clear pending schedule
        },
      };
    }

    // Update History Management
    case ActionTypes.FETCH_UPDATE_HISTORY_START:
      return {
        ...state,
        updates: {
          ...state.updates,
          history: {
            ...state.updates.history,
            loading: true,
            error: null,
          },
        },
      };
    case ActionTypes.FETCH_UPDATE_HISTORY_SUCCESS:
      return {
        ...state,
        updates: {
          ...state.updates,
          history: {
            ...state.updates.history,
            loading: false,
            data: action.payload.history || [],
            pagination: action.payload.pagination || {
              page: 1,
              pageSize: 10,
              totalItems: 0,
              totalPages: 0,
            },
            error: null,
          },
        },
      };
    case ActionTypes.FETCH_UPDATE_HISTORY_FAILURE:
      return {
        ...state,
        updates: {
          ...state.updates,
          history: {
            ...state.updates.history,
            loading: false,
            error: action.payload,
            data: [],
          },
        },
      };
    case ActionTypes.SET_UPDATE_HISTORY_FILTER:
      return {
        ...state,
        updates: {
          ...state.updates,
          history: {
            ...state.updates.history,
            filters: action.payload,
          },
        },
      };

    // Update History Detail Management
    case ActionTypes.FETCH_UPDATE_HISTORY_DETAIL_START:
      return {
        ...state,
        updates: {
          ...state.updates,
          historyDetail: {
            ...state.updates.historyDetail,
            loading: true,
            error: null,
          },
        },
      };
    case ActionTypes.FETCH_UPDATE_HISTORY_DETAIL_SUCCESS:
      return {
        ...state,
        updates: {
          ...state.updates,
          historyDetail: {
            ...state.updates.historyDetail,
            loading: false,
            data: action.payload,
            error: null,
          },
        },
      };
    case ActionTypes.FETCH_UPDATE_HISTORY_DETAIL_FAILURE:
      return {
        ...state,
        updates: {
          ...state.updates,
          historyDetail: {
            ...state.updates.historyDetail,
            loading: false,
            error: action.payload,
            data: null,
          },
        },
      };

    // Current State Management
    case ActionTypes.FETCH_CURRENT_STATE_START:
      return {
        ...state,
        updates: {
          ...state.updates,
          currentState: {
            ...state.updates.currentState,
            loading: true,
            error: null,
          },
        },
      };
    case ActionTypes.FETCH_CURRENT_STATE_SUCCESS:
      return {
        ...state,
        updates: {
          ...state.updates,
          currentState: {
            ...state.updates.currentState,
            loading: false,
            data: action.payload,
            error: null,
          },
        },
      };
    case ActionTypes.FETCH_CURRENT_STATE_FAILURE:
      return {
        ...state,
        updates: {
          ...state.updates,
          currentState: {
            ...state.updates.currentState,
            loading: false,
            error: action.payload,
            data: null,
          },
        },
      };
    case ActionTypes.SET_CURRENT_STATE_FILTER:
      return {
        ...state,
        updates: {
          ...state.updates,
          currentState: {
            ...state.updates.currentState,
            filters: action.payload,
          },
        },
      };

    // Install Jobs Management
    case ActionTypes.FETCH_INSTALL_JOBS_START:
      return {
        ...state,
        updates: {
          ...state.updates,
          installJobs: {
            ...state.updates.installJobs,
            loading: true,
            error: null,
          },
        },
      };
    case ActionTypes.FETCH_INSTALL_JOBS_SUCCESS:
      return {
        ...state,
        updates: {
          ...state.updates,
          installJobs: {
            ...state.updates.installJobs,
            loading: false,
            data: action.payload,
            error: null,
          },
        },
      };
    case ActionTypes.FETCH_INSTALL_JOBS_FAILURE:
      return {
        ...state,
        updates: {
          ...state.updates,
          installJobs: {
            ...state.updates.installJobs,
            loading: false,
            error: action.payload,
            data: null,
          },
        },
      };

    // Install Status Details Management
    case ActionTypes.FETCH_INSTALL_STATUS_DETAILS_START:
      return {
        ...state,
        updates: {
          ...state.updates,
          installStatusDetails: {
            ...state.updates.installStatusDetails,
            loading: true,
            error: null,
          },
        },
      };
    case ActionTypes.FETCH_INSTALL_STATUS_DETAILS_SUCCESS:
      return {
        ...state,
        updates: {
          ...state.updates,
          installStatusDetails: {
            ...state.updates.installStatusDetails,
            loading: false,
            data: action.payload,
            error: null,
          },
        },
      };
    case ActionTypes.FETCH_INSTALL_STATUS_DETAILS_FAILURE:
      return {
        ...state,
        updates: {
          ...state.updates,
          installStatusDetails: {
            ...state.updates.installStatusDetails,
            loading: false,
            error: action.payload,
            data: null,
          },
        },
      };

    // Install Nodes Management
    case ActionTypes.FETCH_INSTALL_NODES_START:
      return {
        ...state,
        updates: {
          ...state.updates,
          installNodes: {
            ...state.updates.installNodes,
            loading: true,
            error: null,
          },
        },
      };
    // DEPRECATED: Old handler - moved to installUpdates state (line ~4641)
    // case ActionTypes.FETCH_INSTALL_NODES_SUCCESS:
    //   return {
    //     ...state,
    //     updates: {
    //       ...state.updates,
    //       installNodes: {
    //         ...state.updates.installNodes,
    //         loading: false,
    //         data: action.payload,
    //         error: null
    //       }
    //     }
    //   };
    // case ActionTypes.FETCH_INSTALL_NODES_FAILURE:
    //   return {
    //     ...state,
    //     updates: {
    //       ...state.updates,
    //       installNodes: {
    //         ...state.updates.installNodes,
    //         loading: false,
    //         error: action.payload,
    //         data: null
    //       }
    //     }
    //   };

    case ActionTypes.SET_UPDATES_VIEW:
      return {
        ...state,
        updates: {
          ...state.updates,
          currentView: action.payload,
        },
      };

    // Network Vale Management Actions
    case ActionTypes.FETCH_VALE_CONFIG_START:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            loadingConfig: true,
            configError: null,
          },
        },
      };

    case ActionTypes.FETCH_VALE_CONFIG_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            config: action.payload,
            loadingConfig: false,
            configError: null,
          },
        },
      };

    case ActionTypes.FETCH_VALE_CONFIG_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            loadingConfig: false,
            configError: action.payload,
          },
        },
      };

    case ActionTypes.FETCH_VALE_CONNECTIONS_START:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            loadingConnections: true,
            connectionsError: null,
          },
        },
      };

    case ActionTypes.FETCH_VALE_CONNECTIONS_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            connections: action.payload,
            loadingConnections: false,
            connectionsError: null,
            lastUpdated: action.payload.lastUpdated,
          },
        },
      };

    case ActionTypes.FETCH_VALE_CONNECTIONS_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            loadingConnections: false,
            connectionsError: action.payload,
          },
        },
      };

    case ActionTypes.FETCH_VALE_DETAILS_START:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            loadingDetails: true,
            detailsError: null,
          },
        },
      };

    case ActionTypes.FETCH_VALE_DETAILS_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            details: action.payload,
            loadingDetails: false,
            detailsError: null,
          },
        },
      };

    case ActionTypes.FETCH_VALE_DETAILS_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            loadingDetails: false,
            detailsError: action.payload,
          },
        },
      };

    case ActionTypes.DETACH_VALE_SWITCH_START:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            detachLoading: true,
            detachError: null,
            detachSuccess: null,
          },
        },
      };

    case ActionTypes.DETACH_VALE_SWITCH_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            detachLoading: false,
            detachSuccess: action.payload,
            detachError: null,
          },
        },
      };

    case ActionTypes.DETACH_VALE_SWITCH_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            detachLoading: false,
            detachError: action.payload,
            detachSuccess: null,
          },
        },
      };

    // Attach Vale Switch Actions
    case ActionTypes.ATTACH_VALE_SWITCH_START:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            attachLoading: true,
            attachError: null,
            attachSuccess: null,
          },
        },
      };

    case ActionTypes.ATTACH_VALE_SWITCH_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            attachLoading: false,
            attachSuccess: action.payload,
            attachError: null,
          },
        },
      };

    case ActionTypes.ATTACH_VALE_SWITCH_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            attachLoading: false,
            attachError: action.payload,
            attachSuccess: null,
          },
        },
      };

    case ActionTypes.CLEAR_VALE_MESSAGES:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            detachError: null,
            detachSuccess: null,
            attachError: null,
            attachSuccess: null,
            configError: null,
            summaryError: null,
            destroyError: null,
            destroySuccess: null,
            destroyAnalysisError: null,
          },
        },
      };

    // Destroy Vale Switch Actions
    case ActionTypes.DESTROY_VALE_SWITCH_START:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            destroyLoading: true,
            destroyError: null,
            destroySuccess: null,
          },
        },
      };

    case ActionTypes.DESTROY_VALE_SWITCH_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            destroyLoading: false,
            destroySuccess: action.payload,
            destroyError: null,
          },
        },
      };

    case ActionTypes.DESTROY_VALE_SWITCH_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            destroyLoading: false,
            destroyError: action.payload,
            destroySuccess: null,
          },
        },
      };

    case ActionTypes.FETCH_VALE_DESTROY_ANALYSIS_START:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            destroyAnalysisLoading: true,
            destroyAnalysisError: null,
            destroyAnalysis: null,
          },
        },
      };

    case ActionTypes.FETCH_VALE_DESTROY_ANALYSIS_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            destroyAnalysisLoading: false,
            destroyAnalysis: action.payload,
            destroyAnalysisError: null,
          },
        },
      };

    case ActionTypes.FETCH_VALE_DESTROY_ANALYSIS_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            destroyAnalysisLoading: false,
            destroyAnalysisError: action.payload,
            destroyAnalysis: null,
          },
        },
      };

    case ActionTypes.SET_VALE_DESTROY_CONFIRMATION:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            destroyConfirmation: action.payload,
          },
        },
      };

    case ActionTypes.CLEAR_VALE_DESTROY_STATE:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            destroyLoading: false,
            destroyError: null,
            destroySuccess: null,
            destroyAnalysisLoading: false,
            destroyAnalysisError: null,
            destroyAnalysis: null,
            destroyConfirmation: null,
          },
        },
      };

    // Detach Parent NIC Actions
    case ActionTypes.DETACH_PARENT_NIC_START:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            detachParentLoading: true,
            detachParentError: null,
            detachParentSuccess: null,
          },
        },
      };

    case ActionTypes.DETACH_PARENT_NIC_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            detachParentLoading: false,
            detachParentSuccess: action.payload,
            detachParentError: null,
          },
        },
      };

    case ActionTypes.DETACH_PARENT_NIC_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            detachParentLoading: false,
            detachParentError: action.payload,
            detachParentSuccess: null,
          },
        },
      };

    // Vale Summary Actions
    case ActionTypes.FETCH_VALE_SUMMARY_START:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            loadingSummary: true,
            summaryError: null,
          },
        },
      };

    case ActionTypes.FETCH_VALE_SUMMARY_SUCCESS:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            summary: action.payload,
            loadingSummary: false,
            summaryError: null,
          },
        },
      };

    case ActionTypes.FETCH_VALE_SUMMARY_FAILURE:
      return {
        ...state,
        network: {
          ...state.network,
          vale: {
            ...state.network.vale,
            loadingSummary: false,
            summaryError: action.payload,
          },
        },
      };

    // VLAN Management Actions
    case ActionTypes.FETCH_VLANS_START:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          loadingVlans: true,
          error: '',
        },
      };

    case ActionTypes.FETCH_VLANS_SUCCESS:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          vlans: action.payload.vlans || [],
          loadingVlans: false,
          error: '',
        },
      };

    case ActionTypes.FETCH_VLANS_FAILURE:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          loadingVlans: false,
          error: action.payload,
        },
      };

    case ActionTypes.FETCH_VLAN_DETAILS_START:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          loadingVlanDetails: true,
        },
      };

    case ActionTypes.FETCH_VLAN_DETAILS_SUCCESS:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          vlanDetails: action.payload,
          loadingVlanDetails: false,
        },
      };

    case ActionTypes.FETCH_VLAN_DETAILS_FAILURE:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          loadingVlanDetails: false,
          error: action.payload,
        },
      };

    case ActionTypes.CREATE_VLAN_START:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          creatingVlan: true,
          error: '',
        },
      };

    case ActionTypes.CREATE_VLAN_SUCCESS:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          creatingVlan: false,
          error: '',
        },
      };

    case ActionTypes.CREATE_VLAN_FAILURE:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          creatingVlan: false,
          error: action.payload,
        },
      };

    case ActionTypes.DELETE_VLAN_START:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          deletingVlan: true,
          error: '',
        },
      };

    case ActionTypes.DELETE_VLAN_SUCCESS:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          deletingVlan: false,
          error: '',
        },
      };

    case ActionTypes.DELETE_VLAN_FAILURE:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          deletingVlan: false,
          error: action.payload,
        },
      };

    case ActionTypes.FETCH_VLAN_AVAILABLE_TAGS_START:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          loadingAvailableTags: true,
        },
      };

    case ActionTypes.FETCH_VLAN_AVAILABLE_TAGS_SUCCESS:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          availableTags: action.payload,
          loadingAvailableTags: false,
        },
      };

    case ActionTypes.FETCH_VLAN_AVAILABLE_TAGS_FAILURE:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          loadingAvailableTags: false,
          error: action.payload,
        },
      };

    case ActionTypes.FETCH_VLAN_STATS_START:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          loadingVlanStats: true,
        },
      };

    case ActionTypes.FETCH_VLAN_STATS_SUCCESS:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          vlanStats: action.payload,
          loadingVlanStats: false,
        },
      };

    case ActionTypes.FETCH_VLAN_STATS_FAILURE:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          loadingVlanStats: false,
          error: action.payload,
        },
      };

    case ActionTypes.PING_VLAN_START:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          pingInProgress: true,
        },
      };

    case ActionTypes.PING_VLAN_SUCCESS:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          pingResult: action.payload,
          pingInProgress: false,
        },
      };

    case ActionTypes.PING_VLAN_FAILURE:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          pingInProgress: false,
          error: action.payload,
        },
      };

    case ActionTypes.CONFIGURE_VLAN_IP_START:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          configuringIP: true,
        },
      };

    case ActionTypes.CONFIGURE_VLAN_IP_SUCCESS:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          configuringIP: false,
        },
      };

    case ActionTypes.CONFIGURE_VLAN_IP_FAILURE:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          configuringIP: false,
          error: action.payload,
        },
      };

    case ActionTypes.FETCH_VLAN_DELETION_PROMPT_START:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          loadingDeletionPrompt: true,
        },
      };

    case ActionTypes.FETCH_VLAN_DELETION_PROMPT_SUCCESS:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          deletionPrompt: action.payload,
          loadingDeletionPrompt: false,
        },
      };

    case ActionTypes.FETCH_VLAN_DELETION_PROMPT_FAILURE:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          loadingDeletionPrompt: false,
          error: action.payload,
        },
      };

    case ActionTypes.SET_VLAN_FORM:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          vlanForm: {
            ...state.vlans.vlanForm,
            ...action.payload,
          },
        },
      };

    case ActionTypes.CLEAR_VLAN_FORM:
      return {
        ...state,
        vlans: {
          ...state.vlans,
          vlanForm: {
            tag_id: 0,
            parent_nic: '',
            vlan_number: 0,
            static_ip: '',
            subnet_mask: '',
          },
        },
      };

    // Cloud Images
    case ActionTypes.FETCH_CLOUD_IMAGES_START:
      return {
        ...state,
        cloudImages: {
          ...state.cloudImages,
          loading: true,
          error: null,
        },
      };

    case ActionTypes.FETCH_CLOUD_IMAGES_SUCCESS:
      return {
        ...state,
        cloudImages: {
          ...state.cloudImages,
          cloudImagesList: action.payload,
          loading: false,
          error: null,
        },
      };

    case ActionTypes.FETCH_CLOUD_IMAGES_FAILURE:
      return {
        ...state,
        cloudImages: {
          ...state.cloudImages,
          loading: false,
          error: action.payload,
        },
      };

    case ActionTypes.RESET_VLAN_STATE:
      return {
        ...state,
        vlans: {
          vlans: [],
          selectedVlan: undefined,
          vlanDetails: undefined,
          availableTags: undefined,
          vlanStats: undefined,
          pingResult: undefined,
          deletionPrompt: undefined,
          loadingVlans: false,
          loadingVlanDetails: false,
          loadingAvailableTags: false,
          loadingVlanStats: false,
          pingInProgress: false,
          configuringIP: false,
          loadingDeletionPrompt: false,
          creatingVlan: false,
          deletingVlan: false,
          error: '',
          vlanForm: {
            tag_id: 0,
            parent_nic: '',
            vlan_number: 0,
            static_ip: '',
            subnet_mask: '',
          },
          ipConfigForm: {
            use_dhcp: false,
            is_editable: true,
            static_ip: '',
            gateway: '',
            subnet_mask: '',
          },
        },
      };

    case ActionTypes.NOTIFICATION_WEBSOCKET_CONNECT:
      return { ...state, notificationWebSocketConnected: true };

    case ActionTypes.NOTIFICATION_WEBSOCKET_DISCONNECT:
      return { ...state, notificationWebSocketConnected: false };

    case ActionTypes.NOTIFICATION_MESSAGE_RECEIVED:
      return {
        ...state,
        notificationMessages: [...state.notificationMessages, action.payload],
        hasNotifications: true,
      };
    case ActionTypes.CLEAR_NOTIFICATION_MESSAGES:
      return {
        ...state,
        notificationMessages: [],
        hasNotifications: false,
      };
    case ActionTypes.SET_HAS_NOTIFICATIONS:
      return { ...state, hasNotifications: action.payload };

    // VXLAN Tunnel Cases
    case ActionTypes.FETCH_VXLAN_SUITORS_START:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isLoadingSuitors: true,
          suitorsError: null,
        },
      };
    case ActionTypes.FETCH_VXLAN_SUITORS_SUCCESS:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isLoadingSuitors: false,
          suitors: action.payload,
          suitorsError: null,
        },
      };
    case ActionTypes.FETCH_VXLAN_SUITORS_FAILURE:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isLoadingSuitors: false,
          suitorsError: action.payload,
        },
      };
    case ActionTypes.CREATE_VXLAN_TUNNEL_START:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isCreatingTunnel: true,
          createTunnelError: null,
          createTunnelSuccess: false,
        },
      };
    case ActionTypes.CREATE_VXLAN_TUNNEL_SUCCESS:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isCreatingTunnel: false,
          createTunnelError: null,
          createTunnelSuccess: true,
        },
      };
    case ActionTypes.CREATE_VXLAN_TUNNEL_FAILURE:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isCreatingTunnel: false,
          createTunnelError: action.payload,
          createTunnelSuccess: false,
        },
      };
    case ActionTypes.FETCH_VXLAN_TUNNELS_START:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isLoadingTunnels: true,
          fetchTunnelsError: null,
        },
      };
    case ActionTypes.FETCH_VXLAN_TUNNELS_SUCCESS:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isLoadingTunnels: false,
          tunnelsList: action.payload,
          fetchTunnelsError: null,
        },
      };
    case ActionTypes.FETCH_VXLAN_TUNNELS_FAILURE:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isLoadingTunnels: false,
          fetchTunnelsError: action.payload,
        },
      };
    case ActionTypes.UPDATE_VXLAN_TUNNEL_START:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isUpdatingTunnel: true,
          updateTunnelError: null,
          updateTunnelSuccess: false,
        },
      };
    case ActionTypes.UPDATE_VXLAN_TUNNEL_SUCCESS:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isUpdatingTunnel: false,
          updateTunnelError: null,
          updateTunnelSuccess: true,
        },
      };
    case ActionTypes.UPDATE_VXLAN_TUNNEL_FAILURE:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isUpdatingTunnel: false,
          updateTunnelError: action.payload,
          updateTunnelSuccess: false,
        },
      };
    case ActionTypes.DELETE_VXLAN_TUNNEL_START:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isDeletingTunnel: true,
          deleteTunnelError: null,
          deleteTunnelSuccess: false,
        },
      };
    case ActionTypes.DELETE_VXLAN_TUNNEL_SUCCESS:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isDeletingTunnel: false,
          deleteTunnelError: null,
          deleteTunnelSuccess: true,
        },
      };
    case ActionTypes.DELETE_VXLAN_TUNNEL_FAILURE:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          isDeletingTunnel: false,
          deleteTunnelError: action.payload,
          deleteTunnelSuccess: false,
        },
      };
    case ActionTypes.RESET_TUNNEL_STATE:
      return {
        ...state,
        vxlanTunnels: {
          ...state.vxlanTunnels,
          createTunnelSuccess: false,
          updateTunnelSuccess: false,
          deleteTunnelSuccess: false,
          createTunnelError: null,
          updateTunnelError: null,
          deleteTunnelError: null,
          suitorsError: null,
          fetchTunnelsError: null,
        },
      };

    case ActionTypes.SET_SELECTED_VM_DETAILS:
      return {
        ...state,
        selectedVmDetails: action.payload,
      };

    case ActionTypes.FETCH_FRR_ROUTES_START:
      return {
        ...state,
        frrRoutes: {
          ...state.frrRoutes,
          loading: true,
          error: '',
        },
      };
    case ActionTypes.FETCH_FRR_ROUTES_SUCCESS:
      return {
        ...state,
        frrRoutes: {
          routes: action.payload,
          loading: false,
          error: '',
        },
      };
    case ActionTypes.FETCH_FRR_ROUTES_FAILURE:
      return {
        ...state,
        frrRoutes: {
          ...state.frrRoutes,
          loading: false,
          error: action.payload,
        },
      };

    // OSPF Summary Management
    case ActionTypes.FETCH_OSPF_SUMMARY_START:
      return {
        ...state,
        ospfSummary: {
          ...state.ospfSummary,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_OSPF_SUMMARY_SUCCESS:
      return {
        ...state,
        ospfSummary: {
          data: action.payload,
          loading: false,
          error: null,
        },
      };
    case ActionTypes.FETCH_OSPF_SUMMARY_FAILURE:
      return {
        ...state,
        ospfSummary: {
          ...state.ospfSummary,
          loading: false,
          error: action.payload,
        },
      };

    // BGP Summary Management
    case ActionTypes.FETCH_BGP_SUMMARY_START:
      return {
        ...state,
        bgpSummary: {
          ...state.bgpSummary,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_BGP_SUMMARY_SUCCESS:
      return {
        ...state,
        bgpSummary: {
          data: action.payload,
          loading: false,
          error: null,
        },
      };
    case ActionTypes.FETCH_BGP_SUMMARY_FAILURE:
      return {
        ...state,
        bgpSummary: {
          ...state.bgpSummary,
          loading: false,
          error: action.payload,
        },
      };
    case ActionTypes.FETCH_NETWORK_INTERFACES_SUCCESS:
      return {
        ...state,
        networkInterfaces: {
          data: action.payload,
          loading: false,
          error: null,
        },
      };
    // Interface Operations
    case ActionTypes.TOGGLE_INTERFACE_START:
      return {
        ...state,
        interfaceOperations: {
          ...state.interfaceOperations,
          toggling: action.payload, // interface name
          toggleError: null,
        },
      };
    case ActionTypes.TOGGLE_INTERFACE_SUCCESS:
      return {
        ...state,
        interfaceOperations: {
          ...state.interfaceOperations,
          toggling: null,
          toggleError: null,
        },
      };
    case ActionTypes.TOGGLE_INTERFACE_FAILURE:
      return {
        ...state,
        interfaceOperations: {
          ...state.interfaceOperations,
          toggling: null,
          toggleError: action.payload,
        },
      };
    case ActionTypes.CREATE_INTERFACE_START:
      return {
        ...state,
        interfaceOperations: {
          ...state.interfaceOperations,
          creating: true,
          createError: null,
          createSuccess: false,
        },
      };
    case ActionTypes.CREATE_INTERFACE_SUCCESS:
      return {
        ...state,
        interfaceOperations: {
          ...state.interfaceOperations,
          creating: false,
          createError: null,
          createSuccess: true,
        },
      };
    case ActionTypes.CREATE_INTERFACE_FAILURE:
      return {
        ...state,
        interfaceOperations: {
          ...state.interfaceOperations,
          creating: false,
          createError: action.payload,
          createSuccess: false,
        },
      };

    // Delete Interface Operations
    case ActionTypes.DELETE_INTERFACE_START:
      return {
        ...state,
        interfaceOperations: {
          ...state.interfaceOperations,
          deleting: true,
          deleteError: null,
          deleteSuccess: false,
        },
      };
    case ActionTypes.DELETE_INTERFACE_SUCCESS:
      return {
        ...state,
        interfaceOperations: {
          ...state.interfaceOperations,
          deleting: false,
          deleteError: null,
          deleteSuccess: true,
        },
      };
    case ActionTypes.DELETE_INTERFACE_FAILURE:
      return {
        ...state,
        interfaceOperations: {
          ...state.interfaceOperations,
          deleting: false,
          deleteError: action.payload,
          deleteSuccess: false,
        },
      };

    // OSPF Area Operations
    case ActionTypes.ASSIGN_OSPF_AREA_START:
      return {
        ...state,
        ospfAreaOperations: {
          ...state.ospfAreaOperations,
          assigning: true,
          assignError: null,
          assignSuccess: false,
        },
      };
    case ActionTypes.ASSIGN_OSPF_AREA_SUCCESS:
      return {
        ...state,
        ospfAreaOperations: {
          ...state.ospfAreaOperations,
          assigning: false,
          assignError: null,
          assignSuccess: true,
        },
      };
    case ActionTypes.ASSIGN_OSPF_AREA_FAILURE:
      return {
        ...state,
        ospfAreaOperations: {
          ...state.ospfAreaOperations,
          assigning: false,
          assignError: action.payload,
          assignSuccess: false,
        },
      };
    case ActionTypes.DELETE_OSPF_AREA_START:
      return {
        ...state,
        ospfAreaOperations: {
          ...state.ospfAreaOperations,
          deleting: action.payload, // interface name
          deleteError: null,
          deleteSuccess: false,
        },
      };
    case ActionTypes.DELETE_OSPF_AREA_SUCCESS:
      return {
        ...state,
        ospfAreaOperations: {
          ...state.ospfAreaOperations,
          deleting: null,
          deleteError: null,
          deleteSuccess: true,
        },
      };
    case ActionTypes.DELETE_OSPF_AREA_FAILURE:
      return {
        ...state,
        ospfAreaOperations: {
          ...state.ospfAreaOperations,
          deleting: null,
          deleteError: action.payload,
          deleteSuccess: false,
        },
      };

    // BGP Operations
    case ActionTypes.CREATE_BGP_NEIGHBOR_START:
      return {
        ...state,
        bgpOperations: {
          ...state.bgpOperations,
          creating: true,
          createError: null,
          createSuccess: false,
        },
      };
    case ActionTypes.CREATE_BGP_NEIGHBOR_SUCCESS:
      return {
        ...state,
        bgpOperations: {
          ...state.bgpOperations,
          creating: false,
          createError: null,
          createSuccess: true,
        },
      };
    case ActionTypes.CREATE_BGP_NEIGHBOR_FAILURE:
      return {
        ...state,
        bgpOperations: {
          ...state.bgpOperations,
          creating: false,
          createError: action.payload,
          createSuccess: false,
        },
      };

    // FRR Configuration Operations
    case ActionTypes.FETCH_FRR_CONFIG_START:
      return {
        ...state,
        frrConfigOperations: {
          ...state.frrConfigOperations,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_FRR_CONFIG_SUCCESS:
      return {
        ...state,
        frrConfig: action.payload,
        frrConfigOperations: {
          ...state.frrConfigOperations,
          loading: false,
          error: null,
        },
      };
    case ActionTypes.FETCH_FRR_CONFIG_FAILURE:
      return {
        ...state,
        frrConfigOperations: {
          ...state.frrConfigOperations,
          loading: false,
          error: action.payload,
        },
      };
    case ActionTypes.UPDATE_FRR_CONFIG_START:
      return {
        ...state,
        frrConfigOperations: {
          ...state.frrConfigOperations,
          updating: true,
          updateError: null,
        },
      };
    case ActionTypes.UPDATE_FRR_CONFIG_SUCCESS:
      return {
        ...state,
        frrConfigOperations: {
          ...state.frrConfigOperations,
          updating: false,
          updateError: null,
        },
      };
    case ActionTypes.UPDATE_FRR_CONFIG_FAILURE:
      return {
        ...state,
        frrConfigOperations: {
          ...state.frrConfigOperations,
          updating: false,
          updateError: action.payload,
        },
      };

    // FRR Router Configuration
    case ActionTypes.CONFIGURE_FRR_ROUTER_START:
      return {
        ...state,
        routerConfigOperations: {
          ...state.routerConfigOperations,
          configuring: true,
          error: null,
        },
      };
    case ActionTypes.CONFIGURE_FRR_ROUTER_SUCCESS:
      return {
        ...state,
        routerConfigOperations: {
          ...state.routerConfigOperations,
          configuring: false,
          error: null,
          lastConfigured: action.payload,
        },
      };
    case ActionTypes.CONFIGURE_FRR_ROUTER_FAILURE:
      return {
        ...state,
        routerConfigOperations: {
          ...state.routerConfigOperations,
          configuring: false,
          error: action.payload,
        },
      };

    // Fetch Configured Nodes
    case ActionTypes.FETCH_CONFIGURED_NODES_START:
      return {
        ...state,
        configuredNodesOperations: {
          ...state.configuredNodesOperations,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_CONFIGURED_NODES_SUCCESS:
      return {
        ...state,
        availableNodes: action.payload,
        configuredNodesOperations: {
          ...state.configuredNodesOperations,
          loading: false,
          error: null,
        },
      };
    case ActionTypes.FETCH_CONFIGURED_NODES_FAILURE:
      return {
        ...state,
        configuredNodesOperations: {
          ...state.configuredNodesOperations,
          loading: false,
          error: action.payload,
        },
      };

    // SDN Interface Names Management
    case ActionTypes.FETCH_SDN_INTERFACE_NAMES_START:
      return {
        ...state,
        sdnInterfaceNames: {
          ...state.sdnInterfaceNames,
          loading: true,
          error: null,
        },
      };
    case ActionTypes.FETCH_SDN_INTERFACE_NAMES_SUCCESS:
      return {
        ...state,
        sdnInterfaceNames: {
          ...state.sdnInterfaceNames,
          data: action.payload,
          loading: false,
          error: null,
        },
      };
    case ActionTypes.FETCH_SDN_INTERFACE_NAMES_FAILURE:
      return {
        ...state,
        sdnInterfaceNames: {
          ...state.sdnInterfaceNames,
          loading: false,
          error: action.payload,
        },
      };

    // SDN Interface Stats WebSocket Management
    case ActionTypes.SDN_INTERFACE_STATS_WS_CONNECT:
      return {
        ...state,
        sdnInterfaceStats: {
          ...state.sdnInterfaceStats,
          selectedInterface: action.payload.interfaceName,
          wsConnected: true,
          wsError: null,
        },
      };
    case ActionTypes.SDN_INTERFACE_STATS_WS_DISCONNECT:
      return {
        ...state,
        sdnInterfaceStats: {
          ...state.sdnInterfaceStats,
          wsConnected: false,
          statsData: [],
          wsError: null,
        },
      };
    case ActionTypes.SDN_INTERFACE_STATS_WS_MESSAGE:
      return {
        ...state,
        sdnInterfaceStats: {
          ...state.sdnInterfaceStats,
          statsData: action.payload,
          lastUpdate: new Date().toISOString(),
          wsError: null,
        },
      };
    case ActionTypes.SDN_INTERFACE_STATS_WS_ERROR:
      return {
        ...state,
        sdnInterfaceStats: {
          ...state.sdnInterfaceStats,
          wsError: action.payload,
          wsConnected: false,
        },
      };
    case ActionTypes.SET_SELECTED_GRAPH_INTERFACE:
      return {
        ...state,
        sdnInterfaceStats: {
          ...state.sdnInterfaceStats,
          selectedInterface: action.payload,
          statsData: [],
        },
      };
    // Migration Actions
    case ActionTypes.FETCH_VM_LIST_START:
      return {
        ...state,
        migration: {
          ...state.migration,
          isLoading: true,
          error: null,
        },
      };

    case ActionTypes.FETCH_VM_LIST_SUCCESS:
      return {
        ...state,
        migration: {
          ...state.migration,
          vmList: action.payload,
          isLoading: false,
          error: null,
        },
      };

    case ActionTypes.FETCH_VM_LIST_FAILURE:
      return {
        ...state,
        migration: {
          ...state.migration,
          isLoading: false,
          error: action.payload,
          vmList: [],
          vmCount: 0,
        },
      };

    case ActionTypes.FETCH_VM_DETAILS_START:
      return {
        ...state,
        migration: {
          ...state.migration,
          isLoadingDetails: true,
          error: null,
        },
      };

    case ActionTypes.FETCH_VM_DETAILS_SUCCESS:
      return {
        ...state,
        migration: {
          ...state.migration,
          vmDetails: action.payload,
          isLoadingDetails: false,
          error: null,
        },
      };

    case ActionTypes.FETCH_VM_DETAILS_FAILURE:
      return {
        ...state,
        migration: {
          ...state.migration,
          isLoadingDetails: false,
          error: action.payload,
          vmDetails: null,
        },
      };

    case ActionTypes.SET_VM_COUNT:
      return {
        ...state,
        migration: {
          ...state.migration,
          vmCount: action.payload,
          totalCount: action.payload,
        },
      };

    case ActionTypes.SET_MIGRATION_MODAL:
      return {
        ...state,
        migration: {
          ...state.migration,
          showCredentialsModal: action.payload,
        },
      };

    case ActionTypes.SET_VM_LIST_MODAL:
      return {
        ...state,
        migration: {
          ...state.migration,
          showVmListModal: action.payload,
        },
      };

    case ActionTypes.SET_SELECTED_MIGRATION_VM:
      return {
        ...state,
        migration: {
          ...state.migration,
          selectedVm: action.payload,
        },
      };

    case ActionTypes.FETCH_EXTERNAL_NODES_START:
      return {
        ...state,
        migration: {
          ...state.migration,
          isLoadingNodes: true,
          nodesError: null,
        },
      };

    case ActionTypes.FETCH_EXTERNAL_NODES_SUCCESS:
      return {
        ...state,
        migration: {
          ...state.migration,
          externalNodes: action.payload,
          isLoadingNodes: false,
          nodesError: null,
        },
      };

    case ActionTypes.FETCH_EXTERNAL_NODES_FAILURE:
      return {
        ...state,
        migration: {
          ...state.migration,
          isLoadingNodes: false,
          nodesError: action.payload,
          externalNodes: [],
        },
      };

    case ActionTypes.RESTORE_MIGRATION_STATE:
      return {
        ...state,
        migration: {
          ...state.migration,
          externalNodes: action.payload.externalNodes || [],
          isLoadingNodes: false,
          nodesError: null,
        },
      };

    case ActionTypes.CLEAR_MIGRATION_STATE:
      return {
        ...state,
        migration: {
          ...state.migration,
          externalNodes: [],
          isLoadingNodes: false,
          nodesError: null,
          vmList: [],
          vmCount: 0,
          totalCount: 0,
          selectedVm: null,
          vmDetails: null,
        },
      };

    case ActionTypes.START_BULK_MIGRATION_REQUEST:
      return {
        ...state,
        migration: {
          ...state.migration,
          bulkMigration: {
            isLoading: true,
            error: null,
            success: false,
          },
        },
      };

    case ActionTypes.START_BULK_MIGRATION_SUCCESS:
      return {
        ...state,
        migration: {
          ...state.migration,
          bulkMigration: {
            isLoading: false,
            error: null,
            success: true,
          },
        },
      };

    case ActionTypes.START_BULK_MIGRATION_FAILURE:
      return {
        ...state,
        migration: {
          ...state.migration,
          bulkMigration: {
            isLoading: false,
            error: action.payload,
            success: false,
          },
        },
      };

    case ActionTypes.FETCH_MIGRATION_BATCHES_START:
      return {
        ...state,
        migration: {
          ...state.migration,
          batches: {
            ...state.migration?.batches,
            isLoading: true,
            error: null,
          },
        },
      };

    case ActionTypes.FETCH_MIGRATION_BATCHES_SUCCESS:
      return {
        ...state,
        migration: {
          ...state.migration,
          batches: {
            isLoading: false,
            error: null,
            data: action.payload,
          },
        },
      };

    case ActionTypes.FETCH_MIGRATION_BATCHES_FAILURE:
      return {
        ...state,
        migration: {
          ...state.migration,
          batches: {
            isLoading: false,
            error: action.payload,
            data: [],
          },
        },
      };

    // Approvals Management Cases
    case ActionTypes.FETCH_APPROVALS_START:
      return {
        ...state,
        approvals: {
          ...state.approvals,
          loading: true,
          error: null,
        },
      };

    case ActionTypes.FETCH_APPROVALS_SUCCESS:
      return {
        ...state,
        approvals: {
          ...state.approvals,
          loading: false,
          error: null,
          events: action.payload.events,
          pagination: {
            ...state.approvals.pagination,
            totalCount: action.payload.totalCount,
            totalPages: action.payload.totalPages,
            page: action.payload.page,
            limit: action.payload.limit,
          },
        },
      };

    case ActionTypes.FETCH_APPROVALS_FAILURE:
      return {
        ...state,
        approvals: {
          ...state.approvals,
          loading: false,
          error: action.payload,
          events: [],
          pagination: {
            ...state.approvals.pagination,
            totalCount: 0,
            totalPages: 1,
            page: 1,
          },
        },
      };

    case ActionTypes.SET_APPROVALS_PAGINATION:
      return {
        ...state,
        approvals: {
          ...state.approvals,
          pagination: {
            ...state.approvals.pagination,
            ...action.payload,
          },
        },
      };

    // Control Center actions
    case ActionTypes.CONTROL_CENTER_CONFIG_CHECK_START:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          configurationCheckLoading: true,
          configurationCheckError: null,
        },
      };

    case ActionTypes.CONTROL_CENTER_CONFIG_CHECK_SUCCESS:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          configurationCheckLoading: false,
          configurationCheckError: null,
        },
      };

    case ActionTypes.CONTROL_CENTER_CONFIG_CHECK_FAILURE:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          configurationCheckLoading: false,
          configurationCheckError: action.payload,
        },
      };

    case ActionTypes.CONTROL_CENTER_CONFIGURE_NODE_START:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          configuringNodes: new Set([...state.controlCenter.configuringNodes, action.payload]),
          configuringNodesErrors: new Map(
            [...state.controlCenter.configuringNodesErrors].filter(
              ([key]) => key !== action.payload
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_CONFIGURE_NODE_SUCCESS:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          configuringNodes: new Set(
            [...state.controlCenter.configuringNodes].filter(
              (nodeIp) => nodeIp !== action.payload.nodeIp
            )
          ),
          configuringNodesErrors: new Map(
            [...state.controlCenter.configuringNodesErrors].filter(
              ([key]) => key !== action.payload.nodeIp
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_CONFIGURE_NODE_FAILURE:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          configuringNodes: new Set(
            [...state.controlCenter.configuringNodes].filter(
              (nodeIp) => nodeIp !== action.payload.nodeIp
            )
          ),
          configuringNodesErrors: new Map(
            state.controlCenter.configuringNodesErrors.set(
              action.payload.nodeIp,
              action.payload.error
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_OVERRIDE_BMC_START:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          overridingBmcNodes: new Set([...state.controlCenter.overridingBmcNodes, action.payload]),
          overridingBmcErrors: new Map(
            [...state.controlCenter.overridingBmcErrors].filter(([key]) => key !== action.payload)
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_OVERRIDE_BMC_SUCCESS:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          overridingBmcNodes: new Set(
            [...state.controlCenter.overridingBmcNodes].filter((bmcIp) => bmcIp !== action.payload)
          ),
          overridingBmcErrors: new Map(
            [...state.controlCenter.overridingBmcErrors].filter(([key]) => key !== action.payload)
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_OVERRIDE_BMC_FAILURE:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          overridingBmcNodes: new Set(
            [...state.controlCenter.overridingBmcNodes].filter(
              (bmcIp) => bmcIp !== action.payload.bmcIp
            )
          ),
          overridingBmcErrors: new Map(
            state.controlCenter.overridingBmcErrors.set(action.payload.bmcIp, action.payload.error)
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_SCAN_START:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          scanLoading: true,
          scanError: null,
        },
      };

    case ActionTypes.CONTROL_CENTER_SCAN_SUCCESS:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          scanLoading: false,
          scanError: action.payload.message,
          scannedNodes: action.payload.nodes,
        },
      };

    case ActionTypes.CONTROL_CENTER_SCAN_FAILURE:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          scanLoading: false,
          scanError: action.payload,
          scannedNodes: [],
        },
      };

    case ActionTypes.CONTROL_CENTER_ADD_TO_INVENTORY_START:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          addingToInventoryNodes: new Set([
            ...state.controlCenter.addingToInventoryNodes,
            action.payload,
          ]),
          addingToInventoryErrors: new Map(
            [...state.controlCenter.addingToInventoryErrors].filter(
              ([key]) => key !== action.payload
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_ADD_TO_INVENTORY_SUCCESS:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          addingToInventoryNodes: new Set(
            [...state.controlCenter.addingToInventoryNodes].filter(
              (nodeIp) => nodeIp !== action.payload
            )
          ),
          addingToInventoryErrors: new Map(
            [...state.controlCenter.addingToInventoryErrors].filter(
              ([key]) => key !== action.payload
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_ADD_TO_INVENTORY_FAILURE:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          addingToInventoryNodes: new Set(
            [...state.controlCenter.addingToInventoryNodes].filter(
              (nodeIp) => nodeIp !== action.payload.nodeIp
            )
          ),
          addingToInventoryErrors: new Map(
            state.controlCenter.addingToInventoryErrors.set(
              action.payload.nodeIp,
              action.payload.error
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_DELETE_FROM_INVENTORY_START:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          deletingFromInventoryNodes: new Set([
            ...state.controlCenter.deletingFromInventoryNodes,
            action.payload,
          ]),
          deletingFromInventoryErrors: new Map(
            [...state.controlCenter.deletingFromInventoryErrors].filter(
              ([key]) => key !== action.payload
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_DELETE_FROM_INVENTORY_SUCCESS:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          deletingFromInventoryNodes: new Set(
            [...state.controlCenter.deletingFromInventoryNodes].filter(
              (bmcIp) => bmcIp !== action.payload
            )
          ),
          deletingFromInventoryErrors: new Map(
            [...state.controlCenter.deletingFromInventoryErrors].filter(
              ([key]) => key !== action.payload
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_DELETE_FROM_INVENTORY_FAILURE:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          deletingFromInventoryNodes: new Set(
            [...state.controlCenter.deletingFromInventoryNodes].filter(
              (bmcIp) => bmcIp !== action.payload.bmcIp
            )
          ),
          deletingFromInventoryErrors: new Map(
            state.controlCenter.deletingFromInventoryErrors.set(
              action.payload.bmcIp,
              action.payload.error
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_SET_BMC_CREDS_START:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          settingBmcCredsNodes: new Set([
            ...state.controlCenter.settingBmcCredsNodes,
            action.payload,
          ]),
          settingBmcCredsErrors: new Map(
            [...state.controlCenter.settingBmcCredsErrors].filter(([key]) => key !== action.payload)
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_SET_BMC_CREDS_SUCCESS:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          settingBmcCredsNodes: new Set(
            [...state.controlCenter.settingBmcCredsNodes].filter((ip) => ip !== action.payload.ip)
          ),
          settingBmcCredsErrors: new Map(
            [...state.controlCenter.settingBmcCredsErrors].filter(
              ([key]) => key !== action.payload.ip
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_SET_BMC_CREDS_FAILURE:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          settingBmcCredsNodes: new Set(
            [...state.controlCenter.settingBmcCredsNodes].filter((ip) => ip !== action.payload.ip)
          ),
          settingBmcCredsErrors: new Map(
            state.controlCenter.settingBmcCredsErrors.set(action.payload.ip, action.payload.error)
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_PIKVM_REVEAL_START:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          pikvmRevealingNodes: new Set([
            ...state.controlCenter.pikvmRevealingNodes,
            action.payload,
          ]),
          pikvmRevealingErrors: new Map(
            [...state.controlCenter.pikvmRevealingErrors].filter(([key]) => key !== action.payload)
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_PIKVM_REVEAL_SUCCESS:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          pikvmRevealingNodes: new Set(
            [...state.controlCenter.pikvmRevealingNodes].filter(
              (pikvmIP) => pikvmIP !== action.payload.pikvmIP
            )
          ),
          pikvmRevealingErrors: new Map(
            [...state.controlCenter.pikvmRevealingErrors].filter(
              ([key]) => key !== action.payload.pikvmIP
            )
          ),
        },
      };

    case ActionTypes.CONTROL_CENTER_PIKVM_REVEAL_FAILURE:
      return {
        ...state,
        controlCenter: {
          ...state.controlCenter,
          pikvmRevealingNodes: new Set(
            [...state.controlCenter.pikvmRevealingNodes].filter(
              (pikvmIP) => pikvmIP !== action.payload.pikvmIP
            )
          ),
          pikvmRevealingErrors: new Map(
            state.controlCenter.pikvmRevealingErrors.set(
              action.payload.pikvmIP,
              action.payload.error
            )
          ),
        },
      };

    // Node Stats History cases
    case ActionTypes.FETCH_NODE_STATS_HISTORY_START:
      return {
        ...state,
        isLoadingNodeStatsHistory: true,
        nodeStatsHistoryError: null,
      };

    case ActionTypes.FETCH_NODE_STATS_HISTORY_SUCCESS:
      return {
        ...state,
        isLoadingNodeStatsHistory: false,
        nodeStatsHistory: action.payload,
        nodeStatsHistoryError: null,
      };

    case ActionTypes.FETCH_NODE_STATS_HISTORY_FAILURE:
      return {
        ...state,
        isLoadingNodeStatsHistory: false,
        nodeStatsHistoryError: action.payload,
      };

    // Node Stats Recommendations cases
    case ActionTypes.FETCH_NODE_STATS_RECOMMENDATIONS_START:
      return {
        ...state,
        isLoadingNodeStatsRecommendations: true,
        nodeStatsRecommendationsError: null,
      };

    case ActionTypes.FETCH_NODE_STATS_RECOMMENDATIONS_SUCCESS:
      return {
        ...state,
        isLoadingNodeStatsRecommendations: false,
        nodeStatsRecommendations: action.payload,
        nodeStatsRecommendationsError: null,
      };

    case ActionTypes.FETCH_NODE_STATS_RECOMMENDATIONS_FAILURE:
      return {
        ...state,
        isLoadingNodeStatsRecommendations: false,
        nodeStatsRecommendationsError: action.payload,
      };

    // Historical VM Stats cases
    case ActionTypes.FETCH_HISTORICAL_VM_STATS_START:
      return {
        ...state,
        isLoadingHistoricalVmStats: true,
        historicalVmStatsError: null,
      };

    case ActionTypes.FETCH_HISTORICAL_VM_STATS_SUCCESS:
      return {
        ...state,
        isLoadingHistoricalVmStats: false,
        historicalVmStats: {
          ...state.historicalVmStats,
          [action.payload.nodeIp]: action.payload.vmStats,
        },
        historicalVmStatsError: null,
      };

    case ActionTypes.FETCH_HISTORICAL_VM_STATS_FAILURE:
      return {
        ...state,
        isLoadingHistoricalVmStats: false,
        historicalVmStatsError: action.payload,
      };

    // VM Recommendations cases
    case ActionTypes.FETCH_VM_RECOMMENDATIONS_START:
      return {
        ...state,
        isLoadingVmRecommendations: true,
        vmRecommendationsError: null,
      };

    case ActionTypes.FETCH_VM_RECOMMENDATIONS_SUCCESS:
      return {
        ...state,
        isLoadingVmRecommendations: false,
        vmRecommendations: action.payload,
        vmRecommendationsError: null,
      };

    case ActionTypes.FETCH_VM_RECOMMENDATIONS_FAILURE:
      return {
        ...state,
        isLoadingVmRecommendations: false,
        vmRecommendationsError: action.payload,
      };

    case ActionTypes.FETCH_INSTALL_NODES_FAILURE:
      return {
        ...state,
        installUpdates: {
          ...state.installUpdates,
          loading: false,
          error: action.payload.error,
        },
      };


    case ActionTypes.RESET_INSTALL_UPDATES_STATE:
      return {
        ...state,
        installUpdates: {
          appliedNodes: [],
          pendingNodes: [],
          scheduledNodes: [],
          loading: false,
          installing: false,
          error: null,
          installResult: null,
        },
      };

    // Server API Cases for LandingPage
    case ActionTypes.FETCH_SERVER_INVENTORY_START:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            inventory: true,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_INVENTORY_SUCCESS:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          inventoryData: action.payload,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            inventory: false,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            inventory: null,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_INVENTORY_FAILURE:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            inventory: false,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            inventory: action.payload,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_SYSTEM_INFO_START:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            systemInfo: true,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            systemInfo: null,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_SYSTEM_INFO_SUCCESS:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          systemInfo: action.payload,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            systemInfo: false,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            systemInfo: null,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_SYSTEM_INFO_FAILURE:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            systemInfo: false,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            systemInfo: action.payload,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_ADDIN_CARDS_START:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            addinCards: true,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            addinCards: null,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_ADDIN_CARDS_SUCCESS:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          addinCards: action.payload,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            addinCards: false,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            addinCards: null,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_ADDIN_CARDS_FAILURE:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            addinCards: false,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            addinCards: action.payload,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_STORAGE_CARDS_START:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            storageCards: true,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            storageCards: null,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_STORAGE_CARDS_SUCCESS:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          storageCards: action.payload,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            storageCards: false,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            storageCards: null,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_STORAGE_CARDS_FAILURE:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            storageCards: false,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            storageCards: action.payload,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_POWER_SUPPLY_START:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            powerSupply: true,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            powerSupply: null,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_POWER_SUPPLY_SUCCESS:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          powerSupplyRatings: action.payload,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            powerSupply: false,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            powerSupply: null,
          },
        },
      };

    case ActionTypes.FETCH_SERVER_POWER_SUPPLY_FAILURE:
      return {
        ...state,
        serverData: {
          ...getDefaultServerDataState(),
          ...state.serverData,
          loading: {
            ...getDefaultServerDataState().loading,
            ...(state.serverData?.loading || {}),
            powerSupply: false,
          },
          errors: {
            ...getDefaultServerDataState().errors,
            ...(state.serverData?.errors || {}),
            powerSupply: action.payload,
          },
        },
      };

    // Netbox Actions
    case ActionTypes.FETCH_NETBOX_RACKS_START:
      return {
        ...state,
        netbox: {
          ...state.netbox,
          loading: true,
          error: null,
        },
      };

    case ActionTypes.FETCH_NETBOX_RACKS_SUCCESS:
      return {
        ...state,
        netbox: {
          ...state.netbox,
          loading: false,
          error: null,
          racks: action.payload,
        },
      };

    case ActionTypes.FETCH_NETBOX_RACKS_FAILURE:
      return {
        ...state,
        netbox: {
          ...state.netbox,
          loading: false,
          error: action.payload,
          racks: [],
        },
      };

    case ActionTypes.CONFIGURE_NETBOX_START:
      return {
        ...state,
        netbox: {
          ...state.netbox,
          configuring: true,
          configResponse: null,
        },
      };

    case ActionTypes.CONFIGURE_NETBOX_SUCCESS:
      return {
        ...state,
        netbox: {
          ...state.netbox,
          configuring: false,
          configResponse: action.payload,
        },
      };

    case ActionTypes.CONFIGURE_NETBOX_FAILURE:
      return {
        ...state,
        netbox: {
          ...state.netbox,
          configuring: false,
          configResponse: action.payload,
        },
      };

    case ActionTypes.NETBOX_DEVICE_ONBOARDING_MODAL_OPEN:
      return {
        ...state,
        netbox: {
          ...state.netbox,
          showDeviceOnboardingModal: true,
        },
      };

    case ActionTypes.NETBOX_DEVICE_ONBOARDING_MODAL_CLOSE:
      return {
        ...state,
        netbox: {
          ...state.netbox,
          showDeviceOnboardingModal: false,
        },
      };

    // Power Utility Actions
    case ActionTypes.SET_COUNTRIES_LOADING:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          countries: {
            ...state.powerUtility.countries,
            loading: action.payload,
          },
        },
      };

    case ActionTypes.SET_COUNTRIES_SUCCESS:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          countries: {
            ...state.powerUtility.countries,
            list: action.payload,
            loading: false,
            error: '',
          },
        },
      };

    case ActionTypes.SET_COUNTRIES_ERROR:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          countries: {
            ...state.powerUtility.countries,
            loading: false,
            error: action.payload,
          },
        },
      };

    case ActionTypes.SET_STATES_LOADING:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          states: {
            ...state.powerUtility.states,
            loading: action.payload,
          },
        },
      };

    case ActionTypes.SET_STATES_SUCCESS:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          states: {
            ...state.powerUtility.states,
            list: action.payload,
            loading: false,
            error: '',
          },
        },
      };

    case ActionTypes.SET_STATES_ERROR:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          states: {
            ...state.powerUtility.states,
            loading: false,
            error: action.payload,
          },
        },
      };

    case ActionTypes.SET_ELECTRICITY_RATE_LOADING:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          electricityRate: {
            ...state.powerUtility.electricityRate,
            loading: action.payload,
            setting: action.payload,
          },
        },
      };

    case ActionTypes.SET_ELECTRICITY_RATE_SUCCESS:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          electricityRate: {
            ...state.powerUtility.electricityRate,
            loading: false,
            setting: false,
            response: action.payload,
            error: '',
          },
        },
      };

    case ActionTypes.SET_ELECTRICITY_RATE_ERROR:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          electricityRate: {
            ...state.powerUtility.electricityRate,
            loading: false,
            setting: false,
            error: action.payload,
          },
        },
      };

    case ActionTypes.SET_ELECTRICITY_RATE_CURRENT:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          electricityRate: {
            ...state.powerUtility.electricityRate,
            current: action.payload,
          },
        },
      };

    case ActionTypes.CLEAR_POWER_UTILITY_STATE:
      return {
        ...state,
        powerUtility: {
          countries: {
            list: [],
            loading: false,
            error: '',
          },
          states: {
            list: [],
            loading: false,
            error: '',
          },
          electricityRate: {
            current: null,
            loading: false,
            setting: false,
            error: '',
            response: null,
          },
          costReports: {
            data: null,
            loading: false,
            error: '',
          },
          costForecast: {
            data: [],
            loading: false,
            error: '',
          },
        },
      };

    // Power Cost Reports Actions
    case ActionTypes.FETCH_POWER_COST_REPORTS_LOADING:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          costReports: {
            ...state.powerUtility.costReports,
            loading: action.payload,
            error: '',
          },
        },
      };

    case ActionTypes.FETCH_POWER_COST_REPORTS_SUCCESS:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          costReports: {
            ...state.powerUtility.costReports,
            data: action.payload,
            loading: false,
            error: '',
          },
        },
      };

    case ActionTypes.FETCH_POWER_COST_REPORTS_ERROR:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          costReports: {
            ...state.powerUtility.costReports,
            loading: false,
            error: action.payload,
          },
        },
      };

    // Power Cost Forecast Actions
    case ActionTypes.FETCH_POWER_COST_FORECAST_LOADING:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          costForecast: {
            ...state.powerUtility.costForecast,
            loading: action.payload,
            error: '',
          },
        },
      };

    case ActionTypes.FETCH_POWER_COST_FORECAST_SUCCESS:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          costForecast: {
            ...state.powerUtility.costForecast,
            data: action.payload,
            loading: false,
            error: '',
          },
        },
      };

    case ActionTypes.FETCH_POWER_COST_FORECAST_ERROR:
      return {
        ...state,
        powerUtility: {
          ...state.powerUtility,
          costForecast: {
            ...state.powerUtility.costForecast,
            loading: false,
            error: action.payload,
          },
        },
      };

    // Google Anthos K8S Actions
    case ActionTypes.SET_ANTHOS_FORM_FIELD:
      // Handle both form fields and formErrors
      if (action.payload.field === 'formErrors') {
        return {
          ...state,
          anthos: {
            ...state.anthos,
            formErrors: action.payload.value,
          },
        };
      }
      return {
        ...state,
        anthos: {
          ...state.anthos,
          form: {
            ...state.anthos.form,
            [action.payload.field]: action.payload.value,
          },
        },
      };

    case ActionTypes.UPDATE_ANTHOS_FORM:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          form: action.payload,
        },
      };

    case ActionTypes.RESET_ANTHOS_FORM:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          form: {
            email: '',
            clusterName: '',
            projectId: '',
            serviceKeyFile: null,
          },
          formErrors: {},
          uploadError: null,
          uploadSuccess: false,
        },
      };

    case ActionTypes.ANTHOS_UPLOAD_START:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          uploading: true,
          uploadError: null,
          uploadSuccess: false,
        },
      };

    case ActionTypes.ANTHOS_UPLOAD_SUCCESS:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          uploading: false,
          uploadSuccess: true,
          uploadError: null,
          config: action.payload,
          // Store email from service key upload into admin_email cache for use throughout provisioning
          admin_email: action.payload?.client_email || state.anthos.admin_email || null,
        },
      };

    case ActionTypes.ANTHOS_UPLOAD_FAILURE:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          uploading: false,
          uploadError: action.payload,
          uploadSuccess: false,
        },
      };

    case ActionTypes.SET_ANTHOS_CONFIG:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          config: action.payload,
        },
      };

    case ActionTypes.CLEAR_ANTHOS_STATE:
      return {
        ...state,
        anthos: {
          form: {
            email: '',
            clusterName: '',
            projectId: '',
            serviceKeyFile: null,
          },
          formErrors: {},
          uploading: false,
          uploadError: null,
          uploadSuccess: false,
          config: null,
          admin_email: null,
          credentialsCheck: {
            loading: false,
            error: null,
            data: null,
          },
          clusterSelection: {
            clusterTypes: [],
            selectedClusterType: '',
            selectedClusterProfile: '',
            clusterSpecs: null,
            loadingClusterTypes: false,
            loadingClusterSpecs: false,
            clusterTypesError: null,
            clusterSpecsError: null,
          },
        },
      };

    // Anthos Cluster Selection Actions
    case ActionTypes.FETCH_ANTHOS_CLUSTER_TYPES_START:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          clusterSelection: {
            ...state.anthos.clusterSelection,
            loadingClusterTypes: true,
            clusterTypesError: null,
          },
        },
      };

    case ActionTypes.FETCH_ANTHOS_CLUSTER_TYPES_SUCCESS:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          clusterSelection: {
            ...state.anthos.clusterSelection,
            loadingClusterTypes: false,
            clusterTypes: action.payload,
          },
        },
      };

    case ActionTypes.FETCH_ANTHOS_CLUSTER_TYPES_FAILURE:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          clusterSelection: {
            ...state.anthos.clusterSelection,
            loadingClusterTypes: false,
            clusterTypesError: action.payload,
          },
        },
      };

    case ActionTypes.FETCH_ANTHOS_CLUSTER_SPECS_START:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          clusterSelection: {
            ...state.anthos.clusterSelection,
            loadingClusterSpecs: true,
            clusterSpecsError: null,
          },
        },
      };

    case ActionTypes.FETCH_ANTHOS_CLUSTER_SPECS_SUCCESS:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          clusterSelection: {
            ...state.anthos.clusterSelection,
            loadingClusterSpecs: false,
            clusterSpecs: action.payload,
          },
        },
      };

    case ActionTypes.FETCH_ANTHOS_CLUSTER_SPECS_FAILURE:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          clusterSelection: {
            ...state.anthos.clusterSelection,
            loadingClusterSpecs: false,
            clusterSpecsError: action.payload,
          },
        },
      };

    case ActionTypes.SET_ANTHOS_SELECTED_CLUSTER_TYPE:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          clusterSelection: {
            ...state.anthos.clusterSelection,
            selectedClusterType: action.payload,
            selectedClusterProfile: '', // Reset profile when type changes
            clusterSpecs: null,
          },
        },
      };

    case ActionTypes.SET_ANTHOS_SELECTED_CLUSTER_PROFILE:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          clusterSelection: {
            ...state.anthos.clusterSelection,
            selectedClusterProfile: action.payload,
          },
        },
      };

    // Anthos Credentials Check Actions
    case ActionTypes.CHECK_ANTHOS_CREDENTIALS_START:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          credentialsCheck: {
            ...state.anthos.credentialsCheck,
            loading: true,
            error: null,
          },
        },
      };

    case ActionTypes.CHECK_ANTHOS_CREDENTIALS_SUCCESS:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          credentialsCheck: {
            loading: false,
            error: null,
            data: action.payload,
          },
          // Store email from credentials-check into admin_email cache for use throughout provisioning
          admin_email: action.payload?.client_email || state.anthos.admin_email || null,
          // If credentials exist on the control plane, populate minimal config so
          // the provisioning/selection page can render without requiring an upload.
          config: {
            ...(state.anthos.config || {}),
            project_id:
              action.payload?.project_id ||
              (state.anthos.config && state.anthos.config.project_id) ||
              '',
            // leave client_email blank - provisioning can proceed using server-side credentials
            client_email: state.anthos.config?.client_email || '',
            cluster_name: state.anthos.config?.cluster_name || '',
            message: action.payload?.message || state.anthos.config?.message || '',
          },
        },
      };

    case ActionTypes.CHECK_ANTHOS_CREDENTIALS_FAILURE:
      return {
        ...state,
        anthos: {
          ...state.anthos,
          credentialsCheck: {
            ...state.anthos.credentialsCheck,
            loading: false,
            error: action.payload,
          },
        },
      };

    default:
      return state;
  }
};

export default appReducer;

// Export types for use in other parts of the application
export type { AppAction, InventoryItem, ConfiguredNode, VmData, FirewallNotification };
