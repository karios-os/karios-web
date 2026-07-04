import React, { FC, JSX } from 'react';
import { FaWifi, FaEthernet, FaGlobe, FaLink, FaMapMarkerAlt } from 'react-icons/fa';
import { StatusCard } from '@karios-monorepo/feature-server';
import { LoadingState } from '@karios-monorepo/shared-state';

interface ClusterDetailsCardProps {
  selectedVmDetails: any;
  isLoadingClusterDetails: boolean;
}

const ClusterDetailsCard: FC<ClusterDetailsCardProps> = ({
  selectedVmDetails,
  isLoadingClusterDetails,
}): JSX.Element => {
  return (
    <section className="border border-gray-200 rounded-lg col-span-full">
      <div className="bg-white rounded-lg p-3 sm:p-4 space-y-3">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-3">
            <FaWifi className="text-blue-500" size={24} />
            Cluster Details
          </h2>
        </div>

        {selectedVmDetails ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
            <StatusCard
              icon={FaEthernet}
              iconColor="#10B981"
              iconSize={24}
              metric={selectedVmDetails.MACAddress || 'N/A'}
              text="MAC Address"
              className="border border-gray-200 bg-white !min-h-[100px] !py-2 !px-3 overflow-hidden rounded-lg"
              metricsColor="text-gray-800"
              metricSize="text-sm sm:text-base font-semibold break-all"
              textSize="text-sm font-medium text-gray-500"
            />
            <StatusCard
              icon={FaGlobe}
              iconColor="#3B82F6"
              iconSize={24}
              metric={selectedVmDetails.IPAddress || 'N/A'}
              text="IP Address"
              className="border border-gray-200 bg-white !min-h-[100px] !py-2 !px-3 overflow-hidden rounded-lg"
              metricsColor="text-gray-800"
              metricSize="text-sm sm:text-base font-semibold"
              textSize="text-sm font-medium text-gray-500"
            />
            <StatusCard
              icon={FaLink}
              iconColor="#8B5CF6"
              iconSize={24}
              metric={selectedVmDetails.FQDN || 'N/A'}
              text="FQDN"
              className="border border-gray-200 bg-white !min-h-[100px] !py-2 !px-3 overflow-hidden rounded-lg"
              metricsColor="text-gray-800"
              metricSize="text-sm sm:text-base font-semibold break-all"
              textSize="text-sm font-medium text-gray-500"
            />
            <StatusCard
              icon={FaWifi}
              iconColor="#F59E0B"
              iconSize={24}
              metric={selectedVmDetails.ClusterName || 'N/A'}
              text="Cluster Name"
              className="border border-gray-200 bg-white !min-h-[100px] !py-2 !px-3 overflow-hidden rounded-lg"
              metricsColor="text-gray-800"
              metricSize="text-sm sm:text-base font-semibold break-all"
              textSize="text-sm font-medium text-gray-500"
            />
            <StatusCard
              icon={FaMapMarkerAlt}
              iconColor="#6366F1"
              iconSize={24}
              metric={selectedVmDetails.ZoneName || 'N/A'}
              text="Zone Name"
              className="border border-gray-200 bg-white !min-h-[100px] !py-2 !px-3 overflow-hidden rounded-lg"
              metricsColor="text-gray-800"
              metricSize="text-sm sm:text-base font-semibold break-all"
              textSize="text-sm font-medium text-gray-500"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center p-6 bg-white rounded-lg border border-gray-200">
            {isLoadingClusterDetails ? (
              <div className="text-center">
                <LoadingState message="Loading cluster details..." size="md" showMessage={true} />
              </div>
            ) : (
              <p className="text-gray-500">No cluster details available</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ClusterDetailsCard;
