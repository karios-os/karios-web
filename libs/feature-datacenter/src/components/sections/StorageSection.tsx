import React from 'react';
import { MdStorage } from 'react-icons/md';
import { HardwareInventory } from '../../../../shared-state/src/utils/hardwareInventoryService';

interface StorageSectionProps {
  data: HardwareInventory;
}

const StorageSection: React.FC<StorageSectionProps> = ({ data }) => {
  return (
    <div className="rounded-lg border border-gray-300 p-6">
      <div className="flex items-center gap-3 mb-6">
        <MdStorage className="w-6 h-6 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Storage Devices</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StorageInfoCard
          label="Total Capacity"
          value={data.storage.total_capacity_gb ? `${data.storage.total_capacity_gb} GB` : 'N/A'}
        />
        <StorageInfoCard label="Device Count" value={`${data.storage.devices?.length ?? 0}`} />
      </div>

      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4">
        Storage Devices
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <StorageTableHeader label="Device Name" />
              <StorageTableHeader label="Model" />
              <StorageTableHeader label="Type" />
              <StorageTableHeader label="Size" />
              <StorageTableHeader label="Rotational" />
            </tr>
          </thead>
          <tbody>
            {(data.storage.devices?.length ?? 0) > 0 ? (
              data.storage.devices.map((device, idx) => (
                <StorageDeviceRow key={idx} device={device} />
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center text-gray-500">
                  No storage devices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface StorageInfoCardProps {
  label: string;
  value: string;
}

const StorageInfoCard: React.FC<StorageInfoCardProps> = ({ label, value }) => {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
};

interface StorageTableHeaderProps {
  label: string;
}

const StorageTableHeader: React.FC<StorageTableHeaderProps> = ({ label }) => {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{label}</th>
  );
};

interface StorageDeviceRowProps {
  device: any;
}

const StorageDeviceRow: React.FC<StorageDeviceRowProps> = ({ device }) => {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3 text-sm text-gray-900">{device.name ?? 'N/A'}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{device.model ?? 'N/A'}</td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            device.type === 'SSD' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
          }`}
        >
          {device.type ?? 'N/A'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{device.size ?? 'N/A'}</td>
      <td className="px-4 py-3 text-sm">
        <span className="text-gray-700">
          {device.rotational === 0 ? 'No' : device.rotational === 1 ? 'Yes' : 'N/A'}
        </span>
      </td>
    </tr>
  );
};

export default StorageSection;
