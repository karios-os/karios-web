import React from 'react';
import { More } from 'iconsax-react';

interface SidebarPinButtonProps {
  isPinned: boolean;
  sidebarState: 'hidden' | 'small' | 'expanded';
  activeSection: 'control-center' | 'clusters' | null;
  lastActiveSection: 'control-center' | 'clusters';
  onPinToggle: (pinned: boolean) => void;
  onStateUpdate: (state: 'hidden' | 'small' | 'expanded') => void;
  onSetActiveSection: (section: 'control-center' | 'clusters' | null) => void;
}

/**
 * SidebarPinButton Component
 * Handles the pin/expand toggle logic for the sidebar
 * When pinned: keeps sidebar expanded
 * When unpinned: collapses sidebar on mouse leave
 */
export const SidebarPinButton: React.FC<SidebarPinButtonProps> = ({
  isPinned,
  sidebarState,
  activeSection,
  lastActiveSection,
  onPinToggle,
  onStateUpdate,
  onSetActiveSection,
}) => {
  return (
    <button
      onClick={() => {
        if (isPinned) {
          // Unpin and collapse - this will hide sidebar on mouse leave
          onPinToggle(false);
          onStateUpdate('small');
        } else {
          // Pin and expand
          onPinToggle(true);
          onStateUpdate('expanded');
        }
      }}
      title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
      className="p-1 rounded transition-all duration-200 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <More
        size={16}
        color={isPinned ? '#2563eb' : '#6B7280'}
        className="transition-colors duration-200"
      />
    </button>
  );
};

export default SidebarPinButton;
