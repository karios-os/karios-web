import React from 'react';
import { VirtualMachine } from '../../../SideBar-types';

// Helper function to check if state is locked (case-insensitive)
const isLockedState = (state: string | undefined): boolean => {
  if (!state) return false;
  return state.toLowerCase().startsWith('locked');
};

// Helper function to extract "used by" information from locked state
// Example: "Locked (smc_mlx)" -> "smc_mlx"
const getLockedUsedBy = (state: string | undefined): string | null => {
  if (!state) return null;
  const lowerState = state.toLowerCase();
  if (!lowerState.startsWith('locked')) return null;

  // Extract content from parentheses: "Locked (smc_mlx)" -> "smc_mlx"
  const match = state.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
};

interface VMActionsMenuProps {
  vm: VirtualMachine;
  isInTransition: boolean;
  onUnlock: (vmName: string) => void;
  onTogglePower: (vmName: string, isOn: boolean) => void;
  onRename: (vm: VirtualMachine) => void;
  // onClone: (vm: VirtualMachine) => void; // DISABLED
  onRestart: (vmName: string) => void;
  onReset: (vmName: string) => void;
  onPowerOff: (vmName: string) => void;
  onDelete: (vm: VirtualMachine) => void;
}

/**
 * VMActionsMenu Component
 * Renders the dropdown menu for VM actions with all available operations.
 * Actions are conditionally shown based on VM state.
 */
export const VMActionsMenu: React.FC<VMActionsMenuProps> = ({
  vm,
  isInTransition,
  onUnlock,
  onTogglePower,
  onRestart,
  onPowerOff,
  onDelete,
}) => {
  const transitionWarning = 'VM is currently in transition';

  return (
    <div
      key={vm.name}
      className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-20"
    >
      {/* Transition Warning */}
      {(isInTransition) && (
        <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-200 bg-yellow-50">
          {'VM in transition...'}
        </div>
      )}

      {/* Unlock Button - Show only for locked VMs */}
      {isLockedState(vm.state) && (
        <>
          {getLockedUsedBy(vm.state) && (
            <div className="px-3 py-1.5 text-xs text-gray-600 border-b border-gray-200 bg-gray-50">
              Currently used by: <span className="font-medium">{getLockedUsedBy(vm.state)}</span>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnlock(vm.name);
            }}
            className={`block w-full text-left px-3 py-1.5 text-sm ${
              isInTransition
                ? 'text-gray-400 cursor-not-allowed'
                : 'hover:bg-gray-100 text-blue-600'
            }`}
            disabled={isInTransition}
            title={isInTransition ? transitionWarning : ''}
          >
            Unlock
          </button>
        </>
      )}

      {/* Power Toggle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePower(vm.name, vm.state?.toLowerCase() === 'running');
        }}
        className={`block w-full text-left px-3 py-1.5 text-sm ${
          isInTransition ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-700'
        }`}
        disabled={isInTransition}
        title={isInTransition ? transitionWarning : ''}
      >
        {(() => {
          return vm.state?.toLowerCase() === 'running' ? 'Stop' : 'Start';
        })()}
      </button>

      {/* Restart Button - Show only when VM is powered on */}
      {vm.isOn && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestart(vm.name);
            }}
            className={`block w-full text-left px-3 py-1.5 text-sm ${
              isInTransition
                ? 'text-gray-400 cursor-not-allowed'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            disabled={isInTransition}
            title={isInTransition ? transitionWarning : ''}
          >
            Restart
          </button>
        </>
      )}

      {/* Power Off Button - Show only when VM is powered on */}
      {vm.isOn && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPowerOff(vm.name);
          }}
          className={`block w-full text-left px-3 py-1.5 text-sm ${
            isInTransition ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-700'
          }`}
          disabled={isInTransition}
          title={isInTransition ? transitionWarning : ''}
        >
          Power Off
        </button>
      )}

      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(vm);
        }}
        className={`block w-full text-left px-3 py-1.5 text-sm ${
          isInTransition || vm.state?.toLowerCase() === 'running'
            ? 'text-gray-400 cursor-not-allowed'
            : 'hover:bg-gray-100 text-red-600'
        }`}
        disabled={isInTransition || vm.state?.toLowerCase() === 'running'}
        title={
          isInTransition
            ? transitionWarning
            : vm.state?.toLowerCase() === 'running'
              ? 'VM must be stopped before deletion'
              : ''
        }
      >
        Delete
      </button>
    </div>
  );
};

export default VMActionsMenu;
