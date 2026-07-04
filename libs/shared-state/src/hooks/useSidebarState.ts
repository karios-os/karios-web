/**
 * useSidebarState Hook
 * Consolidates all state management for the Sidebar component
 * Reduces SideBar.tsx complexity significantly
 */
import { useState, useCallback } from 'react';

export interface SidebarStateHook {
  // UI State
  sidebarState: 'hidden' | 'small' | 'expanded';
  setSidebarState: (state: 'hidden' | 'small' | 'expanded') => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
  activeSection: 'control-center' | 'clusters' | null;
  setActiveSection: (section: 'control-center' | 'clusters' | null) => void;
  showBothOptions: boolean;
  setShowBothOptions: (show: boolean) => void;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;

  // Dropdown/Expansion state
  openServers: Record<string, boolean>;
  setOpenServers: (servers: Record<string, boolean>) => void;
  openDataCenters: Record<string, boolean>;
  setOpenDataCenters: (dcs: Record<string, boolean>) => void;
  expandedClusters: Record<string, boolean>;
  setExpandedClusters: (clusters: Record<string, boolean>) => void;
  dropdownOpen: string | null;
  setDropdownOpen: (dropdown: string | null) => void;

  // Loading state
  loadingServers: Record<string, boolean>;
  setLoadingServers: (servers: Record<string, boolean>) => void;
  loadingClusterVms: Record<string, boolean>;
  setLoadingClusterVms: (vms: Record<string, boolean>) => void;
  isLoadingClusters: boolean;
  setIsLoadingClusters: (loading: boolean) => void;

  // Selection state
  selectedVm: any | null;
  setSelectedVm: (vm: any) => void;
  dropdownVmName: string | null;
  setDropdownVmName: (name: string | null) => void;
  refreshingVms: Record<string, boolean>;
  setRefreshingVms: (vms: Record<string, boolean>) => void;
  newServerDropdownSelected: boolean;
  setNewServerDropdownSelected: (selected: boolean) => void;

  // Modal state
  isRenameModalOpen: boolean;
  setIsRenameModalOpen: (open: boolean) => void;
  currentRenameVm: any | null;
  setCurrentRenameVm: (vm: any) => void;
  newVmName: string;
  setNewVmName: (name: string) => void;
  renameError: string;
  setRenameError: (error: string) => void;
  nameValidationError: string;
  setNameValidationError: (error: string) => void;

  isDeleteModalOpen: boolean;
  setIsDeleteModalOpen: (open: boolean) => void;
  currentDeleteVm: any | null;
  setCurrentDeleteVm: (vm: any) => void;
  isDeleting: boolean;
  setIsDeleting: (deleting: boolean) => void;

  isCloneModalOpen: boolean;
  setIsCloneModalOpen: (open: boolean) => void;
  cloneModalMode: string;
  setCloneModalMode: (mode: string) => void;
  currentCloneVm: any | null;
  setCurrentCloneVm: (vm: any) => void;
  newCloneVmName: string;
  setNewCloneVmName: (name: string) => void;
  pcieDevicesList: any[];
  setPcieDevicesList: (devices: any[]) => void;

  isActionModalOpen: boolean;
  setIsActionModalOpen: (open: boolean) => void;
  actionModalTitle: string;
  setActionModalTitle: (title: string) => void;
  actionModalMessage: string;
  setActionModalMessage: (message: string) => void;
  actionModalType: 'success' | 'error';
  setActionModalType: (type: 'success' | 'error') => void;

  // Cluster state
  clusterData: any;
  setClusterData: (data: any) => void;
  clusterError: string | null;
  setClusterError: (error: string | null) => void;
  clusterVmsData: Record<string, any>;
  setClusterVmsData: (data: Record<string, any>) => void;
  selectedCluster: string | null;
  setSelectedCluster: (cluster: string | null) => void;

  // Initialization and tracking
  isInitialized: boolean;
  setIsInitialized: (init: boolean) => void;
  manuallyClosedDatacenters: Set<string>;
  setManuallyClosedDatacenters: (dcs: Set<string>) => void;
  manuallyClosedServers: Set<string>;
  setManuallyClosedServers: (servers: Set<string>) => void;
  isInitialPingCheck: boolean;
  setIsInitialPingCheck: (check: boolean) => void;
  initialPingInProgress: Set<string>;
  setInitialPingInProgress: (servers: Set<string>) => void;

  // Helper methods
  toggleServerVisibility: (serverId: string) => void;
  toggleDataCenterVisibility: (dcId: string) => void;
  toggleClusterExpanded: (clusterName: string) => void;
}

export const useSidebarState = (): SidebarStateHook => {
  // UI State
  const [sidebarState, setSidebarState] = useState<'hidden' | 'small' | 'expanded'>('small');
  const [sidebarWidth, setSidebarWidth] = useState(176);
  const [isPinned, setIsPinned] = useState(false);
  const [activeSection, setActiveSection] = useState<'control-center' | 'clusters' | null>(null);
  const [showBothOptions, setShowBothOptions] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Dropdown/Expansion state
  const [openServers, setOpenServers] = useState<Record<string, boolean>>({});
  const [openDataCenters, setOpenDataCenters] = useState<Record<string, boolean>>({});
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  // Loading state
  const [loadingServers, setLoadingServers] = useState<Record<string, boolean>>({});
  const [loadingClusterVms, setLoadingClusterVms] = useState<Record<string, boolean>>({});
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);

  // Selection state
  const [selectedVm, setSelectedVm] = useState<any | null>(null);
  const [dropdownVmName, setDropdownVmName] = useState<string | null>(null);
  const [refreshingVms, setRefreshingVms] = useState<Record<string, boolean>>({});
  const [newServerDropdownSelected, setNewServerDropdownSelected] = useState(false);

  // Modal state
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [currentRenameVm, setCurrentRenameVm] = useState<any | null>(null);
  const [newVmName, setNewVmName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [nameValidationError, setNameValidationError] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentDeleteVm, setCurrentDeleteVm] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneModalMode, setCloneModalMode] = useState('');
  const [currentCloneVm, setCurrentCloneVm] = useState<any | null>(null);
  const [newCloneVmName, setNewCloneVmName] = useState('');
  const [pcieDevicesList, setPcieDevicesList] = useState<any[]>([]);

  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionModalTitle, setActionModalTitle] = useState('');
  const [actionModalMessage, setActionModalMessage] = useState('');
  const [actionModalType, setActionModalType] = useState<'success' | 'error'>('success');

  // Cluster state
  const [clusterData, setClusterData] = useState<any>(null);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [clusterVmsData, setClusterVmsData] = useState<Record<string, any>>({});
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);

  // Initialization and tracking
  const [isInitialized, setIsInitialized] = useState(false);
  const [manuallyClosedDatacenters, setManuallyClosedDatacenters] = useState<Set<string>>(
    new Set()
  );
  const [manuallyClosedServers, setManuallyClosedServers] = useState<Set<string>>(new Set());
  const [isInitialPingCheck, setIsInitialPingCheck] = useState(false);
  const [initialPingInProgress, setInitialPingInProgress] = useState<Set<string>>(new Set());

  // Helper methods
  const toggleServerVisibility = useCallback((serverId: string) => {
    setOpenServers((prev) => ({ ...prev, [serverId]: !prev[serverId] }));
  }, []);

  const toggleDataCenterVisibility = useCallback((dcId: string) => {
    setOpenDataCenters((prev) => ({ ...prev, [dcId]: !prev[dcId] }));
  }, []);

  const toggleClusterExpanded = useCallback((clusterName: string) => {
    setExpandedClusters((prev) => ({ ...prev, [clusterName]: !prev[clusterName] }));
  }, []);

  return {
    sidebarState,
    setSidebarState,
    sidebarWidth,
    setSidebarWidth,
    isPinned,
    setIsPinned,
    activeSection,
    setActiveSection,
    showBothOptions,
    setShowBothOptions,
    isResizing,
    setIsResizing,
    openServers,
    setOpenServers,
    openDataCenters,
    setOpenDataCenters,
    expandedClusters,
    setExpandedClusters,
    dropdownOpen,
    setDropdownOpen,
    loadingServers,
    setLoadingServers,
    loadingClusterVms,
    setLoadingClusterVms,
    isLoadingClusters,
    setIsLoadingClusters,
    selectedVm,
    setSelectedVm,
    dropdownVmName,
    setDropdownVmName,
    refreshingVms,
    setRefreshingVms,
    newServerDropdownSelected,
    setNewServerDropdownSelected,
    isRenameModalOpen,
    setIsRenameModalOpen,
    currentRenameVm,
    setCurrentRenameVm,
    newVmName,
    setNewVmName,
    renameError,
    setRenameError,
    nameValidationError,
    setNameValidationError,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    currentDeleteVm,
    setCurrentDeleteVm,
    isDeleting,
    setIsDeleting,
    isCloneModalOpen,
    setIsCloneModalOpen,
    cloneModalMode,
    setCloneModalMode,
    currentCloneVm,
    setCurrentCloneVm,
    newCloneVmName,
    setNewCloneVmName,
    pcieDevicesList,
    setPcieDevicesList,
    isActionModalOpen,
    setIsActionModalOpen,
    actionModalTitle,
    setActionModalTitle,
    actionModalMessage,
    setActionModalMessage,
    actionModalType,
    setActionModalType,
    clusterData,
    setClusterData,
    clusterError,
    setClusterError,
    clusterVmsData,
    setClusterVmsData,
    selectedCluster,
    setSelectedCluster,
    isInitialized,
    setIsInitialized,
    manuallyClosedDatacenters,
    setManuallyClosedDatacenters,
    manuallyClosedServers,
    setManuallyClosedServers,
    isInitialPingCheck,
    setIsInitialPingCheck,
    initialPingInProgress,
    setInitialPingInProgress,
    toggleServerVisibility,
    toggleDataCenterVisibility,
    toggleClusterExpanded,
  };
};

export default useSidebarState;
