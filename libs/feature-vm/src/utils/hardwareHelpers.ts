/**
 * Helper functions for VM hardware management
 */

/**
 * Determines if a VM is part of a cluster based on its name
 * Supports cluster prefixes: op-, ub-, k8s-, k3s-, om-, an-, omniserver
 */
export const isClusterVM = (vmName: string): boolean => {
  if (
    vmName.startsWith('op-') ||
    vmName.startsWith('ub-') ||
    vmName.startsWith('k8s-') ||
    vmName.startsWith('k3s-') ||
    vmName.startsWith('om-') ||
    vmName.startsWith('an-')
  ) {
    return true;
  }

  if (vmName.toLowerCase().startsWith('omniserver')) {
    return true;
  }

  return false;
};

/**
 * Extracts the cluster prefix from a VM name
 * Returns the prefix (e.g., 'op-', 'ub-', 'omniserver', etc.) or empty string if not found
 */
export const getClusterPrefix = (vmName: string): string => {
  const lowerName = vmName.toLowerCase();
  if (lowerName.startsWith('op-')) return 'op-';
  if (lowerName.startsWith('ub-')) return 'ub-';
  if (lowerName.startsWith('k8s-')) return 'k8s-';
  if (lowerName.startsWith('k3s-')) return 'k3s-';
  if (lowerName.startsWith('om-')) return 'om-';
  if (lowerName.startsWith('an-')) return 'an-';
  if (lowerName.startsWith('omniserver')) return 'omniserver';
  return '';
};

/**
 * Extracts the cluster name from a VM name (without prefix)
 * Examples: op-test-master -> test, ub-ubuntu-ms -> ubuntu, k8s-production-worker1 -> production
 */
export const getClusterName = (vmName: string): string => {
  if (!isClusterVM(vmName)) return '';
  const prefix = getClusterPrefix(vmName);
  if (!prefix) return '';

  if (prefix === 'omniserver') {
    return '';
  }

  const withoutPrefix = vmName.substring(prefix.length);
  const parts = withoutPrefix.split('-');

  return parts[0] || '';
};

/**
 * Gets the full cluster name including prefix for API calls
 * Examples: op-test-master -> op-test, ub-ubuntu-ms -> ub-ubuntu, an-prod-1 -> an-prod
 */
export const getFullClusterName = (vmName: string): string => {
  if (!isClusterVM(vmName)) return '';
  const prefix = getClusterPrefix(vmName);

  if (prefix === 'omniserver') {
    return 'omni';
  }

  const baseName = getClusterName(vmName);
  if (!prefix || !baseName) return '';

  return prefix + baseName;
};

/**
 * Returns the hex color code for a given migration/conversion status
 */
export const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'complete':
    case 'completed':
      return '#10b981'; // green
    case 'thin_converting':
    case 'raw_converting':
    case 'converting':
      return '#3b82f6'; // blue
    case 'transferred':
    case 'transferring':
      return '#8b5cf6'; // purple
    case 'moving_to_zfs_volume':
      return '#06b6d4'; // cyan
    case 'failed':
    case 'error':
      return '#ef4444'; // red
    case 'partial':
    case 'warning':
      return '#f59e0b'; // yellow
    case 'progress':
    case 'in_progress':
      return '#6366f1'; // indigo
    default:
      return '#6b7280'; // gray
  }
};

/**
 * Returns the user-friendly display text for a given migration/conversion status
 */
export const getStatusDisplayText = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'thin_converting':
      return 'Converting to Thin';
    case 'raw_converting':
      return 'Converting to RAW';
    case 'transferred':
      return 'Downloaded';
    case 'transferring':
      return 'Transferring';
    case 'moving_to_zfs_volume':
      return 'Moving to ZFS';
    case 'complete':
    case 'completed':
      return 'Completed';
    case 'failed':
    case 'error':
      return 'Failed';
    case 'partial':
      return 'Partial';
    case 'progress':
    case 'in_progress':
      return 'In Progress';
    default:
      return status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown';
  }
};
