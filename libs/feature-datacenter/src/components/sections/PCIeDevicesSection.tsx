import React from 'react';
import { GiExpand } from 'react-icons/gi';
import { GrNetwork } from 'react-icons/gr';
import { HardwareInventory } from '../../../../shared-state/src/utils/hardwareInventoryService';

interface PCIeDevicesSectionProps {
  data: HardwareInventory;
}

const PCIeDevicesSection: React.FC<PCIeDevicesSectionProps> = ({ data }) => {
  return (
    <div className="rounded-lg border border-gray-300 p-6">
      <div className="flex items-center gap-3 mb-6">
        <GiExpand className="w-6 h-6 text-orange-600" />
        <h3 className="text-lg font-semibold text-gray-900">PCIe Devices Summary</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <PCIeCard
          label="GPUs"
          count={data.pcie_summary.pcie_gpu_count}
          models={data.pcie_summary.pcie_gpu_models}
        />
        <PCIeCard
          label="Network Interfaces"
          count={data.pcie_summary.pcie_nic_total}
          subtext={`10G: ${data.pcie_summary.pcie_nic_10g_count} | 1G: ${data.pcie_summary.pcie_nic_1g_count}`}
        />
        <PCIeCard label="NVMe Drives" count={data.pcie_summary.pcie_nvme_count} />
        <PCIeCard label="SATA Controllers" count={data.pcie_summary.pcie_sata_controller_count} />
        <PCIeCard label="IOMMU Units" count={data.pcie_summary.pcie_iommu_count} />
        <PCIeCard label="USB Controllers" count={data.pcie_summary.pcie_usb_controller_count} />
      </div>

      {data.pcie_summary.pcie_nic_models.length > 0 && (
        <PCIeModelsSection
          icon={<GrNetwork className="w-4 h-4 text-blue-600" />}
          title="Network Interface Models"
          models={data.pcie_summary.pcie_nic_models}
          bgColor="bg-blue-100"
          textColor="text-blue-800"
        />
      )}

      {data.pcie_summary.pcie_nvme_models.length > 0 && (
        <PCIeModelsSection
          title="NVMe Models"
          models={data.pcie_summary.pcie_nvme_models}
          bgColor="bg-green-100"
          textColor="text-green-800"
        />
      )}
    </div>
  );
};

interface PCIeCardProps {
  label: string;
  count: number;
  models?: string[];
  subtext?: string;
}

const PCIeCard: React.FC<PCIeCardProps> = ({ label, count, models, subtext }) => {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">{label}</p>
      <p className="text-sm text-gray-900">{count}</p>
      {subtext && <p className="text-xs text-gray-600 mt-2">{subtext}</p>}
      {models && models.length > 0 && <p className="text-xs text-gray-600 mt-2">{models[0]}</p>}
    </div>
  );
};

interface PCIeModelsSectionProps {
  title: string;
  models: string[];
  bgColor: string;
  textColor: string;
  icon?: React.ReactNode;
}

const PCIeModelsSection: React.FC<PCIeModelsSectionProps> = ({
  title,
  models,
  bgColor,
  textColor,
  icon,
}) => {
  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-sm font-semibold text-gray-900">{title}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {models.map((model, idx) => (
          <span key={idx} className={`px-2 py-1 ${bgColor} ${textColor} text-xs rounded`}>
            {model}
          </span>
        ))}
      </div>
    </div>
  );
};

export default PCIeDevicesSection;
