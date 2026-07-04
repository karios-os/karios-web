import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  FaServer,
  FaPlay,
  FaStop,
  FaTrashAlt,
  FaSync,
  FaInfoCircle,
  FaChevronDown,
  FaRedo,
} from 'react-icons/fa';
import { useVm, useServer, useAppState } from '@karios-monorepo/shared-state';
import { Home, ScrollableContent, Breadcrumbs } from '@karios-monorepo/shared-ui';
import { Code1, Cpu, KeyboardOpen, Gallery, CpuSetting } from 'iconsax-react';
import { HiMiniCpuChip } from 'react-icons/hi2';
import { PiMemoryDuotone } from 'react-icons/pi';
import { BsHdd } from 'react-icons/bs';
import { VM, DataCenter, LocationState } from './VmTopBar-types';
import envConfig from '../../../runtime-config';
import { toast } from 'react-toastify';
import { useSidebarAPI } from '../../shared-state/src/hooks/useSidebarAPI';
import { useApprovalFlow } from '../../shared-state/src/hooks/useApprovalFlow';
import { Hardware, Console, SnapshotManager, ActivityLogs } from '@karios-monorepo/feature-vm';
import BhyveLogs from '../../feature-vm/src/BhyveLogs';
import { LuLogs } from 'react-icons/lu';
import { getMetricColorClasses } from '../../feature-server/src/LandingPage';
import { useWebSocket } from '../../shared-state/src/AppStateContext';
import { isVmNameRestricted } from './utils/vmHandlers';

type BreadcrumbItem = {
  label: string;
  onClick?: () => void;
  isActive?: boolean;
};

/**
 * Gets VM state from VM list (authoritative source).
 * Falls back to selectedVm if not found in list.
 */
function getVmState(selectedVm: VM | null, selectedServer: any): 'running' | 'stopped' | 'unknown' {
  if (!selectedVm?.name) return 'unknown';

  // First try to get state from server's VM list (most up-to-date)
  const vmFromList = selectedServer?.vms?.find((vm: any) => vm.name === selectedVm.name);
  if (vmFromList?.state) {
    const state = vmFromList.state.toLowerCase().trim();
    if (state === 'running' || state === 'started') return 'running';
    if (state === 'stopped' || state === 'stopping') return 'stopped';
  }

  // Fallback to selectedVm state
  if (selectedVm?.state) {
    const state = selectedVm.state.toLowerCase().trim();
    if (state === 'running' || state === 'started') return 'running';
    if (state === 'stopped' || state === 'stopping') return 'stopped';
  }

  return 'unknown';
}

export default function VmTopBar() {
  const { selectedVm, dataCenters, setSelectedVm } = useVm();
  const { selectedServer } = useServer();
  const { state, performVmActionWebSocket, performVmAction, fetchVMsForServer } = useAppState();
  const { createConsole } = useSidebarAPI();
  const { executeWithApproval } = useApprovalFlow();
  const { connectWebSocket, closeConnection } = useWebSocket();

  const [showNodeMetricsDropdown, setShowNodeMetricsDropdown] = useState(false);
  const [nodeMetrics, setNodeMetrics] = useState<{
    cpu?: { total_usage_percent?: number };
    memory?: number;
    storage?: number;
    efficiency?: string;
  } | null>(null);
  const [efficiency, setEfficiency] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(
    null
  );

  // VM action status tracking (similar to VMDashboard)
  const [vmActionStatus, setVmActionStatus] = useState<{
    action: string;
    loading: boolean;
  } | null>(null);

  const nodeDetailsButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const serverName = selectedServer?.name;
  const vmName = selectedVm?.name;
  const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
  const migrationSource = selectedVm?.migrationSource || selectedVm?.['migrated-from'];
  const isVmBasePath = location.pathname === `/server/${serverName}/vm/${vmName}`;

  /**
   * Computes VM state from VM list (authoritative source).
   * Uses useMemo to reactively update when selectedServer.vms changes.
   */
  const vmState = useMemo(() => {
    return getVmState(selectedVm, selectedServer);
  }, [
    selectedVm?.name,
    selectedVm?.state,
    selectedServer?.vms,
    // Create a string signature of the VM list to detect changes
    // This ensures React detects when the VM list or any VM's state changes
    selectedServer?.vms?.map((vm) => `${vm.name}:${vm.state}`).join('|') || '',
  ]);

  /**
   * Syncs selectedVm state with VM list when it updates.
   * VM list is updated via WebSocket, so this keeps selectedVm in sync.
   */
  useEffect(() => {
    if (!selectedVm || !selectedServer || !vmName) return;

    const updatedVm = selectedServer.vms?.find((vm: any) => vm.name === vmName);
    if (updatedVm && updatedVm.state !== selectedVm.state) {
      setSelectedVm({
        ...selectedVm,
        state: updatedVm.state,
        isOn: updatedVm.state === 'Running' || updatedVm.state === 'running',
      });
    }
  }, [selectedServer?.vms, vmName, selectedVm, setSelectedVm]);

  const distributionName = (location.state as any)?.distributionName;
  const distributionSlug = (location.state as any)?.distributionSlug;
  const clusterName = (location.state as any)?.clusterName;
  const fromCluster = (location.state as any)?.fromCluster;

  const nodeStatus = useMemo(() => {
    if (!selectedServer) return null;
    const serverId = selectedServer.id || selectedServer.ip || selectedServer.fqdn;
    return state.nodeStatuses?.[serverId] || selectedServer.status || null;
  }, [selectedServer, state.nodeStatuses]);

  // Build breadcrumb items if coming from cluster
  const buildBreadcrumbItems = (): BreadcrumbItem[] | null => {
    if (!fromCluster) return null;

    const items: BreadcrumbItem[] = [];

    if (distributionName && distributionSlug) {
      // Full path: Distributions > Distribution > Cluster > VM
      items.push(
        {
          label: 'Distributions',
          onClick: () => navigate('/kubernetes-dashboard'),
        },
        {
          label: distributionName,
          onClick: () => navigate(`/kubernetes-dashboard/${distributionSlug}`),
        },
        {
          label: clusterName || '',
          onClick: () =>
            navigate(`/cluster/${clusterName}/details`, {
              state: { distributionName, distributionSlug },
            }),
        },
        {
          label: selectedVm.name,
          isActive: true,
        }
      );
    } else if (clusterName) {
      // Partial path: Clusters > Cluster > VM
      items.push(
        {
          label: 'Clusters',
        },
        {
          label: clusterName,
          onClick: () => navigate(`/cluster/${clusterName}/details`),
        },
        {
          label: selectedVm.name,
          isActive: true,
        }
      );
    } else {
      // Just VM name
      items.push({
        label: selectedVm.name,
        isActive: true,
      });
    }

    return items;
  };

  const breadcrumbItems = buildBreadcrumbItems();

  const handleBackNavigation = () => {
    if (clusterName) {
      navigate(`/cluster/${clusterName}/details`, {
        state: { distributionName, distributionSlug },
      });
    } else {
      window.history.back();
    }
  };

  /**
   * Manages WebSocket connections for node metrics when dropdown is open.
   * Creates separate WebSocket connections for metrics and efficiency to avoid conflicts.
   */
  useEffect(() => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (!serverAddress || !showNodeMetricsDropdown) {
      return undefined;
    }

    const authToken = localStorage.getItem('accessToken');
    if (!authToken) {
      return undefined;
    }

    // Create separate WebSocket connections for metrics and efficiency
    const metricsWsUrl = `${envConfig().WS_PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/system/metrics/ws?token=${authToken}`;
    const efficiencyWsUrl = `${envConfig().WS_PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/system/efficiency/ws?token=${authToken}`;

    let metricsWs: WebSocket | null = null;
    let efficiencyWs: WebSocket | null = null;

    try {
      // Connect to metrics WebSocket
      metricsWs = new WebSocket(metricsWsUrl);
      metricsWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { cpu, storage, memory } = data;
          setNodeMetrics((prev) => ({
            ...prev,
            cpu,
            storage,
            memory,
          }));
          setLoadingMetrics(false);
        } catch (error) {
          console.warn('Failed to parse metrics data:', error);
        }
      };
      metricsWs.onerror = (error) => {
        console.warn('Metrics WebSocket error:', error);
      };

      // Connect to efficiency WebSocket
      efficiencyWs = new WebSocket(efficiencyWsUrl);
      efficiencyWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Handle efficiency data - match LandingPage pattern
          let efficiencyValue = null;

          if (data && typeof data === 'object') {
            // Try common efficiency field names (match LandingPage: data.efficiency)
            efficiencyValue =
              data.efficiency ||
              data.workload_eff ||
              data.workload_efficiency ||
              data.value ||
              data.efficiency_percent;
          } else if (data !== null && data !== undefined) {
            // Handle direct value (number or string)
            efficiencyValue = data;
          }

          // Convert to string if we have a valid value
          if (efficiencyValue !== null && efficiencyValue !== undefined) {
            const numValue =
              typeof efficiencyValue === 'string'
                ? parseFloat(efficiencyValue)
                : Number(efficiencyValue);
            if (!isNaN(numValue) && isFinite(numValue)) {
              const efficiencyStr = String(numValue);
              setEfficiency(efficiencyStr);
              setNodeMetrics((prev) => ({
                ...prev,
                efficiency: efficiencyStr,
              }));
              setLoadingMetrics(false);
            } else if (typeof efficiencyValue === 'string' && efficiencyValue.trim() !== '') {
              // Handle string values that might not be numeric
              setEfficiency(efficiencyValue);
              setNodeMetrics((prev) => ({
                ...prev,
                efficiency: efficiencyValue,
              }));
              setLoadingMetrics(false);
            }
          }
        } catch (error) {
          console.warn('Failed to parse efficiency data:', error);
        }
      };
      efficiencyWs.onerror = (error) => {
        console.warn('Efficiency WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connections:', error);
    }

    return () => {
      // Clean up both WebSocket connections
      if (metricsWs && metricsWs.readyState === WebSocket.OPEN) {
        metricsWs.close();
      }
      if (efficiencyWs && efficiencyWs.readyState === WebSocket.OPEN) {
        efficiencyWs.close();
      }
    };
  }, [selectedServer, showNodeMetricsDropdown]);

  /**
   * Toggles node metrics dropdown and calculates its position relative to the button.
   * Ensures dropdown stays within viewport bounds.
   */
  const toggleNodeMetricsDropdown = useCallback(() => {
    setShowNodeMetricsDropdown((prev) => {
      const newState = !prev;

      if (newState) {
        // Show loading state immediately when opening dropdown
        setLoadingMetrics(true);
        setNodeMetrics(null);
        setEfficiency(null);

        // Set initial position immediately based on button position (estimated dimensions)
        if (nodeDetailsButtonRef.current) {
          const buttonRect = nodeDetailsButtonRef.current.getBoundingClientRect();
          const estimatedWidth = 400; // max-w-[400px] from className
          const estimatedHeight = 300; // estimated height
          const margin = 8;

          let left = buttonRect.right + window.scrollX - estimatedWidth;
          let top = buttonRect.bottom + window.scrollY + 4;

          // Keep within viewport bounds
          if (left + estimatedWidth + margin > window.innerWidth) {
            left = window.innerWidth - estimatedWidth - margin;
          }
          if (left < margin) {
            left = margin;
          }

          if (top + estimatedHeight + margin > window.innerHeight + window.scrollY) {
            top = buttonRect.top + window.scrollY - estimatedHeight - 4;
          }
          if (top < window.scrollY + margin) {
            top = window.scrollY + margin;
          }

          // Set initial position immediately so dropdown appears instantly
          setDropdownPosition({
            top,
            left,
          });

          // Refine position after dropdown renders with actual dimensions
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (dropdownRef.current && nodeDetailsButtonRef.current) {
                const buttonRect = nodeDetailsButtonRef.current.getBoundingClientRect();
                const dropdownRect = dropdownRef.current.getBoundingClientRect();
                const dropdownWidth = dropdownRect.width;
                const dropdownHeight = dropdownRect.height;
                const margin = 8;

                let left = buttonRect.right + window.scrollX - dropdownWidth;
                let top = buttonRect.bottom + window.scrollY + 4;

                if (left + dropdownWidth + margin > window.innerWidth) {
                  left = window.innerWidth - dropdownWidth - margin;
                }
                if (left < margin) {
                  left = margin;
                }

                if (top + dropdownHeight + margin > window.innerHeight + window.scrollY) {
                  top = buttonRect.top + window.scrollY - dropdownHeight - 4;
                }
                if (top < window.scrollY + margin) {
                  top = window.scrollY + margin;
                }

                setDropdownPosition({
                  top,
                  left,
                });
              }
            });
          });
        }
      } else {
        // Clear loading state when closing
        setLoadingMetrics(false);
        setDropdownPosition(null);
      }

      return newState;
    });
  }, []);

  /**
   * Closes dropdown when clicking outside of it or its trigger button.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        nodeDetailsButtonRef.current &&
        !nodeDetailsButtonRef.current.contains(target)
      ) {
        setShowNodeMetricsDropdown(false);
        setDropdownPosition(null);
      }
    };

    if (showNodeMetricsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNodeMetricsDropdown]);

  /**
   * Handles VM start/stop action.
   * Uses the same pattern as VMDashboard: tracks loading state and refreshes VM list.
   * The UI updates automatically when selectedServer.vms changes via useMemo.
   */
  const handleTogglePower = useCallback(async () => {
    if (!vmName || !serverAddress || !selectedVm) return;

    // Check if already processing
    if (vmActionStatus?.loading || isProcessing) return;

    const action = vmState === 'running' ? 'stop' : 'start';

    // Set loading state
    setVmActionStatus({ action, loading: true });
    setIsProcessing(true);

    try {
      await performVmActionWebSocket(serverAddress, vmName, action, async (status) => {
        if (status.is_final) {
          // Clear loading state
          setVmActionStatus(null);
          setIsProcessing(false);

          if (status.error) {
            toast.error(status.status);
          } else {
            toast.success(`VM ${action}ed successfully`);

            // Create console for start action
            if (action === 'start') {
              try {
                await createConsole(serverAddress, vmName);
              } catch (consoleError) {
                console.warn('Failed to create console after VM start:', consoleError);
              }
            }

            // Refresh VM list - this will update selectedServer.vms
            // which triggers useMemo to recompute vmState, updating the UI
            if (selectedServer) {
              await fetchVMsForServer(selectedServer);
            }
          }
        }
      });
    } catch (error) {
      // Clear loading state on error
      setVmActionStatus(null);
      setIsProcessing(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to ${action} VM: ${errorMessage}`);
    }
  }, [
    vmName,
    serverAddress,
    selectedVm,
    selectedServer,
    vmState,
    vmActionStatus,
    isProcessing,
    performVmActionWebSocket,
    createConsole,
    fetchVMsForServer,
  ]);

  /**
   * Handles VM deletion with approval flow.
   */
  const handleDelete = useCallback(async () => {
    if (!vmName || !serverAddress || isProcessing || !selectedVm) return;

    if (vmState === 'running') {
      toast.error('VM must be stopped before deletion');
      return;
    }

    await executeWithApproval(
      async (approver?: string) => {
        setIsProcessing(true);
        try {
          const payload = {
            datastore: selectedVm.datastore || '',
          };

          await performVmAction(serverAddress, vmName, 'destroy', payload, approver);

          toast.success(`VM ${vmName} was successfully deleted.`);

          if (selectedVm.name === vmName) {
            navigate(`/server/${serverName}/home`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          toast.error(`Failed to delete VM: ${errorMessage}`);
        } finally {
          setIsProcessing(false);
        }
      },
      'Destroy VM',
      `Are you sure you want to permanently delete "${vmName}"? This action cannot be undone.`
    );
  }, [
    vmName,
    serverAddress,
    selectedVm,
    vmState,
    isProcessing,
    performVmAction,
    executeWithApproval,
    navigate,
    serverName,
  ]);

  /**
   * Handles VM restart action.
   * Uses the same pattern as VMDashboard: tracks loading state and refreshes VM list.
   */
  const handleRestart = useCallback(async () => {
    if (!vmName || !serverAddress || !selectedVm) return;

    // Check if already processing
    if (vmActionStatus?.loading || isProcessing) return;

    if (vmState !== 'running') {
      toast.error('VM must be running to restart');
      return;
    }

    // Set loading state
    setVmActionStatus({ action: 'restart', loading: true });
    setIsProcessing(true);

    try {
      await performVmActionWebSocket(serverAddress, vmName, 'restart', async (status: any) => {
        if (status.is_final) {
          // Clear loading state
          setVmActionStatus(null);
          setIsProcessing(false);

          if (status.error) {
            toast.error(`Failed to restart VM: ${status.status || 'Unknown error'}`);
          } else {
            toast.success('VM restart initiated');
            // Refresh VM list to sync with server
            if (selectedServer) {
              await fetchVMsForServer(selectedServer);
            }
          }
        }
      });
    } catch (error) {
      // Clear loading state on error
      setVmActionStatus(null);
      setIsProcessing(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to restart VM: ${errorMessage}`);
    }
  }, [
    vmName,
    serverAddress,
    selectedVm,
    selectedServer,
    vmState,
    vmActionStatus,
    isProcessing,
    performVmActionWebSocket,
    fetchVMsForServer,
  ]);

  /**
   * Refreshes hardware page data by dispatching a custom event
   * that the hardware component listens for.
   */
  const handleRefresh = useCallback(async () => {
    if (!serverAddress || isProcessing) return;

    setIsProcessing(true);
    try {
      window.dispatchEvent(
        new CustomEvent('refreshHardwarePage', {
          detail: {
            vmName,
            serverAddress,
            timestamp: Date.now(),
          },
        })
      );

      if (selectedServer) {
        await fetchVMsForServer(selectedServer);
      }
      toast.success('Hardware page refreshed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to refresh: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [serverAddress, vmName, selectedServer, isProcessing, fetchVMsForServer]);

  if (!selectedVm || !selectedServer) {
    if (!dataCenters || dataCenters.length === 0) {
      return <div className="text-center p-6">Please Select a VM</div>;
    }
  }

  if (!serverName || !vmName) {
    return <div className="text-center p-6">Invalid server or VM selection</div>;
  }

  return (
    <>
      <>
        {breadcrumbItems && (
          <Breadcrumbs
            items={breadcrumbItems}
            onBack={handleBackNavigation}
            className="py-1 mb-1 px-3"
          />
        )}

        <div className="sticky top-0 z-10 bg-white border-b border-gray-200/60 shadow-sm mb-2 backdrop-blur-sm">
          <div className="flex flex-col px-4 py-2 overflow-x-auto whitespace-nowrap gap-0">
            <div className="flex flex-col  flex-row  items-center  justify-between gap-3 py-2">
              <div className="flex items-center gap-2.5 text-sm min-w-0 flex-1">
                {selectedVm?.hostname && (
                  <>
                    <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-50 transition-colors">
                      <FaServer className="w-4 h-4 text-gray-500" />
                      <a
                        href={`/server/${selectedVm.hostname.split('.')[0]}/home`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/server/${selectedVm.hostname.split('.')[0]}/home`);
                        }}
                        className="text-karios-blue hover:text-blue-700 font-semibold cursor-pointer transition-colors"
                        title="Go to Node Home"
                      >
                        {selectedVm.hostname.split('.')[0]}
                      </a>
                    </div>
                    <span className="text-gray-400 font-medium">/</span>
                  </>
                )}
                <span className="text-gray-900 font-semibold text-base">{selectedVm?.name}</span>
                {migrationSource && (
                  <span className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                    {migrationSource}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 gap-2.5 flex-shrink-0">
                <div className="flex items-center gap-1.5 gap-2">
                  {/* VM Action Buttons - COMMENTED OUT FOR FUTURE USE */}
                  {/* <div className="h-9 flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1">
                    {(() => {
                      const isRunning = vmState === 'running';
                      const isTransitioning = vmActionStatus?.loading || false;
                      const transitioningAction = vmActionStatus?.action;
                      const isRestricted = vmName ? isVmNameRestricted(vmName) : false;

                      // Show loading spinner during transition
                      if (isTransitioning) {
                        return (
                          <button
                            disabled
                            className="h-7 w-7 flex items-center justify-center rounded transition-all duration-200 cursor-not-allowed"
                            title={
                              transitioningAction === 'start'
                                ? 'Starting...'
                                : transitioningAction === 'stop'
                                  ? 'Stopping...'
                                  : transitioningAction === 'restart'
                                    ? 'Restarting...'
                                    : 'Processing...'
                            }
                          >
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                          </button>
                        );
                      }

                      if (!isRunning) {
                        return (
                          <button
                            onClick={handleTogglePower}
                            disabled={isProcessing || isRestricted}
                            className="h-7 w-7 flex items-center justify-center rounded transition-all duration-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isRestricted ? 'VM actions not available for technical VMs' : 'Start VM'}
                          >
                            <FaPlay className="w-5 h-5 text-green-600" />
                          </button>
                        );
                      }

                      return (
                        <>
                          <button
                            onClick={handleRestart}
                            disabled={isProcessing || isRestricted}
                            className="h-7 w-7 flex items-center justify-center rounded transition-all duration-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isRestricted ? 'VM actions not available for technical VMs' : 'Restart VM'}
                          >
                            <FaRedo className="w-5 h-5 text-blue-600" />
                          </button>
                          <button
                            onClick={handleTogglePower}
                            disabled={isProcessing || isRestricted}
                            className="h-7 w-7 flex items-center justify-center rounded transition-all duration-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isRestricted ? 'VM actions not available for technical VMs' : 'Stop VM'}
                          >
                            <FaStop className="w-5 h-5 text-red-600" />
                          </button>
                        </>
                      );
                    })()}

                    <button
                      onClick={handleDelete}
                      disabled={vmActionStatus?.loading || isProcessing || vmState === 'running' || (vmName ? isVmNameRestricted(vmName) : false)}
                      className="h-7 w-7 flex items-center justify-center rounded transition-all duration-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        vmName && isVmNameRestricted(vmName)
                          ? 'VM actions not available for technical VMs'
                          : vmActionStatus?.loading || isProcessing
                            ? 'Deleting...'
                            : vmState === 'running'
                              ? 'Stop VM first'
                              : 'Delete VM'
                      }
                    >
                      <FaTrashAlt className="w-5 h-5 text-red-600" />
                    </button>
                  </div> */}

                  <button
                    onClick={handleRefresh}
                    disabled={isProcessing}
                    className="h-9 w-9 flex items-center justify-center bg-white border border-gray-200 rounded-lg transition-all duration-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isProcessing ? 'Refreshing hardware page...' : 'Refresh hardware page'}
                  >
                    <FaSync
                      className={`w-5 h-5 text-gray-600 ${isProcessing ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>

                <div className="h-6 w-px bg-gray-300"></div>

                <div className="relative">
                  <button
                    ref={nodeDetailsButtonRef}
                    onClick={toggleNodeMetricsDropdown}
                    className={`h-9 px-2  px-4 text-sm font-medium rounded-lg text-white flex items-center gap-1.5  gap-2 transition-all duration-200 shadow-sm hover:shadow-md ${
                      showNodeMetricsDropdown
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-md'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                    }`}
                  >
                    <FaInfoCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden md:inline font-medium">Node Details</span>
                    <FaChevronDown
                      className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${showNodeMetricsDropdown ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-gray-50/50 h-[42px] px-3 rounded-lg border border-gray-100">
              <NavItem
                to={`/server/${serverName}/vm/${vmName}/hardware`}
                icon={Cpu}
                label="Hardware"
              />
              <NavItem
                to={`/server/${serverName}/vm/${vmName}/console`}
                icon={Code1}
                label="Console"
              />
              <NavItem
                to={`/server/${serverName}/vm/${vmName}/snapshots`}
                icon={Gallery}
                label="Snapshots"
              />
              <NavItem
                to={`/server/${serverName}/vm/${vmName}/logs`}
                icon={KeyboardOpen}
                label="Activity Logs"
              />
              <NavItem
                to={`/server/${serverName}/vm/${vmName}/bhyve-logs`}
                icon={LuLogs}
                label="System Logs"
              />
            </div>
          </div>
        </div>
        <ScrollableContent hasTopBar={true} topBarHeight="80px">
          <div className="p-0 min-h-full bg-white">
            {isVmBasePath && (
              <Navigate to={`/server/${serverName}/vm/${vmName}/hardware`} replace />
            )}

            <Routes>
              <Route path="hardware" element={<Hardware />} />
              <Route path="console" element={<Console />} />
              <Route path="snapshots" element={<SnapshotManager />} />
              <Route path="logs" element={<ActivityLogs />} />
              <Route path="bhyve-logs" element={<BhyveLogs />} />
            </Routes>
          </div>
        </ScrollableContent>
      </>

      {showNodeMetricsDropdown &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`fixed bg-white border-2 border-gray-300 rounded-xl shadow-2xl z-[9999] w-[calc(100vw-2rem)] min-w-[360px] max-w-[400px] backdrop-blur-sm ${
              dropdownPosition ? 'visible' : 'invisible'
            }`}
            style={
              dropdownPosition
                ? {
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                  }
                : {
                    top: '-9999px',
                    left: '-9999px',
                  }
            }
          >
            {loadingMetrics || !nodeMetrics ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-500 border-t-transparent mx-auto"></div>
                <p className="mt-3 text-sm text-gray-600 font-medium">Loading metrics...</p>
              </div>
            ) : (
              <div className="p-4">
                {/* Node Name and Status Header */}
                <div className="mb-3 pb-3 border-b border-gray-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FaServer className="w-4 h-4 text-gray-500" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const nodeName =
                            selectedVm?.hostname?.split('.')[0] || selectedServer?.name;
                          if (nodeName) {
                            navigate(`/server/${nodeName}/home`);
                            setShowNodeMetricsDropdown(false);
                          }
                        }}
                        className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        {selectedVm?.hostname?.split('.')[0] || selectedServer?.name || 'Node'}
                      </button>
                    </div>
                    {/* Status Dot */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          nodeStatus === 'online' || nodeStatus === 'active'
                            ? 'bg-green-500'
                            : nodeStatus === 'offline' || nodeStatus === 'inactive'
                              ? 'bg-red-500'
                              : 'bg-gray-400'
                        }`}
                        title={nodeStatus || 'Unknown'}
                      ></span>
                      <span className="text-xs text-gray-600 capitalize">
                        {nodeStatus || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                    <FaInfoCircle className="w-3 h-3 text-blue-600" />
                    Node Metrics
                  </div>
                </div>
                {/* Metrics Grid - 2x2 layout */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* CPU Usage */}
                  {(() => {
                    const cpuValue =
                      typeof nodeMetrics?.cpu === 'object'
                        ? nodeMetrics.cpu?.total_usage_percent
                        : nodeMetrics?.cpu;
                    const cpuColors = getMetricColorClasses(cpuValue, 'cpu');
                    return (
                      <div
                        className={`${cpuColors.bgColor} rounded-lg p-2  p-3 border ${cpuColors.borderColor} transition-colors`}
                      >
                        <div className="flex items-center gap-1  gap-1.5 mb-1  mb-1.5">
                          <HiMiniCpuChip
                            size={12}
                            className=" w-[14px]  h-[14px] flex-shrink-0"
                            color={cpuColors.iconColor}
                          />
                          <span
                            className={`text-[10px]  text-xs font-semibold ${cpuColors.textColor} uppercase leading-tight`}
                          >
                            CPU
                          </span>
                        </div>
                        <div
                          className={`text-sm  text-base font-bold ${cpuColors.textColor} mb-1  mb-1.5`}
                        >
                          {cpuValue ? `${cpuValue}%` : 'N/A'}
                        </div>
                        {cpuValue && typeof cpuValue === 'number' && (
                          <div className="mt-1.5">
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`${cpuColors.progressBarColor} h-full rounded-full transition-all`}
                                style={{ width: `${Math.min(cpuValue, 100)}%` }}
                                role="progressbar"
                                aria-valuenow={cpuValue}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Memory Usage */}
                  {(() => {
                    const memoryValue = nodeMetrics?.memory;
                    const memoryColors = getMetricColorClasses(memoryValue, 'memory');
                    return (
                      <div
                        className={`${memoryColors.bgColor} rounded-lg p-2  p-3 border ${memoryColors.borderColor} transition-colors`}
                      >
                        <div className="flex items-center gap-1  gap-1.5 mb-1  mb-1.5">
                          <PiMemoryDuotone
                            size={12}
                            className=" w-[14px]  h-[14px]"
                            color={memoryColors.iconColor}
                          />
                          <span
                            className={`text-[10px]  text-xs font-semibold ${memoryColors.textColor} uppercase leading-tight`}
                          >
                            MEMORY
                          </span>
                        </div>
                        <div
                          className={`text-sm  text-base font-bold ${memoryColors.textColor} mb-1  mb-1.5`}
                        >
                          {memoryValue ? `${memoryValue}%` : 'N/A'}
                        </div>
                        {memoryValue && (
                          <div className="mt-1.5">
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`${memoryColors.progressBarColor} h-full rounded-full transition-all`}
                                style={{ width: `${Math.min(memoryValue, 100)}%` }}
                                role="progressbar"
                                aria-valuenow={memoryValue}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Storage Usage */}
                  {(() => {
                    const storageValue = nodeMetrics?.storage;
                    const storageColors = getMetricColorClasses(storageValue, 'storage');
                    return (
                      <div
                        className={`${storageColors.bgColor} rounded-lg p-2  p-3 border ${storageColors.borderColor} transition-colors`}
                      >
                        <div className="flex items-center gap-1  gap-1.5 mb-1  mb-1.5">
                          <BsHdd
                            size={12}
                            className=" w-[14px]  h-[14px]"
                            color={storageColors.iconColor}
                          />
                          <span
                            className={`text-[10px]  text-xs font-semibold ${storageColors.textColor} uppercase leading-tight`}
                          >
                            STORAGE
                          </span>
                        </div>
                        <div
                          className={`text-sm  text-base font-bold ${storageColors.textColor} mb-1  mb-1.5`}
                        >
                          {storageValue ? `${storageValue}%` : 'N/A'}
                        </div>
                        {storageValue && (
                          <div className="mt-1.5">
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`${storageColors.progressBarColor} h-full rounded-full transition-all`}
                                style={{ width: `${Math.min(storageValue, 100)}%` }}
                                role="progressbar"
                                aria-valuenow={storageValue}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Efficiency */}
                  {(() => {
                    const efficiencyValue = nodeMetrics?.efficiency || efficiency;
                    const efficiencyColors = getMetricColorClasses(efficiencyValue, 'efficiency');
                    return (
                      <div
                        className={`${efficiencyColors.bgColor} rounded-lg p-2  p-3 border ${efficiencyColors.borderColor} transition-colors`}
                      >
                        <div className="flex items-center gap-1  gap-1.5 mb-1  mb-1.5">
                          <CpuSetting
                            size={12}
                            className=" w-[14px]  h-[14px]"
                            color={efficiencyColors.iconColor}
                          />
                          <span
                            className={`text-[10px]  text-xs font-semibold ${efficiencyColors.textColor} uppercase leading-tight`}
                          >
                            EFFICIENCY
                          </span>
                        </div>
                        <div
                          className={`text-sm  text-base font-bold ${efficiencyColors.textColor} mb-1  mb-1.5`}
                        >
                          {efficiencyValue ? `${efficiencyValue}%` : 'N/A'}
                        </div>
                        {efficiencyValue &&
                          (() => {
                            const effNum =
                              typeof efficiencyValue === 'string'
                                ? parseFloat(efficiencyValue)
                                : efficiencyValue;
                            return (
                              !isNaN(effNum) && (
                                <div className="mt-1.5">
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`${efficiencyColors.progressBarColor} h-full rounded-full transition-all`}
                                      style={{ width: `${Math.min(effNum, 100)}%` }}
                                      role="progressbar"
                                      aria-valuenow={effNum}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                    />
                                  </div>
                                </div>
                              )
                            );
                          })()}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
}

/**
 * Navigation item component for VM tabs.
 * Displays icon and label with active state styling.
 */
export function NavItem({ to, icon: Icon, label }: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 text-md px-[10px] pt-4 pb-0 transition-colors duration-200 ${isActive ? 'text-karios-green relative' : 'text-gray-700 hover:text-blue-600'}`
      }
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {({ isActive }) => {
        // Use hex color for icon color prop (iconsax and react-icons use color prop)
        const iconColor =
          isActive || isHovered
            ? '#3ca6f2' // karios-blue hex value
            : '#000000';

        const isReactIcon = typeof Icon === 'function' && Icon.name && Icon.name.startsWith('Fa');

        return (
          <div className="relative">
            <div className="flex items-center mb-1">
              {isReactIcon ? (
                <Icon
                  size={20}
                  color={iconColor}
                  className="transition-colors duration-200"
                  fill={iconColor}
                />
              ) : (
                <Icon size={20} color={iconColor} className="transition-colors duration-200" />
              )}
              <span className="ml-1 font-medium">{label}</span>
            </div>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-karios-blue"></div>
            )}
          </div>
        );
      }}
    </NavLink>
  );
}
