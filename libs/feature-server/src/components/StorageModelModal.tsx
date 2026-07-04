import React from 'react';
import Modal from '../../../shared-state/src/widgets/Modal';
import DataTable from '../../../shared-state/src/widgets/DataTable';

interface StorageModelData {
  device?: {
    name: string;
    protocol: string;
  };
  model_name?: string;
  serial_number?: string;
  firmware_version?: string;
  user_capacity?: {
    bytes: number;
  };
  nvme_total_capacity?: number;
  smart_status?: {
    passed: boolean;
  };
  temperature?: {
    current: number;
  };
  power_on_time?: {
    hours: number;
  };
  power_cycle_count?: number;
  nvme_smart_health_information_log?: {
    available_spare: number;
    available_spare_threshold: number;
    percentage_used: number;
    data_units_read?: number;
    data_units_written?: number;
    media_errors: number;
  };
  ata_smart_attributes?: {
    table: Array<{
      name: string;
      value: number;
      thresh: number;
      raw: {
        value: number;
      };
    }>;
  };
  interface_speed?: {
    current?: {
      string: string;
    };
  };
  rotation_rate?: number;
  form_factor?: {
    name: string;
  };
  logical_block_size?: number;
}

interface StorageModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageModelData: StorageModelData | null;
  loadingStorageModel: boolean;
  storageModelError: string | null;
}

export default function StorageModelModal({
  isOpen,
  onClose,
  storageModelData,
  loadingStorageModel,
  storageModelError,
}: StorageModelModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Storage Device Details"
      width="700px"
      scrollable
    >
      <div className="text-gray-800">
        {loadingStorageModel && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
            <span className="mt-4 text-sm text-gray-600 font-medium">
              Loading storage device details...
            </span>
          </div>
        )}

        {storageModelError && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error Loading Storage Details</h3>
                <p className="mt-1 text-sm text-red-700">{storageModelError}</p>
              </div>
            </div>
          </div>
        )}

        {storageModelData && !loadingStorageModel && (
          <div className="space-y-6">
            {/* Device Information */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                </div>
                <h3 className="ml-3 text-lg font-semibold text-gray-900">Device Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex flex-col py-2 border-b border-blue-100">
                    <span className="text-sm font-medium text-gray-600 mb-1">Device Name</span>
                    <span className="text-sm font-mono text-gray-900 bg-white px-2 py-1 rounded border">
                      {storageModelData.device?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col py-2 border-b border-blue-100">
                    <span className="text-sm font-medium text-gray-600 mb-1">Protocol</span>
                    <span className="text-sm font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded">
                      {storageModelData.device?.protocol || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col py-2 border-b border-blue-100">
                    <span className="text-sm font-medium text-gray-600 mb-1">Model</span>
                    <span className="text-sm text-gray-900 break-words">
                      {storageModelData.model_name || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-col py-2 border-b border-blue-100">
                    <span className="text-sm font-medium text-gray-600 mb-1">Serial Number</span>
                    <span className="text-sm font-mono text-gray-900 bg-white px-2 py-1 rounded border">
                      {storageModelData.serial_number || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col py-2 border-b border-blue-100">
                    <span className="text-sm font-medium text-gray-600 mb-1">Firmware</span>
                    <span className="text-sm text-gray-900">
                      {storageModelData.firmware_version || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col py-2 border-b border-blue-100">
                    <span className="text-sm font-medium text-gray-600 mb-1">Total Capacity</span>
                    <span className="text-sm font-semibold text-indigo-700">
                      {storageModelData.nvme_total_capacity
                        ? `${(storageModelData.nvme_total_capacity / 1024 ** 3).toFixed(1)} GB`
                        : storageModelData.user_capacity?.bytes
                          ? `${(storageModelData.user_capacity.bytes / 1024 ** 3).toFixed(1)} GB`
                          : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Health Status */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="ml-3 text-lg font-semibold text-gray-900">Health Status</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex flex-col py-2 border-b border-green-100">
                    <span className="text-sm font-medium text-gray-600 mb-1">SMART Status</span>
                    {storageModelData.smart_status?.passed !== undefined ? (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${
                          storageModelData.smart_status.passed
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}
                      >
                        {storageModelData.smart_status.passed ? '✓ Healthy' : '⚠ Degraded'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded w-fit">
                        N/A
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col py-2 border-b border-green-100">
                    <span className="text-sm font-medium text-gray-600 mb-1">Temperature</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {storageModelData.temperature?.current
                        ? `${storageModelData.temperature.current}°C`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-col py-2 border-b border-green-100">
                    <span className="text-sm font-medium text-gray-600 mb-1">Power On Time</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {storageModelData.power_on_time?.hours
                        ? `${(storageModelData.power_on_time.hours / 24).toFixed(0)} days`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col py-2 border-b border-green-100">
                    <span className="text-sm font-medium text-gray-600 mb-1">Power Cycles</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {storageModelData.power_cycle_count
                        ? storageModelData.power_cycle_count.toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* NVMe Specific Information */}
            {storageModelData.device?.protocol === 'NVMe' &&
              storageModelData.nvme_smart_health_information_log && (
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-6 w-6 text-purple-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <h3 className="ml-3 text-lg font-semibold text-gray-900">
                      NVMe Health Metrics
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-purple-100">
                        <span className="text-sm font-medium text-gray-600">Available Spare</span>
                        <span className="text-sm font-semibold text-purple-700">
                          {storageModelData.nvme_smart_health_information_log.available_spare}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-purple-100">
                        <span className="text-sm font-medium text-gray-600">Spare Threshold</span>
                        <span className="text-sm font-semibold text-purple-700">
                          {
                            storageModelData.nvme_smart_health_information_log
                              .available_spare_threshold
                          }
                          %
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-purple-100">
                        <span className="text-sm font-medium text-gray-600">Percentage Used</span>
                        <span className="text-sm font-semibold text-purple-700">
                          {storageModelData.nvme_smart_health_information_log.percentage_used}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-purple-100">
                        <span className="text-sm font-medium text-gray-600">Data Units Read</span>
                        <span className="text-sm font-mono text-gray-900">
                          {storageModelData.nvme_smart_health_information_log.data_units_read?.toLocaleString() ||
                            'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-purple-100">
                        <span className="text-sm font-medium text-gray-600">
                          Data Units Written
                        </span>
                        <span className="text-sm font-mono text-gray-900">
                          {storageModelData.nvme_smart_health_information_log.data_units_written?.toLocaleString() ||
                            'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-purple-100">
                        <span className="text-sm font-medium text-gray-600">Media Errors</span>
                        <span
                          className={`text-sm font-semibold ${
                            storageModelData.nvme_smart_health_information_log.media_errors > 0
                              ? 'text-red-700'
                              : 'text-green-700'
                          }`}
                        >
                          {storageModelData.nvme_smart_health_information_log.media_errors || '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* ATA/SATA Specific Information */}
            {storageModelData.device?.protocol === 'ATA' &&
              storageModelData.ata_smart_attributes && (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-6 w-6 text-orange-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                    </div>
                    <h3 className="ml-3 text-lg font-semibold text-gray-900">
                      ATA/SATA SMART Attributes
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {storageModelData.ata_smart_attributes.table
                      .filter((attr: any) =>
                        [
                          'Raw_Read_Error_Rate',
                          'Reallocated_Sector_Ct',
                          'Power_On_Hours',
                          'Power_Cycle_Count',
                          'Reallocated_Event_Count',
                          'Offline_Uncorrectable',
                          'UDMA_CRC_Error_Count',
                        ].includes(attr.name)
                      )
                      .map((attr: any, index: number) => (
                        <div
                          key={index}
                          className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-orange-100"
                        >
                          <span className="text-sm font-medium text-gray-700 truncate">
                            {attr.name.replace(/_/g, ' ')}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">Threshold: {attr.thresh}</span>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                attr.value >= attr.thresh
                                  ? 'bg-green-100 text-green-800 border border-green-200'
                                  : 'bg-red-100 text-red-800 border border-red-200'
                              }`}
                            >
                              {attr.raw.value}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </Modal>
  );
}
