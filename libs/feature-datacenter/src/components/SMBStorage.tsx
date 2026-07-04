import React, { useState, useEffect } from 'react';
import { Trash } from 'iconsax-react';
import Modal from '../../../shared-state/src/widgets/Modal';
import DataTable from '../../../shared-state/src/widgets/DataTable';
import Tooltip from '../../../shared-state/src/widgets/Tooltip';
import envConfig from '../../../../runtime-config';
import { api } from '@karios-monorepo/shared-state';
import { useApprovalFlow } from '../../../shared-state/src/hooks/useApprovalFlow';
import { createComponentLogger } from '../../../shared-state/src/utils/logger';

interface SMBStorageItem {
  user?: string;
  netbios?: string;
  share?: string;
  size?: string;
  used?: string;
  available?: string;
  capacity?: string;
  mounted_on?: string;
  // Legacy fields for backward compatibility
  filesystem?: string;
  avail?: string;
  fstype?: string;
  mount_point?: string;
  options?: string;
  source?: string;
}

interface SMBStorageFormData {
  id: string;
  netbios: string;
  server: string;
  share: string;
  username: string;
  password: string;
  autoMountOnRestart: boolean;
  addToDatastore: boolean;
}

interface SMBStorageProps {
  selectedServer: {ip: string; fqdn?: string; name: string};
  onStorageTypeChange?: (storageType: string) => void;
  currentStorageType?: string;
}

const SMBStorage: React.FC<SMBStorageProps> = ({
  selectedServer,
  onStorageTypeChange,
  currentStorageType = 'smb',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isUnmountModalOpen, setIsUnmountModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'success'>('error');
  const [storageData, setStorageData] = useState<SMBStorageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SMBStorageItem | null>(null);
  const [unmountItem, setUnmountItem] = useState<SMBStorageItem | null>(null);
  const [forceUnmount, setForceUnmount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create component logger
  const logger = createComponentLogger('SMBStorage');

  // Add approval flow hook
  const { executeWithApproval, isModalOpen: isApprovalModalOpen, modalProps } = useApprovalFlow();

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
        `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/smb`
      );
      if (response.status === 204) {
        setStorageData([]);
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch SMB data: ${response.statusText}`);
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
      logger.error('Failed to fetch SMB storage data', err);
      setError(
        `Failed to load SMB storage data: ${err instanceof Error ? err.message : String(err)}`
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

  const handleUnmount = async (mountPath: string) => {
    // Execute with approval flow for DELETE request
    await executeWithApproval(async (approver?: string) => {
      try {
        const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;

        // Build API URL with approver as query parameter if provided
        let apiUrl = `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/smb/unmount`;
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
            force: forceUnmount,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to unmount: ${response.statusText}`);
        }

        // Refresh the data after successful unmount
        fetchStorageData();
        logger.info('SMB storage unmounted successfully', { mountPath });
        showAlert('SMB storage unmounted successfully!', 'success');
        setIsUnmountModalOpen(false);
        setUnmountItem(null);
        setForceUnmount(false);
      } catch (err) {
        logger.error('Failed to unmount SMB storage', { mountPath }, err);
        showAlert(
          `Failed to unmount SMB storage: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
      }
    }, 'Unmount SMB Storage');
  };

  const handleUnmountClick = (item: SMBStorageItem) => {
    setUnmountItem(item);
    setForceUnmount(false);
    setIsUnmountModalOpen(true);
  };

  const handleFormSubmit = async (formData: SMBStorageFormData) => {
    // Execute with approval flow for POST request
    await executeWithApproval(async (approver?: string) => {
      setIsSubmitting(true);
      const payload = {
        id: formData.id,
        netbios: formData.netbios,
        server: formData.server,
        share: formData.share,
        username: formData.username,
        password: formData.password,
        autoMountOnRestart: formData.autoMountOnRestart,
        addToDatastore: formData.addToDatastore,
      };

      try {
        const serverEndpoint = selectedServer?.fqdn || selectedServer?.ip || envConfig().CONTROL_NODE_IP.URL;

        // Build API URL with approver as query parameter if provided
        let apiUrl = `${envConfig().PROTOCOL}://${serverEndpoint}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storageclient/smb/mount`;
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
          throw new Error(`Failed to mount SMB storage: ${response.statusText}`);
        }

        setIsModalOpen(false);
        fetchStorageData();
        logger.info('SMB storage mounted successfully', {
          server: payload.server,
          share: payload.share,
        });
        showAlert('SMB storage mounted successfully!', 'success');
      } catch (err) {
        logger.error(
          'Failed to mount SMB storage',
          { server: payload.server, share: payload.share },
          err
        );
        showAlert(`Failed to mount SMB storage`, 'error');
      } finally {
        setIsSubmitting(false);
      }
    }, 'Mount SMB Storage');
  };

  const renderModalContent = () => {
    return (
      <>
        <div className="space-y-4">
          <div>
            <label htmlFor="id" className="block text-sm font-medium text-gray-700">
              ID
            </label>
            <input
              id="id"
              type="text"
              name="id"
              // defaultValue="karios"
              defaultValue=""
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="netbios" className="block text-sm font-medium text-gray-700">
                NetBIOS Name
              </label>
              <Tooltip text="A NetBIOS name is a legacy computer name used in Windows networking that can be utilized when specifying the server address for mounting SMB/CIFS shares." />
            </div>
            <input
              id="netbios"
              type="text"
              name="netbios"
              required
              placeholder="DESKTOP-FHPF4OS"
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="server" className="block text-sm font-medium text-gray-700">
                Server
              </label>
              <Tooltip text="An SMB (Server Message Block) / CIFS (Common Internet File System) server allows users on a network to share files, printers, and other resources using the Windows networking protocol." />
            </div>
            <input
              id="server"
              type="text"
              name="server"
              required
              placeholder="192.168.111.230"
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="share" className="block text-sm font-medium text-gray-700">
                Share
              </label>
              <Tooltip text="An SMB share is a designated folder on an SMB/CIFS server that's made accessible to other computers on the network for file sharing." />
            </div>
            <input
              id="share"
              type="text"
              name="share"
              required
              placeholder="shared-folder"
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <Tooltip text="An SMB username is a specific account name used to authenticate and access resources (like files and folders) on an SMB/CIFS share, separate from your local computer's login." />
            </div>
            <input
              id="username"
              type="text"
              name="username"
              required
              placeholder="smbuser"
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Tooltip text="An SMB password is the secret credential associated with an SMB username, required for authentication when accessing shared resources on an SMB/CIFS server." />
            </div>
            <input
              id="password"
              type="password"
              name="password"
              required
              placeholder="SMBUSER"
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="autoMountOnRestart"
              defaultChecked={true}
              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Auto Mount on Restart</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              name="addToDatastore"
              defaultChecked={true}
              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 mr-2">Add to Datastore</span>
            <Tooltip text="Check this to make the storage available for virtual machines." />
          </label>
        </div>
      </>
    );
  };

  // Define table columns for SMB
  const tableColumns = [
    {
      key: 'user',
      header: 'User',
      render: (value: string) => value || '-',
    },
    {
      key: 'netbios',
      header: 'NetBIOS',
      render: (value: string) => value || '-',
    },
    {
      key: 'share',
      header: 'Share',
      render: (value: string) => (value ? value.trim() : '-'),
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
      render: (value: string, item: SMBStorageItem) => {
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
      render: (value: any, item: SMBStorageItem) => {
        // Check if mounted_on has actual mount path (mounted) or is empty/null (unmounted)
        const isMounted =
          item.mounted_on && item.mounted_on !== '0' && item.mounted_on.trim() !== '';
        const mountPath = item.mounted_on || item.mount_point; // Support both field names

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
                onClick={() => handleUnmountClick(item)}
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
        <h2 className="text-xl font-semibold">SMB Storage</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedItem(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-karios-blue text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Mount SMB/CIFS Storage
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
          <div className="text-center py-8 text-gray-500">No SMB storage items found</div>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Mount SMB Storage">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const smbFormData: SMBStorageFormData = {
              id: formData.get('id') as string,
              netbios: formData.get('netbios') as string,
              server: formData.get('server') as string,
              share: formData.get('share') as string,
              username: formData.get('username') as string,
              password: formData.get('password') as string,
              autoMountOnRestart: formData.get('autoMountOnRestart') === 'on',
              addToDatastore: formData.get('addToDatastore') === 'on',
            };
            handleFormSubmit(smbFormData);
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
            <p className="text-gray-700 mb-4">Do you want to unmount the SMB storage mounted at:</p>
            <p className="font-semibold text-gray-900 bg-gray-100 p-2 rounded">
              {unmountItem?.mounted_on || unmountItem?.mount_point}
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
              onClick={() =>
                handleUnmount(unmountItem?.mounted_on || unmountItem?.mount_point || '')
              }
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none"
            >
              Unmount
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default SMBStorage;
