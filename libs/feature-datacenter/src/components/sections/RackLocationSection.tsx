import React from 'react';
import { MdLocationOn } from 'react-icons/md';
import { HardwareInventory } from '../../../../shared-state/src/utils/hardwareInventoryService';

interface RackLocationSectionProps {
  data: HardwareInventory;
}

const RackLocationSection: React.FC<RackLocationSectionProps> = ({ data }) => {
  if (!data.rack) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <MdLocationOn className="w-6 h-6 text-green-600" />
        <h3 className="text-lg font-semibold text-gray-900">Rack Location</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RackInfoCard label="Site" value={data.rack.site?.name ?? 'N/A'} />
        <RackInfoCard label="Rack" value={data.rack.name ?? 'N/A'} />
        <RackInfoCard
          label="Position (U)"
          value={data.rack.position_u !== null ? `${data.rack.position_u}` : 'N/A'}
        />
        <RackInfoCard label="Airflow" value={data.rack.airflow ?? 'N/A'} />
      </div>
    </div>
  );
};

interface RackInfoCardProps {
  label: string;
  value: string;
}

const RackInfoCard: React.FC<RackInfoCardProps> = ({ label, value }) => {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
};

export default RackLocationSection;
