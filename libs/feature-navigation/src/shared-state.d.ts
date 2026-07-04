// Type declarations for @karios-monorepo/shared-state
declare module '@karios-monorepo/shared-state' {
  export enum ActionTypes {
    SET_DATACENTERS,
    SET_SELECTED_SERVER,
    SET_SELECTED_VM,
    SET_SERVER_VMS,
    SET_NODE_STATUSES,
    ADD_SERVER_CONSOLE,
    REMOVE_SERVER_CONSOLE,
    SET_SELECTED_DATACENTER,
    TOGGLE_DATACENTER_VISIBILITY,
  }

  export interface AppState {
    dataCenters: any[];
    selectedServer: any;
    selectedVm: any;
    nodeStatuses: any[];
    selectedDataCenter: any;
    currentServerView: string;
    currentDataCenterView: string;
    [key: string]: any;
    globalVmList: {
      vms: any[];
      loading: boolean;
      error: string | null;
      lastFetched: number | null;
    };
  }

  export interface Permissions {
    [key: string]: boolean; // Dynamic keys instead of hardcoded ones
  }

  export function useAppState(): {
    state: AppState;
    dispatch: React.Dispatch<any>;
    dataCenters: any[];
    fetchVMs: () => Promise<void>;
    fetchVMsForServer: (server: any) => Promise<void>;
    performVmAction: (
      serverIp: string,
      vmName: string,
      action: string,
      payload?: any,
      approver?: string
    ) => Promise<any>;
    performVmActionWebSocket: (
      serverIp: string,
      vmName: string,
      action: string,
      statusCallback: (status: { is_final: boolean; error?: any; status: string }) => void
    ) => Promise<any>;
    renameVmInContext: (
      serverIp: string,
      vmName: string,
      datastore: string,
      newName: string,
      approver: string
    ) => Promise<any>;
    cloneVmInContext: (
      serverIp: string,
      vmName: string,
      datastore: string,
      newName: string,
      approver?: string
    ) => Promise<any>;
    checkNodeStatuses: () => Promise<void>;
    openDataCenters: { [key: string]: boolean };
    setServerView: (view: string) => void;
    setDataCenterView: (view: string) => void;
    metrics: any;
    fetchMetricsUid: (serverIp: string) => Promise<void>;
    setMetricsViewingPanel: (panel: Number | null) => void;
    vmTransitions: { [key: string]: boolean };
    setVmTransition: (vmName: string, isTransitioning: boolean) => void;
    isVmInTransition: (vmName: string) => boolean;
    fetchGlobalVmList: () => Promise<any>; // Add this line
  };

  export function usePermissions(): {
    userName: string;
    handleLogout: () => void;
    permissions: Permissions;
    seedUser: boolean;
    // Enhanced helper functions that work with dynamic permissions
    hasPermission: (permissionName: string) => boolean;
    getPermissionNames: () => string[];
  };

  interface FetchInventoryOptions {
    offset?: number;
    limit?: number;
    bmc_ip?: string;
    os_ip?: string;
    vendor?: string;
    status?: string;
  }

  interface FetchInventoryResult {
    inventory: any[];
    totalCount: number;
  }

  export function useDataCenter(): {
    selectedNode: any;
    configuredNodes: any[];
    setConfiguredNodes: React.Dispatch<React.SetStateAction<any[]>>;
    inventory: any[];
    setInventory: React.Dispatch<React.SetStateAction<any[]>>;
    loading: boolean;
    error: string | null;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    scannedData: string;
    subnet: string;
    handleScan: (subnet: string) => Promise<void>;
    handleProvision: (
      ip: string,
      jobCallback?: (jobId: string, jobType: string) => void
    ) => Promise<void>;
    fetchInventory: (options?: FetchInventoryOptions) => Promise<FetchInventoryResult>;
  };

  export function useVm(): {
    selectedVm: any;
    dataCenters: any[];
    setSelectedVm: (vm: any) => void;
  };

  export class SimpleWebSocketProvider {
    constructor(url: string);
  }

  export function useServer(): {
    selectedServer: any;
    setSelectedServer: (server: any) => void;
    servers: any[];
    fetchServers: () => Promise<void>;
    serverConsoles: any[];
    addServerConsole: (console: any) => void;
    removeServerConsole: (consoleId: string) => void;
  };

  export function useFirewall(): {
    firewall: any;
    fetchFirewallRules: (serverIp: string) => Promise<any>;
    updateFirewallRules: (serverIp: string, rules: string) => Promise<any>;
    cancelFirewallRevert: (serverIp: string, id: string) => Promise<any>;
    setFirewallNotification: (notification: any) => void;
    setFirewallRevertCountdown: (countdown: number | null) => void;
    setFirewallId: (id: string) => void;
  };
}
