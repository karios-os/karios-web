import React, { useEffect, useState } from 'react';
import { useDataCenter } from '@karios-monorepo/shared-state';
import envConfig from '../../../runtime-config';

const DCConsole = () => {
  // Access state from the global state
  const dataCenter = useDataCenter();
  const [consoleUrl, setConsoleUrl] = useState<string>(
    `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}:6080/vnc.html`
  );

  // Use selectedNode's console URL or a default property
  const vncConsoleUrl =
    dataCenter.selectedNode?.consoleUrl ||
    `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}:6080/vnc.html`;

  // Update console URL when the VNC console URL changes
  useEffect(() => {
    if (vncConsoleUrl) {
      setConsoleUrl(vncConsoleUrl);
    }
  }, [vncConsoleUrl]);

  return (
    <div className="w-full h-screen border-none mt-3" data-testid="console-container">
      {consoleUrl && (
        <iframe
          src={consoleUrl}
          title="Data Center Console"
          className="w-full h-full border-none"
          allowFullScreen
        ></iframe>
      )}
    </div>
  );
};

export default DCConsole;
