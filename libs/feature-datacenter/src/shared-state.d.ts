// Declaration file for @karios-monorepo/shared-state
declare module '@karios-monorepo/shared-state' {
  interface ConfiguredNode {
    ip: string;
    nodeIP: string;
    nodeHostname: string;
    username: string;
    password: string;
  }

  interface InventoryItem {
    ip: string;
    vendor: string;
    stage: string;
    username?: string;
    password?: string;
    lastUpdated?: string;
    nodeIP?: string;
    nodeHostname?: string;
    os_ip?: string;
    os_username?: string;
    os_password?: string;
    os_hostname?: string;
  }

  interface FetchInventoryOptions {
    offset?: number;
    limit?: number;
    os_ip?: string;
    vendor?: string;
    status?: string;
  }

  interface FetchInventoryResult {
    filter(arg0: (node: any) => boolean): unknown;
    data: any;
    data(arg0: string, data: any): unknown;
    inventory: InventoryItem[];
    totalCount: number;
  }

  export function useDataCenter(): {
    selectedNode: any;
    configuredNodes: ConfiguredNode[];
    setConfiguredNodes: React.Dispatch<React.SetStateAction<ConfiguredNode[]>>;
    inventory: InventoryItem[];
    setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
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
    getVncConsoleUrl: () => string;
    vncConsoleUrl: string;
    vncConsoleOptions: Record<string, string>;
  };

  interface Server {
    id: string;
    name: string;
    ip: string;
    hostname: string;
    status: string;
  }

  export function useServer(): {
    selectedServer: Server | null;
  };

  // VLAN Management interfaces
  interface VLANData {
    name: string;
    admin_up: boolean;
    status: string;
    tag_id: number;
    parent_nic: string;
    mac_address: string;
    ipv4: string[];
    ipv6: string[];
    mtu: number;
    media: string;
    vxlan_tunnels: any[];
    virtual_switches_connected: number;
    bridge_members: any;
    routing_table: any[] | null;
    spanning_tree_info: any;
    is_editable: boolean;
    is_force_delete_enabled: boolean;
  }

  interface CreateVLANData {
    tag_id: number;
    parent_nic: string;
    vlan_number: number;
    static_ip: string;
    subnet_mask: string;
  }

  interface VLANResponse {
    message: string;
    vlan_info?: {
      name: string;
      parent_nic: string;
      status: string;
      ip_address: string;
    };
  }

  interface VLANAvailableTagsResponse {
    available_tags: number[];
    currently_used: number[];
    max_vlans_allowed: number;
    message: string;
    state: string;
  }

  interface VLANState {
    vlans: VLANData[];
    selectedVlan: VLANData | null;
    vlanDetails: VLANData | null;
    availableTags: VLANAvailableTagsResponse | null;
    vlanStats: any;
    pingResult: any;
    deletionPrompt: any;
    loadingVlans: boolean;
    loadingVlanDetails: boolean;
    loadingAvailableTags: boolean;
    loadingVlanStats: boolean;
    pingInProgress: boolean;
    configuringIP: boolean;
    loadingDeletionPrompt: boolean;
    creatingVlan: boolean;
    deletingVlan: boolean;
    error: string | null;
    vlanForm: CreateVLANData;
    ipConfigForm: {
      use_dhcp: boolean;
      is_editable: boolean;
      static_ip: string;
      gateway: string;
      subnet_mask: string;
    };
  }

  export function useAppState(): {
    // VLAN Management
    vlans: VLANState;
    fetchVLANs: () => Promise<VLANData[]>;
    fetchVLANDetails: (vlanName: string) => Promise<VLANData>;
    createVLAN: (vlanData: CreateVLANData) => Promise<VLANResponse>;
    deleteVLAN: (vlanName: string) => Promise<void>;
    resetVLANState: () => void;
    setVLANForm: (formData: Partial<CreateVLANData>) => void;
    clearVLANForm: () => void;

    // Add other state properties as needed
    [key: string]: any;
  };
  export function useApprovalFlow() {}
  export function ApprovalModal() {}
  export function Pagination(props: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    showInfo?: boolean;
    totalCount?: number;
    pageSize?: number;
    pageInput?: string;
    onPageInputChange?: (value: string) => void;
    onPageInputSubmit?: () => void;
    onPageInputKeyPress?: (e: React.KeyboardEvent) => void;
    showPageInput?: boolean;
    className?: string;
    itemsPerPage?: number;
  }): JSX.Element;

  // ActionTypes enum export
  export enum ActionTypes {
    FETCH_DATA_START = 'FETCH_DATA_START',
    VM_ACTION_START = 'VM_ACTION_START',
    FETCH_INVENTORY_START = 'FETCH_INVENTORY_START',
    FETCH_INVENTORY_SUCCESS = 'FETCH_INVENTORY_SUCCESS',
    FETCH_INVENTORY_FAILURE = 'FETCH_INVENTORY_FAILURE',
    SET_DATACENTER_ERROR = 'SET_DATACENTER_ERROR',
    SCAN_SUBNET_START = 'SCAN_SUBNET_START',
    SCAN_SUBNET_SUCCESS = 'SCAN_SUBNET_SUCCESS',
    SCAN_SUBNET_FAILURE = 'SCAN_SUBNET_FAILURE',
    UPDATE_NODE_STATUS = 'UPDATE_NODE_STATUS',
    UPDATE_NODE = 'UPDATE_NODE',
    FETCH_DATACENTERS_SUCCESS = 'FETCH_DATACENTERS_SUCCESS',
    FETCH_VMS_FOR_SERVER_SUCCESS = 'FETCH_VMS_FOR_SERVER_SUCCESS',
    UPDATE_VM_DETAILS_SUCCESS = 'UPDATE_VM_DETAILS_SUCCESS',
    VM_ACTION_SUCCESS = 'VM_ACTION_SUCCESS',
    FETCH_DATA_FAILURE = 'FETCH_DATA_FAILURE',
    VM_ACTION_FAILURE = 'VM_ACTION_FAILURE',
    SET_SELECTED_DATACENTER = 'SET_SELECTED_DATACENTER',
    SET_SELECTED_SERVER = 'SET_SELECTED_SERVER',
    SET_SELECTED_VM = 'SET_SELECTED_VM',
    SET_NODE_STATUSES = 'SET_NODE_STATUSES',
    SET_CONFIGURED_NODES = 'SET_CONFIGURED_NODES',
    SET_ACTIVE_COMPONENT = 'SET_ACTIVE_COMPONENT',
    SET_SELECTED_MAIN_TOP_BAR_COMPONENT = 'SET_SELECTED_MAIN_TOP_BAR_COMPONENT',
    TOGGLE_DATACENTER_VISIBILITY = 'TOGGLE_DATACENTER_VISIBILITY',
    TOGGLE_SERVER_VISIBILITY = 'TOGGLE_SERVER_VISIBILITY',
    LOGIN_START = 'LOGIN_START',
    LOGIN_SUCCESS = 'LOGIN_SUCCESS',
    LOGIN_FAILURE = 'LOGIN_FAILURE',
    LOGOUT = 'LOGOUT',
    UPDATE_LOGIN_FORM = 'UPDATE_LOGIN_FORM',
    TOGGLE_PASSWORD_VISIBILITY = 'TOGGLE_PASSWORD_VISIBILITY',
    SIGNUP_START = 'SIGNUP_START',
    SIGNUP_SUCCESS = 'SIGNUP_SUCCESS',
    SIGNUP_FAILURE = 'SIGNUP_FAILURE',
    UPDATE_SIGNUP_FORM = 'UPDATE_SIGNUP_FORM',
    SET_SIGNUP_ERRORS = 'SET_SIGNUP_ERRORS',
    URL_UPDATE_SERVER = 'URL_UPDATE_SERVER',
    URL_UPDATE_VM = 'URL_UPDATE_VM',
    URL_UPDATE_DATACENTER = 'URL_UPDATE_DATACENTER',
    WEBSOCKET_CONNECT = 'WEBSOCKET_CONNECT',
    WEBSOCKET_DISCONNECT = 'WEBSOCKET_DISCONNECT',
    WEBSOCKET_VM_UPDATE = 'WEBSOCKET_VM_UPDATE',
    FETCH_ROLES_START = 'FETCH_ROLES_START',
    FETCH_ROLES_SUCCESS = 'FETCH_ROLES_SUCCESS',
    FETCH_ROLES_FAILURE = 'FETCH_ROLES_FAILURE',
    FETCH_PERMISSIONS_SUCCESS = 'FETCH_PERMISSIONS_SUCCESS',
    FETCH_PERMISSIONS_FAILURE = 'FETCH_PERMISSIONS_FAILURE',
    SET_ROLE_FORM = 'SET_ROLE_FORM',
    RESET_ROLE_FORM = 'RESET_ROLE_FORM',
    FETCH_POWER_RANKING_START = 'FETCH_POWER_RANKING_START',
    FETCH_POWER_RANKING_SUCCESS = 'FETCH_POWER_RANKING_SUCCESS',
    FETCH_POWER_RANKING_FAILURE = 'FETCH_POWER_RANKING_FAILURE',
    SET_EDITING_ROLE_ID = 'SET_EDITING_ROLE_ID',
    SET_DATACENTER_VIEW = 'SET_DATACENTER_VIEW',
    SET_SERVER_VIEW = 'SET_SERVER_VIEW',
    FETCH_USERS_START = 'FETCH_USERS_START',
    FETCH_USERS_SUCCESS = 'FETCH_USERS_SUCCESS',
    FETCH_USERS_FAILURE = 'FETCH_USERS_FAILURE',
    SET_SELECTED_USER = 'SET_SELECTED_USER',
    SET_EDIT_USER_MODAL = 'SET_EDIT_USER_MODAL',
    SET_REGISTER_USER_MODAL = 'SET_REGISTER_USER_MODAL',
    SET_USER_VIEW_FILTER = 'SET_USER_VIEW_FILTER',
    UPDATE_REGISTER_USER_FORM = 'UPDATE_REGISTER_USER_FORM',
    RESET_REGISTER_USER_FORM = 'RESET_REGISTER_USER_FORM',
    SET_USER_FORM_ERROR = 'SET_USER_FORM_ERROR',
    SET_SELECTED_USER_ROLES = 'SET_SELECTED_USER_ROLES',
    FETCH_METRICS_UID_START = 'FETCH_METRICS_UID_START',
    FETCH_METRICS_UID_SUCCESS = 'FETCH_METRICS_UID_SUCCESS',
    FETCH_METRICS_UID_FAILURE = 'FETCH_METRICS_UID_FAILURE',
    SET_METRICS_VIEWING_PANEL = 'SET_METRICS_VIEWING_PANEL',
    UPDATE_METRICS = 'UPDATE_METRICS',
    FETCH_ACTIVITY_LOGS_START = 'FETCH_ACTIVITY_LOGS_START',
    FETCH_ACTIVITY_LOGS_SUCCESS = 'FETCH_ACTIVITY_LOGS_SUCCESS',
    FETCH_ACTIVITY_LOGS_FAILURE = 'FETCH_ACTIVITY_LOGS_FAILURE',
    FETCH_ISO_LIST_START = 'FETCH_ISO_LIST_START',
    FETCH_ISO_LIST_SUCCESS = 'FETCH_ISO_LIST_SUCCESS',
    FETCH_ISO_LIST_FAILURE = 'FETCH_ISO_LIST_FAILURE',
    FETCH_CLOUD_IMAGES_START = 'FETCH_CLOUD_IMAGES_START',
    FETCH_CLOUD_IMAGES_SUCCESS = 'FETCH_CLOUD_IMAGES_SUCCESS',
    FETCH_CLOUD_IMAGES_FAILURE = 'FETCH_CLOUD_IMAGES_FAILURE',
    ISO_UPLOAD_START = 'ISO_UPLOAD_START',
    ISO_UPLOAD_SUCCESS = 'ISO_UPLOAD_SUCCESS',
    ISO_UPLOAD_FAILURE = 'ISO_UPLOAD_FAILURE',
    SET_SELECTED_ISO = 'SET_SELECTED_ISO',
    SET_ISO_FIELD = 'SET_ISO_FIELD',
    SET_OS_INSTALL_MESSAGE = 'SET_OS_INSTALL_MESSAGE',
    SET_INSTALLING_STATE = 'SET_INSTALLING_STATE',
    TOGGLE_START_ON_BOOT = 'TOGGLE_START_ON_BOOT',
    SET_VNC_CONSOLE_URL = 'SET_VNC_CONSOLE_URL',
    SET_VNC_CONSOLE_OPTIONS = 'SET_VNC_CONSOLE_OPTIONS',
    VNC_CONSOLE_ERROR = 'VNC_CONSOLE_ERROR',
    FETCH_NETWORK_INTERFACES_START = 'FETCH_NETWORK_INTERFACES_START',
    FETCH_NETWORK_INTERFACES_SUCCESS = 'FETCH_NETWORK_INTERFACES_SUCCESS',
    FETCH_NETWORK_INTERFACES_FAILURE = 'FETCH_NETWORK_INTERFACES_FAILURE',
    FETCH_SWITCHES_START = 'FETCH_SWITCHES_START',
    FETCH_SWITCHES_SUCCESS = 'FETCH_SWITCHES_SUCCESS',
    FETCH_SWITCHES_FAILURE = 'FETCH_SWITCHES_FAILURE',
    CREATE_SWITCH_START = 'CREATE_SWITCH_START',
    CREATE_SWITCH_SUCCESS = 'CREATE_SWITCH_SUCCESS',
    CREATE_SWITCH_FAILURE = 'CREATE_SWITCH_FAILURE',
    DELETE_SWITCH_START = 'DELETE_SWITCH_START',
    DELETE_SWITCH_SUCCESS = 'DELETE_SWITCH_SUCCESS',
    DELETE_SWITCH_FAILURE = 'DELETE_SWITCH_FAILURE',
    SET_NETWORK_DROPDOWN = 'SET_NETWORK_DROPDOWN',
    SET_SHOW_CREATE_SWITCH_FORM = 'SET_SHOW_CREATE_SWITCH_FORM',
    SET_SWITCH_NAME = 'SET_SWITCH_NAME',
    SET_SELECTED_INTERFACE = 'SET_SELECTED_INTERFACE',
    FETCH_FIREWALL_RULES_START = 'FETCH_FIREWALL_RULES_START',
    FETCH_FIREWALL_RULES_SUCCESS = 'FETCH_FIREWALL_RULES_SUCCESS',
    FETCH_FIREWALL_RULES_FAILURE = 'FETCH_FIREWALL_RULES_FAILURE',
    UPDATE_FIREWALL_RULES_START = 'UPDATE_FIREWALL_RULES_START',
    UPDATE_FIREWALL_RULES_SUCCESS = 'UPDATE_FIREWALL_RULES_SUCCESS',
    UPDATE_FIREWALL_RULES_FAILURE = 'UPDATE_FIREWALL_RULES_FAILURE',
    CANCEL_FIREWALL_REVERT_START = 'CANCEL_FIREWALL_REVERT_START',
    CANCEL_FIREWALL_REVERT_SUCCESS = 'CANCEL_FIREWALL_REVERT_SUCCESS',
    CANCEL_FIREWALL_REVERT_FAILURE = 'CANCEL_FIREWALL_REVERT_FAILURE',
    SET_FIREWALL_NOTIFICATION = 'SET_FIREWALL_NOTIFICATION',
    SET_FIREWALL_REVERT_COUNTDOWN = 'SET_FIREWALL_REVERT_COUNTDOWN',
    SET_FIREWALL_ID = 'SET_FIREWALL_ID',
    FETCH_LOGS_START = 'FETCH_LOGS_START',
    FETCH_LOGS_SUCCESS = 'FETCH_LOGS_SUCCESS',
    FETCH_LOGS_FAILURE = 'FETCH_LOGS_FAILURE',
    SET_LOGS_LEVEL = 'SET_LOGS_LEVEL',
    SET_LOGS_CONTAINS = 'SET_LOGS_CONTAINS',
    FETCH_STORAGE_POOLS_START = 'FETCH_STORAGE_POOLS_START',
    FETCH_STORAGE_POOLS_SUCCESS = 'FETCH_STORAGE_POOLS_SUCCESS',
    FETCH_STORAGE_POOLS_FAILURE = 'FETCH_STORAGE_POOLS_FAILURE',
    FETCH_DATASTORES_START = 'FETCH_DATASTORES_START',
    FETCH_DATASTORES_SUCCESS = 'FETCH_DATASTORES_SUCCESS',
    FETCH_DATASTORES_FAILURE = 'FETCH_DATASTORES_FAILURE',
    FETCH_VM_DISKS_START = 'FETCH_VM_DISKS_START',
    FETCH_VM_DISKS_SUCCESS = 'FETCH_VM_DISKS_SUCCESS',
    FETCH_VM_DISKS_FAILURE = 'FETCH_VM_DISKS_FAILURE',
    ATTACH_DISK_START = 'ATTACH_DISK_START',
    ATTACH_DISK_SUCCESS = 'ATTACH_DISK_SUCCESS',
    ATTACH_DISK_FAILURE = 'ATTACH_DISK_FAILURE',
    REASSIGN_DISK_START = 'REASSIGN_DISK_START',
    REASSIGN_DISK_SUCCESS = 'REASSIGN_DISK_SUCCESS',
    REASSIGN_DISK_FAILURE = 'REASSIGN_DISK_FAILURE',
    SET_DISK_FORM_FIELD = 'SET_DISK_FORM_FIELD',
    DELETE_DATASET_START = 'DELETE_DATASET_START',
    DELETE_DATASET_SUCCESS = 'DELETE_DATASET_SUCCESS',
    DELETE_DATASET_FAILURE = 'DELETE_DATASET_FAILURE',
    FETCH_SNAPSHOTS_START = 'FETCH_SNAPSHOTS_START',
    FETCH_SNAPSHOTS_SUCCESS = 'FETCH_SNAPSHOTS_SUCCESS',
    FETCH_SNAPSHOTS_FAILURE = 'FETCH_SNAPSHOTS_FAILURE',
    FETCH_VM_SNAPSHOTS_SUCCESS = 'FETCH_VM_SNAPSHOTS_SUCCESS',
    CREATE_SNAPSHOT_START = 'CREATE_SNAPSHOT_START',
    CREATE_SNAPSHOT_SUCCESS = 'CREATE_SNAPSHOT_SUCCESS',
    CREATE_SNAPSHOT_FAILURE = 'CREATE_SNAPSHOT_FAILURE',
    ROLLBACK_SNAPSHOT_START = 'ROLLBACK_SNAPSHOT_START',
    ROLLBACK_SNAPSHOT_SUCCESS = 'ROLLBACK_SNAPSHOT_SUCCESS',
    ROLLBACK_SNAPSHOT_FAILURE = 'ROLLBACK_SNAPSHOT_FAILURE',
    SET_SNAPSHOT_MESSAGE = 'SET_SNAPSHOT_MESSAGE',
    SET_NODE_JOB_CONTEXT = 'SET_NODE_JOB_CONTEXT',
    SET_CREATING_ZPOOL = 'SET_CREATING_ZPOOL',
    FETCH_UPDATES_START = 'FETCH_UPDATES_START',
    FETCH_UPDATES_SUCCESS = 'FETCH_UPDATES_SUCCESS',
    FETCH_UPDATES_FAILURE = 'FETCH_UPDATES_FAILURE',
    SET_UPDATES_FILTER = 'SET_UPDATES_FILTER',
    DOWNLOAD_UPDATE_START = 'DOWNLOAD_UPDATE_START',
    DOWNLOAD_UPDATE_SUCCESS = 'DOWNLOAD_UPDATE_SUCCESS',
    DOWNLOAD_UPDATE_FAILURE = 'DOWNLOAD_UPDATE_FAILURE',
    INSTALL_UPDATE_START = 'INSTALL_UPDATE_START',
    INSTALL_UPDATE_SUCCESS = 'INSTALL_UPDATE_SUCCESS',
    INSTALL_UPDATE_FAILURE = 'INSTALL_UPDATE_FAILURE',
    SCHEDULE_UPDATE_START = 'SCHEDULE_UPDATE_START',
    SCHEDULE_UPDATE_SUCCESS = 'SCHEDULE_UPDATE_SUCCESS',
    SCHEDULE_UPDATE_FAILURE = 'SCHEDULE_UPDATE_FAILURE',
    FETCH_UPDATE_HISTORY_START = 'FETCH_UPDATE_HISTORY_START',
    FETCH_UPDATE_HISTORY_SUCCESS = 'FETCH_UPDATE_HISTORY_SUCCESS',
    FETCH_UPDATE_HISTORY_FAILURE = 'FETCH_UPDATE_HISTORY_FAILURE',
    SET_UPDATE_HISTORY_FILTER = 'SET_UPDATE_HISTORY_FILTER',
    FETCH_UPDATE_HISTORY_DETAIL_START = 'FETCH_UPDATE_HISTORY_DETAIL_START',
    FETCH_UPDATE_HISTORY_DETAIL_SUCCESS = 'FETCH_UPDATE_HISTORY_DETAIL_SUCCESS',
    FETCH_UPDATE_HISTORY_DETAIL_FAILURE = 'FETCH_UPDATE_HISTORY_DETAIL_FAILURE',
    FETCH_CURRENT_STATE_START = 'FETCH_CURRENT_STATE_START',
    FETCH_CURRENT_STATE_SUCCESS = 'FETCH_CURRENT_STATE_SUCCESS',
    FETCH_CURRENT_STATE_FAILURE = 'FETCH_CURRENT_STATE_FAILURE',
    SET_CURRENT_STATE_FILTER = 'SET_CURRENT_STATE_FILTER',
    FETCH_INSTALL_JOBS_START = 'FETCH_INSTALL_JOBS_START',
    FETCH_INSTALL_JOBS_SUCCESS = 'FETCH_INSTALL_JOBS_SUCCESS',
    FETCH_INSTALL_JOBS_FAILURE = 'FETCH_INSTALL_JOBS_FAILURE',
    SET_INSTALL_JOBS_FILTER = 'SET_INSTALL_JOBS_FILTER',
    FETCH_INSTALL_STATUS_DETAILS_START = 'FETCH_INSTALL_STATUS_DETAILS_START',
    FETCH_INSTALL_STATUS_DETAILS_SUCCESS = 'FETCH_INSTALL_STATUS_DETAILS_SUCCESS',
    FETCH_INSTALL_STATUS_DETAILS_FAILURE = 'FETCH_INSTALL_STATUS_DETAILS_FAILURE',
    FETCH_INSTALL_NODES_START = 'FETCH_INSTALL_NODES_START',
    FETCH_INSTALL_NODES_SUCCESS = 'FETCH_INSTALL_NODES_SUCCESS',
    FETCH_INSTALL_NODES_FAILURE = 'FETCH_INSTALL_NODES_FAILURE',
    FETCH_POWER_DATA_START = 'FETCH_POWER_DATA_START',
    FETCH_POWER_DATA_SUCCESS = 'FETCH_POWER_DATA_SUCCESS',
    FETCH_POWER_DATA_FAILURE = 'FETCH_POWER_DATA_FAILURE',
    FETCH_NODE_TOP_INFO_START = 'FETCH_NODE_TOP_INFO_START',
    FETCH_NODE_TOP_INFO_SUCCESS = 'FETCH_NODE_TOP_INFO_SUCCESS',
    FETCH_NODE_TOP_INFO_FAILURE = 'FETCH_NODE_TOP_INFO_FAILURE',
    SET_INVENTORY = 'SET_INVENTORY',
    FETCH_VM_LOAD_ANALYSIS_START = 'FETCH_VM_LOAD_ANALYSIS_START',
    FETCH_VM_LOAD_ANALYSIS_SUCCESS = 'FETCH_VM_LOAD_ANALYSIS_SUCCESS',
    FETCH_VM_LOAD_ANALYSIS_FAILURE = 'FETCH_VM_LOAD_ANALYSIS_FAILURE',
    FETCH_VLANS_START = 'FETCH_VLANS_START',
    FETCH_VLANS_SUCCESS = 'FETCH_VLANS_SUCCESS',
    FETCH_VLANS_FAILURE = 'FETCH_VLANS_FAILURE',
    FETCH_VLAN_DETAILS_START = 'FETCH_VLAN_DETAILS_START',
    FETCH_VLAN_DETAILS_SUCCESS = 'FETCH_VLAN_DETAILS_SUCCESS',
    FETCH_VLAN_DETAILS_FAILURE = 'FETCH_VLAN_DETAILS_FAILURE',
    CREATE_VLAN_START = 'CREATE_VLAN_START',
    CREATE_VLAN_SUCCESS = 'CREATE_VLAN_SUCCESS',
    CREATE_VLAN_FAILURE = 'CREATE_VLAN_FAILURE',
    DELETE_VLAN_START = 'DELETE_VLAN_START',
    DELETE_VLAN_SUCCESS = 'DELETE_VLAN_SUCCESS',
    DELETE_VLAN_FAILURE = 'DELETE_VLAN_FAILURE',
    FETCH_VLAN_AVAILABLE_TAGS_START = 'FETCH_VLAN_AVAILABLE_TAGS_START',
    FETCH_VLAN_AVAILABLE_TAGS_SUCCESS = 'FETCH_VLAN_AVAILABLE_TAGS_SUCCESS',
    FETCH_VLAN_AVAILABLE_TAGS_FAILURE = 'FETCH_VLAN_AVAILABLE_TAGS_FAILURE',
    FETCH_VLAN_STATS_START = 'FETCH_VLAN_STATS_START',
    FETCH_VLAN_STATS_SUCCESS = 'FETCH_VLAN_STATS_SUCCESS',
    FETCH_VLAN_STATS_FAILURE = 'FETCH_VLAN_STATS_FAILURE',
    PING_VLAN_START = 'PING_VLAN_START',
    PING_VLAN_SUCCESS = 'PING_VLAN_SUCCESS',
    PING_VLAN_FAILURE = 'PING_VLAN_FAILURE',
    CONFIGURE_VLAN_IP_START = 'CONFIGURE_VLAN_IP_START',
    CONFIGURE_VLAN_IP_SUCCESS = 'CONFIGURE_VLAN_IP_SUCCESS',
    CONFIGURE_VLAN_IP_FAILURE = 'CONFIGURE_VLAN_IP_FAILURE',
    FETCH_VLAN_DELETION_PROMPT_START = 'FETCH_VLAN_DELETION_PROMPT_START',
    FETCH_VLAN_DELETION_PROMPT_SUCCESS = 'FETCH_VLAN_DELETION_PROMPT_SUCCESS',
    FETCH_VLAN_DELETION_PROMPT_FAILURE = 'FETCH_VLAN_DELETION_PROMPT_FAILURE',
    SET_VLAN_FORM = 'SET_VLAN_FORM',
    CLEAR_VLAN_FORM = 'CLEAR_VLAN_FORM',
    RESET_VLAN_STATE = 'RESET_VLAN_STATE',
    CREATE_ZFS_SNAPSHOT_START = 'CREATE_ZFS_SNAPSHOT_START',
    CREATE_ZFS_SNAPSHOT_SUCCESS = 'CREATE_ZFS_SNAPSHOT_SUCCESS',
    CREATE_ZFS_SNAPSHOT_FAILURE = 'CREATE_ZFS_SNAPSHOT_FAILURE',
    FETCH_VALE_CONFIG_START = 'FETCH_VALE_CONFIG_START',
    FETCH_VALE_CONFIG_SUCCESS = 'FETCH_VALE_CONFIG_SUCCESS',
    FETCH_VALE_CONFIG_FAILURE = 'FETCH_VALE_CONFIG_FAILURE',
    FETCH_VALE_CONNECTIONS_START = 'FETCH_VALE_CONNECTIONS_START',
    FETCH_VALE_CONNECTIONS_SUCCESS = 'FETCH_VALE_CONNECTIONS_SUCCESS',
    FETCH_VALE_CONNECTIONS_FAILURE = 'FETCH_VALE_CONNECTIONS_FAILURE',
    DETACH_VALE_SWITCH_START = 'DETACH_VALE_SWITCH_START',
    DETACH_VALE_SWITCH_SUCCESS = 'DETACH_VALE_SWITCH_SUCCESS',
    DETACH_VALE_SWITCH_FAILURE = 'DETACH_VALE_SWITCH_FAILURE',
    ATTACH_VALE_SWITCH_START = 'ATTACH_VALE_SWITCH_START',
    ATTACH_VALE_SWITCH_SUCCESS = 'ATTACH_VALE_SWITCH_SUCCESS',
    ATTACH_VALE_SWITCH_FAILURE = 'ATTACH_VALE_SWITCH_FAILURE',
    CLEAR_VALE_MESSAGES = 'CLEAR_VALE_MESSAGES',
    FETCH_SEAWEED_MASTER_CONFIG_START = 'FETCH_SEAWEED_MASTER_CONFIG_START',
    FETCH_SEAWEED_MASTER_CONFIG_SUCCESS = 'FETCH_SEAWEED_MASTER_CONFIG_SUCCESS',
    FETCH_SEAWEED_MASTER_CONFIG_FAILURE = 'FETCH_SEAWEED_MASTER_CONFIG_FAILURE',
    CONFIGURE_SEAWEED_MASTER_START = 'CONFIGURE_SEAWEED_MASTER_START',
    CONFIGURE_SEAWEED_MASTER_SUCCESS = 'CONFIGURE_SEAWEED_MASTER_SUCCESS',
    CONFIGURE_SEAWEED_MASTER_FAILURE = 'CONFIGURE_SEAWEED_MASTER_FAILURE',
    CLEAR_SEAWEED_CONFIG_ERROR = 'CLEAR_SEAWEED_CONFIG_ERROR',
    FETCH_SEAWEED_VOLUMES_START = 'FETCH_SEAWEED_VOLUMES_START',
    FETCH_SEAWEED_VOLUMES_SUCCESS = 'FETCH_SEAWEED_VOLUMES_SUCCESS',
    FETCH_SEAWEED_VOLUMES_FAILURE = 'FETCH_SEAWEED_VOLUMES_FAILURE',
    MOUNT_SEAWEED_VOLUME_START = 'MOUNT_SEAWEED_VOLUME_START',
    MOUNT_SEAWEED_VOLUME_SUCCESS = 'MOUNT_SEAWEED_VOLUME_SUCCESS',
    MOUNT_SEAWEED_VOLUME_FAILURE = 'MOUNT_SEAWEED_VOLUME_FAILURE',
    CLEAR_SEAWEED_VOLUME_ERROR = 'CLEAR_SEAWEED_VOLUME_ERROR',
    UNMOUNT_SEAWEED_VOLUME_START = 'UNMOUNT_SEAWEED_VOLUME_START',
    UNMOUNT_SEAWEED_VOLUME_SUCCESS = 'UNMOUNT_SEAWEED_VOLUME_SUCCESS',
    UNMOUNT_SEAWEED_VOLUME_FAILURE = 'UNMOUNT_SEAWEED_VOLUME_FAILURE',
    SET_UPDATES_VIEW = 'SET_UPDATES_VIEW',
    SET_CREATING_DATASTORE = 'SET_CREATING_DATASTORE',
    SET_DROPDOWN_OPEN = 'SET_DROPDOWN_OPEN',
    FETCH_NODE_STATS_HISTORY_START = 'FETCH_NODE_STATS_HISTORY_START',
    FETCH_NODE_STATS_HISTORY_SUCCESS = 'FETCH_NODE_STATS_HISTORY_SUCCESS',
    FETCH_NODE_STATS_HISTORY_FAILURE = 'FETCH_NODE_STATS_HISTORY_FAILURE',
    FETCH_VM_RECOMMENDATIONS_START = 'FETCH_VM_RECOMMENDATIONS_START',
    FETCH_VM_RECOMMENDATIONS_SUCCESS = 'FETCH_VM_RECOMMENDATIONS_SUCCESS',
    FETCH_VM_RECOMMENDATIONS_FAILURE = 'FETCH_VM_RECOMMENDATIONS_FAILURE',
  }

  // Optionally, export a type for all action type strings
  export type ActionType = keyof typeof ActionTypes;

  // API interceptor interface
  interface FetchOptions extends RequestInit {
    headers?: Record<string, string>;
  }

  export const api: {
    fetch: (url: string, options?: FetchOptions) => Promise<Response>;
  };

  // Install Updates API interfaces
  interface NodeData {
    hostname: string;
    status: 'APPLIED' | 'PENDING' | 'SCHEDULED' | 'CANCELED';
    ip?: string;
    os_hostname?: string;
    job_id?: number;
    job_status?: string;
  }

  interface InstallUpdatePayload {
    updateType: string;
    version: string;
    hostnames: string[];
    initiatedBy: string;
  }

  interface InstallUpdateResponse {
    job_id?: number;
    message?: string;
    status?: string;
  }

  // Install Updates API functions
  export function fetchInstallNodes(
    dispatch: any,
    updateType: string,
    version: string
  ): Promise<{
    appliedNodes: NodeData[];
    pendingNodes: NodeData[];
    scheduledNodes: NodeData[];
  }>;

  export function installUpdate(
    dispatch: any,
    payload: InstallUpdatePayload
  ): Promise<InstallUpdateResponse>;

  export function resetInstallUpdatesState(dispatch: any): void;

  // Approvals API interfaces
  interface ActivityLog {
    id: number;
    roles: string;
    username: string;
    vm_name: string;
    activity: string;
    ip: string;
    status: string;
    component_type: string;
    start_time: string;
    end_time: string;
  }

  interface FetchApprovalsOptions {
    page?: number;
    limit?: number;
  }

  interface ApprovalsResponse {
    logs: ActivityLog[];
    total: number;
    limit: number;
    offset: number;
  }

  // Approvals API functions
  export function fetchApprovals(
    dispatch: any,
    host: string,
    options?: FetchApprovalsOptions
  ): Promise<ApprovalsResponse>;

  export function approveEvent(dispatch: any, host: string, eventId: number): Promise<void>;

  export function rejectEvent(dispatch: any, host: string, eventId: number): Promise<void>;

  // Install Updates hook
  export function useInstallUpdates(): {
    installUpdates: {
      appliedNodes: NodeData[];
      pendingNodes: NodeData[];
      scheduledNodes: NodeData[];
      loading: boolean;
      installing: boolean;
      error: string | null;
      installResult: any;
    };
    dispatch: any;
  };

  // Observability Events interfaces
  interface ObservabilityFilters {
    event_type?: string;
    priority?: string;
    status?: string;
    component_type?: string;
  }

  interface FetchObservabilityEventsOptions {
    limit?: number;
    offset?: number;
    filters?: ObservabilityFilters;
  }

  interface FetchObservabilityEventsResult {
    logs: ActivityLog[];
    total: number;
    limit: number;
    offset: number;
  }

  // Observability Events hook
  export function useObservabilityEvents(): {
    observabilityEvents: {
      events: ActivityLog[];
      loading: boolean;
      error: string | null;
      totalCount: number;
      totalPages: number;
      currentPage: number;
      filters: ObservabilityFilters;
      componentTypes: string[];
      componentTypesLoading: boolean;
      componentTypesError: string | null;
      approvingEvents: Set<number>;
      rejectingEvents: Set<number>;
    };
    fetchObservabilityEvents: (
      host: string,
      options?: FetchObservabilityEventsOptions
    ) => Promise<FetchObservabilityEventsResult>;
    fetchComponentTypes: (host: string) => Promise<string[]>;
    approveEvent: (host: string, eventId: number) => Promise<void>;
    rejectEvent: (host: string, eventId: number) => Promise<void>;
    updateObservabilityFilters: (filters: ObservabilityFilters) => void;
    setObservabilityPagination: (pagination: {
      page: number;
      totalPages: number;
      totalCount: number;
    }) => void;
    dispatch: any;
  };

  // Observability Activity Logs interfaces
  interface ObservabilityActivityFilters {
    component_type?: string;
    status?: string;
    username?: string;
    activity?: string;
  }

  interface FetchObservabilityActivityLogsOptions {
    limit?: number;
    offset?: number;
    filters?: ObservabilityActivityFilters;
  }

  interface FetchObservabilityActivityLogsResult {
    logs: ActivityLog[];
    total: number;
    limit: number;
    offset: number;
  }

  // Observability Activity Logs hook
  export function useObservabilityActivityLogs(): {
    events: ActivityLog[];
    loading: boolean;
    error: string | null;
    totalCount: number;
    totalPages: number;
    currentPage: number;
    filters: ObservabilityActivityFilters;
    componentTypes: string[];
    componentTypesLoading: boolean;
    componentTypesError: string | null;
    approvingEvents: Set<number>;
    rejectingEvents: Set<number>;
    fetchActivityLogs: (
      host: string,
      options?: FetchObservabilityActivityLogsOptions
    ) => Promise<FetchObservabilityActivityLogsResult>;
    fetchComponentTypes: (host: string) => Promise<string[]>;
    approveEvent: (host: string, eventId: number) => Promise<void>;
    rejectEvent: (host: string, eventId: number) => Promise<void>;
    updateFilters: (filters: ObservabilityActivityFilters) => void;
    setPagination: (pagination: { page: number; totalPages: number; totalCount: number }) => void;
  };
}
