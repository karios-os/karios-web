import React, { useRef, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface ScrollableContentProps {
  children: React.ReactNode;
  className?: string;
  resetScrollOnRouteChange?: boolean;
  hasTopBar?: boolean;
  topBarHeight?: string;
  maxHeight?: string;
}

/**
 * Centralized scrollable content wrapper component
 * Provides consistent scrolling behavior across all pages while keeping navigation bars sticky
 * Enhanced with tab navigation support and automatic scroll reset
 */
const ScrollableContent: React.FC<ScrollableContentProps> = ({
  children,
  className = '',
  resetScrollOnRouteChange = true,
  hasTopBar = false,
  topBarHeight = '90px', // Default height for VM navigation bars
  maxHeight,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const previousPathnameRef = useRef<string>(location.pathname);

  // Function to get browser zoom level - most reliable method
  const getBrowserZoomLevel = () => {
    // Use screen width vs window inner width ratio
    // This is the most reliable cross-browser method for zoom detection
    return Math.round((screen.width / window.innerWidth) * 100) / 100;
  };

  const [zoomLevel, setZoomLevel] = useState(getBrowserZoomLevel());

  // Calculate the scroll container height based on context and zoom level
  const calculateHeight = () => {
    if (maxHeight) return maxHeight;

    if (hasTopBar) {
      const currentZoomLevel = getBrowserZoomLevel();
      const topBarHeightValue = parseInt(topBarHeight.replace('px', ''));

      // Increased adjustment for zoom levels to account for more space needed
      // At higher zoom levels, UI elements take up exponentially more space
      let zoomAdjustment = 0;

      if (currentZoomLevel >= 2.5) {
        // At 250%+ zoom, UI elements take massive amounts of space
        zoomAdjustment = (currentZoomLevel - 1) * topBarHeightValue * 0.8;
      } else if (currentZoomLevel >= 2.0) {
        // At 200-249% zoom, very aggressive adjustment needed
        zoomAdjustment = (currentZoomLevel - 1) * topBarHeightValue * 0.8;
      } else if (currentZoomLevel >= 1.75) {
        // At 175-199% zoom, aggressive adjustment needed
        zoomAdjustment = (currentZoomLevel - 1) * topBarHeightValue * 0.8;
      } else if (currentZoomLevel >= 1.5) {
        // At 150-174% zoom, UI elements take up much more space
        zoomAdjustment = (currentZoomLevel - 1) * topBarHeightValue * 1.0;
      } else if (currentZoomLevel >= 1.25) {
        // At 125-149% zoom, moderate but significant adjustment needed
        zoomAdjustment = (currentZoomLevel - 1) * topBarHeightValue * 2.0;
      } else if (currentZoomLevel > 1.0) {
        // Small zoom levels, moderate adjustment
        zoomAdjustment = (currentZoomLevel - 1) * topBarHeightValue * 1.5;
      }

      const adjustedTopBarHeight = topBarHeightValue + zoomAdjustment;

      return `calc(90vh - ${adjustedTopBarHeight}px)`;
    }

    return 'calc(100vh - 100px)'; // Default height for pages without top bar
  };

  const [containerHeight, setContainerHeight] = useState(() => calculateHeight());

  // Listen for zoom level changes
  useEffect(() => {
    const handleZoomChange = () => {
      const newZoomLevel = getBrowserZoomLevel();

      // Only update state if zoom level actually changed to avoid unnecessary re-renders
      setZoomLevel((prevZoom) => {
        if (Math.abs(prevZoom - newZoomLevel) > 0.05) {
          // Increased threshold for more stable updates
          return newZoomLevel;
        }
        return prevZoom;
      });
    };

    // Initial check
    handleZoomChange();

    // Listen for resize events which can indicate zoom changes
    window.addEventListener('resize', handleZoomChange);

    // Listen for visual viewport changes (better zoom detection on supported browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleZoomChange);
    }

    return () => {
      window.removeEventListener('resize', handleZoomChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleZoomChange);
      }
    };
  }, []);

  // Update container height when zoom level changes
  useEffect(() => {
    setContainerHeight(calculateHeight());
  }, [zoomLevel, maxHeight, hasTopBar, topBarHeight]);

  // Reset scroll position when route changes
  useEffect(() => {
    const currentPathname = location.pathname;
    const previousPathname = previousPathnameRef.current;

    // Enhanced scroll reset logic for better tab navigation
    if (
      resetScrollOnRouteChange &&
      scrollContainerRef.current &&
      currentPathname !== previousPathname
    ) {
      // Instant scroll to top for better UX during tab switching
      scrollContainerRef.current.scrollTop = 0;
    }

    previousPathnameRef.current = currentPathname;
  }, [location.pathname, resetScrollOnRouteChange]);

  return (
    <div
      ref={scrollContainerRef}
      className={`overflow-y-auto overflow-x-auto bg-white-50 relative ${className}`}
      style={{
        height: containerHeight,
        scrollBehavior: 'smooth', // Ensure smooth scrolling for user interactions
      }}
    >
      <div className="p-4 min-h-full">{children}</div>
    </div>
  );
};

export default ScrollableContent;
