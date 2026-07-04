import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { logger } from '../../../shared-state/src/utils/logger';
import {
  vmProvisioningService,
  NodeInfo,
  VMProvisioningPayload,
} from './services/vmProvisioningService';

export interface ControlPlaneNodeProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (success: boolean) => void;
  clusterName: string;
  kubernetesType: string; // 'ubuntu', 'openshift', 'anthos'
  osType: string; // 'ubuntu-server', etc.
  imageName: string; // 'jammy-server-cloudimg-amd64.img'
  username: string;
  password: string;
  cpu: number;
  memory: string;
  disk_size: string;
  // Anthos specific
  anthos_project_id?: string;
  admin_email?: string;
  anthos_cluster_type?: string;
  anthos_cluster_profile?: string;
}

interface NodeSelection {
  ip: string;
  datastore: string;
  nw_switch: string;
}

const ControlPlaneNodeConfig: React.FC<ControlPlaneNodeProps> = ({
  isOpen,
  onClose,
  onSubmit,
  clusterName,
  kubernetesType,
  osType,
  imageName,
  username,
  password,
  cpu,
  memory,
  disk_size,
  anthos_project_id,
  admin_email,
  anthos_cluster_type,
  anthos_cluster_profile,
}) => {
  const [nodeSelection, setNodeSelection] = useState<NodeSelection>({
    ip: '',
    datastore: '',
    nw_switch: '',
  });
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  // Load available nodes on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadNodes = async () => {
      setLoadingNodes(true);
      try {
        const availableNodes = await vmProvisioningService.getNodeInfo();
        setNodes(availableNodes);
      } catch (error) {
        logger.error('Failed to load nodes', error);
        toast.error('Failed to load available nodes');
      } finally {
        setLoadingNodes(false);
      }
    };

    loadNodes();
  }, [isOpen]);

  const handleNodeSelect = (field: 'ip' | 'datastore' | 'nw_switch', value: string) => {
    setNodeSelection((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getVMName = (): string => {
    const prefix =
      kubernetesType === 'ubuntu' ? 'ub-' : kubernetesType === 'openshift' ? 'op-' : 'an-';
    return `${prefix}${clusterName}-controlplane`;
  };

  const buildProvisioningPayload = (): VMProvisioningPayload => {
    const payload: VMProvisioningPayload = {
      os_type: osType,
      image_name: imageName,
      username,
      password,
      kubernetes_cluster_name: clusterName,
      kubernetes_type:
        kubernetesType === 'anthos' ? 'anthos-kubernetes' : `${kubernetesType}-kubernetes`,
      datastore: nodeSelection.datastore,
      vm_name: getVMName(),
      cpu: cpu,
      memory: memory,
      disk_size: disk_size,
      nw_switch: nodeSelection.nw_switch,
      kubernetes_control_plane: true,
    };

    // Add Anthos-specific fields if applicable
    if (kubernetesType === 'anthos') {
      payload.anthos_project_id = anthos_project_id;
      payload.admin_email = admin_email;
      payload.anthos_cluster_type = anthos_cluster_type;
      payload.anthos_cluster_profile = anthos_cluster_profile;
    }

    return payload;
  };

  const handleSubmit = async () => {
    // Validate selection
    if (!nodeSelection.ip || !nodeSelection.datastore || !nodeSelection.nw_switch) {
      toast.error('Please select server, storage pool, and network switch');
      return;
    }

    setProvisioning(true);
    try {
      const payload = buildProvisioningPayload();
      await vmProvisioningService.provisionVM(payload, nodeSelection.ip);
      toast.success('Control Plane node provisioned successfully!');
      onSubmit(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Provisioning failed';
      toast.error(errorMessage);
      onSubmit(false);
    } finally {
      setProvisioning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <h2 className="text-2xl font-semibold text-gray-900">Configure Control Plane Node</h2>
          <p className="text-gray-600 mt-1">
            {kubernetesType.charAt(0).toUpperCase() + kubernetesType.slice(1)} Cluster - Control
            Plane Node
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loadingNodes ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading available nodes...</p>
            </div>
          ) : (
            <>
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Control Plane Node</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    The control plane node manages the cluster API server and etcd database
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  {/* Select Server */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Server <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={nodeSelection.ip || ''}
                      onChange={(e) => handleNodeSelect('ip', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a server</option>
                      {nodes.map((node) => (
                        <option key={node.fqdn || node.ip} value={node.fqdn || node.ip}>
                          {node.fqdn || node.ip} ({node.hostname})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Storage Pool */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Storage Pool <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={nodeSelection.datastore || ''}
                      onChange={(e) => handleNodeSelect('datastore', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select pool</option>
                      {nodeSelection.ip &&
                        nodes
                          .find((n) => n.ip === nodeSelection.ip)
                          ?.available_storage.map((storage) => (
                            <option key={storage} value={storage}>
                              {storage}
                            </option>
                          ))}
                    </select>
                  </div>

                  {/* Select Network Switch */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Network Switch <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={nodeSelection.nw_switch || ''}
                      onChange={(e) => handleNodeSelect('nw_switch', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select switch</option>
                      {nodeSelection.ip &&
                        nodes
                          .find((n) => n.ip === nodeSelection.ip)
                          ?.network_switches.map((sw) => (
                            <option key={sw} value={sw}>
                              {sw}
                            </option>
                          ))}
                    </select>
                  </div>
                </div>

                {/* VM Specs */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CPUs</label>
                    <input
                      type="number"
                      value={cpu}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Min: {cpu} cores</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Memory (GB)
                    </label>
                    <input
                      type="text"
                      value={memory}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Min: {memory} RAM</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Disk Size (GB)
                    </label>
                    <input
                      type="text"
                      value={disk_size}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Min: {disk_size} Storage</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={provisioning}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={provisioning || loadingNodes}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {provisioning && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {provisioning ? 'Provisioning...' : 'Provision Control Plane'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPlaneNodeConfig;
