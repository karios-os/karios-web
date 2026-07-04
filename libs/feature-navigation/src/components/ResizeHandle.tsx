import React, { useState, useEffect } from 'react';

interface ResizeHandleProps {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  onWidthChange?: (width: number) => void;
  minWidth?: number;
  maxWidthPercent?: number;
  GAP_SIZE?: number;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  sidebarWidth,
  setSidebarWidth,
  onWidthChange,
  minWidth = 150,
  maxWidthPercent = 0.4,
  GAP_SIZE = 0,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(sidebarWidth);
  };

  // Handle sidebar resize dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const diff = e.clientX - startX;
      const newWidth = Math.max(
        minWidth,
        Math.min(startWidth + diff, window.innerWidth * maxWidthPercent)
      );
      setSidebarWidth(newWidth);

      // Notify parent of width change
      if (onWidthChange) {
        onWidthChange(newWidth + GAP_SIZE);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isResizing,
    startX,
    startWidth,
    minWidth,
    maxWidthPercent,
    setSidebarWidth,
    onWidthChange,
    GAP_SIZE,
  ]);

  return (
    <div
      className="absolute right-0 top-0 w-2 h-full bg-gray-200 hover:bg-gray-300 cursor-col-resize transition-all duration-200 opacity-70 hover:opacity-100 flex items-center justify-center border-l border-gray-300"
      onMouseDown={handleMouseDown}
      title="Drag to resize sidebar"
    >
      {/* Resize Icon - vertical dots with double lines */}
      <div className="flex flex-col gap-1">
        <div className="flex gap-0.5">
          <div className="w-0.5 h-3 bg-gray-600 rounded-full"></div>
          <div className="w-0.5 h-3 bg-gray-600 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default ResizeHandle;
