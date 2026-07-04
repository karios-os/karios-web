// TypeScript interfaces for VM Step components
import { ChangeEvent } from 'react';

// Common interfaces
export interface Server {
  id: string;
  name: string;
  ip: string;
  fqdn?: string;
  hostname?: string;
  status?: string;
}

export interface DataCenter {
  id: string;
  name: string;
  servers: Server[];
  isOpen?: boolean;
}

export interface VM {
  id: string;
  name: string;
  datastore?: string;
  state?: string;
  status?: string;
  isOn?: boolean;
}

export interface Permissions {
  [key: string]: boolean; // Dynamic keys instead of hardcoded ones
}

// Node limits for hardware validation
export interface NodeLimits {
  sockets: number;
  cpus: number;
  memoryGB: number;
}

// Storage pool interface
export interface StoragePool {
  name?: string;
  NAME?: string;
  free?: string;
  FREE?: string;
  available?: string;
  used?: string;
  type?: string;
  path?: string;
  size?: string;
  SIZE?: string;
  [key: string]: any;
}

// VM Details component props
export interface VmDetailsProps {
  vmName: string;
  handleVmNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  nameError: string;
  loader: string;
  setLoader: (loader: string) => void;
  setUefiVars: (vars: string) => void;
  osType: string;
  setOsType: (osType: string) => void;
  selectedServerIp: string;
  setSelectedServerIp: (ip: string) => void;
  permissions: Permissions;
}

// VM Hardware component props
export interface VmHardwareProps {
  sockets: number;
  setSockets: (sockets: number) => void;
  value: number;
  setValue: (value: number) => void;
  memory: number;
  setMemory: (memory: number) => void;
  nodeLimits: NodeLimits;
  permissions: Permissions;
}

// VM Network component props
export interface VmNetworkProps {
  network0Type: string;
  setNetwork0Type: (type: string) => void;
  network0Switch: string;
  setNetwork0Switch: (switchName: string) => void;
  networkDrivers: string[];
  networkSwitches: string[];
  permissions: Permissions;
}

// VM Storage component props
export interface VmStorageProps {
  selectedPool: string;
  setSelectedPool: (pool: string) => void;
  disk0Size: number | undefined;
  handleDiskSizeChange: (size: number | undefined) => void;
  pools: StoragePool[];
  permissions: Permissions;
}
