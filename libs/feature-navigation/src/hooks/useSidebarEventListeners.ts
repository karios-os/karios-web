import { useEffect } from 'react';
import { logger } from '../../../shared-state/src/utils/logger';

interface UseSidebarEventListenersProps {
  onClusterCreated?: (clusterName: string) => Promise<void>;
  onClusterDeleted?: (clusterName: string) => Promise<void>;
  onVmDataRefreshNeeded?: (serverIp: string, serverName: string) => Promise<void>;
  onClusterVmOperation?: (operation: string, clusterName: string) => Promise<void>;
  activeSection?: string;
  dataCenters?: any[];
}

export const useSidebarEventListeners = (props: UseSidebarEventListenersProps) => {
  const {
    onClusterCreated,
    onClusterDeleted,
    onVmDataRefreshNeeded,
    onClusterVmOperation,
    activeSection,
    dataCenters,
  } = props;

  useEffect(() => {
    const handleClusterCreated = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const createdClusterName = customEvent.detail?.clusterName;

      try {
        await onClusterCreated?.(createdClusterName);
      } catch (error) {
        logger.error('Error handling cluster created event:', error);
      }
    };

    const handleClusterDeleted = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const deletedClusterName = customEvent.detail?.clusterName;

      try {
        await onClusterDeleted?.(deletedClusterName);
      } catch (error) {
        logger.error('Error handling cluster deleted event:', error);
      }
    };

    const handleVmDataRefreshNeeded = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const serverIp = customEvent.detail?.serverIp;
      const serverName = customEvent.detail?.serverName;

      try {
        await onVmDataRefreshNeeded?.(serverIp, serverName);
      } catch (error) {
        logger.error('Error handling VM data refresh event:', error);
      }
    };

    const handleClusterVmOperation = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { operation, clusterName } = customEvent.detail || {};

      try {
        await onClusterVmOperation?.(operation, clusterName);
      } catch (error) {
        logger.error('Error handling cluster VM operation event:', error);
      }
    };

    window.addEventListener('clusterCreated', handleClusterCreated as EventListener);
    window.addEventListener('clusterDeleted', handleClusterDeleted as EventListener);
    window.addEventListener('vmDataRefreshNeeded', handleVmDataRefreshNeeded as EventListener);
    window.addEventListener('clusterVmOperation', handleClusterVmOperation as EventListener);

    return () => {
      window.removeEventListener('clusterCreated', handleClusterCreated as EventListener);
      window.removeEventListener('clusterDeleted', handleClusterDeleted as EventListener);
      window.removeEventListener('vmDataRefreshNeeded', handleVmDataRefreshNeeded as EventListener);
      window.removeEventListener('clusterVmOperation', handleClusterVmOperation as EventListener);
    };
  }, [
    onClusterCreated,
    onClusterDeleted,
    onVmDataRefreshNeeded,
    onClusterVmOperation,
    activeSection,
    dataCenters,
  ]);
};
