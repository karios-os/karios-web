import React from 'react';
import { logger } from '../../../shared-state/src/utils/logger';

interface WorkerConfig {
  id?: string;
  name: string;
  selectedServerIp: string;
  selectedPool: string;
  selectedNetworkSwitch: string;
  cpuCores: number;
  memoryGB: number;
  diskSizeGB: number;
}

interface WorkerConfigurationProps {
  isWorkerModalOpen: boolean;
  setIsWorkerModalOpen: (open: boolean) => void;
  currentWorkerConfig: WorkerConfig;
  setCurrentWorkerConfig: React.Dispatch<React.SetStateAction<WorkerConfig>>;
  configuredWorkers: WorkerConfig[];
  setConfiguredWorkers: React.Dispatch<React.SetStateAction<WorkerConfig[]>>;
  isEditingWorker: boolean;
  setIsEditingWorker: (editing: boolean) => void;
  editingWorkerOriginal: WorkerConfig | null;
  setEditingWorkerOriginal: (worker: WorkerConfig | null) => void;
  workerGroupCounts: { [configKey: string]: number };
  setWorkerGroupCounts: React.Dispatch<React.SetStateAction<{ [configKey: string]: number }>>;
  workerGroupInputs: { [configKey: string]: string };
  setWorkerGroupInputs: React.Dispatch<React.SetStateAction<{ [configKey: string]: string }>>;
  pools: any[];
  networkSwitches: string[];
  nodeInfo: any;
  ubuntuBasicConfig: { k8sName: string };
  allServers: any[];
  fieldErrors: { [key: string]: string };
  setFieldErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  hasValidationErrors: () => boolean;
  fetchNodeInfo: (serverIp: string) => Promise<void>;
  fetchServerSpecificData: (serverIp: string) => Promise<void>;
  validateWorkerResources: (
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number
  ) => { [key: string]: string };
  validateBatchNodeCreation: (
    nodeType: string,
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number,
    selectedServerIp: string,
    count: number
  ) => { [key: string]: string };
  getNextWorkerName: (isUbuntu: boolean, clusterName: string) => string;
  renumberConfiguredWorkers: (workers: WorkerConfig[], clusterName: string) => WorkerConfig[];
  cancelWorkerOperation: () => void;
}

const WorkerConfiguration: React.FC<WorkerConfigurationProps> = ({
  isWorkerModalOpen,
  setIsWorkerModalOpen,
  currentWorkerConfig,
  setCurrentWorkerConfig,
  configuredWorkers,
  setConfiguredWorkers,
  isEditingWorker,
  setIsEditingWorker,
  editingWorkerOriginal,
  setEditingWorkerOriginal,
  workerGroupCounts,
  setWorkerGroupCounts,
  workerGroupInputs,
  setWorkerGroupInputs,
  pools,
  networkSwitches,
  nodeInfo,
  ubuntuBasicConfig,
  allServers,
  fieldErrors,
  setFieldErrors,
  hasValidationErrors,
  fetchNodeInfo,
  fetchServerSpecificData,
  validateWorkerResources,
  validateBatchNodeCreation,
  getNextWorkerName,
  renumberConfiguredWorkers,
  cancelWorkerOperation,
}) => {
  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Worker Configuration</h3>
        <button
          onClick={() => {
            // Generate next worker name
            const nextWorkerName = getNextWorkerName(true, ubuntuBasicConfig.k8sName);
            const workerPart = nextWorkerName.replace(/ub-.*?-/, '');

            // Reset worker config - let user select server
            setCurrentWorkerConfig({
              name: workerPart,
              selectedServerIp: '',
              selectedPool: '',
              selectedNetworkSwitch: '',
              cpuCores: 2,
              memoryGB: 4,
              diskSizeGB: 40,
            });
            setIsWorkerModalOpen(true);
            setIsEditingWorker(false);
            setEditingWorkerOriginal(null);
          }}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-karios-blue bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-karios-blue"
        >
          <span className="mr-1">+</span>
          Add Worker
        </button>
      </div>
      <p className="text-sm text-gray-500">Workers are optional for cluster creation</p>

      {/* Worker Configuration Form */}
      {isWorkerModalOpen && (
        <div className="space-y-4 border-t pt-4">
          {/* Server Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Server <span className="text-red-500">*</span>
            </label>
            <select
              value={currentWorkerConfig.selectedServerIp}
              onChange={(e) => {
                const selectedServerIp = e.target.value;
                setCurrentWorkerConfig((prev) => ({
                  ...prev,
                  selectedServerIp,
                  selectedPool: '', // Reset pool when server changes
                  selectedNetworkSwitch: '', // Reset network switch when server changes
                }));

                // Clear server-related errors when a valid selection is made
                if (selectedServerIp) {
                  setFieldErrors((prev) => ({ ...prev, serverIp: '' }));
                  // Fetch server-specific data
                  fetchNodeInfo(selectedServerIp);
                  fetchServerSpecificData(selectedServerIp);
                }
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
            >
              <option value="">Select server</option>
              {allServers.map((server) => (
                <option key={server.ip} value={server.ip}>
                  {server.name} ({server.ip})
                </option>
              ))}
            </select>
            {fieldErrors['serverIp'] && (
              <div className="text-red-500 text-sm mt-1">{fieldErrors['serverIp']}</div>
            )}
          </div>

          {/* Storage and Network Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Storage Pool <span className="text-red-500">*</span>
              </label>
              <select
                value={currentWorkerConfig.selectedPool}
                onChange={(e) => {
                  setCurrentWorkerConfig((prev) => ({ ...prev, selectedPool: e.target.value }));
                  // Clear the storage pool error when a valid selection is made
                  if (e.target.value) {
                    setFieldErrors((prev) => ({ ...prev, storagePool: '' }));
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
              >
                <option value="">Select pool</option>
                {pools.map((pool: any) => (
                  <option key={pool.name || pool.NAME} value={pool.name || pool.NAME}>
                    {pool.name || pool.NAME}
                  </option>
                ))}
              </select>
              {fieldErrors['storagePool'] && (
                <div className="text-red-500 text-sm mt-1">{fieldErrors['storagePool']}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Network Switch <span className="text-red-500">*</span>
              </label>
              <select
                value={currentWorkerConfig.selectedNetworkSwitch}
                onChange={(e) => {
                  setCurrentWorkerConfig((prev) => ({
                    ...prev,
                    selectedNetworkSwitch: e.target.value,
                  }));
                  // Clear the network switch error when a valid selection is made
                  if (e.target.value) {
                    setFieldErrors((prev) => ({ ...prev, networkSwitch: '' }));
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
                disabled={!currentWorkerConfig.selectedServerIp}
              >
                <option value="">Select switch</option>
                {networkSwitches.map((sw: string) => (
                  <option key={sw} value={sw}>
                    {sw}
                  </option>
                ))}
              </select>
              {fieldErrors['networkSwitch'] && (
                <div className="text-red-500 text-sm mt-1">{fieldErrors['networkSwitch']}</div>
              )}
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
                isEditingWorker && editingWorkerOriginal
                  ? editingWorkerOriginal.name
                  : getNextWorkerName(true, ubuntuBasicConfig.k8sName)
              }
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
              placeholder="ub-clustername-worker1"
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
                min="2"
                value={currentWorkerConfig.cpuCores}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setCurrentWorkerConfig((prev) => ({ ...prev, cpuCores: value }));

                  // Validate resources
                  const errors = validateWorkerResources(
                    value,
                    currentWorkerConfig.memoryGB,
                    currentWorkerConfig.diskSizeGB
                  );
                  setFieldErrors((prev) => ({ ...prev, cpuCores: errors['cpuCores'] || '' }));
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['cpuCores'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min: {nodeInfo?.min_cpu_worker || 2} cores for worker
              </p>
              {fieldErrors['cpuCores'] && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors['cpuCores']}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Memory (GB) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="4"
                value={currentWorkerConfig.memoryGB}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setCurrentWorkerConfig((prev) => ({ ...prev, memoryGB: value }));

                  // Validate resources
                  const errors = validateWorkerResources(
                    currentWorkerConfig.cpuCores,
                    value,
                    currentWorkerConfig.diskSizeGB
                  );
                  setFieldErrors((prev) => ({ ...prev, memory: errors['memory'] || '' }));
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['memory'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min: {nodeInfo?.min_memory_worker || 4} GB for worker
              </p>
              {fieldErrors['memory'] && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors['memory']}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Disk Size (GB) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="40"
                value={currentWorkerConfig.diskSizeGB}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setCurrentWorkerConfig((prev) => ({ ...prev, diskSizeGB: value }));

                  // Validate resources
                  const errors = validateWorkerResources(
                    currentWorkerConfig.cpuCores,
                    currentWorkerConfig.memoryGB,
                    value
                  );
                  setFieldErrors((prev) => ({ ...prev, diskSize: errors['diskSize'] || '' }));
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['diskSize'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min: {nodeInfo?.min_disk_worker || 40} GB for worker
              </p>
              {fieldErrors['diskSize'] && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors['diskSize']}</p>
              )}
            </div>
          </div>

          {/* Save/Cancel Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={cancelWorkerOperation}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Validate required fields
                const errors: { [key: string]: string } = {};
                if (!currentWorkerConfig.selectedServerIp) {
                  errors['serverIp'] = 'Server selection is required';
                }
                if (!currentWorkerConfig.selectedPool) {
                  errors['storagePool'] = 'Storage pool selection is required';
                }
                if (!currentWorkerConfig.selectedNetworkSwitch) {
                  errors['networkSwitch'] = 'Network switch selection is required';
                }

                // Validate minimum requirements for Ubuntu workers
                const minCpu = nodeInfo?.min_cpu_worker || 2;
                const minMemory = nodeInfo?.min_memory_worker || 4;
                const minDisk = nodeInfo?.min_disk_worker || 40;

                if (currentWorkerConfig.cpuCores < minCpu) {
                  errors['cpuCores'] = `Worker requires minimum ${minCpu} CPU's for Ubuntu`;
                }
                if (currentWorkerConfig.memoryGB < minMemory) {
                  errors['memory'] = `Worker requires minimum ${minMemory}GB memory for Ubuntu`;
                }
                if (currentWorkerConfig.diskSizeGB < minDisk) {
                  errors['diskSize'] = `Worker requires minimum ${minDisk}GB disk space for Ubuntu`;
                }

                // Validate resource availability on the selected server
                if (currentWorkerConfig.selectedServerIp) {
                  const resourceErrors = validateWorkerResources(
                    currentWorkerConfig.cpuCores,
                    currentWorkerConfig.memoryGB,
                    currentWorkerConfig.diskSizeGB
                  );

                  // Add any resource validation errors (don't overwrite minimum requirement errors)
                  if (!errors['cpuCores'] && resourceErrors['cpuCores']) {
                    errors['cpuCores'] = resourceErrors['cpuCores'];
                  }
                  if (!errors['memory'] && resourceErrors['memory']) {
                    errors['memory'] = resourceErrors['memory'];
                  }
                  if (!errors['diskSize'] && resourceErrors['diskSize']) {
                    errors['diskSize'] = resourceErrors['diskSize'];
                  }
                }

                if (Object.keys(errors).length > 0) {
                  setFieldErrors(errors);
                  return;
                }

                if (isEditingWorker && editingWorkerOriginal) {
                  // Update existing worker
                  const updatedWorker = {
                    ...currentWorkerConfig,
                    id: editingWorkerOriginal.id, // Keep the original ID
                    name: editingWorkerOriginal.name, // Keep the original name
                  };
                  setConfiguredWorkers((prev) => [...prev, updatedWorker]);
                } else {
                  // Create new worker
                  const workerName = getNextWorkerName(true, ubuntuBasicConfig.k8sName);

                  const newWorker = {
                    ...currentWorkerConfig,
                    id: Date.now().toString(),
                    name: workerName,
                  };
                  setConfiguredWorkers((prev) => [...prev, newWorker]);
                }

                // Reset form and close modal
                setCurrentWorkerConfig({
                  name: '',
                  selectedServerIp: '',
                  selectedPool: '',
                  selectedNetworkSwitch: '',
                  cpuCores: 2,
                  memoryGB: 4,
                  diskSizeGB: 40,
                });
                setIsWorkerModalOpen(false);
                setIsEditingWorker(false);
                setEditingWorkerOriginal(null);
              }}
              disabled={hasValidationErrors()}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                hasValidationErrors()
                  ? 'text-gray-400 bg-gray-200 cursor-not-allowed'
                  : 'text-white bg-karios-blue hover:bg-blue-600'
              }`}
            >
              {isEditingWorker ? 'Update' : 'Add Worker'}
            </button>
          </div>
        </div>
      )}

      {configuredWorkers.length > 0 ? (
        <div className="space-y-3">
          {/* Display each worker as a separate row */}
          {configuredWorkers.map((worker) => (
            <div key={worker.id} className="bg-gray-50 p-4 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{worker.name}</h4>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={async () => {
                      try {
                        // Set editing state - preserve the original worker
                        setIsEditingWorker(true);
                        setEditingWorkerOriginal(worker);

                        // Remove the worker being edited from the list temporarily
                        setConfiguredWorkers((prev) => prev.filter((w) => w.id !== worker.id));

                        // Set the form data to show the worker's current config
                        setCurrentWorkerConfig({
                          ...worker,
                        });
                        setIsWorkerModalOpen(true);

                        // Fetch server data to populate dropdowns
                        if (worker.selectedServerIp) {
                          await fetchNodeInfo(worker.selectedServerIp);
                          await fetchServerSpecificData(worker.selectedServerIp);

                          // Wait a bit for state to update
                          setTimeout(() => {
                            // Check if the saved values exist in current options
                            const poolExists = pools.some(
                              (pool) => (pool.name || pool.NAME) === worker.selectedPool
                            );
                            const switchExists = networkSwitches.includes(
                              worker.selectedNetworkSwitch
                            );

                            if (!poolExists && worker.selectedPool) {
                              logger.warn('Saved pool not found in available options', {
                                pool: worker.selectedPool,
                              });
                            }
                            if (!switchExists && worker.selectedNetworkSwitch) {
                              logger.warn('Saved network switch not found in available options', {
                                networkSwitch: worker.selectedNetworkSwitch,
                              });
                            }
                          }, 200);
                        }
                      } catch (error) {
                        logger.error('Error in worker edit', error);
                        // Ensure modal is still opened even if fetch fails
                        setCurrentWorkerConfig(worker);
                        setIsWorkerModalOpen(true);
                      }
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-300 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      // Remove this specific worker
                      const filteredWorkers = configuredWorkers.filter((w) => w.id !== worker.id);
                      // Renumber the remaining workers to maintain sequential order
                      const renumberedWorkers = renumberConfiguredWorkers(
                        filteredWorkers,
                        ubuntuBasicConfig.k8sName
                      );
                      setConfiguredWorkers(renumberedWorkers);
                    }}
                    className="text-red-600 hover:text-red-800 text-sm px-2 py-1 border border-red-300 rounded"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-md p-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Server:</span>
                    <span className="text-gray-900 ml-2">{worker.selectedServerIp}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Storage Pool:</span>
                    <span className="text-gray-900 ml-2">{worker.selectedPool}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">CPU:</span>
                    <span className="text-gray-900 ml-2">{worker.cpuCores} CPU`&apos;`s</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Memory:</span>
                    <span className="text-gray-900 ml-2">{worker.memoryGB}GB</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Disk:</span>
                    <span className="text-gray-900 ml-2">{worker.diskSizeGB}GB</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Network:</span>
                    <span className="text-gray-900 ml-2">{worker.selectedNetworkSwitch}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default WorkerConfiguration;
