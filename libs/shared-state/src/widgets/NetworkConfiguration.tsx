import React from 'react';

interface NetworkSwitch {
  name: string;
  private?: boolean;
}

interface NetworkConfigurationProps {
  networkSwitches: NetworkSwitch[];
  selectedNetworkSwitch: string;
  onNetworkSwitchChange: (switchName: string) => void;
  isLoadingNetworkSwitches: boolean;
  networkDrivers: string[];
  selectedNetworkDriver: string;
  onNetworkDriverChange: (driver: string) => void;
  isLoadingNetworkDrivers: boolean;
  selectedTargetNode: string;
}

const NetworkConfiguration: React.FC<NetworkConfigurationProps> = ({
  networkSwitches,
  selectedNetworkSwitch,
  onNetworkSwitchChange,
  isLoadingNetworkSwitches,
  networkDrivers,
  selectedNetworkDriver,
  onNetworkDriverChange,
  isLoadingNetworkDrivers,
  selectedTargetNode,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Network Switch Configuration */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Network Switch</label>
        <select
          value={selectedNetworkSwitch || ''}
          onChange={(e) => onNetworkSwitchChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          disabled={isLoadingNetworkSwitches}
        >
          <option value="">Select Network Switch</option>
          {networkSwitches.map((switch_) => (
            <option key={switch_.name} value={switch_.name}>
              {switch_.name} {switch_.private ? '(Private)' : '(Public)'}
            </option>
          ))}
        </select>
        {isLoadingNetworkSwitches && (
          <div className="text-xs text-gray-500">Loading switches...</div>
        )}
      </div>

      {/* Network Driver Configuration */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Network Driver</label>
        <select
          value={selectedNetworkDriver || ''}
          onChange={(e) => onNetworkDriverChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          disabled={isLoadingNetworkDrivers || networkDrivers.length === 0}
        >
          <option value="">Select Network Driver</option>
          {networkDrivers.map((driver) => (
            <option key={driver} value={driver}>
              {driver}
            </option>
          ))}
        </select>
        {isLoadingNetworkDrivers && <div className="text-xs text-gray-500">Loading drivers...</div>}
        {networkDrivers.length === 0 && !isLoadingNetworkDrivers && selectedTargetNode && (
          <div className="text-xs text-gray-500">No drivers found</div>
        )}
      </div>
    </div>
  );
};

export default NetworkConfiguration;
