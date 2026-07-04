import React from 'react';
import envConfig from '../../../../runtime-config';

interface AdditionalControlPlaneConfigurationProps {
  // Modal state
  isAdditionalControlPlaneModalOpen: boolean;
  setIsAdditionalControlPlaneModalOpen: (open: boolean) => void;

  // Current config being edited
  currentAdditionalControlPlaneConfig: {
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
  };
  setCurrentAdditionalControlPlaneConfig: (config: any) => void;

  // Additional Control Plane configs
  additionalControlPlaneConfigs: Array<{
    id: string;
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
  }>;
  setAdditionalControlPlaneConfigs: (configs: any) => void;

  // Editing state
  editingControlPlaneId: string | null;
  setEditingControlPlaneId: (id: string | null) => void;
  editingControlPlaneOriginal: any;
  setEditingControlPlaneOriginal: (original: any) => void;

  // Node info and server data
  controlPlaneNodeInfo: {
    cpus: number;
    sockets: number;
    memory: number;
    cpus_in_use: number;
    memory_in_use: number;
    min_cpu_control_plane?: number;
    min_memory_control_plane?: number;
    min_disk_control_plane?: number;
  } | null;
  nodeInfo: {
    cpus: number;
    sockets: number;
    memory: number;
    cpus_in_use: number;
    memory_in_use: number;
    min_cpu_control_plane?: number;
    min_memory_control_plane?: number;
    min_disk_control_plane?: number;
  } | null;
  controlPlanePools: any[];
  controlPlaneNetworkSwitches: string[];
  serverDataCache: { [serverIp: string]: { nodeInfo: any } };

  // Ubuntu configuration
  ubuntuBasicConfig: {
    k8sName: string;
  };
  controlPlaneConfig: any;

  // Server list
  allServers: any[];

  // Field errors and validation
  fieldErrors: { [key: string]: string };
  setFieldErrors: (errors: any) => void;
  hasValidationErrors: () => boolean;

  // Group counts and inputs
  controlPlaneGroupCounts: { [configKey: string]: number };
  setControlPlaneGroupCounts: (counts: any) => void;
  controlPlaneGroupInputs: { [configKey: string]: string };
  setControlPlaneGroupInputs: (inputs: any) => void;

  // Utility functions
  fetchControlPlaneNodeInfo: (serverIp: string) => Promise<void>;
  fetchControlPlaneServerData: (serverIp: string) => Promise<void>;
  validateAdditionalControlPlaneResources: (
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number
  ) => { [key: string]: string };
  validateBatchNodeCreation: (
    nodeType: string,
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number,
    serverIp: string,
    count: number
  ) => { [key: string]: string };
  getNextUbuntuControlPlaneName: (clusterName: string) => string;
  renumberUbuntuControlPlanes: (controlPlanes: any[], clusterName: string) => any[];
  calculateAllocatedResources: (serverIp: string) => {
    allocatedCpus: number;
    allocatedMemory: number;
  };
  cancelControlPlaneOperation: () => void;
}

const AdditionalControlPlaneConfiguration: React.FC<AdditionalControlPlaneConfigurationProps> = ({
  isAdditionalControlPlaneModalOpen,
  setIsAdditionalControlPlaneModalOpen,
  currentAdditionalControlPlaneConfig,
  setCurrentAdditionalControlPlaneConfig,
  additionalControlPlaneConfigs,
  setAdditionalControlPlaneConfigs,
  editingControlPlaneId,
  setEditingControlPlaneId,
  editingControlPlaneOriginal,
  setEditingControlPlaneOriginal,
  controlPlaneNodeInfo,
  nodeInfo,
  controlPlanePools,
  controlPlaneNetworkSwitches,
  serverDataCache,
  ubuntuBasicConfig,
  controlPlaneConfig,
  allServers,
  fieldErrors,
  setFieldErrors,
  hasValidationErrors,
  controlPlaneGroupCounts,
  setControlPlaneGroupCounts,
  controlPlaneGroupInputs,
  setControlPlaneGroupInputs,
  fetchControlPlaneNodeInfo,
  fetchControlPlaneServerData,
  validateAdditionalControlPlaneResources,
  validateBatchNodeCreation,
  getNextUbuntuControlPlaneName,
  renumberUbuntuControlPlanes,
  calculateAllocatedResources,
  cancelControlPlaneOperation,
}) => {
  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Control Plane Configuration</h3>
        <button
          onClick={() => {
            // Generate next control plane name
            const nextControlPlaneName = getNextUbuntuControlPlaneName(ubuntuBasicConfig.k8sName);

            // Reset additional control plane config
            setCurrentAdditionalControlPlaneConfig({
              name: nextControlPlaneName,
              selectedServerIp: '',
              selectedPool: '',
              selectedNetworkSwitch: '',
              cpuCores: 4,
              memoryGB: 8,
              diskSizeGB: 40,
            });
            setEditingControlPlaneId(null); // Ensure we're in add mode
            setIsAdditionalControlPlaneModalOpen(true);
          }}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-karios-blue bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-karios-blue"
        >
          <span className="mr-1">+</span>
          Add Control Plane
        </button>
      </div>

      {/* Additional Control Plane Configuration Form */}
      {isAdditionalControlPlaneModalOpen && (
        <div className="space-y-4 border-t pt-4">
          {/* Server Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Server <span className="text-red-500">*</span>
            </label>
            <select
              value={currentAdditionalControlPlaneConfig.selectedServerIp}
              onChange={(e) => {
                const selectedServerIp = e.target.value;
                setCurrentAdditionalControlPlaneConfig((prev) => ({
                  ...prev,
                  selectedServerIp,
                  selectedPool: '', // Reset pool when server changes
                  selectedNetworkSwitch: '', // Reset network switch when server changes
                }));

                // Clear server-related errors when a valid selection is made
                if (selectedServerIp) {
                  setFieldErrors((prev) => ({ ...prev, serverIp: '' }));
                  // Fetch server-specific data
                  fetchControlPlaneNodeInfo(selectedServerIp);
                  fetchControlPlaneServerData(selectedServerIp);
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
                value={currentAdditionalControlPlaneConfig.selectedPool}
                onChange={(e) => {
                  setCurrentAdditionalControlPlaneConfig((prev) => ({
                    ...prev,
                    selectedPool: e.target.value,
                  }));
                  // Clear the storage pool error when a valid selection is made
                  if (e.target.value) {
                    setFieldErrors((prev) => ({ ...prev, storagePool: '' }));
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
              >
                <option value="">Select pool</option>
                {controlPlanePools.map((pool: any) => (
                  <option key={pool.name || pool.NAME} value={pool.name || pool.NAME}>
                    {pool.name || pool.NAME}
                  </option>
                ))}
              </select>
              {fieldErrors['storagePool'] && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors['storagePool']}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Network Switch <span className="text-red-500">*</span>
              </label>
              <select
                value={currentAdditionalControlPlaneConfig.selectedNetworkSwitch}
                onChange={(e) => {
                  setCurrentAdditionalControlPlaneConfig((prev) => ({
                    ...prev,
                    selectedNetworkSwitch: e.target.value,
                  }));
                  // Clear the network switch error when a valid selection is made
                  if (e.target.value) {
                    setFieldErrors((prev) => ({ ...prev, networkSwitch: '' }));
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
              >
                <option value="">Select switch</option>
                {controlPlaneNetworkSwitches.map((sw: string) => (
                  <option key={sw} value={sw}>
                    {sw}
                  </option>
                ))}
              </select>
              {fieldErrors['networkSwitch'] && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors['networkSwitch']}</p>
              )}
            </div>
          </div>

          {/* Control Plane Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Control Plane Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={
                editingControlPlaneId
                  ? currentAdditionalControlPlaneConfig.name
                  : getNextUbuntuControlPlaneName(ubuntuBasicConfig.k8sName)
              }
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
              placeholder="ub-clustername-controlplane2"
            />
          </div>

          {/* Node Info Display for Additional Control Plane */}
          {(() => {
            const additionalControlPlaneNodeInfo =
              currentAdditionalControlPlaneConfig.selectedServerIp
                ? serverDataCache[currentAdditionalControlPlaneConfig.selectedServerIp]?.nodeInfo
                : null;

            if (additionalControlPlaneNodeInfo) {
              return (
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-gray-700">
                    <strong>Available Resources:</strong> cpus:{' '}
                    {additionalControlPlaneNodeInfo.cpus} | cpus in use:{' '}
                    {additionalControlPlaneNodeInfo.cpus_in_use} | memory:{' '}
                    {additionalControlPlaneNodeInfo.memory} | memory in use:{' '}
                    {additionalControlPlaneNodeInfo.memory_in_use} | sockets:{' '}
                    {additionalControlPlaneNodeInfo.sockets}
                  </p>
                </div>
              );
            }
            return null;
          })()}

          {/* Resource Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CPU`&apos;`s <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="4"
                value={currentAdditionalControlPlaneConfig.cpuCores}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 4;
                  setCurrentAdditionalControlPlaneConfig((prev) => ({
                    ...prev,
                    cpuCores: value,
                  }));

                  // Validate resources
                  const errors = validateAdditionalControlPlaneResources(
                    value,
                    currentAdditionalControlPlaneConfig.memoryGB,
                    currentAdditionalControlPlaneConfig.diskSizeGB
                  );
                  setFieldErrors((prev) => ({ ...prev, cpuCores: errors['cpuCores'] || '' }));
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['cpuCores'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min:{' '}
                {(() => {
                  const additionalControlPlaneNodeInfo =
                    currentAdditionalControlPlaneConfig.selectedServerIp
                      ? serverDataCache[currentAdditionalControlPlaneConfig.selectedServerIp]
                          ?.nodeInfo || controlPlaneNodeInfo
                      : null;
                  return additionalControlPlaneNodeInfo?.min_cpu_control_plane || 4;
                })()}{' '}
                cores for Ubuntu
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
                min="8"
                max={(() => {
                  const additionalControlPlaneNodeInfo =
                    currentAdditionalControlPlaneConfig.selectedServerIp
                      ? serverDataCache[currentAdditionalControlPlaneConfig.selectedServerIp]
                          ?.nodeInfo || controlPlaneNodeInfo
                      : null;
                  if (additionalControlPlaneNodeInfo) {
                    const totalMemory = Math.floor(additionalControlPlaneNodeInfo.memory / 1024);
                    const usedMemory = Math.floor(
                      (additionalControlPlaneNodeInfo.memory_in_use || 0) / 1024
                    );
                    const { allocatedMemory } = calculateAllocatedResources(
                      currentAdditionalControlPlaneConfig.selectedServerIp
                    );
                    return totalMemory - usedMemory - allocatedMemory;
                  }
                  return undefined;
                })()}
                value={currentAdditionalControlPlaneConfig.memoryGB}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 8;
                  setCurrentAdditionalControlPlaneConfig((prev) => ({
                    ...prev,
                    memoryGB: value,
                  }));

                  // Validate resources
                  const errors = validateAdditionalControlPlaneResources(
                    currentAdditionalControlPlaneConfig.cpuCores,
                    value,
                    currentAdditionalControlPlaneConfig.diskSizeGB
                  );
                  setFieldErrors((prev) => ({ ...prev, memory: errors['memory'] || '' }));
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['memory'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min:{' '}
                {(() => {
                  const additionalControlPlaneNodeInfo =
                    currentAdditionalControlPlaneConfig.selectedServerIp
                      ? serverDataCache[currentAdditionalControlPlaneConfig.selectedServerIp]
                          ?.nodeInfo || controlPlaneNodeInfo
                      : null;
                  return additionalControlPlaneNodeInfo?.min_memory_control_plane || 8;
                })()}{' '}
                GB for Ubuntu
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
                value={currentAdditionalControlPlaneConfig.diskSizeGB}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 40;
                  setCurrentAdditionalControlPlaneConfig((prev) => ({
                    ...prev,
                    diskSizeGB: value,
                  }));

                  // Validate resources
                  const errors = validateAdditionalControlPlaneResources(
                    currentAdditionalControlPlaneConfig.cpuCores,
                    currentAdditionalControlPlaneConfig.memoryGB,
                    value
                  );
                  setFieldErrors((prev) => ({ ...prev, diskSize: errors['diskSize'] || '' }));
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['diskSize'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min:{' '}
                {(() => {
                  const additionalControlPlaneNodeInfo =
                    currentAdditionalControlPlaneConfig.selectedServerIp
                      ? serverDataCache[currentAdditionalControlPlaneConfig.selectedServerIp]
                          ?.nodeInfo || controlPlaneNodeInfo
                      : null;
                  return additionalControlPlaneNodeInfo?.min_disk_control_plane || 40;
                })()}{' '}
                GB for Ubuntu
              </p>
              {fieldErrors['diskSize'] && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors['diskSize']}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={cancelControlPlaneOperation}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-karios-blue"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Validate additional control plane config
                const errors: { [key: string]: string } = {};
                if (!currentAdditionalControlPlaneConfig.selectedServerIp) {
                  errors['serverIp'] = 'Server selection is required';
                }
                if (!currentAdditionalControlPlaneConfig.selectedPool) {
                  errors['storagePool'] = 'Storage pool selection is required';
                }
                if (!currentAdditionalControlPlaneConfig.selectedNetworkSwitch) {
                  errors['networkSwitch'] = 'Network switch selection is required';
                }

                if (Object.keys(errors).length > 0) {
                  setFieldErrors(errors);
                  return;
                }

                if (editingControlPlaneId) {
                  // Update existing control plane config - preserve original ID and name
                  const updatedConfig = {
                    ...currentAdditionalControlPlaneConfig,
                    id: editingControlPlaneId,
                    name:
                      editingControlPlaneOriginal?.name || currentAdditionalControlPlaneConfig.name,
                  };
                  setAdditionalControlPlaneConfigs((prev) => [...prev, updatedConfig]);
                  setEditingControlPlaneOriginal(null);
                } else {
                  // Add new control plane config - generate name for new additions only
                  const autoGeneratedName = getNextUbuntuControlPlaneName(
                    ubuntuBasicConfig.k8sName
                  );
                  const newConfig = {
                    ...currentAdditionalControlPlaneConfig,
                    id: `cp-${Date.now()}`,
                    name: autoGeneratedName,
                  };
                  setAdditionalControlPlaneConfigs((prev) => [...prev, newConfig]);
                }

                setIsAdditionalControlPlaneModalOpen(false);
                setEditingControlPlaneId(null);

                // Reset form
                setCurrentAdditionalControlPlaneConfig({
                  name: '',
                  selectedServerIp: '',
                  selectedPool: '',
                  selectedNetworkSwitch: '',
                  cpuCores: 4,
                  memoryGB: 8,
                  diskSizeGB: 40,
                });
              }}
              disabled={hasValidationErrors()}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                hasValidationErrors()
                  ? 'text-gray-400 bg-gray-200 cursor-not-allowed'
                  : 'text-white bg-karios-blue hover:bg-blue-700'
              } border border-transparent focus:outline-none focus:ring-2 focus:ring-karios-blue`}
            >
              {editingControlPlaneId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Display configured additional control planes */}
      {additionalControlPlaneConfigs.length > 0 && (
        <div className="space-y-3">
          {additionalControlPlaneConfigs.map((controlPlane) => (
            <div key={controlPlane.id} className="bg-gray-50 p-4 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">{controlPlane.name}</h4>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      // Store original configuration before editing
                      setEditingControlPlaneOriginal({ ...controlPlane });

                      // Set edit mode
                      setEditingControlPlaneId(controlPlane.id);

                      // Load the config into the current form for editing
                      setCurrentAdditionalControlPlaneConfig({
                        name: controlPlane.name,
                        selectedServerIp: controlPlane.selectedServerIp,
                        selectedPool: controlPlane.selectedPool,
                        selectedNetworkSwitch: controlPlane.selectedNetworkSwitch,
                        cpuCores: controlPlane.cpuCores,
                        memoryGB: controlPlane.memoryGB,
                        diskSizeGB: controlPlane.diskSizeGB,
                      });

                      // Remove from list temporarily while editing
                      setAdditionalControlPlaneConfigs((prev) =>
                        prev.filter((c) => c.id !== controlPlane.id)
                      );

                      // Open modal
                      setIsAdditionalControlPlaneModalOpen(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      // Remove this control plane
                      const updatedControlPlanes = additionalControlPlaneConfigs.filter(
                        (cp) => cp.id !== controlPlane.id
                      );

                      // Renumber the remaining control planes to maintain sequential order
                      const renumberedControlPlanes = renumberUbuntuControlPlanes(
                        updatedControlPlanes,
                        ubuntuBasicConfig.k8sName
                      );
                      setAdditionalControlPlaneConfigs(renumberedControlPlanes);
                    }}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-md p-3 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Server:</span>
                    <span className="text-gray-900 ml-2">{controlPlane.selectedServerIp}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Storage Pool:</span>
                    <span className="text-gray-900 ml-2">{controlPlane.selectedPool}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">CPU:</span>
                    <span className="text-gray-900 ml-2">{controlPlane.cpuCores} CPU`&apos;`s</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Memory:</span>
                    <span className="text-gray-900 ml-2">{controlPlane.memoryGB}GB</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Disk:</span>
                    <span className="text-gray-900 ml-2">{controlPlane.diskSizeGB}GB</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Network:</span>
                    <span className="text-gray-900 ml-2">{controlPlane.selectedNetworkSwitch}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdditionalControlPlaneConfiguration;
