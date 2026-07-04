import * as React from 'react';
import { useVm } from '@karios-monorepo/shared-state';

interface GrafanaEmbedProps {
  panelUrl?: string;
}

const GrafanaEmbed: React.FC<GrafanaEmbedProps> = ({ panelUrl }) => {
  if (!panelUrl) {
    return <h1>not available</h1>;
  }
  return (
    <iframe
      src={panelUrl}
      title="Grafana Dashboard"
      width="100%"
      height="800"
      style={{ border: 0 }}
      allowFullScreen
      allow="fullscreen"
    />
  );
};

interface DashboardProps {
  panelUrl?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ panelUrl }) => {
  const { selectedVm } = useVm();
  // Optionally, you could build the panelUrl here based on selectedVm or global state
  return (
    <div className="flex flex-col items-center min-h-screen">
      <GrafanaEmbed panelUrl={panelUrl} />
    </div>
  );
};

export default Dashboard;
