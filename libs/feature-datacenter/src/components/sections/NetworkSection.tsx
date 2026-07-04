import React from 'react';
import { GrNetwork } from 'react-icons/gr';
import { HardwareInventory } from '../../../../shared-state/src/utils/hardwareInventoryService';

interface NetworkSectionProps {
  data: HardwareInventory;
}

const NetworkSection: React.FC<NetworkSectionProps> = ({ data }) => {
  return (
    <div className="rounded-lg border border-gray-300 p-6">
      <div className="flex items-center gap-3 mb-6">
        <GrNetwork className="w-6 h-6 text-cyan-600" />
        <h3 className="text-lg font-semibold text-gray-900">Network Configuration</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <NetworkInfoCard
          label="Primary MAC Address"
          value={data.network.primary_mac ?? 'Not Available'}
          mono
        />
        <NetworkInfoCard label="Interface Count" value={`${data.network.interface_count ?? 0}`} />
      </div>
    </div>
  );
};

interface NetworkInfoCardProps {
  label: string;
  value: string;
  mono?: boolean;
}

const NetworkInfoCard: React.FC<NetworkInfoCardProps> = ({ label, value, mono }) => {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''} text-gray-900`}>{value}</p>
    </div>
  );
};

export default NetworkSection;
