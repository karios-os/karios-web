import React from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import envConfig from '../../../../runtime-config';

interface BootstrapControlPlaneConfigurationProps {
  // Control Plane Config
  controlPlaneConfig: {
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
    prometheusandgrafanaEnabled: boolean;
    argocdEnabled: boolean;
    frigateEnabled: boolean;
    frigateGpuEnabled: boolean;
    frigateCpuEnabled: boolean;
    frigateCameraIp: string;
    frigateCameraUsername: string;
    frigateCameraPassword: string;
  } | null;
  setControlPlaneConfig: (config: any) => void;

  // Modal state
  isControlPlaneModalOpen: boolean;
  setIsControlPlaneModalOpen: (open: boolean) => void;

  // Current config being edited
  currentControlPlaneConfig: {
    name: string;
    selectedServerIp: string;
    selectedPool: string;
    selectedNetworkSwitch: string;
    cpuCores: number;
    memoryGB: number;
    diskSizeGB: number;
  };
  setCurrentControlPlaneConfig: (config: any) => void;

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
  controlPlanePools: any[];
  controlPlaneNetworkSwitches: string[];

  // Server list
  allServers: any[];

  // Ubuntu configuration
  ubuntuBasicConfig: {
    k8sName: string;
  };
  ubuntuMaster: {
    prometheusandgrafanaEnabled: boolean;
    argocdEnabled: boolean;
    frigateEnabled: boolean;
    frigateGpuEnabled: boolean;
    frigateCpuEnabled: boolean;
    frigateCameraIp: string;
    frigateCameraUsername: string;
    frigateCameraPassword: string;
  };
  setUbuntuMaster: (master: any) => void;

  // Field errors and validation
  fieldErrors: { [key: string]: string };
  setFieldErrors: (errors: any) => void;
  hasValidationErrors: () => boolean;

  // Password visibility
  showFrigateCameraPassword: boolean;
  setShowFrigateCameraPassword: (show: boolean) => void;

  // Utility functions
  fetchControlPlaneNodeInfo: (serverIp: string) => void;
  fetchControlPlaneServerData: (serverIp: string) => void;
  validateControlPlaneResources: (
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
  getUbuntuControlPlaneName: (clusterName: string) => string;
}

const BootstrapControlPlaneConfiguration: React.FC<BootstrapControlPlaneConfigurationProps> = ({
  controlPlaneConfig,
  setControlPlaneConfig,
  isControlPlaneModalOpen,
  setIsControlPlaneModalOpen,
  currentControlPlaneConfig,
  setCurrentControlPlaneConfig,
  controlPlaneNodeInfo,
  controlPlanePools,
  controlPlaneNetworkSwitches,
  allServers,
  ubuntuBasicConfig,
  ubuntuMaster,
  setUbuntuMaster,
  fieldErrors,
  setFieldErrors,
  hasValidationErrors,
  showFrigateCameraPassword,
  setShowFrigateCameraPassword,
  fetchControlPlaneNodeInfo,
  fetchControlPlaneServerData,
  validateControlPlaneResources,
  validateBatchNodeCreation,
  getUbuntuControlPlaneName,
}) => {
  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          BootStrap Control Plane Configuration
        </h3>
        {!controlPlaneConfig && (
          <button
            onClick={() => {
              // Reset control plane config
              setCurrentControlPlaneConfig({
                name: '',
                selectedServerIp: '',
                selectedPool: '',
                selectedNetworkSwitch: '',
                cpuCores: 4,
                memoryGB: 8,
                diskSizeGB: 40,
              });
              setIsControlPlaneModalOpen(true);
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
          nodes . And for worker nodes 4 CPU, 8GB RAM
        </p>
      </div>

      {/* Master Control Plane Configuration Form */}
      {isControlPlaneModalOpen && (
        <div className="space-y-4 border-t pt-4">
          {/* Server Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Server <span className="text-red-500">*</span>
            </label>
            <select
              value={currentControlPlaneConfig.selectedServerIp}
              onChange={(e) => {
                const selectedServerIp = e.target.value;
                setCurrentControlPlaneConfig((prev) => ({
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
                value={currentControlPlaneConfig.selectedPool}
                onChange={(e) => {
                  setCurrentControlPlaneConfig((prev) => ({
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
                <div className="text-red-500 text-sm mt-1">{fieldErrors['storagePool']}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Network Switch <span className="text-red-500">*</span>
              </label>
              <select
                value={currentControlPlaneConfig.selectedNetworkSwitch}
                onChange={(e) => {
                  setCurrentControlPlaneConfig((prev) => ({
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
                <div className="text-red-500 text-sm mt-1">{fieldErrors['networkSwitch']}</div>
              )}
            </div>
          </div>

          {/* Node Info Display */}
          {controlPlaneNodeInfo && (
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Available Resources:</strong> cpus: {controlPlaneNodeInfo.cpus} | cpus in
                use: {controlPlaneNodeInfo.cpus_in_use} | memory: {controlPlaneNodeInfo.memory} |
                memory in use: {controlPlaneNodeInfo.memory_in_use} | sockets:{' '}
                {controlPlaneNodeInfo.sockets}
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
              value={getUbuntuControlPlaneName(ubuntuBasicConfig.k8sName)}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
              placeholder="ub-clustername-controlplane"
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
                value={currentControlPlaneConfig.cpuCores}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setCurrentControlPlaneConfig((prev) => ({ ...prev, cpuCores: value }));

                  // First do basic validation
                  const errors = validateControlPlaneResources(
                    value,
                    currentControlPlaneConfig.memoryGB,
                    currentControlPlaneConfig.diskSizeGB
                  );
                  setFieldErrors((prev) => ({ ...prev, cpuCores: errors['cpuCores'] || '' }));

                  // Also check batch validation like OpenShift does
                  if (currentControlPlaneConfig.selectedServerIp) {
                    const validationResult = validateBatchNodeCreation(
                      'control-plane',
                      value,
                      currentControlPlaneConfig.memoryGB,
                      currentControlPlaneConfig.diskSizeGB,
                      currentControlPlaneConfig.selectedServerIp,
                      1 // Ubuntu only has 1 control plane
                    );

                    // Check if there are any validation errors
                    const cpuError = validationResult['cpuCores'];
                    const memoryError = validationResult['memory'];

                    if (cpuError || memoryError) {
                      // Show the batch validation error instead of basic validation
                      const alertMessage = cpuError || memoryError || '';
                      setFieldErrors((prev) => ({
                        ...prev,
                        cpuCores: alertMessage,
                      }));
                    }
                  }
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['cpuCores'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min: {controlPlaneNodeInfo?.min_cpu_control_plane || 4} cores for Ubuntu
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
                value={currentControlPlaneConfig.memoryGB}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setCurrentControlPlaneConfig((prev) => ({ ...prev, memoryGB: value }));

                  // First do basic validation
                  const errors = validateControlPlaneResources(
                    currentControlPlaneConfig.cpuCores,
                    value,
                    currentControlPlaneConfig.diskSizeGB
                  );
                  setFieldErrors((prev) => ({ ...prev, memory: errors['memory'] || '' }));

                  // Also check batch validation like OpenShift does
                  if (currentControlPlaneConfig.selectedServerIp) {
                    const validationResult = validateBatchNodeCreation(
                      'control-plane',
                      currentControlPlaneConfig.cpuCores,
                      value,
                      currentControlPlaneConfig.diskSizeGB,
                      currentControlPlaneConfig.selectedServerIp,
                      1 // Ubuntu only has 1 control plane
                    );

                    // Check if there are any validation errors
                    const cpuError = validationResult['cpuCores'];
                    const memoryError = validationResult['memory'];

                    if (cpuError || memoryError) {
                      // Show the batch validation error instead of basic validation
                      const alertMessage = memoryError || cpuError || '';
                      setFieldErrors((prev) => ({
                        ...prev,
                        memory: alertMessage,
                      }));
                    }
                  }
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['memory'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min: {controlPlaneNodeInfo?.min_memory_control_plane || 8} GB for Ubuntu
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
                value={currentControlPlaneConfig.diskSizeGB}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setCurrentControlPlaneConfig((prev) => ({ ...prev, diskSizeGB: value }));

                  // Validate resources
                  const errors = validateControlPlaneResources(
                    currentControlPlaneConfig.cpuCores,
                    currentControlPlaneConfig.memoryGB,
                    value
                  );
                  setFieldErrors((prev) => ({ ...prev, diskSize: errors['diskSize'] || '' }));
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue ${
                  fieldErrors['diskSize'] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Min: {controlPlaneNodeInfo?.min_disk_control_plane || 40} GB for Ubuntu
              </p>
              {fieldErrors['diskSize'] && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors['diskSize']}</p>
              )}
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={ubuntuMaster.prometheusandgrafanaEnabled}
                onChange={(e) =>
                  setUbuntuMaster((prev) => ({
                    ...prev,
                    prometheusandgrafanaEnabled: e.target.checked,
                  }))
                }
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Install Prometheus and Grafana</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={ubuntuMaster.argocdEnabled}
                onChange={(e) =>
                  setUbuntuMaster((prev) => ({ ...prev, argocdEnabled: e.target.checked }))
                }
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Install ArgoCD</span>
            </label>
          </div>

          {/* Frigate Configuration - commented out for now */}
          {ubuntuMaster.frigateEnabled && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Frigate Configuration</h4>

              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-gray-700">Frigate Type:</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="frigateType"
                      checked={ubuntuMaster.frigateGpuEnabled}
                      onChange={() => {
                        setUbuntuMaster((prev) => ({
                          ...prev,
                          frigateGpuEnabled: true,
                          frigateCpuEnabled: false,
                        }));
                        if (fieldErrors['frigateType']) {
                          setFieldErrors((prev) => ({ ...prev, frigateType: '' }));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700"> GPU</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="frigateType"
                      checked={ubuntuMaster.frigateCpuEnabled}
                      onChange={() => {
                        setUbuntuMaster((prev) => ({
                          ...prev,
                          frigateGpuEnabled: false,
                          frigateCpuEnabled: true,
                        }));
                        if (fieldErrors['frigateType']) {
                          setFieldErrors((prev) => ({ ...prev, frigateType: '' }));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">CPU</span>
                  </label>
                </div>
                {fieldErrors['frigateType'] && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors['frigateType']}</p>
                )}
              </div>

              {ubuntuMaster.frigateGpuEnabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-amber-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-amber-800">GPU Required</h3>
                      <div className="mt-1 text-sm text-amber-700">
                        <p>
                          <strong>Important:</strong> A GPU must be attached to the VM before
                          starting it. Without a GPU, Frigate will not function.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(ubuntuMaster.frigateGpuEnabled || ubuntuMaster.frigateCpuEnabled) && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Camera IP Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ubuntuMaster.frigateCameraIp}
                      onChange={(e) => {
                        setUbuntuMaster((prev) => ({
                          ...prev,
                          frigateCameraIp: e.target.value,
                        }));
                        if (fieldErrors['frigateCameraIp']) {
                          setFieldErrors((prev) => ({ ...prev, frigateCameraIp: '' }));
                        }
                      }}
                      placeholder="Enter camera IP address"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      <strong>Note:</strong> Camera must be on the same subnet as the VM for streams
                      to work properly.
                    </p>
                    {fieldErrors['frigateCameraIp'] && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors['frigateCameraIp']}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Camera Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ubuntuMaster.frigateCameraUsername}
                      onChange={(e) => {
                        setUbuntuMaster((prev) => ({
                          ...prev,
                          frigateCameraUsername: e.target.value,
                        }));
                        if (fieldErrors['frigateCameraUsername']) {
                          setFieldErrors((prev) => ({ ...prev, frigateCameraUsername: '' }));
                        }
                      }}
                      placeholder="Enter camera username"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
                    />
                    {fieldErrors['frigateCameraUsername'] && (
                      <p className="text-xs text-red-500 mt-1">
                        {fieldErrors['frigateCameraUsername']}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Camera Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showFrigateCameraPassword ? 'text' : 'password'}
                        value={ubuntuMaster.frigateCameraPassword}
                        onChange={(e) => {
                          setUbuntuMaster((prev) => ({
                            ...prev,
                            frigateCameraPassword: e.target.value,
                          }));
                          if (fieldErrors['frigateCameraPassword']) {
                            setFieldErrors((prev) => ({ ...prev, frigateCameraPassword: '' }));
                          }
                        }}
                        placeholder="Enter camera password"
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFrigateCameraPassword(!showFrigateCameraPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                        aria-label={showFrigateCameraPassword ? 'Hide password' : 'Show password'}
                      >
                        {showFrigateCameraPassword ? <FaEye /> : <FaEyeSlash />}
                      </button>
                    </div>
                    {fieldErrors['frigateCameraPassword'] && (
                      <p className="text-xs text-red-500 mt-1">
                        {fieldErrors['frigateCameraPassword']}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setIsControlPlaneModalOpen(false);
                setCurrentControlPlaneConfig({
                  name: '',
                  selectedServerIp: '',
                  selectedPool: '',
                  selectedNetworkSwitch: '',
                  cpuCores: 4,
                  memoryGB: 8,
                  diskSizeGB: 40,
                });
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Validate required fields
                const errors: { [key: string]: string } = {};
                if (!currentControlPlaneConfig.selectedServerIp) {
                  errors['serverIp'] = 'Server selection is required';
                }
                if (!currentControlPlaneConfig.selectedPool) {
                  errors['storagePool'] = 'Storage pool selection is required';
                }
                if (!currentControlPlaneConfig.selectedNetworkSwitch) {
                  errors['networkSwitch'] = 'Network switch selection is required';
                }
                if (!currentControlPlaneConfig.selectedServerIp) {
                  errors['serverIp'] = 'Server selection is required';
                }

                // Frigate configuration validation - commented out for now
                if (ubuntuMaster.frigateEnabled) {
                  if (!ubuntuMaster.frigateGpuEnabled && !ubuntuMaster.frigateCpuEnabled) {
                    errors['frigateType'] = 'Please select either GPU or CPU for Frigate';
                  }
                  if (!ubuntuMaster.frigateCameraIp.trim()) {
                    errors['frigateCameraIp'] = 'Camera IP address is required for Frigate';
                  }
                  if (!ubuntuMaster.frigateCameraUsername.trim()) {
                    errors['frigateCameraUsername'] = 'Camera username is required for Frigate';
                  }
                  if (!ubuntuMaster.frigateCameraPassword.trim()) {
                    errors['frigateCameraPassword'] = 'Camera password is required for Frigate';
                  }
                }

                if (Object.keys(errors).length > 0) {
                  setFieldErrors(errors);
                  return;
                }
                const controlPlaneData = {
                  ...currentControlPlaneConfig,
                  name: getUbuntuControlPlaneName(ubuntuBasicConfig.k8sName),
                  cpuCores: currentControlPlaneConfig.cpuCores,
                  memoryGB: currentControlPlaneConfig.memoryGB,
                  prometheusandgrafanaEnabled: ubuntuMaster.prometheusandgrafanaEnabled,
                  argocdEnabled: ubuntuMaster.argocdEnabled,
                  frigateEnabled: ubuntuMaster.frigateEnabled,
                  frigateGpuEnabled: ubuntuMaster.frigateGpuEnabled,
                  frigateCpuEnabled: ubuntuMaster.frigateCpuEnabled,
                  frigateCameraIp: ubuntuMaster.frigateCameraIp,
                  frigateCameraUsername: ubuntuMaster.frigateCameraUsername,
                  frigateCameraPassword: ubuntuMaster.frigateCameraPassword,
                };
                setControlPlaneConfig(controlPlaneData);
                setIsControlPlaneModalOpen(false);
                // Reset control plane config for next use
                setCurrentControlPlaneConfig({
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
                  : 'text-white bg-karios-blue hover:bg-blue-600'
              }`}
            >
              {controlPlaneConfig && isControlPlaneModalOpen ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {controlPlaneConfig && !isControlPlaneModalOpen && (
        <div className="bg-gray-50 p-4 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">{controlPlaneConfig.name}</h4>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  // Populate edit form with existing data
                  setCurrentControlPlaneConfig({
                    name: controlPlaneConfig.name,
                    selectedServerIp: controlPlaneConfig.selectedServerIp,
                    selectedPool: controlPlaneConfig.selectedPool,
                    selectedNetworkSwitch: controlPlaneConfig.selectedNetworkSwitch,
                    cpuCores: controlPlaneConfig.cpuCores,
                    memoryGB: controlPlaneConfig.memoryGB,
                    diskSizeGB: controlPlaneConfig.diskSizeGB,
                  });
                  setIsControlPlaneModalOpen(true);
                  // Clear the existing config to allow editing
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => setControlPlaneConfig(null)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-md p-3 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Server:</span>
                <span className="text-gray-900 ml-2">{controlPlaneConfig.selectedServerIp}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Storage Pool:</span>
                <span className="text-gray-900 ml-2">{controlPlaneConfig.selectedPool}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">CPU:</span>
                <span className="text-gray-900 ml-2">{controlPlaneConfig.cpuCores} CPU`&apos;`s</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Memory:</span>
                <span className="text-gray-900 ml-2">{controlPlaneConfig.memoryGB}GB</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Disk:</span>
                <span className="text-gray-900 ml-2">{controlPlaneConfig.diskSizeGB}GB</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Network:</span>
                <span className="text-gray-900 ml-2">
                  {controlPlaneConfig.selectedNetworkSwitch}
                </span>
              </div>
            </div>
            {(controlPlaneConfig.prometheusandgrafanaEnabled ||
              controlPlaneConfig.argocdEnabled ||
              controlPlaneConfig.frigateEnabled) && (
              <div className="pt-2 border-t border-gray-100">
                <span className="font-medium text-gray-700">Options:</span>
                <span className="text-green-600 ml-2">
                  {controlPlaneConfig.prometheusandgrafanaEnabled ? 'Prometheus & Grafana' : ''}
                  {controlPlaneConfig.prometheusandgrafanaEnabled &&
                  (controlPlaneConfig.argocdEnabled || controlPlaneConfig.frigateEnabled)
                    ? ', '
                    : ''}
                  {controlPlaneConfig.argocdEnabled ? 'ArgoCD' : ''}
                  {controlPlaneConfig.argocdEnabled && controlPlaneConfig.frigateEnabled
                    ? ', '
                    : ''}
                  {controlPlaneConfig.frigateEnabled
                    ? `Frigate (${controlPlaneConfig.frigateGpuEnabled ? 'GPU' : 'CPU'})`
                    : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BootstrapControlPlaneConfiguration;
