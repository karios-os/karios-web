import { useState, useCallback } from 'react';

export interface SidebarWidthStateReturn {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  resetRequested: boolean;
  setResetRequested: (value: boolean) => void;
  windowWidth: number;
  setWindowWidth: (width: number) => void;
  GAP_SIZE: number;

  resetWidth: () => void;
  calculateEffectiveWidth: (state: 'hidden' | 'small' | 'expanded') => number;
}

export function useSidebarWidthState(): SidebarWidthStateReturn {
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [resetRequested, setResetRequested] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 0
  );

  const GAP_SIZE = 20; // 5mm gap (approximately 20px)

  const resetWidth = useCallback(() => {
    setSidebarWidth(200);
    setResetRequested(false);
  }, []);

  const calculateEffectiveWidth = useCallback(
    (state: 'hidden' | 'small' | 'expanded'): number => {
      switch (state) {
        case 'hidden':
          return 0;
        case 'small':
          return 60;
        case 'expanded':
          return sidebarWidth + GAP_SIZE;
        default:
          return 0;
      }
    },
    [sidebarWidth]
  );

  return {
    sidebarWidth,
    setSidebarWidth,
    resetRequested,
    setResetRequested,
    windowWidth,
    setWindowWidth,
    GAP_SIZE,
    resetWidth,
    calculateEffectiveWidth,
  };
}
