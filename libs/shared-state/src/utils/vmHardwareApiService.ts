/**
 * VM Hardware API Service
 *
 * This service provides functions for fetching and managing VM hardware details,
 * including storage, networking, PCIe devices, and other hardware components.
 * All API calls should go through these functions instead of direct api.fetch calls.
 */

import api from './interceptor';
import envConfig from '../../../../runtime-config';

/**
 * Payload for attaching a disk to a VM
 * Note: Either zvol_path or iso must be provided
 */
export interface AttachDiskPayload {
  vmname: string;
  datastore: string;
  size?: string;
  zvol_path?: string;
  zvol_name?: string;
  disk_no?: number;
  disk_type: string;
  disk_dev: string;
  iso?: string;
}

/**
 * Payload for detaching a disk from a VM
 */
export interface DetachDiskPayload {
  vmname: string;
  datastore: string;
  disk_no?: number;
}

/**
 * Fetch PCIe devices for a VM
 */
export const fetchPcieDevices = async (serverAddress: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/pci_devices`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PCIe devices: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Fetch sliceable PCI devices info (SR-IOV mapping)
 */
export const fetchPciSliceableInfo = async (serverAddress: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/get_pci_sliceable`
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
};

/**
 * Attach PCIe devices to a VM
 */
export const attachPcieDevices = async (
  serverAddress: string,
  vmName: string,
  payload: any,
  datastore?: string
) => {
  const datastoreParam = datastore ? `&datastore=${datastore}` : '';
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/pci_action?vm_name=${vmName}${datastoreParam}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to attach PCIe devices: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Fetch system information (CPU, memory, etc.)
 */
export const fetchSystemInfo = async (serverAddress: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/system/info`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch system info: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Fetch node information
 */
export const fetchNodeInfo = async (serverAddress: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/nodeinfo`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch node info: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Fetch network interface information
 */
export const fetchNetworkInterfaces = async (serverAddress: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/interfaces`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch network interfaces: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
};

/**
 * Fetch switch information
 */
export const fetchSwitchInfo = async (serverAddress: string, switchName: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch_info?switch_name=${switchName}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch switch info: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Fetch cluster details for a VM
 */
export const fetchClusterDetails = async (serverAddress: string, vmName: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/cluster/details/${vmName}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch cluster details: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Fetch unused disks for a VM
 */
export const fetchUnusedDisks = async (
  serverAddress: string,
  vmName: string,
  datastore: string
) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/vm/unused_disks/${vmName}?datastore=${datastore}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch unused disks');
  }

  return await response.json();
};

/**
 * Fetch VM information
 */
export const fetchVmInfo = async (serverAddress: string, vmName: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch VM info: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Fetch network drivers
 */
export const fetchNetworkDrivers = async (serverAddress: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/drivers`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch network drivers: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Fetch network switches (VM-specific, simplified)
 */
export const fetchVmNetworkSwitches = async (serverAddress: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch network switches: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Attach network switch to VM
 */
export const attachNetworkSwitch = async (serverAddress: string, payload: any) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch/vm/attach`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to attach network switch');
  }

  return await response.json();
};

/**
 * Update network switch for VM
 */
export const updateNetworkSwitch = async (serverAddress: string, payload: any) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch/vm/update`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update network switch');
  }

  return await response.json();
};

/**
 * Detach network switch from VM
 */
export const detachNetworkSwitch = async (serverAddress: string, payload: any) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch/vm/detach`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to detach network switch');
  }

  return await response.json();
};

/**
 * Remove disk from VM
 */
export const removeDiskFromVm = async (serverAddress: string, payload: DetachDiskPayload) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/vm/detach_disk`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to detach disk');
  }

  return await response.json();
};

/**
 * Fetch CD/DVD drives for a VM
 */
export const fetchCdDvdDrives = async (serverAddress: string, vmName: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}/cd-drives`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch CD/DVD drives');
  }

  return await response.json();
};

/**
 * Update CD/DVD drives for a VM
 */
export const updateCdDvdDrives = async (serverAddress: string, vmName: string, payload: any) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}/cd-drives`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update CD/DVD drives');
  }

  return await response.json();
};

/**
 * Fetch cluster VMs for a specific cluster or all clusters
 * Returns the full cluster object with metadata (KubernetesClusterName, zoneName, vms, etc.)
 */
export const fetchClusterVMs = async (clusterName?: string): Promise<any> => {
  try {
    let response;

    if (clusterName) {
      // Try the specific cluster endpoint first
      response = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info?cluster_name=${clusterName}`
      );

      // If that fails, try the general endpoint and filter
      if (!response.ok) {
        response = await api.fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`
        );
      }
    } else {
      // Fetch all clusters
      response = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`
      );
    }

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    // Handle different response formats
    if (clusterName) {
      if (
        data &&
        data.cluster &&
        data.cluster.vms &&
        data.cluster.KubernetesClusterName === clusterName
      ) {
        // Return the full cluster object to preserve metadata (KubernetesClusterName, zoneName, etc.)
        return data.cluster;
      } else if (data && data.clusters && data.clusters.length > 0) {
        const clusterData = data.clusters.find(
          (cluster: any) => cluster.KubernetesClusterName === clusterName
        );
        // Return the full cluster object if found, otherwise empty object with empty vms array
        return clusterData || { vms: [] };
      } else if (data && data.vms && data.KubernetesClusterName === clusterName) {
        // Return full data object which includes metadata
        return data;
      } else if (Array.isArray(data)) {
        // If it's just an array, wrap it in an object structure
        return { vms: data };
      }
    }

    return { vms: [] };
  } catch (error) {
    return [];
  }
};

/**
 * Update VM hardware configuration (CPU, memory, etc.)
 */
export const updateVmHardware = async (serverAddress: string, payload: any, approver?: string) => {
  let updateUrl = `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/update`;
  if (approver) {
    const urlParams = new URLSearchParams();
    urlParams.append('approver', approver);
    updateUrl += `?${urlParams.toString()}`;
  }

  const response = await api.fetch(updateUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update VM: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Attach disk to VM
 */
export const attachDiskToVm = async (serverAddress: string, payload: AttachDiskPayload) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/vm/attach_disk`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to attach disk.');
  }

  return await response.json();
};

/**
 * Destroy ZFS dataset
 */
export const destroyZfsDataset = async (
  serverAddress: string,
  datasetName: string,
  poolName: string,
  approver?: string
) => {
  let url = `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/destroy_dataset`;
  if (approver) {
    url += `?approver=${encodeURIComponent(approver)}`;
  }

  const response = await api.fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_name: datasetName, pool_name: poolName }),
  });

  if (!response.ok) {
    throw new Error('Failed to destroy dataset.');
  }

  return await response.json();
};

/**
 * Fetch all VMs on server
 */
export const fetchAllVms = async (serverAddress: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch VMs');
  }

  return await response.json();
};

/**
 * Fetch ISO list (direct fetch without dispatch)
 */
export const fetchIsoListDirect = async (serverAddress: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/iso/list`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch ISO list');
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

/**
 * Perform OS installation on VM
 */
export const performOsInstall = async (
  serverAddress: string,
  vmName: string,
  isoFile: string,
  datastore?: string
) => {
  const datastoreParam = datastore ? `?datastore=${encodeURIComponent(datastore)}` : '';
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vmName}/os_install${datastoreParam}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_cloud_image: true, iso: isoFile }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to perform OS install');
  }

  return await response.json();
};

/**
 * Set VM to start on hostboot
 */
export const setVmStartOnHostboot = async (
  serverAddress: string,
  vmName: string,
  datastore?: string,
  approver?: string
) => {
  let url = `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/start_on_hostboot`;
  const params = new URLSearchParams();
  if (datastore) params.append('datastore', datastore);
  if (approver) params.append('approver', approver);
  if (params.toString()) {
    url += `?${params.toString()}`;
  }

  const response = await api.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vm_name: vmName }),
  });

  if (!response.ok) {
    throw new Error('Failed to set start on hostboot');
  }

  return await response.json();
};

/**
 * Remove VM from hostboot
 */
export const removeVmFromHostboot = async (
  serverAddress: string,
  vmName: string,
  approver?: string
) => {
  let url = `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/remove_from_hostboot/${vmName}`;
  if (approver) {
    url += `?approver=${encodeURIComponent(approver)}`;
  }

  const response = await api.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to remove from hostboot');
  }

  return await response.json();
};

/**
 * Check console response for VM
 */
export const checkConsoleResponse = async (serverAddress: string, vmName: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/console/${vmName}`
  );

  if (!response.ok) {
    throw new Error('Failed to check console response');
  }

  return await response.json();
};

/**
 * Create VNC console for VM
 */
export const createVncConsole = async (serverAddress: string, vmName: string, vmMac?: string) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/console/create`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vm_name: vmName,
        vm_mac: vmMac,
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to create VNC console');
  }

  return await response.json();
};

/**
 * Reassign ZFS disk
 */
export const reassignZfsDisk = async (
  serverAddress: string,
  payload: {
    dataset_name: string;
    vm_name: string;
    disk_no: number;
    disk_size?: string;
    [key: string]: any;
  }
) => {
  const response = await api.fetch(
    `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/vm/reassign_disk`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to reassign disk');
  }

  return await response.json();
};
