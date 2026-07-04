import React from 'react';

interface SidebarContainerProps {
  children: React.ReactNode;
  isPinned: boolean;
  sidebarState: 'hidden' | 'small' | 'expanded';
  activeSection: string | null;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * SidebarContainer Component
 * Main wrapper for the sidebar content area with proper styling and event handling
 */
export const SidebarContainer: React.FC<SidebarContainerProps> = ({
  children,
  isPinned,
  sidebarState,
  activeSection,
  onMouseLeave,
  onMouseEnter,
}) => {
  // Only show container when in expanded state
  if (sidebarState !== 'expanded' || !activeSection) {
    return null;
  }

  return (
    <div
      className="fixed left-0 z-50 transition-all duration-[1000ms] ease-in-out"
      style={{ top: '60px', height: 'calc(100vh - 60px)' }}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
    >
      {children}
    </div>
  );
};
