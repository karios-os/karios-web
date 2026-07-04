import { useState, useCallback } from 'react';

export type SidebarStateType = 'hidden' | 'small' | 'expanded';
export type ActiveSectionType = 'control-center' | 'clusters' | 'migrate' | 'licenses' | null;

export interface SidebarUIStateReturn {
  // UI State
  sidebarState: SidebarStateType;
  setSidebarState: (state: SidebarStateType) => void;
  expandedSection: string | null;
  setExpandedSection: (section: string | null) => void;
  isHoverZoneActive: boolean;
  setIsHoverZoneActive: (value: boolean) => void;
  isPinned: boolean;
  setIsPinned: (value: boolean) => void;
  activeSection: ActiveSectionType;
  setActiveSection: (section: ActiveSectionType) => void;
  showBothOptions: boolean;
  setShowBothOptions: (value: boolean) => void;
  lastActiveSection: 'control-center' | 'clusters' | 'migrate' | 'licenses';
  setLastActiveSection: (section: 'control-center' | 'clusters' | 'migrate' | 'licenses') => void;
  selectedCluster: string | null;
  setSelectedCluster: (cluster: string | null) => void;
  isTransitioning: boolean;
  setIsTransitioning: (value: boolean) => void;
  isRedirecting: boolean;
  setIsRedirecting: (value: boolean) => void;

  // Dropdown & Selection States
  dropdownVmName: string | null;
  setDropdownVmName: (name: string | null) => void;
  newServerDropdownSelected: string | boolean | null;
  setNewServerDropdownSelected: (value: string | boolean | null) => void;
  dropdownOpen: string | null;
  setDropdownOpen: (value: string | null) => void;
  isUserInitiatedVmClick: boolean;
  setIsUserInitiatedVmClick: (value: boolean) => void;

  // Loading States
  loadingServers: Record<string, boolean>;
  setLoadingServers: (
    state: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  refreshingVms: Record<string, boolean>;
  setRefreshingVms: (
    state: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  vmActionStatuses: Record<string, any>;
  setVmActionStatuses: (
    state: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)
  ) => void;

  // Cluster Loading States
  isLoadingClusters: boolean;
  setIsLoadingClusters: (value: boolean) => void;
  clusterError: string | null;
  setClusterError: (error: string | null) => void;
  loadingClusterVms: Record<string, boolean>;
  setLoadingClusterVms: (
    state: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;

  // Version States
  controlNodeVersion: string;
  setControlNodeVersion: (version: string) => void;
  isLoadingVersion: boolean;
  setIsLoadingVersion: (value: boolean) => void;
  hasUpdatesAvailable: boolean;
  setHasUpdatesAvailable: (value: boolean) => void;
  isLoadingUpdates: boolean;
  setIsLoadingUpdates: (value: boolean) => void;

  // Initialization & Tracking States
  isInitialized: boolean;
  setIsInitialized: (value: boolean) => void;
  isInitialPingCheck: boolean;
  setIsInitialPingCheck: (value: boolean) => void;
  initialPingInProgress: Set<string>;
  setInitialPingInProgress: (set: Set<string>) => void;
  manuallyClosedDatacenters: Set<string>;
  setManuallyClosedDatacenters: (set: Set<string>) => void;
  manuallyClosedServers: Set<string>;
  setManuallyClosedServers: (set: Set<string>) => void;

  // Cluster-related state
  expandedClusters: Record<string, boolean>;
  setExpandedClusters: (state: Record<string, boolean>) => void;
}

export function useSidebarUIState(): SidebarUIStateReturn {
  // Main UI State
  const [sidebarState, setSidebarState] = useState<SidebarStateType>('hidden');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isHoverZoneActive, setIsHoverZoneActive] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSectionType>(null);
  const [showBothOptions, setShowBothOptions] = useState(false);
  const [lastActiveSection, setLastActiveSection] = useState<
    'control-center' | 'clusters' | 'migrate' | 'licenses'
  >('control-center');
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Dropdown & Selection States
  const [dropdownVmName, setDropdownVmName] = useState<string | null>(null);
  const [newServerDropdownSelected, setNewServerDropdownSelected] = useState<
    string | boolean | null
  >(null);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [isUserInitiatedVmClick, setIsUserInitiatedVmClick] = useState(false);

  // Loading States
  const [loadingServers, setLoadingServers] = useState<Record<string, boolean>>({});
  const [refreshingVms, setRefreshingVms] = useState<Record<string, boolean>>({});
  const [vmActionStatuses, setVmActionStatuses] = useState<Record<string, any>>({});

  // Cluster Loading States
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [loadingClusterVms, setLoadingClusterVms] = useState<Record<string, boolean>>({});

  // Version States
  const [controlNodeVersion, setControlNodeVersion] = useState('1.1');
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const [hasUpdatesAvailable, setHasUpdatesAvailable] = useState(false);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);

  // Initialization & Tracking States
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitialPingCheck, setIsInitialPingCheck] = useState(false);
  const [initialPingInProgress, setInitialPingInProgress] = useState<Set<string>>(new Set());
  const [manuallyClosedDatacenters, setManuallyClosedDatacenters] = useState<Set<string>>(
    new Set()
  );
  const [manuallyClosedServers, setManuallyClosedServers] = useState<Set<string>>(new Set());

  // Cluster state
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});

  return {
    // Main UI State
    sidebarState,
    setSidebarState,
    expandedSection,
    setExpandedSection,
    isHoverZoneActive,
    setIsHoverZoneActive,
    isPinned,
    setIsPinned,
    activeSection,
    setActiveSection,
    showBothOptions,
    setShowBothOptions,
    lastActiveSection,
    setLastActiveSection,
    selectedCluster,
    setSelectedCluster,
    isTransitioning,
    setIsTransitioning,
    isRedirecting,
    setIsRedirecting,

    // Dropdown & Selection States
    dropdownVmName,
    setDropdownVmName,
    newServerDropdownSelected,
    setNewServerDropdownSelected,
    dropdownOpen,
    setDropdownOpen,
    isUserInitiatedVmClick,
    setIsUserInitiatedVmClick,

    // Loading States
    loadingServers,
    setLoadingServers,
    refreshingVms,
    setRefreshingVms,
    vmActionStatuses,
    setVmActionStatuses,

    // Cluster Loading States
    isLoadingClusters,
    setIsLoadingClusters,
    clusterError,
    setClusterError,
    loadingClusterVms,
    setLoadingClusterVms,

    // Version States
    controlNodeVersion,
    setControlNodeVersion,
    isLoadingVersion,
    setIsLoadingVersion,
    hasUpdatesAvailable,
    setHasUpdatesAvailable,
    isLoadingUpdates,
    setIsLoadingUpdates,

    // Initialization & Tracking States
    isInitialized,
    setIsInitialized,
    isInitialPingCheck,
    setIsInitialPingCheck,
    initialPingInProgress,
    setInitialPingInProgress,
    manuallyClosedDatacenters,
    setManuallyClosedDatacenters,
    manuallyClosedServers,
    setManuallyClosedServers,

    // Cluster state
    expandedClusters,
    setExpandedClusters,
  };
}
