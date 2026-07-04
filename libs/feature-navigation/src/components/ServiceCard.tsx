import React from 'react';
import ErrorMessage from '../../../shared-state/src/widgets/ErrorMessage';

interface ServiceCardProps {
  serviceName: 'grafana' | 'prometheus' | 'node_exporter';
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  className?: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  serviceName,
  isRunning,
  isLoading,
  error,
  onStart,
  onStop,
  className = '',
}) => {
  const displayName = serviceName.replace('_', ' ');
  const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  return (
    <div className={`border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}
          ></div>
          <div>
            <h3 className="font-medium text-gray-900">{capitalizedName}</h3>
            <p className="text-sm text-gray-500">Status: {isRunning ? 'Running' : 'Stopped'}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isRunning ? (
            // Service is running - show Stop
            <button
              onClick={onStop}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white text-sm rounded-md font-medium transition-all duration-200 min-w-[80px]"
            >
              {isLoading ? 'Processing...' : 'Stop'}
            </button>
          ) : (
            // Service is stopped - show Start and disabled Stop
            <>
              <button
                onClick={onStart}
                disabled={isLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white text-sm rounded-md font-medium transition-all duration-200 min-w-[80px]"
              >
                {isLoading ? 'Processing...' : 'Start'}
              </button>
              <button
                onClick={onStop}
                disabled={true}
                className="px-4 py-2 bg-red-400 cursor-not-allowed text-white text-sm rounded-md font-medium transition-all duration-200 min-w-[80px] opacity-50"
              >
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2">
          <ErrorMessage message={error} className="!p-2" />
        </div>
      )}
    </div>
  );
};

export default ServiceCard;
