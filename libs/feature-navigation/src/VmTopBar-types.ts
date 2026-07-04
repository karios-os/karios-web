// Define interfaces for VmTopBar component
export interface VM {
  id: string;
  name: string;
  status?: string;
  ip?: string;
  os?: string;
  state?: string;
}

export interface DataCenter {
  id: string;
  name: string;
  nodes: {
    ip: string;
    hostname: string;
    vms?: VM[];
  }[];
}

export interface LocationState {
  fromProvision?: boolean;
}

export interface VmContextState {
  selectedVm: VM | null;
  dataCenters: DataCenter[];
  setSelectedVm: (vm: VM | null) => void;
}
