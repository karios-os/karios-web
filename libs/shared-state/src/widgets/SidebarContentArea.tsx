/**
 * SidebarContentArea Component
 * Main content rendering for sidebar - handles control-center and clusters views
 * This component encapsulates all the data-center, server, and cluster rendering logic
 */
import React from 'react';
import { SidebarControlCenterSection } from './SidebarControlCenterSection';
import { SidebarClustersSection } from './SidebarClustersSection';
import { SidebarContentHeader } from './SidebarContentHeader';

export interface SidebarContentAreaProps {
  // Section state
  activeSection: 'control-center' | 'clusters' | null;
  isTransitioning: boolean;

  // Data
  dataCenters: any[] | null;
  clusterData: any;
  clusterVmsData: Record<string, any>;

  // Server/VM state
  openServers: Record<string, boolean>;
  loadingServers: Record<string, boolean>;
  nodeStatuses: Record<string, string>;
  expandedClusters: Record<string, boolean>;
  loadingClusterVms: Record<string, boolean>;
  dropdownOpen: string | null;

  // Loading states
  isLoadingClusters: boolean;
  clusterError: string | null;

  // Handlers
  onServerClick: (server: any) => void;
  onToggleServer: (serverId: string) => void;
  onClusterNameClick: (clusterName: string) => void;
  onClusterDropdownToggle: (clusterName: string) => void;
  onDropdownOpen: (key: string | null) => void;

  // Utilities
  isClusterVM: (vmName: string) => boolean;
  getAllClusters: () => Record<string, any>;
  sortClusterVMs: (vms: any[]) => any[];
  isVmNameRestricted: (name: string) => boolean;

  // Render functions
  renderVMItem: (vm: any, server: any) => React.ReactNode;
  renderClusterVMActions: (vm: any, clusterName: string, isVmOn: boolean) => React.ReactNode;
}

export const SidebarContentArea: React.FC<SidebarContentAreaProps> = ({
  activeSection,
  isTransitioning,
  dataCenters,
  clusterData,
  clusterVmsData,
  openServers,
  loadingServers,
  nodeStatuses,
  expandedClusters,
  loadingClusterVms,
  dropdownOpen,
  isLoadingClusters,
  clusterError,
  onServerClick,
  onToggleServer,
  onClusterNameClick,
  onClusterDropdownToggle,
  onDropdownOpen,
  isClusterVM,
  getAllClusters,
  sortClusterVMs,
  isVmNameRestricted,
  renderVMItem,
  renderClusterVMActions,
}) => {
  return (
    <>
      {/* Content Header */}
      {activeSection && dataCenters && dataCenters.length > 0 && (
        <SidebarContentHeader
          dataCenterName={dataCenters[0]?.name || 'Data Center'}
          activeSection={activeSection}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-1 sm:p-2 min-h-0 pb-8">
        {isTransitioning ? (
          <div className="p-2 sm:p-4 text-center flex-1 flex items-center justify-center">
            <div className="flex items-center gap-1 text-blue-600">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs">Loading...</span>
            </div>
          </div>
        ) : !dataCenters || dataCenters.length === 0 ? (
          <div className="p-2 sm:p-4 text-center">
            <div className="text-xs sm:text-sm text-gray-500">
              {activeSection === 'control-center'
                ? 'No data centers available'
                : 'No clusters available'}
            </div>
          </div>
        ) : (
          <>
            {/* Control Center Content */}
            {activeSection === 'control-center' && (
              <SidebarControlCenterSection
                dataCenters={dataCenters}
                openServers={openServers}
                loadingServers={loadingServers}
                nodeStatuses={nodeStatuses}
                onServerClick={onServerClick}
                onToggleServer={onToggleServer}
                isClusterVM={isClusterVM}
                renderVMItem={renderVMItem}
                isLoading={isTransitioning}
              />
            )}

            {/* Clusters Content */}
            {activeSection === 'clusters' && (
              <SidebarClustersSection
                clusterData={clusterData}
                clusterVmsData={clusterVmsData}
                expandedClusters={expandedClusters}
                loadingClusterVms={loadingClusterVms}
                dropdownOpen={dropdownOpen}
                isLoadingClusters={isLoadingClusters}
                clusterError={clusterError}
                onClusterNameClick={onClusterNameClick}
                onClusterDropdownToggle={onClusterDropdownToggle}
                onDropdownOpen={onDropdownOpen}
                getAllClusters={getAllClusters}
                sortClusterVMs={sortClusterVMs}
                isVmNameRestricted={isVmNameRestricted}
                renderClusterVMActions={renderClusterVMActions}
              />
            )}
          </>
        )}
      </div>
    </>
  );
};

export default SidebarContentArea;
