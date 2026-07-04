import React, { useEffect, useState, useRef } from 'react';
import { TickCircle, Warning2, Clock, Export } from 'iconsax-react';
import LoadingState from '../../../shared-state/src/widgets/LoadingState';

interface JobStatusTrackerProps {
  jobId: string;
  status?: 'started' | 'building' | 'ready' | 'error' | 'completed' | 'failed';
  loading?: boolean;
  error?: string | null;
  downloadUrl?: string;
  isoFile?: string;
  onRefresh?: () => Promise<void>;
  onDownload?: () => void;
}

interface StatusConfig {
  icon: React.ComponentType<{ size: number; className: string }>;
  label: string;
  description: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  showProgress: boolean;
}

const StatusConfigurations: Record<string, StatusConfig> = {
  started: {
    icon: Clock,
    label: 'Building',
    description: 'Custom ISO is being built. This may take a few minutes...',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
    showProgress: true,
  },
  building: {
    icon: Clock,
    label: 'Building',
    description: 'Custom ISO is being built. This may take a few minutes...',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
    showProgress: true,
  },
  ready: {
    icon: TickCircle,
    label: 'Ready',
    description: 'ISO build completed successfully',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-500',
    showProgress: false,
  },
  completed: {
    icon: TickCircle,
    label: 'Completed',
    description: 'ISO is ready for download',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-500',
    showProgress: false,
  },
  error: {
    icon: Warning2,
    label: 'Failed',
    description: 'ISO build failed. Please try again.',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
    showProgress: false,
  },
  failed: {
    icon: Warning2,
    label: 'Failed',
    description: 'ISO build failed. Please try again.',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
    showProgress: false,
  },
};

const JobStatusTracker: React.FC<JobStatusTrackerProps> = ({
  jobId,
  status = 'started',
  loading = false,
  error = null,
  downloadUrl,
  isoFile,
  onRefresh,
  onDownload,
}) => {
  const [autoRefreshActive, setAutoRefreshActive] = useState(
    status === 'started' || status === 'building'
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef(status);

  // Keep status ref in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    // Normalize status to lowercase for comparison
    const normalizedStatus = (status || '').toLowerCase().trim();

    // Stop polling on terminal statuses: failed, error, ready, completed
    const isTerminalStatus =
      normalizedStatus === 'error' ||
      normalizedStatus === 'failed' ||
      normalizedStatus === 'ready' ||
      normalizedStatus === 'completed';

    if (isTerminalStatus) {
      // Clear any existing interval immediately
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setAutoRefreshActive(false);
      return undefined;
    }

    // Only poll on started or building
    const shouldPoll = normalizedStatus === 'started' || normalizedStatus === 'building';

    if (shouldPoll && onRefresh) {
      setAutoRefreshActive(true);
      // Clear any previous interval first
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        // Check current status before calling refresh - if failed, don't call
        const currentNormalizedStatus = (statusRef.current || '').toLowerCase().trim();
        const currentIsTerminal =
          currentNormalizedStatus === 'error' ||
          currentNormalizedStatus === 'failed' ||
          currentNormalizedStatus === 'ready' ||
          currentNormalizedStatus === 'completed';

        if (!currentIsTerminal) {
          console.log('Calling onRefresh from interval');
          onRefresh();
        } else {
          console.log('Status is terminal, NOT calling onRefresh');
        }
      }, 3000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setAutoRefreshActive(false);
      };
    }

    setAutoRefreshActive(false);
    return undefined;
  }, [status, onRefresh]);

  const config = StatusConfigurations[status] || StatusConfigurations.started;
  const IconComponent = config.icon;

  return (
    <div
      className={`w-full max-w-md rounded-lg border ${config.borderColor} ${config.bgColor} p-6 shadow-sm`}
    >
      {/* Header with Icon and Status */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0">
          {config.showProgress ? (
            <LoadingState size="lg" />
          ) : (
            <IconComponent size={24} className={config.iconColor} />
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{config.label}</h3>
          <p className="text-sm text-gray-600 mt-0.5">{config.description}</p>
        </div>
      </div>

      {/* Job ID */}
      <div className="mb-4 p-3 bg-white rounded border border-gray-200">
        <p className="text-xs text-gray-500 mb-1">Job ID</p>
        <p className="font-mono text-sm text-gray-900 break-all">{jobId}</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-300">
          <p className="text-sm text-red-800 break-words">{error}</p>
        </div>
      )}

      {/* ISO File Info */}
      {isoFile && (
        <div className="mb-4 p-3 bg-white rounded border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">ISO File</p>
          <p className="font-mono text-sm text-gray-900 break-all">{isoFile}</p>
        </div>
      )}

      {/* Progress Indicator for Building Status */}
      {config.showProgress && (
        <div className="mb-4">
          <div className="w-full h-2 bg-gray-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full animate-pulse"
              style={{ width: '70%' }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {autoRefreshActive ? 'Refreshing status...' : 'Initializing...'}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-6">
        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={() => onRefresh()}
            disabled={loading}
            className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        )}

        {/* Download Button */}
        {(downloadUrl || isoFile) && (status === 'ready' || status === 'completed') && (
          <button
            onClick={onDownload}
            className="flex-1 px-3 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Export size={16} />
            Download
          </button>
        )}
      </div>

      {/* Status Indicator Dot */}
      <div className="mt-4 pt-4 border-t border-gray-300 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            status === 'error'
              ? 'bg-red-500'
              : status === 'started'
                ? 'bg-blue-500'
                : 'bg-green-500'
          }`}
        />
        <p className="text-xs text-gray-600">
          {status === 'started'
            ? 'Building in progress'
            : status === 'error'
              ? 'Build failed'
              : 'Build completed'}
        </p>
      </div>
    </div>
  );
};

export default JobStatusTracker;
