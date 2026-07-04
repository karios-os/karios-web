import React, { useEffect } from 'react';
import { useDataCenter } from '@karios-monorepo/shared-state';

interface Worker {
  id: string;
  name: string;
  selectedServerIp: string;
  selectedPool: string;
  selectedNetworkSwitch: string;
  cpuCores: number;
  memoryGB: number;
  diskSizeGB: number;
}

interface K3sWorkerFormProps {
  currentWorker: Worker;
  setCurrentWorker: React.Dispatch<React.SetStateAction<Worker>>;
  controlNodeIp: string;
  serverData: {
    [serverIp: string]: {
      nodeInfo: any;
      pools: any[];
      networkSwitches: string[];
    };
  };
  calculateAllocatedResources: (
    serverIp: string,
    excludeCurrentEdit: boolean,
    excludeNodeId?: string
  ) => { allocatedCpus: number; allocatedMemory: number };
  editingWorkerIndex: number | null;
  hasWorkerErrors: () => boolean;
  onCancel: () => void;
  onSave: () => void;
  fetchServerData?: (serverIp: string) => void;
  fieldErrors?: {
    server?: string;
    switch?: string;
    cpu?: string;
    memory?: string;
    disk?: string;
  };
  onFieldErrorChange?: (field: string, error: string) => void;
  showServerSelection?: boolean;
}

const K3sWorkerForm: React.FC<K3sWorkerFormProps> = ({
  currentWorker,
  setCurrentWorker,
  controlNodeIp,
  serverData,
  calculateAllocatedResources,
  editingWorkerIndex,
  hasWorkerErrors,
  onCancel,
  onSave,
  fetchServerData,
  fieldErrors = {},
  onFieldErrorChange,
  showServerSelection = false,
}) => {
  // Get inventory from data center state if server selection is enabled
  const { inventory, fetchInventory, loading } = useDataCenter();

  // Load inventory when server selection is shown
  useEffect(() => {
    if (showServerSelection && (!inventory || inventory.length === 0)) {
      fetchInventory();
    }
  }, [showServerSelection, inventory, fetchInventory]);

  // Filter configured servers if server selection is enabled
  const availableServers =
    showServerSelection && Array.isArray(inventory)
      ? inventory.filter((server) => server.stage?.toLowerCase() === 'configured')
      : [];
  return (
    <div className="space-y-4 border-t pt-4">
      <h4 className="text-lg font-semibold text-gray-900">
        {editingWorkerIndex !== null ? 'Edit Worker Node' : 'Add Worker Node'}
      </h4>

      {/* Show Worker Name when editing */}
      {editingWorkerIndex !== null && currentWorker.name && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Worker Name</label>
          <input
            type="text"
            value={currentWorker.name}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">This field cannot be edited</p>
        </div>
      )}

      {/* Server Selection (optional) */}
      {showServerSelection && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Server <span className="text-red-500">*</span>
          </label>
          <select
            value={currentWorker.selectedServerIp}
            onChange={(e) => {
              const selectedServerIp = e.target.value;
              setCurrentWorker((prev) => ({ ...prev, selectedServerIp }));
              if (selectedServerIp && fetchServerData) {
                fetchServerData(selectedServerIp);
              }
              // Clear server-related field errors when server changes
              if (onFieldErrorChange) {
                onFieldErrorChange('server', '');
                onFieldErrorChange('switch', '');
                onFieldErrorChange('cpu', '');
                onFieldErrorChange('memory', '');
                onFieldErrorChange('disk', '');
              }
            }}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent ${
              fieldErrors.server ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          >
            <option value="">
              {loading
                ? 'Loading servers...'
                : availableServers.length === 0
                  ? 'No configured servers available'
                  : 'Select a server'}
            </option>
            {availableServers.map((server) => (
              <option key={server.fqdn || server.nodeIP} value={server.fqdn || server.nodeIP}>
                {server.os_hostname || server.nodeHostname
                  ? `${server.os_hostname || server.nodeHostname} (${server.fqdn || server.nodeIP})`
                  : server.fqdn || server.nodeIP}
              </option>
            ))}
          </select>
          {fieldErrors.server && <p className="mt-1 text-sm text-red-600">{fieldErrors.server}</p>}
          {/* Show helpful message when no servers available */}
          {!loading && availableServers.length === 0 && (
            <p className="mt-1 text-sm text-amber-600">
              <span className="font-medium">No configured servers found.</span> Please configure
              servers in the Control Center first.
            </p>
          )}
          {/* Server Info Display */}
          {currentWorker.selectedServerIp && serverData[currentWorker.selectedServerIp] && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-sm text-blue-700">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <strong>Available CPU:</strong>{' '}
                    {serverData[currentWorker.selectedServerIp].nodeInfo?.cpus || 'N/A'} cores
                  </div>
                  <div>
                    <strong>Available Memory:</strong>{' '}
                    {serverData[currentWorker.selectedServerIp].nodeInfo?.memory
                      ? `${Math.floor(serverData[currentWorker.selectedServerIp].nodeInfo.memory / 1024)} GB`
                      : 'N/A'}
                  </div>
                  <div>
                    <strong>Network Switches:</strong>{' '}
                    {serverData[currentWorker.selectedServerIp].networkSwitches?.length || 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Network Configuration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Network Switch <span className="text-red-500">*</span>
        </label>
        <select
          value={currentWorker.selectedNetworkSwitch}
          onChange={(e) =>
            setCurrentWorker((prev) => ({ ...prev, selectedNetworkSwitch: e.target.value }))
          }
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select switch</option>
          {/* Use the worker's selected server if available, otherwise fall back to controlNodeIp */}
          {(() => {
            const serverIp = showServerSelection ? currentWorker.selectedServerIp : controlNodeIp;
            return (
              serverIp &&
              serverData[serverIp]?.networkSwitches.map((switchName: string) => (
                <option key={switchName} value={switchName}>
                  {switchName}
                </option>
              ))
            );
          })()}
        </select>
      </div>

      {/* Node Info Display for Worker */}
      {(() => {
        const serverIp = showServerSelection ? currentWorker.selectedServerIp : controlNodeIp;
        const workerNodeInfo = serverIp ? serverData[serverIp]?.nodeInfo : null;

        if (workerNodeInfo) {
          const totalCpus = workerNodeInfo.cpus;
          const totalMemory = Math.floor(workerNodeInfo.memory / 1024);
          const usedCpus = workerNodeInfo.cpus_in_use || 0;
          const usedMemory = Math.floor((workerNodeInfo.memory_in_use || 0) / 1024);

          // Calculate allocated resources
          const { allocatedCpus, allocatedMemory } = calculateAllocatedResources(
            serverIp,
            true,
            editingWorkerIndex !== null ? currentWorker.id : undefined
          );

          // Calculate available resources
          const availableCpus = totalCpus - usedCpus - allocatedCpus;
          const availableMemory = totalMemory - usedMemory - allocatedMemory;

          return (
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Available Resources:</strong> CPU: {availableCpus}/{totalCpus} | Memory:{' '}
                {availableMemory}/{totalMemory}GB | In Use: {usedCpus} CPUs, {usedMemory}GB
              </p>
            </div>
          );
        }
        return null;
      })()}

      {/* Hardware Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CPU`s <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={currentWorker.cpuCores || ''}
            onChange={(e) => {
              const value = e.target.value === '' ? '' : e.target.value;

              if (value === '') {
                setCurrentWorker((prev) => ({ ...prev, cpuCores: 0 }));
                return;
              }

              const numValue = parseInt(value);
              setCurrentWorker((prev) => ({ ...prev, cpuCores: numValue }));
            }}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue border-gray-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Memory (GB) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={currentWorker.memoryGB || ''}
            onChange={(e) => {
              const value = e.target.value === '' ? '' : e.target.value;

              if (value === '') {
                setCurrentWorker((prev) => ({ ...prev, memoryGB: 0 }));
                return;
              }

              const numValue = parseInt(value);
              setCurrentWorker((prev) => ({ ...prev, memoryGB: numValue }));
            }}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue border-gray-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Disk Size (GB) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={currentWorker.diskSizeGB || ''}
            onChange={(e) => {
              const value = e.target.value === '' ? '' : e.target.value;

              if (value === '') {
                setCurrentWorker((prev) => ({ ...prev, diskSizeGB: 0 }));
                return;
              }

              const numValue = parseInt(value);
              setCurrentWorker((prev) => ({ ...prev, diskSizeGB: numValue }));
            }}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue border-gray-300"
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={hasWorkerErrors()}
          className={`px-4 py-2 text-white rounded-md ${
            hasWorkerErrors() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {editingWorkerIndex !== null ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default K3sWorkerForm;
