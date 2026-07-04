// ISO Hardware Reveal Types

export interface IsoBuildPayload {
  control_node_ip: string;
  bmc_ip: string;
}

export interface IsoJobResponse {
  job_id: string;
  status: string;
}

export interface IsoJobStatus {
  job_id: string;
  status: 'started' | 'building' | 'ready' | 'error' | 'completed' | 'failed';
  download_url?: string;
  error?: string;
  iso_file?: string;
}

// ISO List Types
export interface IsoFileInfo {
  name: string;
  size?: number;
  created?: string;
  path?: string;
}

export interface IsoListResponse {
  count: number;
  isos: string[];
}

// ISO Mount Types
export interface IsoMountPayload {
  bmc_ip: string;
  iso_file: string;
  control_node_ip: string;
}

export interface IsoMountResponse {
  status: string;
  message: string;
  steps?: string[];
}
