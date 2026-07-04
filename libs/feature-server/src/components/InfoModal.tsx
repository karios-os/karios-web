import React from 'react';
import Modal from '../../../shared-state/src/widgets/Modal';
import DataTable from '../../../shared-state/src/widgets/DataTable';
import LoadingState from '../../../shared-state/src/widgets/LoadingState';

interface NodeTopInfo {
  data?: {
    timestamp: string;
    system: {
      load_averages: {
        '1min': number;
        '5min': number;
        '15min': number;
      };
      cpu_usage: {
        user: number;
        system: number;
        interrupt: number;
        idle: number;
      };
      memory_usage: {
        active: string;
        inactive: string;
        wired: string;
        buf: string;
        free: string;
      };
    };
    processes: Array<{
      pid: number;
      user: string;
      command: string;
      cpu_percent: number;
      memory_res: string;
      threads: number;
      state: string;
    }>;
  };
  loading: boolean;
  error: string | null;
}

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  nodeTopInfo: NodeTopInfo;
}

export default function InfoModal({
  isOpen,
  onClose,
  title,
  content,
  nodeTopInfo,
}: InfoModalProps) {
  const processColumns = [
    {
      key: 'pid',
      header: 'PID',
      headerClassName: 'text-left',
      className: 'text-left',
    },
    {
      key: 'user',
      header: 'User',
      headerClassName: 'text-left',
      className: 'text-left',
    },
    {
      key: 'command',
      header: 'Command',
      headerClassName: 'text-left',
      className: 'text-left truncate max-w-[150px]',
      render: (value: string) => (
        <span title={value} className="truncate max-w-[150px] block">
          {value}
        </span>
      ),
    },
    {
      key: 'cpu_percent',
      header: 'CPU %',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (value: number) => value.toFixed(2),
    },
    {
      key: 'memory_res',
      header: 'Memory',
      headerClassName: 'text-right',
      className: 'text-right',
    },
    {
      key: 'threads',
      header: 'Threads',
      headerClassName: 'text-right',
      className: 'text-right',
    },
    {
      key: 'state',
      header: 'State',
      headerClassName: 'text-left',
      className: 'text-left',
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="700px" scrollable>
      <div className="text-gray-700 ml-4 overflow-y-auto max-h-[500px]">
        <div dangerouslySetInnerHTML={{ __html: content }}></div>

        {nodeTopInfo.data && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Node System Metrics Info</h3>

            {/* System Information */}
            <div className="mb-4">
              <h4 className="font-medium text-base mb-2">System Information</h4>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="grid grid-cols-3 gap-4">
                  {/* Load Averages Section */}
                  <div className="bg-white p-3 rounded shadow-sm">
                    <p className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">
                      Load Averages
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">1 minute:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.load_averages['1min'].toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">5 minute:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.load_averages['5min'].toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">15 minute:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.load_averages['15min'].toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CPU Usage Section */}
                  <div className="bg-white p-3 rounded shadow-sm">
                    <p className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">
                      CPU Usage
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">User:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.cpu_usage.user}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">System:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.cpu_usage.system}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Interrupt:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.cpu_usage.interrupt}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Idle:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.cpu_usage.idle}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Memory Usage Section */}
                  <div className="bg-white p-3 rounded shadow-sm">
                    <p className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">
                      Memory Usage
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Active:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.memory_usage.active}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Inactive:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.memory_usage.inactive}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Wired:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.memory_usage.wired}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Buffer:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.memory_usage.buf}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Free:</span>
                        <span className="text-xs font-medium">
                          {nodeTopInfo.data.system.memory_usage.free}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Processes */}
            <div>
              <h4 className="font-medium text-base mb-2">Top Processes</h4>
              <DataTable
                data={nodeTopInfo.data.processes}
                columns={processColumns}
                striped={true}
                hoverable={true}
                compact={true}
                bordered={false}
                showAllData={true}
                className="bg-white"
                maxHeight="400px"
              />
            </div>

            <div className="text-xs text-gray-500 mt-4">
              Last updated: {new Date(nodeTopInfo.data.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        {nodeTopInfo.loading && (
          <div className="flex justify-center items-center mt-4 py-8">
            <LoadingState message="Loading node metrics data..." />
          </div>
        )}

        {nodeTopInfo.error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 rounded">
            <p>Error loading node metrics: {nodeTopInfo.error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
