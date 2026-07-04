import React, { useState, useEffect, useMemo } from 'react';
import {
  useVm,
  useAppState,
  api,
  ActionTypes,
  createComponentLogger,
} from '@karios-monorepo/shared-state';
import SuccessBadge from '../../../apps/karios-gui/src/Components/SuccessBadge';
import FailureBadge from '../../../apps/karios-gui/src/Components/FailureBadge';
import envConfig from '../../../runtime-config';
import Pagination from '../../shared-state/src/widgets/Pagination';
import { DataTable } from '@karios-monorepo/shared-state';

// TypeScript interfaces
interface ActivityLog {
  id: string | number;
  start_time: string;
  username?: string;
  vm_name?: string;
  activity: string;
  status: 'SUCCESS' | 'FAILURE' | string;
  component_type: string;
}

interface Server {
  ip: string;
  fqdn?: string;
  name: string;
}

const ActivityLogs: React.FC = () => {
  const logger = createComponentLogger('ActivityLogs');
  // Local state for server management
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);

  const canViewLogs = true;

  const { selectedVm } = useVm();
  const { state, dispatch } = useAppState();

  // Type-safe destructuring with fallbacks
  const logs: ActivityLog[] = (state as any)?.activityLogs || [];
  const loading: boolean = (state as any)?.activityLogsLoading || false;
  const error: string | null = (state as any)?.activityLogsError || null;

  const [vmName, setVmName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [componentType, setComponentType] = useState<string>('');

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');

  // Derive filter options from logs data using useMemo
  const { usernameOptions, componentTypeOptions } = useMemo(() => {
    const uniqueUsernames = Array.from(
      new Set(logs.map((log) => log.username).filter(Boolean))
    ).sort() as string[];

    const uniqueComponentTypes = Array.from(
      new Set(logs.map((log) => log.component_type).filter(Boolean))
    ).sort() as string[];

    return {
      usernameOptions: uniqueUsernames,
      componentTypeOptions: uniqueComponentTypes,
    };
  }, [logs]);

  // Initialize server from global state
  useEffect(() => {
    if ((state as any)?.selectedServer) {
      setSelectedServer((state as any).selectedServer);
    }
    // We no longer set a default server to avoid API errors
  }, [(state as any)?.selectedServer]);

  // Track first load
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Store unfiltered logs for extracting filter options
  const [allLogsForOptions, setAllLogsForOptions] = useState<ActivityLog[]>([]);

  // Derive filter options from all available logs
  const { allUsernameOptions, allComponentTypeOptions } = useMemo(() => {
    const logsToUse = allLogsForOptions.length > 0 ? allLogsForOptions : logs;

    const uniqueUsernames = Array.from(
      new Set(logsToUse.map((log) => log.username).filter(Boolean))
    ).sort() as string[];

    const uniqueComponentTypes = Array.from(
      new Set(logsToUse.map((log) => log.component_type).filter(Boolean))
    ).sort() as string[];

    return {
      allUsernameOptions: uniqueUsernames,
      allComponentTypeOptions: uniqueComponentTypes,
    };
  }, [allLogsForOptions, logs]);

  // Helper function to handle pagination
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      setPageInput(newPage.toString());
      fetchLogsWithPagination(newPage);
    }
  };

  // Handle direct page input
  const handlePageInputChange = (value: string) => {
    // Only allow numbers and empty string
    if (value === '' || /^\d+$/.test(value)) {
      const pageNum = parseInt(value, 10);
      // If it's a valid number, check if it's within range
      if (value === '' || (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages)) {
        setPageInput(value);
      }
    }
  };

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum);
    } else {
      // Reset input to current page if invalid
      setPageInput(page.toString());
    }
  };

  const handlePageInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
    }
  };

  // Handle pagination change for shared component
  const handlePaginationChange = (newPage: number) => {
    handlePageChange(newPage);
  };

  // Helper function to build activity logs URL
  const buildLogsUrl = (params: URLSearchParams): string => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    return `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/activity/logs?${params.toString()}`;
  };

  // Fetch logs with pagination
  const fetchLogsWithPagination = async (pageNum: number = 1) => {
    const currentServer = selectedServer;
    if (!currentServer) {
      logger.error('No server selected for log fetching');
      return;
    }

    const currentVmName = selectedVm?.name || vmName;
    if (!currentVmName) {
      logger.error('No VM selected for log fetching');
      return;
    }

    // Calculate offset from page
    const offset = (pageNum - 1) * limit;

    dispatch({ type: ActionTypes.FETCH_ACTIVITY_LOGS_START });

    const params = new URLSearchParams();
    if (currentVmName.trim()) params.append('vm_name', currentVmName.trim());
    if (username.trim()) params.append('username', username.trim());
    if (componentType.trim()) params.append('component_type', componentType.trim());

    params.append('offset', offset.toString());
    params.append('limit', limit.toString());

    const url = buildLogsUrl(params);

    try {
      const response = await api.fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      // Update pagination info
      if (data.count !== undefined) {
        setTotalCount(data.count);
        setTotalPages(Math.ceil(data.count / limit));
      } else {
        setTotalCount(0);
        setTotalPages(1);
      }

      // Sort logs by start_time in descending order (newest first)
      const sortedLogs = (data.logs || []).sort(
        (a: ActivityLog, b: ActivityLog) =>
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );

      dispatch({ type: ActionTypes.FETCH_ACTIVITY_LOGS_SUCCESS, payload: sortedLogs });
    } catch (err) {
      logger.error('Failed to fetch activity logs', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load logs.';
      dispatch({ type: ActionTypes.FETCH_ACTIVITY_LOGS_FAILURE, payload: errorMessage });
    }
  };

  // Fetch logs only on initial load when both server and VM are available
  useEffect(() => {
    if (!hasInitiallyLoaded && selectedServer && selectedVm?.name) {
      setVmName(selectedVm.name);
      setPage(1);
      setPageInput('1');
      // Reset filter selections when VM changes
      setUsername('');
      setComponentType('');

      // Fetch with larger limit to get filter options
      const fetchForOptions = async () => {
        const currentServer = selectedServer;
        if (!currentServer) return;

        const currentVmName = selectedVm?.name;
        if (!currentVmName) return;

        try {
          const params = new URLSearchParams();
          if (currentVmName.trim()) params.append('vm_name', currentVmName.trim());
          params.append('offset', '0');
          params.append('limit', '500'); // Large limit for all unique values

          const url = buildLogsUrl(params);

          const response = await api.fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          });

          if (response.ok) {
            const data = await response.json();
            setAllLogsForOptions(data.logs || []);
          }
        } catch (err) {
          logger.error('Failed to fetch options', err);
        }
      };

      fetchForOptions();
      fetchLogsWithPagination(1);
      setHasInitiallyLoaded(true);
    }
  }, [selectedServer, selectedVm, hasInitiallyLoaded]);

  // We don't need to fetch on mount anymore since we're now fetching
  // whenever selectedServer or selectedVm changes

  if (!canViewLogs) return null;

  // Define columns for DataTable
  const columns = [
    {
      key: 'start_time',
      header: 'Date/Time',
      className: 'font-light p-2 text-left',
      headerClassName: 'p-2 text-left text-neutral-800 font-semibold',
      render: (value: string) => {
        return (
          new Date(value).toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
          }) +
          ' - ' +
          new Date(value).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
        );
      },
    },
    {
      key: 'username',
      header: 'Username',
      className: 'font-light p-2 text-left',
      headerClassName: 'p-2 text-left text-neutral-800 font-semibold',
      render: (value: string) => value || '-',
    },
    {
      key: 'vm_name',
      header: 'VM Name',
      className: 'font-light p-2 text-left',
      headerClassName: 'p-2 text-left text-neutral-800 font-semibold',
      render: (value: string) => value || '-',
    },
    {
      key: 'activity',
      header: 'Activity',
      className: 'font-light p-2 text-left',
      headerClassName: 'p-2 text-left text-neutral-800 font-semibold',
    },
    {
      key: 'status',
      header: 'Status',
      className: 'font-light p-2 text-left',
      headerClassName: 'p-2 text-left text-neutral-800 font-semibold',
      render: (status: string) => {
        if (status === 'SUCCESS' || status === 'Success') {
          return (
            <SuccessBadge className="w-[76px] h-[32px] bg-green-50 rounded text-karios-green" />
          );
        } else if (status === 'FAILURE' || status === 'ERROR' || status === 'Error') {
          return <FailureBadge className="w-[76px] h-[32px] bg-red-50 rounded text-red-600" />;
        } else if (status === 'INFO' || status === 'Info') {
          return (
            <span className="inline-flex items-center justify-center w-[76px] h-[32px] bg-blue-50 rounded text-blue-600 text-xs font-medium">
              {status}
            </span>
          );
        } else if (
          status === 'IN_PROGRESS' ||
          status === 'IN PROGRESS' ||
          status === 'InProgress'
        ) {
          return (
            <span className="inline-flex items-center justify-center w-[100px] h-[32px] bg-orange-50 rounded text-orange-600 text-xs font-medium">
              IN_PROGRESS
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center justify-center w-[76px] h-[32px] bg-gray-50 rounded text-gray-600 text-xs font-medium">
              {status}
            </span>
          );
        }
      },
    },
    {
      key: 'component_type',
      header: 'Component',
      className: 'font-light p-2 text-left',
      headerClassName: 'p-2 text-left text-neutral-800 font-semibold',
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-black">Activity Logs</h2>

      {/* Filters and Refresh Button */}
      <div className="flex flex-wrap justify-end items-center mb-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Username Filter Dropdown */}
          <select
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="p-2 rounded border bg-white text-gray-700 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Filter by Username</option>
            {allUsernameOptions.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>

          {/* Component Type Filter Dropdown */}
          <select
            value={componentType}
            onChange={(e) => setComponentType(e.target.value)}
            className="p-2 rounded border bg-white text-gray-700 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Filter by Component Type</option>
            {allComponentTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              // Reset pagination when applying new filters
              setPage(1);
              setPageInput('1');

              // Wait for state update before fetching
              setTimeout(() => {
                const currentVmName = selectedVm?.name || vmName;
                if (currentVmName) {
                  fetchLogsWithPagination(1);
                } else {
                  logger.error('No VM selected for filter application');
                }
              }, 0);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Loading/Error */}
      {loading && <p className="text-white">Loading logs...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {/* Logs Table */}
      {!loading && logs.length > 0 && (
        <DataTable
          data={logs}
          columns={columns}
          hoverable={true}
          className="min-w-full bg-white text-sm rounded shadow overflow-hidden border-0"
          showAllData={true}
          bordered={false}
          striped={false}
          maxHeight="none"
        />
      )}

      {/* No logs */}
      {!loading && logs.length === 0 && (
        <p className="text-gray-400 text-sm">
          {!selectedServer
            ? 'No server selected. Please select a server to view logs.'
            : !selectedVm?.name
              ? 'No VM selected. Please select a VM to view logs.'
              : 'No logs found for this VM.'}
        </p>
      )}

      {/* Pagination Controls */}
      {!loading && logs.length > 0 && totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          itemsPerPage={limit}
          onPageChange={handlePaginationChange}
          showPageInput={false}
          displayMode="pages"
          className="mt-6"
        />
      )}
    </div>
  );
};

export default ActivityLogs;
