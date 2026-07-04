import React from 'react';

interface SidebarContentAreaProps {
  isTransitioning: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
  width: number;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * SidebarContentArea Component
 * Handles the content display with loading and empty states
 */
export const SidebarContentArea: React.FC<SidebarContentAreaProps> = ({
  isTransitioning,
  isEmpty,
  emptyMessage,
  children,
  width,
  onMouseEnter,
  onMouseLeave,
}) => {
  if (isTransitioning) {
    return (
      <div className="p-2 sm:p-4 text-center flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1 text-blue-600">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs">Loading...</span>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="p-2 sm:p-4 text-center">
        <div className="text-xs sm:text-sm text-gray-500">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div
      className="transition-all duration-300 ease-in-out overflow-hidden bg-white flex flex-col"
      style={{ width: `${width}px` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto p-1 sm:p-2 min-h-0 pb-8">{children}</div>
      </div>
    </div>
  );
};
