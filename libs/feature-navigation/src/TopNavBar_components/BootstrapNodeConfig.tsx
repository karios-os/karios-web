import React from 'react';
import envConfig from '../../../../runtime-config';
import K3sControlPlaneForm from './K3sControlPlaneForm';

interface K3sControlPlane {
  name: string;
  selectedServerIp: string;
  selectedPool: string;
  selectedNetworkSwitch: string;
  cpuCores: number;
  memoryGB: number;
  diskSizeGB: number;
  prometheusEnabled: boolean;
  argocdEnabled: boolean;
}

interface BootstrapNodeConfigProps {
  // Bootstrap control plane state
  bootstrapControlPlane: K3sControlPlane | null;
  setBootstrapControlPlane: (config: K3sControlPlane | null) => void;

  // Form visibility state
  showBootstrapForm: boolean;
  setShowBootstrapForm: (show: boolean) => void;
  editingBootstrap: boolean;
  setEditingBootstrap: (editing: boolean) => void;

  // Current form config
  currentBootstrapConfig: K3sControlPlane;
  setCurrentBootstrapConfig: React.Dispatch<React.SetStateAction<K3sControlPlane>>;

  // Cluster configuration
  clusterConfig: {
    clusterName: string;
  };

  // Server data and validation
  serverData: { [key: string]: any };
  fetchServerData: (serverIp: string) => void;

  // Field errors
  fieldErrors: { [key: string]: string | undefined };
  setFieldErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string | undefined }>>;

  // Validation functions
  hasBootstrapControlPlaneErrors: () => boolean;
  saveBootstrapControlPlane: () => boolean;
  validateBatchNodeCreation: (
    nodeType: 'bootstrap' | 'control-plane' | 'worker',
    cpuCores: number,
    memoryGB: number,
    diskSizeGB: number,
    serverIp: string,
    targetCount: number,
    excludeNodeId?: string
  ) => { [key: string]: string };
  calculateAllocatedResources: (serverIp: string) => any;
}

const getK3sBootstrapControlPlaneName = (clusterName: string) => {
  return clusterName ? `k3s-${clusterName}-controlplane` : 'k3s-clustername-controlplane';
};

const BootstrapNodeConfig: React.FC<BootstrapNodeConfigProps> = ({
  bootstrapControlPlane,
  setBootstrapControlPlane,
  showBootstrapForm,
  setShowBootstrapForm,
  editingBootstrap,
  setEditingBootstrap,
  currentBootstrapConfig,
  setCurrentBootstrapConfig,
  clusterConfig,
  serverData,
  fetchServerData,
  fieldErrors,
  setFieldErrors,
  hasBootstrapControlPlaneErrors,
  saveBootstrapControlPlane,
  validateBatchNodeCreation,
  calculateAllocatedResources,
}) => {
  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          BootStrap Control Plane Configuration
        </h3>
        {!bootstrapControlPlane && !showBootstrapForm && (
          <button
            onClick={() => {
              // Set control node IP from envConfig as default
              const controlNodeIp = envConfig().CONTROL_NODE_IP.URL;

              setCurrentBootstrapConfig((prev) => ({
                ...prev,
                selectedServerIp: controlNodeIp,
              }));
              if (controlNodeIp) {
                fetchServerData(controlNodeIp);
              }
              setShowBootstrapForm(true);
            }}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-karios-blue bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-karios-blue"
          >
            <span className="mr-1">+</span>
            Add Control Plane
          </button>
        )}
      </div>

      <div className="p-2 bg-orange-50 border border-orange-200 rounded-md">
        <p className="text-xs text-orange-700">
          <strong>Note:</strong> For High Availability, please make sure you have at least 3
          Controlplane vms (including master) and 2 worker Vms With 8CPU, 16GB RAM for control plane
          nodes, And for worker nodes 4 CPU, 8GB RAM
        </p>
      </div>

      {/* Inline Bootstrap Form */}
      {(showBootstrapForm || editingBootstrap) && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-lg font-semibold text-gray-900">Configure Bootstrap Control Plane</h4>

          {/* Control Plane Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Control Plane Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={getK3sBootstrapControlPlaneName(clusterConfig.clusterName)}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
              placeholder={
                clusterConfig.clusterName
                  ? `k3s-${clusterConfig.clusterName}-controlplane`
                  : 'k3s-clustername-controlplane'
              }
            />
          </div>

          {/* Reusable Control Plane Form */}
          <K3sControlPlaneForm
            config={{
              selectedServerIp: currentBootstrapConfig.selectedServerIp,
              selectedNetworkSwitch: currentBootstrapConfig.selectedNetworkSwitch,
              cpuCores: currentBootstrapConfig.cpuCores,
              memoryGB: currentBootstrapConfig.memoryGB,
              diskSizeGB: currentBootstrapConfig.diskSizeGB,
              prometheusEnabled: currentBootstrapConfig.prometheusEnabled,
              argocdEnabled: currentBootstrapConfig.argocdEnabled,
            }}
            onConfigChange={(updates) =>
              setCurrentBootstrapConfig((prev) => ({ ...prev, ...updates }))
            }
            serverIp={currentBootstrapConfig.selectedServerIp}
            serverData={
              currentBootstrapConfig.selectedServerIp
                ? serverData[currentBootstrapConfig.selectedServerIp]
                : undefined
            }
            fieldErrors={{
              server: fieldErrors['bootstrapServer'],
              switch: fieldErrors['bootstrapSwitch'],
              cpu: fieldErrors['bootstrapCpu'],
              memory: fieldErrors['bootstrapMemory'],
              disk: fieldErrors['bootstrapDisk'],
            }}
            onFieldErrorChange={(field, error) => {
              const fieldMap: { [key: string]: string } = {
                server: 'bootstrapServer',
                switch: 'bootstrapSwitch',
                cpu: 'bootstrapCpu',
                memory: 'bootstrapMemory',
                disk: 'bootstrapDisk',
              };
              setFieldErrors((prev) => ({ ...prev, [fieldMap[field]]: error }));
            }}
            validateBatchNodeCreation={validateBatchNodeCreation}
            nodeType="bootstrap"
            isEditing={editingBootstrap}
            excludeNodeId="bootstrap"
            showAdditionalServices={true}
            showServerSelection={true}
            fetchServerData={fetchServerData}
            calculateAllocatedResources={calculateAllocatedResources}
          />

          {/* Resource Validation Error */}
          {fieldErrors['bootstrapResources'] && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{fieldErrors['bootstrapResources']}</p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setShowBootstrapForm(false);
                setEditingBootstrap(false);
                // Reset form if it's a new entry
                if (!editingBootstrap) {
                  setCurrentBootstrapConfig({
                    name: 'K3S-controlplane1',
                    selectedServerIp: '',
                    selectedPool: '',
                    selectedNetworkSwitch: '',
                    cpuCores: 4,
                    memoryGB: 4,
                    diskSizeGB: 30,
                    prometheusEnabled: false,
                    argocdEnabled: false,
                  });
                }
              }}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Prevent action if there are validation errors
                if (hasBootstrapControlPlaneErrors()) return;

                // Only close the form if save is successful
                const saveSuccess = saveBootstrapControlPlane();
                // Form states are now handled inside the save function
              }}
              disabled={hasBootstrapControlPlaneErrors()}
              className={`px-4 py-2 text-white rounded-md ${
                hasBootstrapControlPlaneErrors()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Display Configured Bootstrap Control Plane */}
      {bootstrapControlPlane && !showBootstrapForm && !editingBootstrap && (
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">
              {getK3sBootstrapControlPlaneName(clusterConfig.clusterName)}
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCurrentBootstrapConfig(bootstrapControlPlane);
                  setEditingBootstrap(true);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => setBootstrapControlPlane(null)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-600 grid grid-cols-2 gap-4">
            <div>Server: {bootstrapControlPlane.selectedServerIp}</div>
            <div>CPU: {bootstrapControlPlane.cpuCores} cores</div>
            <div>Memory: {bootstrapControlPlane.memoryGB} GB</div>
            <div>Disk: {bootstrapControlPlane.diskSizeGB} GB</div>
            <div>Network: {bootstrapControlPlane.selectedNetworkSwitch}</div>
          </div>
        </div>
      )}

      {/* Show message when no bootstrap configured */}
      {!bootstrapControlPlane && !showBootstrapForm && (
        <div className="text-sm text-gray-500 italic">
          No bootstrap control plane configured yet.
        </div>
      )}
    </div>
  );
};

export default BootstrapNodeConfig;
