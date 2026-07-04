// ISO Hardware Reveal Service - API calls for building custom ISO for hardware revelation
import { ActionTypes } from './actionTypes';
import envConfig from '../../../../runtime-config';
import api from './interceptor';
import { logger } from './logger';
import type {
  IsoBuildPayload,
  IsoJobResponse,
  IsoJobStatus,
  IsoListResponse,
  IsoMountPayload,
  IsoMountResponse,
} from '../types/isoHardwareReveal.types';

/**
 * Resolve control node IP from FQDN or IP address
 * If the provided value is an FQDN, fetches the actual IP from inventory API
 * @param controlNodeIdentifier - FQDN or IP address of the control node
 * @returns Resolved IP address (or original value if resolution fails)
 */
async function resolveControlNodeIp(controlNodeIdentifier: string): Promise<string> {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // If it's already an IP, return it
  if (ipRegex.test(controlNodeIdentifier)) {
    return controlNodeIdentifier;
  }

  // If it's an FQDN, fetch the IP from inventory API
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  try {
    const inventoryResponse = await api.fetch(
      `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/controlnode/inventory?offset=0&limit=10`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (inventoryResponse.ok) {
      const inventoryData = await inventoryResponse.json();
      const inventory = Array.isArray(inventoryData) ? inventoryData : inventoryData.inventory;
      
      // Find the control node in inventory
      const controlNode = inventory?.find((node: any) => node.is_control_node === true);
      // Use os_ip for control node (not ip which is BMC IP)
      if (controlNode?.os_ip && ipRegex.test(controlNode.os_ip)) {
        logger.info('Resolved control node IP from inventory', { 
          fqdn: controlNodeIdentifier, 
          ip: controlNode.os_ip 
        });
        return controlNode.os_ip;
      } else if (controlNode?.os_ip) {
        // Even if os_ip doesn't match IP regex, use it if available
        logger.info('Using control node os_ip from inventory', { 
          fqdn: controlNodeIdentifier, 
          os_ip: controlNode.os_ip 
        });
        return controlNode.os_ip;
      }
    }
  } catch (error) {
    logger.warn('Failed to fetch control node IP from inventory, using provided value', { 
      identifier: controlNodeIdentifier,
      error 
    });
  }

  // Fallback to provided identifier if resolution fails
  return controlNodeIdentifier;
}

/**
 * Build custom ISO for hardware reveal
 * POST /api/v1/inventory/iso/build
 */
export const buildCustomIso = async (payload: IsoBuildPayload, dispatch: any) => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  // Resolve control_node_ip to actual IP if it's an FQDN
  const resolvedControlNodeIp = await resolveControlNodeIp(payload.control_node_ip);

  // Create payload with resolved IP
  const resolvedPayload = {
    ...payload,
    control_node_ip: resolvedControlNodeIp,
  };

  if (typeof dispatch === 'function') {
    dispatch({ type: ActionTypes.ISO_BUILD_START });
  }

  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/inventory/iso/build`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resolvedPayload),
      }
    );

    if (!response.ok) {
      let errorMessage = 'Failed to build ISO';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data: IsoJobResponse = await response.json();

    if (typeof dispatch === 'function') {
      dispatch({
        type: ActionTypes.ISO_BUILD_SUCCESS,
        payload: data,
      });
    }

    logger.info('ISO build started', { jobId: data.job_id });
    return data;
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to build ISO';
    logger.error('Error building ISO:', error);

    if (typeof dispatch === 'function') {
      dispatch({
        type: ActionTypes.ISO_BUILD_FAILURE,
        payload: errorMessage,
      });
    }

    throw error;
  }
};

/**
 * Get ISO job status
 * GET /api/v1/inventory/iso-job/{job_id}
 */
export const getIsoJobStatus = async (jobId: string, dispatch: any) => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  if (typeof dispatch === 'function') {
    dispatch({ type: ActionTypes.ISO_JOB_STATUS_START });
  }

  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/inventory/iso-job/${jobId}`
    );

    if (!response.ok) {
      let errorMessage = 'Failed to fetch job status';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data: IsoJobStatus = await response.json();

    if (typeof dispatch === 'function') {
      dispatch({
        type: ActionTypes.ISO_JOB_STATUS_SUCCESS,
        payload: data,
      });
    }

    logger.info('ISO job status fetched', { jobId, status: data.status });
    return data;
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to fetch job status';
    logger.error('Error fetching ISO job status:', error);

    if (typeof dispatch === 'function') {
      dispatch({
        type: ActionTypes.ISO_JOB_STATUS_FAILURE,
        payload: errorMessage,
      });
    }

    throw error;
  }
};

/**
 * Get list of available ISO files
 * GET /api/v1/inventory/isolist
 */
export const getIsoList = async (dispatch: any) => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  if (typeof dispatch === 'function') {
    dispatch({ type: ActionTypes.ISO_LIST_START });
  }

  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/inventory/isolist`
    );

    if (!response.ok) {
      let errorMessage = 'Failed to fetch ISO list';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data: IsoListResponse = await response.json();

    if (typeof dispatch === 'function') {
      dispatch({
        type: ActionTypes.ISO_LIST_SUCCESS,
        payload: data,
      });
    }

    logger.info('ISO list fetched', { count: data.isos?.length || 0 });
    return data;
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to fetch ISO list';
    logger.error('Error fetching ISO list:', error);

    if (typeof dispatch === 'function') {
      dispatch({
        type: ActionTypes.ISO_LIST_FAILURE,
        payload: errorMessage,
      });
    }

    throw error;
  }
};

/**
 * Mount ISO to BMC
 * POST /api/v1/inventory/iso/mount
 */
export const mountIso = async (payload: IsoMountPayload, dispatch: any) => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  if (typeof dispatch === 'function') {
    dispatch({ type: ActionTypes.ISO_MOUNT_START });
  }

  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/inventory/iso/mount`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      let errorMessage = 'Failed to mount ISO';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data: IsoMountResponse = await response.json();

    if (typeof dispatch === 'function') {
      dispatch({
        type: ActionTypes.ISO_MOUNT_SUCCESS,
        payload: data,
      });
    }

    logger.info('ISO mounted successfully', { isoFile: payload.iso_file });
    return data;
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to mount ISO';
    logger.error('Error mounting ISO:', error);

    if (typeof dispatch === 'function') {
      dispatch({
        type: ActionTypes.ISO_MOUNT_FAILURE,
        payload: errorMessage,
      });
    }

    throw error;
  }
};

/**
 * Mount ISO with vendor-specific support (Supermicro, Dell, or HPE)
 * Routes to the appropriate endpoint based on vendor
 */
export const mountIsoVendorAware = async (
  payload: IsoMountPayload & { vendor?: string },
  dispatch: any
) => {
  const vendor = (payload.vendor || 'supermicro').toLowerCase();
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  // Get control node IP - resolve from FQDN to IP if needed
  // Browser JavaScript cannot resolve FQDN to IP, so we fetch it from the API
  const controlNodeIp = await resolveControlNodeIp(payload.control_node_ip || controlNodeUrl);

  if (typeof dispatch === 'function') {
    dispatch({ type: ActionTypes.ISO_MOUNT_START });
  }

  try {
    let endpoint: string;
    let requestPayload: any;

    if (vendor === 'dell') {
      // Dell mount endpoint
      endpoint = `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/dell-inventory/iso/mount`;
      // For Dell, include bmc_ip and control_node_ip in addition to iso_file
      requestPayload = {
        bmc_ip: payload.bmc_ip || '',
        control_node_ip: controlNodeIp,
        iso_file: payload.iso_file,
      };
    } else if (vendor === 'hpe' || vendor === 'hp') {
      // HPE mount endpoint
      endpoint = `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/hpe-inventory/iso/mount`;
      // For HPE, include bmc_ip, control_node_ip, and iso_file (same as Dell)
      requestPayload = {
        bmc_ip: payload.bmc_ip || '',
        control_node_ip: controlNodeIp,
        iso_file: payload.iso_file,
      };
    } else {
      // Supermicro mount endpoint (default)
      endpoint = `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/inventory/iso/mount`;
      requestPayload = {
        bmc_ip: payload.bmc_ip || '',
        control_node_ip: controlNodeIp,
        iso_file: payload.iso_file,
      };
    }

    const response = await api.fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to mount ISO';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (typeof dispatch === 'function') {
      dispatch({
        type: ActionTypes.ISO_MOUNT_SUCCESS,
        payload: data,
      });
    }

    logger.info('ISO mounted successfully', {
      vendor,
      isoFile: payload.iso_file,
    });
    return data;
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to mount ISO';
    logger.error('Error mounting ISO:', { vendor: payload.vendor, error });

    if (typeof dispatch === 'function') {
      dispatch({
        type: ActionTypes.ISO_MOUNT_FAILURE,
        payload: errorMessage,
      });
    }

    throw error;
  }
};
