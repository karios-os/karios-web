import React, { useState, useEffect, useCallback } from 'react';
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
import { useAppState } from '@karios-monorepo/shared-state';
import { Pagination } from '@karios-monorepo/shared-state';
import { fetchApprovals, approveEvent, rejectEvent } from '@karios-monorepo/shared-state';

// Temporary ActivityLog interface until export is fixed
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

interface ApprovalsComponentProps {
  host: string;
}

export default function ApprovalsComponent({ host }: ApprovalsComponentProps) {
  const { state, dispatch } = useAppState();
  const [pageInput, setPageInput] = useState<string>('');

  // Get approvals state from shared state
  const { events, loading, error, processingEventId, pagination } = state.approvals;
  const { page, totalPages, totalCount } = pagination;

  // Fetch events using shared-state API service
  const fetchEventsData = useCallback(
    (pageNum: number = 1) => {
      fetchApprovals(dispatch, host, { page: pageNum, limit: 10 });
    },
    [dispatch, host]
  );

  // Fetch events on component mount
  useEffect(() => {
    fetchEventsData(1);
  }, [fetchEventsData]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchEventsData(newPage);
    }
  };

  // Handle page input change
  const handlePageInputChange = (value: string) => {
    setPageInput(value);
  };

  // Handle page input submit
  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum);
    }
    setPageInput('');
  };

  // Handle page input key press
  const handlePageInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
    }
  };

  // Handle approve event using shared-state API service
  const handleApproveEvent = (eventId: number) => {
    approveEvent(dispatch, host, eventId);
  };

  // Handle reject event using shared-state API service
  const handleRejectEvent = (eventId: number) => {
    rejectEvent(dispatch, host, eventId);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const formatted = date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      // Check if the date is invalid
      if (formatted === 'Invalid Date') {
        return timestamp;
      }
      return formatted;
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
            <h1 className="text-2xl font-bold text-gray-800">Approvals</h1>
          </div>
          <button
            onClick={() => fetchEventsData(page)}
            className="px-4 py-2 bg-karios-blue text-white rounded hover:bg-blue-600 transition-colors"
          >
            Refresh
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">Review and approve/reject pending requests.</p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-karios-blue"></div>
          <span className="ml-2 text-gray-600">Loading approval requests...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <FaExclamationTriangle className="text-red-500 mr-2" />
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Approval Requests</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Events list */}
      {!loading && events.length > 0 && (
        <>
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className={`border rounded-lg p-4 transition-colors hover:bg-gray-50 ${event.status === 'SUCCESS' ? 'bg-green-50' : event.status === 'FAILURE' ? 'bg-red-50' : 'bg-yellow-50'}`}
              >
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-start space-x-3 flex-grow min-w-0">
                    <div className="flex-shrink-0 mt-1">
                      {event.status === 'SUCCESS' ? (
                        <FaCheckCircle className="text-green-500" />
                      ) : event.status === 'FAILURE' ? (
                        <FaTimesCircle className="text-red-500" />
                      ) : (
                        <FaInfoCircle className="text-orange-500" />
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center space-x-2 mb-1 flex-wrap">
                        <h3 className="font-medium text-gray-900 truncate">{event.activity}</h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded border flex-shrink-0 ${event.status === 'SUCCESS' ? 'bg-green-100 text-green-800 border-green-200' : event.status === 'FAILURE' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-orange-100 text-orange-800 border-orange-200'}`}
                        >
                          {event.status}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 border border-blue-200 flex-shrink-0">
                          REQUEST
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-2">
                        <div className="flex items-center">
                          <FaCalendar className="mr-1" />
                          <span className="font-medium">Requested:</span>
                          <span className="ml-1">{formatTimestamp(event.start_time)}</span>
                        </div>
                        <div className="flex items-center">
                          <FaServer className="mr-1" />
                          <span className="font-medium">User:</span>
                          <span className="ml-1">{event.username}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium">IP:</span>
                          <span className="ml-1">{event.ip}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium">VM:</span>
                          <span className="ml-1">{event.vm_name}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium">Roles:</span>
                          <span className="ml-1">{event.roles}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Show approve/reject buttons only for PENDING status events */}
                  {event.status === 'PENDING' && (
                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => handleApproveEvent(event.id)}
                        disabled={processingEventId === event.id}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingEventId === event.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <FaCheck size={12} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectEvent(event.id)}
                        disabled={processingEventId === event.id}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingEventId === event.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <FaTimes size={12} />
                        )}
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Pagination Controls */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageInput={pageInput}
            onPageInputChange={handlePageInputChange}
            onPageInputSubmit={handlePageInputSubmit}
            onPageInputKeyPress={handlePageInputKeyPress}
            onPageChange={handlePageChange}
            showPageInput={false}
            className="mt-6"
            itemsPerPage={1}
          />
        </>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && !error && (
        <div className="text-center py-12">
          <FaBell className="text-4xl text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Requests</h3>
          <p className="text-gray-600">There are no approval requests at this time.</p>
        </div>
      )}
    </div>
  );
}
