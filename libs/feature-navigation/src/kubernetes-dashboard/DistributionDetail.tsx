import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppState } from '@karios-monorepo/shared-state';
import { useSidebarAPI } from '../../../shared-state/src/hooks/useSidebarAPI';
import { Pagination } from '../../../shared-state/src/widgets';
import ExpandableTable from '../../../shared-state/src/widgets/ExpandableTable';
import DataTable from '../../../shared-state/src/widgets/DataTable';
import { FaServer, FaInfoCircle } from 'react-icons/fa';
import { FaArrowLeftLong } from 'react-icons/fa6';
import { GrUbuntu } from 'react-icons/gr';
import { SiRedhatopenshift, SiK3S, SiTalos } from 'react-icons/si';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import AnthosIcon from '../../../../public/SVG/anthosIcon';
import { FaPlus } from 'react-icons/fa';
import { AiOutlineCluster } from 'react-icons/ai';

interface ClusterInfo {
  KubernetesClusterName: string;
  zoneName?: string;
  vms?: any[];
  entities?: any[];
  bmsInfo?: any[];
}

interface VMInfo {
  vmName: string;
  vmMacAddress: string;
  vmIpAddress: string;
  fqdn: string;
  nodeIp: string;
  vmCpu: number;
  vmMemory: string;
  vmSockets: number;
}

interface ClusterDetailsData {
  // Old format with nested cluster object
  cluster?: {
    KubernetesClusterName: string;
    zoneName: string;
    vms: VMInfo[];
    entities: any[];
    bmsInfo: any[];
  };
  // Old format with clusters array
  clusters?: Array<{
    KubernetesClusterName: string;
    zoneName: string;
    vms: VMInfo[];
    entities: any[];
    bmsInfo: any[];
  }>;
  // New format: direct cluster object properties
  KubernetesClusterName?: string;
  zoneName?: string;
  vms?: VMInfo[];
  entities?: any[];
  bmsInfo?: any[];
  // Pagination fields
  limit?: number;
  offset?: number;
  total?: number;
}

// Map distribution slugs to API types
const DISTRIBUTION_MAP: Record<string, { name: string; apiType: string; iconColor: string }> = {
  'ubuntu-k8s': { name: 'Ubuntu K8s', apiType: 'ubuntu-kubernetes', iconColor: '#EA580C' },
  k3s: { name: 'K3s', apiType: 'k3s-kubernetes', iconColor: '#EAB308' },
  'omni-server': { name: 'Omni Server', apiType: 'omni server', iconColor: '#F97316' },
  openshift: { name: 'OpenShift', apiType: 'openshift-kubernetes', iconColor: '#DC2626' },
  'google-anthos': { name: 'Google Anthos', apiType: 'anthos', iconColor: '#4285F4' },
};

// Get icon component based on distribution name
const getDistributionIcon = (name: string, color: string) => {
  const iconProps = { className: 'w-8 h-8', style: { color } };

  switch (name) {
    case 'Ubuntu K8s':
      return <GrUbuntu {...iconProps} />;
    case 'OpenShift':
      return <SiRedhatopenshift {...iconProps} />;
    case 'K3s':
      return <SiK3S {...iconProps} />;
    case 'Omni Server':
      return <SiTalos {...iconProps} />;
    case 'Google Anthos':
      return <AnthosIcon {...iconProps} />;
    default:
      return <FaServer {...iconProps} />;
  }
};

export const DistributionDetail: React.FC = () => {
  const navigate = useNavigate();
  const { distributionName } = useParams<{ distributionName: string }>();
  const { state } = useAppState();
  const dataCenters = state?.dataCenters;
  const [clusterData, setClusterData] = useState<ClusterInfo[]>([]);
  const [isLoadingTable, setIsLoadingTable] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedClusterData, setExpandedClusterData] = useState<
    Record<string, ClusterDetailsData>
  >({});
  const [loadingClusterId, setLoadingClusterId] = useState<string | null>(null);
  const itemsPerPage = 10;
  const { fetchClusterData: getClusterDataApi, fetchClusterVMs } = useSidebarAPI();

  // Get distribution info from slug
  const distributionInfo = distributionName ? DISTRIBUTION_MAP[distributionName] : null;

  // Helper function to get the server object for a cluster VM (matches logic from SideBar.tsx)
  const getServerForClusterVm = (vmName: string, vmNodeIp: string) => {
    // Search through all servers in all data centers to find the server by nodeIp or vmName
    if (dataCenters) {
      for (const dc of dataCenters) {
        for (const server of dc.servers || []) {
          // Try to match by server IP or FQDN first
          if (vmNodeIp && vmNodeIp.trim() !== '') {
            if (server.ip === vmNodeIp || server.fqdn === vmNodeIp) {
              return server;
            }
          }
          // Also check if the VM exists on this server
          const vmInServer = server.vms?.find((vm: any) => vm.name === vmName);
          if (vmInServer) {
            return server;
          }
        }
      }
    }

    // If still no server found, use the first available server as fallback
    const fallbackServer = dataCenters?.[0]?.servers?.[0];
    if (fallbackServer) {
      return fallbackServer;
    }
    return null;
  };

  // Navigate to cluster details page
  const handleClusterNavigation = (clusterName: string) => {
    navigate(`/cluster/${clusterName}/details`, {
      state: {
        distributionName: distributionInfo?.name,
        distributionSlug: distributionName,
      },
    });
  };

  // Handle back to distributions view
  const handleBackToDistributions = () => {
    navigate('/kubernetes-dashboard');
  };

  // Handle create new cluster navigation
  const handleCreateNewCluster = () => {
    if (!distributionInfo) return;

    // Special case for Omni Server - use different route
    if (distributionInfo.name === 'Omni Server') {
      navigate('/omni-provision/');
      return;
    }

    // For other distributions, use /set-k8s with type query parameter
    const typeMap: Record<string, string> = {
      'Ubuntu K8s': 'ubuntu',
      K3s: 'k3s',
      OpenShift: 'openshift',
      'Google Anthos': 'anthos',
    };

    const type = typeMap[distributionInfo.name];
    if (type) {
      navigate(`/set-k8s?type=${type}`);
    }
  };

  // Function to fetch cluster data by distribution type
  const fetchClustersByType = async (apiType: string, page: number = 1) => {
    setIsLoadingTable(true);
    try {
      const offset = (page - 1) * itemsPerPage;
      const data = await getClusterDataApi({
        kubernetes_type: apiType,
        offset: offset,
        limit: itemsPerPage,
      });

      if (data && data.clusters && Array.isArray(data.clusters)) {
        setClusterData(data.clusters);
        const totalCount = data.total || 0;
        setTotalPages(Math.ceil(totalCount / itemsPerPage) || 1);
      } else {
        setClusterData([]);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching clusters by type:', error);
      setClusterData([]);
      setTotalPages(1);
    } finally {
      setIsLoadingTable(false);
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (distributionInfo && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setExpandedRowId(null); // Close any expanded row when changing pages
      fetchClustersByType(distributionInfo.apiType, page);
    }
  };

  // Handle row click to expand/collapse and fetch cluster details
  const handleRowClick = async (cluster: ClusterInfo) => {
    const clusterId = cluster.KubernetesClusterName;

    // If clicking on already expanded row, collapse it
    if (expandedRowId === clusterId) {
      setExpandedRowId(null);
      return;
    }

    // Expand the row
    setExpandedRowId(clusterId);

    // If we already have the data, don't fetch again
    if (expandedClusterData[clusterId]) {
      return;
    }

    // Fetch cluster details
    setLoadingClusterId(clusterId);
    try {
      const clusterDetails = await fetchClusterVMs(clusterId);
      setExpandedClusterData((prev) => ({
        ...prev,
        [clusterId]: clusterDetails,
      }));
    } catch (error) {
      console.error(`Error fetching details for cluster ${clusterId}:`, error);
    } finally {
      setLoadingClusterId(null);
    }
  };

  // Handle VM row click to navigate to VM hardware detail page
  const handleVmClick = (vm: VMInfo) => {
    const server = getServerForClusterVm(vm.vmName, vm.nodeIp);

    if (server) {
      // Use server.name for the URL (matches SideBar.tsx navigation logic)
      const serverName = server.name;
      const vmName = vm.vmName;

      // Navigate to VM hardware detail page
      navigate(`/server/${serverName}/vm/${vmName}/hardware`);
    } else {
      console.warn(`Could not find server for VM ${vm.vmName} with nodeIp ${vm.nodeIp}`);
    }
  };

  // Render expanded content for a cluster row
  const renderExpandedContent = (cluster: ClusterInfo) => {
    const clusterDetails = expandedClusterData[cluster.KubernetesClusterName];
    const isLoading = loadingClusterId === cluster.KubernetesClusterName;

    if (isLoading) {
      return (
        <div className="p-6 bg-gray-50">
          <div className="flex items-center justify-center gap-2">
            <AiOutlineLoading3Quarters className="animate-spin text-blue-500" size={20} />
            <span className="text-gray-600">Loading cluster details...</span>
          </div>
        </div>
      );
    }

    if (!clusterDetails) {
      return (
        <div className="p-6 bg-gray-50">
          <div className="text-center text-gray-500">No details available</div>
        </div>
      );
    }

    // Handle different API response formats
    // fetchClusterVMs now returns the cluster object directly with vms array
    let clusterData;
    if (clusterDetails.cluster) {
      // Old format: { cluster: {...} }
      clusterData = clusterDetails.cluster;
    } else if (clusterDetails.clusters && clusterDetails.clusters.length > 0) {
      // Multiple clusters format: { clusters: [{...}] }
      clusterData = clusterDetails.clusters[0];
    } else if (clusterDetails.vms) {
      // New format: direct cluster object with vms array
      clusterData = clusterDetails;
    } else {
      return (
        <div className="p-6 bg-gray-50">
          <div className="text-center text-gray-500">No details available</div>
        </div>
      );
    }

    const vms = clusterData.vms || [];
    const bmsInfo = clusterData.bmsInfo || [];

    const hasVMs = vms.length > 0;
    const hasBMS = bmsInfo.length > 0;

    if (!hasVMs && !hasBMS) {
      return (
        <div className="p-6 bg-gray-50">
          <div className="text-center text-gray-500">
            No VMs or bare metal servers found for this cluster
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 bg-blue-50 space-y-4">
        {/* VMs Table */}
        {hasVMs && (
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FaServer className="text-blue-600" />
              Virtual Machines ({vms.length})
            </h4>
            <DataTable
              data={vms}
              columns={[
                {
                  key: 'vmName',
                  header: 'VM Name',
                  render: (value: string) => (
                    <span className="font-medium text-gray-900">{value || 'N/A'}</span>
                  ),
                  className: 'text-left',
                  headerClassName: 'text-left',
                },
                {
                  key: 'fqdn',
                  header: 'FQDN',
                  render: (value: string) => (
                    <span className="text-gray-700">{value || 'N/A'}</span>
                  ),
                  className: 'text-left',
                  headerClassName: 'text-left',
                },
                {
                  key: 'vmIpAddress',
                  header: 'IP Address',
                  render: (value: string) => (
                    <span className="text-gray-700">{value || 'N/A'}</span>
                  ),
                  className: 'text-left',
                  headerClassName: 'text-left',
                },
                {
                  key: 'vmMacAddress',
                  header: 'MAC Address',
                  render: (value: string) => (
                    <span className="text-gray-700">{value || 'N/A'}</span>
                  ),
                  className: 'text-left',
                  headerClassName: 'text-left',
                },
                {
                  key: 'nodeIp',
                  header: 'Node IP',
                  render: (value: string) => (
                    <span className="text-gray-700">{value || 'N/A'}</span>
                  ),
                  className: 'text-left',
                  headerClassName: 'text-left',
                },
                {
                  key: 'vmCpu',
                  header: 'CPU',
                  render: (value: number) => <span className="text-gray-700">{value || 0}</span>,
                  className: 'text-center',
                  headerClassName: 'text-center',
                },
                {
                  key: 'vmMemory',
                  header: 'Memory',
                  render: (value: string) => (
                    <span className="text-gray-700">{value || 'N/A'}</span>
                  ),
                  className: 'text-center',
                  headerClassName: 'text-center',
                },
                {
                  key: 'vmSockets',
                  header: 'Sockets',
                  render: (value: number) => <span className="text-gray-700">{value || 0}</span>,
                  className: 'text-center',
                  headerClassName: 'text-center',
                },
              ]}
              onRowClick={(vm) => handleVmClick(vm as VMInfo)}
              hoverable
              striped={false}
              bordered={false}
              maxHeight="300px"
              className="rounded-lg shadow-sm"
              showAllData
            />
          </div>
        )}

        {/* Bare Metal Servers Table */}
        {hasBMS && (
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FaServer className="text-orange-600" />
              Bare Metal Servers ({bmsInfo.length})
            </h4>
            <DataTable
              data={bmsInfo}
              columns={[
                {
                  key: 'name',
                  header: 'Server Name',
                  render: (value: string) => (
                    <span className="font-medium text-gray-900">{value || 'N/A'}</span>
                  ),
                  className: 'text-left',
                  headerClassName: 'text-left',
                },
                {
                  key: 'ipAddress',
                  header: 'IP Address',
                  render: (value: string) => (
                    <span className="text-gray-700">{value || 'N/A'}</span>
                  ),
                  className: 'text-left',
                  headerClassName: 'text-left',
                },
                {
                  key: 'nodeIp',
                  header: 'Node IP',
                  render: (value: string) => (
                    <span className="text-gray-700">{value || 'N/A'}</span>
                  ),
                  className: 'text-left',
                  headerClassName: 'text-left',
                },
              ]}
              hoverable
              striped={false}
              bordered={false}
              maxHeight="300px"
              className="rounded-lg shadow-sm"
              showAllData
            />
          </div>
        )}
      </div>
    );
  };

  // Define columns for the ExpandableTable
  const columns = [
    {
      key: 'KubernetesClusterName',
      header: 'Cluster Name',
      render: (value: string) => <span className="font-semibold text-gray-900">{value}</span>,
    },
    {
      key: 'zoneName',
      header: 'Zone',
      render: (value: string) => <span className="text-gray-700">{value || 'N/A'}</span>,
    },
    {
      key: 'vms',
      header: 'VMs',
      render: (_: any, item: ClusterInfo) => (
        <span className="text-gray-700">{item.vms?.length || 0}</span>
      ),
    },
    {
      key: 'entities',
      header: 'Entities',
      render: (_: any, item: ClusterInfo) => (
        <span className="text-gray-700">{item.entities?.length || 0}</span>
      ),
    },
    {
      key: 'bmsInfo',
      header: 'Bare Metal',
      render: (_: any, item: ClusterInfo) => (
        <span className="text-gray-700">{item.bmsInfo?.length || 0}</span>
      ),
    },
    {
      key: 'viewCluster',
      header: 'View Cluster',
      render: (_: any, item: ClusterInfo) => (
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent row expansion when clicking the icon
            handleClusterNavigation(item.KubernetesClusterName);
          }}
          className="text-blue-600 hover:text-blue-800 transition-colors flex items-center justify-center mx-auto"
          title="View cluster details"
        >
          View details
        </button>
      ),
    },
  ];

  // Fetch clusters on mount and when distribution changes
  useEffect(() => {
    if (distributionInfo) {
      setCurrentPage(1);
      fetchClustersByType(distributionInfo.apiType, 1);
    } else {
      // Invalid distribution, redirect back
      navigate('/kubernetes-dashboard');
    }
  }, [distributionName]);

  // Auto-expand first row when cluster data loads
  useEffect(() => {
    if (clusterData.length > 0 && !expandedRowId) {
      const firstCluster = clusterData[0];
      handleRowClick(firstCluster);
    }
  }, [clusterData]);

  if (!distributionInfo) {
    return null;
  }

  return (
    <div className="h-full w-full bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          {/* Breadcrumbs */}
          <div className="mb-6 flex items-center gap-2 text-sm">
            <button
              onClick={handleBackToDistributions}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <FaArrowLeftLong size={16} />
            </button>
            <button
              onClick={handleBackToDistributions}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Distribution
            </button>
            <span className="text-gray-400">&gt;</span>
            <span className="text-gray-900 font-medium">{distributionInfo.name}</span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center">
                {getDistributionIcon(distributionInfo.name, distributionInfo.iconColor)}
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {distributionInfo.name} Clusters
              </h2>
            </div>
            <button
              onClick={handleCreateNewCluster}
              className="px-4 py-2 bg-karios-blue text-white rounded-lg hover:brightmess-100 transition-colors font-medium flex items-center gap-2"
            >
              <FaPlus className="#FFFFFF" />
              Create New
            </button>
          </div>

          {/* Clusters Count Header */}
          <div className="mt-10 mb-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <AiOutlineCluster size={24} /> Clusters ({clusterData.length})
            </h3>
          </div>

          {/* Expandable Cluster Table */}
          <ExpandableTable
            data={clusterData}
            columns={columns}
            expandedRowId={expandedRowId}
            onRowClick={handleRowClick}
            renderExpandedContent={renderExpandedContent}
            getRowId={(item) => item['KubernetesClusterName']}
            loading={isLoadingTable}
            loadingText="Loading clusters..."
            emptyText="No clusters found for this distribution"
            className="mb-6 mt-4"
            striped
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={clusterData.length * totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DistributionDetail;
