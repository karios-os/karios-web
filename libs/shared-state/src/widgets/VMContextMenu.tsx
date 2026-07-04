/**
 * VM Context Menu Component
 * Reusable dropdown menu for VM actions
 */
import React, { useRef, useEffect } from 'react';
import {
  Monitor,
  Send2,
  Share,
  PlayCircle,
  StopCircle,
  RotateRight,
  Lock,
  Trash,
  Copy,
} from 'iconsax-react';

export interface VMContextMenuAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  isDangerous?: boolean;
  isDisabled?: boolean;
  className?: string;
}

export interface VMContextMenuProps {
  isOpen: boolean;
  position?: { x: number; y: number };
  actions: VMContextMenuAction[];
  onClose: () => void;
  vmName?: string;
  dropdownRef?: React.RefObject<HTMLDivElement>;
}

export const VMContextMenu: React.FC<VMContextMenuProps> = ({
  isOpen,
  position = { x: 0, y: 0 },
  actions,
  onClose,
  vmName,
  dropdownRef,
}) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = dropdownRef || internalRef;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose, ref]);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      <div className="py-1">
        {vmName && (
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200">
            {vmName}
          </div>
        )}
        {actions.map((action) => (
          <button
            key={action.id}
            disabled={action.isDisabled}
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
              action.isDangerous
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-100'
            } ${action.isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${action.className || ''}`}
          >
            {action.icon && <span className="w-4 h-4">{action.icon}</span>}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default VMContextMenu;
