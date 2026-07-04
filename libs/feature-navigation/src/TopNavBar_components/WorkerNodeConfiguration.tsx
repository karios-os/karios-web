import React from 'react';
import { toast } from 'react-toastify';

interface WorkerNode {
  id: string;
  name: string;
  selectedServerIp?: string;
  selectedPool?: string;
  selectedNetworkSwitch?: string;
  cpuCores: number;
  memoryGB: number;
  diskSizeGB: number;
  masterId: string;
  domain_name?: string;
}

interface MasterNode {
  id: string;
  name: string;
}

interface WorkerNodeConfigurationProps {
  clusterName: string;
  isAddingWorker: boolean;
  isEditingWorker: boolean;
  currentWorker: {
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
    masterId: string;
    domain_name: string;
  };
  editingWorkerOriginal: WorkerNode | null;
  workerNodes: WorkerNode[];
  masterNodes: MasterNode[];
  networkSwitches: string[];
  nodeInfo: any;
  fieldErrors: { [key: string]: string };
  expandedClusters: Set<string>;
  allServers: Array<{ ip: string; fqdn?: string; name?: string }>;
  onStartAddingWorker: (masterId: string) => void;
  onUpdateCurrentWorker: (updates: Partial<WorkerNodeConfigurationProps['currentWorker']>) => void;
  onClearFieldError: (fieldName: string) => void;
  onValidateField: (fieldName: string, value: number) => void;
  onCancelOperation: () => void;
  onSaveWorker: () => void;
  onEditWorker: (worker: WorkerNode) => void;
  onRemoveWorker: (workerId: string) => void;
  onToggleClusterExpanded: (masterId: string) => void;
  onFetchServerData?: (serverIp: string) => Promise<void>;
  getValidationError: () => string;
}

const WorkerNodeConfiguration: React.FC<WorkerNodeConfigurationProps> = ({
  clusterName,
  isAddingWorker,
  isEditingWorker,
  currentWorker,
  editingWorkerOriginal,
  workerNodes,
  masterNodes,
  networkSwitches,
  nodeInfo,
  fieldErrors,
  expandedClusters,
  allServers,
  onStartAddingWorker,
  onUpdateCurrentWorker,
  onClearFieldError,
  onValidateField,
  onCancelOperation,
  onSaveWorker,
  onEditWorker,
  onRemoveWorker,
  onToggleClusterExpanded,
  onFetchServerData,
  getValidationError,
}) => {
  // Handle server selection change
  const handleServerChange = async (serverIp: string) => {
    onUpdateCurrentWorker({ selectedServerIp: serverIp });

    // Fetch server-specific data if handler provided
    if (onFetchServerData && serverIp) {
      try {
        await onFetchServerData(serverIp);
      } catch (error) {
        console.error('Failed to fetch server data:', error);
        toast.error('Failed to load server information');
      }
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Worker Node Configuration</h3>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Optional</span>
      </div>

      <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-700">
          <strong>Info:</strong> Worker nodes are optional for OpenShift clusters. If no worker
          nodes are configured, workloads can run on control plane nodes. For production
          environments, dedicated worker nodes are recommended for better resource isolation.
        </p>
      </div>

      {/* Show validation error for workers */}
      {getValidationError() && <div className="text-red-500 text-sm">{getValidationError()}</div>}

      {/* Worker Nodes Section - Cluster-wide, not per master */}
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900">All Workers</h4>
              <span className="text-sm text-gray-600">({workerNodes.length} workers)</span>
            </div>
            <button
              onClick={() => onStartAddingWorker('')}
              className="px-3 py-1 text-sm text-karios-blue bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
            >
              + Add Worker
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {workerNodes.length === 0 ? (
              <p className="text-gray-500 text-sm">No workers added yet</p>
            ) : (
              workerNodes
                .filter((worker) => !isEditingWorker || worker.id !== editingWorkerOriginal?.id)
                .map((worker) => (
                  <div
                    key={worker.id}
                    className="bg-gray-50 p-3 rounded-md flex items-center justify-between"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{worker.name}</span>
                      <span className="text-gray-600 ml-2">
                        ({worker.cpuCores} CPU, {worker.memoryGB}GB RAM, {worker.diskSizeGB}GB Disk)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditWorker(worker)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onRemoveWorker(worker.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Worker Configuration Form */}
      {isAddingWorker && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium text-gray-900">
            {isEditingWorker ? 'Edit Worker Node' : 'Add Worker Node'}
          </h4>

          {/* Server Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Server <span className="text-red-500">*</span>
            </label>
            <select
              value={currentWorker.selectedServerIp}
              onChange={(e) => handleServerChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
            >
              <option value="">Select a server</option>
              {allServers.map((server) => (
                <option key={server.ip} value={server.ip}>
                  {server.fqdn || server.name || server.ip}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Choose the physical server where this worker will be deployed
            </p>
          </div>

          {/* Network Switch Selection */}
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Network Switch <span className="text-red-500">*</span>
              </label>
              <select
                value={currentWorker.selectedNetworkSwitch}
                onChange={(e) => {
                  onUpdateCurrentWorker({ selectedNetworkSwitch: e.target.value });
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
              >
                <option value="">Select switch</option>
                {networkSwitches.map((sw: string) => (
                  <option key={sw} value={sw}>
                    {sw}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Node Info Display */}
          {nodeInfo && (
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Available Resources:</strong> cpus: {nodeInfo.cpus} | cpus in use:{' '}
                {nodeInfo.cpus_in_use} | memory: {nodeInfo.memory} | memory in use:{' '}
                {nodeInfo.memory_in_use} | sockets: {nodeInfo.sockets}
              </p>
            </div>
          )}

          {/* Worker Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Worker Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={
                currentWorker.name
                  ? `${clusterName}-${currentWorker.name}`
                  : clusterName
                    ? `${clusterName}-worker1`
                    : 'op-clustername-worker1'
              }
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
              placeholder="op-clustername-worker1"
            />
          </div>

          {/* Hardware Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CPU`&apos;`s <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="4"
                value={currentWorker.cpuCores}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  onUpdateCurrentWorker({ cpuCores: newValue });
                  onValidateField('cpuCores', newValue);
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['worker_cpuCores'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {fieldErrors['worker_cpuCores'] ? (
                <p className="text-xs text-red-500 mt-1">{fieldErrors['worker_cpuCores']}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Min: 4 CPU`&apos;`s for OpenShift</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Memory (GB) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="8"
                value={currentWorker.memoryGB}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  onUpdateCurrentWorker({ memoryGB: newValue });
                  onValidateField('memory', newValue);
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['worker_memory'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {fieldErrors['worker_memory'] ? (
                <p className="text-xs text-red-500 mt-1">{fieldErrors['worker_memory']}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Min: 8GB for OpenShift</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Disk Size (GB) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="120"
                value={currentWorker.diskSizeGB}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  onUpdateCurrentWorker({ diskSizeGB: newValue });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
              />
              <p className="text-xs text-gray-500 mt-1">Min: 120GB for OpenShift</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancelOperation}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveWorker}
              className="px-4 py-2 text-sm font-medium text-white bg-karios-blue border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-karios-blue"
            >
              {isEditingWorker ? 'Update Worker' : 'Add Worker'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerNodeConfiguration;
