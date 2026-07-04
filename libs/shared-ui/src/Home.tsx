import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FaExclamationTriangle,
  FaTerminal,
  FaPowerOff,
  FaMicrochip,
  FaMemory,
} from 'react-icons/fa';
import { api, useAppState, logger, useVm } from '@karios-monorepo/shared-state'; // Import the API utility
import debounce from 'lodash.debounce'; // Add lodash.debounce for debouncing
import envConfig from '../../../runtime-config'; // Import runtime config

export default function Home({ dataCenters = [] }) {
  const [selectedServerr, setSelectedServerr] = useState('All');
  const [vmDetails, setVmDetails] = useState({});
  const { state } = useAppState();
  const { selectedServer } = state;
  const { selectedVm } = useVm(); // Get selected VM to skip fetching when viewing Hardware page

  // Memoize server names to avoid recalculating
  const serverNames = useMemo(
    () => [
      'All',
      ...new Set(dataCenters.flatMap((dc) => dc.servers?.map((server) => server.name) || [])),
    ],
    [dataCenters]
  );

  // Memoize running VMs to avoid recalculating
  const runningVms = useMemo(
    () =>
      dataCenters.flatMap(
        (dc) =>
          dc.servers?.flatMap((server) =>
            server.vms
              ?.filter((vm) => vm.isOn)
              .map((vm) => ({
                serverName: server.name,
                vm,
              }))
          ) || []
      ),
    [dataCenters]
  );

  // Normalize server address to a single stable value
  const serverAddress = useMemo(() => selectedServer?.fqdn || selectedServer?.ip, [selectedServer]);

  // Debounced fetch function with strict throttling to prevent excessive calls
  const debouncedFetchVmDetails = useMemo(
    () =>
      debounce(async (runningVms, selectedServerIp) => {
        if (runningVms.length === 0 || !selectedServerIp) return;

        const newVmDetails = {};

        // Fetch VMs sequentially with delays to reduce server load instead of all in parallel
        for (const { vm } of runningVms) {
          try {
            const response = await api.fetch(
              `${envConfig().PROTOCOL}://${selectedServerIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/${vm.name}`
            );
            if (!response.ok) {
              logger.warn(`Failed to fetch details for ${vm.name}: ${response.status}`);
              continue;
            }

            const data = await response.json();
            newVmDetails[vm.name] = {
              cpu: data.cpu || 'N/A',
              memory: data.memory || 'N/A',
              state: data.state || 'N/A',
              datastore: data.datastore || 'N/A',
              diskSize: data['virtual-disk']?.[0]?.['bytes-size'] || 'N/A',
              diskUsed: data['virtual-disk']?.[0]?.['bytes-used'] || 'N/A',
            };

            // Add small delay between requests to prevent overwhelming the server
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            logger.warn(`Error fetching details for ${vm.name}`, error.message);
          }
        }

        setVmDetails(newVmDetails);
      }, 1500),
    []
  ); // Increased debounce to 1.5s to prevent overlapping with Hardware component calls

  useEffect(() => {
    // Skip fetching if we're viewing a specific VM (Hardware page will handle it)
    if (selectedVm?.name) {
      return;
    }
    debouncedFetchVmDetails(runningVms, serverAddress);
    return debouncedFetchVmDetails.cancel; // Cleanup debounce on unmount
  }, [debouncedFetchVmDetails, runningVms, serverAddress, selectedVm?.name]);

  // Handle server selection change
  const handleServerChange = useCallback((e) => {
    setSelectedServerr(e.target.value);
  }, []);

  return (
    <div className="flex-1 bg-gray-100 min-h-screen p-6">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Live Virtual Machines</h1>
        <select
          value={selectedServerr}
          onChange={handleServerChange}
          className="mt-4 md:mt-0 p-2 border border-gray-400 rounded-md bg-white shadow-sm text-gray-700"
        >
          {serverNames.map((server, index) => (
            <option key={index} value={server}>
              {server}
            </option>
          ))}
        </select>
      </div>

      {/* Server List */}
      <div className="space-y-4">
        {runningVms.length > 0 ? (
          runningVms
            .filter(({ serverName }) => selectedServerr === 'All' || serverName === selectedServerr)
            .map(({ serverName, vm }) => (
              <div
                key={vm.id}
                className="bg-white shadow-md border border-gray-300 p-4 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                {/* Server Name & VM List (Left Section) */}
                <div className="w-full md:w-2/5">
                  <h2 className="text-lg font-semibold text-karios-blue">{serverName}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-gray-200 text-sm rounded-md flex items-center gap-2">
                      {vm.name}
                    </span>
                  </div>
                </div>

                {/* Resource Usage (Middle Section) */}
                <div className="w-full md:w-1/4 flex flex-col md:items-center text-gray-700 text-sm">
                  <p className="flex items-center gap-2">
                    {React.createElement(FaMicrochip as any, { size: 16 })} CPU:{' '}
                    <span className="font-medium">{vmDetails[vm.name]?.cpu}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    {React.createElement(FaMemory as any, { size: 16 })} RAM:{' '}
                    <span className="font-medium">{vmDetails[vm.name]?.memory}</span>
                  </p>
                </div>
              </div>
            ))
        ) : (
          <p className="text-center text-gray-500">No active VMs found.</p>
        )}
      </div>
    </div>
  );
}
