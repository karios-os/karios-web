import * as React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useVm, useServer, useAppState, ActionTypes, logger } from '@karios-monorepo/shared-state';
import { Gallery, Refresh } from 'iconsax-react';
import Modal from '../../shared-state/src/widgets/Modal';
import { DataTable } from '@karios-monorepo/shared-state';

// Types for snapshot and VM
interface Snapshot {
  name: string;
  date: string;
}

interface Vm {
  name: string;
  state: string;
}

const getSnapshotName = (name: string): string => {
  const parts = name.split('@');
  return parts.length > 1 ? parts[1] : name;
};

const getSnapshotType = (name: string): 'disk' | 'os' => {
  // If the snapshot path contains '/disk', it's a disk snapshot
  // Otherwise, it's an OS snapshot
  return name.includes('/disk') ? 'disk' : 'os';
};

const getSnapshotTypeLabel = (type: 'disk' | 'os'): string => {
  return type === 'disk' ? 'Disk' : 'OS';
};

export default function SnapshotManager() {
  const { selectedVm } = useVm() as { selectedVm: Vm };

  const { selectedServer } = useServer();
  const {
    getVmSnapshots,
    snapshotMessage,
    fetchSnapshots,
    createSnapshot,
    rollbackSnapshot,
    dispatch,
    state,
  } = useAppState() as {
    getVmSnapshots: (serverIp: string, vmName: string) => Snapshot[];
    snapshotMessage: string;
    fetchSnapshots: (ip: string, name: string) => Promise<void>;
    createSnapshot: (ip: string, name: string, snapName: string) => Promise<void>;
    rollbackSnapshot: (ip: string, name: string, snapName: string) => Promise<void>;
    dispatch: React.Dispatch<any>;
    state: any;
  };
  const [snapshotName, setSnapshotName] = useState<string>('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState<boolean>(false);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [isVmRunningModalOpen, setIsVmRunningModalOpen] = useState<boolean>(false);

  const isEditable: boolean = true;

  // Get VM-specific snapshots with memoization
  const vmSnapshots = useMemo(() => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    return selectedVm?.name && serverAddress ? getVmSnapshots(serverAddress, selectedVm.name) : [];
  }, [selectedVm?.name, selectedServer?.ip, selectedServer?.fqdn, getVmSnapshots]);

  // Use global loading state
  const isLoading = state.snapshotsLoading;
  // const hasAttemptedLoad = state.snapshotsLoading !== undefined;

  // Memoize the loadSnapshots function with minimal dependencies
  const loadSnapshots = useCallback(async (): Promise<void> => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (selectedVm?.name && serverAddress) {
      try {
        await fetchSnapshots(serverAddress, selectedVm.name);
      } catch (error) {
        logger.error('Error fetching snapshots', error);
      }
    }
  }, [selectedVm?.name, selectedServer?.ip, selectedServer?.fqdn, fetchSnapshots]);

  // Use a ref to track if we've already loaded for this VM/server combination
  const lastLoadedRef = useRef<string>('');

  useEffect(() => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    const currentKey = `${serverAddress}:${selectedVm?.name}`;
    if (currentKey !== lastLoadedRef.current && selectedVm?.name && serverAddress) {
      lastLoadedRef.current = currentKey;
      loadSnapshots();
    }
  }, [selectedVm?.name, selectedServer?.ip, selectedServer?.fqdn, loadSnapshots]);

  // Clear snapshot message when VM changes
  useEffect(() => {
    dispatch({ type: ActionTypes.SET_SNAPSHOT_MESSAGE, payload: '' });
  }, [selectedVm?.name, dispatch]);

  if (!isEditable) return null;

  //take snapshot
  const handleTakeSnapshot = async (): Promise<void> => {
    // Check if VM is running first
    if (selectedVm.state === 'Running') {
      setIsVmRunningModalOpen(true);
      return;
    }

    const trimmed = snapshotName.trim();

    if (!trimmed) {
      dispatch({
        type: ActionTypes.SET_SNAPSHOT_MESSAGE,
        payload: 'Please enter a snapshot name.',
      });
      return;
    }

    const isValidSnapshotName = /^[a-zA-Z0-9]+$/.test(trimmed);
    if (!isValidSnapshotName) {
      dispatch({
        type: ActionTypes.SET_SNAPSHOT_MESSAGE,
        payload:
          'Snapshot name must contain only letters and numbers (no spaces or special characters).',
      });
      return;
    }

    const snapshotsArray = Array.isArray(vmSnapshots) ? (vmSnapshots as Snapshot[]) : [];
    const nameExists = snapshotsArray.some((snap) => getSnapshotName(snap.name) === trimmed);
    if (nameExists) {
      dispatch({
        type: ActionTypes.SET_SNAPSHOT_MESSAGE,
        payload: "Please enter a new snapshot name. The name you've provided is already taken.",
      });
      return;
    }

    try {
      setIsCreatingSnapshot(true);
      dispatch({
        type: ActionTypes.SET_SNAPSHOT_MESSAGE,
        payload: `Taking snapshot "${trimmed}"...`,
      });

      const serverAddress = selectedServer?.fqdn || selectedServer.ip;
      await createSnapshot(serverAddress, selectedVm.name, trimmed);
      setSnapshotName('');
      await fetchSnapshots(serverAddress, selectedVm.name);

      dispatch({
        type: ActionTypes.SET_SNAPSHOT_MESSAGE,
        payload: `Snapshot "${trimmed}" created successfully!`,
      });

      setTimeout(
        () =>
          dispatch({
            type: ActionTypes.SET_SNAPSHOT_MESSAGE,
            payload: '',
          }),
        3000
      );
    } catch (error) {
      logger.error('Error taking snapshot', error);
      dispatch({
        type: ActionTypes.SET_SNAPSHOT_MESSAGE,
        payload: 'Failed to create snapshot. Please try again.',
      });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  //rollback snapshot
  const handleRollbackSnapshot = async (name: string): Promise<void> => {
    try {
      // Close the modal immediately
      setIsModalOpen(false);
      setSelectedSnapshot(null);

      // Show loading message to user
      dispatch({
        type: ActionTypes.SET_SNAPSHOT_MESSAGE,
        payload: `Rolling back to snapshot "${name}"...`,
      });

      // Execute rollback
      const serverAddress = selectedServer?.fqdn || selectedServer.ip;
      await rollbackSnapshot(serverAddress, selectedVm.name, name);
      await fetchSnapshots(serverAddress, selectedVm.name);
    } catch (error) {
      logger.error('Error rolling back', error);
    }

    // Clear message after 3 seconds
    setTimeout(() => dispatch({ type: ActionTypes.SET_SNAPSHOT_MESSAGE, payload: '' }), 3000);
  };

  // Handle opening rollback modal
  const openRollbackModal = (snapshot: Snapshot): void => {
    // Check if VM is running first
    if (selectedVm.state === 'Running') {
      setIsVmRunningModalOpen(true);
      return;
    }
    // If VM is not running, open the rollback confirmation modal
    setSelectedSnapshot(snapshot);
    setIsModalOpen(true);
  };

  // Prepare data for DataTable
  const tableData = vmSnapshots.map((snap, index) => {
    const snapshotType = getSnapshotType(snap.name);
    return {
      id: index,
      name: getSnapshotName(snap.name),
      type: snapshotType,
      typeLabel: getSnapshotTypeLabel(snapshotType),
      date: snap.date,
      fullName: snap.name,
    };
  });

  // Define columns for DataTable
  const columns = [
    {
      key: 'name',
      header: 'Snapshot Name',
      className: 'p-3 text-left',
      headerClassName: 'p-3 w-[300px] text-left',
      render: (value: any, item: any) => (
        <div className="flex flex-col gap-1">
          <span className="font-small">{value}</span>
          <span className={`text-xs font-semibold ${item.type === 'disk' ? 'text-gray-600' : 'text-gray-600'}`}>
            {item.typeLabel}
          </span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date & Time',
      className: 'p-3 text-left',
      headerClassName: 'p-3 w-[700px] text-left',
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'p-3 text-right align-right',
      headerClassName: 'p-3 text-left',
      render: (value: any, item: any) => (
        <button
          className="flex flex-row gap-2 px-3 py-1 items-center justify-center bg-karios-blue w-[130px] h-[40px] rounded-[10px] text-white rounded-md hover:bg-blue-900"
          onClick={() => openRollbackModal({ name: item.fullName, date: item.date })}
          disabled={isLoading}
        >
          <Refresh size={24} color="#FFFFFF" />
          Rollback
        </button>
      ),
    },
  ];

  return (
    <div className="w-full min-h-full p-6 bg-white rounded-lg">
      {/* Title and Input Row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
        <h2 className="text-2xl whitespace-nowrap">Snapshot Manager - {selectedVm?.name}</h2>
        {/* Input with button inside */}
        <div className="flex flex-1 relative">
          <input
            type="text"
            className="w-full p-3 pr-32 border border-gray-300 rounded-md"
            placeholder="Enter Snapshot Name"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            disabled={isCreatingSnapshot}
          />
          <button
            className={`absolute right-1 top-1/2 -translate-y-1/2 flex flex-row gap-2 px-4 py-2 text-white rounded-[8px] items-center whitespace-nowrap ${
              isCreatingSnapshot
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-rose-500 hover:bg-rose-600'
            }`}
            onClick={handleTakeSnapshot}
            disabled={isCreatingSnapshot}
          >
            <Gallery size={20} color="#FFFFFF" />
            <span className="hidden sm:inline">
              {isCreatingSnapshot ? 'Taking snapshot...' : 'Take Snapshot'}
            </span>
            <span className="sm:hidden">{isCreatingSnapshot ? '...' : 'Take'}</span>
          </button>
        </div>
      </div>

      {/* Message */}
      {snapshotMessage && (
        <p
          className={`mb-4 ${
            snapshotMessage.toLowerCase().includes('rolling back')
              ? 'text-yellow-600'
              : snapshotMessage.toLowerCase().includes('successfully')
                ? 'text-green-600'
                : 'text-red-600'
          }`}
        >
          {snapshotMessage}
        </p>
      )}

      {/* Table Section */}
      {isLoading ? (
        <p className="text-gray-600 mt-4">Loading snapshots...</p>
      ) : Array.isArray(vmSnapshots) && vmSnapshots.length > 0 ? (
        <DataTable
          data={tableData}
          columns={columns}
          hoverable={false}
          className="w-full rounded-lg border-0"
          showAllData={true}
          bordered={false}
          striped={false}
          maxHeight="none"
        />
      ) : (
        <p className="text-gray-600 mt-4">No snapshots available.</p>
      )}
      {isModalOpen && selectedSnapshot && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedSnapshot(null);
          }}
          title={'Snapshot Rollback'}
        >
          <div className="p-4 pt-0">
            <label className="block text-sm text-slate-800 mb-[19px] font-lexend text-xl leading-[140%] tracking-normal">
              Are you ok to rollback to snapshot &quot;{getSnapshotName(selectedSnapshot.name)}
              &quot;?
            </label>

            <div className="mt-7 flex justify-end">
              <button
                type="button"
                className="mr-2 inline-flex justify-center px-[29px] py-[12px] shadow-sm text-sm text-white font-medium rounded-sm bg-red-700 hover:bg-red-900"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedSnapshot(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex justify-center px-[29px] py-[12px] border border-transparent shadow-sm text-sm font-medium rounded-sm text-white bg-sky-500 hover:bg-sky-600"
                onClick={() => handleRollbackSnapshot(getSnapshotName(selectedSnapshot.name))}
              >
                Yes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* VM Running Warning Modal */}
      {isVmRunningModalOpen && (
        <Modal
          isOpen={isVmRunningModalOpen}
          onClose={() => setIsVmRunningModalOpen(false)}
          title={'VM is Running'}
        >
          <div className="p-4 pt-0">
            <label className="block text-md text-slate-800 mb-[19px] font-lexend leading-[140%] tracking-normal">
              Please turn off the VM before taking a snapshot or rolling back to a snapshot.
            </label>

            <div className="mt-7 flex justify-center">
              <button
                type="button"
                className="inline-flex justify-center px-[29px] py-[12px] border border-transparent shadow-sm text-sm font-medium rounded-sm text-white bg-sky-500 hover:bg-sky-600"
                onClick={() => setIsVmRunningModalOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
