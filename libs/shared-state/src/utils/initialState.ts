import envConfig from '../../../../runtime-config';

// Initial state for the app
export const initialState = {
  dataCenters: [],
  selectedDataCenter: null,
  selectedServer: null,
  selectedVm: null,
  openDataCenters: { '1': true }, // Control Node (id: 1) open by default
  activeComponent: null, // For dynamic component rendering in MainContainer
  selected_MainTopBar_Component: null, // Specific state from TopNavBar
  currentDataCenterView: 'stats',
  currentServerView: 'home', // Default view for server navigation
  isAuthenticated: false, // App-level authentication/login status
  isAuthLoading: true, // Loading state to prevent flash during auth check
  isLoading: false, // Global loading state
  error: null, // Global error message
  nodeStatuses: {}, // To store online/offline status of nodes
  configuredNodes: [], // For storing configured nodes information

  // Activity Logs state
  activityLogs: [],
  activityLogsLoading: false,
  activityLogsError: null,

  // Control Center specific state
  inventory: [], // For storing inventory data
  totalInventoryCount: 0, // Total count of inventory items for pagination
  subnet: '', // Current subnet being scanned
  scanLoading: false, // Loading state for subnet scanning
  scanError: null, // Error state for subnet scanning
  rebootingNodes: {}, // Track nodes in rebooting state
  nodeJobContext: {}, // Track job types for nodes during ping operations

  // DC Console specific state
  vncConsoleUrl: `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}:6080/vnc.html`, // Base URL for VNC console
  vncConsoleOptions: {
    autoconnect: true,
    reconnect: true,
    reconnect_delay: 2000,
  }, // VNC console connection options
  websocketConnected: false, // Track WebSocket connection status

  // Notification WebSocket state
  notificationMessages: [], // Store notification messages from WebSocket
  notificationWebSocketConnected: false, // Track notification WebSocket connection status
  hasNotifications: false, // Track if there are unread notifications

  // Omni Dashboard URL
  omniDashboardUrl: null, // Dynamic URL for Omni Dashboard based on API data

  // SeaweedFS related state
  seaweedMasterConfig: null,
  seaweedLoading: false,
  seaweedError: null,
  seaweedConfiguring: false,
  seaweedDeleting: false,
  seaweedConfigError: null,
  seaweedVolumes: null,
  seaweedVolumesLoading: false,
  seaweedVolumesError: null,
  seaweedFilers: null,
  seaweedFilersLoading: false,
  seaweedFilersError: null,
  mountingVolume: false,
  mountVolumeError: null,
  unmountingVolume: false,
  unmountVolumeError: null,
  unmountingVolumeId: null, // Explicitly ensured for Volume unmount confirmation

  // Role Management State
  roles: [],
  permissions: [],
  roleForm: {
    name: '',
    role: '',
    description: '',
    Permissions: [],
  },

  // Stats State
  stats: {
    loadAnalysis: null,
    isLoading: false,
    error: null,
  },

  // Power Ranking State
  powerRanking: {
    current_time: '',
    start_time: '',
    end_time: '',
    ratings: [],
    isLoading: false,
    error: null,
  },

  // Updates Management State
  updates: {
    loading: false,
    error: '',
    data: [],
    filter: '',
    // Track downloads per update
    downloadingUpdates: [],
    downloadError: '',
    downloadedUpdates: [],
    downloadProgress: 0,
    // Keep for backwards compatibility
    downloading: false,
    downloadSuccess: false,
    downloadedUpdateId: '',
    canInstall: false,
    storedPath: '',
    // Track installs per update
    installingUpdates: [],
    installError: '',
    installedUpdates: [],
    installProgress: 0,
    installMessage: '',
    // Keep for backwards compatibility
    installing: false,
    installSuccess: false,
    currentView: 'updates', // Default view is 'updates'
    // Scheduling state
    schedulingUpdates: [],
    scheduledUpdates: [],
    scheduleError: null,
    scheduleSuccess: false,
    scheduledUpdateId: null,
    pendingScheduleId: null,
    scheduleTime: null,
    // Keep for backwards compatibility
    scheduling: false,
    // Installation results
    installResults: [],
    // Current state
    currentState: {
      loading: false,
      error: null,
      data: null,
      filters: {
        hostName: '',
        updateType: '',
        newVersion: '',
        requestedAt: '',
      },
    },
    installJobs: {
      loading: false,
      error: null,
      data: null,
      filters: {
        updateType: '',
        status: '',
        requestedBy: '',
      },
      pagination: {
        page: 1,
        size: 10,
        totalCount: 0,
        totalPages: 0,
      },
    },
    installStatusDetails: {
      loading: false,
      error: null,
      data: null,
    },
    installNodes: {
      loading: false,
      error: null,
      data: null,
    },
    history: {
      loading: false,
      error: null,
      data: [],
      filter: {
        updateType: null,
        hostName: null,
        action: null,
        newVersion: null,
        initiatedBy: null,
        status: null,
      },
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
      },
    },
    historyDetail: {
      loading: false,
      error: null,
      data: null,
    },
    installedUpdateId: '',
    pendingInstallId: '', // Track which update is currently being installed
  },
  editingRoleId: null,

  // User Management State
  allUsers: [],
  selectedUser: null,
  isEditUserOpen: false,
  isRegisterUserOpen: false,
  userViewFilter: 'active',
  registerUserForm: {
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
  },
  userFormError: '',

  // OS Installation State
  osInstallation: {
    isoList: [],
    selectedIso: '',
    isInstalling: false,
    loadingIsos: false,
    startOnBoot: false,
    message: '',
  },

  // Authentication State
  loginForm: {
    username: '',
    password: '',
  },
  loginError: '',
  loginLoading: false,
  showPassword: false,

  // Additional Authentication State
  additionalAuthRequired: false,
  additionalAuthCompleted: false,

  // Two-Factor Authentication State
  twoFactorAuthRequired: false,
  twoFactorAuthCompleted: false,

  // Signup State
  signupForm: {
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirmPassword: '',
  },
  signupErrors: {},
  signupLoading: false,

  // Observability / Metrics state
  metrics: {
    loading: false,
    error: null,
    uid: null,
    viewingPanel: null,
  },

  // Metrics data received from WebSockets
  metricsData: null,

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

  // SDN Interface Names for Graph Dropdown
  sdnInterfaceNames: {
    data: [],
    loading: false,
    error: null,
  },

  // SDN Interface Stats for Graph
  sdnInterfaceStats: {
    selectedInterface: '',
    statsData: [],
    wsConnected: false,
    wsError: null,
    lastUpdate: null,
  },

  // Interface Operations
  interfaceOperations: {
    toggling: null,
    toggleError: null,
    creating: false,
    createError: null,
    createSuccess: false,
    deleting: false,
    deleteError: null,
    deleteSuccess: false,
  },

  // OSPF Area Operations
  ospfAreaOperations: {
    assigning: false,
    deleting: null,
    assignError: null,
    deleteError: null,
    assignSuccess: false,
    deleteSuccess: false,
  },

  // BGP Operations
  bgpOperations: {
    creating: false,
    createError: null,
    createSuccess: false,
  },

  // Observability Services state
  observabilityServices: {
    loading: false,
    error: null,
    status: {
      grafana: false,
      node_exporter: false,
      prometheus: false,
    },
    serviceLoading: {
      grafana: false,
      node_exporter: false,
      prometheus: false,
    },
    serviceErrors: {
      grafana: null,
      node_exporter: null,
      prometheus: null,
    },
    dashboardUrl: null,
    dashboardLoading: false,
    dashboardError: null,
  },

  // Observability Events state
  observabilityEvents: {
    events: [],
    loading: false,
    error: null,
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    filters: {
      event_type: 'all',
      priority: 'all',
      status: 'all',
      component_type: 'all',
    },
    componentTypes: [],
    componentTypesLoading: false,
    componentTypesError: null,
    approvingEvents: new Set<number>(), // Track events being approved
    rejectingEvents: new Set<number>(), // Track events being rejected
  },

  // Network Management state
  network: {
    interfaces: [],
    switches: [],
    loadingInterfaces: false,
    loadingSwitches: false,
    loadingCreateSwitch: false,
    error: null,
    createSwitchError: null,
    createSwitchSuccess: null,
    dropdownSelection: 'interfaces',
    showCreateSwitchForm: false,
    switchName: '',
    selectedInterface: '',
    // TAP Interface Management
    addTapLoading: false,
    addTapError: null,
    addTapSuccess: null,
    detachTapLoading: false,
    detachTapError: null,
    detachTapSuccess: null,
    bulkDetachTapLoading: false,
    bulkDetachTapError: null,
    bulkDetachTapSuccess: null,
    // Parent Interface Management
    addParentLoading: false,
    addParentError: null,
    addParentSuccess: null,
    // Vale-specific state
    vale: {
      config: null,
      connections: null,
      summary: null,
      details: null,
      loadingConfig: false,
      loadingConnections: false,
      loadingSummary: false,
      loadingDetails: false,
      detachLoading: false,
      attachLoading: false,
      detachParentLoading: false,
      destroyLoading: false,
      destroyAnalysisLoading: false,
      configError: null,
      connectionsError: null,
      summaryError: null,
      detailsError: null,
      detachError: null,
      attachError: null,
      detachParentError: null,
      destroyError: null,
      destroyAnalysisError: null,
      detachSuccess: null,
      attachSuccess: null,
      detachParentSuccess: null,
      destroySuccess: null,
      destroyAnalysis: null,
      destroyConfirmation: null,
      lastUpdated: null,
    },
  },

  // Firewall Management state - Per-server firewall state
  firewall: {}, // Record<serverIp, FirewallState>

  // System Logs state
  logs: {
    logs: [],
    loading: false,
    error: null,
    level: '',
    contains: '',
    totalCount: 0, // Added for pagination support
  },

  // Storage / Disk Attach state
  storage: {
    pools: [],
    poolsTransformed: [], // Added transformed pools format
    datastores: [],
    vmDisks: [],
    loadingPools: false,
    loadingDatastores: false,
    loadingVmDisks: false,
    attachLoading: false,
    attachError: null,
    attachSuccess: null,
    reassignLoading: false,
    reassignError: null,
    reassignSuccess: null,
    deleteLoading: false,
    deleteError: null,
    deleteSuccess: null,
    diskForm: {
      diskType: 'virtio-blk',
      diskDev: 'custom',
      diskSize: '1G',
      zfsPath: 'zroot/vm',
      zpoolList: [],
      selectedZpool: '',
      zpoolFreeSpace: '',
      diskNo: '',
      datastore: 'store',
    },
  },

  // ISO Management
  iso: {
    isoList: [],
    loading: false,
    error: null,
    selectedIso: '',
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

  // Cloud Images Management
  cloudImages: {
    cloudImagesList: [],
    loading: false,
    error: null,
  },

  // Datacenter ISO Management
  dcIso: {
    isoList: [],
    cloudImagesList: [],
    loading: false,
    error: null,
    cloudImagesError: null,
    selectedIso: '',
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

  // VNC Console Error state
  vncConsoleError: null,

  // Snapshot Management State
  snapshots: [],
  vmSnapshots: {}, // VM-specific snapshots: { "serverIp:vmName": [...snapshots] }
  snapshotsLoading: false,
  creatingSnapshot: false,
  rollingBackSnapshot: false,
  snapshotMessage: null,

  // Storage Management State
  creatingZpool: false,
  creatingDatastore: false,

  // UI State
  dropdownOpen: false,

  // Power Monitoring State
  power: {
    data: {},
    loading: false,
    error: null,
  },

  // Node Metrics Top Info State
  nodeTopInfo: {
    data: null,
    loading: false,
    error: null,
  },
  // VLAN Management State
  vlans: {
    vlans: [],
    selectedVlan: null,
    vlanDetails: null,
    availableTags: null,
    vlanStats: null,
    pingResult: null,
    deletionPrompt: null,
    loadingVlans: false,
    loadingVlanDetails: false,
    loadingAvailableTags: false,
    loadingVlanStats: false,
    pingInProgress: false,
    configuringIP: false,
    loadingDeletionPrompt: false,
    creatingVlan: false,
    deletingVlan: false,
    error: null,
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

  // VXLAN Tunnels state
  vxlanTunnels: {
    suitors: [],
    tunnelsList: [],
    isLoadingSuitors: false,
    isCreatingTunnel: false,
    isLoadingTunnels: false,
    isUpdatingTunnel: false,
    isDeletingTunnel: false,
    suitorsError: null,
    createTunnelError: null,
    fetchTunnelsError: null,
    updateTunnelError: null,
    deleteTunnelError: null,
    createTunnelSuccess: false,
    updateTunnelSuccess: false,
    deleteTunnelSuccess: false,
  },

  // VM Recommendations state
  vmRecommendations: [],
  isLoadingVmRecommendations: false,
  vmRecommendationsError: null,

  // Node Stats History state
  nodeStatsHistory: [],
  isLoadingNodeStatsHistory: false,
  nodeStatsHistoryError: null,

  // Node Stats Recommendations state
  nodeStatsRecommendations: [],
  isLoadingNodeStatsRecommendations: false,
  nodeStatsRecommendationsError: null,

  // Historical VM Stats state
  historicalVmStats: {}, // Keyed by nodeIp
  isLoadingHistoricalVmStats: false,
  historicalVmStatsError: null,

  // VM Details for Kubernetes VMs
  selectedVmDetails: null,

  // VM Hardware Data Management
  vmHardwareData: {},
  vmHardwareLoading: {},
  vmHardwareError: {},

  // FRR Configuration Management
  frrConfig: '',
  frrConfigOperations: {
    loading: false,
    updating: false,
    error: null,
    updateError: null,
  },

  // FRR Router Configuration
  routerConfigOperations: {
    configuring: false,
    error: null,
    lastConfigured: null,
  },

  // Available Nodes (Configured/Provisioned)
  availableNodes: [],
  configuredNodesOperations: {
    loading: false,
    error: null,
  },
  // Migration state
  migration: {
    vmList: [],
    vmCount: 0,
    totalCount: 0,
    isLoading: false,
    isLoadingDetails: false,
    error: null,
    showCredentialsModal: false,
    showVmListModal: false,
    selectedVm: null,
    vmDetails: null,
    externalNodes: [],
    isLoadingNodes: false,
    nodesError: null,
    bulkMigration: {
      isLoading: false,
      error: null,
      success: false,
    },
    batches: {
      isLoading: false,
      error: null,
      data: [],
    },
  },

  // Approvals Management
  approvals: {
    events: [],
    loading: false,
    error: null,
    processingEventId: null,
    pagination: {
      page: 1,
      totalPages: 1,
      totalCount: 0,
      limit: 10,
    },
  },
  controlCenter: {
    configurationCheckLoading: false,
    configurationCheckError: null,
    configuringNodes: new Set<string>(),
    configuringNodesErrors: new Map<string, string>(),
    overridingBmcNodes: new Set<string>(),
    overridingBmcErrors: new Map<string, string>(),
    scanLoading: false,
    scanError: null,
    scannedNodes: [],
    addingToInventoryNodes: new Set<string>(),
    addingToInventoryErrors: new Map<string, string>(),
    deletingFromInventoryNodes: new Set<string>(),
    deletingFromInventoryErrors: new Map<string, string>(),
    settingBmcCredsNodes: new Set<string>(),
    settingBmcCredsErrors: new Map<string, string>(),
    pikvmRevealingNodes: new Set<string>(),
    pikvmRevealingErrors: new Map<string, string>(),
  },

  // Install Updates state
  installUpdates: {
    appliedNodes: [],
    pendingNodes: [],
    scheduledNodes: [],
    loading: false,
    installing: false,
    error: null,
    installResult: null,
  },

  // Server API state for LandingPage
  serverData: {
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
  },

  // Netbox state
  netbox: {
    racks: [],
    loading: false,
    error: null,
    configuring: false,
    configResponse: null,
    showDeviceOnboardingModal: false,
  },

  // MooseFS Storage state
  moosefsStorage: {
    data: [],
    loading: false,
    error: null,
    mounting: false,
    unmounting: false,
  },

  // Power Utility state
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

  // Google Anthos K8S state
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
    admin_email: null, // Email from credentials-check or service key upload (used throughout provisioning)
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
  globalVmList: {
    vms: [],
    loading: false,
    error: null,
    lastFetched: null,
  },
};
