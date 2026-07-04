import React, { useState } from 'react';
import Card from '../../../shared-state/src/widgets/Card';
import StorageTable from './StorageTable';
import { MdStorage } from 'react-icons/md';

interface StorageController {
  name: string;
  vendor: string;
  model: string;
  disks: Array<{
    device: string;
    model: string;
    firmware_version: string;
    size: string;
    health: 'Healthy' | 'Degraded' | 'Warning';
  }>;
}

interface TransformedStorageController {
  model: string;
  disks: Array<{
    device: string;
    model: string;
    firmware_version: string;
    size: string;
    health: 'Healthy' | 'Degraded' | 'Warning';
  }>;
}

interface TransformedStorageData {
  nvme: TransformedStorageController[];
  others: TransformedStorageController[];
}

interface StorageCardsProps {
  storageCards: StorageController[] | null;
  loadingStorageCards: boolean;
  storageCardsError: string | null;
  onModelClick: (modelName: string, deviceName: string) => void;
}

function transformStorageCardsData(apiData: StorageController[] | null): TransformedStorageData {
  if (!apiData || !Array.isArray(apiData)) {
    return { nvme: [], others: [] };
  }

  const result = apiData.reduce(
    (acc: TransformedStorageData, controller: StorageController) => {
      const isNVMe = controller.name && controller.name.toLowerCase().startsWith('nvme');

      const targetArray = isNVMe ? acc.nvme : acc.others;

      targetArray.push({
        model: controller.model,
        disks: controller.disks || [],
      });

      return acc;
    },
    { nvme: [], others: [] }
  );

  return result;
}

export default function StorageCards({
  storageCards,
  loadingStorageCards,
  storageCardsError,
  onModelClick,
}: StorageCardsProps) {
  const [activeTab, setActiveTab] = useState<'nvme' | 'others'>('nvme');

  if (loadingStorageCards) {
    return (
      <Card
        title="Storage Devices"
        description="Storage Device Information"
        icon={MdStorage}
        iconColor="#886CFF"
        iconSize={24}
        className="rounded-lg bg-white border border-gray-200 w-full h-full flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-auto p-3 sm:p-4 text-center flex items-center justify-center">
          <span className="text-sm text-gray-600">Loading...</span>
        </div>
      </Card>
    );
  }

  if (storageCardsError) {
    return (
      <Card
        title="Storage Devices"
        description="Storage Device Information"
        icon={MdStorage}
        iconColor="#886CFF"
        iconSize={24}
        className="rounded-lg bg-white border border-gray-200 w-full h-full flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-auto p-3 sm:p-4 text-center flex items-center justify-center">
          <span className="text-sm text-gray-600">Storage Unavailable</span>
        </div>
      </Card>
    );
  }

  const transformedData = transformStorageCardsData(storageCards);
  const nvmeCount = transformedData.nvme.length;
  const othersCount = transformedData.others.length;

  return (
    <Card
      title="Storage Devices"
      description="Storage Device Information"
      icon={MdStorage}
      iconColor="#886CFF"
      iconSize={24}
      className="rounded-lg bg-white border border-gray-200 w-full h-full flex flex-col overflow-hidden"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-3 sm:px-4 pt-2 sm:pt-3 gap-2 sm:gap-0">
          <button
            onClick={() => setActiveTab('nvme')}
            className={`px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
              activeTab === 'nvme'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            NVMe SSD {nvmeCount > 0 && <span className="ml-1">({nvmeCount})</span>}
          </button>
          <button
            onClick={() => setActiveTab('others')}
            className={`px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
              activeTab === 'others'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Other {othersCount > 0 && <span className="ml-1">({othersCount})</span>}
          </button>
        </div>

        {/* Tab Content */}
        {/* Max height for 4 visible items (4 * 50px = 200px) */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 max-h-[200px]">
          <div className="w-full overflow-x-auto">
            {activeTab === 'nvme' && (
              <>
                {transformedData.nvme.length > 0 ? (
                  <StorageTable
                    title="NVMe SSD Controllers"
                    data={transformedData.nvme}
                    onModelClick={onModelClick}
                  />
                ) : (
                  <p className="text-gray-600 text-center">No NVMe SSD Controllers found</p>
                )}
              </>
            )}
            {activeTab === 'others' && (
              <>
                {transformedData.others.length > 0 ? (
                  <StorageTable
                    title="Other Controllers"
                    data={transformedData.others}
                    onModelClick={onModelClick}
                  />
                ) : (
                  <p className="text-gray-600 text-center">No Other Controllers found</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
