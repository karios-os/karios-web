import React, { useState, useEffect, useCallback } from 'react';
import {
  useVm,
  useAppState,
  ActionTypes,
  logger,
  fetchAllVms,
  fetchVmInfo,
  fetchIsoListDirect,
  performOsInstall,
  setVmStartOnHostboot,
  removeVmFromHostboot,
} from '@karios-monorepo/shared-state';
import { useNavigate } from 'react-router-dom';

// TypeScript interfaces
interface Server {
  id: string | number;
  ip: string;
  name: string;
  fqdn?: string;
}

interface Vm {
  name: string;
  state: string;
  [key: string]: any;
}

interface OsInstallationState {
  selectedIso: string;
  isInstalling: boolean;
  message: string;
  isoList: string[];
  loadingIsos: boolean;
  startOnBoot: boolean;
}

interface IsoState {
  loading: boolean;
  isoList: string[];
}

const OsInstallation: React.FC = () => {
  const { selectedVm } = useVm();

  const { state, dispatch } = useAppState();
  const navigate = useNavigate();

  // Local server state management
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);

  // Local VM details state
  const [vmDetails, setVmDetails] = useState<any>(null);

  // Local OS installation state
  const [osInstallation, setOsInstallation] = useState<OsInstallationState>({
    selectedIso: '',
    isInstalling: false,
    message: '',
    isoList: [],
    loadingIsos: false,
    startOnBoot: false,
  });

  // Local ISO state
  const [iso, setIso] = useState<IsoState>({
    loading: false,
    isoList: [],
  });

  // Initialize server from global state
  useEffect(() => {
    if (state.selectedServer) {
      setSelectedServer(state.selectedServer);
    }
  }, [state.selectedServer]);

  // Local function to fetch VMs
  const fetchVMs = async () => {
    if (!selectedServer) return;

    try {
      await fetchAllVms(selectedServer?.fqdn || selectedServer.ip);
    } catch (error) {
      logger.error('Error fetching VMs', error);
    }
  };

  // Local function to fetch VM details
  const fetchVmDetails = useCallback(async () => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (!serverAddress || !selectedVm?.name) return;

    try {
      const data = await fetchVmInfo(serverAddress, selectedVm.name);
      setVmDetails(data);
    } catch (error) {
      logger.error('Error fetching VM details', error);
    }
  }, [selectedServer?.ip, selectedServer?.fqdn, selectedVm?.name]);

  // Local function to fetch ISO list
  const fetchIsoList = async (serverIp: string) => {
    setIso((prev) => ({ ...prev, loading: true }));

    try {
      const isoList = await fetchIsoListDirect(serverIp);
      setIso((prev) => ({ ...prev, isoList, loading: false }));
      setOsInstallation((prev) => ({ ...prev, isoList, loadingIsos: false }));
    } catch (error) {
      logger.error('Error fetching ISO list', error);
      setIso((prev) => ({ ...prev, loading: false }));
      setOsInstallation((prev) => ({ ...prev, loadingIsos: false }));
    }
  };

  const isEditable = true;

  const { selectedIso, isInstalling: installing, message, startOnBoot } = osInstallation;

  // Fetch available ISOs from global state on mount
  useEffect(() => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (serverAddress) {
      fetchIsoList(serverAddress);
    }
  }, [selectedServer?.ip, selectedServer?.fqdn]);

  // Fetch VM details when VM or server changes
  useEffect(() => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (serverAddress && selectedVm?.name) {
      fetchVmDetails();
    }
  }, [selectedServer?.ip, selectedServer?.fqdn, selectedVm?.name, fetchVmDetails]);
  // If user lacks permission, do not render anything
  if (!isEditable) return null;

  const handleInstall = async () => {
    if (!selectedVm || !selectedIso) {
      dispatch({
        type: ActionTypes.SET_OS_INSTALL_MESSAGE,
        payload: 'Select a VM and an ISO first.',
      });
      return;
    }
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (!serverAddress) {
      dispatch({ type: ActionTypes.SET_OS_INSTALL_MESSAGE, payload: 'No server selected.' });
      return;
    }
    if (selectedVm.state !== 'Stopped') {
      dispatch({
        type: ActionTypes.SET_OS_INSTALL_MESSAGE,
        payload: 'Please turn off the VM before installing OS.',
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    dispatch({ type: ActionTypes.SET_INSTALLING_STATE, payload: true });
    dispatch({ type: ActionTypes.SET_OS_INSTALL_MESSAGE, payload: '' });
    const isoFile = selectedIso;
    try {
      await performOsInstall(serverAddress, selectedVm.name, isoFile, vmDetails?.datastore);
      dispatch({
        type: ActionTypes.SET_OS_INSTALL_MESSAGE,
        payload: `OS installation started for ${selectedVm.name}.`,
      });
      // refresh the VM list
      await fetchVMs();
      setTimeout(() => {
        navigate(`/vm/${selectedVm.name}/console`, { replace: true });
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      dispatch({ type: ActionTypes.SET_OS_INSTALL_MESSAGE, payload: `Error: ${errorMessage}` });
    } finally {
      dispatch({ type: ActionTypes.SET_INSTALLING_STATE, payload: false });
    }
  };

  return (
    <div className="bg-white p-6 shadow-md rounded-md border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Install OS</h2>
      {/* VM Info */}
      <div className="flex flex-row justify-between">
        <p className="text-gray-600 text-sm mb-2">
          Selected VM: <strong>{selectedVm?.name || 'None'}</strong>
        </p>
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="startOnBoot"
            className="mr-2 cursor-pointer"
            checked={startOnBoot}
            disabled={!isEditable}
            onChange={async (e) => {
              const isChecked = e.target.checked;
              const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
              if (!serverAddress || !selectedVm?.name) {
                dispatch({
                  type: ActionTypes.SET_OS_INSTALL_MESSAGE,
                  payload: 'Server or VM not selected.',
                });
                return;
              }

              dispatch({ type: ActionTypes.TOGGLE_START_ON_BOOT, payload: isChecked });
              try {
                if (isChecked) {
                  await setVmStartOnHostboot(serverAddress, selectedVm.name, vmDetails?.datastore);
                  dispatch({
                    type: ActionTypes.SET_OS_INSTALL_MESSAGE,
                    payload: `VM ${selectedVm.name} will now start on host restart.`,
                  });
                } else {
                  await removeVmFromHostboot(serverAddress, selectedVm.name);
                  dispatch({
                    type: ActionTypes.SET_OS_INSTALL_MESSAGE,
                    payload: `VM ${selectedVm.name} will no longer start on host restart.`,
                  });
                }
              } catch (error) {
                logger.error('Error toggling start on boot', error);
                const errorMessage =
                  error instanceof Error ? error.message : 'Unknown error occurred';
                dispatch({
                  type: ActionTypes.SET_OS_INSTALL_MESSAGE,
                  payload: `Error: ${errorMessage}`,
                });
              }
            }}
          />
          <label htmlFor="startOnBoot" className="text-gray-700 text-sm">
            Start VM on Host Restart
          </label>
        </div>
      </div>
      {/* ISO Dropdown */}
      <label className="block text-gray-700 text-sm mb-1">Choose ISO:</label>
      {iso.loading ? (
        <p className="text-gray-600 text-sm mb-2">Loading available ISOs...</p>
      ) : (
        <select
          className="w-full p-2 border border-black text-black rounded-md mb-4 disabled:opacity-50"
          value={selectedIso}
          onChange={(e) =>
            dispatch({ type: ActionTypes.SET_SELECTED_ISO, payload: e.target.value })
          }
          disabled={!isEditable}
        >
          <option value="">Select ISO</option>
          {Array.isArray(iso.isoList) &&
            iso.isoList.map((iso, index) => (
              <option key={index} value={iso}>
                {iso}
              </option>
            ))}
        </select>
      )}
      {/* Install Button */}
      <button
        className="w-full bg-karios-blue text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        onClick={handleInstall}
        disabled={installing || !isEditable}
      >
        {installing ? 'Installing...' : 'Install OS'}
      </button>
      {/* Status Message */}
      {message && <p className="text-sm mt-3 text-gray-700">{message}</p>}
    </div>
  );
};

export default OsInstallation;
