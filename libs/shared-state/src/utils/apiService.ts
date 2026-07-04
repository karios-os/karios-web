import api from './interceptor';
import { ActionTypes as BaseActionTypes } from './actionTypes';
import { logger } from './logger';

import envConfig from '../../../../runtime-config';

// API base URL for Control Node
const CONTROL_NODE_API_BASE_URL = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/controlnode`;


// Type definition for fetchInventory options
interface FetchInventoryOptions {
  offset?: number;
  limit?: number;
  bmc_ip?: string;
  os_ip?: string;
  vendor?: string;
  status?: string;
}

// Type definition for fetchInventory result
interface FetchInventoryResult {
  inventory: any[];
  totalCount: number;
}

// Fetch inventory data from control node with pagination and filtering
export const fetchInventory = async (
  dispatch: any,
  options: FetchInventoryOptions = {}
): Promise<FetchInventoryResult> => {
  try {
    dispatch({ type: ActionTypes.FETCH_INVENTORY_START });

    // Build query parameters for pagination and filtering
    const params = new URLSearchParams();

    // Always include pagination parameters
    if (options.offset !== undefined) params.append('offset', options.offset.toString());
    if (options.limit !== undefined) params.append('limit', options.limit.toString());

    // Add filtering parameters
    if (options.bmc_ip) params.append('bmc_ip', options.bmc_ip);
    if (options.os_ip) params.append('os_ip', options.os_ip);
    if (options.vendor) params.append('vendor', options.vendor);
    if (options.status) params.append('status', options.status);

    // Build URL with query parameters
    const url = `${CONTROL_NODE_API_BASE_URL}/inventory${params.toString() ? '?' + params.toString() : ''}`;

    const inventoryResponse = await api.fetch(url);

    if (!inventoryResponse.ok) {
      const errorData = await inventoryResponse.json();
      throw new Error(errorData.error || 'Failed to fetch inventory.');
    }

    const response = await inventoryResponse.json();

    // Handle the new response structure with inventory array and total
    const inventoryData = response.inventory || [];

    // Process inventory data
    const processedInventory = inventoryData.map((item) => ({
      ...item,
      ip: item.ip,
      vendor: item.vendor,
      version: item.version,
      username: item.username || '',
      password: item.password || '',
      nodeIP: item.os_ip || '',
      nodeHostname: item.os_hostname || '',
      is_pikvm_connected: item.is_pikvm_connected || false,
      isEditing: false,
      stage: mapStatusToStage(item.status),
      lastUpdated: formatAPITimestamp(item.last_updated),
      provisioned: item.status !== 'DISCOVERED',
    }));

    // Use the total from the response
    const totalCount = response.total || processedInventory.length;

    dispatch({
      type: ActionTypes.FETCH_INVENTORY_SUCCESS,
      payload: {
        inventory: processedInventory,
        totalCount: totalCount,
      },
    });

    return {
      inventory: processedInventory,
      totalCount: totalCount,
    };
  } catch (error) {
    dispatch({
      type: ActionTypes.FETCH_INVENTORY_FAILURE,
      payload: error.message,
    });
    throw error;
  }
};

// Ping a node to check if it's up
export const pingNode = async (nodeIp) => {
  try {
    const response = await api.fetch(`${CONTROL_NODE_API_BASE_URL}/ping/${nodeIp}`);
    return response.status === 200;
  } catch (error) {
    logger.error(`Ping failed for ${nodeIp}:`, error.message);
    return false;
  }
};

// Helper functions for data formatting
const mapStatusToStage = (status) => {
  switch (status) {
    case 'DISCOVERED':
      return 'Discovered';
    case 'CREDS_SET':
      return 'Creds Set';
    case 'REGISTERED':
      return 'Registered';
    case 'PROVISIONING':
      return 'Provisioning';
    case 'PROVISIONED':
      return 'Provisioned';
    case 'Provisioned':
      return 'Provisioned'; // Handle both uppercase and mixed case
    case 'CONFIGURING':
      return 'Configuring';
    case 'CONFIGURED':
      return 'Configured';
    default:
      return status;
  }
};

const formatAPITimestamp = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (e) {
    return timestamp;
  }
};


/**
 * Enhanced version of fetchVMs that supports both scenarios:
 * 1. Initial load with no selected server - fetches from inventory API
 * 2. Load with selected server - fetches VMs for that specific server
 *
 * This handles configuration of nodes and builds the data center structure.
 */
export const fetchVMs = async (state, dispatch) => {
  try {
    dispatch({ type: ActionTypes.FETCH_DATA_START });

    let serverNodes = [];

    // Scenario 1: No server selected, get inventory from control node
    // if (!state.selectedServer || !state.selectedServer.ip) {
    try {
      // Fetch inventory from control node
      const inventoryResponse = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/controlnode/inventory`,
        {
          method: 'GET',
        }
      );

      if (!inventoryResponse.ok) {
        const errorData = await inventoryResponse.json();
        throw new Error(errorData.error || 'Failed to fetch inventory.');
      }

      const inventoryData = await inventoryResponse.json();

      // Handle the new response structure with inventory array
      const inventoryArray = inventoryData.inventory || inventoryData;

      // Filter for configured devices only
      const configuredDevices = inventoryArray.filter((device) => device.status === 'CONFIGURED');

      // Store configured nodes in state
      dispatch({
        type: ActionTypes.SET_CONFIGURED_NODES,
        payload: configuredDevices.map((device) => ({
          nodeHostname: device.os_hostname,
          nodeIP: device.os_ip,
        })),
      });

      // Map devices to server nodes without VM data
      serverNodes = configuredDevices.map((device, index) => ({
        id: 101 + index,
        name: device.os_hostname,
        isOpen: false, // First node is open by default
        ip: device.os_ip,
        fqdn: device.fqdn ? device.fqdn.trim() : null, // Include FQDN and trim whitespace
        vms: [], // Empty VMs array - will be populated when user clicks dropdown
      }));
    } catch (error) {
      logger.error('Error fetching inventory data:', error);
      dispatch({ type: ActionTypes.FETCH_DATA_FAILURE, payload: error.message });
      return;
    }
    // }

    // Create the final data centers structure
    const transformedData = [
      {
        id: 1,
        name: '',
        isOpen: true,
        servers: serverNodes,
      },
    ];

    // Update the data centers state
    dispatch({ type: ActionTypes.FETCH_DATACENTERS_SUCCESS, payload: transformedData });
  } catch (error) {
    logger.error('Error in fetchVMs:', error);
    dispatch({ type: ActionTypes.FETCH_DATA_FAILURE, payload: error.message });
  }
};

// Fetch initial data centers from given server IP
export const fetchInitialDataCenters = async (currentSelectedServerIp, state, dispatch) => {
  try {
    dispatch({ type: ActionTypes.FETCH_DATA_START });

    let serverNodes = [];

    // Scenario 1: No server selected, get inventory from control node
    if (!currentSelectedServerIp) {
      try {
        const inventoryResponse = await api.fetch(`${CONTROL_NODE_API_BASE_URL}/inventory`);
        const inventoryData = await inventoryResponse.json();

        // Handle the response structure - could be direct array or wrapped in {inventory: [...]}
        const configuredDevices = inventoryData.inventory || inventoryData;

        // Store configured nodes in state
        dispatch({
          type: ActionTypes.SET_CONFIGURED_NODES,
          payload: configuredDevices.map((device) => ({
            nodeHostname: device.os_hostname,
            nodeIP: device.os_ip,
          })),
        });

        // Fetch VMs for each configured device using WebSocket
        const token = localStorage.getItem('accessToken');
        const vms = await Promise.all(
          configuredDevices.map(async (device) => {
            return new Promise((resolve) => {
              try {
                const wsUrl = `${envConfig().WS_PROTOCOL}://${currentSelectedServerIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list/ws?token=${token}`;
                const ws = new WebSocket(wsUrl);

                ws.onmessage = (event) => {
                  try {
                    const vmsData = JSON.parse(event.data);
                    ws.close();
                    resolve(vmsData);
                  } catch (err) {
                    logger.error(
                      `Error parsing WebSocket data for device ${device.os_hostname}:`,
                      err
                    );
                    ws.close();
                    resolve([]);
                  }
                };

                ws.onerror = (err) => {
                  logger.error(`WebSocket error for device ${device.os_hostname}:`, err);
                  ws.close();
                  resolve([]);
                };

                // Timeout after 10 seconds
                setTimeout(() => {
                  if (ws.readyState !== WebSocket.CLOSED) {
                    ws.close();
                    resolve([]);
                  }
                }, 10000);
              } catch (err) {
                logger.error(`Error creating WebSocket for device ${device.os_hostname}:`, err);
                resolve([]);
              }
            });
          })
        );

        // Map devices to server nodes with VM data AND inventory data
        serverNodes = configuredDevices.map((device, index) => {
          return {
            id: 101 + index,
            name: device.os_hostname,
            hostname: device.os_hostname,
            isOpen: index === 0,
            ip: device.os_ip,
            fqdn: device.fqdn ? device.fqdn.trim() : null, // Include FQDN and trim whitespace
            // Include inventory fields for power control and other operations
            vendor: device.vendor,
            bmc_ip: device.ip, // BMC IP is stored in the 'ip' field
            bmc_username: device.username,
            bmc_password: device.password,
            version: device.version,
            status: device.status,
            last_updated: device.last_updated,
            provisioned: device.status !== 'DISCOVERED',
            vms: vms[index].map((vm, vmIndex) => ({
              id: `vm-${vmIndex}`,
              name: vm.name,
              datastore: vm.datastore,
              state: vm.state,
              isOn: vm.state === 'Running',
            })),
          };
        });
      } catch (error) {
        logger.error('Error fetching inventory data:', error);
        dispatch({ type: ActionTypes.FETCH_DATA_FAILURE, payload: error.message });
        return;
      }
    }
    // Scenario 2: Server is selected, fetch VMs just for that server
    else {
      return;
    }

    // Create the final data centers structure
    const transformedData = [
      {
        id: 1,
        name: 'Control Node',
        isOpen: true,
        servers: serverNodes,
      },
    ];

    // Update the data centers state
    dispatch({ type: ActionTypes.FETCH_DATACENTERS_SUCCESS, payload: transformedData });
  } catch (error) {
    logger.error('Error in fetchInitialDataCenters:', error);
    dispatch({ type: ActionTypes.FETCH_DATA_FAILURE, payload: error.message });
  }
};

// Modify fetchVMsForServer to use existing API calls
// Real-time updates are handled by the persistent setupVmWebSocket connection
export const fetchVMsForServer = async (
  server,
  dispatch,
  state
): Promise<{
  vms: { id: string; name: string; datastore: string; state: string; isOn: boolean }[];
} | null> => {
  if (!server || !server.ip) {
    logger.error('fetchVMsForServer called without valid server or server.ip');
    return null;
  }
  dispatch({ type: ActionTypes.FETCH_DATA_START });

  return new Promise((resolve, reject) => {
    try {
      // Use FQDN with fallback to IP for server address
      const serverAddress = server.fqdn || server.ip;
      const token = localStorage.getItem('accessToken');

      // Use WebSocket for VM list fetching
      const wsUrl = `${envConfig().WS_PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list/ws?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const vmsData = JSON.parse(event.data);

          // Transform VM data
          const vms = vmsData.map((vm, index) => ({
            id: `vm-${index}`,
            name: vm.name,
            datastore: vm.datastore,
            state: vm.state,
            uuid: vm.uuid, // Store the UUID from API response
            isOn: vm.state === 'Running',
            hostname: vm.hostname, // Include hostname
            vm_fqdn: vm.vm_fqdn, // Include VM FQDN
          }));

          // Update server in data centers
          dispatch({
            type: ActionTypes.FETCH_VMS_FOR_SERVER_SUCCESS,
            payload: { serverId: server.id, vms },
          });

          // If this is the currently selected server and we have a selected VM, update its details
          if (
            state &&
            state.selectedServer &&
            state.selectedServer.id === server.id &&
            state.selectedVm
          ) {
            const updatedVm = vmsData.find((vm) => vm.name === state.selectedVm.name);
            if (updatedVm) {
              dispatch({
                type: ActionTypes.SET_SELECTED_VM,
                payload: {
                  ...state.selectedVm,
                  datastore: updatedVm.datastore,
                  state: updatedVm.state,
                  uuid: updatedVm.uuid, // Update UUID
                  isOn: updatedVm.state === 'Running',
                  hostname: updatedVm.hostname, // Include hostname
                  vm_fqdn: updatedVm.vm_fqdn, // Include VM FQDN
                },
              });
            }
          }

          ws.close();
          resolve({ vms });
        } catch (parseError) {
          logger.error(`Error parsing WebSocket data for server ${server.name}:`, parseError);
          ws.close();
          dispatch({ type: ActionTypes.FETCH_DATA_FAILURE, payload: parseError.message });
          reject(parseError);
        }
      };

      ws.onerror = (error) => {
        logger.error(`WebSocket error for server ${server.name}:`, error);
        ws.close();
        dispatch({ type: ActionTypes.FETCH_DATA_FAILURE, payload: 'WebSocket connection error' });
        reject(error);
      };

      ws.onclose = () => {
        logger.info(`WebSocket closed for server ${server.name}`);
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
          const timeoutError = new Error('WebSocket timeout');
          dispatch({ type: ActionTypes.FETCH_DATA_FAILURE, payload: timeoutError.message });
          reject(timeoutError);
        }
      }, 10000);
    } catch (error) {
      logger.error(`Error creating WebSocket for server ${server.name}:`, error);
      dispatch({ type: ActionTypes.FETCH_DATA_FAILURE, payload: error.message });
      reject(error);
    }
  });
};

// Set configured nodes directly
export const setConfiguredNodes = async (nodes, dispatch) => {
  if (!nodes || !Array.isArray(nodes)) return;

  dispatch({
    type: ActionTypes.SET_CONFIGURED_NODES,
    payload: nodes.map((node) => ({
      nodeHostname: node.nodeHostname || node.os_hostname,
      nodeIP: node.nodeIP || node.os_ip,
    })),
  });
};

// Handle VM console deletion
export const handleDeleteConsole = async (serverIp, vmName) => {
  if (!vmName || !serverIp) {
    logger.error('Cannot delete console session: VM name or Server IP is missing.');
    return;
  }
  try {
    await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/console/destroy/${vmName}`,
      {
        method: 'DELETE',
      }
    );
  } catch (error) {
    logger.error('Error destroying console session:', error);
    // Optionally dispatch an error to state
  }
};

// Perform various VM actions
export const performVmAction = async (
  serverIp,
  vmName,
  action,
  body,
  state,
  dispatch,
  approver?: string,
  vmUuid?: string
) => {
  dispatch({ type: ActionTypes.VM_ACTION_START });
  const identifier = vmUuid || vmName; // Use UUID if provided, fallback to vmName
  let apiUrl = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${identifier}/action/${action}`;
  const method = action === 'destroy' || action === 'clone' ? 'POST' : 'PUT'; // Adjust based on API

  try {
    // Add approver as query parameter if provided and action is destroy
    if (approver && action === 'destroy') {
      const urlParams = new URLSearchParams();
      urlParams.append('approver', approver);
      apiUrl += `?${urlParams.toString()}`;
    }

    const payload = { ...body };

    const response = await api.fetch(apiUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify(payload),
    });

    // After successful action, refresh VMs for the server
    const targetServer = state.dataCenters
      .flatMap((dc) => dc.servers)
      .find((s) => s.ip === serverIp);
    if (targetServer) {
      await fetchVMsForServer(targetServer, dispatch, state);
    }
    // If action was destroy and it was the selected VM, clear selectedVm
    if (action === 'destroy' && state.selectedVm && state.selectedVm.name === vmName) {
      dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: null });
      // Potentially navigate away or set activeComponent to home
    }
    dispatch({ type: ActionTypes.VM_ACTION_SUCCESS });
    return response; // Return response for specific handling if needed
  } catch (error) {
    logger.error(`Error performing ${action} on VM ${vmName}:`, error);
    dispatch({ type: ActionTypes.VM_ACTION_FAILURE, payload: error.message });
    throw error; // Re-throw for component to handle (e.g., show alert)
  }
};

// Rename VM
export const renameVmInContext = async (
  serverIp,
  vmName,
  datastore,
  newVmName,
  state,
  dispatch,
  approver?: string,
  vmUuid?: string
) => {
  dispatch({ type: ActionTypes.VM_ACTION_START });
  let apiUrl = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/rename`;

  // Add approver as query parameter if provided
  if (approver) {
    const urlParams = new URLSearchParams();
    urlParams.append('approver', approver);
    apiUrl += `?${urlParams.toString()}`;
  }

  try {
    const response = await api.fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify({
        vm_uuid: vmUuid || vmName, // Use UUID if provided, fallback to vmName
        vm_name: vmName,
        datastore: datastore,
        new_vm_name: newVmName,
      }),
    });

    // After successful rename, refresh VMs for the server
    const targetServer = state.dataCenters
      .flatMap((dc) => dc.servers)
      .find((s) => s.ip === serverIp);
    if (targetServer) {
      await fetchVMsForServer(targetServer, dispatch, state);
    }

    // If the renamed VM was the selected one, update the selection
    if (state.selectedVm && state.selectedVm.name === vmName) {
      // We need to find the renamed VM in the updated list
      const updatedServer: { vms: { name: string }[] } | null = await fetchVMsForServer(
        targetServer,
        dispatch,
        state
      );
      if (updatedServer && updatedServer.vms) {
        const renamedVm = updatedServer.vms.find((vm) => vm.name === newVmName);
        if (renamedVm) {
          dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: renamedVm });
        }
      }
    }

    dispatch({ type: ActionTypes.VM_ACTION_SUCCESS });
    return response;
  } catch (error) {
    logger.error(`Error renaming VM ${vmName} to ${newVmName}:`, error);
    dispatch({ type: ActionTypes.VM_ACTION_FAILURE, payload: error.message });
    throw error;
  }
};

// Clone VM
export const cloneVmInContext = async (
  serverIp,
  vmName,
  datastore,
  newVmName,
  state,
  dispatch,
  approver?: string,
  vmUuid?: string
) => {
  dispatch({ type: ActionTypes.VM_ACTION_START });
  let apiUrl = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/clone`;

  try {
    const payload: any = {
      vm_uuid: vmUuid || vmName, // Use UUID if provided, fallback to vmName
      vm_name: vmName,
      datastore: datastore,
      new_vm_name: newVmName,
    };

    // Add approver as query parameter if provided
    if (approver) {
      const urlParams = new URLSearchParams();
      urlParams.append('approver', approver);
      apiUrl += `?${urlParams.toString()}`;
    }

    const response = await api.fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify(payload),
    });

    // After successful cloning, refresh VMs for the server
    const targetServer = state.dataCenters
      .flatMap((dc) => dc.servers)
      .find((s) => s.ip === serverIp);
    if (targetServer) {
      await fetchVMsForServer(targetServer, dispatch, state);
    }

    dispatch({ type: ActionTypes.VM_ACTION_SUCCESS });
    return response;
  } catch (error) {
    logger.error(`Error cloning VM ${vmName} to ${newVmName}:`, error);
    dispatch({ type: ActionTypes.VM_ACTION_FAILURE, payload: error.message });
    throw error;
  }
};

// Track last ping time for each server to prevent excessive calls
const lastPingTimes = {};
const PING_COOLDOWN_MS = 10000; // 10 seconds cooldown between pings to the same server
const GLOBAL_COOLDOWN_MS = 60000; // 60 seconds global cooldown
let lastGlobalCheckTime = 0; // When did we last run a full check

// Check node statuses
export const checkNodeStatuses = async (state, dispatch) => {
  if (!state || !state.dataCenters) return;

  const now = Date.now();

  // Apply global rate limiting to prevent excessive calls
  if (now - lastGlobalCheckTime < GLOBAL_COOLDOWN_MS) {
    return;
  }

  lastGlobalCheckTime = now;
  const statuses = {};
  let hasChanges = false;

  try {
    for (const dc of state.dataCenters) {
      if (!dc.servers || !Array.isArray(dc.servers)) continue;

      for (const server of dc.servers) {
        if (!server || !server.ip) continue;

        // Skip this server if we've pinged it recently
        const serverId = server.id || server.ip;
        if (lastPingTimes[serverId] && now - lastPingTimes[serverId] < PING_COOLDOWN_MS) {
          if (state.nodeStatuses && state.nodeStatuses[serverId]) {
            statuses[serverId] = state.nodeStatuses[serverId]; // Keep previous status
          } else {
            statuses[serverId] = 'unknown'; // Set to unknown if no previous status
          }
          continue; // Skip pinging this server
        }

        try {
          // Update last ping time for this server
          lastPingTimes[serverId] = now;

          // Use FQDN with fallback to IP for the ping endpoint
          const serverAddress = server.fqdn?.trim() || server.ip;
          // Assuming your ping endpoint is on the control node
          const controlNodeIp = envConfig().CONTROL_NODE_IP.URL; // Or get this from config/state
          const response = await api.fetch(
            `${envConfig().PROTOCOL}://${controlNodeIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/controlnode/ping/${serverAddress}`
          );

          // Determine the new status
          const newStatus = response.status === 200 ? 'online' : 'offline';

          // Check if status has changed
          if (!state.nodeStatuses || state.nodeStatuses[serverId] !== newStatus) {
            hasChanges = true;
          }

          statuses[serverId] = newStatus;
        } catch (error) {
          logger.error(
            `Error checking status for node ${server.fqdn?.trim() || server.ip}:`,
            error
          );
          statuses[serverId] = 'offline';

          // Count errors as changes
          if (!state.nodeStatuses || state.nodeStatuses[serverId] !== 'offline') {
            hasChanges = true;
          }
        }
      }
    }

    // Only dispatch if there are actual changes to the node statuses
    if (hasChanges && Object.keys(statuses).length > 0) {
      dispatch({ type: ActionTypes.SET_NODE_STATUSES, payload: statuses });
    }
  } catch (e) {
    logger.error('Error in checkNodeStatuses:', e);
  }
};

// WebSocket connection for real-time VM updates (persistent connection for live monitoring)
// This is the ONLY WebSocket connection that should be used for VM list updates.
// Initial data fetching uses regular API calls, real-time updates use this WebSocket.
export const setupVmWebSocket = (serverIp, state, dispatch) => {
  if (!serverIp) return null;

  // Get the token from localStorage
  const token = localStorage.getItem('accessToken');
  if (!token) {
    logger.error('No access token found in localStorage');
    return null;
  }

  const wsUrl = `${envConfig().WS_PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list/ws?token=${token}`;

  // Create WebSocket connection for the selected server including the token
  const ws = new WebSocket(wsUrl);

  // Connection opened
  ws.onopen = () => {
    dispatch({ type: ActionTypes.WEBSOCKET_CONNECT });
  };

  // Listen for messages
  ws.onmessage = (event) => {
    try {
      const vmsData = JSON.parse(event.data);

      // Dispatch update to state
      dispatch({
        type: ActionTypes.WEBSOCKET_VM_UPDATE,
        payload: { serverIp, vmsData },
      });

      // Check for VM state changes that require console session cleanup
      if (state.selectedVm) {
        const updatedVM = vmsData.find((vm) => vm.name === state.selectedVm.name);
        if (updatedVM && state.selectedVm.state === 'Running' && updatedVM.state !== 'Running') {
          // Console cleanup removed
        }
      }
    } catch (error) {
      logger
    }
  };

  // Handle errors
  ws.onerror = (error) => {};

  // Handle WebSocket closure
  ws.onclose = (event) => {
    dispatch({ type: ActionTypes.WEBSOCKET_DISCONNECT });
  };

  return ws;
};

// Simple function to fetch VM list when node dropdown is selected (WebSocket implementation)
export const fetchVmListForNode = async (serverIp: string): Promise<any[]> => {
  return new Promise<any[]>((resolve) => {
    try {
      const token = localStorage.getItem('accessToken');
      const wsUrl = `${envConfig().WS_PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list/ws?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const vmsData = JSON.parse(event.data);
          ws.close();
          resolve(vmsData);
        } catch (err) {
          logger.error('Error parsing WebSocket data in fetchVmListForNode:', err);
          ws.close();
          resolve([]);
        }
      };

      ws.onerror = (err) => {
        logger.error('WebSocket error in fetchVmListForNode:', err);
        ws.close();
        resolve([]);
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
          resolve([]);
        }
      }, 10000);
    } catch (err) {
      logger.error('Error creating WebSocket in fetchVmListForNode:', err);
      resolve([]);
    }
  });
};

// WebSocket connection specifically for VM list loading when dropdown arrow is clicked
// This function is called when user clicks the down arrow to expand server VM list
export const setupVmListWebSocket = (
  server,
  dispatch,
  mode: 'node' | 'vm' = 'node'
): WebSocket | null => {
  // For 'vm' mode, we can pass any server object as we only need control node IP
  // For 'node' mode, we need the server to have a valid IP or FQDN
  const serverAddr = server?.fqdn || server?.ip;
  if (mode === 'node' && (!server || !serverAddr)) {
    logger.error('setupVmListWebSocket called without valid server or server address');
    return null;
  }

  // For 'vm' mode when server is null/undefined, create a dummy object
  if (mode === 'vm' && (!server || !serverAddr)) {
    server = { id: 'vmsList', ip: '0.0.0.0', fqdn: null }; // Dummy values, IP not used in vm mode
  }

  // Determine which address to use based on mode
  // 'node' mode: uses the server FQDN (with fallback to IP) when clicking dropdown on a specific node
  // 'vm' mode: uses the control node IP (when clicking VMs tab to get all VMs)
  const targetIp = mode === 'vm' ? envConfig().CONTROL_NODE_IP.URL : serverAddr;
  const serverId = mode === 'vm' ? 'vmsList' : server.id;

  // Get the token from localStorage
  const token = localStorage.getItem('accessToken');
  if (!token) {
    logger.error('No access token found in localStorage for WebSocket connection');
    return null;
  }

  // Track retry state
  let isRetrying = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let responseReceived = false;

  const createAndSetupWebSocket = (protocol: string): WebSocket => {
    const wsUrl = `${protocol}://${serverAddr}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);

    // Store the last known VM states to compare for changes
    let lastVmStates = new Map();

    // Connection opened
    ws.onopen = () => {
      // WebSocket connection established - no payload needed, server responds automatically
    };

    // Listen for messages
    ws.onmessage = (event) => {
      // Mark that we received the first response
      responseReceived = true;

      // Clear timeout on first message
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      try {
        const vmsData = JSON.parse(event.data);

        // Transform VM data to match expected format
        const transformedVms = vmsData.map((vm, index) => ({
          id: `vm-${index}`,
          name: vm.name,
          datastore: vm.datastore,
          state: vm.state,
          uuid: vm.uuid, // Store the UUID from WebSocket response
          isOn: vm.state === 'Running',
          hostname: vm.hostname, // Include hostname
          vm_fqdn: vm.vm_fqdn, // Include VM FQDN
        }));

        // Check if VM states have actually changed before dispatching update
        let hasStatusChanges = false;

        if (lastVmStates.size === 0) {
          // First time loading VMs, always dispatch
          hasStatusChanges = true;
        } else {
          // Check if any VM statuses have changed
          for (const vm of transformedVms) {
            const lastState = lastVmStates.get(vm.name);
            if (!lastState || lastState !== vm.state) {
              hasStatusChanges = true;
              break;
            }
          }

          // Also check if any VMs were removed
          if (!hasStatusChanges && lastVmStates.size !== transformedVms.length) {
            hasStatusChanges = true;
          }
        }

        // Update the stored VM states
        lastVmStates.clear();
        transformedVms.forEach((vm) => {
          lastVmStates.set(vm.name, vm.state);
        });

        // Only dispatch update if VM statuses have actually changed
        if (hasStatusChanges) {
          dispatch({
            type: ActionTypes.WEBSOCKET_VM_LIST_UPDATE,
            payload: {
              serverId,
              vms: transformedVms,
              isOnConsolePage:
                window.location.pathname.includes('/vm/') &&
                window.location.pathname.includes('/console'),
            },
          });
        }

        // DO NOT close the WebSocket - keep it open for live updates
      } catch (error) {
        dispatch({
          type: ActionTypes.WEBSOCKET_VM_LIST_ERROR,
          payload: serverId,
        });
        ws.close();
      }
    };

    // Handle WebSocket closure
    ws.onclose = (event) => {
      // Clear timeout on close
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    return ws;
  };

  // Dispatch action to indicate WebSocket VM list fetching has started
  dispatch({ type: ActionTypes.WEBSOCKET_VM_LIST_START, payload: serverId });

  // Set up 60-second timeout for first response
  timeoutId = setTimeout(() => {
    if (!responseReceived) {
      dispatch({
        type: ActionTypes.WEBSOCKET_VM_LIST_ERROR,
        payload: serverId,
      });
    }
  }, 60000);

  // Create and setup WebSocket with initial protocol
  const ws = createAndSetupWebSocket(envConfig().WS_PROTOCOL);

  return ws;
};

// Handle URL-based state updates for server, VM, and datacenter
export const handleUrlBasedStateUpdates = (location, state, dispatch) => {
  if (!state.dataCenters || state.dataCenters.length === 0) return;

  const pathParts = location.pathname.split('/');

  // Server selection from URL
  const serverNameFromUrl = pathParts.includes('server')
    ? pathParts[pathParts.indexOf('server') + 1]
    : null;
  if (serverNameFromUrl) {
    const server = state.dataCenters
      .flatMap((dc) => dc.servers)
      .find((s) => s.name === serverNameFromUrl);

    if (server && (!state.selectedServer || state.selectedServer.id !== server.id)) {
      dispatch({ type: ActionTypes.URL_UPDATE_SERVER, payload: server });
    }
  }

  // VM selection from URL
  const vmNameFromUrl = pathParts.includes('vm') ? pathParts[pathParts.indexOf('vm') + 1] : null;
  if (vmNameFromUrl) {
    const allVMs = state.dataCenters
      .flatMap((dc) => dc.servers)
      .flatMap((server) => server.vms || []);

    const vm = allVMs.find((v) => v.name === vmNameFromUrl);

    if (vm && (!state.selectedVm || state.selectedVm.name !== vm.name)) {
      dispatch({ type: ActionTypes.URL_UPDATE_VM, payload: vm });

      // Also update server if VM belongs to a different server
      if (
        !state.selectedServer ||
        !state.selectedServer.vms?.some((serverVm) => serverVm.name === vm.name)
      ) {
        const parentServer = state.dataCenters
          .flatMap((dc) => dc.servers)
          .find((server) => server.vms?.some((serverVm) => serverVm.name === vm.name));

        if (parentServer) {
          dispatch({ type: ActionTypes.URL_UPDATE_SERVER, payload: parentServer });
        }
      }
    }
  }

  // Datacenter selection from URL
  const dcIdFromUrl = pathParts.includes('dc') ? pathParts[pathParts.indexOf('dc') + 1] : null;
  if (dcIdFromUrl) {
    const dataCenter = state.dataCenters.find((dc) => dc.id === parseInt(dcIdFromUrl));

    if (
      dataCenter &&
      (!state.selectedDataCenter || state.selectedDataCenter.id !== dataCenter.id)
    ) {
      dispatch({ type: ActionTypes.URL_UPDATE_DATACENTER, payload: dataCenter });
    }
  }
};

// Handle admin page component changes
export const handleAdminPageChange = (component, dispatch) => {
  dispatch({ type: ActionTypes.SET_ACTIVE_COMPONENT, payload: component });
};

// Role Management API Functions

// Fetch all roles
export const fetchRoles = async (dispatch) => {
  dispatch({ type: ActionTypes.FETCH_ROLES_START });
  try {
    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/roles`
    );
    const data = await res.json();
    dispatch({ type: ActionTypes.FETCH_ROLES_SUCCESS, payload: data });
    return data;
  } catch (error) {
    logger.error('Error fetching roles:', error);
    dispatch({ type: ActionTypes.FETCH_ROLES_FAILURE, payload: error.message });
    return [];
  }
};

// Fetch all permissions
export const fetchPermissions = async (dispatch) => {
  try {
    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/permissions`
    );
    const data = await res.json();
    dispatch({ type: ActionTypes.FETCH_PERMISSIONS_SUCCESS, payload: data });
    return data;
  } catch (error) {
    logger.error('Error fetching permissions:', error);
    dispatch({ type: ActionTypes.FETCH_PERMISSIONS_FAILURE, payload: error.message });
    return [];
  }
};

// Update role form state
export const setRoleForm = (formData, dispatch) => {
  dispatch({ type: ActionTypes.SET_ROLE_FORM, payload: formData });
};

// Reset role form
export const resetRoleForm = (dispatch) => {
  dispatch({ type: ActionTypes.RESET_ROLE_FORM });
};

// Set which role is being edited
export const setEditingRoleId = (id, dispatch) => {
  dispatch({ type: ActionTypes.SET_EDITING_ROLE_ID, payload: id });
};

// Handle permission toggle in the form
export const handlePermissionChange = (permId, permName, roleForm, dispatch) => {
  const exists = roleForm.Permissions.find((p) => p.id === permId);
  let updatedPermissions;
  if (exists) {
    updatedPermissions = roleForm.Permissions.filter((p) => p.id !== permId);
  } else {
    updatedPermissions = [...roleForm.Permissions, { id: permId, name: permName }];
  }
  const updatedForm = { ...roleForm, Permissions: updatedPermissions };
  dispatch({ type: ActionTypes.SET_ROLE_FORM, payload: updatedForm });
};

// Create or update a role
export const submitRole = async (roleForm, editingRoleId, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_ROLES_START });
  try {
    const url = editingRoleId
      ? `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/role/${editingRoleId}`
      : `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/role`;
    const method = editingRoleId ? 'PUT' : 'POST';
    const res = await api.fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: roleForm.name,
        role: roleForm.role,
        description: roleForm.description,
        Permissions: roleForm.Permissions.map((p) => ({ id: p.id, name: p.name })),
      }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Failed to save role');
    }
    // Refresh roles after create/update
    await fetchRoles(dispatch);
    dispatch({ type: ActionTypes.RESET_ROLE_FORM });
    return { success: true };
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_ROLES_FAILURE, payload: error.message });
    return { success: false, error: error.message };
  }
};

// User Management API Functions

// Fetch all users
export const fetchUsers = async (dispatch) => {
  dispatch({ type: ActionTypes.FETCH_USERS_START });
  try {
    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/users`
    );
    const data = await res.json();
    dispatch({ type: ActionTypes.FETCH_USERS_SUCCESS, payload: data });
    return data;
  } catch (error) {
    logger.error('Error fetching users:', error);
    dispatch({ type: ActionTypes.FETCH_USERS_FAILURE, payload: error.message });
    return [];
  }
};

// Register a new user
export const registerUser = async (formData, dispatch) => {
  try {
    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      }
    );
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Error registering user');
    }
    dispatch({ type: ActionTypes.RESET_REGISTER_USER_FORM });
    return await fetchUsers(dispatch);
  } catch (error) {
    logger.error('Error registering user:', error);
    dispatch({ type: ActionTypes.SET_USER_FORM_ERROR, payload: error.message });
    return null;
  }
};

// Delete a user
export const deleteUser = async (username, dispatch) => {
  try {
    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/${username}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Error deleting user');
    }
    return await fetchUsers(dispatch);
  } catch (error) {
    logger.error('Error deleting user:', error);
    return null;
  }
};

// Toggle user active status
export const toggleUserStatus = async (username, isActive, dispatch) => {
  try {
    // Get current user data to preserve approvers and requires_approval
    const currentUserRes = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/users`
    );
    if (!currentUserRes.ok) {
      throw new Error('Failed to fetch current user data');
    }

    const users = await currentUserRes.json();
    const currentUser = users.find((user) => user.username === username);

    if (!currentUser) {
      throw new Error('User not found');
    }

    // For deactivation: approvers should be empty, requires_approval should be true
    // For activation: preserve current approvers and requires_approval
    const payload = {
      approvers: JSON.stringify(isActive ? currentUser.approvers || [] : []),
      requires_approval: isActive ? currentUser.requires_approval || false : true,
      is_active: isActive,
      user_id: currentUser.user_id || currentUser.id,
    };

    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/${username}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Error updating user status');
    }
    return await fetchUsers(dispatch);
  } catch (error) {
    logger.error('Error updating user status:', error);
    return null;
  }
};

// Update user roles
export const updateUserRoles = async (username, roleIds, dispatch) => {
  try {
    // Convert role IDs to integers to ensure API compatibility
    const integerRoleIds = roleIds.map((id) => parseInt(id, 10));

    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/${username}/roles`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_ids: integerRoleIds }),
      }
    );
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Error updating user roles');
    }
    return await fetchUsers(dispatch);
  } catch (error) {
    logger.error('Error updating user roles:', error);
    return null;
  }
};

// Delete a role
export const deleteRole = async (roleId, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_ROLES_START });
  try {
    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/role/${roleId}`,
      {
        method: 'DELETE',
      }
    );
    if (!res.ok) throw new Error('Failed to delete role');
    return await fetchRoles(dispatch);
  } catch (error) {
    logger.error('Error deleting role:', error);
    dispatch({ type: ActionTypes.FETCH_ROLES_FAILURE, payload: error.message });
    return null;
  }
};

// Select a role for editing
export const editRole = (role, dispatch) => {
  // Set the editing ID
  dispatch({ type: ActionTypes.SET_EDITING_ROLE_ID, payload: role.id });

  // Populate the form
  const formData = {
    name: role.name,
    role: role.role,
    description: role.description,
    Permissions: role.permissions.map((p) => ({ id: p.id, name: p.name })),
  };

  dispatch({ type: ActionTypes.SET_ROLE_FORM, payload: formData });
};

/**
 * Authentication API Functions
 */
// Login user
//SM
export const loginUser = async (credentials, dispatch) => {
  dispatch({ type: ActionTypes.LOGIN_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for the HTTP-only refresh token
        body: JSON.stringify(credentials),
      }
    );

    const data = await response.json();

    if (response.ok) {
      // Check if 2FA is required
      if (data.requires_2fa === true) {
        // 2FA is required - store access_token for the 2FA flow but don't complete login yet
        localStorage.setItem('accessToken', data.access_token);

        dispatch({ type: ActionTypes.LOGIN_SUCCESS });
        return {
          success: true,
          requires_2fa: true,
          data,
        };
      } else if (data.requires_2fa === false && data.jwt_token) {
        // 2FA not required - proceed with login using jwt_token and refresh_token
        localStorage.setItem('accessToken', data.jwt_token);

        // Store refresh token if available
        if (data.refresh_token) {
          localStorage.setItem('refreshToken', data.refresh_token);
        }

        dispatch({ type: ActionTypes.LOGIN_SUCCESS });
        return {
          success: true,
          requires_2fa: false,
          data,
        };
      } else {
        // Missing required tokens
        const errorMessage = data.error || 'Missing authentication tokens';
        dispatch({ type: ActionTypes.LOGIN_FAILURE, payload: errorMessage });
        return { success: false, message: errorMessage };
      }
    } else {
      const errorMessage = data.error || 'Invalid credentials';
      dispatch({ type: ActionTypes.LOGIN_FAILURE, payload: errorMessage });
      return { success: false, message: errorMessage };
    }
  } catch (error) {
    const errorMessage = 'An error occurred during login';
    dispatch({ type: ActionTypes.LOGIN_FAILURE, payload: errorMessage });
    return { success: false, message: errorMessage };
  }
};

//SM
// Signup user
export const signupUser = async (formData, dispatch) => {
  dispatch({ type: ActionTypes.SIGNUP_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
        }),
      }
    );

    if (response.ok) {
      dispatch({ type: ActionTypes.SIGNUP_SUCCESS });
      return { success: true };
    } else {
      const data = await response.json();
      const errors: { email?: string; username?: string; submit?: string } = {};

      if (data.error === 'Email already exists') {
        errors.email = 'Email already exists';
      } else if (data.error === 'Username already exists') {
        errors.username = 'Username already exists';
      } else {
        errors.submit = data.error || 'Registration failed';
      }

      dispatch({ type: ActionTypes.SET_SIGNUP_ERRORS, payload: errors });
      return { success: false, errors };
    }
  } catch (error) {
    const errors = { submit: 'Registration failed' };
    dispatch({ type: ActionTypes.SET_SIGNUP_ERRORS, payload: errors });
    return { success: false, errors };
  }
};

// Fetch Grafana datasource UID for a server (metrics)
export const fetchMetricsUid = async (serverIp, dispatch) => {
  if (!serverIp) return;
  dispatch({ type: ActionTypes.FETCH_METRICS_UID_START });
  try {
    await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/add-datasource`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: serverIp }),
      }
    );
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/datasources`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    const matchedSource = data.find((source) => source.url.includes(`${serverIp}:9090`));
    if (matchedSource) {
      dispatch({ type: ActionTypes.FETCH_METRICS_UID_SUCCESS, payload: matchedSource.uid });
      return matchedSource.uid;
    } else {
      dispatch({
        type: ActionTypes.FETCH_METRICS_UID_FAILURE,
        payload: 'No matching datasource found',
      });
      return null;
    }
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_METRICS_UID_FAILURE, payload: error.message });
    return null;
  }
};

export const setMetricsViewingPanel = (panelId, dispatch) => {
  dispatch({ type: ActionTypes.SET_METRICS_VIEWING_PANEL, payload: panelId });
};

// Handle OS Installation and ISO Management
export const startOsInstallation = async (serverIp, vmName, iso, dispatch) => {
  dispatch({ type: ActionTypes.SET_INSTALLING_STATE, payload: true });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}/os_install`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_cloud_image: true, iso }),
      }
    );
    if (!response.ok) throw new Error(`Failed to start OS installation: ${response.statusText}`);
    dispatch({
      type: ActionTypes.SET_OS_INSTALL_MESSAGE,
      payload: `OS installation started for ${vmName}.`,
    });
    return response;
  } catch (error) {
    dispatch({ type: ActionTypes.SET_OS_INSTALL_MESSAGE, payload: error.message });
    throw error;
  } finally {
    dispatch({ type: ActionTypes.SET_INSTALLING_STATE, payload: false });
  }
};

// VM Start on Boot Configuration
export const configureVmStartOnBoot = async (serverIp, vmName, enable = true, dispatch) => {
  dispatch({ type: ActionTypes.VM_START_ON_BOOT_START });
  try {
    if (enable) {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/start_on_hostboot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vm_name: vmName }),
        }
      );
      if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
      dispatch({
        type: ActionTypes.VM_START_ON_BOOT_SUCCESS,
        payload: { message: `VM ${vmName} will now start on host restart.` },
      });
    } else {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/remove_from_hostboot/${vmName}`,
        {
          method: 'DELETE',
        }
      );
      if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
      dispatch({
        type: ActionTypes.VM_START_ON_BOOT_SUCCESS,
        payload: { message: `VM ${vmName} will no longer start on host restart.` },
      });
    }
    return true;
  } catch (error) {
    dispatch({ type: ActionTypes.VM_START_ON_BOOT_FAILURE, payload: error.message });
    return false;
  }
};

// For mounting ISO in installation mode
export const mountIsoForInstallation = async (serverIp, vmName, iso, dispatch, datastore) => {
  dispatch({ type: ActionTypes.MOUNT_ISO_INSTALL_START });
  try {
    // First, check VM state
    const statusRes = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}`
    );
    const vmData = await statusRes.json();
    if (vmData.state && vmData.state.includes('running')) {
      throw new Error(
        'VM appears to be running. Please stop the VM before mounting ISO in installation mode.'
      );
    }

    // Mount the ISO for installation with datastore query parameter
    const datastoreParam = datastore ? `?datastore=${encodeURIComponent(datastore)}` : '';
    const mountRes = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}/os_install${datastoreParam}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_cloud_image: true, iso }),
      }
    );
    if (!mountRes.ok) throw new Error('Mount for OS installation failed.');

    dispatch({
      type: ActionTypes.MOUNT_ISO_INSTALL_SUCCESS,
      payload: { message: 'VM started in OS installation mode.' },
    });
    return true;
  } catch (error) {
    dispatch({ type: ActionTypes.MOUNT_ISO_INSTALL_FAILURE, payload: error.message });
    throw error;
  }
};

// Configure VM to start on host boot
export const configureStartOnBoot = async (serverIp, vmName, enable) => {
  // eslint-disable-next-line no-useless-catch
  try {
    if (enable) {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/start_on_hostboot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vm_name: vmName }),
        }
      );
      if (!response.ok) throw new Error(`Failed to enable start on boot: ${response.statusText}`);
      return response;
    } else {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/remove_from_hostboot/${vmName}`,
        {
          method: 'DELETE',
        }
      );
      if (!response.ok) throw new Error(`Failed to disable start on boot: ${response.statusText}`);
      return response;
    }
  } catch (error) {
    throw error;
  }
};

// Activity Logs Management

// Fetch activity logs with optional filters
export const fetchActivityLogs = async (
  serverIp: string,
  filters: { vmName?: string; username?: string } = {},
  dispatch: (action: { type: string }) => void
) => {
  dispatch({ type: ActionTypes.FETCH_ACTIVITY_LOGS_START });
  // eslint-disable-next-line no-useless-catch
  try {
    const params = new URLSearchParams();
    if (filters.vmName) params.append('vm_name', filters.vmName);
    if (filters.username) params.append('username', filters.username);

    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/activity/logs?${params.toString()}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch activity logs');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

// =====================
// Network Management
// =====================
export const fetchNetworkInterfaces = async (serverIp, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_NETWORK_INTERFACES_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/interfaces`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      }
    );
    if (!response.ok) throw new Error('Failed to fetch interfaces');
    const rawData = await response.json();
    const data = rawData.map((item, index) =>
      typeof item === 'string' ? { id: index, name: item } : item
    );
    dispatch({ type: ActionTypes.FETCH_NETWORK_INTERFACES_SUCCESS, payload: data });
    return data;
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_NETWORK_INTERFACES_FAILURE, payload: error.message });
    return null;
  }
};

export const fetchSwitches = async (serverIp, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_SWITCHES_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      }
    );
    if (!response.ok) throw new Error('Failed to fetch switches');
    const data = await response.json();
    dispatch({ type: ActionTypes.FETCH_SWITCHES_SUCCESS, payload: data });
    return data;
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_SWITCHES_FAILURE, payload: error.message });
    return null;
  }
};

export const createSwitch = async (serverIp, switchName, selectedInterface, switches, dispatch) => {
  dispatch({ type: ActionTypes.CREATE_SWITCH_START });
  try {
    // Validation: Prevent creating a switch with an existing name
    const isDuplicate = switches.some(
      (sw) => sw.name.trim().toLowerCase() === switchName.trim().toLowerCase()
    );
    if (isDuplicate) {
      dispatch({
        type: ActionTypes.CREATE_SWITCH_FAILURE,
        payload: `A switch named "${switchName}" already exists.`,
      });
      return { error: `A switch named "${switchName}" already exists.` };
    }
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ name: switchName, interface: selectedInterface }),
      }
    );
    const contentType = response.headers.get('content-type');
    if (response.ok && contentType && contentType.includes('application/json')) {
      dispatch({ type: ActionTypes.CREATE_SWITCH_SUCCESS });
      return { success: true };
    } else if (response.status == 409) {
      // Handle 409 conflict - extract specific error message from response
      try {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'A switch already exists for this interface.';
        dispatch({ type: ActionTypes.CREATE_SWITCH_FAILURE, payload: errorMessage });
        return { error: errorMessage };
      } catch (parseError) {
        const fallbackMessage = 'A switch already exists for this interface.';
        dispatch({ type: ActionTypes.CREATE_SWITCH_FAILURE, payload: fallbackMessage });
        return { error: fallbackMessage };
      }
    } else if (response.status === 400) {
      const errorData = await response.json();
      dispatch({
        type: ActionTypes.CREATE_SWITCH_FAILURE,
        payload: errorData.status || 'Invalid input.',
      });
      return { error: errorData.status || 'Invalid input.' };
    } else {
      dispatch({ type: ActionTypes.CREATE_SWITCH_FAILURE, payload: 'Failed to create switch.' });
      return { error: 'Failed to create switch.' };
    }
  } catch (error) {
    dispatch({ type: ActionTypes.CREATE_SWITCH_FAILURE, payload: error.message });
    return { error: error.message };
  }
};

export const deleteSwitch = async (serverIp, switchName, dispatch, approver) => {
  dispatch({ type: ActionTypes.DELETE_SWITCH_START });
  try {
    let url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch/${switchName}`;

    // Add approver query param if provided
    if (approver) {
      url += `?approver=${encodeURIComponent(approver)}`;
    }

    const response = await api.fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });
    if (response.ok) {
      dispatch({ type: ActionTypes.DELETE_SWITCH_SUCCESS });
      return { success: true };
    } else {
      dispatch({ type: ActionTypes.DELETE_SWITCH_FAILURE, payload: 'Failed to delete switch.' });
      return { error: 'Failed to delete switch.' };
    }
  } catch (error) {
    dispatch({ type: ActionTypes.DELETE_SWITCH_FAILURE, payload: error.message });
    return { error: error.message };
  }
};

export const setNetworkDropdown = (value, dispatch) => {
  dispatch({ type: ActionTypes.SET_NETWORK_DROPDOWN, payload: value });
};
export const setShowCreateSwitchForm = (value, dispatch) => {
  dispatch({ type: ActionTypes.SET_SHOW_CREATE_SWITCH_FORM, payload: value });
};
export const setSwitchName = (value, dispatch) => {
  dispatch({ type: ActionTypes.SET_SWITCH_NAME, payload: value });
};
export const setSelectedInterface = (value, dispatch) => {
  dispatch({ type: ActionTypes.SET_SELECTED_INTERFACE, payload: value });
};

// =====================
// Firewall Management
// =====================
export const fetchFirewallRules = async (serverIp, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_FIREWALL_RULES_START, payload: { serverIp } });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/pf/rules`
    );
    if (!response.ok) throw new Error('Failed to fetch rules');
    const data = await response.text();
    dispatch({
      type: ActionTypes.FETCH_FIREWALL_RULES_SUCCESS,
      payload: { serverIp, rules: data },
    });
    return data;
  } catch (err) {
    dispatch({
      type: ActionTypes.FETCH_FIREWALL_RULES_FAILURE,
      payload: { serverIp, error: err.message },
    });
    return null;
  }
};

export const updateFirewallRules = async (
  serverIp,
  rules,
  dispatch,
  approver,
  isSimpleMode = false
) => {
  dispatch({ type: ActionTypes.UPDATE_FIREWALL_RULES_START, payload: { serverIp } });
  try {
    let url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/pf/update`;

    // Add approver query param if provided
    if (approver) {
      url += `?approver=${encodeURIComponent(approver)}`;
    }

    const response = await api.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify({ file_content: rules }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      dispatch({
        type: ActionTypes.UPDATE_FIREWALL_RULES_FAILURE,
        payload: { serverIp, error: errorData.error || 'Failed to update rules' },
      });
      return { error: errorData.error || 'Failed to update rules' };
    }
    const data = await response.json();

    // Check if the response contains the specific message indicating feature not supported
    // Only show "Feature not supported" for simple mode calls
    if (
      isSimpleMode &&
      data.message &&
      data.message.includes('pf.conf updated and reloaded successfully')
    ) {
      dispatch({
        type: ActionTypes.UPDATE_FIREWALL_RULES_FAILURE,
        payload: {
          serverIp,
          error: 'Cannot Update.Please use the advanced mode for this configuration',
        },
      });
      return { error: 'Cannot Update.Please use the advanced mode for this configuration' };
    }

    dispatch({
      type: ActionTypes.UPDATE_FIREWALL_RULES_SUCCESS,
      payload: { serverIp, id: data.id, rules },
    });
    return { id: data.id };
  } catch (err) {
    dispatch({
      type: ActionTypes.UPDATE_FIREWALL_RULES_FAILURE,
      payload: { serverIp, error: err.message },
    });
    return { error: err.message };
  }
};

export const cancelFirewallRevert = async (serverIp, id, dispatch) => {
  dispatch({ type: ActionTypes.CANCEL_FIREWALL_REVERT_START, payload: { serverIp } });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/pf/revert/${id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      }
    );
    if (response.status === 200) {
      dispatch({ type: ActionTypes.CANCEL_FIREWALL_REVERT_SUCCESS, payload: { serverIp } });
      return { success: true };
    } else {
      dispatch({
        type: ActionTypes.CANCEL_FIREWALL_REVERT_FAILURE,
        payload: { serverIp, error: 'Failed to confirm changes.' },
      });
      return { error: 'Failed to confirm changes.' };
    }
  } catch (err) {
    dispatch({
      type: ActionTypes.CANCEL_FIREWALL_REVERT_FAILURE,
      payload: { serverIp, error: err.message },
    });
    return { error: err.message };
  }
};

export const setFirewallNotification = (serverIp, notification, dispatch) => {
  dispatch({ type: ActionTypes.SET_FIREWALL_NOTIFICATION, payload: { serverIp, notification } });
};
export const setFirewallRevertCountdown = (serverIp, countdown, dispatch) => {
  dispatch({ type: ActionTypes.SET_FIREWALL_REVERT_COUNTDOWN, payload: { serverIp, countdown } });
};
export const setFirewallId = (serverIp, id, dispatch) => {
  dispatch({ type: ActionTypes.SET_FIREWALL_ID, payload: { serverIp, id } });
};

// =====================
// Firewall Simple Mode
// =====================
export const fetchPacketFilters = async (serverIp, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_PACKET_FILTERS_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/pf/simple/parse?file_path=/etc/pf.conf`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Suppress-Success-Toast': 'true',
        },
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    dispatch({ type: ActionTypes.FETCH_PACKET_FILTERS_SUCCESS, payload: data.payload });
    return data.payload;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch packet filters';
    dispatch({ type: ActionTypes.FETCH_PACKET_FILTERS_FAILURE, payload: errorMessage });
    throw error;
  }
};

export const generateFirewallRules = async (serverIp, payload, dispatch) => {
  dispatch({ type: ActionTypes.GENERATE_FIREWALL_RULES_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/pf/simple/generate/file`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Suppress-Success-Toast': 'true' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      let errorText = '';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errData = await response.json();
          errorText = errData?.error || errData?.message || JSON.stringify(errData);
        } else {
          errorText = await response.text();
        }
      } catch (e) {
        errorText = response.statusText || 'Unknown error';
      }
      throw new Error(errorText || `Request failed with status ${response.status}`);
    }

    const contentType = response.headers?.get ? response.headers.get('content-type') : null;
    let rulesText = '';
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      rulesText =
        typeof data?.payload === 'string'
          ? data.payload
          : data?.rules || data?.data || JSON.stringify(data, null, 2);
    } else {
      rulesText = await response.text();
    }

    dispatch({ type: ActionTypes.GENERATE_FIREWALL_RULES_SUCCESS, payload: rulesText });
    return rulesText;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate firewall rules';
    dispatch({ type: ActionTypes.GENERATE_FIREWALL_RULES_FAILURE, payload: errorMessage });
    throw error;
  }
};

// =====================
// System Logs
// =====================
export const fetchLogs = async (
  serverIp,
  level,
  contains,
  page = 1,
  limit = 10,
  order = 'desc',
  dispatch
) => {
  dispatch({ type: ActionTypes.FETCH_LOGS_START });
  try {
    // Updated API URL with pagination parameters
    let url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/logs`;
    const params: string[] = [];
    if (level) params.push(`level=${level}`);
    if (contains) params.push(`contains=${contains}`);
    // Add pagination parameters
    params.push(`page=${page}`);
    params.push(`limit=${limit}`);
    if (order) params.push(`order=${order}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const response = await api.fetch(url);
    if (!response.ok) throw new Error('Failed to fetch logs');
    const data = await response.json();

    // Handle paginated response format
    const logs = data.logs || [];
    const totalCount = data.total || logs.length;
    const totalPages = data.total_pages || Math.ceil(totalCount / limit);

    dispatch({
      type: ActionTypes.FETCH_LOGS_SUCCESS,
      payload: {
        logs: logs,
        totalCount: totalCount,
        totalPages: totalPages,
      },
    });

    return {
      logs: logs,
      totalCount: totalCount,
      totalPages: totalPages,
    };
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_LOGS_FAILURE, payload: error.message });
    return null;
  }
};

export const setLogsLevel = (level, dispatch) => {
  dispatch({ type: ActionTypes.SET_LOGS_LEVEL, payload: level });
};
export const setLogsContains = (contains, dispatch) => {
  dispatch({ type: ActionTypes.SET_LOGS_CONTAINS, payload: contains });
};

// =====================
// Storage / Disk Attach
// =====================
export const fetchStoragePools = async (serverIp, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_STORAGE_POOLS_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/pools`
    );
    const data = await response.json();

    // Store the data in both original format and transformed format for flexibility
    const transformedData = data.map((item) => ({
      name: item.NAME,
      freeSpace: item.FREE,
    }));

    dispatch({
      type: ActionTypes.FETCH_STORAGE_POOLS_SUCCESS,
      payload: {
        original: data,
        transformed: transformedData,
      },
    });
    return data;
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_STORAGE_POOLS_FAILURE, payload: error.message });
    return null;
  }
};

export const fetchDatastores = async (serverAddress, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_DATASTORES_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores `
    );
    if (response.ok) {
      const data = await response.json();
      // Handle both array format and new object format with datastores property
      const datastoresArray = Array.isArray(data) ? data : data.datastores || [];
      dispatch({ type: ActionTypes.FETCH_DATASTORES_SUCCESS, payload: datastoresArray });
      return datastoresArray;
    } else {
      dispatch({ type: ActionTypes.FETCH_DATASTORES_FAILURE, payload: response.statusText });
      return null;
    }
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_DATASTORES_FAILURE, payload: error.message });
    return null;
  }
};

export const fetchVmDatastores = async (serverAddress, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_DATASTORES_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores`
    );
    if (response.ok) {
      const data = await response.json();
      // Handle both array format and new object format with datastores property
      const datastoresArray = Array.isArray(data) ? data : data.datastores || [];
      dispatch({ type: ActionTypes.FETCH_DATASTORES_SUCCESS, payload: datastoresArray });
      return datastoresArray;
    } else {
      dispatch({ type: ActionTypes.FETCH_DATASTORES_FAILURE, payload: response.statusText });
      return null;
    }
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_DATASTORES_FAILURE, payload: error.message });
    return null;
  }
};

export const fetchZfsDatasets = async (serverIp, poolName, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_ZFS_DATASETS_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/list?pool=${poolName}`
    );
    if (response.ok) {
      const data = await response.json();
      dispatch({ type: ActionTypes.FETCH_ZFS_DATASETS_SUCCESS, payload: data });
      return data;
    } else {
      dispatch({ type: ActionTypes.FETCH_ZFS_DATASETS_FAILURE, payload: response.statusText });
      return null;
    }
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_ZFS_DATASETS_FAILURE, payload: error.message });
    return null;
  }
};

export const fetchVmDisks = async (serverIp, vmName, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_VM_DISKS_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}`
    );
    const data = await response.json();
    const disks = data['virtual-disk'] || [];
    dispatch({ type: ActionTypes.FETCH_VM_DISKS_SUCCESS, payload: disks });
    return disks;
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_VM_DISKS_FAILURE, payload: error.message });
    return null;
  }
};

export const attachDisk = async (serverIp, payload, dispatch) => {
  dispatch({ type: ActionTypes.ATTACH_DISK_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/vm/attach_disk`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      dispatch({
        type: ActionTypes.ATTACH_DISK_FAILURE,
        payload: errorData.message || 'Unknown error',
      });
      return { error: errorData.message || 'Unknown error' };
    }
    dispatch({ type: ActionTypes.ATTACH_DISK_SUCCESS });
    return { success: true };
  } catch (error) {
    dispatch({ type: ActionTypes.ATTACH_DISK_FAILURE, payload: error.message });
    return { error: error.message };
  }
};

// Detach a disk from a VM
export const detachDisk = async (serverIp, payload, dispatch) => {
  dispatch({ type: ActionTypes.DETACH_DISK_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/vm/detach_disk`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      dispatch({
        type: ActionTypes.DETACH_DISK_FAILURE,
        payload: errorData.message || 'Unknown error',
      });
      return { error: errorData.message || 'Unknown error' };
    }
    dispatch({ type: ActionTypes.DETACH_DISK_SUCCESS });
    return { success: true };
  } catch (error) {
    dispatch({ type: ActionTypes.DETACH_DISK_FAILURE, payload: error.message });
    return { error: error.message };
  }
};

// Reassign a disk from one VM to another
export const reassignDisk = async (
  serverIp,
  {
    datastore,
    disk_dev,
    disk_no,
    disk_type,
    target_datastore,
    target_disk_no,
    target_vmname,
    vmname,
    zvol_name,
    zvol_path,
  },
  dispatch
) => {
  dispatch({ type: ActionTypes.REASSIGN_DISK_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/vm/reassign_disk`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datastore,
          disk_dev,
          disk_no,
          disk_type,
          target_datastore,
          target_disk_no,
          target_vmname,
          vmname,
          zvol_name,
          zvol_path,
        }),
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      dispatch({
        type: ActionTypes.REASSIGN_DISK_FAILURE,
        payload: errorData.message || 'Failed to reassign disk.',
      });
      return { error: errorData.message || 'Failed to reassign disk.' };
    }
    dispatch({ type: ActionTypes.REASSIGN_DISK_SUCCESS });
    return { success: true };
  } catch (error) {
    dispatch({ type: ActionTypes.REASSIGN_DISK_FAILURE, payload: error.message });
    return { error: error.message };
  }
};

// ISO Management
export const fetchIsoList = async (serverIp, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_ISO_LIST_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/iso`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch ISO list: ${response.statusText}`);
    }
    const data = await response.json();
    const isoList = data.isos || [];
    dispatch({ type: ActionTypes.FETCH_ISO_LIST_SUCCESS, payload: isoList });
    return isoList;
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_ISO_LIST_FAILURE, payload: error.message });
    return { error: error.message };
  }
};

export const setIsoField = (field, value, dispatch) => {
  dispatch({ type: ActionTypes.SET_ISO_FIELD, payload: { field, value } });
};

export const setSelectedIso = (iso, dispatch) => {
  dispatch({ type: ActionTypes.SET_SELECTED_ISO, payload: iso });
};

// Helper functions for upload/download progress tracking
export const setUploadProgress = (progress, dispatch) => {
  dispatch({ type: ActionTypes.ISO_UPLOAD_PROGRESS, payload: { progress } });
};

export const setUploadMessage = (message, messageType, dispatch) => {
  dispatch({ type: ActionTypes.ISO_SET_UPLOAD_MESSAGE, payload: { message, messageType } });
};

export const clearUploadState = (dispatch) => {
  dispatch({ type: ActionTypes.ISO_CLEAR_UPLOAD_STATE });
};

export const setDownloadProgress = (progress, dispatch) => {
  dispatch({ type: ActionTypes.ISO_DOWNLOAD_PROGRESS, payload: { progress } });
};

export const setDownloadMessage = (message, messageType, dispatch) => {
  dispatch({ type: ActionTypes.ISO_SET_DOWNLOAD_MESSAGE, payload: { message, messageType } });
};

export const clearDownloadState = (dispatch) => {
  dispatch({ type: ActionTypes.ISO_CLEAR_DOWNLOAD_STATE });
};

// Datacenter ISO Helper Functions
export const setDcIsoUploadProgress = (progress, dispatch) => {
  dispatch({ type: ActionTypes.DC_ISO_UPLOAD_PROGRESS, payload: { progress } });
};

export const setDcIsoUploadMessage = (message, messageType, dispatch) => {
  dispatch({ type: ActionTypes.DC_ISO_SET_UPLOAD_MESSAGE, payload: { message, messageType } });
};

export const clearDcIsoUploadState = (dispatch) => {
  dispatch({ type: ActionTypes.DC_ISO_CLEAR_UPLOAD_STATE });
};

export const setDcIsoDownloadProgress = (progress, dispatch) => {
  dispatch({ type: ActionTypes.DC_ISO_DOWNLOAD_PROGRESS, payload: { progress } });
};

export const setDcIsoDownloadMessage = (message, messageType, dispatch) => {
  dispatch({ type: ActionTypes.DC_ISO_SET_DOWNLOAD_MESSAGE, payload: { message, messageType } });
};

export const clearDcIsoDownloadState = (dispatch) => {
  dispatch({ type: ActionTypes.DC_ISO_CLEAR_DOWNLOAD_STATE });
};

export const fetchDcIsoListShared = async (dispatch) => {
  try {
    dispatch({ type: ActionTypes.DC_ISO_FETCH_LIST_START });
    // Import the actual fetchDcIsoList function from dcIsoApiService
    const { fetchDcIsoList } = await import('./dcIsoApiService');
    const response = await fetchDcIsoList(dispatch);
    dispatch({ type: ActionTypes.DC_ISO_FETCH_LIST_SUCCESS, payload: response });
    return response;
  } catch (error) {
    logger.error('Error fetching datacenter ISO list:', error);
    dispatch({ type: ActionTypes.DC_ISO_FETCH_LIST_FAILURE, payload: error.message });
    return { error: error.message };
  }
};

export const fetchDcCloudImagesListShared = async (dispatch) => {
  try {
    dispatch({ type: ActionTypes.DC_ISO_FETCH_CLOUD_IMAGES_START });
    // Import the actual fetchDcCloudImages function from dcIsoApiService
    const { fetchDcCloudImages } = await import('./dcIsoApiService');
    const response = await fetchDcCloudImages(dispatch);
    dispatch({ type: ActionTypes.DC_ISO_FETCH_CLOUD_IMAGES_SUCCESS, payload: response });
    return response;
  } catch (error) {
    logger.error('Error fetching datacenter cloud images:', error);
    dispatch({ type: ActionTypes.DC_ISO_FETCH_CLOUD_IMAGES_FAILURE, payload: error.message });
    return { error: error.message };
  }
};

// Set the current datacenter view (console, control-center, etc.)
export const setDataCenterView = (view, dispatch) => {
  dispatch({ type: ActionTypes.SET_DATACENTER_VIEW, payload: view });
};

// Set the current server view (home, iso, storage, etc.)
export const setServerView = (view, dispatch) => {
  dispatch({ type: ActionTypes.SET_SERVER_VIEW, payload: view });
};

// Set disk form field
export const setDiskFormField = (field, value, dispatch) => {
  dispatch({ type: ActionTypes.SET_DISK_FORM_FIELD, payload: { field, value } });
};

// Delete a ZFS dataset (unused disk)
export const deleteDataset = async (datasetName, dispatch, serverIp, approver?: string) => {
  dispatch({ type: ActionTypes.DELETE_DATASET_START });
  try {
    const zpoolName = datasetName.split('/')[0];
    const requestBody = { dataset_name: datasetName, pool_name: zpoolName };

    let url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/destroy_dataset`;
    if (approver) {
      url += `?approver=${encodeURIComponent(approver)}`;
    }

    const response = await api.fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (response.ok) {
      dispatch({ type: ActionTypes.DELETE_DATASET_SUCCESS, payload: datasetName });
      return { success: true };
    } else {
      const errorData = await response.json();
      dispatch({
        type: ActionTypes.DELETE_DATASET_FAILURE,
        payload: errorData.message || 'Failed to delete disk.',
      });
      return { success: false, error: errorData.message };
    }
  } catch (error) {
    dispatch({ type: ActionTypes.DELETE_DATASET_FAILURE, payload: error.message });
    return { success: false, error: error.message };
  }
};

// Snapshot Management Functions
export const fetchSnapshots = async (serverIp, vmName, dispatch) => {
  try {
    dispatch({ type: ActionTypes.FETCH_SNAPSHOTS_START });
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}`
    );

    if (!response.ok) throw new Error('Failed to fetch snapshots');

    const data = await response.json();
    if (data.snapshots) {
      // Store snapshots both globally (for backward compatibility) and VM-specifically
      dispatch({
        type: ActionTypes.FETCH_SNAPSHOTS_SUCCESS,
        payload: data.snapshots,
      });

      // Store VM-specific snapshots
      const vmKey = `${serverIp}:${vmName}`;
      dispatch({
        type: ActionTypes.FETCH_VM_SNAPSHOTS_SUCCESS,
        payload: {
          vmKey,
          snapshots: data.snapshots,
        },
      });
    } else {
      // Handle case where snapshots is falsy - set empty array
      dispatch({
        type: ActionTypes.FETCH_SNAPSHOTS_SUCCESS,
        payload: [],
      });

      // Store empty VM-specific snapshots
      const vmKey = `${serverIp}:${vmName}`;
      dispatch({
        type: ActionTypes.FETCH_VM_SNAPSHOTS_SUCCESS,
        payload: {
          vmKey,
          snapshots: [],
        },
      });
    }

    return data.snapshots;
  } catch (error) {
    dispatch({
      type: ActionTypes.FETCH_SNAPSHOTS_FAILURE,
      payload: error.message,
    });
    throw error;
  }
};

export const createSnapshot = async (serverIp, vmName, snapshotName, dispatch) => {
  try {
    dispatch({ type: ActionTypes.CREATE_SNAPSHOT_START });

    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}/snapshot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot_name: snapshotName, force: true }),
      }
    );

    if (!response.ok) throw new Error('Failed to create snapshot');

    dispatch({
      type: ActionTypes.CREATE_SNAPSHOT_SUCCESS,
      payload: snapshotName,
    });

    dispatch({
      type: ActionTypes.SET_SNAPSHOT_MESSAGE,
      payload: `Snapshot "${snapshotName}" created successfully.`,
    });

    return true;
  } catch (error) {
    dispatch({
      type: ActionTypes.CREATE_SNAPSHOT_FAILURE,
      payload: error.message,
    });
    dispatch({
      type: ActionTypes.SET_SNAPSHOT_MESSAGE,
      payload: 'Error creating snapshot.',
    });
    throw error;
  }
};

export const rollbackSnapshot = async (serverIp, vmName, snapshotName, dispatch) => {
  try {
    dispatch({ type: ActionTypes.ROLLBACK_SNAPSHOT_START });

    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}/rollback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot_name: snapshotName }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData?.error || 'Failed to rollback snapshot');
    }

    dispatch({
      type: ActionTypes.ROLLBACK_SNAPSHOT_SUCCESS,
      payload: snapshotName,
    });

    dispatch({
      type: ActionTypes.SET_SNAPSHOT_MESSAGE,
      payload: `Successfully rolled back to snapshot "${snapshotName}".`,
    });

    return true;
  } catch (error) {
    dispatch({
      type: ActionTypes.ROLLBACK_SNAPSHOT_FAILURE,
      payload: error.message,
    });
    dispatch({
      type: ActionTypes.SET_SNAPSHOT_MESSAGE,
      payload: 'Error rolling back snapshot.',
    });
    throw error;
  }
};

export const downloadIso = async (serverIp, isoUrl, dispatch) => {
  try {
    // Start download
    dispatch({ type: ActionTypes.ISO_DOWNLOAD_START });

    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/iso/download`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ iso_url: isoUrl }),
      }
    );

    if (!response.ok) {
      // First, try to get response as text
      const responseText = await response.text();

      // Try to parse as JSON
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          throw new Error(errorData.error);
        } else if (errorData.message) {
          throw new Error(errorData.message);
        } else if (typeof errorData === 'string') {
          throw new Error(errorData);
        }
      } catch {
        // If not valid JSON or no error/message property, use the raw response text
        if (responseText && responseText.trim() !== '') {
          throw new Error(responseText);
        }
        // Fallback to status text only if we have no other information
        throw new Error(response.statusText || 'Unknown error occurred');
      }
    }

    // Download successful
    dispatch({ type: ActionTypes.ISO_DOWNLOAD_SUCCESS });
    await fetchIsoList(serverIp, dispatch);
    return true;
  } catch (error) {
    logger.error('Error downloading ISO:', error);
    dispatch({ type: ActionTypes.ISO_DOWNLOAD_FAILURE, payload: error.message });
    // Re-throw the error so the UI can catch and display it
    throw error;
  }
};

export const uploadIso = async (serverIp, file, dispatch, isoType = 'local') => {
  try {
    // Start upload
    dispatch({ type: ActionTypes.ISO_UPLOAD_START });
    setUploadMessage('Uploading file...', 'info', dispatch);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', isoType);

    // Get authentication token from local storage
    const authToken = localStorage.getItem('accessToken');

    if (!authToken) {
      logger.error('Authentication token is missing');
      throw new Error('Authentication token is missing. Please log in again.');
    }

    const response = await fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/iso/upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
        // Note: We can't track progress with the current approach using fetch
        // The progress tracking will be handled in the component using axios
      }
    );

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }

      // First, try to get response as text
      const responseText = await response.text();

      // Try to parse as JSON
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload ISO');
      } catch (jsonError) {
        throw new Error(`Failed to upload ISO: ${response.statusText}`);
      }
    }

    // Upload successful
    dispatch({ type: ActionTypes.ISO_UPLOAD_SUCCESS });
    setUploadMessage(
      isoType === 'local' ? 'ISO uploaded successfully!' : 'RAW file uploaded successfully!',
      'success',
      dispatch
    );

    // Refresh both ISO list and cloud images based on the type uploaded
    await fetchIsoList(serverIp, dispatch);
    if (isoType === 'cloud-init') {
      // Also fetch cloud images if this was a cloud image upload
      await fetchCloudImages(serverIp, dispatch);
    }
    return true;
  } catch (error) {
    logger.error('Error uploading ISO:', error);
    dispatch({ type: ActionTypes.ISO_UPLOAD_FAILURE, payload: error.message });
    setUploadMessage(error.message, 'error', dispatch);
    // Re-throw the error so the UI can catch and display it
    throw error;
  }
};

export const deleteIso = async (serverIp, isoName, dispatch, isCloudImage = false) => {
  try {
    const payload = {
      iso: isoName,
      is_cloud_image: isCloudImage,
    };

    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/iso/delete`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      // First, try to get response as text
      const responseText = await response.text();

      // Try to parse as JSON
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          throw new Error(errorData.error);
        } else if (errorData.message) {
          throw new Error(errorData.message);
        } else if (typeof errorData === 'string') {
          throw new Error(errorData);
        }
      } catch {
        // If not valid JSON or no error/message property, use the raw response text
        if (responseText && responseText.trim() !== '') {
          throw new Error(responseText);
        }
        // Fallback to status text only if we have no other information
        throw new Error(response.statusText || 'Unknown error occurred');
      }
    }
    await fetchIsoList(serverIp, dispatch);
    return true;
  } catch (error) {
    logger.error('Error deleting ISO:', error);
    // Re-throw the error so the UI can catch and display it
    throw error;
  }
};

// New function to take ZFS snapshot
export const takeZfsSnapshot = async (serverIp, datasetName, snapshotName, dispatch) => {
  try {
    dispatch({ type: ActionTypes.CREATE_ZFS_SNAPSHOT_START });

    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/take_snapshot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Dataset: datasetName,
          snapshot_name: snapshotName,
        }),
      }
    );

    if (!response.ok) throw new Error('Failed to create ZFS snapshot');

    dispatch({
      type: ActionTypes.CREATE_ZFS_SNAPSHOT_SUCCESS,
      payload: snapshotName,
    });

    return true;
  } catch (error) {
    dispatch({
      type: ActionTypes.CREATE_ZFS_SNAPSHOT_FAILURE,
      payload: error.message,
    });
    throw error;
  }
};

// Extend ActionTypes properly
export const ActionTypes = {
  ...BaseActionTypes,
  VM_START_ON_BOOT_START: 'VM_START_ON_BOOT_START',
  VM_START_ON_BOOT_SUCCESS: 'VM_START_ON_BOOT_SUCCESS',
  VM_START_ON_BOOT_FAILURE: 'VM_START_ON_BOOT_FAILURE',
  MOUNT_ISO_INSTALL_START: 'MOUNT_ISO_INSTALL_START',
  MOUNT_ISO_INSTALL_SUCCESS: 'MOUNT_ISO_INSTALL_SUCCESS',
  MOUNT_ISO_INSTALL_FAILURE: 'MOUNT_ISO_INSTALL_FAILURE',
  FETCH_CLOUD_IMAGES_START: 'FETCH_CLOUD_IMAGES_START',
  FETCH_CLOUD_IMAGES_SUCCESS: 'FETCH_CLOUD_IMAGES_SUCCESS',
  FETCH_CLOUD_IMAGES_FAILURE: 'FETCH_CLOUD_IMAGES_FAILURE',
};

/**
 * Fetches the list of available cloud images from the server
 * @param serverIp - The IP address of the server
 * @param dispatch - The dispatch function from Redux
 * @returns {Promise<Array>} - A promise that resolves to an array of cloud images
 */
export const fetchCloudImagesList = async (serverIp, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_CLOUD_IMAGES_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/cloudimages`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch cloud images list: ${response.statusText}`);
    }
    const data = await response.json();
    // Extract the cloud images from the response based on the API structure
    // Note: You may need to adjust this based on the actual response structure
    const cloudImagesList = data.cloudimages || [];
    dispatch({ type: ActionTypes.FETCH_CLOUD_IMAGES_SUCCESS, payload: cloudImagesList });
    return cloudImagesList;
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_CLOUD_IMAGES_FAILURE, payload: error.message });
    return { error: error.message };
  }
};

// Fetch cloud images for a server
export const fetchCloudImages = async (serverIp, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_CLOUD_IMAGES_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/cloudimages`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch cloud images: ${response.statusText}`);
    }
    const data = await response.json();
    // The API returns { ra${envConfig().WS_PROTOCOL}: ["image1.raw", "image2.raw"] }
    const cloudImages = data.raws || [];

    // Handle the response format properly
    dispatch({ type: ActionTypes.FETCH_CLOUD_IMAGES_SUCCESS, payload: cloudImages });
    return cloudImages;
  } catch (error) {
    logger.error('Error fetching cloud images:', error);
    dispatch({ type: ActionTypes.FETCH_CLOUD_IMAGES_FAILURE, payload: error.message });
    return { error: error.message };
  }
};

// =====================
// Events / Notifications Management
// =====================

/**
 * Fetch events/notifications from the API
 * @param params - Query parameters for filtering and pagination
 * @param dispatch - The dispatch function from Redux
 * @returns {Promise<Object>} - A promise that resolves to events data with pagination info
 */
export const fetchEvents = async (params: any = {}, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_EVENTS_START });
  try {
    // Build query parameters
    const queryParams = new URLSearchParams();

    // Add pagination parameters
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    // Add filter parameters
    if (params.type && params.type !== 'all') queryParams.append('type', params.type);
    if (params.severity && params.severity !== 'all')
      queryParams.append('severity', params.severity);
    if (params.acknowledged && params.acknowledged !== 'all')
      queryParams.append('acknowledged', params.acknowledged);
    if (params.source) queryParams.append('source', params.source);
    if (params.start_time) queryParams.append('start_time', params.start_time);
    if (params.end_time) queryParams.append('end_time', params.end_time);

    const queryString = queryParams.toString();
    const url = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/security/events${queryString ? `?${queryString}` : ''}`;

    const response = await api.fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Handle different response formats
    const events = data.events || data.data || data || [];
    const paginationInfo = {
      total_count: data.total_count || data.total || events.length,
      page: data.page || params.page || 1,
      total_pages:
        data.total_pages || Math.ceil((data.total_count || events.length) / (params.limit || 50)),
      events: events,
    };

    dispatch({
      type: ActionTypes.FETCH_EVENTS_SUCCESS,
      payload: paginationInfo,
    });

    return paginationInfo;
  } catch (error) {
    logger.error('Error fetching events:', error);
    dispatch({
      type: ActionTypes.FETCH_EVENTS_FAILURE,
      payload: error.message,
    });
    return { error: error.message };
  }
};

/**
 * Acknowledge an event
 * @param eventId - The ID of the event to acknowledge
 * @param dispatch - The dispatch function from Redux
 * @returns {Promise<Object>} - A promise that resolves to the response
 */
export const acknowledgeEvent = async (eventId, dispatch) => {
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/security/events/${eventId}/acknowledge`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ acknowledged: true }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to acknowledge event: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    dispatch({
      type: ActionTypes.ACKNOWLEDGE_EVENT,
      payload: { eventId, acknowledged: true },
    });

    return { success: true, data };
  } catch (error) {
    logger.error('Error acknowledging event:', error);
    return { error: error.message };
  }
};

/**
 * Set event filters in the global state
 * @param filters - The filter object
 * @param dispatch - The dispatch function from Redux
 */
export const setEventFilters = (filters, dispatch) => {
  dispatch({
    type: ActionTypes.SET_EVENT_FILTERS,
    payload: filters,
  });
};

// Fetch approvers for a specific user
export const fetchApproversForUser = async (username) => {
  try {
    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/approvers/${username}`
    );
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Error fetching approvers for user');
    }
    const data = await res.json();
    return data;
  } catch (error) {
    logger.error('Error fetching approvers for user:', error);
    return [];
  }
};

// Update user approvers and approval requirements
export const updateUserApprovers = async (
  username,
  approvers,
  requiresApproval,
  isActive,
  userId,
  dispatch,
  is2FARequired = null
) => {
  try {
    const payload: any = {
      approvers: JSON.stringify(approvers || []),
      requires_approval: requiresApproval,
      is_active: isActive,
      user_id: userId,
    };

    // Add 2FA requirement if specified
    if (is2FARequired !== null) {
      payload.is_2fa_required = is2FARequired;
    }

    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/${username}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Error updating user approvers');
    }
    return await fetchUsers(dispatch);
  } catch (error) {
    logger.error('Error updating user approvers:', error);
    return null;
  }
};

/**
 * Fetch VM details for Kubernetes VM
 * @param vmName - The name of the VM to fetch details for
 * @returns Promise<any> - VM details including cluster information
 */
export const fetchVmDetails = async (vmName: string): Promise<any> => {
  try {
    const url = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`;

    // Check for cached response first
    const cachedResponse = getCachedResponse(url);
    if (cachedResponse) {
      return processVmFromClusterInfo(cachedResponse, vmName);
    }

    // Check if there's already an ongoing request for this URL
    if (ongoingClusterInfoRequests.has(url)) {
      const existingRequest = ongoingClusterInfoRequests.get(url);
      const clusterInfo = await existingRequest;
      return processVmFromClusterInfo(clusterInfo, vmName);
    }

    // Create and store the promise for this request
    const requestPromise = (async () => {
      try {
        const response = await api.fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch VM details: ${response.status} ${response.statusText}`);
        }

        const clusterInfo = await response.json();

        // Cache the response for future use
        setCachedResponse(url, clusterInfo);

        return clusterInfo;
      } finally {
        // Clean up the ongoing request tracker
        ongoingClusterInfoRequests.delete(url);
      }
    })();

    // Store the ongoing request
    ongoingClusterInfoRequests.set(url, requestPromise);

    // Wait for the request to complete
    const clusterInfo = await requestPromise;

    // Process and return the VM details
    return processVmFromClusterInfo(clusterInfo, vmName);
  } catch (error) {
    logger.error(`fetchVmDetails: Error fetching VM details for ${vmName}:`, error);
    throw error;
  }
};

/**
 * Fetch comprehensive VM hardware data in a single optimized call
 * @param vmName - Name of the VM
 * @param serverIp - IP address of the server containing the VM
 * @param dispatch - Redux dispatch function
 * @param forceRefresh - Whether to force refresh cached data
 * @returns Promise<any> - Comprehensive VM hardware data
 */
// Track ongoing requests to prevent duplicates
const ongoingRequests = new Set();

// Track recent requests to prevent rapid successive calls
const recentRequests = new Map();

// Global API response cache to reduce duplicate requests
const apiResponseCache = new Map();
const CACHE_DURATION = 30 * 1000; // 30 seconds cache for API responses

// Track ongoing requests to prevent duplicate API calls
const ongoingClusterInfoRequests = new Map();

// Helper function to process VM data from cluster info
const processVmFromClusterInfo = (clusterInfo: any, vmName: string): any => {
  // Find the specific VM in the clusters
  let vmDetails = null;
  if (clusterInfo && clusterInfo.clusters && clusterInfo.clusters.length > 0) {
    for (const cluster of clusterInfo.clusters) {
      if (cluster.vms && cluster.vms.length > 0) {
        const foundVm = cluster.vms.find((vm: any) => vm.vmName === vmName);
        if (foundVm) {
          vmDetails = {
            ...foundVm,
            clusterName: cluster.KubernetesClusterName,
            zoneName: cluster.zoneName,
          };
          break;
        }
      }
    }
  }

  if (!vmDetails) {
    throw new Error(`VM ${vmName} not found in cluster information`);
  }

  // Normalize property names to match UI expectations
  const normalizedVmDetails = {
    ...vmDetails,
    vmName: vmDetails.vmName || vmDetails.VMName || vmDetails.name,
    IPAddress:
      vmDetails.vmIpAddress ||
      vmDetails.VmIpAddress ||
      vmDetails.VMIPAddress ||
      vmDetails.ip_address ||
      vmDetails.ipAddress ||
      vmDetails.ip,
    MACAddress:
      vmDetails.vmMacAddress ||
      vmDetails.VMmacAddress ||
      vmDetails.VMacAddress ||
      vmDetails.macAddress ||
      vmDetails.mac_address ||
      vmDetails.mac,
    FQDN: vmDetails.fqdn || vmDetails.FQDN || vmDetails.domainName || vmDetails.domain,
    ClusterName:
      vmDetails.clusterName ||
      vmDetails.ClusterName ||
      vmDetails.KubernetesClusterName ||
      vmDetails.cluster_name,
    ZoneName: vmDetails.zoneName || vmDetails.ZoneName || vmDetails.zone_name,
    NodeIP: vmDetails.nodeIp || vmDetails.NodeIp || vmDetails.node_ip,
  };

  return normalizedVmDetails;
};

// Clean up old request timestamps and cache entries every 60 seconds
setInterval(() => {
  const now = Date.now();

  // Clean up recent requests tracker
  for (const [key, timestamp] of recentRequests.entries()) {
    if (now - timestamp > 60000) {
      // Remove entries older than 1 minute
      recentRequests.delete(key);
    }
  }

  // Clean up expired cache entries
  for (const [key, entry] of apiResponseCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      apiResponseCache.delete(key);
    }
  }
}, 60000);

// Helper function to get cached API response
export const getCachedResponse = (url: string) => {
  const cached = apiResponseCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.response;
  }
  return null;
};

// Helper function to cache API response
export const setCachedResponse = (url: string, response: any) => {
  // Only cache GET requests and successful responses
  if (response && typeof response === 'object') {
    apiResponseCache.set(url, {
      response: JSON.parse(JSON.stringify(response)), // Deep copy
      timestamp: Date.now(),
    });
  }
};

export const fetchVmHardwareData = async (
  vmName: string,
  serverAddress: string,
  dispatch: any,
  forceRefresh: boolean = false
): Promise<any> => {
  const vmKey = `${serverAddress}-${vmName}`;

  // Prevent duplicate requests for the same VM
  if (ongoingRequests.has(vmKey)) {
    return;
  }

  // Prevent rapid successive calls unless force refresh is requested
  const lastRequestTime = recentRequests.get(vmKey);
  const timeSinceLastRequest = lastRequestTime ? Date.now() - lastRequestTime : Infinity;

  if (!forceRefresh && timeSinceLastRequest < 10000) {
    // 10 second cooldown

    return;
  }

  ongoingRequests.add(vmKey);
  recentRequests.set(vmKey, Date.now());

  try {
    dispatch({ type: ActionTypes.FETCH_VM_HARDWARE_DATA_START, payload: { vmKey } });

    // Make parallel API calls for all VM hardware data
    // Use simple GET requests without any custom options to avoid preflight
    const apiCalls = [
      // VM Details
      api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}`
      ),
      // PCIe Devices
      api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/pci_devices`
      ),
      // System Info
      api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/system/info`
      ),
      // Network Drivers
      api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/drivers`
      ),
      // Network Switches
      api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`
      ),
    ];

    const responses = await Promise.allSettled(apiCalls);

    // Process responses and handle errors gracefully
    const hardwareData: any = {
      vmDetails: null,
      pcieInventory: null,
      systemInfo: null,
      networkDrivers: [],
      switches: [],
      unusedDisks: [],
      isLoading: false,
      error: null,
    };

    const endpoints = [
      `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}`,
      `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/pci_devices`,
      `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/system/info`,
      `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/drivers`,
      `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`,
    ];

    // Process VM Details (required)
    if (responses[0].status === 'fulfilled' && responses[0].value.ok) {
      const vmDetailsData = await responses[0].value.json();
      hardwareData.vmDetails = vmDetailsData;
      setCachedResponse(endpoints[0], vmDetailsData);
    } else {
      const error = 'Failed to fetch VM details';
      logger.error('fetchVmHardwareData:', error);
      dispatch({
        type: ActionTypes.FETCH_VM_HARDWARE_DATA_FAILURE,
        payload: { vmKey, error },
      });
      throw new Error(error);
    }

    // Process PCIe Devices (optional)
    if (responses[1].status === 'fulfilled' && responses[1].value.ok) {
      const pcieData = await responses[1].value.json();
      hardwareData.pcieInventory = pcieData;
      setCachedResponse(endpoints[1], pcieData);
    } else {
      hardwareData.pcieInventory = {};
    }

    // Process System Info (optional)
    if (responses[2].status === 'fulfilled' && responses[2].value.ok) {
      const systemData = await responses[2].value.json();
      hardwareData.systemInfo = systemData;
      setCachedResponse(endpoints[2], systemData);
    } else {
      hardwareData.systemInfo = {};
    }

    // Process Network Drivers (optional)
    if (responses[3].status === 'fulfilled' && responses[3].value.ok) {
      const driversData = await responses[3].value.json();
      hardwareData.networkDrivers = driversData.drivers || [];
      setCachedResponse(endpoints[3], driversData);
    } else {
      hardwareData.networkDrivers = [];
    }

    // Process Network Switches (optional)
    if (responses[4].status === 'fulfilled' && responses[4].value.ok) {
      const switchesData = await responses[4].value.json();
      hardwareData.switches = Array.isArray(switchesData) ? switchesData : [];
      setCachedResponse(endpoints[4], switchesData);
    } else {
      hardwareData.switches = [];
    }

    // Fetch unused disks if we have VM details and datastore info
    if (hardwareData.vmDetails?.datastore) {
      try {
        const unusedDisksResponse = await api.fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/vm/unused_disks/${vmName}?datastore=${hardwareData.vmDetails.datastore}`
        );
        if (unusedDisksResponse.ok) {
          hardwareData.unusedDisks = (await unusedDisksResponse.json()) || [];
        }
      } catch (error) {
        hardwareData.unusedDisks = [];
      }
    }

    // Dispatch success with all hardware data
    dispatch({
      type: ActionTypes.FETCH_VM_HARDWARE_DATA_SUCCESS,
      payload: { vmKey, hardwareData },
    });

    return hardwareData;
  } catch (error) {
    logger.error(`fetchVmHardwareData: Error fetching hardware data for VM ${vmName}:`, error);
    dispatch({
      type: ActionTypes.FETCH_VM_HARDWARE_DATA_FAILURE,
      payload: {
        vmKey,
        error: error instanceof Error ? error.message : 'Failed to fetch VM hardware data',
      },
    });
    throw error;
  } finally {
    // Always remove from ongoing requests set
    ongoingRequests.delete(vmKey);
  }
};

/**
 * Get cached VM hardware data or fetch if not available/expired
 * @param vmName - Name of the VM
 * @param serverIp - IP address of the server containing the VM
 * @param state - Current app state
 * @param dispatch - Redux dispatch function
 * @param maxAge - Maximum age of cached data in milliseconds (default: 5 minutes)
 * @returns Promise<any> - VM hardware data from cache or fresh fetch
 */
export const getVmHardwareDataCached = async (
  vmName: string,
  serverAddress: string,
  state: any,
  dispatch: any,
  maxAge: number = 10 * 60 * 1000 // 10 minutes default
): Promise<any> => {
  const vmKey = `${serverAddress}-${vmName}`;
  const cachedData = state.vmHardwareData?.[vmKey];

  // Check if we have valid cached data
  if (
    cachedData &&
    cachedData.lastFetched &&
    Date.now() - cachedData.lastFetched < maxAge &&
    !cachedData.isLoading &&
    !cachedData.error
  ) {
    return cachedData;
  }

  // Check if there's already a request in progress for this VM
  if (ongoingRequests.has(vmKey)) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!ongoingRequests.has(vmKey)) {
          clearInterval(checkInterval);
          // Return the fresh data from the completed request
          const freshData = state.vmHardwareData?.[vmKey];
          resolve(freshData || null);
        }
      }, 100);
    });
  }

  // Fetch fresh data if cache is invalid, expired, or missing

  return await fetchVmHardwareData(vmName, serverAddress, dispatch, false);
};

// Verify 2FA code and complete login
//SM
export const verify2FA = async (twoFactorCode, dispatch) => {
  dispatch({ type: ActionTypes.LOGIN_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/verify-2fa`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ code: twoFactorCode }),
      }
    );

    const data = await response.json();

    if (response.ok && data.jwt_token) {
      // 2FA verification successful - store tokens and complete login
      localStorage.setItem('accessToken', data.jwt_token);

      if (data.refresh_token) {
        localStorage.setItem('refreshToken', data.refresh_token);
      }

      // Mark 2FA as completed
      dispatch({ type: ActionTypes.SET_2FA_COMPLETED, payload: true });
      dispatch({ type: ActionTypes.LOGIN_SUCCESS });

      return { success: true, data };
    } else {
      const errorMessage = data.error || 'Invalid 2FA code';
      dispatch({ type: ActionTypes.LOGIN_FAILURE, payload: errorMessage });
      return { success: false, message: errorMessage };
    }
  } catch (error) {
    const errorMessage = 'An error occurred during 2FA verification';
    dispatch({ type: ActionTypes.LOGIN_FAILURE, payload: errorMessage });
    return { success: false, message: errorMessage };
  }
};
//SM
