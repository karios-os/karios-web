import React, { useEffect, useState, useMemo } from 'react';
import { useAppState, api, createComponentLogger } from '@karios-monorepo/shared-state';
import envConfig from '../../../runtime-config';

const ServerConsole = () => {
  // Initialize logger for this component
  const logger = createComponentLogger('ServerConsole');

  // Access state from the global state
  const { state } = useAppState();
  const { selectedServer } = state;
  const [consoleUrl, setConsoleUrl] = useState<string>('');
  const [isLoadingNodeConsole, setIsLoadingNodeConsole] = useState<boolean>(false);
  const [nodeConsoleError, setNodeConsoleError] = useState<string>('');

  // Memoize only the server identity (ip/fqdn) to prevent flickering from VM list updates
  const serverIdentity = useMemo(
    () => ({
      ip: selectedServer?.ip,
      fqdn: selectedServer?.fqdn,
      id: selectedServer?.id,
    }),
    [selectedServer?.ip, selectedServer?.fqdn, selectedServer?.id]
  );

  // Helper function to construct node console URL through nginx proxy
  const constructNodeConsoleUrl = (port: number, serverIp: string): string => {
    // Use nginx proxy pattern instead of direct port access
    return `${envConfig().PROTOCOL}://${serverIp}/${port}/vnc.html?autoconnect=true&reconnect=true&reconnect_delay=2000`;
  };

  useEffect(() => {
    const fetchNodeConsole = async () => {
      const serverAddress = serverIdentity.fqdn || serverIdentity.ip;
      if (!serverAddress) {
        setConsoleUrl('');
        return;
      }

      setIsLoadingNodeConsole(true);
      setNodeConsoleError('');

      try {
        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/console/node/ensure`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Extract host and port from response
        const { host, port } = data;

        if (host && port) {
          // Construct the node console URL using the returned host and port
          const nodeConsoleUrl = constructNodeConsoleUrl(port, serverAddress);
          setConsoleUrl(nodeConsoleUrl);
          logger.info('Node console URL established', {
            serverAddress,
            host,
            port,
          });
        } else {
          throw new Error('Invalid response: host or port missing');
        }
      } catch (error) {
        logger.error('Failed to establish node console connection', {
          serverAddress,
          error,
        });
        setNodeConsoleError(
          error instanceof Error ? error.message : 'Failed to access node console'
        );
      } finally {
        setIsLoadingNodeConsole(false);
      }
    };

    fetchNodeConsole();
  }, [serverIdentity]);

  return (
    <div className="w-full h-screen border-none mt-3" data-testid="server-console-container">
      {isLoadingNodeConsole ? (
        <div className="flex justify-center items-center h-full">
          <div className="text-center p-4 max-w-lg bg-blue-50 rounded-lg shadow-sm">
            <p className="text-blue-600">Loading node console...</p>
          </div>
        </div>
      ) : nodeConsoleError ? (
        <div className="flex justify-center items-center h-full">
          <div className="text-center p-4 max-w-lg bg-red-50 rounded-lg shadow-sm">
            <p className="text-red-600">{nodeConsoleError}</p>
          </div>
        </div>
      ) : consoleUrl && serverIdentity.ip ? (
        <iframe
          src={consoleUrl}
          title={`Server Console - ${selectedServer?.name || selectedServer?.fqdn || selectedServer?.ip}`}
          className="w-full h-full border-none"
          allowFullScreen
          allow="fullscreen; clipboard-read; clipboard-write; camera; microphone"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation"
        />
      ) : (
        <div className="flex justify-center items-center h-full">
          <div className="text-center p-4 max-w-lg bg-yellow-50 rounded-lg shadow-sm">
            <p className="text-yellow-600">No server selected for console access.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerConsole;
