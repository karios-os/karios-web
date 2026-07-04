import React from 'react';
import { VirtualMachine } from '../SideBar-types';

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
  onRename,
  // onClone, // DISABLED
  onRestart,
  onReset,
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
      {vm.state && vm.state.toLowerCase().startsWith('locked') && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnlock(vm.name);
          }}
          className={`block w-full text-left px-3 py-1.5 text-sm ${
            isInTransition ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 text-blue-600'
          }`}
          disabled={isInTransition}
          title={isInTransition ? transitionWarning : ''}
        >
          Unlock
        </button>
      )}

      {/* Power Toggle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePower(vm.name, vm.state === 'Running');
        }}
        className={`block w-full text-left px-3 py-1.5 text-sm ${
          isInTransition ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-700'
        }`}
        disabled={isInTransition}
        title={isInTransition ? transitionWarning : ''}
      >
        {vm.state === 'Running' ? 'Stop' : 'Start'}
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
          isInTransition || vm.state === 'Running'
            ? 'text-gray-400 cursor-not-allowed'
            : 'hover:bg-gray-100 text-red-600'
        }`}
        disabled={isInTransition || vm.state === 'Running'}
        title={
          isInTransition
            ? transitionWarning
            : vm.state === 'Running'
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
