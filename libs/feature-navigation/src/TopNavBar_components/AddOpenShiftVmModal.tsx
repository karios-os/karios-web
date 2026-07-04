import React, { useState, useEffect } from 'react';
import { SiRedhatopenshift } from 'react-icons/si';
import { toast } from 'react-toastify';
import Modal from '../../../shared-state/src/widgets/Modal';
import api from '../../../shared-state/src/utils/interceptor';
import { logger } from '../../../shared-state/src/utils/logger';
import envConfig from '../../../../runtime-config';

interface AddOpenShiftVmModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterName: string;
  clusterData: any;
  onSubmit: (vmConfig: any) => void;
  availableServers: Array<{ name: string; ip: string }>;
}

export const AddOpenShiftVmModal: React.FC<AddOpenShiftVmModalProps> = ({
  isOpen,
  onClose,
  clusterName,
  clusterData,
  onSubmit,
  availableServers,
}) => {
  const [vmConfig, setVmConfig] = useState({
    vm_name: '',
    node_type: 'worker' as 'control-plane' | 'worker',
    cpu: 4,
    memory: 8, // GB
    disk_size: 120, // GB
    network_switch: '',
    node_ip: availableServers[0]?.ip || '',
    pool: 'default',
    domain_name: '',
    haproxy_enabled: false,
  });
  const [networkSwitches, setNetworkSwitches] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate VM name based on node type and existing VMs
  const generateVmName = (nodeType: 'control-plane' | 'worker') => {
    const existingVMs = clusterData?.vms || [];
    const prefix = clusterName;

    if (nodeType === 'control-plane') {
      // Find next control plane number
      const controlPlanes = existingVMs.filter(
        (vm: any) => vm.vmName?.includes('controlplane') || vm.vmName?.includes('master')
      );
      const nextNum = controlPlanes.length + 1;
      return `${prefix}-controlplane${nextNum > 1 ? nextNum : ''}`;
    } else {
      // Find next worker number
      const workers = existingVMs.filter(
        (vm: any) => vm.vmName?.includes('worker') && !vm.vmName?.includes('controlplane')
      );
      const nextNum = workers.length + 1;
      return `${prefix}-worker${nextNum}`;
    }
  };

  // Reset form when modal opens and initialize with generated VM name
  useEffect(() => {
    if (isOpen) {
      // Extract domain from existing VMs - try multiple approaches
      let domainName = '';

      if (clusterData?.vms && clusterData.vms.length > 0) {
        // Try to find domain from FQDN field
        const vmWithFqdn = clusterData.vms.find((vm: any) => vm.fqdn && vm.fqdn.includes('.'));
        if (vmWithFqdn?.fqdn) {
          // Extract domain by removing the hostname part
          const fqdnParts = vmWithFqdn.fqdn.split('.');

          // Handle different FQDN formats:
          // Case 1: "hostname.domain.com" -> want "domain.com"
          // Case 2: "hostname.wynbit.com" -> want "wynbit.com"
          // Case 3: "op-jash.wynbit.com" -> want "wynbit.com"

          if (fqdnParts.length >= 3) {
            // Take the last 2 parts (domain + TLD)
            domainName = fqdnParts.slice(-2).join('.');
          } else if (fqdnParts.length === 2) {
            // Already just domain.tld format
            domainName = vmWithFqdn.fqdn;
          } else {
            // Single part, probably not a valid FQDN
            domainName = '';
          }

          logger.info('Domain extracted from FQDN:', {
            originalFqdn: vmWithFqdn.fqdn,
            fqdnParts: fqdnParts,
            extractedDomain: domainName,
          });
        }

        // If no FQDN found, check if there's a domain_name field directly
        if (!domainName) {
          const vmWithDomain = clusterData.vms.find((vm: any) => vm.domain_name || vm.domainName);
          if (vmWithDomain) {
            domainName = vmWithDomain.domain_name || vmWithDomain.domainName;
            logger.info('Domain extracted from domain field:', domainName);
          }
        }
      }

      // Log cluster data for debugging
      logger.info('Cluster data for domain extraction:', {
        clusterName,
        vmsCount: clusterData?.vms?.length || 0,
        vms:
          clusterData?.vms?.map((vm: any) => ({
            vmName: vm.vmName,
            fqdn: vm.fqdn,
            domain_name: vm.domain_name,
            domainName: vm.domainName,
          })) || [],
        extractedDomain: domainName,
      });

      // Generate initial VM name for worker node type
      const initialVmName = generateVmName('worker');

      setVmConfig({
        vm_name: initialVmName,
        node_type: 'worker',
        cpu: 4,
        memory: 8,
        disk_size: 120,
        network_switch: '',
        node_ip: availableServers[0]?.ip || '',
        pool: 'default',
        domain_name: domainName,
        haproxy_enabled: false,
      });
    }
  }, [isOpen, availableServers, clusterName, clusterData]);

  // Update VM name when node type changes (after initial load)
  useEffect(() => {
    if (isOpen && clusterName && vmConfig.node_type) {
      const newName = generateVmName(vmConfig.node_type);
      setVmConfig((prev) => ({ ...prev, vm_name: newName }));
    }
  }, [vmConfig.node_type]);

  // Fetch network switches
  useEffect(() => {
    const fetchNetworkSwitches = async () => {
      try {
        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.ok) {
          const switchesData = await response.json();
          if (switchesData && Array.isArray(switchesData)) {
            const switchNames = switchesData.map((sw: any) => sw.name).filter(Boolean);
            setNetworkSwitches(switchNames);
          }
        }
      } catch (error) {
        logger.error('Error fetching network switches:', error);
      }
    };

    if (isOpen) {
      fetchNetworkSwitches();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vmConfig.vm_name || !vmConfig.network_switch || !vmConfig.node_ip) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate minimum requirements
    if (vmConfig.node_type === 'control-plane' && (vmConfig.cpu < 4 || vmConfig.memory < 16)) {
      toast.error('Control plane nodes require minimum 4 CPUs and 16GB memory');
      return;
    }
    if (vmConfig.node_type === 'worker' && (vmConfig.cpu < 4 || vmConfig.memory < 8)) {
      toast.error('Worker nodes require minimum 4 CPUs and 8GB memory');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(vmConfig);
    } catch (error) {
      logger.error('Error submitting OpenShift VM config:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = (
    <div className="flex items-center gap-3">
      <SiRedhatopenshift className="w-6 h-6 text-red-600" />
      <span>Add VM to OpenShift Cluster</span>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} width="700px" scrollable={true}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Node Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Node Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="node_type"
                value="control-plane"
                checked={vmConfig.node_type === 'control-plane'}
                onChange={(e) =>
                  setVmConfig((prev) => ({ ...prev, node_type: e.target.value as 'control-plane' }))
                }
                className="mr-3"
              />
              <div>
                <div className="font-medium">Control Plane</div>
                <div className="text-sm text-gray-600">Master node (min: 4 CPU, 16GB RAM)</div>
              </div>
            </label>
            <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="node_type"
                value="worker"
                checked={vmConfig.node_type === 'worker'}
                onChange={(e) =>
                  setVmConfig((prev) => ({ ...prev, node_type: e.target.value as 'worker' }))
                }
                className="mr-3"
              />
              <div>
                <div className="font-medium">Worker</div>
                <div className="text-sm text-gray-600">Worker node (min: 4 CPU, 8GB RAM)</div>
              </div>
            </label>
          </div>
        </div>

        {/* VM Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            VM Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={vmConfig.vm_name}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
            title="VM name is auto-generated based on node type"
          />
          <p className="text-xs text-gray-500 mt-1">
            Auto-generated based on cluster name and node type
          </p>
        </div>

        {/* Hardware Configuration */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CPU Cores <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={vmConfig.node_type === 'control-plane' ? 4 : 4}
              value={vmConfig.cpu}
              onChange={(e) => setVmConfig((prev) => ({ ...prev, cpu: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Min: {vmConfig.node_type === 'control-plane' ? '4' : '4'} CPUs
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Memory (GB) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={vmConfig.node_type === 'control-plane' ? 16 : 8}
              value={vmConfig.memory}
              onChange={(e) =>
                setVmConfig((prev) => ({ ...prev, memory: parseInt(e.target.value) }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Min: {vmConfig.node_type === 'control-plane' ? '16' : '8'}GB
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Disk Size (GB) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="120"
              value={vmConfig.disk_size}
              onChange={(e) =>
                setVmConfig((prev) => ({ ...prev, disk_size: parseInt(e.target.value) }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Min: 120GB</p>
          </div>
        </div>

        {/* Network and Server Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Network Switch <span className="text-red-500">*</span>
            </label>
            <select
              value={vmConfig.network_switch}
              onChange={(e) => setVmConfig((prev) => ({ ...prev, network_switch: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            >
              <option value="">Select network switch</option>
              {networkSwitches.map((sw) => (
                <option key={sw} value={sw}>
                  {sw}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Server <span className="text-red-500">*</span>
            </label>
            <select
              value={vmConfig.node_ip}
              onChange={(e) => setVmConfig((prev) => ({ ...prev, node_ip: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            >
              <option value="">Select server</option>
              {availableServers.map((server) => (
                <option key={server.ip} value={server.ip}>
                  {server.name} ({server.ip})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Domain Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Domain Name</label>
          <input
            type="text"
            value={vmConfig.domain_name}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
            placeholder={vmConfig.domain_name || 'No domain found in cluster'}
            title="Domain name is inherited from existing VMs in the cluster"
          />
          <p className="text-xs text-gray-500 mt-1">
            {vmConfig.domain_name
              ? 'Inherited from existing VMs in the cluster'
              : 'No domain found in cluster VMs'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-white bg-karios-blue border border-transparent rounded-md hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-karios-blue disabled:opacity-50"
          >
            {isSubmitting ? 'Adding VM...' : 'Add VM to Cluster'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddOpenShiftVmModal;
