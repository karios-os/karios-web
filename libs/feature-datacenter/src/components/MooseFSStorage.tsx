import React, { useState, useEffect } from 'react';
import { Trash } from 'iconsax-react';
import Modal from '../../../shared-state/src/widgets/Modal';
import DataTable from '../../../shared-state/src/widgets/DataTable';
import Tooltip from '../../../shared-state/src/widgets/Tooltip';
import envConfig from '../../../../runtime-config';
import { api, useAppState } from '@karios-monorepo/shared-state';
import { useApprovalFlow } from '../../../shared-state/src/hooks/useApprovalFlow';
import ApprovalModal from '../../../shared-state/src/components/ApprovalModal';
import { createComponentLogger } from '../../../shared-state/src/utils/logger';

interface MooseFSStorageItem {
  id?: string;
  server?: string;
  port?: string;
  directory?: string;
  size?: string;
  used?: string;
  available?: string;
  capacity?: string;
  auto_mount_on_restart?: boolean;
  add_to_datastore?: boolean;
  mount_path?: string;
  mounted_on?: string; // MooseFS uses this field instead of mount_path
}

interface MooseFSStorageFormData {
  id: string;
  server: string;
  port: string;
  directory: string;
  auto_mount_on_restart: boolean;
  add_to_datastore: boolean;
}

interface MooseFSStorageProps {
  selectedServer: {ip: string; fqdn?: string; name: string};
  onStorageTypeChange?: (storageType: string) => void;
  currentStorageType?: string;
}

const MooseFSStorage: React.FC<MooseFSStorageProps> = ({
  selectedServer,
  onStorageTypeChange,
  currentStorageType = 'moosefs',
}) => {
  const { state } = useAppState();
  const { requiresApproval, approvers, isModalOpen, modalProps, executeWithApproval } =
    useApprovalFlow({
      title: 'MooseFS Storage Approval Required',
      message: 'This MooseFS storage action requires approval. Please select an approver.',
    });

  // Create component logger
  const logger = createComponentLogger('MooseFSStorage');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isUnmountModalOpen, setIsUnmountModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'success'>('error');
  const [storageData, setStorageData] = useState<MooseFSStorageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MooseFSStorageItem | null>(null);
  const [unmountItem, setUnmountItem] = useState<MooseFSStorageItem | null>(null);
  const [forceUnmount, setForceUnmount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/moosefs`
      );
      if (response.status === 204) {
        setStorageData([]);
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch MooseFS data: ${response.statusText}`);
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
      logger.error('Failed to fetch MooseFS storage data', err);
      setError(
        `Failed to load MooseFS storage data: ${err instanceof Error ? err.message : String(err)}`
      );
      setStorageData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedServer) {
      fetchStorageData();
    }
  }, [selectedServer]);

  const handleUnmount = async (mountPath: string, approver?: string) => {
    try {
      const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;
      let url = `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/moosefs/unmount`;

      // Add approver query param if provided
      if (approver) {
        url += `?approver=${encodeURIComponent(approver)}`;
      }

      const response = await api.fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mount_point: mountPath,
          force: forceUnmount,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to unmount: ${response.statusText}`);
      }

      // Refresh the data after successful unmount
      fetchStorageData();
      logger.info('MooseFS storage unmounted successfully', { mountPath });
      showAlert('MooseFS storage unmounted successfully!', 'success');
      setIsUnmountModalOpen(false);
      setUnmountItem(null);
      setForceUnmount(false);
    } catch (err) {
      logger.error('Failed to unmount MooseFS storage', { mountPath }, err);
      showAlert(
        `Failed to unmount MooseFS storage: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    }
  };

  const handleUnmountClick = (item: MooseFSStorageItem) => {
    setUnmountItem(item);
    setForceUnmount(false);

    executeWithApproval((approver) => {
      const mountPath = item.mounted_on || '';
      handleUnmount(mountPath, approver);
    }, 'Unmount MooseFS Storage');
  };

  // function to handle form submission for MooseFS storage
  const handleFormSubmit = async (formData: MooseFSStorageFormData) => {
    const mountAction = async (approver?: string) => {
      setIsSubmitting(true);
      const payload = {
        id: formData.id,
        server: formData.server,
        port: formData.port,
        directory: formData.directory,
        auto_mount_on_restart: formData.auto_mount_on_restart,
        add_to_datastore: formData.add_to_datastore,
      };

      try {
        const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;
        let url = `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/moosefs/mount`;

        // Add approver query param if provided
        if (approver) {
          url += `?approver=${encodeURIComponent(approver)}`;
        }

        const response = await api.fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to mount: ${response.statusText}`);
        }

        setIsFormModalOpen(false);
        fetchStorageData();
        logger.info('MooseFS storage mounted successfully', {
          server: payload.server,
          directory: payload.directory,
        });
        showAlert('MooseFS storage mounted successfully!', 'success');
      } catch (err) {
        logger.error(
          'Failed to mount MooseFS storage',
          { server: payload.server, directory: payload.directory },
          err
        );
        showAlert(
          `Failed to mount MooseFS storage: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    executeWithApproval(mountAction, 'Mount MooseFS Storage');
  };

  // Modal content for MooseFS storage
  const renderModalContent = () => {
    return (
      <>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="id" className="block text-sm font-medium text-gray-700">
                ID
              </label>
              <Tooltip text="A MooseFS ID is a unique identifier used for user authentication, access control, and quota management within the distributed MooseFS file system." />
            </div>
            <input
              id="id"
              type="text"
              name="id"
              placeholder={selectedItem?.id || 'karios'}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="server" className="block text-sm font-medium text-gray-700">
                Server
              </label>
              <Tooltip text="A MooseFS server is any computer running the MooseFS software and fulfilling a specific role—like managing metadata (master), storing data chunks (data), or facilitating discovery (listen)—within a distributed file system cluster." />
            </div>
            <input
              id="server"
              type="text"
              name="server"
              placeholder={selectedItem?.server || '192.168.111.92'}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="port" className="block text-sm font-medium text-gray-700">
                Port
              </label>
              <Tooltip text="MooseFS ports are network doorways used by the master, data, and listen servers to communicate with each other and clients, with default values like 10001 (master), 10003 (data), and 10005 (listen)." />
            </div>
            <input
              id="port"
              type="text"
              name="port"
              placeholder={selectedItem?.port || '9421'}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="directory" className="block text-sm font-medium text-gray-700">
                Directory
              </label>
              <Tooltip text="A MooseFS directory is a hierarchical structure within the distributed file system, similar to traditional directories, that organizes files and subdirectories across multiple servers for storage and access." />
            </div>
            <input
              id="directory"
              type="text"
              name="directory"
              placeholder={selectedItem?.directory || 'moosefs'}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="auto_mount_on_restart"
              defaultChecked={selectedItem?.auto_mount_on_restart ?? true}
              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Auto Mount on Restart</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              name="add_to_datastore"
              defaultChecked={selectedItem?.add_to_datastore ?? true}
              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 mr-2">Add to Datastore</span>
            <Tooltip text="Check this to make the storage available for virtual machines." />
          </label>
        </div>
      </>
    );
  };

  // Define table columns for MooseFS
  const tableColumns = [
    {
      key: 'server',
      header: 'Server',
    },
    {
      key: 'port',
      header: 'Port',
    },
    {
      key: 'directory',
      header: 'Directory',
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
      render: (value: string, item: MooseFSStorageItem) => {
        // mounted_on contains the actual mount path when mounted
        if (!value || value === '0') {
          return <span className="text-red-600 font-medium">Not Mounted</span>;
        }
        // Show the actual mount path
        return <span className="text-green-600 font-medium">{value}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-center whitespace-nowrap',
      headerClassName: 'text-center',
      render: (value: any, item: MooseFSStorageItem) => {
        // Check if mounted_on has actual mount path (mounted) or is empty/null (unmounted)
        const isMounted =
          item.mounted_on && item.mounted_on !== '0' && item.mounted_on.trim() !== '';
        const mountPath = item.mounted_on;

        return (
          <div className="flex justify-center">
            {!isMounted ? (
              <button
                onClick={() => {
                  setSelectedItem(item);
                  setIsFormModalOpen(true);
                }}
                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md bg-white hover:bg-gray-50 focus:outline-none"
              >
                Mount
              </button>
            ) : (
              <button
                onClick={() => handleUnmountClick(item)}
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
        <h2 className="text-xl font-semibold">MooseFS Storage</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedItem(null);
              setIsFormModalOpen(true);
            }}
            className="px-4 py-2 bg-karios-blue text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Mount MooseFS Storage
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
          <div className="text-center py-8 text-gray-500">No MooseFS storage items found</div>
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
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title="Mount MooseFS Storage"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const storageFormData: MooseFSStorageFormData = {
              id: formData.get('id') as string,
              server: formData.get('server') as string,
              port: formData.get('port') as string,
              directory: formData.get('directory') as string,
              auto_mount_on_restart: formData.get('auto_mount_on_restart') === 'on',
              add_to_datastore: formData.get('add_to_datastore') === 'on',
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

      {/* Unmount Confirmation Modal */}
      <Modal
        isOpen={isUnmountModalOpen}
        onClose={() => {
          setIsUnmountModalOpen(false);
          setUnmountItem(null);
          setForceUnmount(false);
        }}
        title="Confirm Unmount"
        width="400px"
      >
        <div className="text-center">
          <div className="mb-4">
            <p className="text-gray-700 mb-4">
              Do you want to unmount the MooseFS storage mounted at:
            </p>
            <p className="font-semibold text-gray-900 bg-gray-100 p-2 rounded">
              {unmountItem?.mounted_on}
            </p>
          </div>

          <div className="mb-6">
            <label className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={forceUnmount}
                onChange={(e) => setForceUnmount(e.target.checked)}
                className="mr-2 h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Force unmount</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Use force unmount if the storage is busy or has active processes
            </p>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={() => {
                setIsUnmountModalOpen(false);
                setUnmountItem(null);
                setForceUnmount(false);
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none"
            >
              Cancel
            </button>
            <button
              onClick={() => handleUnmount(unmountItem?.mounted_on!)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none"
            >
              Unmount
            </button>
          </div>
        </div>
      </Modal>

      {/* Use the built-in approval modal from the hook */}
      <ApprovalModal {...modalProps} />
    </>
  );
};

export default MooseFSStorage;
