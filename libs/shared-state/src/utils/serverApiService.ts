import api from './interceptor';
import { ActionTypes } from './actionTypes';
import { logger } from './logger';
import envConfig from '../../../../runtime-config';

/**
 * Server API Services for LandingPage component
 * Handles all server-specific API calls that were previously in LandingPage.tsx
 */

// Type definitions
interface InventoryData {
  ip: string;
  vendor: string;
  username: string;
  password: string;
}

interface SystemInfo {
  Made: string | null;
  Model: string | null;
  ModelName: string | null;
}

interface AddinCard {
  slot: string;
  device: string;
}

interface Disk {
  device: string;
  model: string;
  firmware_version: string;
  size: string;
  health: 'Healthy' | 'Degraded' | 'Warning';
}

interface StorageController {
  name: string;
  vendor: string;
  model: string;
  disks: Disk[];
}

interface PowerSupply {
  '80_plus_rating': string;
}

// Deduplication refs for server inventory
const ongoingInventoryRequestsRef: { [key: string]: Promise<InventoryData | null> } = {};
const lastInventoryFetchTimeRef: { [key: string]: number } = {};
const inventoryLoadedRef: { [key: string]: InventoryData | null } = {};

// Deduplication refs for system info
const ongoingSystemInfoRequestsRef: { [key: string]: Promise<SystemInfo | null> } = {};
const lastSystemInfoFetchTimeRef: { [key: string]: number } = {};
const systemInfoLoadedRef: { [key: string]: SystemInfo | null } = {};

// Deduplication refs for add-in cards
const ongoingAddinCardsRequestsRef: { [key: string]: Promise<AddinCard[] | null> } = {};
const lastAddinCardsFetchTimeRef: { [key: string]: number } = {};
const addinCardsLoadedRef: { [key: string]: AddinCard[] | null } = {};

// Deduplication refs for storage cards
const ongoingStorageCardsRequestsRef: { [key: string]: Promise<StorageController[] | null> } = {};
const lastStorageCardsFetchTimeRef: { [key: string]: number } = {};
const storageCardsLoadedRef: { [key: string]: StorageController[] | null } = {};

/**
 * Fetch server inventory data with 3-layer deduplication:
 * 1. Promise caching - return ongoing request if already in progress
 * 2. Time-based debounce - prevent calls within 500ms
 * 3. Reference tracking - skip if already loaded
 */
export const fetchServerInventory = async (
  dispatch: any,
  selectedServerIp: string
): Promise<InventoryData | null> => {
  try {
    const now = Date.now();

    // Layer 1: Check if already loaded
    if (inventoryLoadedRef[selectedServerIp]) {
      logger.debug('Using cached server inventory', { selectedServerIp });
      return inventoryLoadedRef[selectedServerIp];
    }

    // Layer 2: Return ongoing request if exists
    if (ongoingInventoryRequestsRef[selectedServerIp]) {
      logger.debug('Returning ongoing inventory request', { selectedServerIp });
      return ongoingInventoryRequestsRef[selectedServerIp];
    }

    // Layer 3: Check debounce (500ms minimum between calls)
    if (
      lastInventoryFetchTimeRef[selectedServerIp] &&
      now - lastInventoryFetchTimeRef[selectedServerIp] < 500
    ) {
      logger.debug('Skipping inventory fetch within debounce period', { selectedServerIp });
      return inventoryLoadedRef[selectedServerIp] || null;
    }

    // Create the fetch request
    dispatch({ type: ActionTypes.FETCH_SERVER_INVENTORY_START });
    lastInventoryFetchTimeRef[selectedServerIp] = now;

    const requestPromise = (async () => {
      try {
        const nodeIP = envConfig().CONTROL_NODE_IP.URL;
        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${nodeIP}/api/v1/controlnode/inventory?os_ip=${selectedServerIp}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const inventoryData = data && data.length > 0 ? data[0] : null;

        // Cache the result
        inventoryLoadedRef[selectedServerIp] = inventoryData;

        dispatch({
          type: ActionTypes.FETCH_SERVER_INVENTORY_SUCCESS,
          payload: inventoryData,
        });

        return inventoryData;
      } catch (error) {
        logger.error('Error fetching server inventory', error);
        dispatch({
          type: ActionTypes.FETCH_SERVER_INVENTORY_FAILURE,
          payload: (error as Error).message,
        });
        return null;
      } finally {
        // Clear ongoing request
        delete ongoingInventoryRequestsRef[selectedServerIp];
      }
    })();

    // Store ongoing request
    ongoingInventoryRequestsRef[selectedServerIp] = requestPromise;
    return requestPromise;
  } catch (error) {
    logger.error('Error in fetchServerInventory deduplication layer', error);
    dispatch({
      type: ActionTypes.FETCH_SERVER_INVENTORY_FAILURE,
      payload: (error as Error).message,
    });
    return null;
  }
};

/**
 * Fetch server system information with 3-layer deduplication
 */
export const fetchServerSystemInfo = async (
  dispatch: any,
  selectedServerIp: string
): Promise<SystemInfo | null> => {
  try {
    const now = Date.now();

    // Layer 1: Check if already loaded
    if (systemInfoLoadedRef[selectedServerIp]) {
      logger.debug('Using cached server system info', { selectedServerIp });
      return systemInfoLoadedRef[selectedServerIp];
    }

    // Layer 2: Return ongoing request if exists
    if (ongoingSystemInfoRequestsRef[selectedServerIp]) {
      logger.debug('Returning ongoing system info request', { selectedServerIp });
      return ongoingSystemInfoRequestsRef[selectedServerIp];
    }

    // Layer 3: Check debounce (500ms minimum between calls)
    if (
      lastSystemInfoFetchTimeRef[selectedServerIp] &&
      now - lastSystemInfoFetchTimeRef[selectedServerIp] < 500
    ) {
      logger.debug('Skipping system info fetch within debounce period', { selectedServerIp });
      return systemInfoLoadedRef[selectedServerIp] || null;
    }

    // Create the fetch request
    dispatch({ type: ActionTypes.FETCH_SERVER_SYSTEM_INFO_START });
    lastSystemInfoFetchTimeRef[selectedServerIp] = now;

    const requestPromise = (async () => {
      try {
        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${selectedServerIp}${
            envConfig().CONTROL_NODE_IP.PORT
          }/api/v1/metrics/node/system/info`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch system info');
        }

        const systemData = await response.json();
        const systemInfo: SystemInfo = {
          Made: systemData.made || null,
          Model: systemData.model || null,
          ModelName: systemData.model_name || null,
        };

        // Cache the result
        systemInfoLoadedRef[selectedServerIp] = systemInfo;

        dispatch({
          type: ActionTypes.FETCH_SERVER_SYSTEM_INFO_SUCCESS,
          payload: systemInfo,
        });

        return systemInfo;
      } catch (error) {
        logger.error('Error fetching server system info', error);
        dispatch({
          type: ActionTypes.FETCH_SERVER_SYSTEM_INFO_FAILURE,
          payload: (error as Error).message,
        });
        return null;
      } finally {
        // Clear ongoing request
        delete ongoingSystemInfoRequestsRef[selectedServerIp];
      }
    })();

    // Store ongoing request
    ongoingSystemInfoRequestsRef[selectedServerIp] = requestPromise;
    return requestPromise;
  } catch (error) {
    logger.error('Error in fetchServerSystemInfo deduplication layer', error);
    dispatch({
      type: ActionTypes.FETCH_SERVER_SYSTEM_INFO_FAILURE,
      payload: (error as Error).message,
    });
    return null;
  }
};

/**
 * Fetch server add-in cards with 3-layer deduplication
 */
export const fetchServerAddinCards = async (
  dispatch: any,
  selectedServerIp: string
): Promise<AddinCard[] | null> => {
  try {
    const now = Date.now();

    // Layer 1: Check if already loaded
    if (addinCardsLoadedRef[selectedServerIp]) {
      logger.debug('Using cached server add-in cards', { selectedServerIp });
      return addinCardsLoadedRef[selectedServerIp];
    }

    // Layer 2: Return ongoing request if exists
    if (ongoingAddinCardsRequestsRef[selectedServerIp]) {
      logger.debug('Returning ongoing add-in cards request', { selectedServerIp });
      return ongoingAddinCardsRequestsRef[selectedServerIp];
    }

    // Layer 3: Check debounce (500ms minimum between calls)
    if (
      lastAddinCardsFetchTimeRef[selectedServerIp] &&
      now - lastAddinCardsFetchTimeRef[selectedServerIp] < 500
    ) {
      logger.debug('Skipping add-in cards fetch within debounce period', { selectedServerIp });
      return addinCardsLoadedRef[selectedServerIp] || null;
    }

    // Create the fetch request
    dispatch({ type: ActionTypes.FETCH_SERVER_ADDIN_CARDS_START });
    lastAddinCardsFetchTimeRef[selectedServerIp] = now;

    const requestPromise = (async () => {
      try {
        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${selectedServerIp}${
            envConfig().CONTROL_NODE_IP.PORT
          }/api/v1/metrics/node/system/addin-cards`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // If API returns empty array or null, return null
        if (!data || !Array.isArray(data) || data.length === 0) {
          dispatch({
            type: ActionTypes.FETCH_SERVER_ADDIN_CARDS_FAILURE,
            payload: 'No Add-In Card data available.',
          });
          return null;
        }

        // Cache the result
        addinCardsLoadedRef[selectedServerIp] = data;

        dispatch({
          type: ActionTypes.FETCH_SERVER_ADDIN_CARDS_SUCCESS,
          payload: data,
        });

        return data;
      } catch (error) {
        logger.error('Error fetching server add-in cards', error);
        dispatch({
          type: ActionTypes.FETCH_SERVER_ADDIN_CARDS_FAILURE,
          payload: (error as Error).message || 'Failed to fetch Add-In Card data.',
        });
        return null;
      } finally {
        // Clear ongoing request
        delete ongoingAddinCardsRequestsRef[selectedServerIp];
      }
    })();

    // Store ongoing request
    ongoingAddinCardsRequestsRef[selectedServerIp] = requestPromise;
    return requestPromise;
  } catch (error) {
    logger.error('Error in fetchServerAddinCards deduplication layer', error);
    dispatch({
      type: ActionTypes.FETCH_SERVER_ADDIN_CARDS_FAILURE,
      payload: (error as Error).message || 'Failed to fetch Add-In Card data.',
    });
    return null;
  }
};

/**
 * Fetch server storage cards with 3-layer deduplication
 */
export const fetchServerStorageCards = async (
  dispatch: any,
  selectedServerIp: string
): Promise<StorageController[] | null> => {
  try {
    const now = Date.now();

    // Layer 1: Check if already loaded
    if (storageCardsLoadedRef[selectedServerIp]) {
      logger.debug('Using cached server storage cards', { selectedServerIp });
      return storageCardsLoadedRef[selectedServerIp];
    }

    // Layer 2: Return ongoing request if exists
    if (ongoingStorageCardsRequestsRef[selectedServerIp]) {
      logger.debug('Returning ongoing storage cards request', { selectedServerIp });
      return ongoingStorageCardsRequestsRef[selectedServerIp];
    }

    // Layer 3: Check debounce (500ms minimum between calls)
    if (
      lastStorageCardsFetchTimeRef[selectedServerIp] &&
      now - lastStorageCardsFetchTimeRef[selectedServerIp] < 500
    ) {
      logger.debug('Skipping storage cards fetch within debounce period', { selectedServerIp });
      return storageCardsLoadedRef[selectedServerIp] || null;
    }

    // Create the fetch request
    dispatch({ type: ActionTypes.FETCH_SERVER_STORAGE_CARDS_START });
    lastStorageCardsFetchTimeRef[selectedServerIp] = now;

    const requestPromise = (async () => {
      try {
        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${selectedServerIp}${
            envConfig().CONTROL_NODE_IP.PORT
          }/api/v1/metrics/node/system/storageinfo`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Ensure data is an array (empty array if not)
        const storageData = Array.isArray(data) ? data : [];

        // Cache the result
        storageCardsLoadedRef[selectedServerIp] = storageData;

        dispatch({
          type: ActionTypes.FETCH_SERVER_STORAGE_CARDS_SUCCESS,
          payload: storageData,
        });

        return storageData;
      } catch (error) {
        logger.error('Error fetching server storage cards', error);
        dispatch({
          type: ActionTypes.FETCH_SERVER_STORAGE_CARDS_FAILURE,
          payload: (error as Error).message,
        });
        return null;
      } finally {
        // Clear ongoing request
        delete ongoingStorageCardsRequestsRef[selectedServerIp];
      }
    })();

    // Store ongoing request
    ongoingStorageCardsRequestsRef[selectedServerIp] = requestPromise;
    return requestPromise;
  } catch (error) {
    logger.error('Error in fetchServerStorageCards deduplication layer', error);
    dispatch({
      type: ActionTypes.FETCH_SERVER_STORAGE_CARDS_FAILURE,
      payload: (error as Error).message,
    });
    return null;
  }
};
