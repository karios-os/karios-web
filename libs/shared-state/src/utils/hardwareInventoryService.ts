/**
 * Hardware Inventory Types
 */
export interface BiOSSettings {
  iommu?: {
    description: string | null;
    label: string | null;
    value: string | null;
  };
  pxe_ipv4?: {
    description: string | null;
    label: string | null;
    value: boolean | null;
  };
  rebar?: {
    description: string | null;
    label: string | null;
    value: boolean | null;
  };
  sriov?: {
    description: string | null;
    label: string | null;
    value: boolean | null;
  };
  svm?: {
    description: string | null;
    label: string | null;
    value: boolean | null;
  };
}

export interface BiOS {
  date: string | null;
  settings: BiOSSettings | null;
  version: string | null;
}

export interface BMC {
  firmware_version: string | null;
  ip_address: string | null;
  last_reset: string | null;
  model: string | null;
  uuid: string | null;
  vendor: string | null;
}

export interface ControlNode {
  ip_address: string | null;
  is_control_node: boolean;
}

export interface CPU {
  count: number;
  max_speed_mhz: number;
  microcode: string | null;
  model: string | null;
  tdp_watts: number | null;
  total_cores: number;
  total_threads: number;
}

export interface DeviceType {
  is_full_depth: boolean | null;
  manufacturer: string | null;
  model: string | null;
  u_height: number | null;
}

export interface MemoryModule {
  manufacturer: string | null;
  serial: string | null;
  size_gb: number | null;
  slot: string | null;
  speed_mhz: number | null;
  type: string | null;
}

export interface Memory {
  modules: MemoryModule[] | null;
  os_available_gb: number | null;
  os_total_gb: number | null;
  total_gib: number | null;
}

export interface Network {
  interface_count: number | null;
  primary_mac: string | null;
}

export interface OperatingSystem {
  primary_mac: string | null;
  uptime_hours: number | null;
}

export interface PCIeSummary {
  pcie_encryption_controller_count: number;
  pcie_gpu_count: number;
  pcie_gpu_models: string[];
  pcie_iommu_count: number;
  pcie_nic_10g_count: number;
  pcie_nic_1g_count: number;
  pcie_nic_models: string[];
  pcie_nic_total: number;
  pcie_nvme_count: number;
  pcie_nvme_models: string[];
  pcie_sata_controller_count: number;
  pcie_usb_controller_count: number;
}

export interface RackInfo {
  airflow: string | null;
  name: string | null;
  position_u: number | null;
  site: {
    name: string | null;
    slug: string | null;
  } | null;
  slug: string | null;
  u_height: number | null;
}

export interface StorageDevice {
  model: string | null;
  name: string | null;
  rotational: number | null;
  size: string | null;
  type: string | null;
}

export interface Storage {
  devices: StorageDevice[] | null;
  total_capacity_gb: number | null;
}

export interface SystemInfo {
  health: string | null;
  manufacturer: string | null;
  model: string | null;
  power_state: boolean;
  status: string | null;
  uuid: string | null;
}

export interface HardwareInventory {
  asset_tag: string | null;
  bios: BiOS;
  bmc: BMC;
  control_node: ControlNode;
  cpu: CPU;
  device_type: DeviceType;
  display_name: string;
  id: number;
  memory: Memory;
  name: string;
  network: Network;
  operating_system: OperatingSystem;
  pcie_summary: PCIeSummary;
  rack: RackInfo;
  role: string;
  status: string;
  storage: Storage;
  system: SystemInfo;
}

export interface HardwareInventoryResponse {
  data: HardwareInventory;
  error?: string;
  message?: string;
}


/**
 * Format storage size for display
 */
export const formatStorageSize = (sizeStr: string): string => {
  if (!sizeStr) return '0 GB';
  return sizeStr;
};

/**
 * Format memory size
 */
export const formatMemorySize = (sizeGb: number): string => {
  if (sizeGb >= 1024) {
    return `${(sizeGb / 1024).toFixed(2)} TB`;
  }
  return `${sizeGb} GB`;
};

/**
 * Format speed
 */
export const formatSpeed = (speedMhz: number): string => {
  if (speedMhz >= 1000) {
    return `${(speedMhz / 1000).toFixed(2)} GHz`;
  }
  return `${speedMhz} MHz`;
};

/**
 * Calculate total memory
 */
export const calculateTotalMemory = (modules: MemoryModule[] | null | undefined): number => {
  if (!modules || !Array.isArray(modules)) return 0;
  return modules.reduce((total, module) => total + (module.size_gb ?? 0), 0);
};
