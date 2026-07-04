import React from 'react';
import { toast } from 'react-toastify';

interface ControlPlaneNode {
  id: string;
  name: string;
  selectedServerIp?: string;
  selectedPool?: string;
  selectedNetworkSwitch?: string;
  cpuCores: number;
  memoryGB: number;
  diskSizeGB: number;
}

interface ControlPlaneConfigurationProps {
  clusterName: string;
  isAddingMaster: boolean;
  isEditingMaster: boolean;
  currentMaster: {
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
  };
  masterNodes: ControlPlaneNode[];
  networkSwitches: string[];
  nodeInfo: any;
  fieldErrors: { [key: string]: string };
  allServers: Array<{ ip: string; fqdn?: string; name?: string }>;
  onStartAddingMaster: () => void;
  onUpdateCurrentMaster: (
    updates: Partial<ControlPlaneConfigurationProps['currentMaster']>
  ) => void;
  onClearFieldError: (fieldName: string) => void;
  onValidateField: (fieldName: string, value: number) => void;
  onCancelOperation: () => void;
  onSaveMaster: () => void;
  onEditMaster: (master: ControlPlaneNode) => void;
  onRemoveMaster: (masterId: string) => void;
  onFetchServerData?: (serverIp: string) => Promise<void>;
  getValidationError: () => string;
}

const ControlPlaneConfiguration: React.FC<ControlPlaneConfigurationProps> = ({
  clusterName,
  isAddingMaster,
  isEditingMaster,
  currentMaster,
  masterNodes,
  networkSwitches,
  nodeInfo,
  fieldErrors,
  allServers,
  onStartAddingMaster,
  onUpdateCurrentMaster,
  onClearFieldError,
  onValidateField,
  onCancelOperation,
  onSaveMaster,
  onEditMaster,
  onRemoveMaster,
  onFetchServerData,
  getValidationError,
}) => {
  // Helper to get server display name
  const getServerDisplayName = (server: any): string => {
    return server.name || server.fqdn || server.ip;
  };

  // Handle server selection change
  const handleServerChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newServerIp = e.target.value;
    onUpdateCurrentMaster({ selectedServerIp: newServerIp });
    onClearFieldError('selectedServerIp');

    // Fetch server-specific data if callback provided
    if (newServerIp && onFetchServerData) {
      try {
        await onFetchServerData(newServerIp);
      } catch (error) {
        console.error('Failed to fetch server data:', error);
        toast.error('Failed to fetch server data');
      }
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Control Plane Configuration</h3>
        <button
          onClick={onStartAddingMaster}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-karios-blue bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-karios-blue"
        >
          <span className="mr-1">+</span>
          Add Control Plane
        </button>
      </div>

      <div className="p-2 bg-orange-50 border border-orange-200 rounded-md">
        <p className="text-xs text-orange-700">
          <strong>Note:</strong> For High Availability, use an odd number of control plane nodes (1,
          3, 5, etc.) to maintain etcd quorum. Worker nodes are optional - OpenShift can run
          workloads on control plane nodes. Minimum requirements: 8CPU, 16GB RAM for control plane
          nodes and 4 CPU, 8GB RAM for worker nodes (if used).
        </p>
      </div>

      {/* Control Plane Configuration Form */}
      {isAddingMaster && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-4">
            {isEditingMaster ? 'Edit Control Plane Node' : 'Add Control Plane Node'}
          </h4>

          {/* Server Selection Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Server <span className="text-red-500">*</span>
            </label>
            <select
              value={currentMaster.selectedServerIp}
              onChange={handleServerChange}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                fieldErrors['selectedServerIp'] ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a server</option>
              {allServers.map((server) => (
                <option key={server.ip} value={server.ip}>
                  {getServerDisplayName(server)}
                </option>
              ))}
            </select>
            {fieldErrors['selectedServerIp'] && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors['selectedServerIp']}</p>
            )}
          </div>

          {/* Network Switch Selection */}
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Network Switch <span className="text-red-500">*</span>
              </label>
              <select
                value={currentMaster.selectedNetworkSwitch}
                onChange={(e) => {
                  onUpdateCurrentMaster({ selectedNetworkSwitch: e.target.value });
                  onClearFieldError('networkSwitch');
                }}
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['networkSwitch'] ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={!currentMaster.selectedServerIp}
              >
                <option value="">Select switch</option>
                {networkSwitches.map((sw: string) => (
                  <option key={sw} value={sw}>
                    {sw}
                  </option>
                ))}
              </select>
              {fieldErrors['networkSwitch'] && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors['networkSwitch']}</p>
              )}
              {!currentMaster.selectedServerIp && (
                <p className="mt-1 text-xs text-gray-500">Select a server first</p>
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

          {/* Control Plane Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Control Plane Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={
                currentMaster.name ||
                (clusterName ? `${clusterName}-controlplane1` : `clustername-controlplane1`)
              }
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
              placeholder="op-clustername-controlplane1"
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
                value={currentMaster.cpuCores}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  onUpdateCurrentMaster({ cpuCores: newValue });
                  onValidateField('cpuCores', newValue);
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['controlPlane_cpuCores'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {fieldErrors['controlPlane_cpuCores'] ? (
                <p className="text-xs text-red-500 mt-1">{fieldErrors['controlPlane_cpuCores']}</p>
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
                min="16"
                value={currentMaster.memoryGB}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  onUpdateCurrentMaster({ memoryGB: newValue });
                  onValidateField('memory', newValue);
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['controlPlane_memory'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {fieldErrors['controlPlane_memory'] ? (
                <p className="text-xs text-red-500 mt-1">{fieldErrors['controlPlane_memory']}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Min: 16GB for OpenShift</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Disk Size (GB) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="120"
                value={currentMaster.diskSizeGB}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value);
                  onUpdateCurrentMaster({ diskSizeGB: newValue });
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
              onClick={() => {
                // Validation
                if (!currentMaster.selectedServerIp) {
                  toast.error('Please select a server');
                  return;
                }
                if (!currentMaster.selectedNetworkSwitch) {
                  toast.error('Please select a network switch');
                  return;
                }

                onSaveMaster();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-karios-blue border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-karios-blue"
            >
              {isEditingMaster ? 'Update Control Plane' : 'Add Control Plane'}
            </button>
          </div>
        </div>
      )}

      {/* Show validation error for control plane */}
      {getValidationError() && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex items-center">
            <div className="text-red-400 mr-2">⚠️</div>
            <p className="text-red-700 text-sm font-medium">{getValidationError()}</p>
          </div>
        </div>
      )}

      {/* Display Added Control Planes */}
      {masterNodes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Added Control Planes:</h4>
          {masterNodes.map((master) => (
            <div
              key={master.id}
              className="bg-gray-50 p-3 rounded-md flex items-center justify-between"
            >
              <div className="text-sm">
                <span className="font-medium">{master.name}</span>
                <span className="text-gray-600 ml-2">
                  ({master.cpuCores} CPU, {master.memoryGB}GB RAM, {master.diskSizeGB}GB Disk)
                </span>
                {master.selectedServerIp && (
                  <span className="text-gray-500 ml-2">
                    on{' '}
                    {allServers.find((s) => s.ip === master.selectedServerIp)?.fqdn ||
                      allServers.find((s) => s.ip === master.selectedServerIp)?.name ||
                      master.selectedServerIp}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditMaster(master)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => onRemoveMaster(master.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ControlPlaneConfiguration;
