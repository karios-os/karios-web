/**
 * ClusterItemWithVMs Component
 * Renders a cluster with its expandable VM list
 * Handles cluster expand/collapse and VM rendering
 */
import React from 'react';
import { ArrowDown2 } from 'iconsax-react';
import { RiNodeTree, RiServerFill } from 'react-icons/ri';

export interface ClusterItemWithVMsProps {
  clusterName: string;
  isOmniServer: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  hasVMs: boolean;
  onClusterClick: () => void;
  onToggleExpand: () => void;
  renderVMList: () => React.ReactNode;
}

export const ClusterItemWithVMs: React.FC<ClusterItemWithVMsProps> = ({
  clusterName,
  isOmniServer,
  isExpanded,
  isLoading,
  hasVMs,
  onClusterClick,
  onToggleExpand,
  renderVMList,
}) => {
  return (
    <div className="bg-gray-50 rounded border border-gray-100">
      <div className="flex items-center justify-between p-2">
        <div
          className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors duration-[1000ms] min-w-0 flex-1"
          onClick={onClusterClick}
        >
          {isOmniServer ? (
            <RiServerFill size={12} color="currentColor" className="flex-shrink-0" />
          ) : (
            <RiNodeTree size={12} color="currentColor" className="flex-shrink-0" />
          )}
          <span className="font-medium text-base text-black truncate">{clusterName}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className={`p-1 rounded transition-all duration-[1000ms] ease-in-out hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
            title={isExpanded ? 'Collapse cluster' : 'Expand cluster'}
          >
            <ArrowDown2
              size={12}
              color="#6B7280"
              className={`transition-all duration-[1000ms] ease-in-out ${isExpanded ? 'rotate-0' : 'rotate-[-90deg]'}`}
            />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-2 py-1 border-t border-gray-100 bg-white">
          {isLoading && (
            <div className="flex items-center gap-1 py-1 text-blue-600">
              <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-blue-600"></div>
              <span className="text-xs">Loading...</span>
            </div>
          )}

          {hasVMs && !isLoading && <div className="space-y-1">{renderVMList()}</div>}
        </div>
      )}
    </div>
  );
};

export default ClusterItemWithVMs;
