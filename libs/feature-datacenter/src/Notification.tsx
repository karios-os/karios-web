import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaBell,
  FaCalendar,
  FaServer,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaCheck,
  FaTimes,
} from 'react-icons/fa';
import { useObservabilityActivityLogs } from '@karios-monorepo/shared-state';
import Pagination from '../../shared-state/src/widgets/Pagination';
import { createComponentLogger } from '../../shared-state/src/utils/logger';

// Types for activity log data based on the API response
interface ActivityLog {
  id: number;
  roles: string;
  username: string;
  vm_name: string;
  activity: string;
  ip: string;
  status: string;
  component_type: string;
  start_time: string;
  end_time: string;
}

interface NotificationProps {
  host: string;
  defaultComponentType?: string;
  disableFilter?: boolean;
}

export default function Notification({
  host,
  defaultComponentType,
  disableFilter = false,
}: NotificationProps) {
  // Use the shared state hook for observability activity logs
  const {
    events,
    loading,
    error,
    totalCount,
    totalPages,
    currentPage,
    filters,
    componentTypes,
    componentTypesLoading,
    componentTypesError,
    approvingEvents,
    rejectingEvents,
    fetchActivityLogs,
    fetchComponentTypes,
    approveEvent,
    rejectEvent,
    updateFilters,
    setPagination,
  } = useObservabilityActivityLogs();
  const logger = createComponentLogger('Notification');

  const [pageInput, setPageInput] = useState<string>('1');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize filters with default component type if provided
  useEffect(() => {
    if (defaultComponentType && filters.component_type === 'all' && !hasInitialized) {
      updateFilters({
        ...filters,
        component_type: defaultComponentType,
      });
      setHasInitialized(true);
    }
  }, [defaultComponentType, filters, hasInitialized]);

  // Fetch events function
  const fetchEventsData = useCallback(
    async (pageNum: number = 1) => {
      try {
        const limit = 10;
        const offset = (pageNum - 1) * limit;

        await fetchActivityLogs(host, {
          limit,
          offset,
          filters,
        });

        setPageInput(pageNum.toString());
      } catch (error) {
        logger.error('Error fetching events:', error);
      }
    },
    [host, filters]
  );

  // Fetch component types on mount
  useEffect(() => {
    fetchComponentTypes(host).catch(logger.error);
  }, [host]);

  // Fetch events when component mounts or host changes
  useEffect(() => {
    fetchEventsData(1);
  }, [host]);

  // Use ref to track previous filters and avoid infinite loops
  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    const currentFilters = filters;
    const prevFilters = prevFiltersRef.current;

    // Only fetch if filters actually changed (deep comparison)
    if (JSON.stringify(currentFilters) !== JSON.stringify(prevFilters)) {
      fetchEventsData(1);
      prevFiltersRef.current = currentFilters;
    }
  }, [filters]);

  // Handle filter changes
  const handleFilterChange = (filterType: string, value: string) => {
    updateFilters({
      ...filters,
      [filterType]: value,
    });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchEventsData(newPage);
    }
  };

  // Handle direct page input
  const handlePageInputChange = (value: string) => {
    setPageInput(value);
  };

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      fetchEventsData(pageNum);
    } else {
      // Reset input to current page if invalid
      setPageInput(currentPage.toString());
    }
  };

  const handlePageInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
    }
  };

  // Handle approve event
  const handleApproveEvent = async (eventId: number) => {
    try {
      await approveEvent(host, eventId);
      // Refresh the events list after successful approval
      fetchEventsData(currentPage);
    } catch (error) {
      logger.error('Error approving event:', error);
    }
  };

  // Handle reject event
  const handleRejectEvent = async (eventId: number) => {
    try {
      await rejectEvent(host, eventId);
      // Refresh the events list after successful rejection
      fetchEventsData(currentPage);
    } catch (error) {
      logger.error('Error rejecting event:', error);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="p-6 bg-white">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <FaBell className="text-2xl text-karios-blue mr-3" />
            <h1 className="text-2xl font-bold text-gray-800">Event Logs</h1>
          </div>
          <button
            onClick={() => fetchEventsData(currentPage)}
            className="px-4 py-2 bg-karios-blue text-white rounded hover:bg-blue-600 transition-colors"
          >
            Refresh
          </button>
        </div>
        {!disableFilter && (
          <div className="flex flex-wrap gap-4 mb-4">
            {/* Component Type Filter */}
            <div>
              <label className="text-sm text-gray-700 mr-2">Component Type:</label>
              <select
                value={filters.component_type}
                onChange={(e) => handleFilterChange('component_type', e.target.value)}
                className="border rounded px-2 py-1 text-sm"
                disabled={componentTypesLoading}
              >
                <option value="all">All</option>
                {componentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            {/* Add other filters as needed */}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-karios-blue"></div>
          <span className="ml-2 text-gray-600">Loading events...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <FaExclamationTriangle className="text-red-500 mr-2" />
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Events</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Events list */}
      {!loading && events && events.length > 0 && (
        <>
          <div className="space-y-3">
            {events.map((event: ActivityLog) => (
              <div
                key={event.id}
                className={`border rounded-lg p-4 transition-colors hover:bg-gray-50 ${
                  event.status === 'SUCCESS'
                    ? 'bg-green-50'
                    : event.status === 'FAILURE'
                      ? 'bg-red-50'
                      : event.status === 'WARN'
                        ? 'bg-orange-50'
                        : event.status === 'IN_PROGRESS'
                          ? 'bg-blue-50'
                          : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-grow">
                    <div className="flex-shrink-0 mt-1">
                      {event.status === 'SUCCESS' ? (
                        <FaCheckCircle className="text-green-500" />
                      ) : event.status === 'FAILURE' ? (
                        <FaTimesCircle className="text-red-500" />
                      ) : event.status === 'WARN' ? (
                        <FaExclamationTriangle className="text-orange-500" />
                      ) : event.status === 'IN_PROGRESS' ? (
                        <FaInfoCircle className="text-blue-500" />
                      ) : (
                        <FaInfoCircle className="text-blue-500" />
                      )}
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium text-gray-900">{event.activity}</h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded border ${
                            event.status === 'SUCCESS'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : event.status === 'FAILURE'
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : event.status === 'WARN'
                                  ? 'bg-orange-100 text-orange-800 border-orange-200'
                                  : event.status === 'IN_PROGRESS'
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : 'bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          {event.status}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 border border-blue-200">
                          {event.component_type}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-2">
                        <div className="flex items-center">
                          <FaCalendar className="mr-1" />
                          {formatTimestamp(event.start_time)}
                        </div>
                        <div className="flex items-center">
                          <FaCalendar className="mr-1" />
                          {formatTimestamp(event.end_time)}
                        </div>
                        <div className="flex items-center">
                          <FaServer className="mr-1" />
                          {event.username}
                        </div>
                        <div className="flex items-center">
                          <span className="mr-1">IP:</span>
                          {event.ip}
                        </div>
                        <div className="flex items-center">
                          <span className="mr-1">VM:</span>
                          {event.vm_name}
                        </div>
                        <div className="flex items-center">
                          <span className="mr-1">Roles:</span>
                          {event.roles}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Show approve/reject buttons only for REQUEST component type */}
                  {event.component_type === 'REQUEST' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApproveEvent(event.id)}
                        disabled={approvingEvents.has(event.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FaCheck size={12} />
                        {approvingEvents.has(event.id) ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleRejectEvent(event.id)}
                        disabled={rejectingEvents.has(event.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FaTimes size={12} />
                        {rejectingEvents.has(event.id) ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Pagination Controls */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            itemsPerPage={10}
            pageInput={pageInput}
            onPageChange={handlePageChange}
            onPageInputChange={handlePageInputChange}
            onPageInputSubmit={handlePageInputSubmit}
            onPageInputKeyPress={handlePageInputKeyPress}
          />
        </>
      )}

      {/* Empty state */}
      {!loading && (!events || events.length === 0) && !error && (
        <div className="text-center py-12">
          <FaBell className="text-4xl text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Found</h3>
          <p className="text-gray-600">There are no events matching your current filters.</p>
        </div>
      )}
    </div>
  );
}
