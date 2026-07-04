import React, { useState, useEffect } from 'react';
import { Trash } from 'iconsax-react';
import Modal from '../../../shared-state/src/widgets/Modal';
import DataTable from '../../../shared-state/src/widgets/DataTable';
import Tooltip from '../../../shared-state/src/widgets/Tooltip';
import { StatusBadge } from '../../../../apps/karios-gui/src/Components';
import envConfig from '../../../../runtime-config';
import { useApprovalFlow } from '../../../shared-state/src/hooks/useApprovalFlow';
import ApprovalModal from '../../../shared-state/src/components/ApprovalModal';
import { api, useAppState } from '@karios-monorepo/shared-state';
import { createComponentLogger } from '../../../shared-state/src/utils/logger';

interface iSCSIStorageItem {
  target: string;
  portal: string;
  status: string;
  devices: string[];
}

interface MultipathComponent {
  device: string;
  status: string;
}

interface MultipathMount {
  name: string;
  status: string;
  components: MultipathComponent[];
}

interface CombinedStorageItem {
  type: 'target' | 'mount';
  target?: string;
  portal?: string;
  status: string;
  devices: string[];
  mountName?: string;
  components?: MultipathComponent[];
}

interface iSCSIStorageFormData {
  portal: string;
  target: string;
  username: string;
  password: string;
}

interface iSCSIMountFormData {
  multipath_name: string;
  devices: string[];
}

interface DeviceOption {
  value: string;
  label: string;
}

interface iSCSIStorageProps {
  selectedServer: {ip: string; fqdn?: string; name: string};
  onStorageTypeChange?: (storageType: string) => void;
  currentStorageType?: string;
}

const ISCSIStorage: React.FC<iSCSIStorageProps> = ({
  selectedServer,
  onStorageTypeChange,
  currentStorageType = 'iscsi',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMountModalOpen, setIsMountModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'success'>('error');
  const [storageData, setStorageData] = useState<iSCSIStorageItem[]>([]);
  const [multipathData, setMultipathData] = useState<MultipathMount[]>([]);
  const [combinedData, setCombinedData] = useState<CombinedStorageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<iSCSIStorageItem | null>(null);
  const [availableDevices, setAvailableDevices] = useState<DeviceOption[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [multipathName, setMultipathName] = useState('mp_disk');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create component logger
  const logger = createComponentLogger('iSCSIStorage');

  // Add approval flow hook
  const { executeWithApproval, isModalOpen: isApprovalModalOpen, modalProps } = useApprovalFlow();

  const showAlert = (message: string, type: 'error' | 'success' = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setIsAlertModalOpen(true);
  };

  const fetchDevicesForMount = async () => {
    try {
      const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/iscsi/targets`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && Array.isArray(data.iscsi_targets)) {
        // Extract all devices from all targets and create options
        const allDevices: DeviceOption[] = [];
        data.iscsi_targets.forEach((target: any) => {
          if (Array.isArray(target.devices)) {
            target.devices.forEach((device: string) => {
              if (!allDevices.find((d) => d.value === device)) {
                allDevices.push({
                  value: device,
                  label: device,
                });
              }
            });
          }
        });
        setAvailableDevices(allDevices);
      }
    } catch (err) {
      logger.error('Failed to fetch devices for mount', err);
      showAlert(
        `Failed to fetch devices: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    }
  };

  const handleMount = async () => {
    if (selectedDevices.length === 0) {
      showAlert('Please select at least one device to mount', 'error');
      return;
    }

    if (!multipathName.trim()) {
      showAlert('Please enter a multipath name', 'error');
      return;
    }

    try {
      const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;
      const payload: iSCSIMountFormData = {
        multipath_name: multipathName,
        devices: selectedDevices,
      };

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/iscsi/mount`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to mount devices: ${response.statusText}`);
      }

      setIsMountModalOpen(false);
      setSelectedDevices([]);
      setMultipathName('mp_disk');
      logger.info('iSCSI devices mounted successfully', {
        devices: selectedDevices,
        multipathName,
      });
      showAlert('Devices mounted successfully!', 'success');

      // Refresh the storage data
      await fetchStorageData();
    } catch (err) {
      logger.error('Failed to mount devices', { devices: selectedDevices, multipathName }, err);
      showAlert(
        `Failed to mount devices: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    }
  };

  const fetchStorageData = async () => {
    setLoading(true);
    setError(null);

    const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;
    let targets: iSCSIStorageItem[] = [];
    let mounts: MultipathMount[] = [];
    let targetsError = false;
    let mountsError = false;

    // Fetch iSCSI targets
    try {
      const targetsResponse = await api.fetch(
        `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/iscsi/targets`
      );

      if (targetsResponse.status === 204) {
        // No content for targets
        targets = [];
      } else if (targetsResponse.ok) {
        const targetsData = await targetsResponse.json();
        if (targetsData && Array.isArray(targetsData.iscsi_targets)) {
          targets = targetsData.iscsi_targets;
        }
      } else {
        // Failed to fetch iSCSI targets - but don't fail the entire operation
        logger.warn('Failed to fetch iSCSI targets', { status: targetsResponse.statusText });
        targetsError = true;
      }
    } catch (err) {
      logger.warn('Error fetching iSCSI targets', err);
      targetsError = true;
    }

    // Fetch multipath mounts
    try {
      const mountsResponse = await api.fetch(
        `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/iscsi`
      );

      if (mountsResponse.status === 204) {
        // No content for mounts
        mounts = [];
      } else if (mountsResponse.ok) {
        const mountsData = await mountsResponse.json();
        if (mountsData && Array.isArray(mountsData.iscsi_multipath_mounts)) {
          mounts = mountsData.iscsi_multipath_mounts;
        }
      } else {
        // Failed to fetch multipath mounts - but don't fail the entire operation
        logger.warn('Failed to fetch iSCSI multipath mounts', {
          status: mountsResponse.statusText,
        });
        mountsError = true;
      }
    } catch (err) {
      logger.warn('Error fetching iSCSI multipath mounts', err);
      mountsError = true;
    }

    // Show appropriate error messages based on what failed
    if (targetsError && mountsError) {
      setError('Failed to load iSCSI storage data: Unable to connect to storage services');
      setStorageData([]);
      setMultipathData([]);
      setCombinedData([]);
      setLoading(false);
      return;
    } else if (mountsError) {
      setError('Failed to fetch iSCSI multipath mounts');
    }

    // Combine both data types
    const combined: CombinedStorageItem[] = [];

    // Add targets
    targets.forEach((target) => {
      combined.push({
        type: 'target',
        target: target.target,
        portal: target.portal,
        status: target.status,
        devices: target.devices || [],
      });
    });

    // Add mounts
    mounts.forEach((mount) => {
      combined.push({
        type: 'mount',
        mountName: mount.name,
        status: mount.status,
        devices: mount.components ? mount.components.map((c) => c.device) : [],
        components: mount.components,
      });
    });

    setStorageData(targets);
    setMultipathData(mounts);
    setCombinedData(combined);

    // Clear any previous errors only if both calls succeeded
    if (!targetsError && !mountsError) {
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const initializeComponent = async () => {
      // First connect to targets
      // Then fetch the targets data
      if (selectedServer) {
        await fetchStorageData();
      }
    };

    initializeComponent();
  }, [selectedServer]);

  const handleDisconnect = async (item: iSCSIStorageItem) => {
    // Execute with approval flow for DELETE request
    await executeWithApproval(async (approver?: string) => {
      try {
        const payload = {
          portal: item.portal,
          target: item.target,
        };

        const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;

        // Build API URL with approver as query parameter if provided
        let apiUrl = `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/iscsi/target/disconnect`;
        if (approver) {
          const urlParams = new URLSearchParams();
          urlParams.append('approver', approver);
          apiUrl += `?${urlParams.toString()}`;
        }

        const response = await api.fetch(apiUrl, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to disconnect from target: ${response.statusText}`);
        }

        fetchStorageData();
        logger.info('iSCSI target disconnected successfully', {
          target: item.target,
          portal: item.portal,
        });
        showAlert('iSCSI target disconnected successfully!', 'success');
      } catch (err) {
        logger.error(
          'Failed to disconnect from iSCSI target',
          { target: item.target, portal: item.portal },
          err
        );
        showAlert(
          `Failed to disconnect from iSCSI target: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
      }
    }, 'Disconnect iSCSI Target');
  };

  const handleUnmount = async (mount: CombinedStorageItem) => {
    if (!mount.mountName || !mount.components || mount.components.length === 0) {
      showAlert('No components found to unmount', 'error');
      return;
    }

    try {
      const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;

      // Extract multipath name from the full mount name (e.g., "multipath/mp_disk" -> "mp_disk")
      const multipathName = mount.mountName.includes('/')
        ? mount.mountName.split('/').pop()
        : mount.mountName;

      // Unmount each component/device
      for (const component of mount.components) {
        const payload = {
          multipath_name: multipathName,
          device: component.device,
        };

        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/iscsi/component/delete`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to unmount device ${component.device}: ${response.statusText}`);
        }
      }

      await fetchStorageData();
      showAlert(`Multipath mount '${mount.mountName}' unmounted successfully!`, 'success');
    } catch (err) {
      logger.error('Failed to unmount iSCSI multipath mount', { mountName: mount.mountName }, err);
      showAlert(
        `Failed to unmount multipath mount: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    }
  };

  const handleDestroyMultipath = async (mount: CombinedStorageItem) => {
    if (!mount.mountName) {
      showAlert('No multipath name found to destroy', 'error');
      return;
    }

    // Show confirmation dialog
    if (
      !window.confirm(
        `Are you sure you want to destroy the entire multipath '${mount.mountName}'? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;

      // Extract multipath name from the full mount name (e.g., "multipath/mp_disk" -> "mp_disk")
      const multipathName = mount.mountName.includes('/')
        ? mount.mountName.split('/').pop()
        : mount.mountName;

      const payload = {
        multipath_name: multipathName,
      };

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/iscsi/destroy`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to destroy multipath: ${response.statusText}`);
      }

      await fetchStorageData();
      showAlert(`Multipath '${mount.mountName}' destroyed successfully!`, 'success');
    } catch (err) {
      logger.error('Failed to destroy iSCSI multipath', { mountName: mount.mountName }, err);
      showAlert(
        `Failed to destroy multipath: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    }
  };

  // function to handle form submission for iSCSI storage
  const handleFormSubmit = async (formData: iSCSIStorageFormData) => {
    // Execute with approval flow for POST request
    await executeWithApproval(async (approver?: string) => {
      setIsSubmitting(true);
      const payload = {
        portal: formData.portal,
        target: formData.target,
        username: formData.username,
        password: formData.password,
      };

      try {
        const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;

        // Build API URL with approver as query parameter if provided
        let apiUrl = `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/iscsi/target/connect`;
        if (approver) {
          const urlParams = new URLSearchParams();
          urlParams.append('approver', approver);
          apiUrl += `?${urlParams.toString()}`;
        }

        const response = await api.fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to connect to target: ${response.statusText}`);
        }

        setIsModalOpen(false);
        fetchStorageData();
        logger.info('iSCSI target connected successfully', {
          target: payload.target,
          portal: payload.portal,
        });
        showAlert('iSCSI target connected successfully!', 'success');
      } catch (err) {
        logger.error(
          'Failed to connect to iSCSI target',
          { target: payload.target, portal: payload.portal },
          err
        );
        showAlert(
          `Failed to connect to iSCSI target: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
      } finally {
        setIsSubmitting(false);
      }
    }, 'Connect iSCSI Target');
  };

  // Modal content for iSCSI storage
  const renderModalContent = () => {
    return (
      <>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="portal" className="block text-sm font-medium text-gray-700">
                Portal
              </label>
              <Tooltip text="An iSCSI portal is the combination of an IP address and TCP port (typically 3260) that defines a specific endpoint for initiating or accepting iSCSI connections, essentially acting as the doorway for communication between an initiator and target." />
            </div>
            <input
              id="portal"
              type="text"
              name="portal"
              defaultValue={selectedItem?.portal || ''}
              // placeholder="192.168.116.113"
              placeholder=""
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="target" className="block text-sm font-medium text-gray-700">
                Target
              </label>
              <Tooltip text="An iSCSI target is a storage device (like a disk array or NAS) that presents itself over an IP network using the iSCSI protocol, allowing clients to access its storage as if it were locally attached." />
            </div>
            <input
              id="target"
              type="text"
              name="target"
              defaultValue={selectedItem?.target || ''}
              placeholder="iqn.store.ai.karios:storage.lun1"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <Tooltip text="An iSCSI username is a credential used for authentication when connecting to an iSCSI target, ensuring only authorized initiators can access the shared storage." />
            </div>
            <input
              id="username"
              type="text"
              name="username"
              // defaultValue="admin"
              defaultValue=""
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Tooltip text="An iSCSI password, paired with a username, provides secure authentication for clients accessing an iSCSI target, verifying their identity before granting storage access." />
            </div>
            <input
              id="password"
              type="password"
              name="password"
              // defaultValue="secretpassword"
              defaultValue=""
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </>
    );
  };

  // Modal content for mounting devices
  const renderMountModalContent = () => {
    return (
      <div className="space-y-4">
        <div>
          <label htmlFor="multipath_name" className="block text-sm font-medium text-gray-700">
            Multipath Name
          </label>
          <input
            id="multipath_name"
            type="text"
            value={multipathName}
            onChange={(e) => setMultipathName(e.target.value)}
            placeholder="mp_disk"
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Devices</label>
          <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
            {availableDevices.length > 0 ? (
              availableDevices.map((device) => (
                <label key={device.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    value={device.value}
                    checked={selectedDevices.includes(device.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDevices([...selectedDevices, device.value]);
                      } else {
                        setSelectedDevices(selectedDevices.filter((d) => d !== device.value));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{device.label}</span>
                </label>
              ))
            ) : (
              <p className="text-sm text-gray-500">
                No devices available. Please ensure iSCSI targets are connected.
              </p>
            )}
          </div>
          {selectedDevices.length > 0 && (
            <p className="text-xs text-gray-600 mt-1">Selected: {selectedDevices.join(', ')}</p>
          )}
        </div>
      </div>
    );
  };

  // Define table columns for combined iSCSI data
  const tableColumns = [
    {
      key: 'type',
      header: 'Type',
      render: (value: string) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            value === 'target' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
          }`}
        >
          {value === 'target' ? 'Target' : 'Mount'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name/Target',
      className: 'truncate max-w-[300px]',
      render: (value: any, item: CombinedStorageItem) => {
        return item.type === 'target' ? item.target : item.mountName;
      },
    },
    {
      key: 'portal',
      header: 'Portal',
      render: (value: any, item: CombinedStorageItem) => {
        return item.type === 'target' ? item.portal : '-';
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: 'devices',
      header: 'Devices',
      render: (value: string[], item: CombinedStorageItem) => {
        if (item.type === 'mount' && item.components) {
          return (
            <div className="space-y-1">
              {item.components.map((comp, idx) => (
                <div key={idx} className="text-xs">
                  <span className="font-mono">{comp.device}</span>
                  <span
                    className={`ml-2 px-1 py-0.5 rounded text-xs ${
                      comp.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {comp.status}
                  </span>
                </div>
              ))}
            </div>
          );
        }
        return Array.isArray(value) ? value.join(', ') : '-';
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-center whitespace-nowrap',
      headerClassName: 'text-center',
      render: (value: any, item: CombinedStorageItem) => {
        if (item.type === 'target') {
          // Convert CombinedStorageItem to iSCSIStorageItem for target actions
          const targetItem: iSCSIStorageItem = {
            target: item.target!,
            portal: item.portal!,
            status: item.status,
            devices: item.devices,
          };

          return (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => handleDisconnect(targetItem)}
                className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 focus:outline-none text-xs"
                title="Disconnect"
              >
                <Trash color="#FFFFFF" size={14} />
                <span className="ml-1">Disconnect</span>
              </button>
            </div>
          );
        } else {
          // Mount actions (e.g., unmount)
          return (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => handleUnmount(item)}
                className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-orange-600 text-white hover:bg-orange-700 focus:outline-none text-xs"
                title="Unmount"
              >
                <Trash color="#FFFFFF" size={14} />
                <span className="ml-1">Remove device</span>
              </button>
              <button
                onClick={() => handleDestroyMultipath(item)}
                className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 focus:outline-none text-xs"
                title="Destroy multipath"
              >
                <Trash color="#FFFFFF" size={14} />
                <span className="ml-1">Destroy path</span>
              </button>
            </div>
          );
        }
      },
    },
  ];

  const storageOptions = [
    { value: 'moosefs', label: 'MooseFS' },
    { value: 's3', label: 'S3' },
    { value: 'iscsi', label: 'iSCSI' },
    { value: 'nfs', label: 'NFS' },
    { value: 'smb', label: 'SMB/CIFS' },
    // { value: 'seaweed', label: 'SeaweedFS' },
  ];

  return (
    <>
      <div className="flex justify-between items-center m-7 w-[96%]">
        <h2 className="text-xl font-semibold">iSCSI Storage</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedItem(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-karios-blue text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Connect to iSCSI Target
          </button>
          {onStorageTypeChange && (
            <div className="relative">
              <select
                className="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded leading-tight focus:outline-none focus:border-blue-500 appearance-none"
                value={currentStorageType}
                onChange={(e) => onStorageTypeChange(e.target.value)}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '2.5rem',
                }}
              >
                {storageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-white rounded-lg shadow">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        ) : !Array.isArray(combinedData) || combinedData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No iSCSI storage items found</div>
        ) : (
          <DataTable
            data={combinedData}
            columns={tableColumns}
            hoverable={true}
            className="p-0"
            maxHeight="500px"
          />
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Connect to iSCSI Target"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const storageFormData: iSCSIStorageFormData = {
              portal: formData.get('portal') as string,
              target: formData.get('target') as string,
              username: formData.get('username') as string,
              password: formData.get('password') as string,
            };
            handleFormSubmit(storageFormData);
          }}
        >
          {renderModalContent()}
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-md text-white ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Mount Modal */}
      <Modal
        isOpen={isMountModalOpen}
        onClose={() => {
          setIsMountModalOpen(false);
          setSelectedDevices([]);
          setMultipathName('mp_disk');
        }}
        title="Mount iSCSI Devices"
      >
        {renderMountModalContent()}
        <div className="flex justify-end mt-4 space-x-2">
          <button
            onClick={() => {
              setIsMountModalOpen(false);
              setSelectedDevices([]);
              setMultipathName('mp_disk');
            }}
            className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleMount}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Mount
          </button>
        </div>
      </Modal>

      {/* Alert Modal */}
      <Modal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        title={alertType === 'error' ? 'Error' : 'Success'}
        width="400px"
      >
        <div className="text-center">
          <div
            className={`mb-4 p-3 rounded-md ${
              alertType === 'error'
                ? 'bg-red-100 border border-red-400 text-red-700'
                : 'bg-green-100 border border-green-400 text-green-700'
            }`}
          >
            {alertMessage}
          </div>
          <button
            onClick={() => setIsAlertModalOpen(false)}
            className={`px-4 py-2 rounded-md text-white focus:outline-none ${
              alertType === 'error'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            OK
          </button>
        </div>
      </Modal>

      {/* Approval Modal for iSCSI Storage Operations */}
      {isApprovalModalOpen && <ApprovalModal {...modalProps} />}
    </>
  );
};

export default ISCSIStorage;
