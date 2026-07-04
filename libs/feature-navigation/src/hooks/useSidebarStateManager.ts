import { useState, useRef, useEffect } from 'react';
import { VirtualMachine, ServerNode, OpenServersState, NodeStatus } from '../SideBar-types';

export interface SidebarStateHookReturn {
  // Layout state
  sidebarState: 'hidden' | 'small' | 'expanded';
  setSidebarState: (state: 'hidden' | 'small' | 'expanded') => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  isHoverZoneActive: boolean;
  setIsHoverZoneActive: (active: boolean) => void;
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
  activeSection: 'control-center' | 'clusters' | null;
  setActiveSection: (section: 'control-center' | 'clusters' | null) => void;
  showBothOptions: boolean;
  setShowBothOptions: (show: boolean) => void;
  lastActiveSection: 'control-center' | 'clusters';
  setLastActiveSection: (section: 'control-center' | 'clusters') => void;
  isTransitioning: boolean;
  setIsTransitioning: (transitioning: boolean) => void;

  // Server state
  openServers: OpenServersState;
  setOpenServers: (state: OpenServersState) => void;
  loadingServers: Record<string, boolean>;
  setLoadingServers: (state: Record<string, boolean>) => void;
  manuallyClosedServers: Set<string>;
  setManuallyClosedServers: (state: Set<string>) => void;
  initialPingInProgress: Set<string>;
  setInitialPingInProgress: (state: Set<string>) => void;
  newServerDropdownSelected: string | boolean | null;
  setNewServerDropdownSelected: (value: string | boolean | null) => void;
  dropdownOpen: Record<string, boolean>;
  setDropdownOpen: (state: Record<string, boolean>) => void;

  // VM state
  selectedVm: VirtualMachine | null;
  setSelectedVm: (vm: VirtualMachine | null) => void;
  vmActionStatuses: Record<string, any>;
  setVmActionStatuses: (state: Record<string, any>) => void;
  dropdownVmName: string | null;
  setDropdownVmName: (name: string | null) => void;
  refreshingVms: Record<string, boolean>;
  setRefreshingVms: (state: Record<string, boolean>) => void;

  // Modal state
  isRenameModalOpen: boolean;
  setIsRenameModalOpen: (open: boolean) => void;
  currentRenameVm: VirtualMachine | null;
  setCurrentRenameVm: (vm: VirtualMachine | null) => void;
  currentServerIp: string | null;
  setCurrentServerIp: (ip: string | null) => void;
  newVmName: string;
  setNewVmName: (name: string) => void;
  nameValidationError: string | null;
  setNameValidationError: (error: string | null) => void;
  renameError: string | null;
  setRenameError: (error: string | null) => void;

  isDeleteModalOpen: boolean;
  setIsDeleteModalOpen: (open: boolean) => void;
  currentDeleteVm: VirtualMachine | null;
  setCurrentDeleteVm: (vm: VirtualMachine | null) => void;
  isDeleting: boolean;
  setIsDeleting: (deleting: boolean) => void;
  deleteButtonClicked: boolean;
  setDeleteButtonClicked: (clicked: boolean) => void;

  isCloneModalOpen: boolean;
  setIsCloneModalOpen: (open: boolean) => void;
  currentCloneVm: VirtualMachine | null;
  setCurrentCloneVm: (vm: VirtualMachine | null) => void;
  newCloneVmName: string;
  setNewCloneVmName: (name: string) => void;
  cloneModalMode: string;
  setCloneModalMode: (mode: string) => void;
  pcieDevicesList: string[];
  setPcieDevicesList: (devices: string[]) => void;
  cloneErrorMessage: string | null;
  setCloneErrorMessage: (error: string | null) => void;

  isActionModalOpen: boolean;
  setIsActionModalOpen: (open: boolean) => void;
  actionModalTitle: string;
  setActionModalTitle: (title: string) => void;
  actionModalMessage: string;
  setActionModalMessage: (message: string) => void;
  actionModalType: 'success' | 'error';
  setActionModalType: (type: 'success' | 'error') => void;

  // Cluster state
  selectedCluster: string | null;
  setSelectedCluster: (cluster: string | null) => void;
  expandedClusters: Record<string, boolean>;
  setExpandedClusters: (state: Record<string, boolean>) => void;
  isLoadingClusters: boolean;
  setIsLoadingClusters: (loading: boolean) => void;
  clusterError: string | null;
  setClusterError: (error: string | null) => void;
  clusterData: any;
  setClusterData: (data: any) => void;
  loadingClusterVms: Record<string, boolean>;
  setLoadingClusterVms: (state: Record<string, boolean>) => void;
  clusterVmsData: Record<string, any>;
  setClusterVmsData: (data: Record<string, any>) => void;

  // Version info state
  controlNodeVersion: string | null;
  setControlNodeVersion: (version: string | null) => void;
  isLoadingVersion: boolean;
  setIsLoadingVersion: (loading: boolean) => void;
  hasUpdatesAvailable: boolean;
  setHasUpdatesAvailable: (available: boolean) => void;
  isLoadingUpdates: boolean;
  setIsLoadingUpdates: (loading: boolean) => void;

  // Refs
  activeWebSocketsRef: React.MutableRefObject<Record<string, WebSocket>>;
  lastApiCallRef: React.MutableRefObject<number>;
  isRedirecting: boolean;
  setIsRedirecting: (redirecting: boolean) => void;
}

export const useSidebarStateManager = (): SidebarStateHookReturn => {
  // Layout state
  const [sidebarState, setSidebarState] = useState<'hidden' | 'small' | 'expanded'>('small');
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isHoverZoneActive, setIsHoverZoneActive] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [activeSection, setActiveSection] = useState<'control-center' | 'clusters' | null>(null);
  const [showBothOptions, setShowBothOptions] = useState(false);
  const [lastActiveSection, setLastActiveSection] = useState<'control-center' | 'clusters'>(
    'control-center'
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Server state
  const [openServers, setOpenServers] = useState<OpenServersState>({});
  const [loadingServers, setLoadingServers] = useState<Record<string, boolean>>({});
  const [manuallyClosedServers, setManuallyClosedServers] = useState<Set<string>>(new Set());
  const [initialPingInProgress, setInitialPingInProgress] = useState<Set<string>>(new Set());
  const [newServerDropdownSelected, setNewServerDropdownSelected] = useState<
    string | boolean | null
  >(null);
  const [dropdownOpen, setDropdownOpen] = useState<Record<string, boolean>>({});

  // VM state
  const [selectedVm, setSelectedVm] = useState<VirtualMachine | null>(null);
  const [vmActionStatuses, setVmActionStatuses] = useState<Record<string, any>>({});
  const [dropdownVmName, setDropdownVmName] = useState<string | null>(null);
  const [refreshingVms, setRefreshingVms] = useState<Record<string, boolean>>({});

  // Modal state
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [currentRenameVm, setCurrentRenameVm] = useState<VirtualMachine | null>(null);
  const [currentServerIp, setCurrentServerIp] = useState<string | null>(null);
  const [newVmName, setNewVmName] = useState('');
  const [nameValidationError, setNameValidationError] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentDeleteVm, setCurrentDeleteVm] = useState<VirtualMachine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteButtonClicked, setDeleteButtonClicked] = useState(false);

  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [currentCloneVm, setCurrentCloneVm] = useState<VirtualMachine | null>(null);
  const [newCloneVmName, setNewCloneVmName] = useState('');
  const [cloneModalMode, setCloneModalMode] = useState('input');
  const [pcieDevicesList, setPcieDevicesList] = useState<string[]>([]);
  const [cloneErrorMessage, setCloneErrorMessage] = useState<string | null>(null);

  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionModalTitle, setActionModalTitle] = useState('');
  const [actionModalMessage, setActionModalMessage] = useState('');
  const [actionModalType, setActionModalType] = useState<'success' | 'error'>('success');

  // Cluster state
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [clusterData, setClusterData] = useState<any>(null);
  const [loadingClusterVms, setLoadingClusterVms] = useState<Record<string, boolean>>({});
  const [clusterVmsData, setClusterVmsData] = useState<Record<string, any>>({});

  // Version info state
  const [controlNodeVersion, setControlNodeVersion] = useState<string | null>(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const [hasUpdatesAvailable, setHasUpdatesAvailable] = useState(false);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);

  // Refs
  const activeWebSocketsRef = useRef<Record<string, WebSocket>>({});
  const lastApiCallRef = useRef(0);
  const [isRedirecting, setIsRedirecting] = useState(false);

  return {
    // Layout
    sidebarState,
    setSidebarState,
    sidebarWidth,
    setSidebarWidth,
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
    isTransitioning,
    setIsTransitioning,
    // Server
    openServers,
    setOpenServers,
    loadingServers,
    setLoadingServers,
    manuallyClosedServers,
    setManuallyClosedServers,
    initialPingInProgress,
    setInitialPingInProgress,
    newServerDropdownSelected,
    setNewServerDropdownSelected,
    dropdownOpen,
    setDropdownOpen,
    // VM
    selectedVm,
    setSelectedVm,
    vmActionStatuses,
    setVmActionStatuses,
    dropdownVmName,
    setDropdownVmName,
    refreshingVms,
    setRefreshingVms,
    // Modal
    isRenameModalOpen,
    setIsRenameModalOpen,
    currentRenameVm,
    setCurrentRenameVm,
    currentServerIp,
    setCurrentServerIp,
    newVmName,
    setNewVmName,
    nameValidationError,
    setNameValidationError,
    renameError,
    setRenameError,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    currentDeleteVm,
    setCurrentDeleteVm,
    isDeleting,
    setIsDeleting,
    deleteButtonClicked,
    setDeleteButtonClicked,
    isCloneModalOpen,
    setIsCloneModalOpen,
    currentCloneVm,
    setCurrentCloneVm,
    newCloneVmName,
    setNewCloneVmName,
    cloneModalMode,
    setCloneModalMode,
    pcieDevicesList,
    setPcieDevicesList,
    cloneErrorMessage,
    setCloneErrorMessage,
    isActionModalOpen,
    setIsActionModalOpen,
    actionModalTitle,
    setActionModalTitle,
    actionModalMessage,
    setActionModalMessage,
    actionModalType,
    setActionModalType,
    // Cluster
    selectedCluster,
    setSelectedCluster,
    expandedClusters,
    setExpandedClusters,
    isLoadingClusters,
    setIsLoadingClusters,
    clusterError,
    setClusterError,
    clusterData,
    setClusterData,
    loadingClusterVms,
    setLoadingClusterVms,
    clusterVmsData,
    setClusterVmsData,
    // Version
    controlNodeVersion,
    setControlNodeVersion,
    isLoadingVersion,
    setIsLoadingVersion,
    hasUpdatesAvailable,
    setHasUpdatesAvailable,
    isLoadingUpdates,
    setIsLoadingUpdates,
    // Refs
    activeWebSocketsRef,
    lastApiCallRef,
    isRedirecting,
    setIsRedirecting,
  };
};
