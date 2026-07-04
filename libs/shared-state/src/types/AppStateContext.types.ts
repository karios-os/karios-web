// Types for AppStateContext
import { Dispatch, FormEvent } from 'react';
import { AppAction } from '../utils/reducer';
import { AppState, Server } from './AppState.types';

// JWT Token interface
export interface JwtPayload {
  exp?: number;
  username?: string;
  email?: string;
  permissions?: string[];
  isSeed?: boolean;
  requires_approval?: boolean;
  approvers?: string[];
  [key: string]: any;
}

// Permissions interface
export interface Permissions {
  [key: string]: boolean; // Dynamic keys instead of hardcoded ones
}

// WebSocket options interface
export interface WebSocketOptions {
  onConnect?: (ws: WebSocket) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  reconnect?: boolean;
  manualClose?: boolean;
  reconnectInterval?: number;
}

// Storage related types
export interface Disk {
  id: string;
  name: string;
  size?: string;
  [key: string]: any;
}

export interface StoragePool {
  id?: string;
  name?: string;
  available?: string;
  used?: string;
  type?: string;
  path?: string;
  FREE?: string;
  free?: string;
  NAME?: string;
  [key: string]: any;
}

export interface Dataset {
  name: string;
  type?: string;
  [key: string]: any;
}

export interface Datastore {
  name: string;
  [key: string]: any;
}

// Form data interfaces
export interface RegisterUserForm {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}

// Event handler types
export interface FormChangeEvent {
  target: {
    name: string;
    value: string;
  };
}

// Form error types
export interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  [key: string]: string | undefined;
}

// ISO Management types
export interface IsoContext {
  isoList: any[];
  loading: boolean;
  error: string | null;
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
}

export interface CloudImagesContext {
  cloudImagesList: any[];
  loading: boolean;
  error: string | null;
}

// Main AppStateContext interface
export interface AppStateContextType {
  takeZfsSnapshot: any;
  setInventory: any;
  // Core state and dispatch
  state: AppState;
  dispatch: Dispatch<AppAction>;

  // Main App State methods
  fetchInitialDataCenters: (serverIp: string) => Promise<any>;
  fetchVMsForServer: (server: any) => Promise<any>;
  fetchOmniDashboardUrl: () => Promise<void>;
  fetchVMs: () => Promise<any>;
  performVmAction: (
    serverIp: string,
    vmName: string,
    action: string,
    body?: any,
    approver?: string,
    vmUuid?: string
  ) => Promise<any>;
  performVmActionWebSocket: (
    serverIp: string,
    vmName: string,
    action: string,
    onStatusUpdate?: (status: any) => void,
    vmUuid?: string
  ) => Promise<any>;
  fetchVMsWebSocket: (server: any) => void;
  setupVmListWebSocket: (server: any, dispatch: any) => WebSocket | null;
  renameVmInContext: (
    serverIp: string,
    vmName: string,
    datastore: string,
    newVmName: string,
    approver?: string,
    vmUuid?: string
  ) => Promise<any>;
  cloneVmInContext: (
    serverIp: string,
    vmName: string,
    datastore: string,
    newVmName: string,
    approver?: string,
    vmUuid?: string
  ) => Promise<any>;
  checkNodeStatuses: () => Promise<any>;
  setConfiguredNodes: (nodes: any[]) => void;
  setMainTopBarComponent: (component: string) => void;
  handleAdminPageChange: (component: string) => void;
  setDataCenterView: (view: string) => void;
  setServerView: (view: string) => void;

  // DataCenter related values and methods
  selectedDataCenter: any;
  setSelectedDataCenter: (datacenter: any) => void;
  scannedData: string;
  setScannedData: (data: string) => void;
  inventory: any[];
  subnet: string;
  loading: boolean;
  error: string | null;
  configuredNodes: any[];
  fetchInventory: () => Promise<any>;
  vncConsoleUrl: string;
  vncConsoleOptions: Record<string, any>;
  getVncConsoleUrl: () => string;

  // Server related values and methods
  selectedServer: Server | null;
  setSelectedServer: (server: Server | null) => void;
  dataCenters: any[];
  openDataCenters: Record<string, boolean>;
  toggleDatacenterVisibility: (dcId: string) => void;

  // Server API Functions for LandingPage
  serverData: any;
  fetchServerInventory: (selectedServerIp: string) => Promise<any>;
  fetchServerSystemInfo: (selectedServerIp: string) => Promise<any>;
  fetchServerAddinCards: (selectedServerIp: string) => Promise<any>;
  fetchServerStorageCards: (selectedServerIp: string) => Promise<any>;

  // VM related values and methods
  selectedVm: any;
  setSelectedVm: (vm: any) => void;

  // VM Details related values and methods
  selectedVmDetails: any;
  setSelectedVmDetails: (vmDetails: any) => void;
  fetchVmDetails: (vmName: string) => Promise<any>;

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
  fetchVmHardwareData: (vmName: string, serverIp: string, forceRefresh?: boolean) => Promise<any>;
  getVmHardwareDataCached: (vmName: string, serverIp: string, maxAge?: number) => Promise<any>;
  setVmHardwareCache: (vmKey: string, data: any) => void;
  clearVmHardwareCache: (vmKey?: string) => void;

  // Permissions related values and methods
  userPermissions: Permissions; // User's actual permissions
  // Enhanced helper functions that work with dynamic permissions
  hasPermission: (permissionName: string) => boolean;
  getPermissionNames: () => string[];
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  userName: string;
  seedUser: boolean;
  requiresApproval: boolean;
  approvers: string[];
  updatePermissions: (newPermissions: Partial<Permissions>) => void;
  handleLogout: () => void;
  validateToken: (token: string) => boolean;
  refreshAccessToken: () => Promise<boolean>;
  handleSessionExpired: () => void;
  setupTokenRefresh: (token: string) => void;
  checkRefreshTokenExpiry: () => Promise<boolean>;

  // WebSocket related values and methods
  socket: WebSocket | null;
  isConnected: boolean;
  wsMessages: any[];
  wsError: Event | null;
  sendMessage: (message: any) => boolean;
  closeConnection: () => void;
  connectWebSocket: (url: string, options?: WebSocketOptions) => WebSocket | undefined;

  // Notification WebSocket Functions
  connectNotificationWebSocket: () => void;
  closeNotificationWebSocket: () => void;
  notificationSocket: WebSocket | null;
  notificationIsConnected: boolean;

  // Role Management Functions
  fetchRolesData: () => Promise<any>;
  fetchPermissionsData: () => Promise<any>;
  updateRoleForm: (formData: any) => void;
  clearRoleForm: () => void;
  togglePermission: (permId: string, permName: string) => void;
  saveRole: () => Promise<any>;
  removeRole: (roleId: string) => Promise<any>;
  startEditingRole: (role: any) => void;

  // User Management Functions
  fetchAllUsers: () => Promise<any>;
  setSelectedUser: (user: any) => void;
  setEditUserModal: (isOpen: boolean) => void;
  setRegisterUserModal: (isOpen: boolean) => void;
  setUserViewFilter: (filter: string) => void;
  updateRegisterUserForm: (formData: RegisterUserForm) => void;
  handleRegisterFormChange: (e: FormChangeEvent) => void;
  resetRegisterUserForm: () => void;
  createUser: () => Promise<any>;
  deleteSelectedUser: (username: string) => Promise<any>;
  toggleUserActiveStatus: (username: string, newStatus: boolean) => Promise<any>;
  updateSelectedUserRoles: (username: string, roleIds: string[]) => Promise<any>;
  updateUserApprovers: (
    username: string,
    approvers: string[],
    requiresApproval: boolean,
    isActive: boolean,
    userId: number,
    is2FARequired?: boolean | null
  ) => Promise<any>;
  fetchApproversForUser: (username: string) => Promise<any>;

  // Authentication Functions
  updateLoginForm: (formData: any) => void;
  handleLoginFormChange: (e: FormChangeEvent) => void;
  clearLoginForm: () => void;
  togglePasswordVisibility: () => void;
  handleLogin: (e?: FormEvent) => Promise<any>;
  handle2FAVerification: (twoFactorCode: string) => Promise<any>;
  updateSignupForm: (formData: any) => void;
  handleSignupFormChange: (e: FormChangeEvent) => void;
  setSignupErrors: (errors: Record<string, string>) => void;
  validateSignupForm: () => boolean;
  handleSignup: (e?: FormEvent) => Promise<any>;

  setAdditionalAuthRequired: (required: boolean) => void;
  setAdditionalAuthCompleted: (completed: boolean) => void;

  set2FARequired: (required: boolean) => void;
  set2FACompleted: (completed: boolean) => void;

  clearSignupErrors: () => void;

  // Metrics (Observability) state and actions
  metrics: any;
  fetchMetricsUid: (serverIp: string) => Promise<any>;
  setMetricsViewingPanel: (panelId: number) => void;

  // Observability Events state and actions
  observabilityEvents: any;
  fetchObservabilityEvents: (host: string, options?: any) => Promise<any>;
  fetchComponentTypes: (host: string) => Promise<string[]>;
  approveEvent: (host: string, eventId: number) => Promise<void>;
  rejectEvent: (host: string, eventId: number) => Promise<void>;
  updateObservabilityFilters: (filters: any) => void;
  setObservabilityPagination: (pagination: any) => void;

  // Observability Activity Logs state and actions (for Notifications component)
  fetchObservabilityActivityLogs: (host: string, options?: any) => Promise<any>;
  fetchObservabilityComponentTypes: (host: string) => Promise<string[]>;
  approveActivityEvent: (host: string, eventId: number) => Promise<void>;
  rejectActivityEvent: (host: string, eventId: number) => Promise<void>;
  updateObservabilityActivityFilters: (filters: any) => void;
  setObservabilityActivityPagination: (pagination: any) => void;
  // Observability Services state and actions
  observabilityServices: any;
  fetchObservabilityServicesStatus: (serverIp: string) => Promise<any>;
  startObservabilityService: (
    serverIp: string,
    serviceName: 'grafana' | 'prometheus' | 'node_exporter'
  ) => Promise<any>;
  stopObservabilityService: (
    serverIp: string,
    serviceName: 'grafana' | 'prometheus' | 'node_exporter'
  ) => Promise<any>;
  restartObservabilityService: (
    serverIp: string,
    serviceName: 'grafana' | 'prometheus' | 'node_exporter'
  ) => Promise<any>;
  launchGrafanaDashboard: (serverIp: string) => Promise<any>;

  // Node Top Info Metrics
  nodeTopInfo: {
    loading: boolean;
    data: any;
    error: string | null;
  };
  fetchNodeTopInfo: (serverIp: string) => Promise<any>;

  // Storage context values
  availableDisks: Disk[];
  storagePools: StoragePool[];
  datastores: Datastore[];
  datasets: Record<string, Dataset[]>;
  zpoolStatus: Record<string, any>;
  deduplicationStatus: Record<string, any>;
  compressionStatus: Record<string, any>;
  selectedView: string;
  currentPool: string | null;
  selectedDatasetTypes: Record<string, string>;
  selectedDatasetType: string | null;
  loadingDatastores: boolean;
  loadingDatasets: string | null;
  deletingPool: string | null;
  creatingDataset: string | null;
  creatingZvol: boolean;
  creatingZpool: boolean;
  isTogglingDeduplication: Record<string, boolean>;
  isTogglingCompression: Record<string, boolean>;
  datasetName: string;
  datasetEncryption: boolean;
  datasetPassphrase: string;
  zvolPool: string | null;
  zvolName: string;
  zvolSize: number;
  compressionValue: string;
  creatingDatastore: boolean;
  dropdownOpen?: boolean;

  // State setters
  setSelectedView: (view: string) => void;
  setSelectedDatasetTypes: (types: Record<string, string>) => void;
  setSelectedDatasetType: (type: string | null) => void;
  setDatasetName: (name: string) => void;
  setDatasetEncryption: (encryption: boolean) => void;
  setDatasetPassphrase: (passphrase: string) => void;
  setZvolPool: (pool: string | null) => void;
  setZvolName: (name: string) => void;
  setZvolSize: (size: number) => void;
  setCompressionValue: (value: string) => void;
  setCreatingZpool: (value: boolean) => void;
  setCreatingDatastore: (value: boolean) => void;
  setDropdownOpen?: (value: boolean) => void;

  // Storage Functions
  fetchAvailableDisks: (serverIp: string) => Promise<void>;
  fetchStoragePools: (serverIp: string) => Promise<any>;
  fetchZpoolStatus: (serverIp: string, zpool: string) => Promise<void>;
  fetchDatastores: (serverIp: string) => Promise<void>;
  fetchVmDatastoresWrapper: (serverIp: string) => Promise<any>;
  fetchZfsDatasetWrapper: (serverIp: string, poolName: string) => Promise<any>;
  handleDeleteDatastore: (serverIp: string, datastoreName: string) => Promise<void>;
  fetchDatasets: (serverIp: string, poolName: string, type?: string | null) => Promise<void>;
  createDataset: (
    serverIp: string,
    poolName: string,
    datasetName: string,
    encryption?: boolean,
    passphrase?: string
  ) => Promise<void>;
  unloadDatasetKey: (serverIp: string, datasetName: string, zpoolName: string) => Promise<boolean>;
  loadDatasetKey: (
    serverIp: string,
    datasetName: string,
    zpoolName: string,
    passphrase: string
  ) => Promise<boolean>;
  deleteDataset: (serverIp: string, poolName: string, datasetName: string) => Promise<boolean>;
  fetchDeduplicationStatus: (serverIp: string, datasetName: string) => Promise<void>;
  fetchCompressionStatus: (serverIp: string, datasetName: string) => Promise<void>;
  handleDeduplicationToggle: (
    serverIp: string,
    datasetName: string,
    poolName: string
  ) => Promise<void>;
  handleCompressionToggle: (
    serverIp: string,
    datasetName: string,
    poolName: string
  ) => Promise<void>;
  createZpool: (
    serverIp: string,
    poolName: string,
    disks: string[],
    raidLevel: string
  ) => Promise<boolean>;
  deletePool: (serverIp: string, poolName: string) => Promise<boolean>;
  createZvol: (
    serverIp: string,
    poolName: string,
    zvolName: string,
    size: string
  ) => Promise<boolean>;
  normalizeValue: (value: string) => string;

  // Network Management
  network: any;
  fetchNetworkInterfaces: (serverIp: string) => Promise<any>;
  fetchSwitches: (serverIp: string) => Promise<any>;
  createSwitch: (
    serverIp: string,
    switchName: string,
    selectedInterface: string,
    switches: any[]
  ) => Promise<any>;
  deleteSwitch: (serverIp: string, switchName: string, approver?: string) => Promise<any>;
  setNetworkDropdown: (value: string) => void;
  setShowCreateSwitchForm: (value: boolean) => void;
  setSwitchName: (value: string) => void;
  setSelectedInterface: (value: string) => void;

  // VLAN Management
  vlans: any;
  fetchVLANs: () => Promise<any>;
  fetchVLANDetails: (vlanName: string) => Promise<any>;
  fetchVLANAvailableTags: () => Promise<any>;
  fetchVLANStats: (vlanName: string) => Promise<any>;
  pingVLAN: (vlanName: string) => Promise<any>;
  createVLAN: (vlanData: any) => Promise<any>;
  configureVLANIP: (vlanName: string, ipConfig: any) => Promise<any>;
  getVLANDeletionPrompt: (vlanName: string) => Promise<any>;
  deleteVLAN: (vlanName: string, deleteData?: any) => Promise<any>;
  resetVLANState: () => void;
  setVLANForm: (formData: any) => void;
  clearVLANForm: () => void;

  // Firewall Management
  firewall: any;
  fetchFirewallRules: (serverIp: string) => Promise<any>;
  updateFirewallRules: (serverIp: string, rules: string, approver?: string) => Promise<any>;
  cancelFirewallRevert: (serverIp: string, id: string) => Promise<any>;
  setFirewallNotification: (serverIp: string, notification: any) => void;
  setFirewallRevertCountdown: (serverIp: string, countdown: number) => void;
  setFirewallId: (serverIp: string, id: string) => void;

  // System Logs
  logs: any;
  fetchLogs: (
    serverIp: string,
    level: string,
    contains: string,
    page?: number,
    limit?: number,
    order?: 'asc' | 'desc'
  ) => Promise<any>;
  setLogsLevel: (level: string) => void;
  setLogsContains: (contains: string) => void;

  // Storage and Disk Management
  storage: any;
  fetchVmDisks: (serverIp: string, vmName: string) => Promise<any>;
  attachDisk: (serverIp: string, payload: any) => Promise<any>;
  reassignDisk: (serverIp: string, payload: any) => Promise<any>;
  setDiskFormField: (field: string, value: any) => void;

  // ISO Management
  iso: IsoContext;
  cloudImages: CloudImagesContext;
  fetchIsoList: (serverIp: string) => Promise<any>;
  fetchCloudImages: (serverIp: string) => Promise<any>;
  downloadIso: (serverIp: string, isoUrl: string) => Promise<any>;
  uploadIso: (serverIp: string, file: File, isoType?: string) => Promise<any>;
  deleteIso: (serverIp: string, isoName: string, isCloudImage?: boolean) => Promise<any>;
  setIsoField: (field: string, value: any) => void;
  // Upload/Download progress helpers
  setUploadProgress: (progress: number) => void;
  setUploadMessage: (message: string, messageType: string) => void;
  clearUploadState: () => void;
  setDownloadProgress: (progress: number) => void;
  setDownloadMessage: (message: string, messageType: string) => void;
  clearDownloadState: () => void;

  // Datacenter ISO Management functions
  setDcIsoUploadProgress: (progress: number) => void;
  setDcIsoUploadMessage: (message: string, messageType: string) => void;
  clearDcIsoUploadState: () => void;
  setDcIsoDownloadProgress: (progress: number) => void;
  setDcIsoDownloadMessage: (message: string, messageType: string) => void;
  clearDcIsoDownloadState: () => void;
  fetchDcIsoListShared: () => Promise<any>;
  fetchDcCloudImagesListShared: () => Promise<any>;

  // Snapshot Management
  snapshots: any;
  snapshotMessage: string | null;
  fetchSnapshots: (serverIp: string, vmName: string) => Promise<any>;
  createSnapshot: (serverIp: string, vmName: string, snapshotName: string) => Promise<any>;
  rollbackSnapshot: (serverIp: string, vmName: string, snapshotName: string) => Promise<any>;
  getVmSnapshots: (serverIp: string, vmName: string) => any[];

  // NetBox Device Onboarding Modal
  netboxShowDeviceOnboardingModal: boolean;
  closeNetBoxModal: () => void;

  // DCStats Management
  nodeStatsHistory: any[];
  isLoadingNodeStatsHistory: boolean;
  nodeStatsHistoryError: string | null;
  fetchNodeStatsHistory: (serverIp: string, startTime: string, endTime: string) => Promise<any>;

  nodeStatsRecommendations: any[];
  isLoadingNodeStatsRecommendations: boolean;
  nodeStatsRecommendationsError: string | null;
  fetchNodeStatsRecommendations: (startTime: string, endTime: string) => Promise<any>;

  historicalVmStats: Record<string, any[]>;
  isLoadingHistoricalVmStats: boolean;
  historicalVmStatsError: string | null;
  fetchHistoricalVmStats: (nodeIp: string, startTime: string, endTime: string) => Promise<any>;

  vmRecommendations: any[];
  isLoadingVmRecommendations: boolean;
  vmRecommendationsError: string | null;
  fetchVMRecommendations: (nodeIp: string, startDate: string, endDate: string) => Promise<any>;
}

// Provider props interface
export interface AppStateProviderProps {
  children: React.ReactNode;
}
