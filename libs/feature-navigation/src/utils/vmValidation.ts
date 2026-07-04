/**
 * VM Validation Utilities
 * Functions for validating VM names, clone operations, and related checks
 */
import { VirtualMachine, ServerNode, DataCenter } from '../SideBar-types';

/**
 * Validate VM name for rename operations
 */
export const validateVmNameForRename = (
  name: string,
  currentServerIp: string | null,
  currentRenameVm: VirtualMachine | null,
  dataCenters: DataCenter[]
): string => {
  if (/\s/.test(name)) return 'Spaces are not allowed in VM names.';
  if (/[.@_:]/.test(name)) return 'Special characters (@, ., _, :) are not allowed in VM names.';
  if (/^-|-$/.test(name)) return 'Hyphen cannot be the first or last character.';

  // Check for duplicate names on the same server
  if (name?.trim() && currentServerIp && dataCenters && Array.isArray(dataCenters)) {
    // Find the current server in the dataCenters
    const currentServerData = dataCenters
      .flatMap((dataCenter: DataCenter) => dataCenter.servers)
      .find((server: ServerNode) => server.ip === currentServerIp);

    // Check if VM name exists in the current server's VM list (excluding the current VM being renamed)
    if (
      currentServerData &&
      Array.isArray(currentServerData.vms) &&
      currentServerData.vms.some(
        (vm: VirtualMachine) =>
          vm?.name?.toLowerCase() === name.trim().toLowerCase() && vm.name !== currentRenameVm?.name // Exclude the current VM being renamed
      )
    ) {
      return 'VM name already exists on this server. Please enter a unique name.';
    }
  }
  return '';
};

/**
 * Validate VM name for clone operations
 */
export const validateVmNameForClone = (
  name: string,
  currentServerIp: string | null,
  dataCenters: DataCenter[]
): string => {
  if (!name?.trim()) return 'VM name is required.';
  if (/\s/.test(name)) return 'Spaces are not allowed in VM names.';
  if (/[.@_:]/.test(name)) return 'Special characters (@, ., _, :) are not allowed in VM names.';
  if (/^-|-$/.test(name)) return 'Hyphen cannot be the first or last character.';
  if (name.length > 63) return 'VM name cannot exceed 63 characters.';

  // Check for duplicate names on the same server
  if (currentServerIp && dataCenters && Array.isArray(dataCenters)) {
    const currentServerData = dataCenters
      .flatMap((dataCenter: DataCenter) => dataCenter.servers)
      .find((server: ServerNode) => server.ip === currentServerIp);

    if (
      currentServerData &&
      Array.isArray(currentServerData.vms) &&
      currentServerData.vms.some(
        (vm: VirtualMachine) => vm?.name?.toLowerCase() === name.trim().toLowerCase()
      )
    ) {
      return 'VM name already exists on this server.';
    }
  }

  return '';
};

/**
 * Check if a VM name format is valid
 */
export const isValidVmName = (name: string): boolean => {
  if (!name || /\s/.test(name)) return false;
  if (/[.@_:]/.test(name)) return false;
  if (/^-|-$/.test(name)) return false;
  if (name.length > 63) return false;
  return true;
};

/**
 * Sanitize VM name input
 */
export const sanitizeVmName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/[.@_:]/g, '-'); // Replace special chars with hyphen
};

/**
 * Check if two VMs have the same name (case-insensitive)
 */
export const isSameVmName = (name1: string, name2: string): boolean => {
  return name1?.toLowerCase().trim() === name2?.toLowerCase().trim();
};

/**
 * Validate console creation prerequisites
 */
export const canCreateConsole = (vm: VirtualMachine): { can: boolean; reason?: string } => {
  if (!vm) return { can: false, reason: 'VM not found' };

  // Add any additional validation rules here
  return { can: true };
};

/**
 * Check if VM is in a valid state for operations
 */
export const isVmOperationAllowed = (
  vm: VirtualMachine,
  operation: 'power' | 'restart' | 'reset' | 'clone' | 'delete' | 'rename'
): { allowed: boolean; reason?: string } => {
  if (!vm) return { allowed: false, reason: 'VM not found' };

  switch (operation) {
    case 'power':
      return { allowed: true };
    case 'restart':
      return {
        allowed: vm.status?.toUpperCase() === 'RUNNING' ? true : false,
        reason: 'VM must be running',
      };
    case 'reset':
      return {
        allowed: vm.status?.toUpperCase() === 'RUNNING' ? true : false,
        reason: 'VM must be running',
      };
    case 'clone':
      return { allowed: true };
    case 'delete':
      return { allowed: true };
    case 'rename':
      return { allowed: true };
    default:
      return { allowed: false, reason: 'Unknown operation' };
  }
};
