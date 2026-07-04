import React, { useEffect, useState } from 'react';
import { useVm, useServer, useAppState, logger, fetchVmInfo } from '@karios-monorepo/shared-state';
import { toast } from 'react-toastify';

interface StoragePool {
  NAME: string;
  FREE: string;
  [key: string]: any;
}

interface StoragePoolState {
  attachError: string | null;
  attachLoading: boolean;
  attachSuccess: string | null;
  datastores: any[];
  deleteError: string | null;
  deleteLoading: boolean;
  deleteSuccess: string | null;
  diskForm: {
    diskType: string;
    diskDev: string;
    diskSize: string;
    zfsPath: string;
    zpoolList: any[];
    [key: string]: any;
  };
  loadingDatastores: boolean;
  loadingPools: boolean;
  loadingVmDisks: boolean;
  pools: StoragePool[];
  poolsTransformed: any[];
  reassignError: string | null;
  reassignLoading: boolean;
  reassignSuccess: string | null;
  vmDisks: any[];
}

interface AttachDiskFormProps {
  setVmDetails: (vmDetails: any) => void;
  refreshVmDetails?: () => Promise<void>;
  onClose: () => void;
  vmDetails?: any;
}

const AttachDiskForm = ({
  setVmDetails,
  refreshVmDetails,
  onClose,
  vmDetails,
}: AttachDiskFormProps) => {
  const { selectedVm } = useVm();
  const { selectedServer } = useServer();
  const {
    storage,
    fetchStoragePools,
    fetchDatastores,
    fetchVmDisks,
    attachDisk,
    setDiskFormField,
  } = useAppState();

  const [errors, setErrors] = useState<{ diskSize?: string; diskDev?: string; diskNo?: string }>(
    {}
  );

  useEffect(() => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (serverAddress) {
      fetchStoragePools(serverAddress);
      fetchDatastores(serverAddress);
      fetchVmDisks(serverAddress, selectedVm.name);
    }
  }, [selectedServer?.ip, selectedServer?.fqdn, selectedVm?.name]);

  useEffect(() => {
    if (storage.vmDisks) {
      setDiskFormField('diskNo', storage.vmDisks.length);
    }
  }, [storage.vmDisks]);

  // Initialize form values
  useEffect(() => {
    // Set default disk device to "custom"
    setDiskFormField('diskDev', 'custom');

    // Set default disk size
    setDiskFormField('diskSize', '1G');

    // Set default disk type to "virtio-blk"
    setDiskFormField('diskType', 'virtio-blk');
  }, []);

  const parseSize = (sizeStr) => {
    if (!sizeStr) return 0;

    // Extract the numeric part and handle units
    const size = parseFloat(sizeStr);
    if (isNaN(size)) return 0;

    if (typeof sizeStr === 'string') {
      if (sizeStr.toLowerCase().includes('t')) return size * 1024 * 1024;
      if (sizeStr.toLowerCase().includes('g')) return size * 1024;
      if (sizeStr.toLowerCase().includes('m')) return size;
    }

    return size;
  };

  const handleAttachDisk = async () => {
    const { diskType, diskDev, diskSize, zfsPath, selectedZpool, zpoolFreeSpace, diskNo } =
      storage.diskForm;

    // Validation
    const newErrors: { diskSize?: string; diskDev?: string; diskNo?: string } = {};

    if (!diskSize || diskSize.trim() === '') {
      newErrors.diskSize = 'Disk size is required';
    }
    if (!diskDev || diskDev.trim() === '') {
      newErrors.diskDev = 'Disk device is required';
    }
    if (diskNo === '' || diskNo === null || diskNo === undefined) {
      newErrors.diskNo = 'Disk number is required';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const payload = {
      vmname: selectedVm.name,
      datastore: vmDetails?.datastore || 'default',
      size: diskSize,
      zvol_path: zfsPath,
      zvol_name: '',
      disk_no: parseInt(diskNo, 10),
      disk_type: diskType,
      disk_dev: diskDev,
    };

    // Close modal immediately to avoid freezing
    onClose();

    // Perform the API call in the background
    const serverAddress = selectedServer?.fqdn || selectedServer.ip;
    const result = await attachDisk(serverAddress, payload);
    if (result?.success) {
      toast.success('Disk attached successfully!');

      // Refresh VM details to show the newly attached disk
      if (refreshVmDetails) {
        await refreshVmDetails();
      } else if (setVmDetails) {
        // Fallback if refreshVmDetails is not provided
        try {
          const updatedVmData = await fetchVmInfo(serverAddress, selectedVm.name);
          setVmDetails(updatedVmData);
        } catch (refreshErr) {
          logger.error('Error refreshing VM details', refreshErr);
        }
      }

      // Clean up form
      setDiskFormField('diskSize', '1G');
      setDiskFormField('diskType', 'virtio-blk');
      fetchVmDisks(serverAddress, selectedVm.name);
    } else if (result?.error) {
      toast.error('Failed to attach disk: ' + result.error);
    }
  };
  return (
    <div className="bg-white rounded-lg space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-gray-700 font-medium mb-2">Disk Type:</label>
          <select
            value={storage.diskForm.diskType}
            onChange={(e) => setDiskFormField('diskType', e.target.value)}
            className="w-full h-12 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-karios-blue focus:border-karios-blue transition-all duration-200 appearance-none"
          >
            <option value="virtio-blk">virtio-blk</option>
            <option value="ahci-hd">ahci-hd</option>
            <option value="nvme">nvme</option>
          </select>
          <p className="text-xs text-gray-500 mt-1 pl-1">
            Select the type of virtual disk controller
          </p>
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Disk Device:</label>
          <input
            type="text"
            value="custom"
            readOnly
            disabled
            className="w-full h-12 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1 pl-1">Custom device configuration</p>
          {errors.diskDev && <p className="text-xs text-red-500 mt-1 pl-1">{errors.diskDev}</p>}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <h4 className="text-blue-800 font-medium mb-3">Storage Selection</h4>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Datastore:</label>
            {storage.loadingDatastores ? (
              <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                Loading datastores...
              </div>
            ) : storage.datastores && storage.datastores.length > 0 ? (
              <select
                value={storage.diskForm.zfsPath || ''}
                onChange={(e) => {
                  const selectedPath = e.target.value;
                  setDiskFormField('zfsPath', selectedPath);
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-karios-blue focus:border-karios-blue"
              >
                <option value="">Select a datastore...</option>
                {storage.datastores.map((ds: any, index: number) => (
                  <option key={index} value={ds.path}>
                    {ds.name} ({ds.type}) - Available: {ds.available}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600">
                No datastores available
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1 pl-1">Selected path will be used for zvol</p>
          </div>

          {/* Datastore is automatically selected based on VM's datastore */}
        </div>
      </div>

      <div>
        <label className="block text-gray-700 font-medium mb-2">
          Disk Size{' '}
          {storage.diskForm.zpoolFreeSpace ? (
            <span className="text-sm text-karios-blue font-normal ml-1">
              (Available: {storage.diskForm.zpoolFreeSpace})
            </span>
          ) : (
            ''
          )}
          :
        </label>
        <div className="flex items-center">
          <input
            type="text"
            value={storage.diskForm.diskSize}
            onChange={(e) => {
              setDiskFormField('diskSize', e.target.value);
              if (e.target.value.trim() !== '') {
                setErrors((prev) => ({ ...prev, diskSize: undefined }));
              }
            }}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-karios-blue focus:border-karios-blue transition-all ${
              errors.diskSize ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="e.g., 1G"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1 pl-1">
          Specify size with units (e.g., 10G, 500M, 1T)
        </p>
        {errors.diskSize && <p className="text-xs text-red-500 mt-1 pl-1">{errors.diskSize}</p>}
      </div>

      <div className="flex justify-end space-x-4 items-center pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-5 py-2.5 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={handleAttachDisk}
          className="bg-karios-blue text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Attach
        </button>
      </div>
    </div>
  );
};

export default AttachDiskForm;
