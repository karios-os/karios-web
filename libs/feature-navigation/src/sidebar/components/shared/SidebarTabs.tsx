import React from 'react';
import { MdStorage, MdComputer } from 'react-icons/md';

interface SidebarTabsProps {
  activeTab: 'nodes' | 'vms';
  onTabChange: (tab: 'nodes' | 'vms') => void;
}

/**
 * SidebarTabs Component
 * Displays tabs for switching between Nodes and VMs within Control Center
 */
export const SidebarTabs: React.FC<SidebarTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="bg-white px-2 sm:px-3 py-1 flex-shrink-0 border-b border-gray-200">
      <div className="flex items-center">
        {/* Nodes Tab */}
        <button
          onClick={() => onTabChange('nodes')}
          className={`py-1 text-sm font-medium transition-colors flex items-center justify-center w-full ${
            activeTab === 'nodes'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          title="Nodes"
        >
          Nodes
        </button>

        {/* VMs Tab - COMMENTED OUT */}
        {/* <button
          onClick={() => onTabChange('vms')}
          className={`py-1 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'vms'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          title="Virtual Machines"
        >
          <MdComputer className="w-5 h-5" />
          VMs
        </button> */}
      </div>
    </div>
  );
};

export default SidebarTabs;
