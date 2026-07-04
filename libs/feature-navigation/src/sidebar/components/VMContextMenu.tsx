import React from 'react';
import type { VirtualMachine } from '../../SideBar-types';

interface VMContextMenuProps {
  vm: VirtualMachine;
  isInTransition: boolean;
  onPower: (vmName: string, isOn: boolean) => void;
  onRename: (vm: VirtualMachine) => void;
  // onClone: (vm: VirtualMachine) => void; // DISABLED
  onRestart: (vmName: string) => void;
  onReset: (vmName: string) => void;
  onPowerOff: (vmName: string) => void;
  onDelete: (vm: VirtualMachine) => void;
  onUnlock: (vmName: string) => void;
}

export const VMContextMenu: React.FC<VMContextMenuProps> = ({
  vm,
  isInTransition,
  onRestart,
  onDelete,
  onUnlock,
}) => {
  const isDisabled = isInTransition;

  return (
    <div
      data-dropdown-menu
      className="absolute right-0 top-6 bg-white border border-gray-300 rounded shadow-lg z-10 min-w-max text-xs"
    >

      {/* Divider */}
      <div className="border-t border-gray-200 my-1" />

      {/* Restart - Show only when VM is powered on */}
      {vm.isOn && (
        <button
          onClick={() => onRestart(vm.name)}
          disabled={isDisabled}
          className="block w-full text-left px-3 py-1.5 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Restart
        </button>
      )}
      {/* Unlock */}
      <button
        onClick={() => onUnlock(vm.name)}
        disabled={isDisabled}
        className="block w-full text-left px-3 py-1.5 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Unlock
      </button>

      {/* Divider */}
      <div className="border-t border-gray-200 my-1" />

      {/* Delete */}
      <button
        onClick={() => onDelete(vm)}
        disabled={isDisabled}
        className="block w-full text-left px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-red-600"
      >
        Delete
      </button>
    </div>
  );
};

export default VMContextMenu;
