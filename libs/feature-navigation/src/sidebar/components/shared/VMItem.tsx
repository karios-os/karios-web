import React from 'react';
import { More } from 'iconsax-react';
import { VirtualMachine, ServerNode } from '../../../SideBar-types';
import { VMStatusIndicator, VMNameDisplay, VMActionsMenu } from './index';
import { shouldHighlightVmFromUrl } from '../../utils/sidebarHelpers';
import { isVmNameRestricted } from '../../../utils/vmHandlers';

interface VMItemProps {
  vm: VirtualMachine;
  server: ServerNode;
  selectedVm: VirtualMachine | null;
  newServerDropdownSelected: boolean;
  dropdownVmName: string | null;
  pathname: string;
  extraClassName?: string;
  dropdownRef?: React.RefObject<HTMLDivElement>;
  isVmInAnyTransition: (vmName: string, state: string) => boolean;
  getVmStatusColor: (vm: VirtualMachine) => string;
  onToggleVmDropdown: (vmName: string) => void;
  onVmClick: (vm: VirtualMachine, server: ServerNode) => void;
  onUnlock: (vmName: string) => void;
  onTogglePower: (vmName: string, isOn: boolean) => void;
  onRename: (vm: VirtualMachine) => void;
  onClone: (vm: VirtualMachine) => void;
  onRestart: (vmName: string) => void;
  onReset: (vmName: string) => void;
  onPowerOff: (vmName: string) => void;
  onDelete: (vm: VirtualMachine) => void;
}

export const VMItem: React.FC<VMItemProps> = ({
  vm,
  server,
  selectedVm,
  newServerDropdownSelected,
  dropdownVmName,
  pathname,
  extraClassName = '',
  dropdownRef,
  isVmInAnyTransition,
  getVmStatusColor,
  onToggleVmDropdown,
  onVmClick,
  onUnlock,
  onTogglePower,
  onRename,
  onClone,
  onRestart,
  onReset,
  onPowerOff,
  onDelete,
}) => {
  const isSelected =
    selectedVm?.id === vm.id &&
    (!newServerDropdownSelected || shouldHighlightVmFromUrl(server, vm, pathname));
  const isRestricted = isVmNameRestricted(vm.name);
  const inTransition = isVmInAnyTransition(vm.name, vm.state);

  return (
    <div
      key={vm.id}
      className={`flex items-center justify-between mt-1 p-1 rounded border-l-3 transition-colors ${extraClassName} ${
        isSelected
          ? 'bg-blue-50 text-karios-blue border-l-blue-600'
          : 'border-l-transparent hover:bg-blue-100'
      }`}
    >
      <div
        className="flex items-center gap-1 sm:gap-2 flex-grow cursor-pointer min-w-0"
        onClick={() => onVmClick(vm, server)}
      >
        <VMStatusIndicator
          vm={vm}
          isInTransition={inTransition}
          getVmStatusColor={(vmName, vmState) => getVmStatusColor(vm)}
        />
        <div className="truncate" title={vm.name}>
          <VMNameDisplay vm={vm} isSelected={isSelected} />
        </div>
      </div>

      <div className="relative" ref={dropdownVmName === vm.name ? dropdownRef : null}>
        <More
          className={`cursor-pointer w-3 h-3 sm:w-4 sm:h-4 ${
            inTransition || isRestricted ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600'
          }`}
          color={inTransition || isRestricted ? '#9CA3AF' : '#718096'}
          variant="Outline"
          style={{ transform: 'rotate(90deg)' }}
          data-testid="more-icon"
          onClick={(e) => {
            e.stopPropagation();
            if (!inTransition && !isRestricted) {
              onToggleVmDropdown(vm.name);
            }
          }}
        />
        {dropdownVmName === vm.name && !isRestricted && (
          <VMActionsMenu
            vm={vm}
            isInTransition={inTransition}
            onUnlock={() => onUnlock(vm.name)}
            onTogglePower={(vmName, isOn) => onTogglePower(vmName, isOn)}
            onRename={() => onRename(vm)}
            // onClone={() => onClone(vm)} // DISABLED
            onRestart={() => onRestart(vm.name)}
            onReset={() => onReset(vm.name)}
            onPowerOff={() => onPowerOff(vm.name)}
            onDelete={() => onDelete(vm)}
          />
        )}
      </div>
    </div>
  );
};
