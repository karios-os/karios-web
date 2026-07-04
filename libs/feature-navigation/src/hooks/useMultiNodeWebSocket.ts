import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../../../shared-state/src/utils/logger';

interface VmWebSocketState {
  name: string;
  datastore: string;
  state: string;
}

interface NodeConnection {
  ws: WebSocket | null;
  isConnected: boolean;
  vmStates: Record<string, VmWebSocketState>;
  reconnectAttempts: number;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
}

interface UseMultiNodeWebSocketResult {
  vmStates: Record<string, VmWebSocketState>; // Map of vmName -> state from all nodes
  isConnected: boolean; // True if at least one connection is active
  errors: Record<string, string>; // Map of nodeIp -> error
  reconnectNode: (nodeIp: string) => void;
  disconnectAll: () => void;
}

/**
 * Hook to manage WebSocket connections to multiple nodes for real-time VM state updates.
 * This allows tracking VMs across different parent and child nodes in a cluster.
 */
export const useMultiNodeWebSocket = (
  nodeIps: string[], // Array of node IPs to connect to
  token: string,
  enabled: boolean = true
): UseMultiNodeWebSocketResult => {
  const [vmStates, setVmStates] = useState<Record<string, VmWebSocketState>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const connectionsRef = useRef<Record<string, NodeConnection>>({});
  const maxReconnectAttempts = 5;
  const nodeIpsRef = useRef<string[]>(nodeIps);
  const tokenRef = useRef<string>(token);
  const enabledRef = useRef<boolean>(enabled);

  const updateVmStates = useCallback(() => {
    // Aggregate VM states from all node connections
    const aggregatedStates: Record<string, VmWebSocketState> = {};

    Object.values(connectionsRef.current).forEach((connection) => {
      Object.assign(aggregatedStates, connection.vmStates);
    });

    setVmStates(aggregatedStates);

    // Update connection status - connected if at least one node is connected
    const anyConnected = Object.values(connectionsRef.current).some((conn) => conn.isConnected);
    setIsConnected(anyConnected);
  }, []);

  const disconnectNode = useCallback(
    (nodeIp: string) => {
      const connection = connectionsRef.current[nodeIp];
      if (!connection) return;

      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout);
        connection.reconnectTimeout = null;
      }

      if (connection.ws) {
        connection.ws.close();
        connection.ws = null;
      }

      connection.isConnected = false;
      connection.vmStates = {};

      updateVmStates();
    },
    [updateVmStates]
  );

  const connectToNode = useCallback(
    (nodeIp: string) => {
      if (!enabled || !token || !nodeIp) {
        logger.warn(
          `[useMultiNodeWebSocket] Skipping connection - enabled: ${enabled}, token: ${!!token}, nodeIp: ${nodeIp}`
        );
        return;
      }

      // Initialize connection object if it doesn't exist
      if (!connectionsRef.current[nodeIp]) {
        connectionsRef.current[nodeIp] = {
          ws: null,
          isConnected: false,
          vmStates: {},
          reconnectAttempts: 0,
          reconnectTimeout: null,
        };
      }

      const connection = connectionsRef.current[nodeIp];

      // Clean up existing connection if any
      if (connection.ws) {
        logger.info(`[useMultiNodeWebSocket] Closing existing connection to ${nodeIp}`);
        connection.ws.close();
        connection.ws = null;
      }

      // Clear any pending reconnection timeouts
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout);
        connection.reconnectTimeout = null;
      }

      try {
        const wsUrl = `wss://${nodeIp}/api/v1/compute/vms/list/ws?token=${token}`;
        logger.info(`[useMultiNodeWebSocket] Initiating connection to node: ${nodeIp}`);

        const ws = new WebSocket(wsUrl);
        connection.ws = ws;

        ws.onopen = () => {
          logger.info(`[useMultiNodeWebSocket] ✅ Successfully connected to node: ${nodeIp}`);
          connection.isConnected = true;
          connection.reconnectAttempts = 0;

          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[nodeIp];
            return newErrors;
          });

          updateVmStates();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (Array.isArray(data)) {
              const vmMap: Record<string, VmWebSocketState> = {};

              data.forEach((vm: any) => {
                const vmState: VmWebSocketState = {
                  name: vm.name || '',
                  datastore: vm.datastore || '',
                  state: vm.state || 'Unknown',
                };

                vmMap[vm.name] = vmState;

                // Store globally for immediate access
                (window as any).vmStatesGlobal = (window as any).vmStatesGlobal || {};
                const previousState = (window as any).vmStatesGlobal[vm.name];
                (window as any).vmStatesGlobal[vm.name] = vm.state;

                // Dispatch state change event if state changed
                const previousStateFromConnection = connection.vmStates[vm.name]?.state;
                if (previousStateFromConnection && previousStateFromConnection !== vm.state) {
                  const vmStateChangeEvent = new CustomEvent('vmStateChanged', {
                    detail: {
                      vmName: vm.name,
                      newState: vm.state,
                      previousState: previousStateFromConnection,
                      nodeIp,
                      timestamp: Date.now(),
                    },
                  });
                  window.dispatchEvent(vmStateChangeEvent);
                  logger.info(
                    `[useMultiNodeWebSocket] VM state changed on ${nodeIp}: ${vm.name} ${previousStateFromConnection} -> ${vm.state}`
                  );
                }

                // Dispatch initial state event for newly discovered VMs
                if (!connection.vmStates[vm.name]) {
                  const vmStateInitEvent = new CustomEvent('vmStateInitialized', {
                    detail: {
                      vmName: vm.name,
                      state: vm.state,
                      nodeIp,
                      timestamp: Date.now(),
                    },
                  });
                  window.dispatchEvent(vmStateInitEvent);
                  logger.info(
                    `[useMultiNodeWebSocket] VM state initialized on ${nodeIp}: ${vm.name} -> ${vm.state}`
                  );
                }
              });

              connection.vmStates = vmMap;
              updateVmStates();

              logger.debug(`[useMultiNodeWebSocket] Updated VM states for ${nodeIp}:`, {
                count: Object.keys(vmMap).length,
                vms: Object.entries(vmMap).map(([name, state]) => ({ name, state: state.state })),
              });
            }
          } catch (err) {
            logger.error(`[useMultiNodeWebSocket] Error parsing message from ${nodeIp}:`, err);
          }
        };

        ws.onerror = (event) => {
          logger.error(`[useMultiNodeWebSocket] WebSocket error for ${nodeIp}:`, event);
          setErrors((prev) => ({
            ...prev,
            [nodeIp]: 'WebSocket connection error',
          }));
        };

        ws.onclose = (event) => {
          logger.info(
            `[useMultiNodeWebSocket] WebSocket closed for ${nodeIp}. Code: ${event.code}, Reason: ${event.reason}`
          );
          connection.isConnected = false;
          connection.ws = null;
          updateVmStates();

          // Attempt to reconnect if still enabled
          if (enabled && connection.reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, connection.reconnectAttempts), 30000);
            logger.info(
              `[useMultiNodeWebSocket] Reconnecting to ${nodeIp} in ${delay}ms (attempt ${connection.reconnectAttempts + 1}/${maxReconnectAttempts})`
            );

            connection.reconnectTimeout = setTimeout(() => {
              connection.reconnectAttempts++;
              connectToNode(nodeIp);
            }, delay);
          } else if (!enabled) {
            logger.info(`[useMultiNodeWebSocket] Not reconnecting to ${nodeIp} - disabled`);
          } else {
            setErrors((prev) => ({
              ...prev,
              [nodeIp]: 'Max reconnection attempts reached',
            }));
          }
        };
      } catch (err) {
        logger.error(`[useMultiNodeWebSocket] Error creating WebSocket for ${nodeIp}:`, err);
        setErrors((prev) => ({
          ...prev,
          [nodeIp]: 'Failed to create WebSocket connection',
        }));
      }
    },
    [enabled, token, updateVmStates]
  );

  const reconnectNode = useCallback(
    (nodeIp: string) => {
      const connection = connectionsRef.current[nodeIp];
      if (connection) {
        connection.reconnectAttempts = 0;
      }
      connectToNode(nodeIp);
    },
    [connectToNode]
  );

  const disconnectAll = useCallback(() => {
    Object.keys(connectionsRef.current).forEach((nodeIp) => {
      disconnectNode(nodeIp);
    });
    connectionsRef.current = {};
    setVmStates({});
    setIsConnected(false);
    setErrors({});
  }, [disconnectNode]);

  // Keep refs updated with current values
  useEffect(() => {
    nodeIpsRef.current = nodeIps;
    tokenRef.current = token;
    enabledRef.current = enabled;
  }, [nodeIps, token, enabled]);

  // Global event listener for force reconnect
  useEffect(() => {
    logger.info('[useMultiNodeWebSocket] Setting up forceClusterReconnect listener');

    const handleForceReconnect = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { serverAddress, vmName, action, status } = customEvent.detail || {};
      
      logger.info(
        `[useMultiNodeWebSocket] FORCE RECONNECT event received - serverAddress: ${serverAddress}, vm: ${vmName}, action: ${action}, status: ${status}`
      );

      // If serverAddress is provided, reconnect that specific node
      if (serverAddress && nodeIpsRef.current.includes(serverAddress)) {
        logger.info(`[useMultiNodeWebSocket] Forcing reconnect to ${serverAddress}`);
        reconnectNode(serverAddress);
      } else if (serverAddress) {
        // Server address not in current connection list, try to add it
        logger.info(`[useMultiNodeWebSocket] Requested server ${serverAddress} not in connection list, will be added on next cluster update`);
      } else {
        // No serverAddress provided, reconnect all nodes
        logger.info(`[useMultiNodeWebSocket] No specific serverAddress, reconnecting ALL nodes`);
        Object.keys(connectionsRef.current).forEach((nodeIp) => {
          reconnectNode(nodeIp);
        });
      }
    };

    window.addEventListener('forceClusterReconnect', handleForceReconnect);
    logger.info('[useMultiNodeWebSocket] forceClusterReconnect listener attached');

    return () => {
      window.removeEventListener('forceClusterReconnect', handleForceReconnect);
      logger.info('[useMultiNodeWebSocket] forceClusterReconnect listener removed');
    };
  }, [reconnectNode]);

  // Effect to manage connections based on nodeIps array
  useEffect(() => {
    if (!enabled) {
      logger.info(`[useMultiNodeWebSocket] Hook disabled, disconnecting all nodes`);
      disconnectAll();
      return () => {};
    }

    // Get current node IPs
    const currentNodeIps = new Set(nodeIps.filter(Boolean));
    const connectedNodeIps = new Set(Object.keys(connectionsRef.current));

    logger.info(
      `[useMultiNodeWebSocket] Managing connections - Current: [${Array.from(currentNodeIps).join(', ')}], Connected: [${Array.from(connectedNodeIps).join(', ')}]`
    );

    // Disconnect from nodes that are no longer in the list
    connectedNodeIps.forEach((nodeIp) => {
      if (!currentNodeIps.has(nodeIp)) {
        logger.info(`[useMultiNodeWebSocket] 🔌 Removing connection to ${nodeIp}`);
        disconnectNode(nodeIp);
        delete connectionsRef.current[nodeIp];
      }
    });

    // Connect to new nodes
    currentNodeIps.forEach((nodeIp) => {
      if (!connectedNodeIps.has(nodeIp)) {
        logger.info(`[useMultiNodeWebSocket] 🔗 Adding connection to ${nodeIp}`);
        connectToNode(nodeIp);
      }
    });

    // Only cleanup on unmount, not on every re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      // Cleanup on unmount only
      Object.keys(connectionsRef.current).forEach((nodeIp) => {
        const connection = connectionsRef.current[nodeIp];
        if (connection.reconnectTimeout) {
          clearTimeout(connection.reconnectTimeout);
        }
        if (connection.ws) {
          connection.ws.close();
        }
      });
    };
  }, [nodeIps, enabled]);

  return {
    vmStates,
    isConnected,
    errors,
    reconnectNode,
    disconnectAll,
  };
};
