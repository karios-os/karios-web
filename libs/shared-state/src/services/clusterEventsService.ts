/**
 * Cluster Events Service
 * Handles custom events for cluster operations
 */

import { logger } from '../utils/logger';

export interface ClusterEventDetail {
  clusterName?: string;
  vmName?: string;
  serverIp?: string;
  timestamp?: number;
  error?: string;
}

export interface ClusterEventCallbacks {
  onClusterCreated?: (clusterName: string) => void;
  onClusterDeleted?: (clusterName: string) => void;
  onVmDataRefreshNeeded?: () => void;
  onClusterVmOperation?: (operation: string, vmName?: string) => void;
}

/**
 * Setup cluster event listeners
 */
export const setupClusterEventListeners = (callbacks: ClusterEventCallbacks) => {
  const handleClusterCreated = (event: Event) => {
    const customEvent = event as CustomEvent<ClusterEventDetail>;
    const clusterName = customEvent.detail?.clusterName;
    if (clusterName) {
      logger.info(`Cluster created: ${clusterName}`);
      callbacks.onClusterCreated?.(clusterName);
    }
  };

  const handleClusterDeleted = (event: Event) => {
    const customEvent = event as CustomEvent<ClusterEventDetail>;
    const clusterName = customEvent.detail?.clusterName;
    if (clusterName) {
      logger.info(`Cluster deleted: ${clusterName}`);
      callbacks.onClusterDeleted?.(clusterName);
    }
  };

  const handleVmDataRefreshNeeded = (event: Event) => {
    logger.info('VM data refresh needed');
    callbacks.onVmDataRefreshNeeded?.();
  };

  const handleClusterVmOperation = (event: Event) => {
    const customEvent = event as CustomEvent<ClusterEventDetail>;
    const operation = customEvent.detail?.serverIp || 'unknown';
    const vmName = customEvent.detail?.vmName;
    logger.info(`Cluster VM operation: ${operation}`, { vmName });
    callbacks.onClusterVmOperation?.(operation, vmName);
  };

  // Add event listeners
  document.addEventListener('cluster:created', handleClusterCreated);
  document.addEventListener('cluster:deleted', handleClusterDeleted);
  document.addEventListener('vm:refresh-needed', handleVmDataRefreshNeeded);
  document.addEventListener('cluster:vm-operation', handleClusterVmOperation);

  // Return cleanup function
  return () => {
    document.removeEventListener('cluster:created', handleClusterCreated);
    document.removeEventListener('cluster:deleted', handleClusterDeleted);
    document.removeEventListener('vm:refresh-needed', handleVmDataRefreshNeeded);
    document.removeEventListener('cluster:vm-operation', handleClusterVmOperation);
  };
};

/**
 * Dispatch cluster created event
 */
export const dispatchClusterCreatedEvent = (clusterName: string) => {
  const event = new CustomEvent('cluster:created', {
    detail: { clusterName, timestamp: Date.now() },
  });
  document.dispatchEvent(event);
  logger.info(`Dispatched cluster:created event for ${clusterName}`);
};

/**
 * Dispatch cluster deleted event
 */
export const dispatchClusterDeletedEvent = (clusterName: string) => {
  const event = new CustomEvent('cluster:deleted', {
    detail: { clusterName, timestamp: Date.now() },
  });
  document.dispatchEvent(event);
  logger.info(`Dispatched cluster:deleted event for ${clusterName}`);
};

/**
 * Dispatch VM data refresh needed event
 */
export const dispatchVmRefreshNeededEvent = () => {
  const event = new CustomEvent('vm:refresh-needed', {
    detail: { timestamp: Date.now() },
  });
  document.dispatchEvent(event);
};

/**
 * Dispatch cluster VM operation event
 */
export const dispatchClusterVmOperationEvent = (
  operation: string,
  vmName?: string,
  serverIp?: string
) => {
  const event = new CustomEvent('cluster:vm-operation', {
    detail: { serverIp: operation, vmName, timestamp: Date.now() },
  });
  document.dispatchEvent(event);
  logger.info(`Dispatched cluster:vm-operation event`, { operation, vmName });
};
