import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  useVm,
  usePermissions,
  useAppState,
  ActionTypes,
  api,
} from '@karios-monorepo/shared-state';
import envConfig from '../../../runtime-config';

// TypeScript interfaces
interface Server {
  id: string | number;
  ip: string;
  fqdn?: string;
  name: string;
}

interface VmConsoleData {
  port?: number;
}

interface CreateConsoleData {
  port: number;
}

const VMConsole: React.FC = () => {
  const { selectedVm } = useVm();

  const { state, dispatch } = useAppState();
  const { vncConsoleUrl: vncUrl, vncConsoleError: statusMessage } = state;
  const [currentVmState, setCurrentVmState] = useState<string>('Unknown');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Local server state management
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  // Initialize server from global state
  useEffect(() => {
    if (state.selectedServer) {
      setSelectedServer(state.selectedServer);
    }
  }, [state.selectedServer]);

  // Initialize VM state from vmStatesGlobal
  useEffect(() => {
    if (!selectedVm) {
      setCurrentVmState('Unknown');
      return;
    }

    // Get initial state from vmStatesGlobal or fallback to selectedVm.state
    const vmStatesGlobal = (window as any).vmStatesGlobal || {};
    const initialState = vmStatesGlobal[selectedVm.name] || selectedVm.state || 'Unknown';
    setCurrentVmState(initialState);
  });

  // Listen for VM state changes via custom events
  useEffect(() => {
    if (!selectedVm) return undefined;

    const handleVmStateChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { vmName, newState } = customEvent.detail;

      if (vmName === selectedVm.name) {
        setCurrentVmState(newState);
      }
    };

    const handleVmStateInit = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { vmName, state } = customEvent.detail;

      if (vmName === selectedVm.name) {
        setCurrentVmState(state);
      }
    };

    window.addEventListener('vmStateChanged', handleVmStateChange);
    window.addEventListener('vmStateInitialized', handleVmStateInit);

    return () => {
      window.removeEventListener('vmStateChanged', handleVmStateChange);
      window.removeEventListener('vmStateInitialized', handleVmStateInit);
    };
  }, []);

  // Helper function to construct VNC URL through nginx proxy
  const constructVncUrl = (port: number, serverIp: string): string => {
    // Use nginx proxy pattern instead of direct port access
    return `${envConfig().PROTOCOL}://${serverIp}/${port}/vnc.html?autoconnect=true&reconnect=true&reconnect_delay=3000`;
  };

  useEffect(() => {
    if (!selectedServer) return void 0;

    let isMounted = true; // Flag to prevent state updates if the component unmounts

    const setupVncConsole = async () => {
      try {
        // Clear any existing error messages or URLs at the start
        dispatch({ type: ActionTypes.VNC_CONSOLE_ERROR, payload: null });
        dispatch({ type: ActionTypes.SET_VNC_CONSOLE_URL, payload: null });

        // Check if a VM is selected
        if (!selectedVm) {
          dispatch({
            type: ActionTypes.VNC_CONSOLE_ERROR,
            payload: 'No VM selected.',
          });
          return;
        }

        // Ensure server is available
        if (!selectedServer) {
          dispatch({
            type: ActionTypes.VNC_CONSOLE_ERROR,
            payload: 'No server selected.',
          });
          return;
        }

        // Check if the VM is in a state where console access should be blocked
        const blockedStates = ['Stopped'];
        if (blockedStates.includes(currentVmState)) {
          let message = 'VM is stopped. Please start the VM to access the console.';
          if (currentVmState === 'PROVISIONING' || currentVmState === 'Provisioning') {
            message =
              'VM is currently being provisioned. Console access will be available once provisioning is complete.';
          }
          dispatch({
            type: ActionTypes.VNC_CONSOLE_ERROR,
            payload: message,
          });
          return;
        }

        // Check if VM console already exists
        const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
        const checkConsoleResponse = await api.fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/console/${selectedVm.name}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (checkConsoleResponse.ok) {
          const checkConsoleData: VmConsoleData = await checkConsoleResponse.json();
          if (checkConsoleData.port) {
            // Use nginx proxy URL instead of direct port access
            const existingVncUrl = constructVncUrl(checkConsoleData.port, serverAddress);
            dispatch({ type: ActionTypes.SET_VNC_CONSOLE_URL, payload: existingVncUrl });
            return;
          }
        }

        // If console doesn't exist, create it
        dispatch({
          type: ActionTypes.VNC_CONSOLE_ERROR,
          payload: 'Creating new console session...',
        });

        const vmRes = await api.fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${selectedVm.name}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!vmRes.ok) {
          throw new Error('Failed to fetch VM details.');
        }

        const vmData = await vmRes.json();

        // More robust check for console-port and vnc property
        if (
          !vmData ||
          typeof vmData !== 'object' ||
          !vmData['console-port'] ||
          typeof vmData['console-port'] !== 'object' ||
          !vmData['console-port'].vnc
        ) {
          dispatch({
            type: ActionTypes.VNC_CONSOLE_ERROR,
            payload: 'VNC console information not available for this VM',
          });
          return;
        }

        const vncString = vmData['console-port'].vnc;

        const [, vm_port] = vncString.split(':');
        const port = parseInt(vm_port, 10);
        // Create the console session
        const body = JSON.stringify({
          vm_name: selectedVm.name,
          vm_host: serverAddress,
          vm_port: port,
        });

        const createRes = await api.fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/console/create`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
            body: body,
          }
        );

        if (!createRes.ok) {
          dispatch({
            type: ActionTypes.VNC_CONSOLE_ERROR,
            payload: 'Failed to create console session.',
          });
          return;
        }

        const createData: CreateConsoleData = await createRes.json();
        if (!createData.port) {
          dispatch({
            type: ActionTypes.VNC_CONSOLE_ERROR,
            payload: 'Failed to retrieve port for console session.',
          });
          return;
        }

        // Use the port value to construct the VNC URL
        const finalVncUrl = `${envConfig().PROTOCOL}://${serverAddress}:${createData.port}/vnc.html?autoconnect=true&reconnect=true&reconnect_delay=3000`;
        dispatch({ type: ActionTypes.VNC_CONSOLE_ERROR, payload: null });
        dispatch({ type: ActionTypes.SET_VNC_CONSOLE_URL, payload: finalVncUrl });
      } catch (error: any) {
        // Extract error message from the error response
        const errorMessage =
          error?.message || error?.response?.data?.message || JSON.stringify(error);

        dispatch({
          type: ActionTypes.VNC_CONSOLE_ERROR,
          payload: errorMessage,
        });
      }
    };

    if (selectedVm && selectedServer) {
      setupVncConsole();
    }

    // Cleanup function
    return () => {
      isMounted = false; // Prevent state updates after unmount
      dispatch({ type: ActionTypes.SET_VNC_CONSOLE_URL, payload: null }); // Reset VNC URL
      dispatch({ type: ActionTypes.VNC_CONSOLE_ERROR, payload: null }); // Reset any error message
    };
  }, [currentVmState]);

  return (
    <div className="h-[75vh] w-full mt-5">
      {!vncUrl && !statusMessage && selectedVm && currentVmState !== 'Stopped' && (
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
      {statusMessage && (
        <div className="flex justify-center items-center h-full">
          <div className="text-center p-4 max-w-lg bg-yellow-50 rounded-lg shadow-sm">
            <p className="text-yellow-600">{statusMessage}</p>
            {currentVmState === 'Stopped' && (
              <p className="text-sm text-gray-600 mt-2">
                Start the VM from the VM options page to access the console.
              </p>
            )}
          </div>
        </div>
      )}
      {vncUrl && (
        <div className="w-full h-fit ml-auto">
          <iframe
            ref={iframeRef}
            src={vncUrl}
            title="VM Console"
            className="w-full h-screen border-none"
            allowFullScreen
            allow="fullscreen; clipboard-read; clipboard-write; camera; microphone"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation"
          />
        </div>
      )}
    </div>
  );
};

export default VMConsole;
