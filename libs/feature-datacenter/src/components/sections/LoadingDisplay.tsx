import React from 'react';
import LoadingState from '../../../../shared-state/src/widgets/LoadingState';

const LoadingDisplay: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 p-8 bg-gray-50">
      <div className="mb-8">
        <LoadingState size="lg" showMessage message="Loading Hardware Inventory" />
      </div>
      <p className="text-gray-600 text-sm mb-8 text-center max-w-md">
        Retrieving complete hardware specifications and device information...
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-md space-y-3">
        <LoadingInfoCard
          icon="i"
          title="What is Hardware Inventory?"
          description="Hardware inventory provides detailed information about all physical components including CPU, memory, storage devices, network interfaces, and system specifications."
        />

        <div className="border-t border-gray-200 pt-3">
          <LoadingInfoCard
            icon="*"
            title="Key Information Included"
            description="System manufacturer and model, processor details, total memory capacity, storage configuration, firmware versions, and network adapter information."
          />
        </div>

        <div className="border-t border-gray-200 pt-3">
          <LoadingInfoCard
            icon="✓"
            title="Data Source"
            description="This information is retrieved from the Netbox hardware inventory management system for accurate and up-to-date specifications."
          />
        </div>
      </div>
    </div>
  );
};

interface LoadingInfoCardProps {
  icon: string;
  title: string;
  description: string;
}

const LoadingInfoCard: React.FC<LoadingInfoCardProps> = ({ icon, title, description }) => {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0">
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold">
          {icon}
        </div>
      </div>
      <div className="text-sm text-gray-700">
        <p className="font-medium text-gray-900 mb-1">{title}</p>
        <p>{description}</p>
      </div>
    </div>
  );
};

export default LoadingDisplay;
