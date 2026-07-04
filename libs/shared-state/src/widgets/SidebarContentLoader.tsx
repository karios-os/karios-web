/**
 * Sidebar Content Loader Component
 * Displays loading or empty state for sidebar content
 */
import React from 'react';

export interface SidebarContentLoaderProps {
  isLoading: boolean;
  isEmpty: boolean;
  activeSection: 'control-center' | 'clusters' | null;
  className?: string;
}

export const SidebarContentLoader: React.FC<SidebarContentLoaderProps> = ({
  isLoading,
  isEmpty,
  activeSection,
  className = 'p-2 sm:p-4 text-center flex-1 flex items-center justify-center',
}) => {
  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-1 text-blue-600">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs">Loading...</span>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={className}>
        <div className="text-xs sm:text-sm text-gray-500">
          {activeSection === 'control-center'
            ? 'No data centers available'
            : 'No clusters available'}
        </div>
      </div>
    );
  }

  return null;
};

export default SidebarContentLoader;
