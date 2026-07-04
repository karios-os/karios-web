import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSidebarAPI } from '../../../shared-state/src/hooks/useSidebarAPI';
import { StatusCard } from '../../../shared-state/src/widgets';
import { Clock, Refresh, Cpu, Data } from 'iconsax-react';
import { FaServer } from 'react-icons/fa';
import { FaPlus } from 'react-icons/fa6';
import { AiOutlineSync } from 'react-icons/ai';
import { GrUbuntu } from 'react-icons/gr';
import { SiRedhatopenshift, SiK3S, SiTalos } from 'react-icons/si';

interface DistributionStats {
  name: string;
  prefix: string;
  nodes: number;
  cpu: number;
  memory: number;
  sockets: number;
  status: 'Healthy' | 'Provisioning' | 'Error' | 'N/A';
  version?: string;
  iconColor: string;
  iconBgColor: string;
  apiType: string; // kubernetes_type for API call
}

interface ClusterInfo {
  KubernetesClusterName: string;
  zoneName?: string;
  vms?: any[];
  entities?: any[];
  bmsInfo?: any[];
}

export const KubernetesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [totalClusters, setTotalClusters] = useState<number>(0);
  const [totalNodes, setTotalNodes] = useState<number>(0);
  const [isLoadingClusters, setIsLoadingClusters] = useState<boolean>(true);
  const [provisioningCount, setProvisioningCount] = useState<number>(0);
  const [distributions, setDistributions] = useState<DistributionStats[]>([]);
  const { fetchClusterData: getClusterDataApi } = useSidebarAPI();

  // Navigate to cluster details page
  const handleClusterNavigation = (clusterName: string) => {
    navigate(`/cluster/${clusterName}/details`);
  };

  // Navigate to K8s setup page for a distribution
  const handleManageDistribution = (distributionName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    // Special case for Omni Server - use different route
    if (distributionName === 'Omni Server') {
      navigate('/omni-provision/');
      return;
    }

    // For other distributions, use /set-k8s with type query parameter
    const typeMap: Record<string, string> = {
      'Ubuntu K8s': 'ubuntu',
      K3s: 'k3s',
      OpenShift: 'openshift',
    };

    const type = typeMap[distributionName];
    if (type) {
      navigate(`/set-k8s?type=${type}`);
    }
  };

  // Get icon component based on distribution name
  const getDistributionIcon = (name: string, color: string) => {
    const iconProps = { className: 'w-10 h-10', style: { color } };

    switch (name) {
      case 'Ubuntu K8s':
        return <GrUbuntu {...iconProps} />;
      case 'OpenShift':
        return <SiRedhatopenshift {...iconProps} />;
      case 'K3s':
        return <SiK3S {...iconProps} />;
      case 'Omni Server':
        return <SiTalos {...iconProps} />;
      default:
        return <FaServer {...iconProps} />;
    }
  };

  // Function to get provisioning jobs from localStorage
  const getProvisioningJobsCount = (): number => {
    try {
      let count = 0;
      const keys = Object.keys(localStorage);

      // Look for cluster-job-* and cluster-add-vm-job-* keys in localStorage
      keys.forEach((key) => {
        if (key.startsWith('cluster-job-') || key.startsWith('cluster-add-vm-job-')) {
          const jobData = localStorage.getItem(key);
          if (jobData) {
            try {
              const parsed = JSON.parse(jobData);
              // Count jobs that are recent (within last 24 hours)
              const timestamp = parsed.timestamp || 0;
              const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
              if (timestamp > oneDayAgo) {
                count++;
              }
            } catch (e) {
              // Invalid JSON, skip
            }
          }
        }
      });

      return count;
    } catch (error) {
      console.error('Error reading provisioning jobs from localStorage:', error);
      return 0;
    }
  };

  // Function to get provisioning jobs by prefix from localStorage
  const getProvisioningJobsByPrefix = (): Record<string, number> => {
    try {
      const countByPrefix: Record<string, number> = {
        'ub-': 0,
        'k3s-': 0,
        'om-': 0,
        'op-': 0,
      };

      const keys = Object.keys(localStorage);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      // Check for specific Omni job key (cluster-job-omni)
      const omniJobData = localStorage.getItem('cluster-job-omni');
      if (omniJobData) {
        try {
          const parsed = JSON.parse(omniJobData);
          const timestamp = parsed.timestamp || 0;
          if (timestamp > oneDayAgo) {
            countByPrefix['om-']++;
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      }

      // Look for cluster-job-* and cluster-add-vm-job-* keys in localStorage
      keys.forEach((key) => {
        if (key.startsWith('cluster-job-') || key.startsWith('cluster-add-vm-job-')) {
          const jobData = localStorage.getItem(key);
          if (jobData) {
            try {
              const parsed = JSON.parse(jobData);
              // Only count jobs that are recent (within last 24 hours)
              const timestamp = parsed.timestamp || 0;
              if (timestamp > oneDayAgo) {
                const clusterName = parsed.clusterName || '';

                // Count by prefix
                if (clusterName.startsWith('ub-')) {
                  countByPrefix['ub-']++;
                } else if (clusterName.startsWith('k3s-')) {
                  countByPrefix['k3s-']++;
                } else if (clusterName.startsWith('om-')) {
                  countByPrefix['om-']++;
                } else if (clusterName.startsWith('op-')) {
                  countByPrefix['op-']++;
                }
              }
            } catch (e) {
              // Invalid JSON, skip
            }
          }
        }
      });

      return countByPrefix;
    } catch (error) {
      return { 'ub-': 0, 'k3s-': 0, 'om-': 0, 'op-': 0 };
    }
  };

  // Handle distribution card click
  const handleDistributionClick = (dist: DistributionStats) => {
    // Navigate to distribution-specific route
    const distributionSlug = dist.name.toLowerCase().replace(/\s+/g, '-');
    navigate(`/kubernetes-dashboard/${distributionSlug}`);
  };

  useEffect(() => {
    const fetchClusters = async () => {
      setIsLoadingClusters(true);
      try {
        const data = await getClusterDataApi();
        if (data && data.clusters && Array.isArray(data.clusters)) {
          setTotalClusters(data.clusters.length);

          // Calculate total nodes (VMs) across all clusters
          let vmCount = 0;
          const vmsByPrefix: Record<string, number> = {
            'ub-': 0,
            'k3s-': 0,
            'om-': 0,
            'op-': 0,
          };

          // Track CPU, memory, and sockets by prefix
          const resourcesByPrefix: Record<
            string,
            { cpu: number; memory: number; sockets: number }
          > = {
            'ub-': { cpu: 0, memory: 0, sockets: 0 },
            'k3s-': { cpu: 0, memory: 0, sockets: 0 },
            'om-': { cpu: 0, memory: 0, sockets: 0 },
            'op-': { cpu: 0, memory: 0, sockets: 0 },
          };

          data.clusters.forEach((cluster: any) => {
            if (cluster.vms && Array.isArray(cluster.vms)) {
              vmCount += cluster.vms.length;

              // Count VMs by prefix and aggregate resources
              cluster.vms.forEach((vm: any) => {
                const vmName = vm.vmName || '';
                const cpu = vm.vmCpu || 0;
                // Parse memory from strings like "4G" or "8G" to numeric GB
                const memoryStr = vm.vmMemory || '0';
                const memory = parseInt(memoryStr.replace(/[^0-9]/g, ''), 10);
                const sockets = vm.vmSockets || 0;

                if (vmName.startsWith('ub-')) {
                  vmsByPrefix['ub-']++;
                  resourcesByPrefix['ub-'].cpu += cpu;
                  resourcesByPrefix['ub-'].memory += memory;
                  resourcesByPrefix['ub-'].sockets += sockets;
                } else if (vmName.startsWith('k3s-')) {
                  vmsByPrefix['k3s-']++;
                  resourcesByPrefix['k3s-'].cpu += cpu;
                  resourcesByPrefix['k3s-'].memory += memory;
                  resourcesByPrefix['k3s-'].sockets += sockets;
                } else if (vmName.startsWith('om-') || vmName === 'omniserver') {
                  vmsByPrefix['om-']++;
                  resourcesByPrefix['om-'].cpu += cpu;
                  resourcesByPrefix['om-'].memory += memory;
                  resourcesByPrefix['om-'].sockets += sockets;
                } else if (vmName.startsWith('op-')) {
                  vmsByPrefix['op-']++;
                  resourcesByPrefix['op-'].cpu += cpu;
                  resourcesByPrefix['op-'].memory += memory;
                  resourcesByPrefix['op-'].sockets += sockets;
                }
              });
            }
          });

          setTotalNodes(vmCount);

          // Get provisioning jobs by prefix
          const provisioningByPrefix = getProvisioningJobsByPrefix();

          // Set distribution stats - show all distributions regardless of VM count
          const distributionStats: DistributionStats[] = [
            {
              name: 'Ubuntu K8s',
              prefix: 'ub-',
              nodes: vmsByPrefix['ub-'],
              cpu: resourcesByPrefix['ub-'].cpu,
              memory: resourcesByPrefix['ub-'].memory,
              sockets: resourcesByPrefix['ub-'].sockets,
              status:
                provisioningByPrefix['ub-'] > 0
                  ? 'Provisioning'
                  : vmsByPrefix['ub-'] > 0
                    ? 'Healthy'
                    : 'N/A',
              iconColor: '#EA580C',
              iconBgColor: 'bg-orange-100',
              apiType: 'ubuntu-kubernetes',
            },
            {
              name: 'K3s',
              prefix: 'k3s-',
              nodes: vmsByPrefix['k3s-'],
              cpu: resourcesByPrefix['k3s-'].cpu,
              memory: resourcesByPrefix['k3s-'].memory,
              sockets: resourcesByPrefix['k3s-'].sockets,
              status:
                provisioningByPrefix['k3s-'] > 0
                  ? 'Provisioning'
                  : vmsByPrefix['k3s-'] > 0
                    ? 'Healthy'
                    : 'N/A',
              iconColor: '#EAB308',
              iconBgColor: 'bg-yellow-100',
              apiType: 'k3s-kubernetes',
            },
            {
              name: 'Omni Server',
              prefix: 'om-',
              nodes: vmsByPrefix['om-'],
              cpu: resourcesByPrefix['om-'].cpu,
              memory: resourcesByPrefix['om-'].memory,
              sockets: resourcesByPrefix['om-'].sockets,
              status:
                provisioningByPrefix['om-'] > 0
                  ? 'Provisioning'
                  : vmsByPrefix['om-'] > 0
                    ? 'Healthy'
                    : 'N/A',
              iconColor: '#F97316',
              iconBgColor: 'bg-orange-100',
              apiType: 'omni server',
            },
            {
              name: 'OpenShift',
              prefix: 'op-',
              nodes: vmsByPrefix['op-'],
              cpu: resourcesByPrefix['op-'].cpu,
              memory: resourcesByPrefix['op-'].memory,
              sockets: resourcesByPrefix['op-'].sockets,
              status:
                provisioningByPrefix['op-'] > 0
                  ? 'Provisioning'
                  : vmsByPrefix['op-'] > 0
                    ? 'Healthy'
                    : 'N/A',
              iconColor: '#DC2626',
              iconBgColor: 'bg-red-100',
              apiType: 'openshift-kubernetes',
            },
          ];

          setDistributions(distributionStats);
        } else {
          setTotalClusters(0);
          setTotalNodes(0);
          setDistributions([]);
        }
      } catch (error) {
        console.error('Error fetching cluster data:', error);
        setTotalClusters(0);
        setTotalNodes(0);
        setDistributions([]);
      } finally {
        setIsLoadingClusters(false);
      }
    };

    fetchClusters();

    // Get provisioning count from localStorage
    setProvisioningCount(getProvisioningJobsCount());

    // Set up interval to refresh provisioning count and cluster data every 30 seconds
    const intervalId = setInterval(() => {
      setProvisioningCount(getProvisioningJobsCount());
      fetchClusters(); // Refresh clusters to update provisioning status
    }, 30000);

    return () => clearInterval(intervalId);
  }, [getClusterDataApi]);

  return (
    <div className="h-full w-full bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Kubernetes Dashboard</h1>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatusCard
            className="border border-gray-300"
            metric={isLoadingClusters ? '...' : String(totalClusters)}
            text="Total clusters"
            detail="Active Distributions"
            metricSize="text-4xl"
            textSize="text-xl"
            metricsColor="text-gray-900"
            icon={Clock}
            iconColor="#3B82F6"
            iconSize={24}
            textBesideIcon={true}
          />

          <StatusCard
            className="border border-gray-300"
            metric={String(provisioningCount)}
            text="Provisioning"
            detail="In-progress"
            metricSize="text-4xl"
            textSize="text-xl"
            metricsColor="text-gray-900"
            icon={Refresh}
            iconColor="#10B981"
            iconSize={24}
            textBesideIcon={true}
          />

          <StatusCard
            className="border border-gray-300"
            metric={isLoadingClusters ? '...' : String(totalNodes)}
            text="Total VMs"
            detail="Across all clusters"
            metricSize="text-4xl"
            textSize="text-xl"
            metricsColor="text-gray-900"
            icon={Cpu}
            iconColor="#F97316"
            iconSize={24}
            textBesideIcon={true}
          />
        </div>

        {/* Kubernetes Distributions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">Distributions</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {distributions.map((dist, index) => {
              // Highlight card with blue border when provisioning
              const isProvisioning = dist.status === 'Provisioning';
              const borderClass = isProvisioning
                ? 'border-2 border-blue-500'
                : 'border border-gray-200';

              // Status badge colors
              const statusColors: Record<string, string> = {
                Healthy: 'bg-green-100 text-green-500 border border-green-500',
                Provisioning: 'bg-blue-100 text-blue-500 border border-blue-500',
                Error: 'bg-red-100 text-red-500 border border-red-500',
                'N/A': 'bg-gray-100 text-gray-500 border border-gray-500',
              };

              return (
                <div
                  key={index}
                  className={`bg-white rounded-lg ${borderClass} p-6 cursor-pointer hover:shadow-lg transition-shadow flex flex-col`}
                  onClick={() => handleDistributionClick(dist)}
                >
                  {/* Header with icon, title, version and status */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center`}>
                        {getDistributionIcon(dist.name, dist.iconColor)}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{dist.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-0.5 ${statusColors[dist.status]} rounded-lg text-xs font-medium`}
                          >
                            {dist.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleManageDistribution(dist.name, e)}
                      className="flex items-center p-2 gap-2 text-gray-900 rounded-lg hover:bg-gray-50 hover:text-gray-700 cursor-pointer"
                    >
                      <FaPlus className="text-xl" />
                      <span className="text-lg font-medium">Create</span>
                    </button>
                  </div>

                  {/* Statistics Row */}
                  <div className="flex items-center justify-between py-2">
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-gray-900">{dist.nodes}</div>
                      <div className="text-sm text-gray-500 mt-1">VMs</div>
                    </div>
                    <div className="w-px h-12 bg-gray-300"></div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-gray-900">
                        {String(dist.cpu).padStart(2, '0')}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">CPUs</div>
                    </div>
                    <div className="w-px h-12 bg-gray-300"></div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-gray-900">
                        {String(dist.memory).padStart(2, '0')}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">Memory (GB)</div>
                    </div>
                    <div className="w-px h-12 bg-gray-300"></div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-gray-900">
                        {String(dist.sockets).padStart(2, '0')}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">Sockets</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KubernetesDashboard;
