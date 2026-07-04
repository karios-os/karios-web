import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '@karios-monorepo/shared-state';
import { createComponentLogger } from '../../../../shared-state/src/utils/logger';
import { VmDetailsProps, Server } from './vm-types';
import envConfig from '../../../../../runtime-config';

export default function VmDetails({
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
}: Omit<VmDetailsProps, 'permissions'>): React.ReactElement {
  const logger = createComponentLogger('VmDetails');

  const navigate = useNavigate();
  const { dataCenters } = useAppState();

  // Collect all available servers from all data centers
  const allServers: Server[] =
    dataCenters && Array.isArray(dataCenters)
      ? dataCenters.flatMap((dc: any) =>
          Array.isArray(dc.servers) ? dc.servers.filter((server: any) => server && server.ip) : []
        )
      : [];

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold mb-4">VM Details</h2>
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>
        <div className="mb-4">
          <label htmlFor="serverDropdown" className="block mb-2">
            Server:
          </label>
          <select
            id="serverDropdown"
            value={selectedServerIp || ''}
            onChange={(event) => setSelectedServerIp(event.target.value)}
            className="w-full border border-gray-300 rounded px-4 py-2"
          >
            <option value="">Select Server</option>
            {/* Map through all servers and create an option for each */}
            {allServers.length > 0 ? (
              allServers.map((server: Server) => (
                <option key={server.fqdn || server.ip} value={server.fqdn || server.ip}>
                  {server.name || `Node ${server.id}`}
                </option>
              ))
            ) : (
              <>
                <option value={envConfig().CONTROL_NODE_IP.URL}>Node 1</option>
                <option value="192.168.116.114">Node 2</option>
              </>
            )}
          </select>
        </div>
        <div className="mb-4">
          <label className="block mb-2">VM Name:</label>
          <input
            type="text"
            value={vmName}
            onChange={handleVmNameChange}
            className={`w-full p-2 border ${nameError ? 'border-red-500' : 'border-gray-300'}
                rounded-md`}
          />
          {nameError && <p className="text-red-500 text-sm mt-1">{nameError}</p>}
        </div>
        <div className="mb-4">
          <label className="block mb-2">Loader:</label>
          <select
            value={loader}
            onChange={(e) => {
              setLoader(e.target.value);
              setUefiVars(e.target.value === 'uefi' ? 'yes' : 'no');
            }}
            className="w-full p-2 border rounded-md"
          >
            <option value="uefi">UEFI</option>
          </select>
        </div>
        <div className="mb-4">
          <label htmlFor="osType" className="block mb-2">
            Operating System:
          </label>
          <select
            id="osType"
            value={osType}
            onChange={(e) => setOsType(e.target.value)}
            className="w-full p-2 border rounded-md"
          >
            <option value="">Select OS</option>
            <option value="other">Linux, BSD or Solaris</option>
            <option value="windows">Windows</option>
          </select>
        </div>
      </div>
    </>
  );
}
