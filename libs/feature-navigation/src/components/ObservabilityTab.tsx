import React from 'react';
import LoadingState from '../../../shared-state/src/widgets/LoadingState';
import ErrorMessage from '../../../shared-state/src/widgets/ErrorMessage';
import ServiceCard from './ServiceCard';
import DashboardSection from './DashboardSection';

interface ObservabilityServicesState {
  loading: boolean;
  error: string | null;
  status: { grafana: boolean; node_exporter: boolean; prometheus: boolean };
  serviceLoading: { grafana: boolean; node_exporter: boolean; prometheus: boolean };
  serviceErrors: {
    grafana: string | null;
    node_exporter: string | null;
    prometheus: string | null;
  };
  dashboardUrl: string | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
}

interface ObservabilityTabProps {
  observabilityServices: ObservabilityServicesState;
  onRetry: () => void;
  onServiceAction: (
    serviceName: 'grafana' | 'prometheus' | 'node_exporter',
    action: 'start' | 'stop'
  ) => void;
  onLaunchDashboard: () => void;
  className?: string;
}

const ObservabilityTab: React.FC<ObservabilityTabProps> = ({
  observabilityServices,
  onRetry,
  onServiceAction,
  onLaunchDashboard,
  className = '',
}) => {
  const allServicesRunning =
    observabilityServices.status.grafana === true &&
    observabilityServices.status.node_exporter === true &&
    observabilityServices.status.prometheus === true;

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Observability Services</h2>
        <p className="text-sm text-gray-600">
          Manage observability services including Grafana, Prometheus, and Node Exporter.
        </p>
      </div>

      {/* Dashboard Section */}
      <DashboardSection
        allServicesRunning={allServicesRunning}
        dashboardUrl={observabilityServices.dashboardUrl}
        dashboardLoading={observabilityServices.dashboardLoading}
        dashboardError={observabilityServices.dashboardError}
        onLaunchDashboard={onLaunchDashboard}
      />

      {/* Services Status and Controls */}
      {observabilityServices.loading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <LoadingState />
          <span className="text-gray-600">Loading services status...</span>
        </div>
      ) : observabilityServices.error ? (
        <ErrorMessage
          message={`Error loading services: ${observabilityServices.error}`}
          onRetry={onRetry}
          className="p-4"
        />
      ) : (
        <div className="space-y-4">
          {(['grafana', 'prometheus', 'node_exporter'] as const).map((serviceName) => {
            const isRunning = observabilityServices.status[serviceName];
            const isLoading = observabilityServices.serviceLoading[serviceName];
            const error = observabilityServices.serviceErrors[serviceName];

            return (
              <ServiceCard
                key={serviceName}
                serviceName={serviceName}
                isRunning={isRunning}
                isLoading={isLoading}
                error={error}
                onStart={() => onServiceAction(serviceName, 'start')}
                onStop={() => onServiceAction(serviceName, 'stop')}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ObservabilityTab;
