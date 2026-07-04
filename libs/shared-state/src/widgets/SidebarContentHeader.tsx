/**
 * Sidebar Content Header Component
 * Displays the header for the expandable content area
 */
import React from 'react';

export interface SidebarContentHeaderProps {
  dataCenterName: string;
  activeSection: 'control-center' | 'clusters' | null;
  className?: string;
}

export const SidebarContentHeader: React.FC<SidebarContentHeaderProps> = ({
  dataCenterName,
  activeSection,
  className = 'p-2 sm:p-3 border-b border-gray-200 bg-white flex-shrink-0 max-h-9',
}) => {
  return (
    <div className={className}>
      <div className="flex flex-col items-center justify-center">
        <h3 className="text-xs sm:text-sm font-semibold text-blue-700 text-center">
          {dataCenterName}
        </h3>
        <span className="text-xs sm:text-sm font-bold text-karios-blue text-center">
          {activeSection === 'control-center' ? 'Nodes' : 'Kubernetes'}
        </span>
      </div>
    </div>
  );
};

export default SidebarContentHeader;
