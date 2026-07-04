import React from 'react';
import { useNavigate } from 'react-router-dom';
import { VmNetworkProps } from './vm-types';
import Tooltip from '../../../../shared-state/src/widgets/Tooltip';

export default function VmNetwork({
  network0Type,
  setNetwork0Type,
  network0Switch,
  setNetwork0Switch,
  networkDrivers,
  networkSwitches,
}: Omit<VmNetworkProps, 'permissions'>): React.ReactElement {
  const navigate = useNavigate();

  return (
    <>
      <div data-testid="vm-network-container">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold mb-4" data-testid="vm-network-title">Network</h2>
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700" data-testid="vm-network-close-button">
            Close
          </button>
        </div>
        <div className="mb-4" data-testid="vm-network-driver-section">
          <div className="flex items-center gap-2 mb-2">
            <label htmlFor="networkDriver" className="block">
              Network Driver:
            </label>
            <Tooltip
              text="virtio-net: High-performance paravirtualized driver that reduces overhead and provides near-native network speed in virtual machines.
e1000: Widely compatible emulated Intel adapter with built-in support across most operating systems."
              position="right"
            />
          </div>
          <select
            id="networkDriver"
            value={network0Type}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNetwork0Type(e.target.value)}
            className="w-full p-2 border rounded-md"
            data-testid="vm-network-driver-select"
          >
            <option value="">Select Driver</option>
            {networkDrivers.map((driver: string, index: number) => (
              <option key={index} value={driver}>
                {driver}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4" data-testid="vm-network-switch-section">
          <label htmlFor="networkSwitch" className="block mb-2">
            Virtual Switch:
          </label>
          <select
            id="networkSwitch"
            value={network0Switch}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setNetwork0Switch(e.target.value)
            }
            className="w-full p-2 border rounded-md"
            data-testid="vm-network-switch-select"
          >
            <option value="">Select Switch</option>
            {networkSwitches.map((sw: string, index: number) => (
              <option key={index} value={sw}>
                {sw}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
