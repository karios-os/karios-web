import React, { useState, useEffect } from 'react';
import { Trash } from 'iconsax-react';
import Modal from '../../../shared-state/src/widgets/Modal';
import DataTable from '../../../shared-state/src/widgets/DataTable';
import Tooltip from '../../../shared-state/src/widgets/Tooltip';
import envConfig from '../../../../runtime-config';
import { api } from '@karios-monorepo/shared-state';
import { useApprovalFlow } from '../../../shared-state/src/hooks/useApprovalFlow';
import ApprovalModal from '../../../shared-state/src/components/ApprovalModal';
import { createComponentLogger } from '../../../shared-state/src/utils/logger';

interface NFSStorageItem {
  id?: string;
  server?: string;
  export?: string;
  directory?: string;
  size?: string;
  used?: string;
  available?: string;
  capacity?: string;
  mounted_on?: string;
  auto_mount_on_restart?: boolean;
  nfs_version?: string;
  add_to_datastore?: boolean;
  enable_pnfs?: boolean;
  mount_path?: string;
}

interface NFSStorageFormData {
  id: string;
  server: string;
  export: string;
  auto_mount_on_restart: boolean;
  nfs_version: string;
  add_to_datastore: boolean;
  enable_pnfs: boolean;
}

interface NFSStorageProps {
  selectedServer: {ip: string; fqdn?: string; name: string};
  onStorageTypeChange?: (storageType: string) => void;
  currentStorageType?: string;
}

const NFSStorage: React.FC<NFSStorageProps> = ({
  selectedServer,
  onStorageTypeChange,
  currentStorageType = 'nfs',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'success'>('error');
  const [storageData, setStorageData] = useState<NFSStorageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<NFSStorageItem | null>(null);

  // Create component logger
  const logger = createComponentLogger('NFSStorage');

  // Add approval flow hook
  const { executeWithApproval, isModalOpen: isApprovalModalOpen, modalProps } = useApprovalFlow();

  // Two-step modal states
  const [modalStep, setModalStep] = useState<'server' | 'form'>('server');
  const [selectedServerForForm, setSelectedServerForForm] = useState<string>('');
  const [nfsExports, setNfsExports] = useState<string[]>([]);
  const [fetchingExports, setFetchingExports] = useState<boolean>(false);

  const showAlert = (message: string, type: 'error' | 'success' = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setIsAlertModalOpen(true);
  };

  const fetchStorageData = async () => {
    setLoading(true);
    setError(null);
    try {
      const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/nfs`
      );
      if (response.status === 204) {
        // No content - empty array, not an error
        setStorageData([]);
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch NFS data: ${response.statusText}`);
      }
      const data = await response.json();
      // Ensure data is an array
      if (Array.isArray(data)) {
        setStorageData(data);
      } else {
        // API did not return an array
        setStorageData([]);
      }
    } catch (err) {
      logger.error('Failed to fetch NFS storage data', err);
      setError(
        `Failed to load NFS storage data: ${err instanceof Error ? err.message : String(err)}`
      );
      setStorageData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorageData();
  }, [selectedServer]);

  const fetchNfsExports = async (server: string) => {
    setFetchingExports(true);
    try {
      const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;
        const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/nfs/exports`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            server: server,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch NFS exports: ${response.statusText}`);
      }

      const data = await response.json();
      setNfsExports(data.nfs_exports || []);
      setSelectedServerForForm(server);
      setModalStep('form');
    } catch (err) {
      logger.error('Failed to fetch NFS exports', { server }, err);
      showAlert(
        `Failed to fetch NFS exports: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    } finally {
      setFetchingExports(false);
    }
  };

  const handleUnmount = async (mountPath: string) => {
    // Execute with approval flow for DELETE request
    await executeWithApproval(async (approver?: string) => {
      try {
        const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;

        // Build API URL with approver as query parameter if provided
        let apiUrl = `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/nfs/unmount`;
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
          body: JSON.stringify({
            mount_point: mountPath,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to unmount: ${response.statusText}`);
        }

        // Refresh the data after successful unmount
        fetchStorageData();
        logger.info('NFS storage unmounted successfully', { mountPath });
        showAlert('NFS storage unmounted successfully!', 'success');
      } catch (err) {
        logger.error('Failed to unmount NFS storage', { mountPath }, err);
        showAlert(
          `Failed to unmount NFS storage: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
      }
    }, 'Unmount NFS Storage');
  };

  // function to handle form submission for NFS storage
  const handleFormSubmit = async (formData: NFSStorageFormData) => {
    // Execute with approval flow for POST request
    await executeWithApproval(async (approver?: string) => {
      const payload = {
        id: formData.id,
        server: formData.server,
        export: formData.export,
        auto_mount_on_restart: formData.auto_mount_on_restart,
        nfs_version: formData.nfs_version,
        add_to_datastore: formData.add_to_datastore,
        enable_pnfs: formData.enable_pnfs,
      };

      try {
        const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;

        // Build API URL with approver as query parameter if provided
        let apiUrl = `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/nfs/mount`;
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
          throw new Error(`Failed to mount: ${response.statusText}`);
        }

        setIsModalOpen(false);
        setModalStep('server');
        setSelectedServerForForm('');
        setNfsExports([]);
        fetchStorageData();
        logger.info('NFS storage mounted successfully', {
          server: payload.server,
          export: payload.export,
        });
        showAlert('NFS storage mounted successfully!', 'success');
      } catch (err) {
        logger.error(
          'Failed to mount NFS storage',
          { server: payload.server, export: payload.export },
          err
        );
        showAlert(
          `Failed to mount NFS storage: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
      }
    }, 'Mount NFS Storage');
  };

  // Modal content for NFS storage
  const renderModalContent = () => {
    if (modalStep === 'server') {
      return (
        <>
          <div className="space-y-4">
            <div>
              <label htmlFor="server" className="block text-sm font-medium text-gray-700">
                NFS Server
              </label>
              <input
                id="server"
                type="text"
                name="server"
                // defaultValue="192.168.116.113"
                defaultValue=""
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter NFS server IP address"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={(e) => {
                const form = (e.target as HTMLElement).closest('form') as HTMLFormElement;
                const formData = new FormData(form);
                const server = formData.get('server') as string;
                if (server) {
                  fetchNfsExports(server);
                }
              }}
              disabled={fetchingExports}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {fetchingExports ? 'Fetching Exports...' : 'Next'}
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="id" className="block text-sm font-medium text-gray-700">
                ID
              </label>
              <Tooltip text="An NFS ID (Network File System Identifier) is a unique identifier assigned to each client accessing an NFS server, used for access control and tracking." />
            </div>
            <input
              id="id"
              type="text"
              name="id"
              key={`id-${modalStep}`}
              defaultValue=""
              placeholder="nfs"
              pattern="[a-z0-9]+"
              title="Only lowercase letters and numbers allowed"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = target.value.replace(/[^a-z0-9]/g, '');
              }}
              onKeyPress={(e) => {
                const char = e.key;
                if (!/[a-z0-9]/.test(char)) {
                  e.preventDefault();
                }
              }}
            />
          </div>
          <div>
            <label htmlFor="server" className="block text-sm font-medium text-gray-700">
              Server
            </label>
            <input
              id="server"
              type="text"
              name="server"
              value={selectedServerForForm}
              readOnly
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm bg-gray-100 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="export" className="block text-sm font-medium text-gray-700">
              Export
            </label>
            <select
              id="export"
              name="export"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select an export</option>
              {nfsExports.map((exportPath) => (
                <option key={exportPath} value={exportPath}>
                  {exportPath}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nfs_version" className="block text-sm font-medium text-gray-700">
              NFS Version
            </label>
            <select
              id="nfs_version"
              name="nfs_version"
              defaultValue="v3"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="v3">v3</option>
              <option value="v4">v4</option>
            </select>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="auto_mount_on_restart"
              defaultChecked={true}
              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Auto Mount on Restart</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              name="add_to_datastore"
              defaultChecked={true}
              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Add to Datastore</span>
            <Tooltip text="Check this to make the storage available for virtual machines." />
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              name="enable_pnfs"
              defaultChecked={true}
              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Enable pNFS</span>
          </label>
        </div>
        <div className="flex justify-between mt-4">
          <button
            type="button"
            onClick={() => {
              setModalStep('server');
              setSelectedServerForForm('');
              setNfsExports([]);
            }}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Back
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Mount
          </button>
        </div>
      </>
    );
  };

  // Define table columns for NFS
  const tableColumns = [
    {
      key: 'server',
      header: 'Server',
      render: (value: string) => value || '-',
    },
    {
      key: 'directory',
      header: 'Export/Directory',
      render: (value: string, item: NFSStorageItem) => {
        return item.export || value || '-';
      },
    },
    {
      key: 'size',
      header: 'Size',
      render: (value: string) => value || '-',
    },
    {
      key: 'used',
      header: 'Used',
      render: (value: string) => value || '-',
    },
    {
      key: 'available',
      header: 'Available',
      render: (value: string) => value || '-',
    },
    {
      key: 'capacity',
      header: 'Capacity',
      render: (value: string) => value || '-',
    },
    {
      key: 'mounted_on',
      header: 'Mounted On',
      className: 'truncate max-w-[200px]',
      headerClassName: 'text-center',
      render: (value: string, item: NFSStorageItem) => {
        if (!value || value === '0') {
          return <span className="text-red-600 font-medium">Not Mounted</span>;
        }
        return <span className="text-green-600 font-medium">{value}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-center whitespace-nowrap',
      headerClassName: 'text-center',
      render: (value: any, item: NFSStorageItem) => {
        // Check mounted_on for mounted status
        const isMounted =
          item.mounted_on && item.mounted_on !== '0' && item.mounted_on.trim() !== '';
        const mountPath = item.mounted_on || item.mount_path;

        return (
          <div className="flex justify-center">
            {!isMounted ? (
              <button
                onClick={() => {
                  setSelectedItem(item);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md bg-white hover:bg-gray-50 focus:outline-none"
              >
                Mount
              </button>
            ) : (
              <button
                onClick={() => handleUnmount(mountPath!)}
                aria-label="Unmount"
                className="inline-flex items-center justify-center p-1 rounded-md bg-red-600 text-white hover:bg-red-700 focus:outline-none"
              >
                <Trash color="#FFFFFF" size={16} />
              </button>
            )}
          </div>
        );
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
        <h2 className="text-xl font-semibold">NFS Storage</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedItem(null);
              setIsModalOpen(true);
              setModalStep('server');
              setSelectedServerForForm('');
              setNfsExports([]);
            }}
            className="px-4 py-2 bg-karios-blue text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Mount NFS Storage
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
        ) : !Array.isArray(storageData) || storageData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No NFS storage items found</div>
        ) : (
          <DataTable
            data={storageData}
            columns={tableColumns}
            hoverable={true}
            className="p-0"
            maxHeight="500px"
          />
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalStep('server');
          setSelectedServerForForm('');
          setNfsExports([]);
        }}
        title={modalStep === 'server' ? 'Select NFS Server' : 'Mount NFS Storage'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (modalStep === 'form') {
              const formData = new FormData(e.target as HTMLFormElement);
              const storageFormData: NFSStorageFormData = {
                id: formData.get('id') as string,
                server: formData.get('server') as string,
                export: formData.get('export') as string,
                auto_mount_on_restart: formData.get('auto_mount_on_restart') === 'on',
                nfs_version: formData.get('nfs_version') as string,
                add_to_datastore: formData.get('add_to_datastore') === 'on',
                enable_pnfs: formData.get('enable_pnfs') === 'on',
              };
              handleFormSubmit(storageFormData);
            }
          }}
        >
          {renderModalContent()}
        </form>
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

      {/* Approval Modal for NFS Storage Operations */}
      {isApprovalModalOpen && <ApprovalModal {...modalProps} />}
    </>
  );
};

export default NFSStorage;
