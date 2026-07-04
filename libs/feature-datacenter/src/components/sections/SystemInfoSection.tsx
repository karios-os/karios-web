import React from 'react';
import { FiHardDrive } from 'react-icons/fi';
import { HardwareInventory } from '../../../../shared-state/src/utils/hardwareInventoryService';

interface SystemInfoSectionProps {
  data: HardwareInventory;
}

const SystemInfoSection: React.FC<SystemInfoSectionProps> = ({ data }) => {
  return (
    <div className="rounded-lg border border-gray-300 p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <FiHardDrive className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{data.display_name}</h1>
          <p className="text-sm text-gray-500 mt-1">Device ID: {data.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <InfoCard label="Manufacturer" value={data.system.manufacturer ?? 'N/A'} />
        <InfoCard label="Model" value={data.system.model ?? 'N/A'} />
        <HealthStatusCard health={data.system.health ?? 'Unknown'} />
        <InfoCard
          label="Uptime"
          value={
            data.operating_system.uptime_hours !== null
              ? `${data.operating_system.uptime_hours.toFixed(2)}h`
              : 'N/A'
          }
        />
      </div>
    </div>
  );
};

interface InfoCardProps {
  label: string;
  value: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ label, value }) => {
  return (
    <div className="rounded-lg p-4 border border-gray-300">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
};

interface HealthStatusCardProps {
  health: string;
}

const HealthStatusCard: React.FC<HealthStatusCardProps> = ({ health }) => {
  const getHealthStyles = () => {
    switch (health?.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 bg-red-600';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 bg-yellow-600';
      case 'ok':
        return 'bg-green-100 text-green-800 bg-green-600';
      default:
        return 'bg-gray-100 text-gray-800 bg-gray-600';
    }
  };

  const [bgClass, textClass, dotBgClass] = getHealthStyles().split(' ');

  return (
    <div className="rounded-lg p-4 border border-gray-300">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
        Health Status
      </p>
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${bgClass} ${textClass}`}
      >
        <span className={`w-2 h-2 rounded-full ${dotBgClass}`}></span>
        {health ?? 'Unknown'}
      </span>
    </div>
  );
};

export default SystemInfoSection;
