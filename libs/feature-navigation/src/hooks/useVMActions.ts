/**
 * useVMActions Hook
 * Consolidates all VM action handlers (power, rename, clone, delete, etc.)
 * Extracted from SideBar.tsx to reduce complexity and improve reusability
 *
 * Handles:
 * - VM Power operations (toggle, restart, reset, poweroff)
 * - VM Lifecycle operations (rename, clone, delete, unlock)
 * - Modal state management for VM operations
 * - Approval flow integration
 * - Smart navigation after VM operations
 */

import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { ActionTypes } from '../../../shared-state/src/utils/actionTypes';
import { fetchVmListForNode } from '../../../shared-state/src/utils/apiService';
import {
  validateVmNameForRename,
  validateVmNameForClone,
  isValidVmName,
} from '../utils/vmValidation';
import { isClusterVM, getFullClusterName, isLastClusterVM } from '../utils/clusterUtilities';

type VirtualMachine = any;
type ServerNode = any;
type DataCenter = any;

interface UseVMActionsProps {
  // Execution functions
  performVmActionWebSocket: (
    serverIp: string,
    vmName: string,
    action: string,
    callback: (status: any) => Promise<void>,
    vmUuid?: string
  ) => Promise<void>;
  performVmAction: (
    serverIp: string,
    vmName: string,
    action: string,
    payload: any,
    approver?: string,
    vmUuid?: string
  ) => Promise<void>;
  renameVmInContext: (
    serverIp: string,
    vmName: string,
    datastore: string,
    newName: string,
    approver?: string,
    vmUuid?: string
  ) => Promise<void>;
  cloneVmInContext: (
    serverIp: string,
    vmName: string,
    datastore: string,
    newName: string,
    approver?: string,
    vmUuid?: string
  ) => Promise<void>;
  unlockVmApi: (vmName: string, serverIp: string) => Promise<void>;
  createConsole: (serverIp: string, vmName: string) => Promise<void>;
  checkVmPcieDevices: (
    vmName: string,
    serverIp: string
  ) => Promise<{ hasDevices: boolean; devices: any[] }>;
  executeWithApproval: (
    action: (approverParam?: string) => Promise<void> | void,
    actionTitle?: string,
    actionMessage?: string
  ) => void | Promise<void>;

  // State setters
  setVmActionStatuses: (callback: (prev: any) => any) => void;
  setDropdownVmName: (name: string | null) => void;
  setCurrentRenameVm: (vm: VirtualMachine | null) => void;
  setCurrentServerIp: (ip: string) => void;
  setNewVmName: (name: string) => void;
  setRenameError: (error: string) => void;
  setNameValidationError: (error: string) => void;
  setIsRenameModalOpen: (open: boolean) => void;
  setCurrentCloneVm: (vm: VirtualMachine | null) => void;
  setNewCloneVmName: (name: string) => void;
  setCloneModalMode: (
    mode: 'clone' | 'edit' | 'powered-on' | 'pcie-warning' | 'input' | 'error' | 'name-exists'
  ) => void;
  setIsCloneModalOpen: (open: boolean) => void;
  setPcieDevicesList: (devices: any[]) => void;
  setCloneErrorMessage: (message: string) => void;
  setRefreshingVms: (callback: (prev: any) => any) => void;
  setCurrentDeleteVm: (vm: VirtualMachine | null) => void;
  setIsDeleteModalOpen: (open: boolean) => void;
  setDeleteButtonClicked: (clicked: boolean) => void;
  setIsDeleting: (deleting: boolean) => void;
  setActionModalTitle: (title: string) => void;
  setActionModalMessage: (message: string) => void;
  setActionModalType: (type: 'success' | 'error') => void;
  setIsActionModalOpen: (open: boolean) => void;

  // State values
  dataCenters: DataCenter[];
  selectedVm: VirtualMachine | null;
  activeSection: 'control-center' | 'clusters' | 'migrate' | 'licenses' | null;
  currentRenameVm: VirtualMachine | null;
  currentCloneVm: VirtualMachine | null;
  currentDeleteVm: VirtualMachine | null;
  currentServerIp: string;
  newVmName: string;
  newCloneVmName: string;
  deleteButtonClicked: boolean;
  refreshingVms: Record<string, boolean>;

  // Helper functions
  isVmInAnyTransition: (vmName: string) => boolean;
  findServerByIp: (serverIp: string) => ServerNode | undefined;
  handleSmartNavigationAfterVmDelete: (
    deletedVm: VirtualMachine,
    isLastVmInCluster: boolean
  ) => Promise<void>;
  refreshVmsList?: () => Promise<void>;

  // Redux & Navigation
  dispatch: any;
  navigate: any;
  logger: any;

  // Approval flow
  refreshClusterData: (forceRefresh?: boolean) => Promise<void>;
  refreshClusterDataForServer: (serverIp: string, action: string) => Promise<void>;
}

export const useVMActions = ({
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
  findServerByIp,
  handleSmartNavigationAfterVmDelete,
  refreshVmsList,

  // Redux & Navigation
  dispatch,
  navigate,
  logger,

  // Cluster operations
  refreshClusterData,
  refreshClusterDataForServer,
}: UseVMActionsProps) => {
  // Helper function to fetch UUID for a VM from the REST API
  const getVmUuid = async (
    serverIp: string,
    vmName: string,
    providedUuid?: string
  ): Promise<string> => {
    // If UUID is already provided, use it
    if (providedUuid) {
      return providedUuid;
    }

    // Otherwise, fetch from REST API using the shared-state utility
    try {
      const vmsData = await fetchVmListForNode(serverIp);
      const vm = vmsData.find((v: any) => v.name === vmName);

      if (vm && vm.uuid) {
        logger.info(`[DEBUG] Fetched UUID for ${vmName}: ${vm.uuid}`);
        return vm.uuid;
      }

      // Fallback to vmName if UUID not found - the API should accept VM name as identifier
      logger.warn(`[WARN] UUID not found for VM ${vmName}, falling back to VM name`);
      return vmName;
    } catch (error) {
      logger.error(`Error fetching UUID for VM ${vmName}:`, error);
      // Fallback to vmName on error - the API should accept VM name as identifier
      logger.warn(`Falling back to VM name as identifier for ${vmName}`);
      return vmName;
    }
  };

  // Handle VM Power Toggle (Start/Stop)
  const handleToggleVmPower = useCallback(
    async (vmName: string, currentIsOn: boolean, serverIp: string, vmUuid?: string) => {
      logger.info(
        `[DEBUG] handleToggleVmPower called - vmName: ${vmName}, serverIp: ${serverIp}, vmUuid: ${vmUuid}`
      );
      if (isVmInAnyTransition(vmName)) {
        return;
      }

      const action = currentIsOn ? 'stop' : 'start';

      try {
        setDropdownVmName(null);

        // Fetch UUID if not provided
        const uuid = await getVmUuid(serverIp, vmName, vmUuid);

        logger.info(
          `[DEBUG] handleToggleVmPower - About to call performVmActionWebSocket with serverIp: ${serverIp}`
        );
        await performVmActionWebSocket(
          serverIp,
          vmName,
          action,
          async (status) => {
            setVmActionStatuses((prev) => ({
              ...prev,
              [vmName]: {
                is_final: status.is_final,
                error: status.error || false,
                status: status.status,
              },
            }));

            if (status.is_final) {
              if (status.error) {
                toast.error(status.status);
                setVmActionStatuses((prev) => {
                  const updated = { ...prev };
                  delete updated[vmName];
                  return updated;
                });
              } else {
                const statusText = status.status.toLowerCase();
                if (statusText.includes('running')) {
                  try {
                    await createConsole(serverIp, vmName);
                  } catch (consoleError) {
                    logger.warn('Failed to create console');
                  }
                }

                setVmActionStatuses((prev) => {
                  const updated = { ...prev };
                  delete updated[vmName];
                  return updated;
                });

                // Dispatch custom event to notify other components (e.g., console) about VM state change
                const newState = statusText.includes('running')
                  ? 'Running'
                  : statusText.includes('stopped')
                    ? 'Stopped'
                    : status.status;

                // Update global state for immediate access
                (window as any).vmStatesGlobal = (window as any).vmStatesGlobal || {};
                (window as any).vmStatesGlobal[vmName] = newState;

                const vmStateChangeEvent = new CustomEvent('vmStateChanged', {
                  detail: {
                    vmName,
                    newState,
                    serverIp,
                    action,
                    timestamp: Date.now(),
                  },
                });
                window.dispatchEvent(vmStateChangeEvent);

                // WebSocket will handle VM list updates
                if (activeSection === 'clusters') {
                  await refreshClusterDataForServer(serverIp, action);
                }
              }
            }
          },
          uuid
        );
      } catch (error: unknown) {
        setVmActionStatuses((prev) => {
          const updated = { ...prev };
          delete updated[vmName];
          return updated;
        });

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(`Failed to ${action} VM: ${errorMessage}`);

        // WebSocket provides real-time updates
        if (activeSection === 'clusters') {
          await refreshClusterData(true);
        }
      }
    },
    [
      isVmInAnyTransition,
      performVmActionWebSocket,
      setDropdownVmName,
      setVmActionStatuses,
      createConsole,
      activeSection,
      refreshClusterDataForServer,
      refreshClusterData,
      logger,
    ]
  );

  // Handle VM Rename
  const handleRenameVm = useCallback(
    async (currentVm: VirtualMachine, serverIp: string) => {
      if (isVmInAnyTransition(currentVm.name)) {
        return;
      }

      setCurrentRenameVm(currentVm);
      setCurrentServerIp(serverIp);
      setNewVmName(currentVm.name);
      setRenameError('');
      setNameValidationError('');
      setIsRenameModalOpen(true);
    },
    [
      isVmInAnyTransition,
      setCurrentRenameVm,
      setCurrentServerIp,
      setNewVmName,
      setRenameError,
      setNameValidationError,
      setIsRenameModalOpen,
    ]
  );

  // Handle VM Name Change with Validation
  const handleVmNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value;
      setNewVmName(name);
      setRenameError('');

      const validationError = validateVmNameForRename(
        name,
        currentServerIp,
        currentRenameVm,
        dataCenters
      );
      setNameValidationError(validationError);
    },
    [
      currentServerIp,
      currentRenameVm,
      dataCenters,
      setNewVmName,
      setRenameError,
      setNameValidationError,
    ]
  );

  // Confirm VM Rename
  const confirmRename = useCallback(async () => {
    if (!currentRenameVm || !newVmName || newVmName === currentRenameVm.name) {
      if (currentRenameVm && newVmName === currentRenameVm.name) {
        setRenameError('Please enter a different name.');
      }
      return;
    }

    const validationError = validateVmNameForRename(
      newVmName,
      currentServerIp,
      currentRenameVm,
      dataCenters
    );
    if (validationError) {
      setNameValidationError(validationError);
      return;
    }

    if (isVmInAnyTransition(currentRenameVm.name)) {
      setRenameError(
        'VM is currently in transition. Please wait for the current operation to complete.'
      );
      return;
    }

    if (currentRenameVm.state === 'Running' || currentRenameVm.state === 'Locked') {
      setRenameError('Please turn off the VM before renaming.');
      return;
    }

    if (!currentServerIp) {
      setRenameError('Server IP is missing. Please try again.');
      return;
    }

    try {
      setRefreshingVms((prev) => ({ ...prev, [currentRenameVm.name]: true }));

      await executeWithApproval(
        async (approver?: string) => {
          // Fetch fresh UUID
          const uuid = await getVmUuid(currentServerIp, currentRenameVm.name, currentRenameVm.uuid);
          await renameVmInContext(
            currentServerIp,
            currentRenameVm.name,
            currentRenameVm.datastore || '',
            newVmName,
            approver,
            uuid
          );

          setDropdownVmName(null);
          setIsRenameModalOpen(false);

          setActionModalTitle('VM Renamed');
          setActionModalMessage(
            `VM ${currentRenameVm.name} was successfully renamed to ${newVmName}.`
          );
          setActionModalType('success');
          setIsActionModalOpen(true);

          // WebSocket provides real-time updates
          if (activeSection === 'clusters') {
            await refreshClusterData(true);
          }

          const updatedVm = { ...currentRenameVm, name: newVmName };
          dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: updatedVm });

          const serverToRefresh = findServerByIp(currentServerIp);
          if (serverToRefresh) {
            navigate(`/server/${serverToRefresh.name}/vm/${newVmName}/hardware`);
          }
        },
        'Rename VM',
        `Are you sure you want to rename "${currentRenameVm.name}" to "${newVmName}"?`
      );
    } catch (error: unknown) {
      setIsRenameModalOpen(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setActionModalTitle('Failed to Rename VM');
      setActionModalMessage(`Failed to rename VM: ${errorMessage}`);
      setActionModalType('error');
      setIsActionModalOpen(true);
    } finally {
      setRefreshingVms((prev) => ({ ...prev, [currentRenameVm.name]: false }));
    }
  }, [
    currentRenameVm,
    newVmName,
    currentServerIp,
    dataCenters,
    isVmInAnyTransition,
    setRenameError,
    setNameValidationError,
    setRefreshingVms,
    executeWithApproval,
    setDropdownVmName,
    setIsRenameModalOpen,
    setActionModalTitle,
    setActionModalMessage,
    setActionModalType,
    setIsActionModalOpen,
    findServerByIp,
    activeSection,
    refreshClusterData,
    dispatch,
    navigate,
  ]);

  // Handle VM Clone
  const handleCloneVm = useCallback(
    async (currentVm: VirtualMachine, serverIp: string) => {
      if (isVmInAnyTransition(currentVm.name)) {
        return;
      }

      setCurrentCloneVm(currentVm);
      setCurrentServerIp(serverIp);

      if (currentVm.isOn) {
        setCloneModalMode('powered-on');
        setIsCloneModalOpen(true);
        return;
      }

      try {
        const { hasDevices, devices } = await checkVmPcieDevices(currentVm.name, serverIp);
        setPcieDevicesList(devices);

        if (hasDevices) {
          setCloneModalMode('pcie-warning');
          setIsCloneModalOpen(true);
          setDropdownVmName(null);
          return;
        }
      } catch (error) {
        logger.error('Error checking PCIe devices during clone:', error);
      }

      setNewCloneVmName(`${currentVm.name}_clone`);
      setCloneModalMode('input');
      setIsCloneModalOpen(true);
      setDropdownVmName(null);
    },
    [
      isVmInAnyTransition,
      setCurrentCloneVm,
      setCurrentServerIp,
      setCloneModalMode,
      setIsCloneModalOpen,
      checkVmPcieDevices,
      setPcieDevicesList,
      setNewCloneVmName,
      setDropdownVmName,
      logger,
    ]
  );

  // Proceed with Clone After PCIe Warning
  const proceedWithCloneAfterPcieWarning = useCallback(() => {
    setNewCloneVmName(`${currentCloneVm?.name}_clone`);
    setCloneModalMode('input');
  }, [currentCloneVm, setNewCloneVmName, setCloneModalMode]);

  // Confirm VM Clone
  const confirmClone = useCallback(async () => {
    if (!newCloneVmName) {
      return;
    }

    if (currentCloneVm && isVmInAnyTransition(currentCloneVm.name)) {
      setCloneModalMode('error');
      setCloneErrorMessage(
        'VM is currently in transition. Please wait for the current operation to complete.'
      );
      return;
    }

    if (
      dataCenters.some((dc) =>
        dc.servers.some((s: ServerNode) =>
          s.vms?.some((vm: VirtualMachine) => vm.name === newCloneVmName)
        )
      )
    ) {
      setCloneModalMode('name-exists');
      return;
    }

    if (!currentServerIp || !currentCloneVm) {
      setCloneModalMode('error');
      setCloneErrorMessage('Required VM information is missing. Please try again.');
      return;
    }

    try {
      setRefreshingVms((prev) => ({ ...prev, [currentCloneVm.name]: true }));

      await executeWithApproval(
        async (approver?: string) => {
          // Fetch fresh UUID
          const uuid = await getVmUuid(currentServerIp, currentCloneVm.name, currentCloneVm.uuid);
          await cloneVmInContext(
            currentServerIp,
            currentCloneVm.name,
            currentCloneVm.datastore || '',
            newCloneVmName,
            approver,
            uuid
          );

          setIsCloneModalOpen(false);

          setActionModalTitle('Clone VM');
          setActionModalMessage(
            `VM ${currentCloneVm.name} cloned successfully as ${newCloneVmName}.`
          );
          setActionModalType('success');
          setIsActionModalOpen(true);

          // WebSocket provides real-time updates
          if (activeSection === 'clusters') {
            await refreshClusterData(true);
          }
        },
        'Clone VM',
        `Are you sure you want to clone "${currentCloneVm.name}" as "${newCloneVmName}"?`
      );
    } catch (error: unknown) {
      setIsCloneModalOpen(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setActionModalTitle('Failed to Clone VM');
      setActionModalMessage(`Failed to clone VM: ${errorMessage}`);
      setActionModalType('error');
      setIsActionModalOpen(true);
    } finally {
      if (currentCloneVm) {
        setRefreshingVms((prev) => ({ ...prev, [currentCloneVm.name]: false }));
      }
    }
  }, [
    newCloneVmName,
    currentCloneVm,
    currentServerIp,
    dataCenters,
    isVmInAnyTransition,
    setCloneModalMode,
    setCloneErrorMessage,
    setRefreshingVms,
    executeWithApproval,
    setIsCloneModalOpen,
    setActionModalTitle,
    setActionModalMessage,
    setActionModalType,
    setIsActionModalOpen,
    activeSection,
    refreshClusterData,
  ]);

  // Handle VM Restart
  const handleRestartVm = useCallback(
    async (vmName: string, serverIp: string, vmUuid?: string) => {
      if (isVmInAnyTransition(vmName)) {
        return;
      }

      try {
        setDropdownVmName(null);

        // Fetch UUID if not provided
        const uuid = await getVmUuid(serverIp, vmName, vmUuid);

        await performVmActionWebSocket(
          serverIp,
          vmName,
          'restart',
          async (status) => {
            setVmActionStatuses((prev) => ({
              ...prev,
              [vmName]: {
                is_final: status.is_final,
                error: status.error || false,
                status: status.status,
              },
            }));

            if (status.is_final) {
              if (status.error) {
                setActionModalTitle('Failed to Restart VM');
                setActionModalMessage(status.status);
                setActionModalType('error');
                setIsActionModalOpen(true);
              } else {
                setActionModalTitle('Restart VM');
                setActionModalMessage(`VM ${vmName} restarted successfully.`);
                setActionModalType('success');
                setIsActionModalOpen(true);

                if (activeSection === 'clusters') {
                  await refreshClusterData(true);
                } else if (refreshVmsList) {
                  await refreshVmsList();
                }
              }

              setVmActionStatuses((prev) => {
                const updated = { ...prev };
                delete updated[vmName];
                return updated;
              });
            }
          },
          uuid
        );
      } catch (error: unknown) {
        setVmActionStatuses((prev) => {
          const updated = { ...prev };
          delete updated[vmName];
          return updated;
        });

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setActionModalTitle('Failed to Restart VM');
        setActionModalMessage(`Failed to restart VM: ${errorMessage}`);
        setActionModalType('error');
        setIsActionModalOpen(true);
      }
    },
    [
      isVmInAnyTransition,
      setDropdownVmName,
      performVmActionWebSocket,
      setVmActionStatuses,
      setActionModalTitle,
      setActionModalMessage,
      setActionModalType,
      setIsActionModalOpen,
      activeSection,
      refreshClusterData,
      refreshVmsList,
    ]
  );

  // Handle VM Reset
  const handleResetVm = useCallback(
    async (vmName: string, serverIp: string, vmUuid?: string) => {
      if (isVmInAnyTransition(vmName)) {
        return;
      }

      try {
        setDropdownVmName(null);

        // Fetch UUID if not provided
        const uuid = await getVmUuid(serverIp, vmName, vmUuid);

        await performVmActionWebSocket(
          serverIp,
          vmName,
          'reset',
          async (status) => {
            setVmActionStatuses((prev) => ({
              ...prev,
              [vmName]: {
                is_final: status.is_final,
                error: status.error || false,
                status: status.status,
              },
            }));

            if (status.is_final) {
              if (status.error) {
                setActionModalTitle('Failed to Reset VM');
                setActionModalMessage(status.status);
                setActionModalType('error');
                setIsActionModalOpen(true);
              } else {
                setActionModalTitle('Reset VM');
                setActionModalMessage(`VM ${vmName} reset successfully.`);
                setActionModalType('success');
                setIsActionModalOpen(true);

                // WebSocket provides real-time updates
                if (activeSection === 'clusters') {
                  await refreshClusterData(true);
                }
              }

              setVmActionStatuses((prev) => {
                const updated = { ...prev };
                delete updated[vmName];
                return updated;
              });
            }
          },
          uuid
        );
      } catch (error: unknown) {
        setVmActionStatuses((prev) => {
          const updated = { ...prev };
          delete updated[vmName];
          return updated;
        });

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setActionModalTitle('Failed to Reset VM');
        setActionModalMessage(`Failed to reset VM: ${errorMessage}`);
        setActionModalType('error');
        setIsActionModalOpen(true);
      }
    },
    [
      isVmInAnyTransition,
      setDropdownVmName,
      performVmActionWebSocket,
      setVmActionStatuses,
      setActionModalTitle,
      setActionModalMessage,
      setActionModalType,
      setIsActionModalOpen,
      activeSection,
      refreshClusterData,
    ]
  );

  // Handle VM Power Off
  const handlePowerOffVm = useCallback(
    async (vmName: string, serverIp: string, vmUuid?: string) => {
      if (isVmInAnyTransition(vmName)) {
        return;
      }

      try {
        setDropdownVmName(null);

        // Fetch UUID if not provided
        const uuid = await getVmUuid(serverIp, vmName, vmUuid);

        await performVmActionWebSocket(
          serverIp,
          vmName,
          'poweroff',
          async (status) => {
            setVmActionStatuses((prev) => ({
              ...prev,
              [vmName]: {
                is_final: status.is_final,
                error: status.error || false,
                status: status.status,
              },
            }));

            if (status.is_final) {
              if (status.error) {
                setActionModalTitle('Failed to Power Off VM');
                setActionModalMessage(status.status);
                setActionModalType('error');
                setIsActionModalOpen(true);
              } else {
                setActionModalTitle('Power Off VM');
                setActionModalMessage(`VM ${vmName} powered off successfully.`);
                setActionModalType('success');
                setIsActionModalOpen(true);

                // WebSocket provides real-time updates
                if (activeSection === 'clusters') {
                  await refreshClusterData(true);
                }
              }

              setVmActionStatuses((prev) => {
                const updated = { ...prev };
                delete updated[vmName];
                return updated;
              });
            }
          },
          uuid
        );
      } catch (error: unknown) {
        setVmActionStatuses((prev) => {
          const updated = { ...prev };
          delete updated[vmName];
          return updated;
        });

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setActionModalTitle('Failed to Power Off VM');
        setActionModalMessage(`Failed to power off VM: ${errorMessage}`);
        setActionModalType('error');
        setIsActionModalOpen(true);
      }
    },
    [
      isVmInAnyTransition,
      setDropdownVmName,
      performVmActionWebSocket,
      setVmActionStatuses,
      setActionModalTitle,
      setActionModalMessage,
      setActionModalType,
      setIsActionModalOpen,
      activeSection,
      refreshClusterData,
    ]
  );

  // Handle VM Unlock
  const handleUnlockVm = useCallback(
    async (vmName: string, serverIp: string) => {
      try {
        setRefreshingVms((prev) => ({ ...prev, [vmName]: true }));
        setDropdownVmName(null);

        await unlockVmApi(vmName, serverIp);

        setActionModalTitle('VM Unlocked');
        setActionModalMessage(`VM ${vmName} unlocked successfully.`);
        setActionModalType('success');
        setIsActionModalOpen(true);

        // WebSocket provides real-time updates
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setActionModalTitle('Failed to Unlock VM');
        setActionModalMessage(`Failed to unlock VM: ${errorMessage}`);
        setActionModalType('error');
        setIsActionModalOpen(true);
      } finally {
        setRefreshingVms((prev) => ({ ...prev, [vmName]: false }));
      }
    },
    [
      setRefreshingVms,
      setDropdownVmName,
      unlockVmApi,
      setActionModalTitle,
      setActionModalMessage,
      setActionModalType,
      setIsActionModalOpen,
    ]
  );

  // Handle VM Delete
  const handleDeleteVm = useCallback(
    async (currentVm: VirtualMachine, serverIp: string) => {
      if (isVmInAnyTransition(currentVm.name)) {
        return;
      }

      setCurrentDeleteVm(currentVm);
      setCurrentServerIp(serverIp);
      setIsDeleteModalOpen(true);
      setDeleteButtonClicked(false);
      setDropdownVmName(null);
    },
    [
      isVmInAnyTransition,
      setCurrentDeleteVm,
      setCurrentServerIp,
      setIsDeleteModalOpen,
      setDeleteButtonClicked,
      setDropdownVmName,
    ]
  );

  // Confirm VM Delete
  const confirmDelete = useCallback(async () => {
    if (deleteButtonClicked) {
      return;
    }

    setDeleteButtonClicked(true);
    setIsDeleting(true);

    if (currentDeleteVm && currentDeleteVm.isOn) {
      setIsDeleteModalOpen(false);
      setIsDeleting(false);
      setDeleteButtonClicked(false);
      return;
    }

    if (currentDeleteVm && isVmInAnyTransition(currentDeleteVm.name)) {
      setIsDeleteModalOpen(false);
      setIsDeleting(false);
      setDeleteButtonClicked(false);
      setActionModalTitle('Cannot Delete VM');
      setActionModalMessage(
        'VM is currently in transition. Please wait for the current operation to complete.'
      );
      setActionModalType('error');
      setIsActionModalOpen(true);
      return;
    }

    if (!currentServerIp || !currentDeleteVm) {
      setIsDeleteModalOpen(false);
      setIsDeleting(false);
      setDeleteButtonClicked(false);
      setActionModalTitle('Failed to Delete VM');
      setActionModalMessage('Required VM information is missing. Please try again.');
      setActionModalType('error');
      setIsActionModalOpen(true);
      return;
    }

    const isLastVM = isLastClusterVM(currentDeleteVm.name, dataCenters);

    try {
      setIsDeleting(true);
      setRefreshingVms((prev) => ({ ...prev, [currentDeleteVm.name]: true }));

      await executeWithApproval(
        async (approver?: string) => {
          const uuid = await getVmUuid(currentServerIp, currentDeleteVm.name, currentDeleteVm.uuid);
          const payload = {
            datastore: currentDeleteVm.datastore || '',
          };
          logger.info(`[DEBUG] Calling performVmAction for VM deletion`, {
            serverIp: currentServerIp,
            vmName: currentDeleteVm.name,
            action: 'destroy',
            payload,
            approver,
            uuid,
          });
          await performVmAction(
            currentServerIp,
            currentDeleteVm.name,
            'destroy',
            payload,
            approver,
            uuid
          );

          if (selectedVm && selectedVm.name === currentDeleteVm.name) {
            await handleSmartNavigationAfterVmDelete(currentDeleteVm, isLastVM);
          }

          setIsDeleteModalOpen(false);

          setActionModalTitle('VM Deleted');
          setActionModalMessage(`VM ${currentDeleteVm.name} was successfully deleted.`);
          setActionModalType('success');
          setIsActionModalOpen(true);

          // WebSocket provides real-time updates
          if (activeSection === 'clusters') {
            await refreshClusterDataForServer(currentServerIp, 'VM deletion');
          }

          if (isClusterVM(currentDeleteVm.name)) {
            const fullClusterName = getFullClusterName(currentDeleteVm.name);
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent('clusterVmOperation', {
                  detail: {
                    vmName: currentDeleteVm.name,
                    operation: 'delete',
                    clusterName: fullClusterName,
                  },
                })
              );
            }, 100);
          }

          if (isClusterVM(currentDeleteVm.name)) {
            const deletedClusterName = getFullClusterName(currentDeleteVm.name);

            if (isLastVM) {
              window.dispatchEvent(
                new CustomEvent('clusterDeleted', {
                  detail: {
                    clusterName: deletedClusterName,
                    vmName: currentDeleteVm.name,
                  },
                })
              );
            }
          }
        },
        'Destroy VM',
        `Are you sure you want to permanently delete "${currentDeleteVm.name}"? This action cannot be undone.`
      );
    } catch (error: unknown) {
      setIsDeleteModalOpen(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setActionModalTitle('Failed to Delete VM');
      setActionModalMessage(`Failed to delete VM: ${errorMessage}`);
      setActionModalType('error');
      setIsActionModalOpen(true);
    } finally {
      setIsDeleting(false);

      if (currentDeleteVm) {
        setRefreshingVms((prev) => ({ ...prev, [currentDeleteVm.name]: false }));
      }
      setDeleteButtonClicked(false);
    }
  }, [
    deleteButtonClicked,
    currentDeleteVm,
    currentServerIp,
    dataCenters,
    selectedVm,
    activeSection,
    isVmInAnyTransition,
    setDeleteButtonClicked,
    setIsDeleting,
    setIsDeleteModalOpen,
    setActionModalTitle,
    setActionModalMessage,
    setActionModalType,
    setIsActionModalOpen,
    setRefreshingVms,
    executeWithApproval,
    handleSmartNavigationAfterVmDelete,
    refreshClusterDataForServer,
  ]);

  return {
    handleToggleVmPower,
    handleRenameVm,
    handleVmNameChange,
    confirmRename,
    handleCloneVm,
    proceedWithCloneAfterPcieWarning,
    confirmClone,
    handleRestartVm,
    handleResetVm,
    handlePowerOffVm,
    handleUnlockVm,
    handleDeleteVm,
    confirmDelete,
  };
};

export default useVMActions;
