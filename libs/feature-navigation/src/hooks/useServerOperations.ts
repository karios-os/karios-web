import { useCallback } from 'react';
import { setupVmListWebSocket } from '../../../shared-state/src/utils/apiService';
import { ActionTypes } from '../../../shared-state/src/utils/actionTypes';

type ServerNode = any;
type VirtualMachine = any;

interface UseServerOperationsProps {
  dataCenters: any[];
  openServers: any;
  activeWebSocketsRef: React.MutableRefObject<any>;
  initialPingInProgress: Set<string>;
  setNewServerDropdownSelected: (value: boolean) => void;
  setOpenServers: (value: any) => void;
  setLoadingServers: (callback: any) => void;
  setManuallyClosedServers: (callback: any) => void;
  setDropdownOpen: (value: any) => void;
  dispatch: any;
  navigate: any;
  fetchVMsForServer: (server: ServerNode) => Promise<any>;
  logger: any;
}

export const useServerOperations = ({
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
}: UseServerOperationsProps) => {
  // Handle server click navigation
  const handleServerClick = useCallback(
    (server: ServerNode) => {
      // Prevent clicks during initial ping check
      if (initialPingInProgress.has(server.id || server.ip)) {
        return;
      }

      // Find the enriched server object from dataCenters
      let enrichedServer = null;
      for (const dc of dataCenters) {
        const found = dc.servers.find((s: ServerNode) => s.id === server.id);
        if (found) {
          enrichedServer = found;
          break;
        }
      }

      if (!enrichedServer) {
        enrichedServer = server;
      }

      // Set the flag to indicate a new server was selected
      setNewServerDropdownSelected(true);

      // Clear the selected VM when navigating to a new server
      dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: null });

      // Dispatch server selection action with enriched server
      dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: enrichedServer });

      // Navigate to server home page
      navigate(`/server/${server.name}/home`);
    },
    [dataCenters, initialPingInProgress, setNewServerDropdownSelected, dispatch, navigate]
  );

  // Toggle server visibility (expand/collapse)
  const toggleServerVisibility = useCallback(
    async (serverId: string) => {
      // Find the server using the serverId
      const serverToToggle = dataCenters
        .flatMap((dc: any) => dc.servers)
        .find((s: ServerNode) => s.id === serverId || s.ip === serverId);

      if (!serverToToggle) {
        return;
      }

      const serverKey = serverToToggle.id;

      // Update state based on whether we're opening or closing the server
      if (openServers[serverKey]) {
        // If we're closing the server, track it as manually closed
        setManuallyClosedServers((prev: Set<string>) => new Set(prev.add(serverKey)));

        // Close any active WebSocket connection for this server
        if (activeWebSocketsRef.current[serverKey]) {
          activeWebSocketsRef.current[serverKey].close();
          delete activeWebSocketsRef.current[serverKey];
        }

        // Close all servers and clear loading states
        setOpenServers({});
        setLoadingServers({});
        setNewServerDropdownSelected(false);
      } else {
        // If we're opening the server, remove it from manually closed set
        setManuallyClosedServers((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.delete(serverKey);
          return newSet;
        });

        // Set the flag to indicate a new server dropdown was selected
        setNewServerDropdownSelected(true);

        // Close any existing WebSocket connections for other servers
        Object.entries(activeWebSocketsRef.current).forEach(([serverId, ws]: [string, any]) => {
          if (serverId !== serverKey) {
            ws.close();
            delete activeWebSocketsRef.current[serverId];
          }
        });

        // If we're opening the server, close all other servers and only open this one
        const newOpenServers: Record<string, boolean> = {};
        newOpenServers[serverKey] = true;
        setOpenServers(newOpenServers);

        // Set loading state for this server
        setLoadingServers((prev: any) => ({ ...prev, [serverKey]: true }));

        // Check if WebSocket connection already exists for this server
        if (activeWebSocketsRef.current[serverKey]) {
          return;
        }

        // Use WebSocket to fetch VMs when expanding dropdown
        const wsConnection = setupVmListWebSocket(serverToToggle, dispatch);

        if (wsConnection) {
          // Store the WebSocket connection for later management
          activeWebSocketsRef.current[serverKey] = wsConnection;

          // Add error handling to clear loading state if WebSocket fails
          wsConnection.onerror = () => {
            logger.error(`WebSocket error for server ${serverKey}, clearing loading state`);
            setLoadingServers((prev: any) => {
              const updated = { ...prev };
              delete updated[serverKey];
              return updated;
            });
          };
        } else {
          // Fallback to regular API call if WebSocket fails to initialize
          try {
            await fetchVMsForServer(serverToToggle);
          } finally {
            // Clear loading state when fetch completes
            setLoadingServers((prev: any) => {
              const updated = { ...prev };
              delete updated[serverKey];
              return updated;
            });
          }
        }
      }
    },
    [
      dataCenters,
      openServers,
      activeWebSocketsRef,
      setManuallyClosedServers,
      setNewServerDropdownSelected,
      setOpenServers,
      setLoadingServers,
      dispatch,
      fetchVMsForServer,
      logger,
    ]
  );

  // Refresh VMs for a specific server
  const refreshServerVms = useCallback(
    async (server: ServerNode) => {
      if (server && server.ip) {
        try {
          // Only show loading for servers that are currently open
          if (openServers[server.id]) {
            setLoadingServers((prev: any) => ({ ...prev, [server.id]: true }));
          }

          await fetchVMsForServer(server);
        } catch (error) {
          logger.error(`Error refreshing VMs for server ${server.name}:`, error);
        } finally {
          // Clear loading state
          setLoadingServers((prev: any) => ({ ...prev, [server.id]: false }));
        }
      }
    },
    [fetchVMsForServer, openServers, setLoadingServers, logger]
  );

  // Find server by IP address
  const findServerByIp = useCallback(
    (serverIp: string) => {
      return dataCenters
        .flatMap((dc: any) => dc.servers)
        .find((s: ServerNode) => s.ip === serverIp);
    },
    [dataCenters]
  );

  return {
    handleServerClick,
    toggleServerVisibility,
    refreshServerVms,
    findServerByIp,
  };
};
