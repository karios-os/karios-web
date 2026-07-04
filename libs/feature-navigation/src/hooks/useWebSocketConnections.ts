import { useRef, useEffect, useCallback } from 'react';
import { setupVmListWebSocket } from '../../../shared-state/src/utils/apiService';
import { logger } from '../../../shared-state/src/utils/logger';
import type { ServerNode } from '../SideBar-types';

interface UseWebSocketConnectionsProps {
  dataCenters: any[];
  activeSection?: string;
  clusterData?: any;
  clusterVmsData?: Record<string, any>;
  expandedClusters?: Record<string, boolean>;
  loadingServers?: Record<string, boolean>;
  setLoadingServers?: (state: any) => void;
  dispatch?: any;
}

export const useWebSocketConnections = (props: UseWebSocketConnectionsProps) => {
  const {
    dataCenters,
    activeSection,
    clusterData,
    clusterVmsData,
    expandedClusters,
    loadingServers,
    setLoadingServers,
    dispatch,
  } = props;

  const activeWebSocketsRef = useRef<Record<string, WebSocket>>({});

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

  const closeWebSocketConnection = useCallback((serverId: string) => {
    if (activeWebSocketsRef.current[serverId]) {
      const ws = activeWebSocketsRef.current[serverId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      delete activeWebSocketsRef.current[serverId];
    }
  }, []);

  const cleanupAllConnections = useCallback(() => {
    Object.entries(activeWebSocketsRef.current).forEach(([, ws]) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    activeWebSocketsRef.current = {};
  }, []);

  const setupClusterWebSocketConnections = useCallback(
    (clusterName: string) => {
      const clusterServers = new Set<any>();

      // Check cluster data for VMs and their associated servers
      if (clusterData?.clusters) {
        const cluster = clusterData.clusters.find((c: any) => c.name === clusterName);
        if (cluster?.vms) {
          cluster.vms.forEach((vm: any) => {
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
      const clusterVMs = clusterVmsData?.[clusterName];
      if (clusterVMs?.vms) {
        clusterVMs.vms.forEach((vm: any) => {
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
        setLoadingServers?.((prev: any) => ({ ...prev, [serverKey]: true }));

        // Setup WebSocket connection
        const wsConnection = setupVmListWebSocket(server, dispatch);

        if (wsConnection) {
          // Store the WebSocket connection for later management
          activeWebSocketsRef.current[serverKey] = wsConnection;

          // Add error handling to clear loading state if WebSocket fails
          wsConnection.onerror = () => {
            logger.error(`WebSocket error for server ${serverKey} in cluster ${clusterName}`);
            setLoadingServers?.((prev: any) => {
              const updated = { ...prev };
              delete updated[serverKey];
              return updated;
            });
          };

          // Add onopen handler for success feedback
          wsConnection.onopen = () => {
            // Connection opened successfully
          };
        } else {
          // Clear loading state if WebSocket setup failed
          setLoadingServers?.((prev: any) => {
            const updated = { ...prev };
            delete updated[serverKey];
            return updated;
          });
        }
      }
    },
    [clusterData, clusterVmsData, dataCenters, setLoadingServers, dispatch]
  );

  const setupAllServersWebSocketConnections = useCallback(async () => {
    const allServers = dataCenters?.flatMap((dc) => dc.servers || []) || [];

    if (allServers.length === 0) {
      return;
    }

    // Establish WebSocket connections for each server
    for (const server of allServers) {
      const serverKey = server.id;

      // Skip if WebSocket connection already exists for this server
      if (activeWebSocketsRef.current[serverKey]) {
        continue;
      }

      // Set loading state for this server
      setLoadingServers?.((prev: any) => ({ ...prev, [serverKey]: true }));

      // Setup WebSocket connection
      const wsConnection = setupVmListWebSocket(server, dispatch);

      if (wsConnection) {
        // Store the WebSocket connection for later management
        activeWebSocketsRef.current[serverKey] = wsConnection;

        // Add error handling to clear loading state if WebSocket fails
        wsConnection.onerror = () => {
          logger.error(`WebSocket error for server ${serverKey}`);
          setLoadingServers?.((prev: any) => {
            const updated = { ...prev };
            delete updated[serverKey];
            return updated;
          });
        };

        // Add onopen handler for success feedback
        wsConnection.onopen = () => {
          // Connection opened successfully
        };
      } else {
        // Clear loading state if WebSocket setup failed
        setLoadingServers?.((prev: any) => {
          const updated = { ...prev };
          delete updated[serverKey];
          return updated;
        });
      }
    }
  }, [dataCenters, setLoadingServers, dispatch]);

  return {
    activeWebSocketsRef,
    setupClusterWebSocketConnections,
    setupAllServersWebSocketConnections,
    closeWebSocketConnection,
    cleanupAllConnections,
  };
};
