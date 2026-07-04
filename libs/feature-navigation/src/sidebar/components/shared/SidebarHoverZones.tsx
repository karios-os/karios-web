import React, { ReactNode } from 'react';

interface SidebarHoverZonesProps {
  sidebarState: 'hidden' | 'small' | 'expanded';
  isPinned: boolean;
  showBothOptions: boolean;
  activeSection: 'control-center' | 'clusters' | null;
  onShowBothOptions: (show: boolean) => void;
  onUpdateSidebarState: (state: 'hidden' | 'small' | 'expanded') => void;
  children: ReactNode;
}

/**
 * SidebarHoverZones Component
 * Manages the hover trigger zones for the sidebar
 * - Hidden state: left edge trigger to show small sidebar
 * - Expanded state: hover zones to show both options when not pinned
 */
export const SidebarHoverZones: React.FC<SidebarHoverZonesProps> = ({
  sidebarState,
  isPinned,
  showBothOptions,
  activeSection,
  onShowBothOptions,
  onUpdateSidebarState,
  children,
}) => {
  return (
    <>
      {/* Hidden State - Invisible trigger zone at the left edge */}
      {sidebarState === 'hidden' && (
        <div
          className="fixed left-0 top-[60px] w-1 z-40 hover:bg-blue-400 hover:bg-opacity-10 transition-all duration-200"
          style={{ height: 'calc(100vh - 60px)' }}
          onMouseEnter={() => onUpdateSidebarState('small')}
          title="Hover to show sidebar"
        />
      )}

      {/* Dedicated left-edge hover zone for showing both options when expanded */}
      {sidebarState === 'expanded' && !showBothOptions && activeSection && !isPinned && (
        <div
          className="fixed left-0 top-[60px] w-2 z-40 hover:bg-blue-400 hover:bg-opacity-20 transition-all duration-200"
          style={{ height: 'calc(100vh - 60px)' }}
          onMouseEnter={() => {
            if (activeSection && !isPinned) {
              onShowBothOptions(true);
            }
          }}
          title="Hover to show options"
        />
      )}

      {/* Main sidebar content */}
      {children}
    </>
  );
};

export default SidebarHoverZones;
