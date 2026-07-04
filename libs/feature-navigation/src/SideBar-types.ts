// Define interfaces for SideBar component
export interface VirtualMachine {
  id: string;
  name: string;
  state?: string;
  status?: string;
  ip?: string;
  os?: string;
  datastore?: string;
  isOn?: boolean;
  uuid?: string;
  hostname?: string; // Node hostname (e.g., test2-launch.wynbit.com)
}

export interface ServerNode {
  id: string;
  ip: string;
  fqdn?: string; // Fully qualified domain name (FQDN) - preferred over IP
  hostname: string;
  name: string;
  status: string;
  servers?: ServerNode[];
  vms?: VirtualMachine[];
}

export interface DataCenter {
  id: string;
  name: string;
  nodes: ServerNode[];
  servers: ServerNode[];
}

export interface OpenServersState {
  [key: string]: boolean;
}

export interface CloneModalState {
  isOpen: boolean;
  vmName: string;
  serverIp: string;
  cloneName: string;
}

export interface NodeStatus {
  ip: string;
  status: string;
}

export interface ActionModalState {
  isOpen: boolean;
  action: string;
  vmName: string | null;
  serverIp: string | null;
}

export interface DeletePayload {
  datastore: string;
}
