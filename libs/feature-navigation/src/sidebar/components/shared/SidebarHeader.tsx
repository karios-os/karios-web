import React from 'react';
import { DataCenter } from '../../../SideBar-types';

interface SidebarHeaderProps {
  datacenter: DataCenter;
  activeSection: string;
}

/**
 * SidebarHeader Component
 * Displays the datacenter name and current section label
 */
export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ datacenter, activeSection }) => {
  return (
    <div className="p-2 sm:p-3 border-b border-gray-200 bg-white flex-shrink-0 max-h-9">
      <div className="flex flex-col items-center justify-center">
        <h3 className="text-xs sm:text-sm font-semibold text-blue-700 text-center">
          {datacenter.name}
        </h3>
        <span className="text-xs sm:text-sm font-bold text-karios-blue text-center">
          {activeSection === 'control-center' ? 'Nodes' : 'Kubernetes'}
        </span>
      </div>
    </div>
  );
};
