import React from 'react';
import { FiCpu } from 'react-icons/fi';
import {
  HardwareInventory,
  formatMemorySize,
  calculateTotalMemory,
  formatSpeed,
} from '../../../../shared-state/src/utils/hardwareInventoryService';

interface MemorySectionProps {
  data: HardwareInventory;
}

const MemorySection: React.FC<MemorySectionProps> = ({ data }) => {
  const modules = data.memory?.modules ?? [];
  const totalMemory = calculateTotalMemory(modules);

  return (
    <div className="rounded-lg border border-gray-300 p-6">
      <SectionHeader
        icon={<FiCpu className="w-5 h-5 text-green-600" />}
        title="Memory Information"
        subtitle={`Total: ${formatMemorySize(totalMemory)}`}
      />

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <TableHeader label="Slot" />
              <TableHeader label="Size" />
              <TableHeader label="Type" />
              <TableHeader label="Speed" />
              <TableHeader label="Manufacturer" />
              <TableHeader label="Status" />
            </tr>
          </thead>
          <tbody>
            {modules.length > 0 ? (
              modules.map((module, idx) => <MemoryModuleRow key={idx} module={module} />)
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No memory modules found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface MemoryModuleRowProps {
  module: any;
}

const MemoryModuleRow: React.FC<MemoryModuleRowProps> = ({ module }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{module.slot ?? 'N/A'}</td>
      <td className="px-6 py-4 text-sm text-gray-700">
        {module.size_gb ? formatMemorySize(module.size_gb) : 'N/A'}
      </td>
      <td className="px-6 py-4 text-sm text-gray-700">{module.type ?? 'N/A'}</td>
      <td className="px-6 py-4 text-sm text-gray-700">
        {module.speed_mhz ? formatSpeed(module.speed_mhz) : 'N/A'}
      </td>
      <td className="px-6 py-4 text-sm text-gray-700">{module.manufacturer ?? 'N/A'}</td>
      <td className="px-6 py-4 text-sm">
        <span className="text-green-600 font-medium">● Healthy</span>
      </td>
    </tr>
  );
};

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, subtitle }) => {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">{icon}</div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
};

interface TableHeaderProps {
  label: string;
}

const TableHeader: React.FC<TableHeaderProps> = ({ label }) => {
  return (
    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
      {label}
    </th>
  );
};

export default MemorySection;
