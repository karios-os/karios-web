import React, { useEffect, useState } from 'react';
import { Refresh } from 'iconsax-react';
import { useVm, useAppState } from '@karios-monorepo/shared-state';
import envConfig from '../../../runtime-config';
import { fetchBhyveLogs } from '../../../apps/karios-gui/src/services/apiService';
import { Pagination, DataTable } from '@karios-monorepo/shared-state';

const DEFAULT_LIMIT = 10;

const BhyveLogs: React.FC = () => {
  // Refresh handler
  const handleRefresh = () => {
    fetchLogsWithPagination(page, limit);
  };
  const { selectedVm } = useVm();
  const { state } = useAppState();
  const [selectedServer, setSelectedServer] = useState<any>(null);

  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [page, setPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  const [totalLines, setTotalLines] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Get selected server from global state
  useEffect(() => {
    if ((state as any)?.selectedServer) {
      setSelectedServer((state as any).selectedServer);
    }
  }, [state]);

  // Fetch logs with pagination
  const fetchLogsWithPagination = async (pageNum: number = 1, lim: number = limit) => {
    setLoading(true);
    setError(null);
    setLogs([]);
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (!serverAddress || !selectedVm?.name) {
      setError('No server or VM selected');
      setLoading(false);
      return;
    }
    const offset = (pageNum - 1) * lim;
    try {
      const result = await fetchBhyveLogs(serverAddress, selectedVm.name, { limit: lim, offset });
      if (result.error) {
        setError(result.error);
        setLogs([]);
        setTotalLines(result.total_lines || 0);
        setTotalPages(1);
      } else {
        setLogs(result.log || []);
        const totalLogs = result.total_lines || 0;
        setTotalLines(totalLogs);

        // If total logs is less than 10, adjust limit to total logs
        let adjustedLimit = lim;
        if (totalLogs < DEFAULT_LIMIT) {
          adjustedLimit = totalLogs;
          setLimit(totalLogs);
        } else if (lim !== limit && lim === DEFAULT_LIMIT) {
          // Keep the adjusted limit if it was changed
          setLimit(lim);
        }

        setTotalPages(Math.max(1, Math.ceil(totalLogs / adjustedLimit)));
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      setLogs([]);
      setTotalPages(1);
    }
    setLoading(false);
  };

  // Initial fetch
  useEffect(() => {
    setPage(1);
    setPageInput('1');
    fetchLogsWithPagination(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServer?.fqdn, selectedServer?.ip, selectedVm?.name]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      setPageInput(newPage.toString());
      fetchLogsWithPagination(newPage, limit);
    }
  };

  // Handle direct page input - completely free editing
  const handlePageInputChange = (value: string) => {
    setPageInput(value);
  };

  const handlePageInputSubmit = () => {
    if (pageInput.trim() === '') {
      setPageInput(page.toString());
      return;
    }
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum);
    } else {
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

  // Handle limit change
  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? DEFAULT_LIMIT : Math.max(1, Number(e.target.value));
    setLimit(val);
    setPage(1);
    setPageInput('1');
    fetchLogsWithPagination(1, val);
  };

  // Prepare data for DataTable
  const tableData = logs.map((line, idx) => {
    // Try to extract timestamp (e.g. 'Sep 15 20:07:10: ...')
    const match = line.match(/^(\w{3} \d{1,2} \d{2}:\d{2}:\d{2}):?\s?(.*)$/);
    const timestamp = match ? match[1] : '';
    const message = match ? match[2] : line;

    return {
      id: idx,
      lineNumber: (page - 1) * limit + idx + 1,
      timestamp,
      message,
      rawLine: line,
    };
  });

  // Define columns for DataTable
  const columns = [
    {
      key: 'lineNumber',
      header: '#',
      className: 'p-3 text-gray-600 font-medium text-left',
      headerClassName: 'p-3 text-left font-bold text-gray-700 text-lg bg-gray-100',
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      className: 'p-3 text-gray-500 font-mono text-left',
      headerClassName: 'p-3 text-left font-bold text-gray-700 text-lg bg-gray-100',
    },
    {
      key: 'message',
      header: 'Log Line',
      className: 'p-3 font-mono text-gray-800 whitespace-pre-wrap break-all text-left',
      headerClassName: 'p-3 text-left font-bold text-gray-700 text-lg bg-gray-100',
    },
  ];

  return (
    <div className="p-3 sm:p-4 bg-white">
      <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">System Logs</h2>
            <p className="text-sm text-gray-500 mt-1">Total logs: {totalLines}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:border-karios-blue hover:text-karios-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh logs"
          >
            <Refresh size={16} color="currentColor" className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
        {/* Error state */}
        {error && (
          <div className="text-red-600 font-semibold bg-red-50 border border-red-200 rounded-lg p-4">
            {error}
          </div>
        )}
        {/* Loading state */}
        {loading && (
          <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
            Loading logs...
          </div>
        )}
        {/* Table style log display - 10 rows fixed, no scroll for standard viewport */}
        <div className="max-h-[600px] rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          {logs.length === 0 && !loading && !error ? (
            <div className="text-center text-gray-400 p-4">No logs found.</div>
          ) : (
            <DataTable
              data={tableData}
              columns={columns}
              hoverable={true}
              striped={true}
              className="min-w-full text-xs bg-white border-0 rounded-none flex-1 overflow-y-auto"
              showAllData={true}
              bordered={false}
              maxHeight="none"
            />
          )}
        </div>
        {/* Pagination Controls and Logs Per Page */}
        {!loading && logs.length > 0 && (
          <div className="flex flex-col gap-3 mt-3">
            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalLines}
                itemsPerPage={limit}
                pageInput={pageInput}
                onPageInputChange={handlePageInputChange}
                onPageInputSubmit={handlePageInputSubmit}
                onPageInputKeyPress={handlePageInputKeyPress}
                onPageChange={handlePaginationChange}
                showPageInput={true}
                displayMode="pages"
              />
            )}

            {/* Logs per page selector */}
            <div className="flex justify-center lg:justify-end">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium text-gray-700">Logs per page:</label>
                <select
                  value={limit}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLimit(val);
                    setPage(1);
                    setPageInput('1');
                    fetchLogsWithPagination(1, val);
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 w-32 bg-white hover:border-gray-300 focus:outline-none focus:border-karios-blue"
                >
                  {(() => {
                    const options = [];
                    if (totalLines <= 10) {
                      for (let i = 1; i <= totalLines; i++) {
                        options.push(
                          <option key={i} value={i}>
                            {i}
                          </option>
                        );
                      }
                    } else {
                      // Add increments of 10 up to totalLines or 100, then 50, 100, then 'All'
                      let step = 10;
                      for (let i = 10; i < Math.min(100, totalLines); i += step) {
                        options.push(
                          <option key={i} value={i}>
                            {i}
                          </option>
                        );
                      }
                      if (totalLines >= 100) {
                        step = Math.ceil(totalLines / 10 / 10) * 10 || 50;
                        for (let i = 100; i < totalLines; i += step) {
                          options.push(
                            <option key={i} value={i}>
                              {i}
                            </option>
                          );
                        }
                      }
                      options.push(
                        <option key={totalLines} value={totalLines}>
                          All ({totalLines})
                        </option>
                      );
                    }
                    return options;
                  })()}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BhyveLogs;
