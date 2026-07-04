import api from './interceptor';
import { ActionTypes } from './actionTypes';
import envConfig from '../../../../runtime-config';

// Types for control center operations
export interface ScannedNode {
  ip: string;
  vendor: string;
  hostname?: string;
  mac_address?: string;
}

export interface InventoryNode {
  ip: string;
  vendor: string;
  username?: string;
  password?: string;
  os_ip?: string;
  os_hostname?: string;
  os_username?: string;
  os_password?: string;
  stage?: string;
  is_control_node?: boolean;
}

export interface CredentialsData {
  username: string;
  password: string;
}

export interface ProvisionData {
  [key: string]: any;
}


// Configure node
export const configureNode = async (dispatch: any, nodeData: InventoryNode, approver?: string) => {
  dispatch({ type: ActionTypes.CONTROL_CENTER_CONFIGURE_NODE_START, payload: nodeData.ip });

  try {
    const requestBody = {
      node_ip: nodeData.os_ip,
      node_username: nodeData.os_username,
      node_password: nodeData.os_password,
    };

    let apiUrl = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/controlnode/configurenode?controlNodeIp=${envConfig().CONTROL_NODE_IP.URL}`;
    if (approver) {
      const urlParams = new URLSearchParams({ approver });
      apiUrl = `${apiUrl}&${urlParams.toString()}`;
    }

    const response = await api.fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseJson = await response.json();

    if (!response.ok) {
      const errorData = responseJson;
      throw new Error(errorData.error || 'Failed to configure node.');
    }

    dispatch({
      type: ActionTypes.CONTROL_CENTER_CONFIGURE_NODE_SUCCESS,
      payload: {
        nodeIp: nodeData.ip,
        jobId: responseJson.job_id,
      },
    });

    return responseJson;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to configure node';
    dispatch({
      type: ActionTypes.CONTROL_CENTER_CONFIGURE_NODE_FAILURE,
      payload: { nodeIp: nodeData.ip, error: errorMessage },
    });
    throw error;
  }
};

// Override BMC status
export const overrideBmcStatus = async (dispatch: any, bmcIp: string) => {
  dispatch({ type: ActionTypes.CONTROL_CENTER_OVERRIDE_BMC_START, payload: bmcIp });

  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/controlnode/bmc/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bmc_ip: bmcIp,
          status: 'REGISTERED',
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update BMC status.');
    }

    dispatch({ type: ActionTypes.CONTROL_CENTER_OVERRIDE_BMC_SUCCESS, payload: bmcIp });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update BMC status';
    dispatch({
      type: ActionTypes.CONTROL_CENTER_OVERRIDE_BMC_FAILURE,
      payload: { bmcIp, error: errorMessage },
    });
    throw error;
  }
};

// Scan subnet for control center
export const scanSubnetForControlCenter = async (dispatch: any, subnet: string) => {
  dispatch({ type: ActionTypes.CONTROL_CENTER_SCAN_START, payload: subnet });

  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/controlnode/scan`,
      {
        method: 'POST',
        body: JSON.stringify({ subnet }),
      }
    );

    if (!response.ok) {
      throw new Error(`Scan failed with status: ${response.status}`);
    }

    const scannedData = await response.json();

    if (scannedData === null || scannedData === undefined) {
      dispatch({
        type: ActionTypes.CONTROL_CENTER_SCAN_SUCCESS,
        payload: {
          nodes: [],
          message: "No nodes found in the specified subnet or subnet doesn't exist",
        },
      });
      return {
        nodes: [],
        message: "No nodes found in the specified subnet or subnet doesn't exist",
      };
    }

    if (Array.isArray(scannedData) && scannedData.length === 0) {
      dispatch({
        type: ActionTypes.CONTROL_CENTER_SCAN_SUCCESS,
        payload: { nodes: [], message: 'No nodes found in the specified subnet' },
      });
      return { nodes: [], message: 'No nodes found in the specified subnet' };
    }

    if (Array.isArray(scannedData)) {
      dispatch({
        type: ActionTypes.CONTROL_CENTER_SCAN_SUCCESS,
        payload: { nodes: scannedData, message: null },
      });
      return { nodes: scannedData, message: null };
    } else {
      throw new Error('Unexpected response format from scan API');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to scan subnet';
    dispatch({ type: ActionTypes.CONTROL_CENTER_SCAN_FAILURE, payload: errorMessage });
    throw error;
  }
};

// Add node to inventory
export const addNodeToInventory = async (
  dispatch: any,
  nodeData: ScannedNode & CredentialsData
) => {
  dispatch({ type: ActionTypes.CONTROL_CENTER_ADD_TO_INVENTORY_START, payload: nodeData.ip });

  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/controlnode/inventory?controlNodeIp=${envConfig().CONTROL_NODE_IP.URL}`,
      {
        method: 'POST',
        body: JSON.stringify(nodeData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add node to inventory');
    }

    dispatch({ type: ActionTypes.CONTROL_CENTER_ADD_TO_INVENTORY_SUCCESS, payload: nodeData.ip });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to add node to inventory';
    dispatch({
      type: ActionTypes.CONTROL_CENTER_ADD_TO_INVENTORY_FAILURE,
      payload: { nodeIp: nodeData.ip, error: errorMessage },
    });
    throw error;
  }
};

// Delete node from inventory
export const deleteNodeFromInventory = async (dispatch: any, bmcIp: string, approver?: string) => {
  dispatch({ type: ActionTypes.CONTROL_CENTER_DELETE_FROM_INVENTORY_START, payload: bmcIp });

  try {
    let apiUrl = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/controlnode/inventory`;
    if (approver) {
      const urlParams = new URLSearchParams({ approver });
      apiUrl = `${apiUrl}?${urlParams.toString()}`;
    }

    const response = await api.fetch(apiUrl, {
      method: 'DELETE',
      body: JSON.stringify({
        bmc_ip: bmcIp,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete node from inventory');
    }

    dispatch({ type: ActionTypes.CONTROL_CENTER_DELETE_FROM_INVENTORY_SUCCESS, payload: bmcIp });
    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to delete node from inventory';
    dispatch({
      type: ActionTypes.CONTROL_CENTER_DELETE_FROM_INVENTORY_FAILURE,
      payload: { bmcIp, error: errorMessage },
    });
    throw error;
  }
};

// Set BMC credentials
export const setBmcCredentials = async (
  dispatch: any,
  credentialsData: {
    ip: string;
    vendor: string;
    username: string;
    password: string;
  }
) => {
  dispatch({ type: ActionTypes.CONTROL_CENTER_SET_BMC_CREDS_START, payload: credentialsData.ip });

  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/controlnode/setbmccreds`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ip: credentialsData.ip,
          vendor: credentialsData.vendor,
          username: credentialsData.username,
          password: credentialsData.password,
          provisioned: true,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update credentials.');
    }

    const responseData = await response.json();
    dispatch({
      type: ActionTypes.CONTROL_CENTER_SET_BMC_CREDS_SUCCESS,
      payload: { ip: credentialsData.ip, data: responseData },
    });

    return responseData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update credentials';
    dispatch({
      type: ActionTypes.CONTROL_CENTER_SET_BMC_CREDS_FAILURE,
      payload: { ip: credentialsData.ip, error: errorMessage },
    });
    throw error;
  }
};

// PiKVM hardware reveal
export const pikvmHardwareReveal = async (
  dispatch: any,
  revealData: {
    pikvmIP: string;
    username: string;
    password: string;
  }
) => {
  dispatch({ type: ActionTypes.CONTROL_CENTER_PIKVM_REVEAL_START, payload: revealData.pikvmIP });

  try {
    const payload = {
      controlNodeIp: envConfig().CONTROL_NODE_IP.URL,
      pikvmIP: revealData.pikvmIP,
      username: revealData.username,
      password: revealData.password,
    };

    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/pikvm/reveal`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to start hardware reveal process');
    }

    const result = await response.json();
    dispatch({
      type: ActionTypes.CONTROL_CENTER_PIKVM_REVEAL_SUCCESS,
      payload: { pikvmIP: revealData.pikvmIP, jobId: result.job_id },
    });

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to start hardware reveal process';
    dispatch({
      type: ActionTypes.CONTROL_CENTER_PIKVM_REVEAL_FAILURE,
      payload: { pikvmIP: revealData.pikvmIP, error: errorMessage },
    });
    throw error;
  }
};
