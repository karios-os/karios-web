import React from 'react';

interface ContentEmptyStateProps {
  activeSection: 'control-center' | 'clusters' | 'migrate' | 'licenses' | null;
}

/**
 * ContentEmptyState Component
 * Displays appropriate empty state message based on the active section
 * - Control Center: "No data centers available"
 * - Kubernetes: "No clusters available"
 * - Migrate: "Migration interface"
 * - Licenses: "License interface"
 */
export const ContentEmptyState: React.FC<ContentEmptyStateProps> = ({ activeSection }) => {
  return (
    <div className="p-2 sm:p-4 text-center">
      <div className="text-xs sm:text-sm text-gray-500">
        {activeSection === 'control-center'
          ? 'No data centers available'
          : activeSection === 'clusters'
            ? 'No clusters available'
            : activeSection === 'migrate'
              ? 'Migration interface'
              : activeSection === 'licenses'
                ? 'License interface'
                : 'No data available'}
      </div>
    </div>
  );
};

export default ContentEmptyState;
