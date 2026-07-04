import React from 'react';
import { useNavigate } from 'react-router-dom';
import { VmHardwareProps } from './vm-types';

export default function VmHardware({
  sockets,
  setSockets,
  value,
  setValue,
  memory,
  setMemory,
  nodeLimits,
}: Omit<VmHardwareProps, 'permissions'>): React.ReactElement {
  const navigate = useNavigate();

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold mb-4">CPU & Memory</h2>
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>
        <div className="mb-4">
          <label htmlFor="sockets" className="block mb-2">
            <b>Sockets: </b>(Available: {nodeLimits.sockets})
          </label>
          <input
            id="sockets"
            type="text"
            value={sockets}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSockets(parseInt(e.target.value, 10) || 0)
            }
            className={`w-full p-2 border rounded-md ${
              sockets < 1 || sockets > nodeLimits.sockets ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={`Max ${nodeLimits.sockets}`}
          />
          {sockets < 1 && <p className="text-red-500 text-sm mt-1">Sockets must be at least 1.</p>}
          {sockets > nodeLimits.sockets && (
            <p className="text-red-500 text-sm mt-1">Must not exceed {nodeLimits.sockets}.</p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="cpus" className="block mb-2">
            <b>Cores </b>(Available: {nodeLimits.cpus})
          </label>
          <input
            id="cpus"
            type="text"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setValue(parseInt(e.target.value, 10) || 0)
            }
            className={`w-full p-2 border rounded-md ${
              value < 1 || value > nodeLimits.cpus ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={`Max ${nodeLimits.cpus}`}
          />
          {value < 1 && <p className="text-red-500 text-sm mt-1">CPU&apos;s must be at least 1.</p>}
          {value > nodeLimits.cpus && (
            <p className="text-red-500 text-sm mt-1">Must not exceed {nodeLimits.cpus}.</p>
          )}
        </div>
        <div className="mb-4">
          <label htmlFor="memory" className="block mb-2">
            <b>Memory (GB): </b>(Available: {nodeLimits.memoryGB}GB)
          </label>
          <input
            id="memory"
            type="text"
            value={memory}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setMemory(parseInt(e.target.value, 10) || 0)
            }
            className={`w-full p-2 border rounded-md ${
              memory < 1 || memory > nodeLimits.memoryGB ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={`Max ${nodeLimits.memoryGB}`}
          />
          {memory < 1 && <p className="text-red-500 text-sm mt-1">Memory must be at least 1GB.</p>}
          {memory > nodeLimits.memoryGB && (
            <p className="text-red-500 text-sm mt-1">Must not exceed {nodeLimits.memoryGB}GB.</p>
          )}
        </div>
      </div>
    </>
  );
}
