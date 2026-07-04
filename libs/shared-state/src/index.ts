// Export everything from the consolidated AppStateContext
export * from './AppStateContext';
export { useFirewall } from './AppStateContext';
export { useAppState } from './AppStateContext';
export { useDataCenter } from './AppStateContext';
export { useServer } from './AppStateContext';
export { useVm } from './AppStateContext';
export { usePermissions } from './AppStateContext';
export { useWebSocket } from './AppStateContext';
export { useNotifications } from './AppStateContext';
export { useStorage } from './AppStateContext';
export { useInstallUpdates } from './AppStateContext';

// Export types
export * from './types';

// Export utility functions and types
export { default as api } from './utils/interceptor'; // Export the interceptor
export { default as appReducer } from './utils/reducer'; // Export the reducer and utility function
export { initialState } from './utils/initialState'; // Export the initial state
export { ActionTypes } from './utils/actionTypes'; // Export action types directly
export { logger, createComponentLogger, createActionLogger } from './utils/logger'; // Export logger utilities
export * from './utils/apiService'; // Export API service functions
export { fetchNetworkInterfaces } from './utils/apiService'; // disambiguate from vmHardwareApiService
export * from './utils/vmHardwareApiService'; // Export VM Hardware API service functions
export * from './utils/observabilityApiService'; // Export Observability API service functions
export * from './utils/serverApiService'; // Export server API service functions
export * from './utils/approvalsApiService'; // Export approvals API service functions
export * from './utils/controlCenterApiService'; // Export control center API service functions
export * from './utils/DcStatsApiService'; // Export DCStats API service functions
export * from './utils/vmRecommendationsApiService'; // Export VM recommendations API service functions
export * from './utils/observabilityApiService'; // Export observability API service functions
export * from './utils/observabilityEventsApiService'; // Export observability events/activity logs API service functions
export * from './utils/isoHardwareRevealService'; // Export ISO Hardware Reveal API service functions
export {
  buildCustomIso,
  getIsoJobStatus,
  getIsoList,
  mountIso,
} from './utils/isoHardwareRevealService'; // Explicitly export ISO service functions
export {
  formatMemorySize,
  formatSpeed,
  calculateTotalMemory,
  type HardwareInventory,
  type CPU,
  type MemoryModule as HardwareMemoryModule,
  type Memory,
  type Storage,
  type StorageDevice,
  type Network,
  type OperatingSystem,
  type PCIeSummary,
  type BiOS,
  type BiOSSettings,
  type BMC,
  type RackInfo,
  type SystemInfo,
} from './utils/hardwareInventoryService'; // Export Hardware Inventory API service functions with renamed MemoryModule

// Export custom hooks
export { useObservabilityEvents } from './hooks/useObservabilityEvents';
export { useObservabilityActivityLogs } from './hooks/useObservabilityActivityLogs';
export { useSidebarAPI } from './hooks/useSidebarAPI';
export { useSidebarState } from './hooks/useSidebarState';

// Export widgets
export { default as ActionButton } from './widgets/ActionButton';
export { default as Breadcrumb } from './widgets/Breadcrumb';
export { default as Button } from './widgets/Button';
export { default as Card } from './widgets/Card';
export { default as DataTable } from './widgets/DataTable';
export { default as ExpandableTable } from './widgets/ExpandableTable';
export { default as ErrorMessage } from './widgets/ErrorMessage';
export { default as Modal } from './widgets/Modal';
export { default as Pagination } from './widgets/Pagination';
export { default as PasswordModal } from './widgets/PasswordModal';
export { default as StatusCard } from './widgets/StatusCard';
export { default as StatsCard } from './widgets/StatsCard';
export { default as Tab } from './widgets/Tab';
export { default as Table } from './widgets/Table';
export { default as Tooltip } from './widgets/Tooltip';

//new iso
export {
  fetchDcIsoList,
  fetchDcCloudImages,
  uploadDcIso,
  downloadDcIso,
  deleteDcIso,
} from './utils/dcIsoApiService'; // Export DataCenter ISO API functions

// Export Stats API service functions

export * from './utils/storageCalculations'; // Export storage calculation utilities


// Export TypeScript types for action payloads
export type {
  AppAction,
  InventoryItem,
  ConfiguredNode,
  VmData,
  FirewallNotification,
} from './utils/reducer';
export type { AppState, ActivityLog } from './types/AppState.types';
export type {
  ScannedNode,
  InventoryNode,
  CredentialsData,
  ProvisionData,
} from './utils/controlCenterApiService';

// Export approval flow components
export { default as ApprovalModal } from './components/ApprovalModal';
export { useApprovalFlow } from './hooks/useApprovalFlow';

// Export widgets
export * from './widgets';

// Export sidebar-related services
export * from './services/vmOperationsService';
export * from './services/clusterManagementService';
export * from './services/sidebarStateService';
export * from './services/clusterEventsService';
