import { api } from '@karios-monorepo/shared-state';
import { toast } from 'react-toastify';
import envConfig from '../../../../runtime-config';

/**
 * Attach a network switch to a VM
 */
export const attachNetworkSwitch = async (
  serverAddress: string,
  vmName: string,
  switchName: string,
  networkDriver: string,
  networkInterfaceNumber: number
): Promise<any> => {
  const payload = {
    vm_name: vmName,
    switch_name: switchName,
    network_driver: networkDriver,
    network_interface_number: networkInterfaceNumber,
  };

  try {
    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch/vm/attach`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed: ${res.status} - ${text}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to attach network switch:', err);
    throw err;
  }
};

/**
 * Update a network switch on a VM
 */
export const updateNetworkSwitch = async (
  serverAddress: string,
  vmName: string,
  switchName: string,
  networkDriver: string,
  networkInterfaceNumber: number,
  datastore: string
): Promise<any> => {
  const payload = {
    vm_name: vmName,
    switch_name: switchName,
    network_driver: networkDriver,
    network_interface_number: networkInterfaceNumber,
    datastore: datastore,
  };

  try {
    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch/vm/update`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed: ${res.status} - ${text}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to update network switch:', err);
    throw err;
  }
};

/**
 * Detach a network switch from a VM
 */
export const detachNetworkSwitch = async (
  serverAddress: string,
  vmName: string,
  networkInterfaceNumber: number,
  datastore: string
): Promise<any> => {
  const payload = {
    datastore: datastore,
    network_interface_number: networkInterfaceNumber,
    vm_name: vmName,
  };

  try {
    const res = await api.fetch(
      `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch/vm/detach`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to delete: ${res.status} - ${text}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to detach network switch:', err);
    throw err;
  }
};
