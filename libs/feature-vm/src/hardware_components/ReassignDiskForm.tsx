import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useVm,
  useAppState,
  logger,
  reassignZfsDisk,
  fetchVmInfo,
} from '@karios-monorepo/shared-state';

// TypeScript interfaces
interface Disk {
  number: number;
  emulation: string;
  'system-path': string;
  [key: string]: any;
}

interface Vm {
  name: string;
  datastore?: string;
  [key: string]: any;
}

interface VmDetails {
  datastore?: string;
  [key: string]: any;
}

interface Server {
  ip: string;
  name: string;
  vms: Vm[];
  fqdn?: string;
}

interface DataCenter {
  servers: Server[];
  [key: string]: any;
}

interface ReassignDiskFormProps {
  disk: Disk;
  selectedVm: Vm;
  vmDetails: VmDetails;
  onClose: () => void;
  getVmInfo: () => void;
}

interface ReassignDiskPayload {
  datastore: string;
  disk_dev: string;
  disk_no: number;
  disk_type: string;
  target_datastore: string;
  target_disk_no: number;
  target_vmname: string;
  vmname: string;
  zvol_name: string;
  zvol_path: string;
}

interface ApiResponse {
  success: boolean;
  error?: string;
  [key: string]: any;
}

const ReassignDiskForm: React.FC<ReassignDiskFormProps> = ({
  disk,
  selectedVm,
  vmDetails,
  onClose,
  getVmInfo,
}) => {
  const { dataCenters } = useVm();
  const { state } = useAppState();

  // Local state management
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [targetVm, setTargetVm] = useState<string>('');
  const [filteredVms, setFilteredVms] = useState<Vm[]>([]);
  const [targetDiskNo, setTargetDiskNo] = useState<number | null>(null);
  const [targetVmDatastore, setTargetVmDatastore] = useState<string>('');
  const [isFetching, setIsFetching] = useState<boolean>(false);

  // Initialize server from global state or set default
  useEffect(() => {
    if (state?.selectedServer) {
      // Only update if the server actually changed
      const currentServerAddress = selectedServer?.fqdn || selectedServer?.ip;
      const newServerAddress = state.selectedServer.fqdn || state.selectedServer.ip;

      if (!selectedServer || currentServerAddress !== newServerAddress) {
        setSelectedServer({
          ...state.selectedServer,
          vms: state.selectedServer.vms || [],
        });

        // Only reset filter values when server actually changes
        setTargetVm('');
        setTargetVmDatastore('');
        setFilteredVms([]);
      }
    } else {
      // Set a default server if none selected
      setSelectedServer({ ip: 'localhost', name: 'Default Server', vms: [] });
    }
  }, [state?.selectedServer, selectedServer]);

  // Local implementation of reassignDisk
  const reassignDisk = async (
    serverIp: string,
    payload: ReassignDiskPayload
  ): Promise<ApiResponse> => {
    setIsFetching(true);
    try {
      // Map the payload to match the service function signature
      const servicePayload = {
        dataset_name: payload.zvol_path,
        vm_name: payload.target_vmname,
        disk_no: payload.target_disk_no,
        disk_size: payload.zvol_name,
        ...payload,
      };
      const result = await reassignZfsDisk(serverIp, servicePayload);
      return { success: true, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    } finally {
      setIsFetching(false);
    }
  };

  // Memoize current server VMs to prevent unnecessary recalculations
  const currentServerVms = useMemo(() => {
    if (!selectedServer || !dataCenters) return [];

    const serverAddress = selectedServer.fqdn || selectedServer.ip;

    for (const dc of dataCenters as DataCenter[]) {
      const server = dc.servers.find(
        (server: Server) => (server.fqdn || server.ip) === serverAddress
      );
      if (server) {
        return server.vms || [];
      }
    }
    return [];
  }, [selectedServer, dataCenters]);

  // Function to search VMs only from the current server
  const handleVmSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const query = e.target.value.toLowerCase();
      setTargetVm(query);

      if (!selectedServer || !query.trim()) {
        setFilteredVms([]);
        setTargetVmDatastore('');
        setTargetDiskNo(null);
        return;
      }

      // Filter VMs based on the search query - only from the current server
      const matchingVms = currentServerVms.filter(
        (vm: Vm) => vm.name.toLowerCase().includes(query) && vm.name !== selectedVm.name
      );

      setFilteredVms(matchingVms);
    },
    [selectedServer, currentServerVms, selectedVm.name]
  );

  // Use global fetchVmDisks if available, else keep fetchTargetDiskNo local
  const fetchTargetDiskNo = useCallback(
    async (vmName: string): Promise<void> => {
      if (!selectedServer) return;

      setIsFetching(true);
      try {
        const serverAddress = selectedServer.fqdn || selectedServer.ip;
        const data = await fetchVmInfo(serverAddress, vmName);
        const diskNo = data['virtual-disk']?.length || 0;
        setTargetDiskNo(diskNo);
        // Store the target VM's datastore
        setTargetVmDatastore(data.datastore || 'default');
      } catch (error) {
        logger.error('Error fetching target VM details', error);
        alert('An error occurred while fetching target VM details.');
      } finally {
        setIsFetching(false);
      }
    },
    [selectedServer]
  );

  const handleReassign = async (): Promise<void> => {
    if (!selectedServer) {
      alert('No server selected.');
      return;
    }

    const zvolPathParts = disk['system-path'].split('/');
    const zvolName = zvolPathParts[zvolPathParts.length - 1];
    const zvolPath = zvolPathParts[zvolPathParts.length - 2];

    if (targetDiskNo === null) {
      alert('Please select a target VM to calculate the target disk number.');
      return;
    }

    if (!targetVmDatastore) {
      alert('Target VM datastore not found. Please select a target VM again.');
      return;
    }

    try {
      const serverAddress = selectedServer.fqdn || selectedServer.ip;
      const result = await reassignDisk(serverAddress, {
        datastore: vmDetails.datastore,
        disk_dev: 'custom',
        disk_no: disk.number,
        disk_type: disk.emulation,
        target_datastore: targetVmDatastore,
        target_disk_no: targetDiskNo,
        target_vmname: targetVm,
        vmname: selectedVm.name,
        zvol_name: zvolName,
        zvol_path: zvolPath,
      });

      if (result.success) {
        alert('Disk reassigned successfully!');
        getVmInfo();
        onClose();
      } else {
        alert(result.error || 'Failed to reassign disk.');
      }
    } catch (error) {
      alert('An error occurred while reassigning the disk.');
    }
  };

  return (
    <div className="bg-white rounded-lg">
      <div className="mb-5 space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-sm font-medium text-gray-500 mb-1">Disk Number</span>
              <span className="text-lg font-semibold text-gray-800">{disk.number}</span>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-500 mb-1">Emulation</span>
              <span className="text-lg font-semibold text-karios-blue">{disk.emulation}</span>
            </div>
            <div className="col-span-2">
              <span className="block text-sm font-medium text-gray-500 mb-1">System Path</span>
              <span className="text-sm font-medium text-gray-700 break-all">
                {disk['system-path']}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">Search Target VM:</label>
          <div className="relative">
            <input
              type="text"
              value={targetVm}
              onChange={handleVmSearch}
              placeholder="Type VM name to search..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-karios-blue focus:border-karios-blue transition-all duration-200"
              disabled={isFetching}
            />
            {isFetching && (
              <div className="absolute right-3 top-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-karios-blue"></div>
              </div>
            )}
          </div>
          {selectedServer && (
            <p className="text-xs text-gray-500 mt-1">
              Showing VMs from current server: {selectedServer.name} (
              {selectedServer.fqdn || selectedServer.ip})
            </p>
          )}
        </div>

        {filteredVms.length > 0 && (
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Matching VMs:</label>
            <ul className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredVms.map((vm: Vm, index: number) => (
                <li
                  key={index}
                  onClick={() => {
                    setTargetVm(vm.name);
                    fetchTargetDiskNo(vm.name);
                  }}
                  className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors flex items-center ${
                    targetVm === vm.name ? 'bg-blue-50 border-l-4 border-karios-blue' : ''
                  }`}
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  {vm.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {targetVm && targetDiskNo !== null && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              Disk will be assigned to <span className="font-semibold">{targetVm}</span> as disk
              number <span className="font-semibold">{targetDiskNo}</span>
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-4 items-center pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
            disabled={isFetching}
          >
            Cancel
          </button>
          <button
            onClick={handleReassign}
            className="bg-karios-blue text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={isFetching || !targetVm || targetDiskNo === null}
          >
            {isFetching ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </span>
            ) : (
              'Reassign'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReassignDiskForm;
