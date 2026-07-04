import React from 'react';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { useNavigate } from 'react-router-dom';

interface VersionInfoBoxProps {
  controlNodeVersion?: string;
  isLoadingVersion: boolean;
  hasUpdatesAvailable: boolean;
  isLoadingUpdates: boolean;
  sidebarState: 'hidden' | 'small' | 'expanded';
  activeSection?: string;
  showBothOptions: boolean;
  isPinned: boolean;
  calculateEffectiveWidth: (state: string) => number;
  GAP_SIZE: number;
  dataCenters?: any[];
  setShowBothOptions?: (value: boolean) => void;
}

export const VersionInfoBox: React.FC<VersionInfoBoxProps> = ({
  controlNodeVersion,
  isLoadingVersion,
  hasUpdatesAvailable,
  isLoadingUpdates,
  sidebarState,
  activeSection,
  showBothOptions,
  isPinned,
  calculateEffectiveWidth,
  GAP_SIZE,
  dataCenters,
  setShowBothOptions,
}) => {
  const navigate = useNavigate();

  const onVersionBoxClick = () => {
    if (dataCenters && dataCenters.length > 0) {
      const firstDataCenter = dataCenters[0];
      navigate(`/dc/${firstDataCenter.id}/releases`);
    }
  };

  const handleMouseEnter = () => {
    // Show both options when hovering over version box only if not pinned
    if (
      setShowBothOptions &&
      activeSection &&
      !showBothOptions &&
      sidebarState === 'expanded' &&
      !isPinned
    ) {
      setShowBothOptions(true);
    }
  };

  const handleMouseLeave = () => {
    // Reset showBothOptions when leaving version box only if not pinned
    if (setShowBothOptions && activeSection && showBothOptions && !isPinned) {
      setTimeout(() => {
        if (!isPinned && setShowBothOptions) {
          setShowBothOptions(false);
        }
      }, 100);
    }
  };

  if (!controlNodeVersion || controlNodeVersion === 'unknown') {
    return null;
  }

  const calculatedWidth = calculateEffectiveWidth(sidebarState);
  const boxWidth = sidebarState === 'hidden' ? '0px' : `calc(${calculatedWidth}px + ${GAP_SIZE}px)`;
  const boxHeight = sidebarState === 'hidden' ? '0px' : '28px';
  const boxOpacity = sidebarState === 'hidden' ? 0 : 1;

  return (
    <div
      className="fixed z-60 bg-blue-50 text-gray-800 px-1 sm:px-2 py-1 text-xs cursor-pointer hover:bg-blue-100 transition-all duration-[1000ms] ease-in-out border-t border-gray-200"
      style={{
        bottom: '0px',
        left: '0px',
        width: boxWidth,
        height: boxHeight,
        opacity: boxOpacity,
      }}
      onClick={onVersionBoxClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center gap-1 justify-between h-full">
        <div className="font-bold truncate flex-1">
          {isLoadingVersion ? (
            <div className="flex items-center gap-1">
              <AiOutlineLoading3Quarters className="animate-spin h-2 w-2 text-gray-500" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : (
            <span className="text-xs">
              {sidebarState === 'expanded' && (activeSection || showBothOptions)
                ? `Version ${controlNodeVersion}`
                : `V${controlNodeVersion}`}
            </span>
          )}
        </div>
        {!isLoadingUpdates &&
          !hasUpdatesAvailable &&
          sidebarState === 'expanded' &&
          (activeSection || showBothOptions) && (
            <span className="bg-green-500 text-white text-xs px-1 py-0.5 rounded-full flex-shrink-0">
              Latest
            </span>
          )}
      </div>
    </div>
  );
};

export default VersionInfoBox;
