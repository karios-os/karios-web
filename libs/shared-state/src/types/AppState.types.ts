// import { VmMetricsLoadAnalysisResponse } from '../utils/statsApiService';
import { ReactNode } from 'react';

// VM Recommendations interface
export interface VMRecommendation {
  name: string;
  vcpu: number;
  mem_assigned_gb: number;
  cpu_mean: number;
  mem_mean: number;
  score: number;
  level: 'normal' | 'high' | 'critical';
  recommendation: {
    action: string;
    cpu_change: number;
    mem_change_gb: number;
    justification: string;
  };
}

// Node Stats interfaces for DCStats
export interface NodeStats {
  node_ip: string;
  cpu_cap: number;
  cpu_usage: number;
  cpu_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
  mem_cap: number;
  mem_usage: number;
  mem_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
  power: number;
  power_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
  uptime: string;
  overall_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
}

export interface VMStats {
  name: string;
  vcpu: number;
  mem_assigned: number;
  memory_pct: number;
  cpu_pct: number;
  uptime: string;
  status: string;
  score: number;
  level: string;
}

// Activity Log interface for approvals
export interface ActivityLog {
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

// Import shared types
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

// Server interface with complete information from inventory
export interface Server {
  id: number | string;
  name: string;
  ip: string;
  fqdn?: string;
  hostname?: string;
  isOpen?: boolean;
  isLoading?: boolean;
  vms?: any[];
  // Inventory-based fields for power control and other operations
  vendor?: string;
  bmc_ip?: string;
  bmc_username?: string;
  bmc_password?: string;
  version?: string;
  status?: string;
  last_updated?: string;
  provisioned?: boolean;
}

interface FirewallNotification {
  message: string;
  type: 'success' | 'error';
}

// Power Utility interfaces
export interface Country {
  code: string;
  name: string;
}

export interface State {
  code: string;
  name: string;
}

export interface PowerUtilityState {
  countries: {
    list: Country[];
    loading: boolean;
    error: string;
  };
  states: {
    list: State[];
    loading: boolean;
    error: string;
  };
  electricityRate: {
    current: number | null;
    loading: boolean;
    setting: boolean;
    error: string;
    response: any;
  };
  costReports: {
    data: any;
    loading: boolean;
    error: string;
  };
  costForecast: {
    data: any[];
    loading: boolean;
    error: string;
  };
}

export interface MooseFSStorageState {
  data: any[];
  loading: boolean;
  error: string | null;
  mounting: boolean;
  unmounting: boolean;
}

// AppState type definition
export interface AppState {
  // Removed duplicate 'iso' declaration
  cloudImages?: {
    cloudImagesList: string[];
    raws?: string[];
    loading: boolean;
    error: string | null;
  };
  unmountingVolumeId: any;
  seaweedError: ReactNode;
  seaweedLoading: any;
  seaweedMasterConfig: any;
  seaweedConfiguring: boolean;
  seaweedDeleting: boolean;
  seaweedConfigError: string | null;
  seaweedVolumes: any;
  seaweedVolumesLoading: boolean;
  seaweedVolumesError: string | null;
  seaweedFilers: any;
  seaweedFilersLoading: boolean;
  seaweedFilersError: string | null;
  mountingVolume: boolean;
  mountVolumeError: string | null;
  unmountingVolume: boolean;
  unmountVolumeError: string | null;
  dataCenters: any[];
  selectedDataCenter: any;
  selectedServer: Server | null;
  selectedVm: any;
  openDataCenters: Record<string, boolean>;
  activeComponent: string | null;
  selected_MainTopBar_Component: string | null;
  currentDataCenterView: string;
  currentServerView: string;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isLoading: boolean;
  error: string | null;
  nodeStatuses: Record<string, any>;
  configuredNodes: ConfiguredNode[];
  omniDashboardUrl: string | null;
  activityLogs: any[];
  activityLogsLoading: boolean;
  activityLogsError: string | null;
  inventory: InventoryItem[];
  totalInventoryCount: number;
  subnet: string;
  scanLoading: boolean;
  scanError: string | null;
  rebootingNodes: Record<string, any>;
  nodeJobContext: Record<string, string>;
  nodeTopInfo: {
    loading: boolean;
    data: any;
    error: string | null;
  };
  updates?: {
    currentView: string;
    history: any;
    historyDetail: {
      loading: boolean;
      data: any;
      error: string | null;
    };
    currentState?: {
      loading: boolean;
      data: any;
      error: string | null;
      filters: {
        hostName?: string;
        updateType?: string;
        newVersion?: string;
        requestedAt?: string;
      };
    };
    installJobs?: {
      loading: boolean;
      data: any;
      error: string | null;
      filters: {
        updateType?: string;
        status?: string;
        requestedBy?: string;
      };
      pagination: {
        page: number;
        size: number;
        totalCount: number;
        totalPages: number;
      };
    };
    installStatusDetails?: {
      loading: boolean;
      data: any;
      error: string | null;
    };
    loading: boolean;
    data: any;
    error: string | null;
    // Per-update download tracking
    downloadingUpdates: string[];
    downloadedUpdates: string[];
    // Legacy download properties
    downloading: boolean;
    downloadError: string | null;
    downloadSuccess: boolean;
    downloadProgress: number;
    downloadedUpdateId: string | null;
    // Add canInstall flag to indicate download is complete and ready for install
    canInstall: boolean;
    // Store the path where the update is stored
    storedPath: string | null;
    filter: string | null;
    // Per-update install tracking
    installingUpdates: string[];
    installedUpdates: string[];
    // Legacy install properties
    installing: boolean;
    installError: string | null;
    installSuccess: boolean;
    installProgress: number;
    installMessage: string | null;
    installedUpdateId: string | null;
    pendingInstallId: string | null;
    // Per-update schedule tracking
    schedulingUpdates: string[];
    scheduledUpdates: string[];
    // Legacy schedule properties
    scheduling: boolean;
    scheduleError: string | null;
    scheduleSuccess: boolean;
    scheduledUpdateId: string | null;
    pendingScheduleId: string | null;
    scheduleTime: string | null;
    installResults: any[];
    installNodes?: {
      loading: boolean;
      data: any;
      error: string | null;
    };
    status?: string;
    last_fetched_at?: string;
  };
  downloading?: any;
  vncConsoleUrl: string;
  vncConsoleOptions: {
    autoconnect: boolean;
    reconnect: boolean;
    reconnect_delay: number;
  };
  vncConsoleError: string | null;
  websocketConnected: boolean;

  // Notification WebSocket state
  notificationMessages: string[];
  notificationWebSocketConnected: boolean;
  hasNotifications: boolean;

  roles: any[];
  permissions: any[];
  roleForm: {
    name: string;
    role: string;
    description: string;
    Permissions: any[];
  };
  editingRoleId: string | null;
  allUsers: any[];
  selectedUser: any;
  isEditUserOpen: boolean;
  isRegisterUserOpen: boolean;
  userViewFilter: string;
  registerUserForm: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    password: string;
  };
  userFormError: string;
  osInstallation: {
    isoList: any[];
    selectedIso: string;
    isInstalling: boolean;
    loadingIsos: boolean;
    startOnBoot: boolean;
    message: string;
  };
  loginForm: {
    username: string;
    password: string;
  };
  loginError: string;
  loginLoading: boolean;
  showPassword: boolean;
  additionalAuthRequired: boolean;
  additionalAuthCompleted: boolean;
  twoFactorAuthRequired: boolean;
  twoFactorAuthCompleted: boolean;
  signupForm: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    password: string;
    confirmPassword: string;
  };
  signupErrors: Record<string, any>;
  signupLoading: boolean;
  metrics: {
    loading: boolean;
    error: string | null;
    uid: string | null;
    viewingPanel: string | null;
  };
  observabilityServices: {
    loading: boolean;
    error: string | null;
    status: {
      grafana: boolean;
      node_exporter: boolean;
      prometheus: boolean;
    };
    serviceLoading: {
      grafana: boolean;
      node_exporter: boolean;
      prometheus: boolean;
    };
    serviceErrors: {
      grafana: string | null;
      node_exporter: string | null;
      prometheus: string | null;
    };
    dashboardUrl: string | null;
    dashboardLoading: boolean;
    dashboardError: string | null;
  };
  metricsData: any;
  // FRR Routes Management
  frrRoutes: {
    routes: any[];
    loading: boolean;
    error: string;
  };
  // OSPF Summary Management
  ospfSummary: {
    data: any[];
    loading: boolean;
    error: string | null;
  };
  // BGP Summary Management
  bgpSummary: {
    data: any[];
    loading: boolean;
    error: string | null;
  };
  // Network Interfaces Management
  networkInterfaces: {
    data: any[];
    loading: boolean;
    error: string | null;
  };

  // SDN Interface Names for Graph Dropdown
  sdnInterfaceNames: {
    data: string[];
    loading: boolean;
    error: string | null;
  };

  // SDN Interface Stats for Graph
  sdnInterfaceStats: {
    selectedInterface: string;
    statsData: any[];
    wsConnected: boolean;
    wsError: string | null;
    lastUpdate: string | null;
  };

  // Interface Operations
  interfaceOperations: {
    toggling: string | null; // interface name being toggled
    toggleError: string | null;
    creating: boolean;
    createError: string | null;
    createSuccess: boolean;
    deleting: boolean;
    deleteError: string | null;
    deleteSuccess: boolean;
  };

  // OSPF Area Operations
  ospfAreaOperations: {
    assigning: boolean;
    deleting: string | null; // interface name being deleted
    assignError: string | null;
    deleteError: string | null;
    assignSuccess: boolean;
    deleteSuccess: boolean;
  };

  // BGP Operations
  bgpOperations: {
    creating: boolean;
    createError: string | null;
    createSuccess: boolean;
  };

  // FRR Configuration Operations
  frrConfig: string;
  frrConfigOperations: {
    loading: boolean;
    updating: boolean;
    error: string | null;
    updateError: string | null;
  };

  // FRR Router Configuration
  routerConfigOperations: {
    configuring: boolean;
    error: string | null;
    lastConfigured: any;
  };

  // Available Nodes (Configured/Provisioned)
  availableNodes: any[];
  configuredNodesOperations: {
    loading: boolean;
    error: string | null;
  };

  observabilityEvents: {
    events: any[];
    loading: boolean;
    error: string | null;
    totalCount: number;
    totalPages: number;
    currentPage: number;
    filters: {
      event_type: string;
      priority: string;
      status: string;
      component_type: string;
    };
    componentTypes: string[];
    componentTypesLoading: boolean;
    componentTypesError: string | null;
    approvingEvents: Set<number>;
    rejectingEvents: Set<number>;
  };
  network: {
    interfaces: any[];
    switches: any[];
    loadingInterfaces: boolean;
    loadingSwitches: boolean;
    loadingCreateSwitch: boolean;
    error: string | null;
    createSwitchError: string | null;
    createSwitchSuccess: string | null;
    dropdownSelection: string;
    showCreateSwitchForm: boolean;
    switchName: string;
    selectedInterface: string;
    // TAP Interface Management
    addTapLoading: boolean;
    addTapError: string | null;
    addTapSuccess: string | null;
    detachTapLoading: boolean;
    detachTapError: string | null;
    detachTapSuccess: string | null;
    bulkDetachTapLoading: boolean;
    bulkDetachTapError: string | null;
    bulkDetachTapSuccess: string | null;
    // Parent Interface Management
    addParentLoading: boolean;
    addParentError: string | null;
    addParentSuccess: string | null;
    // Vale-specific state
    vale: {
      config: any;
      connections: any;
      summary: any;
      details: any;
      loadingConfig: boolean;
      loadingConnections: boolean;
      loadingSummary: boolean;
      loadingDetails: boolean;
      detachLoading: boolean;
      attachLoading: boolean;
      detachParentLoading: boolean;
      destroyLoading: boolean;
      destroyAnalysisLoading: boolean;
      configError: string | null;
      connectionsError: string | null;
      summaryError: string | null;
      detailsError: string | null;
      detachError: string | null;
      attachError: string | null;
      detachParentError: string | null;
      destroyError: string | null;
      destroyAnalysisError: string | null;
      detachSuccess: string | null;
      attachSuccess: string | null;
      detachParentSuccess: string | null;
      destroySuccess: string | null;
      destroyAnalysis: any;
      destroyConfirmation: any;
      lastUpdated: Date | null;
    };
  };
  firewall: Record<
    string,
    {
      rules: string;
      originalRules: string;
      loading: boolean;
      notification: FirewallNotification | null;
      revertCountdown: number | null;
      revertEndTime: number | null;
      isCancellingRevert: boolean;
      id: string | null;
      copied: boolean;
    }
  >; // Per-server firewall state: { "serverIp": {...firewallState} }
  logs: {
    logs: any[];
    loading: boolean;
    error: string | null;
    level: string;
    contains: string;
    totalCount?: number; // Added for pagination support
  };
  storage: {
    pools: any[];
    poolsTransformed: any[];
    datastores: any[];
    vmDisks: any[];
    loadingPools: boolean;
    loadingDatastores: boolean;
    loadingVmDisks: boolean;
    attachLoading: boolean;
    attachError: string | null;
    attachSuccess: boolean | null;
    reassignLoading: boolean;
    reassignError: string | null;
    reassignSuccess: boolean | null;
    deleteLoading: boolean;
    deleteError: string | null;
    deleteSuccess: boolean | null;
    diskForm: {
      diskType: string;
      diskDev: string;
      diskSize: string;
      zfsPath: string;
      zpoolList: any[];
      selectedZpool: string;
      zpoolFreeSpace: string;
      diskNo: string;
      datastore: string;
    };
  };
  iso: {
    isoList: any[];
    selectedIso: string;
    loading: boolean;
    error: string | null;
    // Upload progress tracking
    uploadingIso: boolean;
    uploadProgress: number;
    uploadMessage: string;
    uploadMessageType: string;
    // Download progress tracking
    downloadingIso: boolean;
    downloadProgress: number;
    downloadMessage: string;
    downloadMessageType: string;
  };
  dcIso: {
    isoList: any[];
    cloudImagesList: any[];
    loading: boolean;
    error: string | null;
    cloudImagesError: string | null;
    selectedIso: string;
    // Upload progress tracking
    uploadingIso: boolean;
    uploadProgress: number;
    uploadMessage: string;
    uploadMessageType: string;
    // Download progress tracking
    downloadingIso: boolean;
    downloadProgress: number;
    downloadMessage: string;
    downloadMessageType: string;
  };
  snapshots: any[];
  vmSnapshots: Record<string, any[]>; // VM-specific snapshots: { "serverIp:vmName": [...snapshots] }
  snapshotsLoading: boolean;
  creatingSnapshot: boolean;
  rollingBackSnapshot: boolean;
  snapshotMessage: string | null;
  creatingZpool: boolean;
  creatingDatastore: boolean;
  dropdownOpen: boolean;
  power: {
    data: Record<string, any>;
    loading: boolean;
    error: string | null;
  };
  powerRanking: {
    current_time: string;
    start_time: string;
    end_time: string;
    ratings: Array<{
      device_id: string;
      node_ip: string;
      avg_power: number;
      rank: number;
    }>;
    isLoading: boolean;
    error: string | null;
  };
  stats: {
    loadAnalysis: any;
    isLoading: boolean;
    error: string | null;
  };
  vlans: {
    vlans: any[];
    selectedVlan: any;
    vlanDetails: any;
    availableTags: any;
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
    vlanForm: {
      tag_id: number;
      parent_nic: string;
      vlan_number: number;
      static_ip: string;
      subnet_mask: string;
    };
    ipConfigForm: {
      use_dhcp: boolean;
      is_editable: boolean;
      static_ip: string;
      gateway: string;
      subnet_mask: string;
    };
  };
  nodeStatsHistory: Array<{
    node_ip: string;
    cpu_cap: number;
    cpu_usage: number;
    cpu_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
    mem_cap: number;
    mem_usage: number;
    mem_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
    power: number;
    power_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
    uptime: string;
    overall_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
    timestamp: string;
  }>;
  isLoadingNodeStatsHistory: boolean;
  nodeStatsHistoryError: string | null;

  // Node Stats Recommendations state
  nodeStatsRecommendations: NodeStats[];
  isLoadingNodeStatsRecommendations: boolean;
  nodeStatsRecommendationsError: string | null;

  // Historical VM Stats state
  historicalVmStats: Record<string, VMStats[]>; // Keyed by nodeIp
  isLoadingHistoricalVmStats: boolean;
  historicalVmStatsError: string | null;

  // VM Recommendations state
  vmRecommendations: VMRecommendation[];
  isLoadingVmRecommendations: boolean;
  vmRecommendationsError: string | null;

  // VXLAN Tunnel state
  vxlanTunnels?: {
    suitors: any[];
    tunnelsList: any[];
    isLoadingSuitors: boolean;
    isCreatingTunnel: boolean;
    isLoadingTunnels: boolean;
    isDeletingTunnel: boolean;
    isUpdatingTunnel: boolean;
    suitorsError: string | null;
    createTunnelError: string | null;
    fetchTunnelsError: string | null;
    deleteTunnelError: string | null;
    updateTunnelError: string | null;
    createTunnelSuccess: boolean;
    deleteTunnelSuccess: boolean;
    updateTunnelSuccess: boolean;
  };

  // VM Details for Kubernetes VMs
  selectedVmDetails: any;

  // VM Hardware Data Management
  vmHardwareData: {
    [vmKey: string]: {
      vmDetails: any;
      pcieInventory: any;
      systemInfo: any;
      networkDrivers: any[];
      switches: any[];
      unusedDisks: any[];
      lastFetched: number;
      isLoading: boolean;
      error: string | null;
    };
  };
  vmHardwareLoading: {
    [vmKey: string]: boolean;
  };
  vmHardwareError: {
    [vmKey: string]: string | null;
  };

  // Migration state
  migration: {
    vmList: any[];
    vmCount: number;
    totalCount: number;
    isLoading: boolean;
    isLoadingDetails: boolean;
    error: string | null;
    showCredentialsModal: boolean;
    showVmListModal: boolean;
    selectedVm: any;
    vmDetails: any | null;
    externalNodes: any[];
    isLoadingNodes: boolean;
    nodesError: string | null;
    bulkMigration: {
      isLoading: boolean;
      error: string | null;
      success: boolean;
    };
    batches: {
      isLoading: boolean;
      error: string | null;
      data: any[];
    };
  };
  approvals: {
    events: ActivityLog[];
    loading: boolean;
    error: string | null;
    processingEventId: number | null;
    pagination: {
      page: number;
      totalPages: number;
      totalCount: number;
      limit: number;
    };
  };
  controlCenter: {
    configurationCheckLoading: boolean;
    configurationCheckError: string | null;
    configuringNodes: Set<string>;
    configuringNodesErrors: Map<string, string>;
    overridingBmcNodes: Set<string>;
    overridingBmcErrors: Map<string, string>;
    scanLoading: boolean;
    scanError: string | null;
    scannedNodes: any[];
    addingToInventoryNodes: Set<string>;
    addingToInventoryErrors: Map<string, string>;
    deletingFromInventoryNodes: Set<string>;
    deletingFromInventoryErrors: Map<string, string>;
    settingBmcCredsNodes: Set<string>;
    settingBmcCredsErrors: Map<string, string>;
    pikvmRevealingNodes: Set<string>;
    pikvmRevealingErrors: Map<string, string>;
  };
  installUpdates: InstallUpdatesState;
  serverData: ServerDataState;

  // Netbox state
  netbox: {
    racks: any[];
    loading: boolean;
    error: string | null;
    configuring: boolean;
    configResponse: any;
    showDeviceOnboardingModal: boolean;
  };

  // MooseFS Storage state
  moosefsStorage: MooseFSStorageState;

  // Power Utility state
  powerUtility: PowerUtilityState;

  // Google Anthos K8S state
  anthos: {
    form: {
      email: string;
      clusterName: string;
      projectId: string;
      serviceKeyFile: File | null;
    };
    formErrors: Record<string, string>;
    uploading: boolean;
    uploadError: string | null;
    uploadSuccess: boolean;
    config: {
      client_email?: string;
      cluster_name?: string;
      project_id?: string;
      uploaded_file?: string;
      message?: string;
    } | null;
    admin_email: string | null; // Email from credentials-check or service key upload (used throughout provisioning)
    credentialsCheck: {
      loading: boolean;
      error: string | null;
      data: {
        action: string;
        admin_workstation_exists: boolean;
        admin_workstation_name?: string;
        credentials_exist: boolean;
        project_id: string;
      } | null;
    };
    clusterSelection: {
      clusterTypes: Array<{
        anthos_cluster_type: string;
        anthos_cluster_profiles: string[];
      }>;
      selectedClusterType: string;
      selectedClusterProfile: string;
      clusterSpecs: {
        minimum?: {
          cpu: string;
          memory: string;
          storage: string;
        };
        recommended?: {
          cpu: string;
          memory: string;
          storage: string;
        };
      } | null;
      loadingClusterTypes: boolean;
      loadingClusterSpecs: boolean;
      clusterTypesError: string | null;
      clusterSpecsError: string | null;
    };
  };

  globalVmList: {
    vms: Array<{
      id: string;
      name: string;
      datastore: string;
      state: string;
      uuid?: string;
      isOn: boolean;
    }>;
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
  };
}

// Server data interfaces for LandingPage
export interface ServerInventoryData {
  ip: string;
  vendor: string;
  username: string;
  password: string;
}

export interface ServerSystemInfo {
  Made: string | null;
  Model: string | null;
  ModelName: string | null;
}

export interface ServerAddinCard {
  slot: string;
  device: string;
}

export interface ServerDisk {
  device: string;
  model: string;
  firmware_version: string;
  size: string;
  health: 'Healthy' | 'Degraded' | 'Warning';
}

export interface ServerStorageController {
  name: string;
  vendor: string;
  model: string;
  disks: ServerDisk[];
}

export interface ServerDataState {
  inventoryData: ServerInventoryData | null;
  systemInfo: ServerSystemInfo | null;
  addinCards: ServerAddinCard[] | null;
  storageCards: ServerStorageController[] | null;
  powerSupplyRatings: string[];
  loading: {
    inventory: boolean;
    systemInfo: boolean;
    addinCards: boolean;
    storageCards: boolean;
    powerSupply: boolean;
  };
  errors: {
    inventory: string | null;
    systemInfo: string | null;
    addinCards: string | null;
    storageCards: string | null;
    powerSupply: string | null;
  };
}

// Install Updates interfaces
export interface InstallNodeData {
  hostname: string;
  status: 'APPLIED' | 'PENDING' | 'SCHEDULED' | 'CANCELED';
  ip?: string;
  os_hostname?: string;
  job_id?: number;
  job_status?: string;
}

export interface InstallUpdatesState {
  appliedNodes: InstallNodeData[];
  pendingNodes: InstallNodeData[];
  scheduledNodes: InstallNodeData[];
  loading: boolean;
  installing: boolean;
  error: string | null;
  installResult: any;
}
