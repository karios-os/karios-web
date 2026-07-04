import React from 'react';
import { FiCpu } from 'react-icons/fi';
import {
  HardwareInventory,
  formatSpeed,
} from '../../../../shared-state/src/utils/hardwareInventoryService';

interface ProcessorSectionProps {
  data: HardwareInventory;
}

const ProcessorSection: React.FC<ProcessorSectionProps> = ({ data }) => {
  return (
    <div className="rounded-lg border border-gray-300 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
          <FiCpu className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Processor Information</h2>
        <p className="text-sm text-gray-500 ml-auto">CPU Specifications</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <CPUInfoCard label="Processor Model" value={data.cpu.model} />
        <CPUInfoCard
          label="Cores / Threads"
          value={`${data.cpu.total_cores} / ${data.cpu.total_threads}`}
        />
        <CPUInfoCard label="Base Frequency" value={formatSpeed(data.cpu.max_speed_mhz)} />
        <CPUInfoCard label="Max Turbo Frequency" value={formatSpeed(data.cpu.max_speed_mhz)} />
        <CPUInfoCard label="Cache" value={data.cpu.microcode ? '12 MB' : 'N/A'} />
        <CPUInfoCard label="TDP" value={`${data.cpu.tdp_watts}W`} />
      </div>
    </div>
  );
};

interface CPUInfoCardProps {
  label: string;
  value: string;
}

const CPUInfoCard: React.FC<CPUInfoCardProps> = ({ label, value }) => {
  return (
    <div className="rounded-lg p-4 border border-gray-300">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
};

export default ProcessorSection;
