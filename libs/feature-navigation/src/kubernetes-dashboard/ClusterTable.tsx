import React from 'react';
import DataTable from '../../../shared-state/src/widgets/DataTable';
import { Pagination } from '../../../shared-state/src/widgets';
import { FaInfoCircle } from 'react-icons/fa';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { MdViewInAr } from 'react-icons/md';

interface ClusterInfo {
  KubernetesClusterName: string;
  zoneName?: string;
  vms?: any[];
  entities?: any[];
  bmsInfo?: any[];
}

interface ClusterTableProps {
  clusters: ClusterInfo[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onRefresh?: () => void;
  onViewDetails?: (cluster: ClusterInfo) => void;
  onRowClick?: (cluster: ClusterInfo) => void;
}

export const ClusterTable: React.FC<ClusterTableProps> = ({
  clusters,
  isLoading,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onRefresh,
  onViewDetails,
  onRowClick,
}) => {
  // Define columns for the DataTable
  const columns = [
    {
      key: 'KubernetesClusterName',
      header: 'Name',
      render: (value: string) => <span className="font-semibold text-gray-900">{value}</span>,
    },
    {
      key: 'zoneName',
      header: 'Zone',
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      key: 'vms',
      header: "Total VM's",
      render: (value: any[]) => <span className="font-medium">{value?.length || 0}</span>,
    },
    {
      key: 'bmsInfo',
      header: 'Bms Servers',
      render: (value: any[]) => <span className="font-medium">{value?.length || 0}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-center',
      className: 'text-center',
      render: (_: any, item: ClusterInfo) => (
        <div className="flex items-center justify-center gap-2">
          {onViewDetails && (
            <button
              className="text-blue-600 hover:text-blue-800 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(item);
              }}
              title="View Details"
            >
              <FaInfoCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <AiOutlineLoading3Quarters className="w-8 h-8 text-gray-900 animate-spin" />
            <span className="text-gray-600">Loading clusters...</span>
          </div>
        </div>
      ) : clusters.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <MdViewInAr className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-600">No clusters found</p>
          </div>
        </div>
      ) : (
        <>
          <DataTable
            data={clusters}
            columns={columns}
            striped={false}
            hoverable={true}
            bordered={false}
            showAllData={true}
            className="border-0"
            onRowClick={onRowClick ? (item) => onRowClick(item as ClusterInfo) : undefined}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 pb-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={clusters.length}
                itemsPerPage={itemsPerPage}
                onPageChange={onPageChange}
                showPageInput={false}
                displayMode="pages"
                className=""
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClusterTable;
