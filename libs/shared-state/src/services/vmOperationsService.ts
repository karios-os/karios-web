/**
 * VM Operations Service
 * Centralized service for all VM-related operations in the sidebar
 * All API calls are routed through this service (no direct API calls in components)
 */

import { toast } from 'react-toastify';
import { logger } from '../utils/logger';

export interface VMActionStatus {
  is_final: boolean;
  error: boolean;
  status: string;
}

export interface VMOperationCallbacks {
  onStatusUpdate?: (status: VMActionStatus) => void;
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
  onCreateConsole?: (serverIp: string, vmName: string) => Promise<void>;
  onRefreshServer?: (serverIp: string) => Promise<void>;
  onRefreshCluster?: (forceRefresh?: boolean) => Promise<void>;
}

/**
 * Handles VM power toggle (start/stop)
 * @param vmName - Name of the VM
 * @param currentIsOn - Current power state
 * @param serverIp - Server IP address
 * @param performVmActionWebSocket - Callback from app state
 * @param callbacks - Operation callbacks
 */
export const handleVmPowerToggle = async (
  vmName: string,
  currentIsOn: boolean,
  serverIp: string,
  performVmActionWebSocket: (
    ip: string,
    name: string,
    action: string,
    callback: any
  ) => Promise<void>,
  callbacks: VMOperationCallbacks
) => {
  const action = currentIsOn ? 'stop' : 'start';

  try {
    await performVmActionWebSocket(serverIp, vmName, action, async (status: VMActionStatus) => {
      callbacks.onStatusUpdate?.(status);

      if (status.is_final) {
        if (status.error) {
          logger.error(`VM ${action} failed:`, status.status);
        } else {
          const statusText = status.status.toLowerCase();
          if (statusText.includes('running') && callbacks.onCreateConsole) {
            try {
              await callbacks.onCreateConsole(serverIp, vmName);
            } catch (consoleError) {
              logger.warn('Failed to create console after VM start:', consoleError);
            }
          }

          callbacks.onSuccess?.(status.status);
          callbacks.onRefreshServer?.(serverIp);
        }
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error(`Error toggling VM power:`, error);
    callbacks.onError?.(errorMessage);
    callbacks.onRefreshServer?.(serverIp);
  }
};

/**
 * Handles VM restart operation
 */
export const handleVmRestart = async (
  vmName: string,
  serverIp: string,
  performVmActionWebSocket: (
    ip: string,
    name: string,
    action: string,
    callback: any
  ) => Promise<void>,
  callbacks: VMOperationCallbacks
) => {
  try {
    await performVmActionWebSocket(serverIp, vmName, 'restart', async (status: VMActionStatus) => {
      callbacks.onStatusUpdate?.(status);

      if (status.is_final) {
        if (status.error) {
          logger.error('VM restart failed:', status.status);
        } else {
          callbacks.onSuccess?.('VM restarted successfully');
          callbacks.onRefreshServer?.(serverIp);
        }
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Error restarting VM:', error);
    callbacks.onError?.(errorMessage);
  }
};

/**
 * Handles VM reset operation (hard reset)
 */
export const handleVmReset = async (
  vmName: string,
  serverIp: string,
  performVmActionWebSocket: (
    ip: string,
    name: string,
    action: string,
    callback: any
  ) => Promise<void>,
  callbacks: VMOperationCallbacks
) => {
  try {
    await performVmActionWebSocket(serverIp, vmName, 'reset', async (status: VMActionStatus) => {
      callbacks.onStatusUpdate?.(status);

      if (status.is_final) {
        if (status.error) {
          logger.error('VM reset failed:', status.status);
        } else {
          callbacks.onSuccess?.('VM reset successfully');
          callbacks.onRefreshServer?.(serverIp);
        }
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Error resetting VM:', error);
    callbacks.onError?.(errorMessage);
  }
};

/**
 * Handles VM force power off operation
 */
export const handleVmForcePowerOff = async (
  vmName: string,
  serverIp: string,
  performVmActionWebSocket: (
    ip: string,
    name: string,
    action: string,
    callback: any
  ) => Promise<void>,
  callbacks: VMOperationCallbacks
) => {
  try {
    await performVmActionWebSocket(
      serverIp,
      vmName,
      'force-stop',
      async (status: VMActionStatus) => {
        callbacks.onStatusUpdate?.(status);

        if (status.is_final) {
          if (status.error) {
            logger.error('VM force power off failed:', status.status);
          } else {
            callbacks.onSuccess?.('VM forced off successfully');
            callbacks.onRefreshServer?.(serverIp);
          }
        }
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Error forcing VM power off:', error);
    callbacks.onError?.(errorMessage);
  }
};

/**
 * Validates VM before performing operations
 */
export const isVmValidForOperation = (vmName: string, vmStatus?: string): boolean => {
  if (!vmName || vmName.trim() === '') {
    logger.warn('Invalid VM name provided');
    return false;
  }
  return true;
};
