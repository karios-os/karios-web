import api from './interceptor';
import { ActionTypes } from './actionTypes';
import envConfig from '../../../../runtime-config';
import { logger } from './logger';

// Helper function to build server-specific VLAN API base URL
const buildVLANAPIBaseURL = (serverIp: string): string => {
  return `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network`;
};

// Helper function to build server-specific Vale API base URL
const buildValeAPIBaseURL = (serverIp: string): string => {
  return `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network`;
};

// Helper function to build fallback API base URL using runtime config
const buildFallbackAPIBaseURL = (): string => {
  return `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network`;
};

// Enhanced Type definitions for VLAN operations
export interface VLANData {
  name: string;
  admin_up: boolean;
  status: string;
  tag_id: number;
  parent_nic: string;
  mac_address: string;
  ipv4: string[];
  ipv6: string[];
  mtu: number;
  media: string;
  vxlan_tunnels: any[];
  virtual_switches_connected: number;
  bridge_members: any;
  routing_table: RoutingTableEntry[] | null;
  spanning_tree_info: any;
  is_editable: boolean;
  is_force_delete_enabled: boolean;
}

export interface RoutingTableEntry {
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
  protocol: string;
}

export interface VLANListResponse {
  count: number;
  message: string;
  state: string;
  vlans: VLANData[];
}

export interface VLANDetailsResponse {
  message: string;
  state: string;
  vlan_info: VLANData;
}

export interface VLANAvailableTagsResponse {
  available_tags: number[];
  currently_used: number[];
  max_vlans_allowed: number;
  message: string;
  state: string;
}

export interface VLANStatsResponse {
  message: string;
  state: string;
  vlan_stats: {
    rx_bytes: number;
    tx_bytes: number;
    rx_packets: number;
    tx_packets: number;
    rx_errors: number;
    tx_errors: number;
    rx_dropped: number;
    tx_dropped: number;
    collisions: number;
  };
}

export interface VLANPingResponse {
  state: string;
  success: boolean;
  vlan_name: string;
  target_ip: string;
  packets_sent: number;
  packets_lost: number;
  loss_percent: number;
  min_rtt_ms: number;
  max_rtt_ms: number;
  avg_rtt_ms: number;
  total_time_ms: number;
  output: string;
}

export interface CreateVLANData {
  tag_id: number;
  parent_nic: string;
  vlan_number: number;
  static_ip: string;
  subnet_mask: string;
}

export interface CreateVLANResponse {
  ip_assigned?: boolean;
  ip_assignment_type?: string;
  message: string;
  state: string;
  vlan_info?: VLANData;
  error?: string; // For error responses
}

export interface ConfigureVLANIPData {
  use_dhcp: boolean;
  is_editable: boolean;
  static_ip: string;
  gateway: string;
  subnet_mask: string;
}

export interface ConfigureVLANIPResponse {
  gateway: string;
  message: string;
  state: string;
  static_ip: string;
  subnet_mask: string;
  vlan_name: string;
}

export interface VLANDeletionPromptResponse {
  state: string;
  vlan_name: string;
  connected_switch_names: string[];
  switches_will_be_isolated: string[];
  total_connected_switches: number;
  isolated_switch_count: number;
  available_vlan_names: string[];
  recommended_action: string;
  requires_user_confirmation: boolean;
}

export interface DeleteVLANData {
  confirm: boolean;
}

/**
 * Fetch all VLANs from the network API
 */
export const fetchVLANs = async (dispatch: any, serverIp?: string): Promise<VLANListResponse> => {
  try {
    dispatch({ type: ActionTypes.FETCH_VLANS_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildVLANAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const response = await api.fetch(`${baseUrl}/interfaces/virtual/vlans`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error || 'Failed to fetch VLANs';

      // Handle "No VLANs found" as empty data rather than error
      if (
        errorMessage.toLowerCase().includes('no vlans found') ||
        errorMessage.toLowerCase().includes('no vlans') ||
        response.status === 404
      ) {
        const emptyResponse: VLANListResponse = {
          vlans: [],
          count: 0,
          message: 'No VLANs found',
          state: 'success',
        };
        dispatch({
          type: ActionTypes.FETCH_VLANS_SUCCESS,
          payload: emptyResponse,
        });
        return emptyResponse;
      }

      throw new Error(errorMessage);
    }

    const vlansResponse: VLANListResponse = await response.json();

    dispatch({
      type: ActionTypes.FETCH_VLANS_SUCCESS,
      payload: vlansResponse,
    });

    return vlansResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch VLANs';

    // Handle "No VLANs found" error gracefully
    if (
      errorMessage.toLowerCase().includes('no vlans found') ||
      errorMessage.toLowerCase().includes('no vlans')
    ) {
      const emptyResponse: VLANListResponse = {
        vlans: [],
        count: 0,
        message: 'No VLANs found',
        state: 'success',
      };
      dispatch({
        type: ActionTypes.FETCH_VLANS_SUCCESS,
        payload: emptyResponse,
      });
      return emptyResponse;
    }

    dispatch({
      type: ActionTypes.FETCH_VLANS_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Fetch details for a specific VLAN
 */
export const fetchVLANDetails = async (
  dispatch: any,
  vlanName: string,
  serverIp?: string
): Promise<VLANDetailsResponse> => {
  try {
    dispatch({ type: ActionTypes.FETCH_VLAN_DETAILS_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildVLANAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const response = await api.fetch(`${baseUrl}/interfaces/virtual/vlans/${vlanName}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch VLAN details');
    }

    const vlanDetailsResponse: VLANDetailsResponse = await response.json();

    dispatch({
      type: ActionTypes.FETCH_VLAN_DETAILS_SUCCESS,
      payload: vlanDetailsResponse,
    });

    return vlanDetailsResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch VLAN details';
    dispatch({
      type: ActionTypes.FETCH_VLAN_DETAILS_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Create a new VLAN
 */
export const createVLAN = async (
  dispatch: any,
  vlanData: CreateVLANData,
  serverIp?: string
): Promise<CreateVLANResponse> => {
  try {
    dispatch({ type: ActionTypes.CREATE_VLAN_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildVLANAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const response = await api.fetch(`${baseUrl}/interfaces/virtual/vlans/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vlanData),
    });

    // Always parse the response, whether success or error
    const result: CreateVLANResponse | any = await response.json();

    // Check if the response contains an error (including DHCP failure cases)
    if (
      result.state === 'failed' ||
      result.error ||
      (result.state !== 'success' && response.status >= 400)
    ) {
      // Extract error message from the response
      let errorMessage = 'Failed to create VLAN';

      // Handle specific DHCP failure case
      if (result.error && result.error.includes('DHCP is not available')) {
        errorMessage = result.error;
      } else if (result.error) {
        errorMessage = result.error;
      } else if (result.message) {
        errorMessage = result.message;
      }

      dispatch({
        type: ActionTypes.CREATE_VLAN_FAILURE,
        payload: errorMessage,
      });
      throw new Error(errorMessage);
    }

    // Success case
    dispatch({
      type: ActionTypes.CREATE_VLAN_SUCCESS,
      payload: result,
    });

    return result;
  } catch (error) {
    let errorMessage = 'Failed to create VLAN';

    // Handle different types of errors
    if (error instanceof Error) {
      // If it's already a parsed error from above, just use the message
      if (
        error.message.includes('DHCP is not available') ||
        error.message.includes('Failed to create VLAN') ||
        error.message.includes('VLAN creation failed')
      ) {
        errorMessage = error.message;
      } else {
        // Try to parse error response if it's JSON
        try {
          const errorText = error.message;
          if (errorText.includes('{')) {
            const errorJson = JSON.parse(errorText.substring(errorText.indexOf('{')));

            // Handle DHCP failure specifically
            if (errorJson.error && errorJson.error.includes('DHCP is not available')) {
              errorMessage = errorJson.error;
            } else if (errorJson.error) {
              if (typeof errorJson.error === 'object') {
                const errorKey = Object.keys(errorJson.error)[0];
                const errorValue = errorJson.error[errorKey];
                errorMessage = errorValue || errorKey || errorMessage;
              } else {
                errorMessage = errorJson.error;
              }
            } else if (errorJson.message) {
              errorMessage = errorJson.message;
            }
          } else {
            errorMessage = error.message;
          }
        } catch {
          errorMessage = error.message;
        }
      }
    }

    dispatch({
      type: ActionTypes.CREATE_VLAN_FAILURE,
      payload: errorMessage,
    });
    throw new Error(errorMessage);
  }
};

/**
 * Delete a VLAN
 */
export const deleteVLAN = async (
  dispatch: any,
  vlanName: string,
  deleteData: DeleteVLANData = { confirm: true },
  serverIp?: string,
  approver?: string
): Promise<void> => {
  try {
    dispatch({ type: ActionTypes.DELETE_VLAN_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildVLANAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    let url = `${baseUrl}/interfaces/virtual/vlans/${vlanName}`;

    // Add approver query param if provided
    if (approver) {
      url += `?approver=${encodeURIComponent(approver)}`;
    }

    const response = await api.fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deleteData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete VLAN');
    }

    dispatch({
      type: ActionTypes.DELETE_VLAN_SUCCESS,
      payload: vlanName,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete VLAN';
    dispatch({
      type: ActionTypes.DELETE_VLAN_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Reset VLAN state
 */
export const resetVLANState = (dispatch: any) => {
  dispatch({ type: ActionTypes.RESET_VLAN_STATE });
};

/**
 * Set VLAN form data
 */
export const setVLANForm = (dispatch: any, formData: Partial<CreateVLANData>) => {
  dispatch({
    type: ActionTypes.SET_VLAN_FORM,
    payload: formData,
  });
};

/**
 * Clear VLAN form data
 */
export const clearVLANForm = (dispatch: any) => {
  dispatch({ type: ActionTypes.CLEAR_VLAN_FORM });
};

// ===================================================================
// VALE API SERVICES (Network Vale Management)
// ===================================================================

// Additional interfaces for Vale functionality
interface TapVmMappings {
  [key: string]: string;
}

interface AvailableTaps {
  tap_vm_mappings: TapVmMappings;
  available_taps: number;
}

interface NetworkInterface {
  name: string;
  type: string;
  display_name: string;
  warning?: string;
}

interface AvailableInterfaces {
  available_network_interfaces: NetworkInterface[];
  available_nics: number;
  available_vlans: number;
}

// ===================== Detach Parent NIC API Types =====================
export interface DetachParentNicPayload {
  network_interface: string;
  confirm_isolated?: boolean;
  confirm_destroyed?: boolean;
  confirm_bulk_detach?: boolean;
}

export interface DetachParentNicResponse {
  state: string;
  message: string;
  vale_name: string;
  action: string;
  requires_user_confirmation: boolean;
  warnings?: string[];
  confirm_isolated?: boolean;
  confirm_destroyed?: boolean;
  confirm_bulk_detach?: boolean;
  connections_before?: any[];
  connections_after?: any[];
  commands_executed?: string[];
}
/**
 * Detach parent NIC from a Vale switch
 * DELETE ${envConfig().PROTOCOL}://<host>/api/v1/network/switch/vale/<vale_name>/detach-parent
 * @param dispatch Redux dispatch
 * @param valeName Name of the Vale switch (e.g., "vale2")
 * @param payload DetachParentNicPayload
 * @param serverIp Optional server IP to use for the API call
 */
export const detachParentNic = async (
  dispatch: any,
  valeName: string,
  payload: DetachParentNicPayload,
  serverIp?: string,
  approver?: string
): Promise<DetachParentNicResponse> => {
  try {
    dispatch({ type: ActionTypes.DETACH_PARENT_NIC_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    let url = `${baseUrl}/switch/vale/${valeName}/detach-parent`;

    // Add approver query param if provided
    if (approver) {
      url += `?approver=${encodeURIComponent(approver)}`;
    }
    const response = await api.fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result: DetachParentNicResponse = await response.json();

    if (!response.ok || result.state === 'error') {
      const errorMessage = result.message || 'Failed to detach parent NIC';
      dispatch({
        type: ActionTypes.DETACH_PARENT_NIC_FAILURE,
        payload: errorMessage,
      });
      throw new Error(errorMessage);
    }

    dispatch({
      type: ActionTypes.DETACH_PARENT_NIC_SUCCESS,
      payload: result,
    });

    // Optionally refresh connections after successful detach
    // Use try-catch to handle cases where Vale switch may have been destroyed
    try {
      await fetchValeConnections(dispatch, serverIp);
    } catch (refreshError) {
      // Don't throw here as the detach operation was successful
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to detach parent NIC';
    dispatch({
      type: ActionTypes.DETACH_PARENT_NIC_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

export interface ValeDetailsData {
  vale_name: string;
  status: string;
  is_blocked: boolean;
  is_isolated: boolean;
  connected_interfaces: string[] | null;
  tap_count: number;
  connected_taps: { [key: string]: string };
  available_taps: {
    tap_vm_mappings: { [key: string]: string };
    available_taps: number;
  };
  available_interfaces: {
    available_network_interfaces: string[];
    available_nics: number;
    available_vlans: number;
  };
}

export interface ValeConfigData {
  next_vale_number: number;
  suggested_vale_name: string;
  available_taps: AvailableTaps;
  available_interfaces: AvailableInterfaces;
}

interface OccupiedMappings {
  [key: string]: string;
}

interface AvailableMappings {
  [key: string]: string;
}

interface Connection {
  vale_name: string;
  tap_interface: string;
  connected: boolean;
  vm_name: string;
  bridge_idx: number;
  port_idx: number;
}

export interface ValeConnectionsData {
  total_tap_interfaces: number;
  occupied_taps: number;
  available_taps: number;
  active_connections: number;
  active_vale_switches: number;
  occupied_mappings: OccupiedMappings;
  available_mappings: AvailableMappings;
  connections: Connection[];
}

export interface ValeDetachPayload {
  vale_name: string;
  tap_interface: string;
}

export interface ValeAttachPayload {
  vale_number: number;
  tap_interfaces: string[]; // Array of tap interfaces (backend expects this)
  network_interface?: string; // Optional network interface for fully connected networks
  confirm_isolated?: boolean; // Confirm creation of isolated network
  confirm_blocked?: boolean; // Confirm blocked parent interface usage
}

export interface ValeDetachResponse {
  error?: string;
  message?: string;
  command_executed?: string;
  success?: boolean;
}

export interface TapInterfaceInfo {
  name: string;
  vm_name: string;
  connected: boolean;
  connection: string;
}

export interface ValeAttachResponse {
  state?: string; // "success" or "error"
  message?: string;
  vale_name?: string;
  scenario?: string; // e.g., "isolated_taps", "fully_connected", etc.
  requires_user_confirmation?: boolean;
  tap_interfaces?: TapInterfaceInfo[];
  commands_executed?: string[];
  warnings?: string[];
  isolated?: boolean;
  blocked?: boolean;
  error?: string; // For backward compatibility
  success?: boolean; // For backward compatibility
}

// Vale Summary API interfaces
interface FullyConnectedNetwork {
  parent_interface: string; // Updated from 'vlan' to match API response
  vale: string;
  tap_count: number;
}

interface IsolatedNetwork {
  vale: string;
  tap_count: number;
}

interface UnusedNetwork {
  vale?: string;
  name?: string;
  [key: string]: any; // Allow for additional fields from the API
}

interface ConnectionsSummary {
  fully_connected_networks: FullyConnectedNetwork[];
  isolated_networks: IsolatedNetwork[];
  unused_networks: UnusedNetwork[];
}

export interface ValeSummaryData {
  total_tap_interfaces: number;
  occupied_taps: number;
  occupied_tap_mappings: { [key: string]: string };
  occupied_network_interface_mappings: { [key: string]: string };
  active_connections: number;
  active_vale_switches: number;
  connections: ConnectionsSummary;
  blocked_parent_interfaces: string[];
  isolated_networks: string[];
  available_taps: number;
  available_network_interface_count: number;
}

/**
 * Fetch Vale configuration data
 */
export const fetchValeConfig = async (
  dispatch: any,
  serverIp?: string
): Promise<ValeConfigData> => {
  try {
    dispatch({ type: ActionTypes.FETCH_VALE_CONFIG_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const url = `${baseUrl}/switch/vale/config`;

    const response = await api.fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch Vale configuration.');
    }

    const configData: ValeConfigData = await response.json();

    dispatch({
      type: ActionTypes.FETCH_VALE_CONFIG_SUCCESS,
      payload: configData,
    });

    return configData;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch Vale configuration';
    dispatch({
      type: ActionTypes.FETCH_VALE_CONFIG_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Fetch Vale connections data
 */
export const fetchValeConnections = async (
  dispatch: any,
  serverIp?: string
): Promise<ValeConnectionsData> => {
  // Since the direct connections endpoint doesn't exist, use the working summary endpoint
  // and transform the data to match the connections interface
  const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
  const url = `${baseUrl}/switch/vale/summary`;

  try {
    dispatch({ type: ActionTypes.FETCH_VALE_CONNECTIONS_START });

    const response = await api.fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      logger.error('Vale connections API error:', errorMessage);
      throw new Error(errorMessage);
    }

    const summaryData: ValeSummaryData = await response.json();

    // Transform summary data to connections format
    const connectionsData: ValeConnectionsData = {
      total_tap_interfaces: summaryData.total_tap_interfaces,
      occupied_taps: summaryData.occupied_taps,
      available_taps: summaryData.available_taps,
      active_connections: summaryData.active_connections,
      active_vale_switches: summaryData.active_vale_switches,
      occupied_mappings: summaryData.occupied_tap_mappings || {},
      available_mappings: {}, // This might not be available in summary, use empty object
      connections: [], // Transform connection summary to detailed connections if needed
    };

    dispatch({
      type: ActionTypes.FETCH_VALE_CONNECTIONS_SUCCESS,
      payload: {
        ...connectionsData,
        lastUpdated: new Date(),
      },
    });

    return connectionsData;
  } catch (error) {
    logger.error('Vale connections API error:', error);

    let errorMessage = 'Failed to fetch Vale connections';

    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage =
        'Network connection failed. Please check if the server is running and accessible.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    dispatch({
      type: ActionTypes.FETCH_VALE_CONNECTIONS_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Detach Vale switch
 */
export const detachValeSwitch = async (
  dispatch: any,
  detachData: ValeDetachPayload,
  serverIp?: string
): Promise<ValeDetachResponse> => {
  try {
    dispatch({ type: ActionTypes.DETACH_VALE_SWITCH_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const url = `${baseUrl}/switch/vale/detach`;

    const response = await api.fetch(url, {
      method: 'POST',
      body: JSON.stringify(detachData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to detach Vale switch.');
    }

    const result: ValeDetachResponse = await response.json();

    if (result.error) {
      dispatch({
        type: ActionTypes.DETACH_VALE_SWITCH_FAILURE,
        payload: result.error,
      });
      throw new Error(result.error);
    } else {
      const successMessage =
        result.command_executed || result.message || 'Vale switch detached successfully';
      dispatch({
        type: ActionTypes.DETACH_VALE_SWITCH_SUCCESS,
        payload: successMessage,
      });

      // Refresh connections data after successful detach
      // Use try-catch to handle cases where Vale switch may have been destroyed
      try {
        await fetchValeConnections(dispatch, serverIp);
      } catch (refreshError) {
        // Don't throw here as the detach operation was successful
      }
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to detach Vale switch';
    dispatch({
      type: ActionTypes.DETACH_VALE_SWITCH_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Attach/Create Vale switch
 */
export const attachValeSwitch = async (
  dispatch: any,
  attachData: ValeAttachPayload,
  serverIp?: string
): Promise<ValeAttachResponse> => {
  try {
    dispatch({ type: ActionTypes.ATTACH_VALE_SWITCH_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const url = `${baseUrl}/switch/vale/attach`;

    const response = await api.fetch(url, {
      method: 'POST',
      body: JSON.stringify(attachData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = `HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`;
      throw new Error(errorMessage);
    }

    const result: ValeAttachResponse = await response.json();

    if (result.error || result.state === 'error') {
      const errorMessage = result.error || result.message || 'Unknown error occurred';
      dispatch({
        type: ActionTypes.ATTACH_VALE_SWITCH_FAILURE,
        payload: errorMessage,
      });
      throw new Error(errorMessage);
    } else {
      const successMessage =
        result.message ||
        (result.commands_executed && result.commands_executed.length > 0
          ? `Successfully executed: ${result.commands_executed.join(', ')}`
          : '') ||
        `Successfully created ${result.vale_name || `vale${attachData.vale_number}`}`;
      dispatch({
        type: ActionTypes.ATTACH_VALE_SWITCH_SUCCESS,
        payload: successMessage,
      });

      // Refresh connections data after successful attach
      await fetchValeConnections(dispatch, serverIp);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to attach Vale switch';
    dispatch({
      type: ActionTypes.ATTACH_VALE_SWITCH_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Fetch all Vale data (config + connections)
 */
export const fetchAllValeData = async (
  dispatch: any,
  serverIp?: string
): Promise<{ config: ValeConfigData; connections: ValeConnectionsData }> => {
  try {
    // Fetch connections data (this is the primary data needed)
    const connections = await fetchValeConnections(dispatch, serverIp);

    // Config is only needed for create operations, so we'll fetch it separately when needed
    return { config: null, connections };
  } catch (error) {
    logger.error('Error fetching Vale data:', error);
    throw error;
  }
};

/**
 * Clear Vale messages (errors and success messages)
 */
export const clearValeMessages = (dispatch: any): void => {
  dispatch({ type: ActionTypes.CLEAR_VALE_MESSAGES });
};

/**
 * Fetch Vale summary data
 */
export const fetchValeSummary = async (
  dispatch: any,
  serverIp?: string
): Promise<ValeSummaryData> => {
  try {
    dispatch({ type: ActionTypes.FETCH_VALE_SUMMARY_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const url = `${baseUrl}/switch/vale/summary`;

    const response = await api.fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch Vale summary.');
    }

    const summaryData: ValeSummaryData = await response.json();

    dispatch({
      type: ActionTypes.FETCH_VALE_SUMMARY_SUCCESS,
      payload: summaryData,
    });

    return summaryData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Vale summary';
    dispatch({
      type: ActionTypes.FETCH_VALE_SUMMARY_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Test network connectivity to the Vale API server
 */
export const testNetworkConnectivity = async (
  serverIp?: string
): Promise<{ success: boolean; message: string; url: string }> => {
  // Use the working summary endpoint for connectivity testing
  const testUrl = serverIp
    ? `${buildValeAPIBaseURL(serverIp)}/switch/vale/summary`
    : `${buildFallbackAPIBaseURL()}/switch/vale/summary`;

  try {
    const response = await api.fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Test without credentials first
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Successfully connected to Vale API server',
        url: testUrl,
      };
    } else {
      return {
        success: false,
        message: `Server responded with status ${response.status}: ${response.statusText}`,
        url: testUrl,
      };
    }
  } catch (error) {
    logger.error('Network connectivity test failed:', error);

    let message = 'Network connection failed';
    if (error instanceof TypeError && error.message.includes('fetch')) {
      message =
        'Cannot reach the server. Please check if the network API server is running at ' + testUrl;
    } else if (error instanceof Error) {
      message = error.message;
    }

    return {
      success: false,
      message,
      url: testUrl,
    };
  }
};

/**
 * Fetch available VLAN tags information
 */
export const fetchVLANAvailableTags = async (
  dispatch: any,
  serverIp?: string
): Promise<VLANAvailableTagsResponse> => {
  try {
    dispatch({ type: ActionTypes.FETCH_VLAN_AVAILABLE_TAGS_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildVLANAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const response = await api.fetch(`${baseUrl}/interfaces/virtual/vlans/available-tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error || 'Failed to fetch available VLAN tags';

      // Handle "no tags" scenarios gracefully
      if (
        errorMessage.toLowerCase().includes('no tags') ||
        errorMessage.toLowerCase().includes('no available') ||
        response.status === 404
      ) {
        const emptyResponse: VLANAvailableTagsResponse = {
          available_tags: [],
          currently_used: [],
          max_vlans_allowed: 0,
          message: 'No VLAN tags available',
          state: 'success',
        };
        dispatch({
          type: ActionTypes.FETCH_VLAN_AVAILABLE_TAGS_SUCCESS,
          payload: emptyResponse,
        });
        return emptyResponse;
      }

      throw new Error(errorMessage);
    }

    const availableTagsResponse: VLANAvailableTagsResponse = await response.json();

    dispatch({
      type: ActionTypes.FETCH_VLAN_AVAILABLE_TAGS_SUCCESS,
      payload: availableTagsResponse,
    });

    return availableTagsResponse;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch available VLAN tags';

    // Handle "no tags" error gracefully
    if (
      errorMessage.toLowerCase().includes('no tags') ||
      errorMessage.toLowerCase().includes('no available')
    ) {
      const emptyResponse: VLANAvailableTagsResponse = {
        available_tags: [],
        currently_used: [],
        max_vlans_allowed: 0,
        message: 'No VLAN tags available',
        state: 'success',
      };
      dispatch({
        type: ActionTypes.FETCH_VLAN_AVAILABLE_TAGS_SUCCESS,
        payload: emptyResponse,
      });
      return emptyResponse;
    }

    dispatch({
      type: ActionTypes.FETCH_VLAN_AVAILABLE_TAGS_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Fetch VLAN statistics for a specific VLAN
 */
export const fetchVLANStats = async (
  dispatch: any,
  vlanName: string,
  serverIp?: string
): Promise<VLANStatsResponse> => {
  try {
    dispatch({ type: ActionTypes.FETCH_VLAN_STATS_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildVLANAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const response = await api.fetch(`${baseUrl}/interfaces/virtual/vlans/${vlanName}/stats`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch VLAN statistics');
    }

    const statsResponse: VLANStatsResponse = await response.json();

    dispatch({
      type: ActionTypes.FETCH_VLAN_STATS_SUCCESS,
      payload: statsResponse,
    });

    return statsResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch VLAN statistics';
    dispatch({
      type: ActionTypes.FETCH_VLAN_STATS_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Ping a VLAN to test connectivity
 */
export const pingVLAN = async (
  dispatch: any,
  vlanName: string,
  serverIp?: string
): Promise<VLANPingResponse> => {
  try {
    dispatch({ type: ActionTypes.PING_VLAN_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildVLANAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const response = await api.fetch(`${baseUrl}/interfaces/virtual/vlans/${vlanName}/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to ping VLAN');
    }

    const pingResponse: VLANPingResponse = await response.json();

    dispatch({
      type: ActionTypes.PING_VLAN_SUCCESS,
      payload: pingResponse,
    });

    return pingResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to ping VLAN';
    dispatch({
      type: ActionTypes.PING_VLAN_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Configure IP settings for a VLAN
 */
export const configureVLANIP = async (
  dispatch: any,
  vlanName: string,
  ipConfig: ConfigureVLANIPData,
  serverIp?: string
): Promise<ConfigureVLANIPResponse> => {
  try {
    dispatch({ type: ActionTypes.CONFIGURE_VLAN_IP_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildVLANAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const response = await api.fetch(`${baseUrl}/interfaces/virtual/vlans/${vlanName}/ip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ipConfig),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to configure VLAN IP');
    }

    const ipConfigResponse: ConfigureVLANIPResponse = await response.json();

    dispatch({
      type: ActionTypes.CONFIGURE_VLAN_IP_SUCCESS,
      payload: ipConfigResponse,
    });

    return ipConfigResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to configure VLAN IP';
    dispatch({
      type: ActionTypes.CONFIGURE_VLAN_IP_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Get VLAN deletion prompt information
 */
export const getVLANDeletionPrompt = async (
  dispatch: any,
  vlanName: string,
  serverIp?: string
): Promise<VLANDeletionPromptResponse> => {
  try {
    dispatch({ type: ActionTypes.FETCH_VLAN_DELETION_PROMPT_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildVLANAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const response = await api.fetch(
      `${baseUrl}/interfaces/virtual/vlans/${vlanName}/deletion-prompt`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch VLAN deletion prompt');
    }

    const deletionPromptResponse: VLANDeletionPromptResponse = await response.json();

    dispatch({
      type: ActionTypes.FETCH_VLAN_DELETION_PROMPT_SUCCESS,
      payload: deletionPromptResponse,
    });

    return deletionPromptResponse;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch VLAN deletion prompt';
    dispatch({
      type: ActionTypes.FETCH_VLAN_DELETION_PROMPT_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Fetch Vale switch details by vale name
 */
export const fetchValeDetails = async (
  dispatch: any,
  valeName: string,
  serverIp?: string
): Promise<ValeDetailsData> => {
  // Use server-specific URL if serverIp is provided, otherwise use fallback
  const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
  const url = `${baseUrl}/switch/vale/${valeName}`;

  try {
    dispatch({ type: ActionTypes.FETCH_VALE_DETAILS_START });

    const response = await api.fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to fetch details for Vale switch: ${valeName}`);
    }

    const detailsData: ValeDetailsData = await response.json();

    dispatch({
      type: ActionTypes.FETCH_VALE_DETAILS_SUCCESS,
      payload: detailsData,
    });

    return detailsData;
  } catch (error) {
    let errorMessage = `Failed to fetch details for Vale switch: ${valeName}`;

    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage =
        'Network connection failed. Please check if the server is running and accessible.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    dispatch({
      type: ActionTypes.FETCH_VALE_DETAILS_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

export interface ValeDestroyPayload {
  confirm_destroy?: boolean;
  confirm_destroyed?: boolean;
}

export interface ValeDestroyAnalysisResponse {
  state: string; // "analysis" or "success" or "error"
  message: string;
  vale_name: string;
  action: string; // "destroy_vale"
  requires_user_confirmation: boolean;
  warnings: string[];
  confirm_isolated: boolean;
  confirm_destroyed: boolean;
  confirm_bulk_detach: boolean;
}

export interface ValeDestroyResponse {
  state: string; // "success" or "error"
  message: string;
  vale_name: string;
  action: string;
  requires_user_confirmation: boolean;
  connections_before?: Array<{
    vale_name: string;
    interface: string;
    connected: boolean;
    vm_name: string;
    bridge_idx: number;
    port_idx: number;
    interface_type: string;
    network_interface?: string;
  }>;
  commands_executed?: string[];
  warnings?: string[];
  confirm_isolated: boolean;
  confirm_destroyed: boolean;
  confirm_bulk_detach: boolean;
}

/**
 * Fetch Vale destroy analysis (what will happen when destroying a Vale switch)
 * GET ${envConfig().PROTOCOL}://{{local-url}}/api/v1/network/switch/vale/{valeName}
 */
export const fetchValeDestroyAnalysis = async (
  dispatch: any,
  valeName: string,
  serverIp?: string,
  approver?: string
): Promise<ValeDestroyAnalysisResponse> => {
  // Use server-specific URL if serverIp is provided, otherwise use fallback
  const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
  let url = `${baseUrl}/switch/vale/${valeName}`;

  // Add approver as query parameter if provided
  if (approver) {
    url += `?approver=${encodeURIComponent(approver)}`;
  }

  try {
    dispatch({ type: ActionTypes.FETCH_VALE_DESTROY_ANALYSIS_START });

    const response = await api.fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirm_destroy: true }), // Send confirm_destroy for analysis
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || `Failed to fetch destroy analysis for Vale switch: ${valeName}`
      );
    }

    const analysisData: ValeDestroyAnalysisResponse = await response.json();

    dispatch({
      type: ActionTypes.FETCH_VALE_DESTROY_ANALYSIS_SUCCESS,
      payload: analysisData,
    });

    return analysisData;
  } catch (error) {
    logger.error('Failed to fetch destroy analysis for Vale switch:', error);

    let errorMessage = `Failed to fetch destroy analysis for Vale switch: ${valeName}`;

    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage =
        'Network connection failed. Please check if the server is running and accessible.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    dispatch({
      type: ActionTypes.FETCH_VALE_DESTROY_ANALYSIS_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Destroy Vale switch with confirmation
 * DELETE ${envConfig().PROTOCOL}://{{local-url}}/api/v1/network/switch/vale/{valeName}
 */
export const destroyValeSwitch = async (
  dispatch: any,
  valeName: string,
  payload: ValeDestroyPayload,
  serverIp?: string,
  approver?: string
): Promise<ValeDestroyResponse> => {
  try {
    dispatch({ type: ActionTypes.DESTROY_VALE_SWITCH_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    let url = `${baseUrl}/switch/vale/${valeName}`;

    // Add approver query param if provided
    if (approver) {
      url += `?approver=${encodeURIComponent(approver)}`;
    }

    const response = await api.fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to destroy Vale switch: ${valeName}`);
    }

    const result: ValeDestroyResponse = await response.json();

    if (result.state === 'error') {
      const errorMessage = result.message || 'Failed to destroy Vale switch';
      dispatch({
        type: ActionTypes.DESTROY_VALE_SWITCH_FAILURE,
        payload: errorMessage,
      });
      throw new Error(errorMessage);
    }

    const successMessage = result.message || `Successfully destroyed Vale switch: ${valeName}`;
    dispatch({
      type: ActionTypes.DESTROY_VALE_SWITCH_SUCCESS,
      payload: successMessage,
    });

    // Refresh connections after successful destroy
    // Use try-catch to handle cases where Vale switch connections can't be fetched
    try {
      await fetchValeConnections(dispatch, serverIp);
    } catch (refreshError) {
      // Don't throw here as the destroy operation was successful
    }

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : `Failed to destroy Vale switch: ${valeName}`;
    dispatch({
      type: ActionTypes.DESTROY_VALE_SWITCH_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Confirm Vale switch destruction (final step)
 * DELETE ${envConfig().PROTOCOL}://{{local-url}}/api/v1/network/switch/vale/{valeName}
 */
export const confirmValeDestroy = async (
  dispatch: any,
  valeName: string,
  serverIp?: string,
  approver?: string
): Promise<ValeDestroyResponse> => {
  try {
    dispatch({ type: ActionTypes.DESTROY_VALE_SWITCH_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    let url = `${baseUrl}/switch/vale/${valeName}`;

    // Add approver query param if provided
    if (approver) {
      url += `?approver=${encodeURIComponent(approver)}`;
    }

    const response = await api.fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirm_destroyed: true }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to confirm destroy Vale switch: ${valeName}`);
    }

    const result: ValeDestroyResponse = await response.json();

    if (result.state === 'error') {
      const errorMessage = result.message || 'Failed to destroy Vale switch';
      dispatch({
        type: ActionTypes.DESTROY_VALE_SWITCH_FAILURE,
        payload: errorMessage,
      });
      throw new Error(errorMessage);
    }

    const successMessage = result.message || `Successfully destroyed Vale switch: ${valeName}`;
    dispatch({
      type: ActionTypes.DESTROY_VALE_SWITCH_SUCCESS,
      payload: successMessage,
    });

    // Refresh connections after successful destroy (no delay needed with improved component logic)
    try {
      await fetchValeConnections(dispatch, serverIp);
    } catch (error) {
      // Don't throw here as the destroy was successful
    }

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : `Failed to confirm destroy Vale switch: ${valeName}`;
    dispatch({
      type: ActionTypes.DESTROY_VALE_SWITCH_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * ===================================================================
 * NETWORK INTERFACES AND SWITCHES API SERVICES
 * ===================================================================
 */

/**
 * Fetch network interfaces from a server
 */
export const fetchNetworkInterfaces = async (
  dispatch: any,
  serverIp: string
): Promise<string[]> => {
  try {
    dispatch({ type: ActionTypes.FETCH_NETWORK_INTERFACES_START });

    const url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/interfaces`;

    const response = await api.fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch network interfaces: ${response.statusText}`);
    }

    const interfaces: string[] = await response.json();

    dispatch({
      type: ActionTypes.FETCH_NETWORK_INTERFACES_SUCCESS,
      payload: interfaces,
    });

    return interfaces;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch network interfaces';
    dispatch({
      type: ActionTypes.FETCH_NETWORK_INTERFACES_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Fetch network switches from a server
 */
export const fetchNetworkSwitches = async (dispatch: any, serverIp: string): Promise<any[]> => {
  try {
    dispatch({ type: ActionTypes.FETCH_NETWORK_SWITCHES_START });

    const url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`;

    const response = await api.fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch network switches: ${response.statusText}`);
    }

    const switches: any[] = await response.json();

    dispatch({
      type: ActionTypes.FETCH_NETWORK_SWITCHES_SUCCESS,
      payload: switches,
    });

    return switches;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch network switches';
    dispatch({
      type: ActionTypes.FETCH_NETWORK_SWITCHES_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

/**
 * Create a network switch
 */
export const createNetworkSwitch = async (
  dispatch: any,
  serverIp: string,
  switchName: string,
  selectedInterface: string,
  existingSwitches: any[]
): Promise<{ error?: string }> => {
  try {
    dispatch({ type: ActionTypes.CREATE_NETWORK_SWITCH_START });

    // Validation
    if (!switchName.trim()) {
      const error = 'Switch name is required';
      dispatch({
        type: ActionTypes.CREATE_NETWORK_SWITCH_FAILURE,
        payload: error,
      });
      return { error };
    }

    if (!selectedInterface) {
      const error = 'Please select an interface';
      dispatch({
        type: ActionTypes.CREATE_NETWORK_SWITCH_FAILURE,
        payload: error,
      });
      return { error };
    }

    // Check for duplicate switch names
    const duplicateSwitch = existingSwitches.find(
      (sw) => sw.name?.toLowerCase() === switchName.toLowerCase()
    );
    if (duplicateSwitch) {
      const error = `Switch name "${switchName}" already exists. Please choose a different name.`;
      dispatch({
        type: ActionTypes.CREATE_NETWORK_SWITCH_FAILURE,
        payload: error,
      });
      return { error };
    }

    const url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch/create`;

    const response = await api.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        switchName,
        selectedInterface,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const error = errorData.error || `Failed to create network switch: ${response.statusText}`;
      dispatch({
        type: ActionTypes.CREATE_NETWORK_SWITCH_FAILURE,
        payload: error,
      });
      return { error };
    }

    const result = await response.json();

    const successMessage = result.message || `Successfully created network switch: ${switchName}`;
    dispatch({
      type: ActionTypes.CREATE_NETWORK_SWITCH_SUCCESS,
      payload: successMessage,
    });

    return {};
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create network switch';
    dispatch({
      type: ActionTypes.CREATE_NETWORK_SWITCH_FAILURE,
      payload: errorMessage,
    });
    return { error: errorMessage };
  }
};

// ===================================================================
// TAP INTERFACE MANAGEMENT API SERVICES
// ===================================================================

export interface AddTapInterfaceResponse {
  state: string;
  message: string;
}

/**
 * Add TAP interface to a Vale switch
 */
export const addTapInterface = async (
  dispatch: any,
  valeName: string,
  tapInterface: string,
  serverIp?: string
): Promise<AddTapInterfaceResponse> => {
  try {
    dispatch({ type: ActionTypes.ADD_TAP_INTERFACE_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const url = `${baseUrl}/switch/vale/${valeName}/add-tap`;

    const response = await api.fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tap_interfaces: [tapInterface],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add TAP interface: ${response.statusText}`);
    }

    const result: AddTapInterfaceResponse = await response.json();

    if (result.state === 'success') {
      dispatch({
        type: ActionTypes.ADD_TAP_INTERFACE_SUCCESS,
        payload: result.message,
      });
    } else {
      throw new Error(result.message || 'Failed to add TAP interface');
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to add TAP interface';
    dispatch({
      type: ActionTypes.ADD_TAP_INTERFACE_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

export interface DetachTapInterfaceResponse {
  state: string;
  message: string;
}

/**
 * Detach TAP interface from a Vale switch
 */
export const detachTapInterface = async (
  dispatch: any,
  valeName: string,
  tapInterface: string,
  serverIp?: string,
  approver?: string
): Promise<DetachTapInterfaceResponse> => {
  try {
    dispatch({ type: ActionTypes.DETACH_TAP_INTERFACE_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    let url = `${baseUrl}/switch/vale/${valeName}/detach-tap`;

    // Add approver query param if provided
    if (approver) {
      url += `?approver=${encodeURIComponent(approver)}`;
    }

    const response = await api.fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tap_interfaces: [tapInterface],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to detach TAP interface: ${response.statusText}`);
    }

    const result: DetachTapInterfaceResponse = await response.json();

    if (result.state === 'success') {
      dispatch({
        type: ActionTypes.DETACH_TAP_INTERFACE_SUCCESS,
        payload: result.message,
      });
    } else {
      throw new Error(result.message || 'Failed to detach TAP interface');
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to detach TAP interface';
    dispatch({
      type: ActionTypes.DETACH_TAP_INTERFACE_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

export interface BulkDetachTapResponse {
  state: string;
  message: string;
  requires_user_confirmation?: boolean;
  [key: string]: any; // For analysis data
}

/**
 * Bulk detach all TAP interfaces from a Vale switch
 */
export const bulkDetachTapInterfaces = async (
  dispatch: any,
  valeName: string,
  confirmBulkDetach: boolean = false,
  serverIp?: string,
  approver?: string
): Promise<BulkDetachTapResponse> => {
  try {
    dispatch({ type: ActionTypes.BULK_DETACH_TAP_INTERFACES_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    let url = `${baseUrl}/switch/vale/${valeName}/detach-tap/bulk`;

    // Add approver query param if provided
    if (approver) {
      url += `?approver=${encodeURIComponent(approver)}`;
    }

    const requestBody = confirmBulkDetach ? { confirm_bulk_detach: true } : {};

    const response = await api.fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to bulk detach TAP interfaces: ${response.statusText}`);
    }

    const result: BulkDetachTapResponse = await response.json();

    if (result.state === 'success') {
      dispatch({
        type: ActionTypes.BULK_DETACH_TAP_INTERFACES_SUCCESS,
        payload: result.message,
      });
    } else if (result.state === 'analysis' && result.requires_user_confirmation) {
      // This is expected for the first call - return the analysis data
      dispatch({
        type: ActionTypes.BULK_DETACH_TAP_INTERFACES_SUCCESS,
        payload: 'Analysis completed, user confirmation required',
      });
    } else {
      throw new Error(result.message || 'Failed to bulk detach TAP interfaces');
    }

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to bulk detach TAP interfaces';
    dispatch({
      type: ActionTypes.BULK_DETACH_TAP_INTERFACES_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

// ===================================================================
// PARENT INTERFACE MANAGEMENT API SERVICES
// ===================================================================

export interface AddParentInterfaceResponse {
  state: string;
  message: string;
}

/**
 * Add parent interface to a Vale switch
 */
export const addParentInterface = async (
  dispatch: any,
  valeName: string,
  networkInterface: string,
  serverIp?: string
): Promise<AddParentInterfaceResponse> => {
  try {
    dispatch({ type: ActionTypes.ADD_PARENT_INTERFACE_START });

    // Use server-specific URL if serverIp is provided, otherwise use fallback
    const baseUrl = serverIp ? buildValeAPIBaseURL(serverIp) : buildFallbackAPIBaseURL();
    const url = `${baseUrl}/switch/vale/${valeName}/add-parent`;

    const response = await api.fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        network_interface: networkInterface,
        confirm_blocked: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add parent interface: ${response.statusText}`);
    }

    const result: AddParentInterfaceResponse = await response.json();

    if (result.state === 'success') {
      dispatch({
        type: ActionTypes.ADD_PARENT_INTERFACE_SUCCESS,
        payload: result.message,
      });
    } else {
      throw new Error(result.message || 'Failed to add parent interface');
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to add parent interface';
    dispatch({
      type: ActionTypes.ADD_PARENT_INTERFACE_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};
