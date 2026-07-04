import React, { useEffect, useState } from 'react';
import { useServer, useAppState, createComponentLogger } from '@karios-monorepo/shared-state';
import { SearchNormal, DocumentDownload } from 'iconsax-react';
import { CiExport } from 'react-icons/ci';
import envConfig from '../../../runtime-config';
import { api, DataTable } from '@karios-monorepo/shared-state';
import Pagination from '../../shared-state/src/widgets/Pagination';

export default function SystemLogs() {
  const logger = createComponentLogger('SystemLogs');

  const { selectedServer } = useServer();
  const { logs, fetchLogs, setLogsLevel, setLogsContains } = useAppState();

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  // Sorting state
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const canViewLogs = true;

  // Initialize page from URL query parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const levelParam = urlParams.get('level');
    const containsParam = urlParams.get('contains');
    const orderParam = urlParams.get('order');

    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        setPage(pageNum);
        setPageInput(pageNum.toString());
      }
    }

    if (levelParam) {
      setLogsLevel(levelParam);
    }

    if (containsParam) {
      setLogsContains(containsParam);
    }

    if (orderParam === 'asc' || orderParam === 'desc') {
      setOrder(orderParam);
    }
  }, []);

  // Update URL when filters or page changes
  useEffect(() => {
    const urlParams = new URLSearchParams();

    if (page > 1) {
      urlParams.set('page', page.toString());
    }

    if (logs.level) {
      urlParams.set('level', logs.level);
    }

    if (logs.contains) {
      urlParams.set('contains', logs.contains);
    }

    if (order) {
      urlParams.set('order', order);
    }

    const newUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;

    window.history.replaceState({}, '', newUrl);
  }, [page, logs.level, logs.contains, order]);

  useEffect(() => {
    if (canViewLogs && (selectedServer?.fqdn || selectedServer?.ip)) {
      fetchLogsWithPagination();
    }
  }, [
    logs.level,
    logs.contains,
    page,
    limit,
    canViewLogs,
    selectedServer?.fqdn,
    selectedServer?.ip,
    order,
  ]);

  // Helper function to fetch logs with pagination
  const fetchLogsWithPagination = async () => {
    if (!selectedServer?.fqdn && !selectedServer?.ip) return;

    try {
      const result = await fetchLogs(
        selectedServer?.fqdn || selectedServer.ip,
        logs.level,
        logs.contains,
        page,
        limit,
        order
      );

      // Update total count and pages if available
      if (result) {
        if (result.totalCount !== undefined) {
          setTotalCount(result.totalCount);
        }

        if (result.totalPages !== undefined) {
          setTotalPages(result.totalPages);
        } else if (result.totalCount !== undefined) {
          // Calculate total pages if not provided by API
          const calculatedTotalPages = Math.ceil(result.totalCount / limit) || 1;
          setTotalPages(calculatedTotalPages);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch logs', error);
    }
  };

  // Export logs functionality
  const [isExporting, setIsExporting] = useState(false);

  const createCsvFile = (exportLogs: string[], filename: string): Blob => {
    // CSV headers
    const headers = ['Date', 'Time', 'Level', 'Message'];

    // Parse logs and convert to CSV format
    const csvRows = [
      headers.join(','), // Header row
      ...exportLogs.map((log) => {
        const { date, time, message } = parseLogEntry(log);
        // Escape quotes and wrap fields with commas/quotes in double quotes
        const escapeCsvField = (field: string) => {
          if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        };

        return [
          escapeCsvField(date),
          escapeCsvField(time),
          escapeCsvField(logs.level || 'info'),
          escapeCsvField(message),
        ].join(',');
      }),
    ];

    const csvContent = csvRows.join('\n');
    return new Blob([csvContent], { type: 'text/csv' });
  };

  const exportLogs = async () => {
    if (!selectedServer?.fqdn && !selectedServer?.ip) {
      logger.error('No server selected for export');
      return;
    }

    setIsExporting(true);
    try {
      let url = `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/logs`;
      const params: string[] = [];
      if (logs.level) params.push(`level=${logs.level}`);
      if (logs.contains) params.push(`contains=${logs.contains}`);
      params.push(`page=1`);
      params.push(`limit=1000`);
      if (order) params.push(`order=${order}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await api.fetch(url);
      if (!response.ok) throw new Error('Failed to fetch logs for export');
      const data = await response.json();

      const exportLogs = data.logs || [];

      if (exportLogs.length === 0) {
        setIsExporting(false);
        return;
      }

      // Create the CSV file
      const blob = createCsvFile(exportLogs, 'system_logs');

      // Create download link
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `system_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      logger.error('Log export failed', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle page navigation
  const handlePagination = (direction: 'next' | 'previous') => {
    if (direction === 'next' && page < totalPages) {
      const newPage = page + 1;
      setPage(newPage);
      setPageInput(newPage.toString());
    } else if (direction === 'previous' && page > 1) {
      const newPage = page - 1;
      setPage(newPage);
      setPageInput(newPage.toString());
    }
  };

  // Handle direct page input
  const handlePageInputChange = (value: string) => {
    setPageInput(value);
  };

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum);
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
    setPage(newPage);
    setPageInput(newPage.toString());
  };

  if (!canViewLogs) return null;

  const parseLogEntry = (log: string) => {
    const logPattern = /^(\w{3}\s+\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*)$/;
    const match = log.match(logPattern);
    if (match) {
      const date = match[1];
      const time = match[2];
      const message = match[4];
      return { date, time, message };
    }
    return { date: '', time: '', message: log };
  };

  // Prepare data for DataTable
  const tableData = logs.logs.map((log: string, index: number) => {
    const { date, time, message } = parseLogEntry(log);
    return {
      id: index,
      date,
      time,
      level: logs.level || '',
      message,
    };
  });

  // Define columns for DataTable
  const columns = [
    {
      key: 'date',
      header: 'Date',
      className: 'px-2 sm:px-3 md:px-3 text-xs text-left',
      headerClassName:
        'p-2 sm:p-3 md:p-3 text-left text-xs sm:text-sm font-semibold text-gray-800 bg-white normal-case tracking-normal',
    },
    {
      key: 'time',
      header: 'Time',
      className: 'p-2 sm:p-3 md:p-3 text-xs sm:text-sm text-left',
      headerClassName:
        'p-2 sm:p-3 md:p-3 text-left text-xs sm:text-sm font-semibold text-gray-800 bg-white normal-case tracking-normal',
    },
    {
      key: 'level',
      header: 'Level',
      className: 'p-2 sm:p-3 md:p-3 text-xs sm:text-sm text-left',
      headerClassName:
        'p-2 sm:p-3 md:p-3 text-left text-xs sm:text-sm font-semibold text-gray-800 bg-white normal-case tracking-normal',
    },
    {
      key: 'message',
      header: 'Message',
      className: 'p-2 sm:p-3 md:p-3 text-xs sm:text-sm break-words text-left',
      headerClassName:
        'p-2 sm:p-3 md:p-3 text-left text-xs sm:text-sm font-semibold text-gray-800 bg-white normal-case tracking-normal',
    },
  ];

  return (
    <div className="container p-3 sm:p-4 md:p-5 lg:p-6 bg-white rounded-lg">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-0">
        <h1 className="text-xl sm:text-2xl mb-4 lg:mb-0">Log Viewer</h1>
        {/* Filter Section and Export Button */}
        <div className="w-full lg:ml-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:justify-end mb-4 items-stretch lg:items-end gap-3 lg:gap-4">
            <div className="w-full flex flex-col lg:block">
              <label
                htmlFor="level"
                className="block text-sm sm:text-base font-medium text-gray-700 lg:hidden"
              >
                Level:
              </label>
              <select
                id="level"
                value={logs.level}
                onChange={(e) => setLogsLevel(e.target.value)}
                className="mt-1 pl-2 py-1 block w-full lg:w-[160px] border border-gray-300 rounded text-sm text-gray-700 appearance-none bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue"
                style={{
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  backgroundImage:
                    "url(\"data:image/svg+xml;charset=US-ASCII,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 5'><path fill='%23666' d='M2 0L0 2h4zm0 5L0 3h4z'/></svg>\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  backgroundSize: '12px',
                  paddingRight: '28px',
                }}
              >
                <option value="">Select Level</option>
                <option value="info">Info</option>
                <option value="error">Error</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            <div className="w-full flex flex-col lg:block">
              <label
                htmlFor="contains"
                className="block text-sm sm:text-base font-medium text-gray-700 lg:hidden"
              >
                Contains:
              </label>
              <input
                type="text"
                id="contains"
                value={logs.contains}
                onChange={(e) => setLogsContains(e.target.value)}
                className="mt-1 pl-2 py-1 block w-full lg:w-[160px] border border-gray-300 rounded text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue"
                placeholder="Search logs"
              />
            </div>
            <div className="w-full flex flex-col lg:block">
              <label
                htmlFor="order"
                className="block text-sm sm:text-base font-medium text-gray-700 lg:hidden"
              >
                Sort Order:
              </label>
              <select
                id="order"
                value={order}
                onChange={(e) => setOrder(e.target.value as 'asc' | 'desc')}
                className="mt-1 pl-2 py-1 block w-full lg:w-[160px] border border-gray-300 rounded text-sm text-gray-700 appearance-none bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue"
                style={{
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  backgroundImage:
                    "url(\"data:image/svg+xml;charset=US-ASCII,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 5'><path fill='%23666' d='M2 0L0 2h4zm0 5L0 3h4z'/></svg>\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  backgroundSize: '12px',
                  paddingRight: '28px',
                }}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div className="w-full flex flex-col justify-end lg:block">
              <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1 lg:hidden">
                Export:
              </label>
              <button
                onClick={exportLogs}
                disabled={isExporting || (!selectedServer?.fqdn && !selectedServer?.ip)}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded font-medium w-full lg:w-auto text-sm ${
                  isExporting || (!selectedServer?.fqdn && !selectedServer?.ip)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-karios-blue text-white hover:bg-blue-600'
                }`}
                title="Export logs (limit: 1000)"
              >
                <CiExport color="#FFFFFF" size={20} />
                {isExporting ? 'Exporting...' : 'Export Logs'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Table of Logs */}
      <div className="overflow-x-auto mt-3">
        {logs.loading ? (
          <div className="min-w-full bg-white text-sm">
            <div className="p-3 text-center">Loading...</div>
          </div>
        ) : (
          <DataTable
            data={tableData}
            columns={columns}
            hoverable={true}
            className="border-0 rounded-none"
            showAllData={true}
            bordered={false}
            striped={false}
            maxHeight="none"
          />
        )}
      </div>

      {/* Pagination Controls */}
      {!logs.loading && logs.logs.length > 0 && totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          itemsPerPage={limit}
          onPageChange={handlePaginationChange}
          showPageInput={false}
          displayMode="pages"
          className="mt-4"
        />
      )}
    </div>
  );
}
