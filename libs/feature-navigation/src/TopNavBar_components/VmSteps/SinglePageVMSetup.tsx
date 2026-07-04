import React from 'react';
import { CiServer, CiMicrochip } from 'react-icons/ci';
import { FaDatabase, FaNetworkWired } from 'react-icons/fa';
import { NodeLimits, StoragePool, Server, DataCenter } from './vm-types';
import { DnsZoneDropdown } from '../shared/DnsZoneDropdown';

interface SinglePageVMSetupProps {
  // VM Details
  vmName: string;
  handleVmNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  nameError: string;
  loader: string;
  setLoader: (value: string) => void;
  setUefiVars: (value: string) => void;
  osType: string;
  setOsType: (value: string) => void;
  selectedServerIp: string;
  setSelectedServerIp?: (value: string) => void;
  dataCenters?: DataCenter[];

  // Hardware
  sockets: number;
  setSockets: (value: number) => void;
  value: number;
  setValue: (value: number) => void;
  memory: number;
  setMemory: (value: number) => void;
  nodeLimits: NodeLimits;

  // Storage
  selectedPool: string;
  setSelectedPool: (value: string) => void;
  disk0Size: number | undefined;
  handleDiskSizeChange: (value: number | undefined) => void;
  pools: StoragePool[];

  // Network
  network0Type: string;
  setNetwork0Type: (value: string) => void;
  network0Switch: string;
  setNetwork0Switch: (value: string) => void;
  networkDrivers: string[];
  networkSwitches: string[];
  dnsZones: string[];
  selectedDnsZone: string;
  setSelectedDnsZone: (value: string) => void;
}

export const SinglePageVMSetup: React.FC<SinglePageVMSetupProps> = ({
  vmName,
  handleVmNameChange,
  nameError,
  loader,
  setLoader,
  setUefiVars,
  osType,
  setOsType,
  selectedServerIp,
  setSelectedServerIp,
  dataCenters,
  sockets,
  setSockets,
  value,
  setValue,
  memory,
  setMemory,
  nodeLimits,
  selectedPool,
  setSelectedPool,
  disk0Size,
  handleDiskSizeChange,
  pools,
  network0Type,
  setNetwork0Type,
  network0Switch,
  setNetwork0Switch,
  networkDrivers,
  networkSwitches,
  dnsZones,
  selectedDnsZone,
  setSelectedDnsZone,
}) => {
  // Local state for disk input to allow empty field
  const [diskInput, setDiskInput] = React.useState<string>(disk0Size?.toString() || '');

  // Sync local state when prop changes
  React.useEffect(() => {
    setDiskInput(disk0Size?.toString() || '');
  }, [disk0Size]);

  const handleDiskInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDiskInput(val);

    if (val === '') {
      handleDiskSizeChange(undefined);
    } else {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) {
        handleDiskSizeChange(parsed);
      }
    }
  };

  const handleDiskBlur = () => {
    const parsed = parseInt(diskInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      // Reset to minimum valid value on blur if invalid
      setDiskInput('20');
      handleDiskSizeChange(20);
    }
  };

  return (
    <div className="w-full bg-gray-50">
      <div className="max-w-full mx-auto space-y-2">
        {/* IDENTITY Section */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <CiServer className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <h3 className="text-xs text-black-900 uppercase tracking-wider">Identity</h3>
          </div>

          {/* Identity Fields - Responsive Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            {/* Select Server */}
            {dataCenters && setSelectedServerIp && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-900">
                  Select Server <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedServerIp || ''}
                  onChange={(e) => setSelectedServerIp(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a server</option>
                  {dataCenters.flatMap((dc) =>
                    (dc.servers || []).map((server) => (
                      <option key={server.fqdn || server.ip} value={server.fqdn || server.ip}>
                        {server.name || server.fqdn || server.ip}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* VM Name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-900">
                VM Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={vmName}
                onChange={handleVmNameChange}
                placeholder="Enter VM name"
                className={`w-full px-2 py-1.5 bg-white border rounded text-xs placeholder-gray-400 focus:outline-none focus:border-blue-500 ${
                  nameError ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {nameError && <p className="text-xs text-red-500">{nameError}</p>}
            </div>

            {/* Operating System */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-900">
                Operating System <span className="text-red-500">*</span>
              </label>
              <select
                value={osType}
                onChange={(e) => setOsType(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="">Select OS</option>
                <option value="other">Linux, BSD or Solaris</option>
                <option value="windows">Windows</option>
              </select>
            </div>

            {/* Loader */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-900">
                Loader <span className="text-red-500">*</span>
              </label>
              <select
                value={loader}
                onChange={(e) => setLoader(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="uefi">UEFI</option>
              </select>
            </div>
          </div>
        </div>

        {/* COMPUTE Section */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <CiMicrochip className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <h3 className="text-xs text-black-900 uppercase tracking-wider">Compute</h3>
          </div>

          {/* Compute Fields - Responsive 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
            {/* CPU Sockets - COMMENTED OUT */}
            {/* <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-900">CPU Sockets</label>
              <input
                type="number"
                value={sockets}
                onChange={(e) => setSockets(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                className={`w-full px-2 py-1.5 bg-white border rounded text-xs focus:outline-none focus:border-blue-500 ${
                  sockets < 1 ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {sockets < 1 && (
                <p className="text-xs text-red-500">Must be at least 1.</p>
              )}
            </div> */}

            {/* Cores */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-900">Cores</label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(Math.max(0, parseInt(e.target.value) || 0))}
                min="1"
                className={`w-full px-2 py-1.5 bg-white border rounded text-xs focus:outline-none focus:border-blue-500 ${
                  value < 1 ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {value < 1 && <p className="text-xs text-red-500">Must be at least 1.</p>}
            </div>

            {/* RAM (GB) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-900">RAM (GB)</label>
              <input
                type="number"
                value={memory}
                onChange={(e) => setMemory(Math.max(0, parseInt(e.target.value) || 0))}
                min="1"
                className={`w-full px-2 py-1.5 bg-white border rounded text-xs focus:outline-none focus:border-blue-500 ${
                  memory < 1 ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {memory < 1 && <p className="text-xs text-red-500">Must be at least 1.</p>}
            </div>
          </div>
        </div>

        {/* STORAGE Section */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <FaDatabase className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <h3 className="text-xs text-black-900 uppercase tracking-wider">Storage</h3>
          </div>

          {/* Storage Fields - Responsive 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            {/* Datastore/Pool */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-900">
                Datastore (Pool) <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Datastore</option>
                {pools.map((pool: StoragePool, index: number) => (
                  <option key={index} value={pool.name || pool.NAME}>
                    {pool.name || pool.NAME} (Free: {pool.available || pool.free || pool.FREE})
                  </option>
                ))}
              </select>
            </div>

            {/* Disk Size (GB) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-900">
                Disk Size (GB) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={diskInput}
                onChange={handleDiskInputChange}
                onBlur={handleDiskBlur}
                min="1"
                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* NETWORK Section */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <FaNetworkWired className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
            <h3 className="text-xs text-black-900 uppercase tracking-wider">Network</h3>
          </div>

          {/* Network Fields - Responsive 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            {/* Network Driver */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-900">
                Network Driver <span className="text-red-500">*</span>
              </label>
              <select
                value={network0Type}
                onChange={(e) => setNetwork0Type(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Driver</option>
                {networkDrivers.map((driver) => (
                  <option key={driver} value={driver}>
                    {driver}
                  </option>
                ))}
              </select>
            </div>

            {/* Virtual Switch */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-900">
                Virtual Switch <span className="text-red-500">*</span>
              </label>
              <select
                value={network0Switch}
                onChange={(e) => setNetwork0Switch(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Switch</option>
                {networkSwitches.map((switchName) => (
                  <option key={switchName} value={switchName}>
                    {switchName}
                  </option>
                ))}
              </select>
            </div>

            {/* DNS Zone */}
            <DnsZoneDropdown
              value={selectedDnsZone}
              onChange={setSelectedDnsZone}
              required={true}
              autoFetch={true}
              helpText=""
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SinglePageVMSetup;
