/**
 * VMActionsDropdown Component
 * Renders VM action menu with multiple buttons (Start/Stop/Restart/Reset/PowerOff/Delete)
 * Handles disabled states, loading states, and restricted VM logic
 */
import React from 'react';
import { More } from 'iconsax-react';

export interface VMActionsDropdownProps {
  vmKey: string;
  dropdownOpen: string | null;
  isInTransition: boolean;
  isVmNameRestricted: boolean;
  isVmOn?: boolean;
  vmState?: string;
  onDropdownToggle: (key: string) => void;
  children?: React.ReactNode;
  title?: string;
}

export const VMActionsDropdown: React.FC<VMActionsDropdownProps> = ({
  vmKey,
  dropdownOpen,
  isInTransition,
  isVmNameRestricted,
  isVmOn,
  vmState,
  onDropdownToggle,
  children,
  title = 'VM actions',
}) => {
  const isOpen = dropdownOpen === vmKey;
  const isDisabled = isInTransition || isVmNameRestricted;

  return (
    <div className="relative">
      <button
        data-dropdown-button
        onClick={(e) => {
          e.stopPropagation();
          if (!isDisabled) {
            onDropdownToggle(isOpen ? '' : vmKey);
          }
        }}
        className={`p-1 rounded transition-colors duration-[1000ms] ${isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-blue-100'}`}
        disabled={isDisabled}
        title={
          isDisabled
            ? isVmNameRestricted
              ? 'VM actions not available for technical VMs'
              : 'VM is currently in transition'
            : title
        }
      >
        <More
          size={12}
          color={isDisabled ? '#9CA3AF' : '#718096'}
          variant="Outline"
          style={{ transform: 'rotate(90deg)' }}
          className={`${isDisabled ? 'opacity-50' : 'hover:opacity-70'}`}
          data-dropdown-button
        />
      </button>

      {isOpen && !isVmNameRestricted && (
        <div
          data-dropdown-menu
          className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-50"
        >
          {isInTransition && (
            <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-200 bg-yellow-50">
              {vmState === 'migrating' ? 'VM is migrating...' : 'VM in transition...'}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
};

export default VMActionsDropdown;
