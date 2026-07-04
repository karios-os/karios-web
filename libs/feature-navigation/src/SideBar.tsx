import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppState } from '@karios-monorepo/shared-state';
import { ActionTypes } from '../../shared-state/src/utils/actionTypes';
import { useApprovalFlow } from '../../shared-state/src/hooks/useApprovalFlow';
import { logger } from '../../shared-state/src/utils/logger';
import {
  setupVmListWebSocket,
  fetchVmListForNode,
} from '../../shared-state/src/utils/apiService';
import { useSidebarAPI } from '../../shared-state/src/hooks/useSidebarAPI';
import { toast } from 'react-toastify';
import {
  isClusterVM,
  getClusterName,
  getFullClusterName,
} from './utils/clusterUtilities';
import {
  isVmNameRestricted,
} from './utils/vmHandlers';
import { More } from 'iconsax-react';
import {
  SidebarIconBar,
  HoverZoneTrigger,
  LoadingState,
} from '../../shared-state/src/widgets';
import { RenameVMModal, DeleteVMModal, CloneVMModal, ActionResultModal } from './modals';
import {
  VirtualMachine,
  ServerNode,
  OpenServersState,
} from './SideBar-types';
import {
  ControlCenter,
  KubernetesSection,
  ResizeHandle,
  VMStatusIndicator,
  VMNameDisplay,
  VMActionsMenu,
  SidebarModals,
  VersionInfoBox,
} from './sidebar/components';
import {
  DataCenterHeader,
  ContentEmptyState,
  SidebarTabs,
} from './sidebar/components/shared';
import { useClusterOperations } from './hooks/useClusterOperations';
import { useServerOperations } from './hooks/useServerOperations';
import { useVMActions } from './hooks/useVMActions';
import { useVmStatus } from './hooks/useVmStatus';
import { useModalState } from './hooks/useModalState';
import { useMultiNodeWebSocket } from './hooks/useMultiNodeWebSocket';
import { useSidebarWidthState } from './hooks/useSidebarWidthState';
import { useSidebarUIState } from './hooks/useSidebarUIState';
import { useRedirection } from './hooks/useRedirection';
import { useSidebarStateManagement } from './hooks/useSidebarStateManagement';
import { useDatacenterHandlers } from './hooks/useDatacenterHandlers';

interface SideBarProps {
  onSidebarStateChange?: (state: 'hidden' | 'small' | 'expanded', width: number) => void;
}

export default function Sidebar({ onSidebarStateChange }: SideBarProps = {}) {
  const {
    state,
    dispatch,
    fetchVMs,
    fetchVMsForServer,
    performVmAction,
    performVmActionWebSocket,
    renameVmInContext,
    cloneVmInContext,
    checkNodeStatuses,
    openDataCenters,
  } = useAppState();

  // Import ALL API functions from centralized hook - called ONCE at component top level
  const {
    createConsole,
    checkVmPcieDevices,
    unlockVm: unlockVmApi,
    fetchClusterData: getClusterDataApi,
    refreshClusterData: refreshClusterDataApi,
    fetchClusterVMs: getClusterVmsApi,
  } = useSidebarAPI();

  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const activeWebSocketsRef = useRef<Record<string, WebSocket>>({});

  const {
    dataCenters, // This will still come from context, representing the available structure
    selectedVm,
    nodeStatuses,
    selectedVmDetails,
  } = state;

  // Initialize hooks for state management
  const {
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
    dropdownVmName,
    setDropdownVmName,
    newServerDropdownSelected,
    setNewServerDropdownSelected,
    dropdownOpen,
    setDropdownOpen,
    isUserInitiatedVmClick,
    setIsUserInitiatedVmClick,
    loadingServers,
    setLoadingServers,
    refreshingVms,
    setRefreshingVms,
    vmActionStatuses,
    setVmActionStatuses,
    isLoadingClusters,
    setIsLoadingClusters,
    clusterError,
    setClusterError,
    loadingClusterVms,
    setLoadingClusterVms,
    controlNodeVersion,
    setControlNodeVersion,
    isLoadingVersion,
    setIsLoadingVersion,
    hasUpdatesAvailable,
    setHasUpdatesAvailable,
    isLoadingUpdates,
    setIsLoadingUpdates,
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
    expandedClusters,
    setExpandedClusters,
  } = useSidebarUIState();

  const {
    sidebarWidth,
    setSidebarWidth,
    resetRequested,
    setResetRequested,
    windowWidth,
    setWindowWidth,
    GAP_SIZE,
    resetWidth,
    calculateEffectiveWidth,
  } = useSidebarWidthState();

  // Track openServers state - must be before useDatacenterHandlers
  const [openServers, setOpenServers] = useState<OpenServersState>({});

  // Track the current tab within Control Center (Nodes or VMs)
  const [controlCenterTab, setControlCenterTab] = useState<'nodes' | 'vms'>('nodes');

  // Track search input for filtering nodes and VMs
  const [searchTerm, setSearchTerm] = useState('');

  // Migration workflow state
  const [migrationCurrentStep, setMigrationCurrentStep] = useState<
    'connection' | 'nodes' | 'vms' | 'target'
  >('connection');
  const [migrationSelectedNode, setMigrationSelectedNode] = useState<any>(null);
  const [migrationSelectedVMs, setMigrationSelectedVMs] = useState<any[]>([]);

  // Track VMs list from WebSocket for the VMs tab
  const [vmsList, setVmsList] = useState<VirtualMachine[]>([]);
  const [isLoadingVmsList, setIsLoadingVmsList] = useState(false);

  const {
    isRenameModalOpen,
    currentRenameVm,
    currentServerIp,
    newVmName,
    renameError,
    nameValidationError,
    setIsRenameModalOpen,
    setCurrentRenameVm,
    setCurrentServerIp,
    setNewVmName,
    setRenameError,
    setNameValidationError,
    resetRenameModal,
    isDeleteModalOpen,
    currentDeleteVm,
    isDeleting,
    deleteButtonClicked,
    setIsDeleteModalOpen,
    setCurrentDeleteVm,
    setIsDeleting,
    setDeleteButtonClicked,
    resetDeleteModal,
    isCloneModalOpen,
    cloneModalMode,
    cloneErrorMessage,
    newCloneVmName,
    currentCloneVm,
    pcieDevicesList,
    setIsCloneModalOpen,
    setCloneModalMode,
    setCloneErrorMessage,
    setNewCloneVmName,
    setCurrentCloneVm,
    setPcieDevicesList,
    resetCloneModal,
    isActionModalOpen,
    actionModalTitle,
    actionModalMessage,
    actionModalType,
    setIsActionModalOpen,
    setActionModalTitle,
    setActionModalMessage,
    setActionModalType,
    resetActionModal,
    resetAllModals,
  } = useModalState();

  // Calculate effective width before using in updateSidebarState
  const { updateSidebarState, hideSidebar } = useSidebarStateManagement(
    sidebarState,
    setSidebarState,
    setResetRequested,
    setIsPinned,
    setActiveSection,
    setShowBothOptions,
    calculateEffectiveWidth,
    onSidebarStateChange
  );

  const {
    redirectToK8sProvisioning,
    redirectToControlCenter,
    redirectTimeoutRef,
    cleanupRedirectTimeout,
  } = useRedirection(
    isRedirecting,
    setIsRedirecting,
    setActiveSection,
    setIsPinned,
    updateSidebarState
  );

  const { handleDcClick, handleSidebarHeaderClick, handleToggleDatacenterVisibility } =
    useDatacenterHandlers(
      sidebarState,
      updateSidebarState,
      dispatch,
      navigate,
      dataCenters,
      openDataCenters,
      openServers,
      setNewServerDropdownSelected,
      setOpenServers,
      setManuallyClosedDatacenters
    );

  // Cleanup effect for WebSocket connections
  useEffect(() => {
    return () => {
      Object.values(activeWebSocketsRef.current).forEach((ws) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      activeWebSocketsRef.current = {};
    };
  }, []);

  // Cluster-related state
  const [clusterData, setClusterData] = useState<any>(null);
  const clusterDataRef = useRef<any>(null);

  const updateClusterDataIfChanged = (newData: any) => {
    const currentDataString = JSON.stringify(clusterDataRef.current);
    const newDataString = JSON.stringify(newData);
    if (currentDataString !== newDataString) {
      clusterDataRef.current = newData;
      setClusterData(newData);
    }
  };

  const [clusterVmsData, setClusterVmsData] = useState<Record<string, any>>({});

  // WebSocket connection for real-time VM state updates - Using useMultiNodeWebSocket
  const token = localStorage.getItem('accessToken') || '';

  // Extract all unique nodeIps from cluster data for WebSocket connections
  const allNodeIps = useMemo(() => {
    const nodeIpsSet = new Set<string>();

    // Add all node IPs from cluster data
    if (clusterData?.clusters) {
      clusterData.clusters.forEach((cluster: any) => {
        if (cluster?.vms && Array.isArray(cluster.vms)) {
          cluster.vms.forEach((vm: any) => {
            if (vm.nodeIp) {
              nodeIpsSet.add(vm.nodeIp);
            }
          });
        }
      });
    }

    // Also include the default server IP as a fallback
    const defaultServerIp =
      dataCenters?.[0]?.servers?.[0]?.fqdn || dataCenters?.[0]?.servers?.[0]?.ip;
    if (defaultServerIp) {
      nodeIpsSet.add(defaultServerIp);
    }

    const nodeIpArray = Array.from(nodeIpsSet);
    logger.info(
      `[SideBar] Extracted ${nodeIpArray.length} unique node IPs for WebSocket connections:`,
      nodeIpArray
    );
    return nodeIpArray;
  }, [clusterData, dataCenters]);

  // Multi-node WebSocket connection for all VM updates
  const {
    vmStates: wsVmStatesMap,
    isConnected: wsIsConnected,
    errors: wsErrors,
  } = useMultiNodeWebSocket(
    allNodeIps,
    token,
    true // Always enabled
  );

  // Get the server IP for the expanded cluster
  const getExpandedClusterServerIp = (): string | null => {
    const expandedClusterNames = Object.keys(expandedClusters).filter(
      (key) => expandedClusters[key]
    );
    if (expandedClusterNames.length === 0) return null;

    const clusterName = expandedClusterNames[0];
    const clusterVMs = clusterVmsData[clusterName];

    // Try to get server IP from the first VM in the cluster
    if (clusterVMs?.vms && clusterVMs.vms.length > 0) {
      const firstVm = clusterVMs.vms[0];
      if (firstVm.nodeIp) {
        // Get the actual server FQDN or IP from dataCenters
        const server = dataCenters
          ?.flatMap((dc) => dc.servers || [])
          .find((s) => s.ip === firstVm.nodeIp);
        return server?.fqdn || server?.ip || firstVm.nodeIp;
      }
    }

    // Fallback: try to find any server from cluster data
    if (clusterData?.clusters) {
      const cluster = clusterData.clusters.find(
        (c) => c.KubernetesClusterName === clusterName || c.name === clusterName
      );
      if (cluster?.vms && cluster.vms.length > 0) {
        const firstVm = cluster.vms[0];
        if (firstVm.nodeIp) {
          const server = dataCenters
            ?.flatMap((dc) => dc.servers || [])
            .find((s) => s.ip === firstVm.nodeIp);
          return server?.fqdn || server?.ip || firstVm.nodeIp;
        }
      }
    }

    return null;
  };

  const { executeWithApproval, isModalOpen, modalProps, requiresApproval } = useApprovalFlow();

  // Initialize VM Status Hook for color and transition status
  const { getVmStatusColor, isVmInAnyTransition } = useVmStatus({
    refreshingVms,
    vmActionStatuses,
    setVmActionStatuses,
  });

  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastApiCallRef = useRef<number>(0);
  const API_CALL_DEBOUNCE_MS = 1000; // Prevent API calls within 1 second of each other

  // Track if we've successfully fetched cluster data to prevent repeated calls
  const hasInitialClusterDataRef = useRef<boolean>(false);

  // Track if VMs WebSocket has been set up to prevent duplicate connections
  const vmsWebSocketSetupRef = useRef<boolean>(false);

  // Track VMs WebSocket connections to close them when switching tabs
  const vmsWebSocketsRef = useRef<WebSocket[]>([]);

  // Add debounce for section switching to prevent rapid clicking issues
  const lastSectionSwitchRef = useRef<number>(0);
  const SECTION_SWITCH_DEBOUNCE_MS = 300; // Prevent section switches within 300ms of each other

  // Notify parent when activeSection or showBothOptions changes (affects width calculation)
  useEffect(() => {
    if (onSidebarStateChange && sidebarState === 'expanded') {
      onSidebarStateChange(sidebarState, calculateEffectiveWidth(sidebarState));
    }
  }, [activeSection, showBothOptions, onSidebarStateChange, sidebarState, calculateEffectiveWidth]);

  // Cluster utility functions have been moved to clusterUtilities.ts and imported above
  // Using: isClusterVM, getClusterPrefix, getClusterName, getFullClusterName, checkIsLastClusterVM, getClusterVMs

  // Cleanup redirect timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [cleanupRedirectTimeout]);

  // Smart navigation after VM deletion - see vmHandlers.ts for implementation logic
  const handleSmartNavigationAfterVmDelete = useCallback(
    async (deletedVm: VirtualMachine, isLastVmInCluster: boolean) => {
      if (activeSection !== 'clusters' || !isClusterVM(deletedVm.name)) {
        navigate('/');
        return;
      }

      const clusterName = getFullClusterName(deletedVm.name);

      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const clusterData = await refreshClusterData(true);

        if (!clusterData || !clusterData.clusters) {
          navigate('/');
          return;
        }

        const clusters = clusterData.clusters || [];
        const currentCluster = clusters.find((c) => c.KubernetesClusterName === clusterName);

        if (currentCluster && currentCluster.vms && currentCluster.vms.length > 0) {
          const firstVm = currentCluster.vms[0];
          const targetServer = state.dataCenters
            .flatMap((dc) => dc.servers)
            .find((server) => server.ip === firstVm.nodeIp);

          if (targetServer) {
            dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: { name: firstVm.vmName } });
            dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: targetServer });
            navigate(`/server/${firstVm.nodeIp}/vm/${firstVm.vmName}`);
          } else {
            navigate(`/cluster/${clusterName}/details`);
          }
        } else if (clusters.length > 0) {
          const nextCluster = clusters[0];
          navigate(`/cluster/${nextCluster.KubernetesClusterName}/details`);
        } else {
          redirectToK8sProvisioning('No clusters remaining after VM deletion');
        }
      } catch (error) {
        logger.error('Error during smart navigation:', error);
        if (clusterName) {
          navigate(`/cluster/${clusterName}/details`);
        } else {
          navigate('/');
        }
      }
    },
    [activeSection, navigate, state.dataCenters, dispatch, redirectToK8sProvisioning]
  );

  // Helper functions imported from vmHandlers.ts: sortClusterVMs, isVmNameRestricted

  // Helper function to render a single VM item using new components
  const renderVMItem = (vm: VirtualMachine, server: any, extraClassName = '') => {
    const isSelected = selectedVm?.name === vm.name;

    // Get the real-time VM state from WebSocket data (wsVmStatesMap) if available
    const realtimeVmState = wsVmStatesMap?.[vm.name]?.state || vm.state;

    // Pre-compute transition status using local state for immediate feedback
    const isInTransition = isVmInAnyTransition(vm.name, realtimeVmState);
    const isRestricted = isVmNameRestricted(vm.name);
    const isVip = vm.name.includes('-vip');
    const isDisabled = isInTransition || isRestricted || isVip;

    // Create updated VM object with real-time state for child components
    const updatedVm = {
      ...vm,
      state: realtimeVmState,
    };

    return (
      <div
        key={vm.name}
        className={`flex items-center justify-between px-2 py-1 sm:py-1.5 rounded border-l-3 transition-colors ${
          isSelected ? 'bg-blue-50 text-karios-blue border-l-blue-600' : 'border-l-transparent'
        } ${extraClassName}`}
      >
        <div
          className={`flex items-center gap-1 sm:gap-2 flex-grow ${isVip ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} min-w-0`}
          onClick={() => !isVip && handleVmClick(vm, server)}
          title={isVip ? 'VIP VMs are read-only' : undefined}
        >
          <VMStatusIndicator
            vm={updatedVm}
            isInTransition={isInTransition}
            getVmStatusColor={getVmStatusColor}
          />
          <div className="truncate" title={vm.name}>
            <VMNameDisplay vm={updatedVm} isSelected={isSelected} />
          </div>
        </div>

        <div
          className="relative flex items-center gap-1"
          ref={dropdownVmName === vm.name ? dropdownRef : null}
          key={vm.name}
        >
          {/* Navigate to node homepage */}
          {vm.hostname && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const hostnamePart = vm.hostname.split('.')[0];
                navigate(`/server/${hostnamePart}/home`);
              }}
              title="Go to Node Homepage"
              className="cursor-pointer w-4 h-4 hover:text-blue-600 transition-colors"
              data-testid={`nav-icon-${vm.name}`}
            ></button>
          )}

          <More
            key={`vm-menu-icon-${vm.name}`}
            className={`cursor-pointer w-4 h-4 ${
              isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600'
            }`}
            color={isDisabled ? '#9CA3AF' : '#718096'}
            variant="Outline"
            style={{ transform: 'rotate(90deg)' }}
            data-testid={`more-icon-${vm.name}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!isDisabled) {
                toggleVmDropdown(vm.name);
              }
            }}
          />
          {dropdownVmName === vm.name && !isRestricted && !isVip && (
            <VMActionsMenu
              key={`vm-actions-menu-${vm.name}`}
              vm={updatedVm}
              isInTransition={isInTransition}
              onUnlock={(vmName) => hookHandleUnlockVm(vmName, server.fqdn?.trim() || server.ip)}
              onTogglePower={(vmName, isOn) => {
                const serverAddress = server.fqdn?.trim() || server.ip;
                hookHandleToggleVmPower(vmName, isOn, serverAddress, vm.uuid);
              }}
              onRename={(vmToRename) =>
                hookHandleRenameVm(vmToRename, server.fqdn?.trim() || server.ip)
              }
              // onClone={(vmToClone) => hookHandleCloneVm(vmToClone, server.fqdn?.trim() || server.ip)} // DISABLED
              onRestart={(vmName) =>
                hookHandleRestartVm(vmName, server.fqdn?.trim() || server.ip, vm.uuid)
              }
              onReset={(vmName) =>
                hookHandleResetVm(vmName, server.fqdn?.trim() || server.ip, vm.uuid)
              }
              onPowerOff={(vmName) =>
                hookHandlePowerOffVm(vmName, server.fqdn?.trim() || server.ip, vm.uuid)
              }
              onDelete={(vmToDelete) =>
                hookHandleDeleteVm(vmToDelete, server.fqdn?.trim() || server.ip)
              }
            />
          )}
        </div>
      </div>
    );
  };

  // Effect to prevent automatic VM navigation during migration conflicts
  useEffect(() => {
    // If a VM selection happens without user initiation, check if it's due to migration
    if (!isUserInitiatedVmClick && selectedVm) {
      const currentPath = location.pathname;

      // If we're already on a VM hardware page and a different VM is selected
      if (currentPath.includes('/hardware') && !currentPath.includes(`/vm/${selectedVm.name}/`)) {
        // Find the VM name from current path
        const currentVmMatch = currentPath.match(/\/vm\/([^/]+)\//);
        if (currentVmMatch) {
          const currentVmName = currentVmMatch[1];

          // Find the current VM and server to restore selection
          for (const dc of dataCenters) {
            for (const server of dc.servers) {
              const currentVm = server.vms?.find((vm) => vm.name === currentVmName);
              if (currentVm) {
                // Restore the original VM selection without navigation
                dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: currentVm });
                dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: server });
                return;
              }
            }
          }
        }
      }
    }
  }, [selectedVm, isUserInitiatedVmClick, location.pathname, dataCenters, dispatch]);

  // Fetch VMs once when component mounts
  useEffect(() => {
    fetchVMs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs only once on mount

  // Initialize open states when dataCenters are loaded
  useEffect(() => {
    if (dataCenters && dataCenters.length > 0 && !isInitialized) {
      // By default open the first datacenter
      const initialOpenDCs: Record<string, boolean> = {};
      const initialOpenServers: Record<string, boolean> = {};

      // Open first datacenter by default
      if (dataCenters[0]) {
        initialOpenDCs[dataCenters[0].id] = true;
      }

      // For global openDataCenters, we can dispatch actions to update it
      if (Object.keys(openDataCenters || {}).length === 0) {
        // Set all initialOpenDCs to true in global state
        Object.keys(initialOpenDCs).forEach((dcId) => {
          dispatch({ type: ActionTypes.TOGGLE_DATACENTER_VISIBILITY, payload: dcId });
        });
      }

      if (Object.keys(openServers).length === 0) {
        setOpenServers(initialOpenServers);
      }

      // Mark as initialized to prevent re-initialization
      setIsInitialized(true);
    }
  }, [dataCenters, openDataCenters, dispatch, isInitialized]);

  // Fetch node statuses periodically - using useCallback to prevent infinite loop
  const memoizedCheckStatus = React.useCallback(() => {
    // Don't run periodic checks during initial ping check to avoid conflicts
    if (dataCenters && dataCenters.length > 0 && !isInitialPingCheck) {
      checkNodeStatuses();
    }
  }, [dataCenters, checkNodeStatuses, isInitialPingCheck]);

  useEffect(() => {
    if (dataCenters && dataCenters.length > 0) {
      // Check if we're on a VM details page (should pause auto-refresh)
      const isOnVmDetailsPage =
        location.pathname.includes('/vm/') &&
        (location.pathname.includes('/summary') ||
          location.pathname.includes('/hardware') ||
          location.pathname.includes('/console') ||
          location.pathname.includes('/snapshots') ||
          location.pathname.includes('/activity-logs') ||
          location.pathname.includes('/options'));

      // Only start periodic checks if not in initial ping check and not on VM details page
      if (!isInitialPingCheck && !isOnVmDetailsPage) {
        // Start 5-second polling for live server status updates
        const intervalId = setInterval(memoizedCheckStatus, 5000);
        return () => {
          clearInterval(intervalId);
        };
      }
    }
    return undefined;
  }, [memoizedCheckStatus, isInitialPingCheck, location.pathname]); // Added location.pathname to dependencies

  // Fetch cluster data when switching to clusters section (with debouncing)
  useEffect(() => {
    // Only fetch if:
    // 1. We're in the clusters section
    // 2. We don't have cluster data yet
    // 3. We're not currently loading
    // 4. There's no error
    // 5. Enough time has passed since the last API call (debounce)
    // 6. We haven't already successfully fetched initial data
    if (
      activeSection === 'clusters' &&
      !clusterData &&
      !isLoadingClusters &&
      !clusterError &&
      !hasInitialClusterDataRef.current
    ) {
      const now = Date.now();
      if (now - lastApiCallRef.current < API_CALL_DEBOUNCE_MS) {
        return;
      }
      lastApiCallRef.current = now;

      fetchClusterData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, clusterData, isLoadingClusters, clusterError]); // fetchClusterData is stable

  // Monitor URL changes to refresh cluster data when returning from K8s setup (with debouncing)
  useEffect(() => {
    const currentPath = location.pathname;

    // Only refresh if:
    // 1. We're on the home page
    // 2. We're in the clusters section
    // 3. We don't have a cluster in the path (not on cluster details)
    // 4. Enough time has passed since the last API call (debounce)
    if (currentPath === '/' && activeSection === 'clusters') {
      const now = Date.now();
      if (now - lastApiCallRef.current < API_CALL_DEBOUNCE_MS) {
        return;
      }
      lastApiCallRef.current = now;

      refreshClusterData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, activeSection]); // refreshClusterData is stable

  // Auto-switch sidebar to correct section when navigating to different pages
  useEffect(() => {
    const currentPath = location.pathname;

    // Don't auto-switch if we're in migrate or licenses sections
    if (activeSection === 'migrate' || activeSection === 'licenses') {
      return;
    }

    // Check if we're on a datacenter page (Control Center)
    if (currentPath.startsWith('/dc/') && currentPath.includes('/control-center')) {
      // Automatically switch to control-center section and expand sidebar
      if (activeSection !== 'control-center') {
        setLastActiveSection('control-center');
        setActiveSection('control-center');
        setIsPinned(true);
        updateSidebarState('expanded');
      }
    }
    // Check if we're on a cluster details page, K8s provisioning page, Kubernetes dashboard, OR distribution detail page
    else if (
      (currentPath.startsWith('/cluster/') && currentPath.includes('/details')) ||
      currentPath === '/k8s-provisioning' ||
      currentPath.startsWith('/kubernetes-dashboard')
    ) {
      // Automatically switch to clusters section and expand sidebar
      if (activeSection !== 'clusters') {
        setLastActiveSection('clusters');
        setActiveSection('clusters');
        setIsPinned(true);
        updateSidebarState('expanded');

        // Only fetch cluster data if:
        // 1. We're on a cluster details page (not provisioning)
        // 2. We don't have cluster data yet
        // 3. We're not currently loading
        // 4. There's no error
        // 5. Enough time has passed since the last API call (debounce)
        // 6. We haven't already successfully fetched initial data
        if (
          currentPath.startsWith('/cluster/') &&
          !clusterData &&
          !isLoadingClusters &&
          !clusterError &&
          !hasInitialClusterDataRef.current
        ) {
          const now = Date.now();
          if (now - lastApiCallRef.current >= API_CALL_DEBOUNCE_MS) {
            lastApiCallRef.current = now;
            fetchClusterData();
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, activeSection, clusterData, isLoadingClusters, clusterError]); // fetchClusterData is stable


  // Cleanup WebSocket connections when component unmounts
  useEffect(() => {
    return () => {
      // Close all active WebSocket connections on component unmount
      Object.entries(activeWebSocketsRef.current).forEach(([_serverId, ws]) => {
        ws.close();
      });
      activeWebSocketsRef.current = {};
    };
  }, []);

  // Clear local loading state when VMs are loaded via WebSocket
  useEffect(() => {
    if (dataCenters && dataCenters.length > 0) {
      dataCenters.forEach((dc) => {
        dc.servers.forEach((server) => {
          // If server has VMs and we were tracking it as loading, clear the loading state
          if (server.vms && server.vms.length > 0 && loadingServers[server.id]) {
            setLoadingServers((prev) => {
              const updated = { ...prev };
              delete updated[server.id];
              return updated;
            });
          }
          // Also clear loading state if server is open but has no VMs (empty VM list received)
          else if (
            openServers[server.id] &&
            server.vms !== undefined &&
            server.vms.length === 0 &&
            loadingServers[server.id]
          ) {
            setLoadingServers((prev) => {
              const updated = { ...prev };
              delete updated[server.id];
              return updated;
            });
          }
        });
      });
    }
  }, [dataCenters, loadingServers, openServers]);

  // handleServerClick: Removed - now imported from useServerOperations hook as hookHandleServerClick
  // See: useServerOperations hook initialization at end of component

  const handleVmClick = async (vm: VirtualMachine, server: ServerNode) => {
    // Mark this as a user-initiated click to prevent automatic navigation conflicts
    setIsUserInitiatedVmClick(true);

    // Reset the new server dropdown selected state since we're selecting a VM
    setNewServerDropdownSelected(false);

    // Dispatch VM selection action
    dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: vm });

    // Make sure the server containing this VM is the only one open
    // Use server.id consistently for the key
    if (server && server.id) {
      // Set this as the only open server
      const updatedOpenServers = { [server.id]: true };
      setOpenServers(updatedOpenServers);
    }

    // Find the enriched server object from dataCenters
    let enrichedServer = null;
    for (const dc of dataCenters) {
      const found = dc.servers.find((s) => s.id === server.id);
      if (found) {
        enrichedServer = found;
        break;
      }
    }

    if (!enrichedServer) {
      enrichedServer = server; // fallback to basic server
    }

    // Dispatch server selection action with enriched server
    dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: enrichedServer });

    // Fetch VMs for the server if not already loaded
    if (!server.vms || server.vms.length === 0) {
      fetchVMsForServer(server);
    }

    // Navigate to VM page with new route structure: server/{serverName}/vm/{vmName}/hardware
    // Note: Sidebar state is maintained so user can easily navigate between VMs
    navigate(`/server/${server.name}/vm/${vm.name}/hardware`);

    // Reset the flag after a short delay to allow for subsequent automatic updates
    setTimeout(() => {
      setIsUserInitiatedVmClick(false);
    }, 1000);
  };

  // toggleServerVisibility: Removed - now imported from useServerOperations hook as hookToggleServerVisibility
  // See: useServerOperations hook initialization at end of component

  const toggleVmDropdown = (vmName: string) => {
    setDropdownVmName(dropdownVmName === vmName ? null : vmName);
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownVmName(null);
      }

      const target = event.target as HTMLElement;
      const isDropdownButton = target.closest('[data-dropdown-button]');
      const isDropdownMenu = target.closest('[data-dropdown-menu]');

      if (!isDropdownButton && !isDropdownMenu) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Effect to open the correct server dropdown based on URL
  useEffect(() => {
    if (dataCenters && dataCenters.length > 0) {
      const pathParts = location.pathname.split('/');
      const serverNameFromUrl = pathParts.includes('server')
        ? pathParts[pathParts.indexOf('server') + 1]
        : null;

      if (serverNameFromUrl) {
        const server = dataCenters
          .flatMap((dc) => dc.servers)
          .find((s) => s.name === serverNameFromUrl);

        if (server) {
          const hasOpenServers = Object.values(openServers).some((isOpen) => isOpen);

          if (
            !hasOpenServers &&
            !manuallyClosedServers.has(server.id) &&
            !newServerDropdownSelected
          ) {
            setOpenServers({ [server.id]: true });

            if (!server.vms || server.vms.length === 0) {
              (async () => {
                try {
                  setLoadingServers((prev) => ({ ...prev, [server.id]: true }));
                  await fetchVMsForServer(server);
                } catch (error) {
                  logger.error(`Error fetching VMs for server ${server.name} on page load:`, error);
                } finally {
                  setLoadingServers((prev) => ({ ...prev, [server.id]: false }));
                }
              })();
            }
          }

          const parentDc = dataCenters.find((dc) => dc.servers.some((s) => s.id === server.id));
          if (
            parentDc &&
            (!openDataCenters || !openDataCenters[parentDc.id]) &&
            !manuallyClosedDatacenters.has(parentDc.id)
          ) {
            dispatch({ type: ActionTypes.TOGGLE_DATACENTER_VISIBILITY, payload: parentDc.id });
          }
        }
      }
    }
  }, [
    location.pathname,
    dataCenters,
    dispatch,
    manuallyClosedDatacenters,
    manuallyClosedServers,
    newServerDropdownSelected,
    fetchVMsForServer,
  ]);
  // Helper function to check if VM should be highlighted based on URL
  const shouldHighlightVmFromUrl = (server: ServerNode, vm: VirtualMachine): boolean => {
    const pathParts = location.pathname.split('/');
    const serverNameFromUrl = pathParts.includes('server')
      ? pathParts[pathParts.indexOf('server') + 1]
      : null;
    const vmNameFromUrl = pathParts.includes('vm') ? pathParts[pathParts.indexOf('vm') + 1] : null;

    return server.name === serverNameFromUrl && vm.name === vmNameFromUrl;
  };

  // Effect to reset newServerDropdownSelected when navigating away from server pages
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const hasServerInPath = pathParts.includes('server');

    // If not on a server page, reset the flags and clear manually closed tracking
    if (!hasServerInPath) {
      setNewServerDropdownSelected(false);
      setManuallyClosedDatacenters(new Set()); // Reset manual close tracking
      setManuallyClosedServers(new Set()); // Reset manual close tracking for servers
    }
  }, [location.pathname]);

  // Function to perform initial ping check during login
  const performInitialPingCheck = React.useCallback(async () => {
    if (!dataCenters || dataCenters.length === 0 || isInitialPingCheck) return;

    setIsInitialPingCheck(true);
    const serversToCheck = dataCenters.flatMap((dc) => dc.servers || []);

    if (serversToCheck.length === 0) {
      setIsInitialPingCheck(false);
      return;
    }

    // Set all servers to pinging state
    const serverIds = serversToCheck.map((server) => server.id || server.ip);
    setInitialPingInProgress(new Set(serverIds));

    try {
      // Call the existing checkNodeStatuses function which will update nodeStatuses
      await checkNodeStatuses();
    } catch (error) {
      logger.error('Error during initial ping check:', error);
      // Clear pinging state on error
      setInitialPingInProgress(new Set());
      setIsInitialPingCheck(false);
    }
    // Note: We don't clear the pinging state here - it will be cleared when nodeStatuses updates
  }, [dataCenters, checkNodeStatuses, isInitialPingCheck]);

  // Clear initial ping state when node statuses are updated
  useEffect(() => {
    if (isInitialPingCheck && nodeStatuses && Object.keys(nodeStatuses).length > 0) {
      // Check if we have status for all servers that were in initial ping
      const hasAllStatuses = Array.from(initialPingInProgress).every((serverId) => {
        const hasStatus = Object.prototype.hasOwnProperty.call(nodeStatuses, serverId);
        return hasStatus;
      });

      if (hasAllStatuses) {
        // Clear the pinging state since we have all the results
        setInitialPingInProgress(new Set());
        setIsInitialPingCheck(false);
      }
    }
  }, [nodeStatuses, isInitialPingCheck, initialPingInProgress]);

  // Add fallback timeout to clear loading state if ping responses take too long
  useEffect(() => {
    if (isInitialPingCheck && initialPingInProgress.size > 0) {
      const timeoutId = setTimeout(() => {
        setInitialPingInProgress(new Set());
        setIsInitialPingCheck(false);
      }, 10000); // 10 second fallback timeout

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isInitialPingCheck, initialPingInProgress]);

  // Trigger initial ping check when dataCenters are first loaded (login scenario)
  useEffect(() => {
    if (
      dataCenters &&
      dataCenters.length > 0 &&
      !isInitialPingCheck &&
      Object.keys(nodeStatuses || {}).length === 0
    ) {
      // Only trigger if we don't have node statuses yet (indicating fresh login)
      performInitialPingCheck();
    }
  }, [dataCenters, performInitialPingCheck, nodeStatuses, isInitialPingCheck]);

  // Function to fetch cluster data from API
  const fetchClusterData = async () => {
    if (isLoadingClusters) return;

    setIsLoadingClusters(true);
    setClusterError(null);

    try {
      // Use API function reference from hook (hook called at component top level above)
      const data = await getClusterDataApi();

      // Check if the response contains an error message
      if (data && data.error) {
        // Set empty cluster data instead of treating it as an error
        updateClusterDataIfChanged({ clusters: [], error: data.error });

        // If no clusters available and we're in clusters view, redirect to K8s provisioning
        if (activeSection === 'clusters' && !isRedirecting) {
          redirectToK8sProvisioning('No clusters available during initial fetch');
        }
        return;
      }

      // Normalize VM property names in all clusters
      if (data && data.clusters && Array.isArray(data.clusters)) {
        const normalizedData = {
          ...data,
          clusters: data.clusters.map((cluster: any) => ({
            ...cluster,
            vms: cluster.vms
              ? cluster.vms.map((vm: any) => ({
                  ...vm,
                  vmName: vm.vmName || vm.VMName,
                  vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
                  vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
                  fqdn: vm.fqdn || vm.FQDN,
                  nodeIp: vm.nodeIp || vm.NodeIp,
                  clusterName: vm.clusterName || vm.ClusterName || cluster.KubernetesClusterName,
                }))
              : [],
          })),
        };
        updateClusterDataIfChanged(normalizedData);

        // Mark that we've successfully fetched initial cluster data
        hasInitialClusterDataRef.current = true;

        // Auto-navigate to the first cluster if available and not already on a cluster page
        // Only navigate if we're on the K8s provisioning page or home page (not already on cluster details)
        if (normalizedData.clusters.length > 0) {
          const currentPath = location.pathname;
          if (
            (currentPath === '/k8s-provisioning' || currentPath === '/') &&
            activeSection === 'clusters'
          ) {
            const firstCluster = normalizedData.clusters[0];
            const firstClusterName = firstCluster.KubernetesClusterName;
            navigate(`/cluster/${firstClusterName}/details`);
          }
        }
      } else {
        updateClusterDataIfChanged(data);
        // Mark as fetched even if empty
        hasInitialClusterDataRef.current = true;
      }
    } catch (error) {
      logger.error('Error fetching cluster data:', error);

      // Handle specific "no clusters found" error from interceptor
      if (error instanceof Error && error.message.includes('no clusters found')) {
        updateClusterDataIfChanged({ clusters: [], error: 'No clusters found' });

        if (activeSection === 'clusters' && !isRedirecting) {
          redirectToK8sProvisioning('No clusters found during initial fetch');
        }
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to load cluster data';

      if (errorMessage.includes('Cluster not found') || errorMessage.includes('not found')) {
        setClusterError(null);
      } else {
        setClusterError(errorMessage);
      }
    } finally {
      setIsLoadingClusters(false);
    }
  };

  // Function to refresh cluster data - can be called from multiple places
  const refreshClusterData = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!forceRefresh) {
        const now = Date.now();
        if (now - lastApiCallRef.current < API_CALL_DEBOUNCE_MS) {
          return null;
        }
        lastApiCallRef.current = now;
      }

      try {
        const data = await refreshClusterDataApi(forceRefresh);

        // Get existing optimistic clusters to preserve them (use ref for most up-to-date value)
        const existingOptimisticClusters =
          clusterDataRef.current?.clusters?.filter((c: any) => c.isOptimistic) || [];

        if (data && data.error) {
          const errorMessage = data.error;

          if (
            errorMessage &&
            (errorMessage.includes('Cluster not found') ||
              errorMessage.includes('not found') ||
              errorMessage.includes('No clusters found'))
          ) {
            // Keep optimistic clusters even if API returns error
            updateClusterDataIfChanged({ clusters: existingOptimisticClusters });
            setClusterError(null);
            return { clusters: existingOptimisticClusters };
          } else {
            updateClusterDataIfChanged({ clusters: existingOptimisticClusters });
            setClusterError(null);
            return { clusters: existingOptimisticClusters };
          }
        }

        // Check if clusters array exists and is empty
        if (data && data.clusters && Array.isArray(data.clusters) && data.clusters.length === 0) {
          // Keep optimistic clusters
          updateClusterDataIfChanged({ clusters: existingOptimisticClusters });
          setClusterError(null);
          return { clusters: existingOptimisticClusters };
        }

        // If no clusters property exists at all, treat as empty
        if (data && !data.clusters) {
          updateClusterDataIfChanged({ clusters: existingOptimisticClusters });
          setClusterError(null);
          return { clusters: existingOptimisticClusters };
        }

        // Normalize VM property names in all clusters
        if (data && data.clusters && Array.isArray(data.clusters)) {
          const normalizedData = {
            ...data,
            clusters: data.clusters.map((cluster: any) => ({
              ...cluster,
              vms: cluster.vms
                ? cluster.vms.map((vm: any) => ({
                    ...vm,
                    vmName: vm.vmName || vm.VMName,
                    vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
                    vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
                    fqdn: vm.fqdn || vm.FQDN,
                    nodeIp: vm.nodeIp || vm.NodeIp,
                    clusterName: vm.clusterName || vm.ClusterName || cluster.KubernetesClusterName,
                  }))
                : [],
            })),
          };

          // Merge API clusters with optimistic clusters (remove optimistic if real version exists)
          const apiClusterNames = new Set(
            normalizedData.clusters.map((c: any) => c.KubernetesClusterName || c.clusterName)
          );
          const optimisticToKeep = existingOptimisticClusters.filter(
            (optCluster: any) =>
              !apiClusterNames.has(optCluster.KubernetesClusterName) &&
              !apiClusterNames.has(optCluster.clusterName)
          );

          const mergedData = {
            ...normalizedData,
            clusters: [...normalizedData.clusters, ...optimisticToKeep],
          };

          updateClusterDataIfChanged(mergedData);

          // Auto-navigate to the first cluster if available and not already on a cluster page
          if (mergedData.clusters.length > 0) {
            const currentPath = location.pathname;
            if (
              (currentPath === '/k8s-provisioning' || currentPath === '/') &&
              activeSection === 'clusters'
            ) {
              const firstCluster = mergedData.clusters[0];
              const firstClusterName = firstCluster.KubernetesClusterName;
              navigate(`/cluster/${firstClusterName}/details`);
            }
          }

          setClusterError(null);
          if (activeSection === 'clusters') {
            setIsLoadingClusters(false);
          }
          return mergedData;
        } else {
          // Merge with optimistic clusters
          const mergedData = {
            ...data,
            clusters: [...(data?.clusters || []), ...existingOptimisticClusters],
          };
          updateClusterDataIfChanged(mergedData);
          setClusterError(null);
          if (activeSection === 'clusters') {
            setIsLoadingClusters(false);
          }
          return mergedData;
        }
      } catch (error) {
        logger.error('Error refreshing cluster data:', error);

        // Get existing optimistic clusters to preserve them (use ref for most up-to-date value)
        const existingOptimisticClusters =
          clusterDataRef.current?.clusters?.filter((c: any) => c.isOptimistic) || [];

        // Handle "Cluster not found" and similar errors as no clusters scenario
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes('Cluster not found') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('No clusters found')
        ) {
          updateClusterDataIfChanged({ clusters: existingOptimisticClusters });
          setClusterError(null);
          return { clusters: existingOptimisticClusters };
        }

        // For other errors, set empty state but keep optimistic clusters
        updateClusterDataIfChanged({ clusters: existingOptimisticClusters });
        setClusterError(null);

        // Only show error toast for actual critical failures, not for expected 404s
        if (
          activeSection === 'clusters' &&
          !errorMessage.includes('404') &&
          !errorMessage.includes('Not Found')
        ) {
          toast.error('Failed to refresh cluster data');
        }

        return { clusters: existingOptimisticClusters };
      }
    },
    [
      activeSection,
      updateClusterDataIfChanged,
      navigate,
      location.pathname,
      isRedirecting,
      redirectToControlCenter,
      redirectToK8sProvisioning,
      refreshClusterDataApi,
    ]
  );

  // Listen for cluster creation events to refresh sidebar data
  useEffect(() => {
    const handleClusterCreated = async (event: CustomEvent) => {
      const { clusterName, optimistic, status, jobId } = event.detail || {};

      // If optimistic flag is set, fetch latest clusters first, then add optimistic cluster
      if (optimistic) {
        setClusterError(null);
        setIsLoadingClusters(true);

        try {
          const refreshedData = await refreshClusterData(true);

          // Now get the refreshed clusters from the ref
          const existingClusters = clusterDataRef.current?.clusters || [];
          // Check if cluster already exists (to prevent duplicates)
          const clusterExists = existingClusters.some(
            (c: any) => c.KubernetesClusterName === clusterName || c.clusterName === clusterName
          );

          if (!clusterExists) {
            // Create optimistic cluster entry
            const optimisticCluster = {
              KubernetesClusterName: clusterName,
              clusterName: clusterName,
              clusterType: 'k3s-kubernetes',
              status: status || 'provisioning',
              jobId: jobId,
              vms: [],
              nodes: [],
              isOptimistic: true, // Flag to style it differently
            };

            const newClusters = [...existingClusters, optimisticCluster];
            updateClusterDataIfChanged({
              clusters: newClusters,
            });
          } else {
            logger.info('[OPTIMISTIC UPDATE] Cluster already exists, skipping optimistic add');
          }
        } catch (error) {
          logger.error('Error refreshing cluster data before optimistic update:', error);

          // Fallback: Add optimistic cluster even if refresh fails
          const existingClusters = clusterDataRef.current?.clusters || [];
          const clusterExists = existingClusters.some(
            (c: any) => c.KubernetesClusterName === clusterName || c.clusterName === clusterName
          );

          if (!clusterExists) {
            const optimisticCluster = {
              KubernetesClusterName: clusterName,
              clusterName: clusterName,
              clusterType: 'k3s-kubernetes',
              status: status || 'provisioning',
              jobId: jobId,
              vms: [],
              nodes: [],
              isOptimistic: true,
            };

            updateClusterDataIfChanged({
              clusters: [...existingClusters, optimisticCluster],
            });
          }
        } finally {
          setIsLoadingClusters(false);
        }

        return; // Don't do additional processing for optimistic updates
      }

      // If we're already on a cluster details page, don't refresh (K8sSetup already verified the cluster exists)
      const currentPath = location.pathname;
      if (currentPath.startsWith('/cluster/') && currentPath.includes('/details')) {
        // Just mark that we have initial data to prevent future auto-fetches
        hasInitialClusterDataRef.current = true;

        // If this is a non-optimistic event with job info, replace the optimistic entry
        if (jobId && clusterDataRef.current?.clusters) {
          const updatedClusters = clusterDataRef.current.clusters.map((cluster: any) => {
            if (
              cluster.KubernetesClusterName === clusterName ||
              cluster.clusterName === clusterName
            ) {
              // Update the optimistic cluster with job info
              return {
                ...cluster,
                jobId: jobId,
                isOptimistic: false, // No longer optimistic, backend has confirmed
              };
            }
            return cluster;
          });
          updateClusterDataIfChanged({ clusters: updatedClusters });
        }

        return;
      }

      // Clear any error states and refresh immediately
      setClusterError(null);
      setIsLoadingClusters(true);

      // Reset the initial fetch flag to allow refresh
      hasInitialClusterDataRef.current = false;

      try {
        // Force immediate refresh to sync with cluster details page
        await refreshClusterData(true);

        // Force UI re-render
        setIsLoadingClusters(false);
      } catch (error) {
        logger.error('Error refreshing cluster data after creation:', error);
        setIsLoadingClusters(false);
      }
    };

    const handleClusterCreationFailed = (event: CustomEvent) => {
      const { clusterName } = event.detail || {};

      // Remove optimistic cluster from sidebar on failure
      if (clusterDataRef.current?.clusters) {
        const updatedClusters = clusterDataRef.current.clusters.filter(
          (cluster: any) =>
            !(
              cluster.KubernetesClusterName === clusterName || cluster.clusterName === clusterName
            ) || !cluster.isOptimistic
        );
        updateClusterDataIfChanged({ clusters: updatedClusters });
      }
    };

    const handleClusterDeleted = async (event: CustomEvent) => {
      const deletedClusterName = event.detail?.clusterName;

      // Clear error states and force loading state to trigger re-render
      setClusterError(null);
      setIsLoadingClusters(true);

      // Reset the initial fetch flag to allow refresh
      hasInitialClusterDataRef.current = false;

      // Add 1 second delay before refreshing to allow backend processing to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Force immediate refresh to sync with cluster details page (hook handles caching internally)
      try {
        await refreshClusterData(true);
      } catch (error) {
        logger.error('Error refreshing sidebar after cluster deletion:', error);

        // Handle any error as "no clusters found" scenario after deletion
        updateClusterDataIfChanged({ clusters: [] });
        setClusterError(null);
      } finally {
        // Always ensure loading state is cleared
        setIsLoadingClusters(false);
      }
    };

    // Handle VM data refresh events (like Omni VMs)
    const handleVmDataRefreshNeeded = async (event: CustomEvent) => {
      const serverIp = event.detail?.serverIp;
      const serverName = event.detail?.serverName;

      if (serverIp) {
        // Find the server and refresh its VMs
        const serverToRefresh = dataCenters
          .flatMap((dc) => dc.servers)
          .find((server) => server.ip === serverIp);

        if (serverToRefresh && fetchVMsForServer) {
          try {
            // Add a slight delay to allow backend processing to complete (like Ubuntu pattern)
            setTimeout(async () => {
              await fetchVMsForServer(serverToRefresh);
            }, 1500); // 1.5 second delay like Ubuntu uses
          } catch (error) {
            logger.error(`Error refreshing VM data for server ${serverName}:`, error);
          }
        }
      }
    };

    // Handle cluster VM operations (create, delete, etc.)
    const handleClusterVmOperation = async (event: CustomEvent) => {
      const { vmName, operation, clusterName } = event.detail || {};

      // Force refresh cluster data immediately for cluster VM operations
      if (activeSection === 'clusters') {
        setTimeout(async () => {
          await refreshClusterData(true); // Force refresh to get immediate updates

          // Also refresh specific cluster VMs if we have the cluster name
          if (clusterName && expandedClusters[clusterName]) {
            await fetchClusterVMs(clusterName, true); // Force refresh cluster VMs
          }
        }, 500); // Shorter delay for immediate feedback
      }
    };

    // Handle expand cluster in sidebar event (triggered after job completion)
    const handleExpandClusterInSidebar = async (event: CustomEvent) => {
      const { clusterName } = event.detail || {};

      if (!clusterName) return;

      logger.info(`Expanding cluster ${clusterName} in sidebar after job completion`);

      // First, refresh cluster data to ensure we have the latest info
      await refreshClusterData(true);

      // If the cluster is already expanded, close it first to force a refresh
      if (expandedClusters[clusterName]) {
        logger.info(`Cluster ${clusterName} is already expanded, closing and reopening to refresh`);
        // Close all clusters first
        setExpandedClusters({});

        // Wait a bit for the state to update, then reopen
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Then expand the cluster dropdown (accordion behavior - close others, open this one)
      setExpandedClusters({ [clusterName]: true });

      // Fetch the cluster VMs with force refresh
      await fetchClusterVMs(clusterName, true);

      // Establish WebSocket connections for the cluster
      setupClusterWebSocketConnections(clusterName);
    };

    window.addEventListener('clusterCreated', handleClusterCreated as EventListener);
    window.addEventListener('clusterCreationFailed', handleClusterCreationFailed as EventListener);
    window.addEventListener('clusterDeleted', handleClusterDeleted as EventListener);
    window.addEventListener('vmDataRefreshNeeded', handleVmDataRefreshNeeded as EventListener);
    window.addEventListener('clusterVmOperation', handleClusterVmOperation as EventListener);
    window.addEventListener(
      'expandClusterInSidebar',
      handleExpandClusterInSidebar as EventListener
    );

    return () => {
      [
        'clusterCreated',
        'clusterCreationFailed',
        'clusterDeleted',
        'vmDataRefreshNeeded',
        'clusterVmOperation',
        'expandClusterInSidebar',
      ].forEach((event, i) => {
        const handlers = [
          handleClusterCreated,
          handleClusterCreationFailed,
          handleClusterDeleted,
          handleVmDataRefreshNeeded,
          handleClusterVmOperation,
          handleExpandClusterInSidebar,
        ];
        window.removeEventListener(event, handlers[i] as EventListener);
      });
    };
  }, []);

  // Function to get clusters from API data instead of WebSocket
  const getClustersFromAPI = () => {
    const clusters: { [clusterName: string]: { server: ServerNode; vms: VirtualMachine[] }[] } = {};

    if (!clusterData || !clusterData.clusters) {
      return clusters;
    }

    // Find matching servers from dataCenters for nodeIp mapping
    const serversByNodeIp = new Map<string, ServerNode>();
    if (dataCenters && dataCenters.length > 0) {
      dataCenters.forEach((dc) => {
        if (dc.servers && dc.servers.length > 0) {
          dc.servers.forEach((server) => {
            serversByNodeIp.set(server.ip, server);
          });
        }
      });
    }

    // Get the first available server as a fallback for VMs without nodeIp
    const fallbackServer = dataCenters?.[0]?.servers?.[0];

    clusterData.clusters.forEach((cluster: any) => {
      const clusterName = cluster.KubernetesClusterName;

      // Ensure cluster entry exists (important for BMS-only or empty clusters)
      if (!clusters[clusterName]) {
        clusters[clusterName] = [];
      }

      // Process VMs if they exist
      if (cluster.vms && Array.isArray(cluster.vms) && cluster.vms.length > 0) {
        cluster.vms.forEach((vm: any) => {
          // Normalize VM property names to match UI expectations
          const normalizedVm = {
            ...vm,
            vmName: vm.vmName || vm.VMName,
            vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
            vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
            fqdn: vm.fqdn || vm.FQDN,
            nodeIp: vm.nodeIp || vm.NodeIp,
            clusterName: vm.clusterName || vm.ClusterName || cluster.KubernetesClusterName,
          };

          // Try to find server by nodeIp, fallback to first available server if nodeIp is empty
          let server = normalizedVm.nodeIp ? serversByNodeIp.get(normalizedVm.nodeIp) : null;

          // If no server found and we have a fallback, use it
          if (!server && fallbackServer) {
            server = fallbackServer;
          }

          // Only process if we have a server (either matched or fallback)
          if (server) {
            // Find if this server already exists for this cluster
            let clusterEntry = clusters[clusterName].find((entry) => entry.server.id === server.id);
            if (!clusterEntry) {
              clusterEntry = { server, vms: [] };
              clusters[clusterName].push(clusterEntry);
            }

            // Create VM object compatible with existing structure
            const vmObj: VirtualMachine = {
              id: `vm-${normalizedVm.vmName}`,
              name: normalizedVm.vmName,
              state: 'Running', // Default state, could be enhanced with actual state
              isOn: true,
              datastore: '/pool1/vm', // Default datastore, could be enhanced
              ip: normalizedVm.vmIpAddress, // Store the VM IP for reference
            };

            clusterEntry.vms.push(vmObj);
          }
        });
      }

      // Process BMS servers if they exist (NEW: Handle BMS-only clusters like om-test)
      if (cluster.bmsInfo && Array.isArray(cluster.bmsInfo) && cluster.bmsInfo.length > 0) {
        cluster.bmsInfo.forEach((bmsServer: any) => {
          // Try to find server by nodeIp or ipAddress
          let server = serversByNodeIp.get(bmsServer.nodeIp || bmsServer.ipAddress);

          // If no server found, use fallback or create a minimal server representation
          if (!server && fallbackServer) {
            server = fallbackServer;
          } else if (!server) {
            // Create a minimal server representation for BMS servers not in datacenter list
            server = {
              id: `bms-${bmsServer.name}`,
              name: bmsServer.name,
              hostname: bmsServer.name,
              ip: bmsServer.ipAddress || bmsServer.nodeIp,
              status: 'Running',
              vms: [],
            };
          }

          if (server) {
            // Find if this server already exists for this cluster
            let clusterEntry = clusters[clusterName].find((entry) => entry.server.id === server.id);
            if (!clusterEntry) {
              clusterEntry = { server, vms: [] };
              clusters[clusterName].push(clusterEntry);
            }

            // BMS servers don't have VMs, but we ensure the cluster is visible
          }
        });
      }

      // Handle empty clusters (cluster-only) or clusters with only entities
      if (clusters[clusterName].length === 0) {
        // If cluster has no VMs or BMS but we still want it visible, use fallback server
        if (fallbackServer) {
          const emptyClusterEntry = { server: fallbackServer, vms: [] };
          clusters[clusterName].push(emptyClusterEntry);
        }
      }
    });
    return clusters;
  };

  // Function to get all clusters from all servers
  const getAllClusters = () => {
    // Use API data if available, otherwise fall back to WebSocket data
    if (clusterData) {
      return getClustersFromAPI();
    }

    const clusters: { [clusterName: string]: { server: ServerNode; vms: VirtualMachine[] }[] } = {};

    dataCenters.forEach((dc) => {
      dc.servers.forEach((server) => {
        if (server.vms) {
          const clusterVMs = server.vms.filter((vm) => isClusterVM(vm.name));

          clusterVMs.forEach((vm) => {
            const clusterName = getClusterName(vm.name);
            if (!clusters[clusterName]) {
              clusters[clusterName] = [];
            }

            // Find if this server already exists for this cluster
            let clusterEntry = clusters[clusterName].find((entry) => entry.server.id === server.id);
            if (!clusterEntry) {
              clusterEntry = { server, vms: [] };
              clusters[clusterName].push(clusterEntry);
            }
            clusterEntry.vms.push(vm);
          });
        }
      });
    });

    // Sort VMs within each cluster and server
    Object.keys(clusters).forEach((clusterName) => {
      clusters[clusterName].forEach((entry) => {
        entry.vms.sort((a, b) => {
          const aIsMaster =
            a.name.includes('master') ||
            a.name.includes('-ms') ||
            a.name.endsWith('-ms') ||
            a.name.includes('controlplane') ||
            a.name.includes('control-plane');
          const bIsMaster =
            b.name.includes('master') ||
            b.name.includes('-ms') ||
            b.name.endsWith('-ms') ||
            b.name.includes('controlplane') ||
            b.name.includes('control-plane');

          const aIsWorker =
            a.name.includes('worker') || a.name.includes('-wr') || /wr\d+/.test(a.name);
          const bIsWorker =
            b.name.includes('worker') || b.name.includes('-wr') || /wr\d+/.test(b.name);

          if (aIsMaster && !bIsMaster) return -1;
          if (!aIsMaster && bIsMaster) return 1;
          if (aIsWorker && !bIsWorker && !bIsMaster) return -1;
          if (!aIsWorker && bIsWorker && !aIsMaster) return 1;

          return a.name.localeCompare(b.name);
        });
      });
    });

    return clusters;
  };

  // Function to handle cluster name click - opens cluster details modal
  const handleClusterNameClick = async (clusterName: string) => {
    // Navigate to cluster page instead of showing modal
    // Note: Sidebar state is maintained so user can easily navigate between clusters
    navigate(`/cluster/${clusterName}/details`);
  };

  // Function to fetch cluster VMs from API
  const fetchClusterVMs = async (clusterName: string, forceRefresh = false) => {
    if (!forceRefresh && (clusterVmsData[clusterName] || loadingClusterVms[clusterName])) {
      return; // Already have data or currently loading
    }

    setLoadingClusterVms((prev) => ({ ...prev, [clusterName]: true }));

    try {
      // Use API function reference from hook (hook called at component top level above)
      const data = await getClusterVmsApi(clusterName, forceRefresh);

      // Check if the response contains an error message
      if (data && (data.error || data.message)) {
        const errorMessage = data.error || data.message;

        // For "Cluster not found" errors, don't treat as critical - just set empty data
        if (errorMessage.includes('Cluster not found') || errorMessage.includes('not found')) {
          // Cluster not yet available, setting empty data
        }

        // Set empty cluster VMs data instead of treating it as an error
        setClusterVmsData((prev) => ({
          ...prev,
          [clusterName]: { nodes: [] },
        }));
        return;
      }

      if (data.cluster) {
        // Normalize VM property names in the cluster data
        const normalizedCluster = {
          ...data.cluster,
          vms: data.cluster.vms
            ? data.cluster.vms.map((vm: any) => ({
                ...vm,
                vmName: vm.vmName || vm.VMName,
                vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
                vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
                fqdn: vm.fqdn || vm.FQDN,
                nodeIp: vm.nodeIp || vm.NodeIp,
                clusterName: vm.clusterName || vm.ClusterName || data.cluster.KubernetesClusterName,
              }))
            : [],
          bmsInfo: data.cluster.bmsInfo || [],
        };

        setClusterVmsData((prev) => ({
          ...prev,
          [clusterName]: normalizedCluster,
        }));
      } else if (data && data.KubernetesClusterName) {
        // Handle direct cluster data format (not nested under 'cluster' property)
        const normalizedCluster = {
          ...data,
          vms: data.vms
            ? data.vms.map((vm: any) => ({
                ...vm,
                vmName: vm.vmName || vm.VMName,
                vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
                vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
                fqdn: vm.fqdn || vm.FQDN,
                nodeIp: vm.nodeIp || vm.NodeIp,
                clusterName: vm.clusterName || vm.ClusterName || data.KubernetesClusterName,
              }))
            : [],
          bmsInfo: data.bmsInfo || [],
        };

        setClusterVmsData((prev) => ({
          ...prev,
          [clusterName]: normalizedCluster,
        }));
      } else if (data && data.clusters && Array.isArray(data.clusters)) {
        // Handle clusters array format - find the specific cluster
        const targetCluster = data.clusters.find(
          (cluster: any) => cluster.KubernetesClusterName === clusterName
        );
        if (targetCluster) {
          const normalizedCluster = {
            ...targetCluster,
            vms: targetCluster.vms
              ? targetCluster.vms.map((vm: any) => ({
                  ...vm,
                  vmName: vm.vmName || vm.VMName,
                  vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
                  vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
                  fqdn: vm.fqdn || vm.FQDN,
                  nodeIp: vm.nodeIp || vm.NodeIp,
                  clusterName:
                    vm.clusterName || vm.ClusterName || targetCluster.KubernetesClusterName,
                }))
              : [],
            bmsInfo: targetCluster.bmsInfo || [],
          };

          setClusterVmsData((prev) => ({
            ...prev,
            [clusterName]: normalizedCluster,
          }));
        }
      }
    } catch (err) {
      logger.error(`Error fetching cluster VMs for ${clusterName}:`, err);
      // Removed toast error to reduce UI noise - errors are logged to console
    } finally {
      setLoadingClusterVms((prev) => ({ ...prev, [clusterName]: false }));
    }
  };

  // Helper function to get updated VM state from WebSocket (Redux) data for cluster VMs
  const getUpdatedVmStateForCluster = (
    vmName: string,
    vmNodeIp: string,
    fallbackState: string
  ): string => {
    // First, try to find the VM in the Redux dataCenters (updated by WebSocket)
    if (dataCenters) {
      for (const dc of dataCenters) {
        for (const server of dc.servers || []) {
          // Match by server IP and find the VM
          if (server.ip === vmNodeIp) {
            const vmInServer = server.vms?.find((vm) => vm.name === vmName);
            if (vmInServer && vmInServer.state) {
              return vmInServer.state;
            }
          }
        }
      }
    }

    return fallbackState || 'Unknown';
  };

  // Helper function to get the correct server IP for cluster VMs
  // Helper function to get the server object for a cluster VM (with both ip and fqdn)
  const getServerForClusterVm = (vmName: string, vmNodeIp: string): ServerNode | null => {
    // Search through all servers in all data centers to find the server by FQDN first, then IP
    if (dataCenters && vmNodeIp && vmNodeIp.trim() !== '') {
      for (const dc of dataCenters) {
        for (const server of dc.servers || []) {
          // Priority 1: Try matching by FQDN first (handles cases like "test-asus-rack2.karios.com")
          if (server.fqdn && server.fqdn === vmNodeIp) {
            return server;
          }

          // Priority 2: Fall back to IP matching
          if (server.ip === vmNodeIp) {
            return server;
          }
        }
      }
    }

    // Priority 3: If nodeIp matching failed, search for the VM by name across all servers
    if (dataCenters) {
      for (const dc of dataCenters) {
        for (const server of dc.servers || []) {
          const vmInServer = server.vms?.find((vm) => vm.name === vmName);
          if (vmInServer) {
            return server;
          }
        }
      }
    }

    // Priority 4: If still no server found, use the first available server as fallback
    const fallbackServer = dataCenters?.[0]?.servers?.[0];
    if (fallbackServer) {
      return fallbackServer;
    }
    return null;
  };

  // Legacy function for backward compatibility - returns just the IP
  const getServerIpForClusterVm = (vmName: string, vmNodeIp: string): string | null => {
    const server = getServerForClusterVm(vmName, vmNodeIp);
    // Prefer FQDN over IP
    return server ? server.fqdn || server.ip : null;
  };

  // Function to handle cluster dropdown toggle
  const handleClusterDropdownToggle = (clusterName: string) => {
    const isCurrentlyExpanded = expandedClusters[clusterName];

    // Accordion behavior: only one cluster can be expanded at a time
    if (isCurrentlyExpanded) {
      // If clicking on an already expanded cluster, close it
      setExpandedClusters({});
    } else {
      // If clicking on a collapsed cluster, close all others and open this one
      setExpandedClusters({ [clusterName]: true });

      // Fetch cluster VMs when expanding - force refresh to get latest data
      fetchClusterVMs(clusterName, true);

      // Establish WebSocket connections for servers that contain VMs in this cluster
      setupClusterWebSocketConnections(clusterName);
    }
  };

  // Function to establish WebSocket connections for servers containing cluster VMs
  const setupClusterWebSocketConnections = (clusterName: string) => {
    // Get all servers that contain VMs for this cluster
    const clusterServers = new Set<any>();

    // Check cluster data for VMs and their associated servers
    if (clusterData?.clusters) {
      const cluster = clusterData.clusters.find((c) => c.name === clusterName);
      if (cluster?.vms) {
        cluster.vms.forEach((vm) => {
          if (vm.nodeIp && vm.nodeIp.trim() !== '') {
            // Find the server object by IP from all data centers
            if (dataCenters) {
              for (const dc of dataCenters) {
                for (const server of dc.servers || []) {
                  if (server.ip === vm.nodeIp) {
                    clusterServers.add(server);
                    break;
                  }
                }
              }
            }
          }
        });
      }
    }

    // Also check cluster VMs data if available
    const clusterVMs = clusterVmsData[clusterName];
    if (clusterVMs?.vms) {
      clusterVMs.vms.forEach((vm) => {
        if (vm.nodeIp && vm.nodeIp.trim() !== '') {
          // Find the server object by IP from all data centers
          if (dataCenters) {
            for (const dc of dataCenters) {
              for (const server of dc.servers || []) {
                if (server.ip === vm.nodeIp) {
                  clusterServers.add(server);
                  break;
                }
              }
            }
          }
        }
      });
    }

    const serversArray = Array.from(clusterServers);

    if (serversArray.length === 0) {
      return;
    }
    // Establish WebSocket connections for each server in the cluster
    for (const server of serversArray) {
      const serverKey = server.id;

      // Skip if WebSocket connection already exists for this server
      if (activeWebSocketsRef.current[serverKey]) {
        continue;
      }

      // Set loading state for this server
      setLoadingServers((prev) => ({ ...prev, [serverKey]: true }));

      // Setup WebSocket connection using the same method as Control Center
      const wsConnection = setupVmListWebSocket(server, dispatch);

      if (wsConnection) {
        // Store the WebSocket connection for later management
        activeWebSocketsRef.current[serverKey] = wsConnection;

        // Add error handling to clear loading state if WebSocket fails
        wsConnection.onerror = (originalError) => {
          logger.error(`WebSocket error for server ${serverKey} in cluster ${clusterName}`);
          setLoadingServers((prev) => {
            const updated = { ...prev };
            delete updated[serverKey];
            return updated;
          });
        };
      } else {
        // Clear loading state if WebSocket setup failed
        setLoadingServers((prev) => {
          const updated = { ...prev };
          delete updated[serverKey];
          return updated;
        });
      }
    }
  };

  // Function to handle VM click from cluster details modal
  const handleVmClickFromModal = async (vmName: string, nodeIp: string) => {
    try {
      // If nodeIp is empty, try to find it from cluster API data
      let actualNodeIp = nodeIp;

      if (!actualNodeIp || actualNodeIp.trim() === '') {
        // Search through cluster API data to find this VM
        if (clusterData?.clusters) {
          for (const cluster of clusterData.clusters) {
            const vmInCluster = cluster.vms?.find((v) => v.vmName === vmName);
            if (vmInCluster && vmInCluster.nodeIp) {
              actualNodeIp = vmInCluster.nodeIp;
              break;
            }
          }
        }

        // If still no nodeIp, use the first available server
        if (!actualNodeIp) {
          const fallbackServer = dataCenters?.[0]?.servers?.[0];
          if (fallbackServer) {
            actualNodeIp = fallbackServer.ip;
          }
        }
      }

      if (!actualNodeIp) {
        toast.error(`Cannot navigate to VM: No server information found for ${vmName}`);
        return;
      }

      // Find the server that matches the nodeIp (FQDN first, then IP)
      const targetServer = dataCenters
        .flatMap((dc) => dc.servers)
        .find((server) => {
          // Try matching by FQDN first
          if (server.fqdn && server.fqdn === actualNodeIp) {
            return true;
          }
          // Fall back to IP matching
          return server.ip === actualNodeIp;
        });

      if (!targetServer) {
        toast.error(`Server with IP/FQDN ${actualNodeIp} not found`);
        return;
      }

      // Ensure VMs are fetched for the server (this will establish WebSocket connection if needed)
      if (!targetServer.vms || targetServer.vms.length === 0) {
        await fetchVMsForServer(targetServer);
      }

      // Refetch the server after potential updates (FQDN first, then IP)
      const updatedServer = dataCenters
        .flatMap((dc) => dc.servers)
        .find((server) => {
          // Try matching by FQDN first
          if (server.fqdn && server.fqdn === actualNodeIp) {
            return true;
          }
          // Fall back to IP matching
          return server.ip === actualNodeIp;
        });

      if (!updatedServer) {
        toast.error(`Server connection lost. Please try again.`);
        return;
      }

      // Find the VM in the server's VM list
      const targetVm = updatedServer.vms?.find((vm) => vm.name === vmName);
      if (targetVm) {
        handleVmClick(targetVm, updatedServer);
      } else {
        logger.error('VM not found after fetch:', vmName);
      }
    } catch (error) {
      logger.error('Error handling VM click from modal:', error);
      toast.error(`Failed to navigate to ${vmName}. Please try again.`);
    }
  };

  // Effect to fetch VMs when VMs tab is clicked - only from control node
  useEffect(() => {
    if (
      controlCenterTab === 'vms' &&
      activeSection === 'control-center' &&
      dataCenters &&
      dataCenters.length > 0
    ) {
      // If already setup, don't create another connection
      if (vmsWebSocketSetupRef.current) {
        return undefined;
      }

      vmsWebSocketSetupRef.current = true;

      // Set loading state immediately when starting to fetch
      setIsLoadingVmsList(true);

      // Get only the control node from all datacenters
      let controlNode: ServerNode | null = null;
      for (const dc of dataCenters) {
        const found = dc.servers?.find((s) => (s as any).is_control_node === true);
        if (found) {
          controlNode = found;
          break;
        }
      }

      if (!controlNode) {
        // If no explicit control node found, use the first server
        const allServers = dataCenters.flatMap((dc) => dc.servers || []);
        if (allServers.length > 0) {
          controlNode = allServers[0];
        }
      }

      if (!controlNode) {
        setIsLoadingVmsList(false);
        return undefined;
      }

      try {
        // Setup WebSocket for only the control node
        const ws = setupVmListWebSocket(controlNode, dispatch, 'node');

        if (ws) {
          vmsWebSocketsRef.current.push(ws);

          // Handle incoming data from control node
          const handleVmsMessage = (event: Event) => {
            try {
              const messageEvent = event as unknown as { data: string };
              const data = JSON.parse(messageEvent.data);

              // Handle both array format and object format with vms property
              if (Array.isArray(data)) {
                // Show data immediately without loading state
                // Ensure each VM has isOn property set based on state
                const allVms = data.map((vm) => ({
                  ...vm,
                  serverId: controlNode.id,
                  serverName: controlNode.name,
                  // Set isOn based on state: Running = true, anything else = false
                }));
                setVmsList(allVms);
                // Set loading to false after data is received
                setIsLoadingVmsList(false);
              } else if (data && typeof data === 'object' && Array.isArray(data.vms)) {
                // Handle response format like { message: "...", vms: [...] }
                const allVms = data.vms.map((vm) => ({
                  ...vm,
                  serverId: controlNode.id,
                  serverName: controlNode.name,
                }));
                setVmsList(allVms);
                setIsLoadingVmsList(false);
              }
            } catch (error) {
              setIsLoadingVmsList(false);
            }
          };

          ws.addEventListener('message', handleVmsMessage);
        } else {
          setIsLoadingVmsList(false);
        }

        return () => {
          // Close the WebSocket connection
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        };
      } catch (error) {
        setIsLoadingVmsList(false);
        return undefined;
      }
    } else if (controlCenterTab !== 'vms') {
      // Close all WebSocket connections when switching away from VMs tab
      vmsWebSocketsRef.current.forEach((ws) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      vmsWebSocketsRef.current = [];
      // Reset the setup flag when switching away from VMs tab
      vmsWebSocketSetupRef.current = false;
    }
    return undefined;
  }, [controlCenterTab, dataCenters, activeSection, dispatch]);

  // Function to handle control center click - navigate to datacenter
  const handleControlCenterClick = useCallback(() => {
    // Debounce section switching to prevent rapid clicking issues
    const now = Date.now();
    if (now - lastSectionSwitchRef.current < SECTION_SWITCH_DEBOUNCE_MS) {
      return; // Ignore if clicked too soon after last switch
    }
    lastSectionSwitchRef.current = now;

    // Always navigate to datacenter home page when Control Center is clicked
    // This ensures users can return to provisioning center from anywhere (including node info pages)

    // Reset the show both options flag
    setShowBothOptions(false);

    // Start transition to prevent flickering
    setIsTransitioning(true);

    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Force immediate pinning and expansion
    setIsPinned(true);
    updateSidebarState('expanded');

    // Clear any selected cluster to prevent showing stale cluster data
    setSelectedCluster(null);

    // Clear any selected VM to ensure we return to datacenter home
    dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: null });

    // Immediately set the active section to control-center to prevent any flicker
    setLastActiveSection('control-center');
    setActiveSection('control-center');

    // Navigate to the datacenter (provision center) home page
    if (dataCenters && dataCenters.length > 0) {
      const dc = dataCenters[0];
      dispatch({ type: ActionTypes.SET_SELECTED_DATACENTER, payload: dc });
      navigate(`/dc/${dc.id}`);
    }

    // End transition after content is ready
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 50);
  }, [
    dataCenters,
    dispatch,
    navigate,
    updateSidebarState,
    setShowBothOptions,
    setIsTransitioning,
    setIsPinned,
    setSelectedCluster,
    setLastActiveSection,
    setActiveSection,
  ]);

  // Function to handle Kubernetes section click - navigate to dashboard
  const handleKubernetesClick = useCallback(() => {
    // Update the active section to highlight the Kubernetes section
    setLastActiveSection('clusters');
    setActiveSection('clusters');

    // Navigate to the dashboard
    navigate('/kubernetes-dashboard');
  }, [navigate, setLastActiveSection, setActiveSection]);

  // Sync activeSection with current route (handles page refreshes)
  useEffect(() => {
    const pathname = location.pathname;

    if (pathname.includes('/migration')) {
      setActiveSection('migrate');
    } else if (pathname.includes('/kubernetes')) {
      setActiveSection('clusters');
    } else if (pathname.includes('/control-center') || pathname === '/') {
      setActiveSection('control-center');
    }
  }, [location.pathname, setActiveSection]);

  // Initialize hooks for cluster and server operations
  // These provide optimized implementations that can replace inline functions
  // Currently used by ControlCenter component props
  const {
    fetchClusterData: hookFetchClusterData,
    refreshClusterData: hookRefreshClusterData,
    refreshClusterDataForServer: hookRefreshClusterDataForServer,
    setupClusterWebSocketConnections: hookSetupClusterWebSocketConnections,
    getClustersFromAPI: hookGetClustersFromAPI,
  } = useClusterOperations({
    clusterData,
    clusterVmsData,
    dataCenters,
    activeSection,
    expandedClusters,
    isLoadingClusters,
    isRedirecting,
    lastApiCallRef,
    activeWebSocketsRef,
    setIsLoadingClusters,
    setClusterError,
    setLoadingServers,
    setClusterVmsData,
    setLoadingClusterVms,
    updateClusterDataIfChanged,
    redirectToK8sProvisioning,
    redirectToControlCenter,
    refreshClusterDataApi,
    getClusterDataApi,
    fetchClusterVMs,
    fetchVMsForServer,
    dispatch,
    navigate,
    logger,
  });

  const {
    handleServerClick: hookHandleServerClick,
    toggleServerVisibility: hookToggleServerVisibility,
    refreshServerVms: hookRefreshServerVms,
    findServerByIp: hookFindServerByIp,
  } = useServerOperations({
    dataCenters,
    openServers,
    activeWebSocketsRef,
    initialPingInProgress,
    setNewServerDropdownSelected,
    setOpenServers,
    setLoadingServers,
    setManuallyClosedServers,
    setDropdownOpen,
    dispatch,
    navigate,
    fetchVMsForServer,
    logger,
  });

  // Function to refresh VM list by calling the WebSocket endpoint
  const refreshVmsList = useCallback(async () => {
    logger.info('Manually triggering VM list refresh');

    // Get the control node
    let controlNode: ServerNode | null = null;
    for (const dc of dataCenters) {
      const found = dc.servers?.find((s) => (s as any).is_control_node === true);
      if (found) {
        controlNode = found;
        break;
      }
    }

    if (!controlNode) {
      const allServers = dataCenters.flatMap((dc) => dc.servers || []);
      if (allServers.length > 0) {
        controlNode = allServers[0];
      }
    }

    if (!controlNode) {
      logger.warn('No control node found for VM list refresh');
      return;
    }

    try {
      // Fetch VM list using WebSocket (returns Promise that resolves when WebSocket receives data)
      const vmsData = await fetchVmListForNode(controlNode.ip);

      // Update the VM list state
      const allVms = vmsData.map((vm) => ({
        ...vm,
        serverId: controlNode.id,
        serverName: controlNode.name,
        isOn: vm.state === 'Running' || vm.isOn,
      }));

      setVmsList(allVms);
      logger.info(`VM list refreshed successfully with ${allVms.length} VMs via WebSocket`);
    } catch (error) {
      logger.error('Error refreshing VM list via WebSocket:', error);
    }
  }, [dataCenters, logger]);

  const {
    handleToggleVmPower: hookHandleToggleVmPower,
    handleRenameVm: hookHandleRenameVm,
    handleVmNameChange: hookHandleVmNameChange,
    confirmRename: hookConfirmRename,
    handleCloneVm: hookHandleCloneVm,
    proceedWithCloneAfterPcieWarning: hookProceedWithCloneAfterPcieWarning,
    confirmClone: hookConfirmClone,
    handleRestartVm: hookHandleRestartVm,
    handleResetVm: hookHandleResetVm,
    handlePowerOffVm: hookHandlePowerOffVm,
    handleUnlockVm: hookHandleUnlockVm,
    handleDeleteVm: hookHandleDeleteVm,
    confirmDelete: hookConfirmDelete,
  } = useVMActions({
    // Execution functions
    performVmActionWebSocket,
    performVmAction,
    renameVmInContext,
    cloneVmInContext,
    unlockVmApi,
    createConsole,
    checkVmPcieDevices,
    executeWithApproval,

    // State setters
    setVmActionStatuses,
    setDropdownVmName,
    setCurrentRenameVm,
    setCurrentServerIp,
    setNewVmName,
    setRenameError,
    setNameValidationError,
    setIsRenameModalOpen,
    setCurrentCloneVm,
    setNewCloneVmName,
    setCloneModalMode,
    setIsCloneModalOpen,
    setPcieDevicesList,
    setCloneErrorMessage,
    setRefreshingVms,
    setCurrentDeleteVm,
    setIsDeleteModalOpen,
    setDeleteButtonClicked,
    setIsDeleting,
    setActionModalTitle,
    setActionModalMessage,
    setActionModalType,
    setIsActionModalOpen,

    // State values
    dataCenters,
    selectedVm,
    activeSection,
    currentRenameVm,
    currentCloneVm,
    currentDeleteVm,
    currentServerIp,
    newVmName,
    newCloneVmName,
    deleteButtonClicked,
    refreshingVms,

    // Helper functions
    isVmInAnyTransition,
    findServerByIp: hookFindServerByIp,
    handleSmartNavigationAfterVmDelete,
    refreshVmsList,

    // Redux & Navigation
    dispatch,
    navigate,
    logger,

    // Cluster operations
    refreshClusterData: hookRefreshClusterData,
    refreshClusterDataForServer: hookRefreshClusterDataForServer,
  });

  return (
    <>
      {/* Hidden State - Invisible trigger zone at the left edge */}
      {sidebarState === 'hidden' && (
        <HoverZoneTrigger type="hidden-trigger" onMouseEnter={() => updateSidebarState('small')} />
      )}

      {/* Dedicated left-edge hover zone for showing both options when expanded */}
      {sidebarState === 'expanded' && !showBothOptions && activeSection && !isPinned && (
        <HoverZoneTrigger
          type="expanded-hover-zone"
          onMouseEnter={() => {
            if (activeSection && !isPinned) {
              setShowBothOptions(true);
            }
          }}
        />
      )}

      {/* Sidebar Container - Always visible */}
      <div
        className="fixed left-0 z-50 transition-all duration-[1000ms] ease-in-out"
        style={{ top: '60px', height: 'calc(100vh - 60px)' }}
        onMouseLeave={(e) => {
          // Only reset showBothOptions if mouse is moving away from the sidebar (to the right)
          // and we're not pinned
          if (!isPinned) {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX;

            if (mouseX > rect.right) {
              setShowBothOptions(false);
            }
          }
        }}
      >
        <div className="flex bg-white relative" style={{ height: 'calc(100vh - 60px)' }}>
          {/* Small Fixed Sidebar - Always visible - Using SidebarIconBar Component */}
          <SidebarIconBar
            isPinned={isPinned}
            activeSection={activeSection}
            lastActiveSection={lastActiveSection}
            sidebarState={sidebarState}
            showBothOptions={showBothOptions}
            onMouseEnter={() => {
              // Only show both options when hovering over the small sidebar if we're in expanded state
              // and there's an active section, and we're not already showing both options
              if (sidebarState === 'expanded' && activeSection && !showBothOptions && !isPinned) {
                setShowBothOptions(true);
              }
            }}
            onMouseLeave={() => {
              // Only hide both options if we're not pinned and we're leaving the small sidebar
              if (!isPinned && activeSection && showBothOptions) {
                // Add a small delay to prevent flickering when moving between small sidebar and content area
                setTimeout(() => {
                  if (!isPinned) {
                    setShowBothOptions(false);
                  }
                }, 100);
              }
            }}
            onPinClick={() => {
              // Toggle the content area for the selected section
              if (activeSection) {
                // If content area is open, toggle between pinned and unpinned
                if (isPinned && sidebarState === 'expanded') {
                  // Unpin and collapse - this will hide sidebar on mouse leave
                  setIsPinned(false);
                  updateSidebarState('small');
                } else {
                  // Pin and expand
                  setIsPinned(true);
                  updateSidebarState('expanded');
                }
              } else {
                // If content area is closed, pin and open it for the last active section
                setIsPinned(true);
                setActiveSection(lastActiveSection);
                updateSidebarState('expanded');
              }
            }}
            onControlCenterClick={handleControlCenterClick}
            onKubernetesClick={handleKubernetesClick}
          />

          {/* Expandable Content Area - Only show when in expanded state and has active section */}
          {sidebarState === 'expanded' && activeSection && (
            <div className="relative flex">
              <div
                className="transition-all duration-300 ease-in-out overflow-hidden bg-white flex flex-col"
                style={{ width: `${sidebarWidth}px` }}
                onMouseEnter={(e) => {
                  // When hovering over content area, maintain the showBothOptions state
                  // This ensures smooth navigation between the sidebar and content
                  if (activeSection && !isPinned) {
                    setShowBothOptions(true);
                  }
                }}
                onMouseLeave={(e) => {
                  // Only reset showBothOptions if we're leaving to the right and not pinned
                  if (!isPinned) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX;

                    if (mouseX > rect.right) {
                      setTimeout(() => {
                        if (!isPinned) {
                          setShowBothOptions(false);
                        }
                      }, 100);
                    }
                  }
                }}
              >
                {activeSection && (
                  <div className="h-full flex flex-col mb-10 overflow-y-auto">
                    {/* Migration Section - Show in sidebar when active */}
                    {activeSection === 'migrate' && (
                      <div className="p-4 space-y-4">
                        <h2 className="text-lg font-semibold text-gray-800">Migration</h2>

                        {/* System Type Display */}
                        <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium text-gray-800">
                            {state['migration']?.selectedNode?.systemType || 'esxi'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Show transition loading state to prevent flickering */}
                    {activeSection !== 'migrate' && activeSection !== 'licenses' && (
                      <>
                        {isTransitioning ? (
                          <LoadingState message="Loading..." />
                        ) : !dataCenters || dataCenters.length === 0 ? (
                          <ContentEmptyState activeSection={activeSection} />
                        ) : (
                          (dataCenters || []).map((dc) => (
                            <React.Fragment key={dc.id}>
                              <div key={dc.id} className="h-full flex flex-col">
                                {/* Data Center Header */}
                                <DataCenterHeader
                                  name={dc.name}
                                  activeSection={activeSection}
                                  onSearchChange={(value) => setSearchTerm(value)}
                                />

                                {/* Sidebar Tabs - only show for Control Center */}
                                {activeSection === 'control-center' && (
                                  <SidebarTabs
                                    activeTab={controlCenterTab}
                                    onTabChange={(tab) => {
                                      setControlCenterTab(tab);
                                    }}
                                  />
                                )}

                                {/* Content Area */}
                                <div className="flex-1 overflow-y-auto p-1 sm:p-2 min-h-0 pb-8">
                                  {/* Control Center Content */}
                                  {activeSection === 'control-center' && (
                                    <ControlCenter
                                      dataCenters={dataCenters}
                                      openServers={openServers}
                                      loadingServers={loadingServers}
                                      dropdownVmName={dropdownVmName}
                                      nodeStatuses={nodeStatuses}
                                      refreshingVms={refreshingVms}
                                      vmActionStatuses={vmActionStatuses}
                                      initialPingInProgress={initialPingInProgress}
                                      selectedVm={selectedVm}
                                      newServerDropdownSelected={newServerDropdownSelected}
                                      controlCenterTab={controlCenterTab}
                                      vmsList={vmsList}
                                      isLoadingVmsList={isLoadingVmsList}
                                      searchTerm={searchTerm}
                                      onToggleServerVisibility={hookToggleServerVisibility}
                                      onServerClick={hookHandleServerClick}
                                      onVmClick={handleVmClick}
                                      onToggleVmDropdown={toggleVmDropdown}
                                      onToggleVmPower={hookHandleToggleVmPower}
                                      onRenameVm={hookHandleRenameVm}
                                      onCloneVm={hookHandleCloneVm}
                                      onRestartVm={hookHandleRestartVm}
                                      onResetVm={hookHandleResetVm}
                                      onPowerOffVm={hookHandlePowerOffVm}
                                      onUnlockVm={hookHandleUnlockVm}
                                      onDeleteVm={hookHandleDeleteVm}
                                      onGetVmStatusColor={getVmStatusColor}
                                      onIsVmInAnyTransition={isVmInAnyTransition}
                                      onRenderVMItem={renderVMItem}
                                      onShouldHighlightVmFromUrl={shouldHighlightVmFromUrl}
                                    />
                                  )}

                                  {/* Kubernetes/Clusters Content */}
                                  {activeSection === 'clusters' && (
                                    <KubernetesSection
                                      dataCenters={dataCenters}
                                      isLoadingClusters={isLoadingClusters}
                                      clusterError={clusterError}
                                      clusterData={clusterData}
                                      expandedClusters={expandedClusters}
                                      dropdownOpen={dropdownOpen}
                                      loadingClusterVms={loadingClusterVms}
                                      clusterVmsData={clusterVmsData}
                                      vmActionStatuses={vmActionStatuses}
                                      refreshingVms={refreshingVms}
                                      wsVmStates={wsVmStatesMap}
                                      vmsList={vmsList}
                                      onVmClick={handleVmClick}
                                      onGetAllClusters={getAllClusters}
                                      onHandleClusterNameClick={handleClusterNameClick}
                                      onHandleClusterDropdownToggle={handleClusterDropdownToggle}
                                      onHandleDashboardClick={handleKubernetesClick}
                                      onSetDropdownOpen={setDropdownOpen}
                                      onToggleVmPower={hookHandleToggleVmPower}
                                      onRestartVm={hookHandleRestartVm}
                                      onResetVm={hookHandleResetVm}
                                      onPowerOffVm={hookHandlePowerOffVm}
                                      onUnlockVm={hookHandleUnlockVm}
                                      onDeleteVm={hookHandleDeleteVm}
                                      onVmClickFromModal={handleVmClickFromModal}
                                      onGetVmStatusColor={getVmStatusColor}
                                      onIsVmInAnyTransition={isVmInAnyTransition}
                                      onGetUpdatedVmStateForCluster={getUpdatedVmStateForCluster}
                                      onGetServerIpForClusterVm={getServerIpForClusterVm}
                                      onGetServerForClusterVm={getServerForClusterVm}
                                    />
                                  )}
                                </div>
                              </div>
                            </React.Fragment>
                          ))
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Resize Handle Component */}
              <ResizeHandle
                sidebarWidth={sidebarWidth}
                setSidebarWidth={setSidebarWidth}
                onWidthChange={(newWidth) => {
                  if (onSidebarStateChange && sidebarState === 'expanded') {
                    onSidebarStateChange('expanded', newWidth);
                  }
                }}
                minWidth={150}
                maxWidthPercent={0.4}
                GAP_SIZE={GAP_SIZE}
              />
            </div>
          )}
        </div>
      </div>

      {/* Version Info Box Component */}
      <VersionInfoBox
        controlNodeVersion={controlNodeVersion}
        isLoadingVersion={isLoadingVersion}
        hasUpdatesAvailable={hasUpdatesAvailable}
        isLoadingUpdates={isLoadingUpdates}
        sidebarState={sidebarState}
        activeSection={activeSection}
        showBothOptions={showBothOptions}
        isPinned={isPinned}
        dataCenters={dataCenters}
        GAP_SIZE={GAP_SIZE}
        calculateEffectiveWidth={calculateEffectiveWidth}
        setShowBothOptions={setShowBothOptions}
      />

      {/* Consolidated Modals Component */}
      <SidebarModals
        isRenameModalOpen={isRenameModalOpen}
        currentRenameVm={currentRenameVm}
        newVmName={newVmName}
        nameValidationError={nameValidationError}
        renameError={renameError}
        onCloseRenameModal={() => setIsRenameModalOpen(false)}
        onVmNameChange={hookHandleVmNameChange}
        onConfirmRename={hookConfirmRename}
        isDeleteModalOpen={isDeleteModalOpen}
        currentDeleteVm={currentDeleteVm}
        isDeleting={isDeleting}
        deleteButtonClicked={deleteButtonClicked}
        onCloseDeleteModal={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
          }
        }}
        onConfirmDelete={hookConfirmDelete}
        isCloneModalOpen={isCloneModalOpen}
        currentCloneVm={currentCloneVm}
        cloneModalMode={
          cloneModalMode as 'powered-on' | 'input' | 'name-exists' | 'pcie-warning' | 'error'
        }
        newCloneVmName={newCloneVmName}
        pcieDevicesList={pcieDevicesList}
        cloneErrorMessage={cloneErrorMessage}
        onCloseCloneModal={() => setIsCloneModalOpen(false)}
        onNewCloneVmNameChange={(name) => setNewCloneVmName(name)}
        onConfirmClone={hookConfirmClone}
        onProceedAfterPcieWarning={hookProceedWithCloneAfterPcieWarning}
        isActionModalOpen={isActionModalOpen}
        actionModalTitle={actionModalTitle}
        actionModalMessage={actionModalMessage}
        actionModalType={actionModalType as 'success' | 'error'}
        onCloseActionModal={() => setIsActionModalOpen(false)}
        isApprovalModalOpen={isModalOpen}
        approvalModalProps={modalProps}
      />

    </>
  );
}
