import React, { useEffect } from 'react';
import { useDataCenter } from '@karios-monorepo/shared-state';

interface K3sControlPlaneFormProps {
  // Control plane configuration
  config: {
    selectedServerIp?: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
    prometheusEnabled?: boolean;
    argocdEnabled?: boolean;
  };

  // Name for editing mode
  editingName?: string;

  // Update handlers
  onConfigChange: (updates: Partial<K3sControlPlaneFormProps['config']>) => void;

  // Server and validation data
  serverIp: string;
  serverData:
    | {
        nodeInfo?: {
          cpus: number;
          memory: number;
          cpus_in_use?: number;
          memory_in_use?: number;
        };
        networkSwitches: string[];
      }
    | undefined;

  // Field errors
  fieldErrors: {
    server?: string;
    switch?: string;
    cpu?: string;
    memory?: string;
    disk?: string;
  };
  onFieldErrorChange: (field: string, error: string) => void;

  // Server data fetching
  fetchServerData?: (serverIp: string) => void;

  // Validation function
  validateBatchNodeCreation: (
    nodeType: 'bootstrap' | 'control-plane' | 'worker',
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number,
    serverIp: string,
    targetCount: number,
    excludeNodeId?: string
  ) => { [key: string]: string };

  // Additional options
  nodeType: 'bootstrap' | 'control-plane';
  isEditing?: boolean;
  excludeNodeId?: string;
  showAdditionalServices?: boolean;
  showServerSelection?: boolean;

  // Resource calculation
  calculateAllocatedResources?: (
    serverIp: string,
    excludeCurrentEdit: boolean,
    excludeNodeId?: string
  ) => { allocatedCpus: number; allocatedMemory: number };
}

const K3sControlPlaneForm: React.FC<K3sControlPlaneFormProps> = ({
  config,
  onConfigChange,
  serverIp,
  serverData,
  fieldErrors,
  onFieldErrorChange,
  fetchServerData,
  validateBatchNodeCreation,
  nodeType,
  isEditing = false,
  editingName,
  excludeNodeId,
  showAdditionalServices = false,
  showServerSelection = false,
  calculateAllocatedResources,
}) => {
  // Get inventory from data center state if server selection is enabled
  const dataCenter = useDataCenter();
  const { inventory, fetchInventory, loading } = showServerSelection
    ? dataCenter
    : { inventory: [], fetchInventory: () => {}, loading: false };

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

  const minCpu = 4;
  const minMemory = 4;
  const minDisk = 30;

  return (
    <div className="space-y-4">
      {/* Show Control Plane Name when editing */}
      {isEditing && editingName && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Control Plane Name</label>
          <input
            type="text"
            value={editingName}
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
            value={config.selectedServerIp || serverIp}
            onChange={(e) => {
              const selectedServerIp = e.target.value;
              onConfigChange({ selectedServerIp });
              if (selectedServerIp && fetchServerData) {
                fetchServerData(selectedServerIp);
              }
              // Clear server-related field errors when server changes
              onFieldErrorChange('server', '');
              onFieldErrorChange('switch', '');
              onFieldErrorChange('cpu', '');
              onFieldErrorChange('memory', '');
              onFieldErrorChange('disk', '');
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
          {(config.selectedServerIp || serverIp) && serverData && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-sm text-blue-700">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <strong>Available CPU:</strong> {serverData.nodeInfo?.cpus || 'N/A'} cores
                  </div>
                  <div>
                    <strong>Available Memory:</strong>{' '}
                    {serverData.nodeInfo?.memory
                      ? `${Math.floor(serverData.nodeInfo.memory / 1024)} GB`
                      : 'N/A'}
                  </div>
                  <div>
                    <strong>Network Switches:</strong> {serverData.networkSwitches?.length || 0}
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
          value={config.selectedNetworkSwitch}
          onChange={(e) => onConfigChange({ selectedNetworkSwitch: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
        >
          <option value="">Select switch</option>
          {serverData?.networkSwitches.map((switchName: string) => (
            <option key={switchName} value={switchName}>
              {switchName}
            </option>
          ))}
        </select>
        {fieldErrors.switch && (
          <div className="text-red-500 text-sm mt-1">{fieldErrors.switch}</div>
        )}
      </div>

      {/* Node Info Display */}
      {serverData?.nodeInfo &&
        calculateAllocatedResources &&
        (() => {
          const totalCpus = serverData.nodeInfo.cpus;
          const totalMemory = Math.floor(serverData.nodeInfo.memory / 1024);
          const usedCpus = serverData.nodeInfo.cpus_in_use || 0;
          const usedMemory = Math.floor((serverData.nodeInfo.memory_in_use || 0) / 1024);

          // Calculate allocated resources
          const { allocatedCpus, allocatedMemory } = calculateAllocatedResources(
            serverIp,
            true,
            excludeNodeId
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
        })()}

      {/* Hardware Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CPU Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CPU`&apos;`s <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={minCpu}
            value={config.cpuCores || ''}
            onChange={(e) => {
              const value = e.target.value === '' ? '' : e.target.value;

              if (value === '') {
                onConfigChange({ cpuCores: 0 });
                onFieldErrorChange('cpu', `K3s ${nodeType} requires minimum ${minCpu} CPUs`);
                return;
              }

              const numValue = parseInt(value);
              onConfigChange({ cpuCores: numValue });

              if (isNaN(numValue) || numValue <= 0) {
                onFieldErrorChange('cpu', 'Please enter a valid CPU count');
                return;
              }

              if (numValue < minCpu) {
                onFieldErrorChange('cpu', `K3s ${nodeType} requires minimum ${minCpu} CPUs`);
                return;
              }

              onFieldErrorChange('cpu', '');

              if (serverIp) {
                const validationResult = validateBatchNodeCreation(
                  nodeType,
                  numValue,
                  config.memoryGB,
                  config.diskSizeGB,
                  serverIp,
                  1,
                  isEditing ? excludeNodeId : undefined
                );

                if (validationResult['cpuCores']) {
                  onFieldErrorChange('cpu', validationResult['cpuCores']);
                }
              }
            }}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
              fieldErrors.cpu ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <p className="text-xs text-gray-500 mt-1">
            Min: {minCpu} cores for K3S {nodeType}
          </p>
          {fieldErrors.cpu && <p className="text-xs text-red-500 mt-1">{fieldErrors.cpu}</p>}
        </div>

        {/* Memory Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Memory (GB) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={minMemory}
            value={config.memoryGB || ''}
            onChange={(e) => {
              const value = e.target.value === '' ? '' : e.target.value;

              if (value === '') {
                onConfigChange({ memoryGB: 0 });
                onFieldErrorChange(
                  'memory',
                  `K3s ${nodeType} requires minimum ${minMemory}GB memory`
                );
                return;
              }

              const numValue = parseInt(value);
              onConfigChange({ memoryGB: numValue });

              if (isNaN(numValue) || numValue <= 0) {
                onFieldErrorChange('memory', 'Please enter a valid memory size');
                return;
              }

              if (numValue < minMemory) {
                onFieldErrorChange(
                  'memory',
                  `K3s ${nodeType} requires minimum ${minMemory}GB memory`
                );
                return;
              }

              onFieldErrorChange('memory', '');

              if (serverIp) {
                const validationResult = validateBatchNodeCreation(
                  nodeType,
                  config.cpuCores,
                  numValue,
                  config.diskSizeGB,
                  serverIp,
                  1,
                  isEditing ? excludeNodeId : undefined
                );

                if (validationResult['memory']) {
                  onFieldErrorChange('memory', validationResult['memory']);
                }
              }
            }}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
              fieldErrors.memory ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <p className="text-xs text-gray-500 mt-1">
            Min: {minMemory} GB for K3S {nodeType}
          </p>
          {fieldErrors.memory && <p className="text-xs text-red-500 mt-1">{fieldErrors.memory}</p>}
        </div>

        {/* Disk Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Disk Size (GB) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={minDisk}
            value={config.diskSizeGB || ''}
            onChange={(e) => {
              const value = e.target.value === '' ? '' : e.target.value;

              if (value === '') {
                onConfigChange({ diskSizeGB: 0 });
                onFieldErrorChange(
                  'disk',
                  `K3s ${nodeType} requires minimum ${minDisk}GB disk space`
                );
                return;
              }

              const numValue = parseInt(value);
              onConfigChange({ diskSizeGB: numValue });

              if (isNaN(numValue) || numValue <= 0) {
                onFieldErrorChange('disk', 'Please enter a valid disk size');
                return;
              }

              if (numValue < minDisk) {
                onFieldErrorChange(
                  'disk',
                  `K3s ${nodeType} requires minimum ${minDisk}GB disk space`
                );
                return;
              }

              onFieldErrorChange('disk', '');

              if (serverIp) {
                const validationResult = validateBatchNodeCreation(
                  nodeType,
                  config.cpuCores,
                  config.memoryGB,
                  numValue,
                  serverIp,
                  1,
                  isEditing ? excludeNodeId : undefined
                );

                if (validationResult['diskSize']) {
                  onFieldErrorChange('disk', validationResult['diskSize']);
                }
              }
            }}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
              fieldErrors.disk ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <p className="text-xs text-gray-500 mt-1">
            Min: {minDisk} GB for K3S {nodeType}
          </p>
          {fieldErrors.disk && <p className="text-xs text-red-500 mt-1">{fieldErrors.disk}</p>}
        </div>
      </div>

      {/* Additional Services (only for bootstrap) */}
      {showAdditionalServices && (
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.prometheusEnabled || false}
              onChange={(e) => onConfigChange({ prometheusEnabled: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Install Prometheus</span>
          </label>
        </div>
      )}
    </div>
  );
};

export default K3sControlPlaneForm;
