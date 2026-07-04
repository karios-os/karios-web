/**
 * Fetches Bhyve logs for a VM with optional limit/offset.
 * @param {string} serverIp - The IP address of the server.
 * @param {string} vmName - The name of the VM.
 * @param {object} options - { limit?: number, offset?: number }
 * @returns {Promise<{ log: string[], total_lines?: number, error?: string }>} - The log lines and meta info.
 */
/**
 * @param {string} serverIp
 * @param {string} vmName
 * @param {{ limit?: number, offset?: number }} options
 */
export const fetchBhyveLogs = async (
  serverIp,
  vmName,
  options: { limit?: number; offset?: number } = {}
) => {
  if (!serverIp || !vmName) throw new Error('Server IP and VM name are required');
  const params = new URLSearchParams();
  if (options.limit != null) params.append('limit', String(options.limit));
  if (options.offset != null) params.append('offset', String(options.offset));
  const url = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${encodeURIComponent(vmName)}/log${params.toString() ? `?${params}` : ''}`;
  try {
    const response = await interceptorApi.fetch(url);
    if (response.status === 404) {
      const data = await response.json().catch(() => ({}));
      return { log: [], error: data.error || 'Log file or VM not found' };
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Failed to fetch logs: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    return { log: [], error: err.message || 'Unknown error' };
  }
};
// src/services/apiService.js
// This file will encapsulate all backend communication logic.

import axios from 'axios';
import envConfig from '../../../../runtime-config';
import { api as interceptorApi, logger } from '@karios-monorepo/shared-state';

// Configuration flag to toggle between dummy server and actual API
const USE_DUMMY_SERVER = false;

// Base URLs for dummy and actual servers
const DUMMY_SERVER_BASE_URL = 'http://localhost:3000';
const ACTUAL_SERVER_BASE_URL = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}`;

// Create an Axios instance with the appropriate base URL
const api = axios.create({
  baseURL: USE_DUMMY_SERVER ? DUMMY_SERVER_BASE_URL : ACTUAL_SERVER_BASE_URL,
});

export default api;

const BASE_URL = '/api/v1/compute'; // Adjust if your base URL is different or configured elsewhere

/**
 * Fetches the list of VMs for a given server IP.
 * @param {string} serverIp - The IP address of the server.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of VM objects.
 * @throws {Error} - Throws an error if the fetch operation fails.
 */
export const fetchVMsList = async (serverIp) => {
  if (!serverIp) {
    logger.error('fetchVMsList: serverIp is required');
    throw new Error('Server IP is required to fetch VMs.');
  }
  try {
    // The original code uses http://${serverIp}:${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list
    // We should make sure the 'api.fetch' utility handles the protocol and port, or adjust accordingly.
    // For now, assuming api.fetch can take the full URL or a relative path if a base URL is configured in the interceptor.
    const response = await interceptorApi.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}${BASE_URL}/vms/list`
    );
    if (!response.ok) {
      // Assuming 'api.fetch' returns a response object similar to native fetch
      const errorData = await response
        .json()
        .catch(() => ({ message: 'Failed to parse error response' }));
      logger.error('Error fetching VMs', { status: response.status, errorData, serverIp });
      throw new Error(
        errorData.message ||
          `Failed to fetch VMs for server ${serverIp}. Status: ${response.status}`
      );
    }
    const vms = await response.json();
    return vms;
  } catch (error) {
    logger.error(`Error in fetchVMsList for IP ${serverIp}`, error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

// Add other API functions as needed, for example:
// export const fetchDatacenters = async () => { ... };
// export const createVm = async (vmConfig) => { ... };
// export const manageVmPowerState = async (vmId, action) => { ... };

// Placeholder for fetching initial data for all data centers and servers
// This would likely be a more complex call in a real scenario, or multiple calls.
// Based on App.jsx, it seems dataCenters structure was initially hardcoded and then VMs were fetched for a default/selected server.
// We'll need a strategy for how initial data (datacenters, servers) is loaded if not from a single endpoint.

export const getInitialAppData = async (defaultServerIp) => {
  // This is a simplified version. In a real app, you might fetch datacenters, then servers, then VMs for a default server.
  // For now, we'll just fetch VMs for the default server as per the existing logic in App.jsx
  // The transformation to the dataCenters structure will happen in the context or App.jsx initially.
  if (!defaultServerIp) {
    logger.warn('getInitialAppData: No default server IP provided. Skipping initial VM fetch.');
    return { vms: [], initialDataCenters: [] }; // Return empty or predefined structure
  }
  try {
    const vms = await fetchVMsList(defaultServerIp);
    // The transformation logic from App.jsx will need to be adapted here or in the context
    // For now, just returning raw VMs and a placeholder for datacenters
    // This part needs to align with how dataCenters state is structured and populated.
    const initialDataCenters = [
      {
        id: 1,
        name: 'Control Node', // This was hardcoded in App.jsx
        isOpen: true,
        servers: [
          {
            id: 101,
            name: 'Node1', // This was hardcoded
            isOpen: true,
            ip: defaultServerIp,
            vms: vms.map((vm, index) => ({
              id: `vm-${index}`,
              name: vm.name,
              datastore: vm.datastore,
              state: vm.state,
              isOn: vm.state === 'Running',
            })),
          },
          {
            id: 102,
            name: 'Node2', // This was hardcoded
            isOpen: false,
            ip: '192.168.116.114', // Example, needs to be dynamic or configured
            vms: [],
          },
        ],
      },
    ];
    return { vms, initialDataCenters };
  } catch (error) {
    logger.error('Error fetching initial app data', error);
    throw error;
  }
};

// You might also need functions for authentication, user management, role management etc.
// For example:
// export const loginUser = async (credentials) => { ... }
// export const fetchUserRoles = async () => { ... }
