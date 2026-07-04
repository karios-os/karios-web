import React from 'react';
import ErrorMessage from '../../../shared-state/src/widgets/ErrorMessage';
import LoadingState from '../../../shared-state/src/widgets/LoadingState';

interface DashboardSectionProps {
  allServicesRunning: boolean;
  dashboardUrl: string | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  onLaunchDashboard: () => void;
  className?: string;
}

const DashboardSection: React.FC<DashboardSectionProps> = ({
  allServicesRunning,
  dashboardUrl,
  dashboardLoading,
  dashboardError,
  onLaunchDashboard,
  className = '',
}) => {
  const handleCopyUrl = () => {
    if (dashboardUrl) {
      navigator.clipboard.writeText(dashboardUrl);
      // Optional: Show a brief success message
      const btn = document.activeElement as HTMLElement;
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 1000);
      }
    }
  };

  // Automatically open dashboard URL when it becomes available
  React.useEffect(() => {
    if (dashboardUrl && !dashboardLoading) {
      // Open the dashboard in a new tab/window
      window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
    }
  }, [dashboardUrl, dashboardLoading]);

  return (
    <div
      className={`mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <div
              className={`w-3 h-3 rounded-full ${allServicesRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
            ></div>
            <h3 className="text-lg font-semibold text-gray-800">
              {allServicesRunning ? 'All Services Online' : 'Services Status'}
            </h3>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            {allServicesRunning
              ? 'All observability services are running. You can launch the Grafana dashboard.'
              : 'Start all services (Grafana, Prometheus, Node Exporter) to enable dashboard launch.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onLaunchDashboard}
            disabled={!allServicesRunning || dashboardLoading}
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded shadow hover:shadow-md transition-all duration-200"
          >
            {dashboardLoading ? (
              <div className="flex items-center">
                <LoadingState size="sm" color="border-white" className="-ml-1 mr-1" />
                Loading...
              </div>
            ) : (
              ' Launch Dashboard'
            )}
          </button>
        </div>
      </div>
      {dashboardError && (
        <div className="mt-3">
          <ErrorMessage message={dashboardError} className="!p-2" />
        </div>
      )}
    </div>
  );
};

export default DashboardSection;
