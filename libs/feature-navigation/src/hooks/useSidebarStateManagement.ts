import { useCallback } from 'react';

export interface SidebarStateManagementReturn {
  updateSidebarState: (newState: 'hidden' | 'small' | 'expanded') => void;
  hideSidebar: () => void;
}

export function useSidebarStateManagement(
  sidebarState: 'hidden' | 'small' | 'expanded',
  setSidebarState: (state: 'hidden' | 'small' | 'expanded') => void,
  setResetRequested: (value: boolean) => void,
  setIsPinned: (value: boolean) => void,
  setActiveSection: (section: 'control-center' | 'clusters' | null) => void,
  setShowBothOptions: (value: boolean) => void,
  calculateEffectiveWidth: (state: 'hidden' | 'small' | 'expanded') => number,
  onSidebarStateChange?: (state: 'hidden' | 'small' | 'expanded', width: number) => void
): SidebarStateManagementReturn {
  const updateSidebarState = useCallback(
    (newState: 'hidden' | 'small' | 'expanded') => {
      if (sidebarState === 'expanded' && newState !== 'expanded') {
        setResetRequested(true);
      }
      setSidebarState(newState);
      if (onSidebarStateChange) {
        onSidebarStateChange(newState, calculateEffectiveWidth(newState));
      }
    },
    [
      sidebarState,
      setSidebarState,
      setResetRequested,
      calculateEffectiveWidth,
      onSidebarStateChange,
    ]
  );

  const hideSidebar = useCallback(() => {
    setIsPinned(false);
    setActiveSection(null);
    setShowBothOptions(false);
    setResetRequested(true);
    setSidebarState('hidden');
    if (onSidebarStateChange) {
      onSidebarStateChange('hidden', 0);
    }
  }, [
    setSidebarState,
    setResetRequested,
    setIsPinned,
    setActiveSection,
    setShowBothOptions,
    onSidebarStateChange,
  ]);

  return {
    updateSidebarState,
    hideSidebar,
  };
}
