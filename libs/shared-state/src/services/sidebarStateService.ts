/**
 * Sidebar State Service
 * Manages sidebar UI state (expand/collapse, pinning, resizing)
 */

export type SidebarState = 'hidden' | 'small' | 'expanded';

export interface SidebarStateCallbacks {
  onStateChange?: (state: SidebarState) => void;
  onPinnedChange?: (isPinned: boolean) => void;
  onWidthChange?: (width: number) => void;
}

/**
 * Determines sidebar width based on state
 */
export const getSidebarWidth = (
  state: SidebarState,
  minWidth: number = 32,
  maxWidth: number = 300
): number => {
  switch (state) {
    case 'hidden':
      return 0;
    case 'small':
      return minWidth;
    case 'expanded':
      return maxWidth;
    default:
      return minWidth;
  }
};

/**
 * Validates sidebar state transition
 */
export const isValidStateTransition = (from: SidebarState, to: SidebarState): boolean => {
  const validTransitions: Record<SidebarState, SidebarState[]> = {
    hidden: ['small', 'expanded'],
    small: ['hidden', 'expanded'],
    expanded: ['small', 'hidden'],
  };

  return validTransitions[from]?.includes(to) ?? false;
};

/**
 * Handles sidebar collapse/expand
 */
export const toggleSidebarState = (
  currentState: SidebarState,
  isPinned: boolean
): { newState: SidebarState; newIsPinned: boolean } => {
  // If pinned and expanded, unpin and collapse
  if (isPinned && currentState === 'expanded') {
    return { newState: 'small', newIsPinned: false };
  }

  // If not pinned and small, pin and expand
  if (!isPinned && currentState === 'small') {
    return { newState: 'expanded', newIsPinned: true };
  }

  // Otherwise expand and pin
  return { newState: 'expanded', newIsPinned: true };
};

/**
 * Handles sidebar visibility based on mouse position
 */
export const handleSidebarMouseLeave = (
  event: React.MouseEvent,
  isPinned: boolean,
  currentState: SidebarState
): SidebarState | null => {
  if (!isPinned && currentState === 'expanded') {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX;

    // If mouse is moving to the right (away from sidebar), collapse it
    if (mouseX > rect.right) {
      return 'small';
    }
  }

  return null;
};

/**
 * Validates sidebar width within bounds
 */
export const constrainSidebarWidth = (
  width: number,
  minWidth: number,
  maxWidth: number
): number => {
  return Math.max(minWidth, Math.min(width, maxWidth));
};

/**
 * Calculates resize delta for sidebar
 */
export const calculateResizeDelta = (
  startX: number,
  currentX: number,
  minWidth: number,
  maxWidth: number,
  currentWidth: number
): number => {
  const delta = currentX - startX;
  const newWidth = currentWidth + delta;
  return constrainSidebarWidth(newWidth, minWidth, maxWidth);
};
