import React from 'react';
import { DnsZoneDropdown } from '../shared/DnsZoneDropdown';

interface CloudInitStorageNetworkProps {
  selectedPool: string;
  setSelectedPool: (value: string) => void;
  pools: any[];
  datastore: string;
  network0Switch: string;
  setNetwork0Switch: (value: string) => void;
  networkSwitches: string[];
  dnsZones: string[];
  selectedDnsZone: string;
  setSelectedDnsZone: (value: string) => void;
}

export default function CloudInitStorageNetwork({
  selectedPool,
  setSelectedPool,
  pools,
  datastore,
  network0Switch,
  setNetwork0Switch,
  networkSwitches,
  dnsZones,
  selectedDnsZone,
  setSelectedDnsZone,
}: CloudInitStorageNetworkProps): React.ReactElement {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold mb-6">Storage & Network Configuration</h2>

      {/* Datastore Configuration */}
      <div className="bg-green-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Storage Configuration</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="datastore" className="block text-sm font-medium text-gray-700 mb-2">
              Datastore *
            </label>
            <select
              id="datastore"
              value={selectedPool}
              onChange={(e) => setSelectedPool(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
            >
              <option value="">Select Datastore</option>
              {pools.map((pool) => {
                const poolName = pool.name || pool.NAME;
                return (
                  <option key={poolName} value={poolName}>
                    {poolName}
                  </option>
                );
              })}
            </select>
            <p className="mt-1 text-sm text-gray-600">Storage pool for the VM disk</p>
          </div>
        </div>
      </div>

      {/* Network Configuration */}
      <div className="bg-purple-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Network Configuration</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="networkSwitch" className="block text-sm font-medium text-gray-700 mb-2">
              Network Switch *
            </label>
            <select
              id="networkSwitch"
              value={network0Switch}
              onChange={(e) => setNetwork0Switch(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
            >
              <option value="">Select Network Switch</option>
              {networkSwitches.map((switchName) => (
                <option key={switchName} value={switchName}>
                  {switchName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-600">Virtual network switch for VM connectivity</p>
          </div>

          <DnsZoneDropdown
            value={selectedDnsZone}
            onChange={setSelectedDnsZone}
            required={true}
            autoFetch={true}
            helpText="DNS zone for automatic domain registration"
          />
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-800">Configuration Notes</h3>
            <div className="mt-2 text-sm text-gray-700">
              <p>• Network switch provides connectivity to the VM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
