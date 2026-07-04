import React, { useState } from 'react';
import Card from '../../../shared-state/src/widgets/Card';
import { Hierarchy } from 'iconsax-react';

interface NetworkData {
  interface: string;
  mac: string;
  status: string;
  ip?: string;
}

interface NetworkCardProps {
  physicalNetworkData: NetworkData[];
  virtualNetworkData: NetworkData[];
}

export default function NetworkCard({ physicalNetworkData, virtualNetworkData }: NetworkCardProps) {
  const [activeTab, setActiveTab] = useState<'physical' | 'virtual'>('physical');
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null);

  const currentData = activeTab === 'physical' ? physicalNetworkData : virtualNetworkData;
  const firstInterface = currentData.length > 0 ? currentData[0].interface : null;
  const activeInterface = selectedInterface || firstInterface;
  const selectedNetworkData = currentData.find((n) => n.interface === activeInterface);

  return (
    <Card
      title="Network"
      description="Network Interfaces and configuration"
      icon={Hierarchy}
      iconColor="#A259FF"
      iconSize={24}
      className="rounded-lg bg-white w-full h-full border border-gray-200 flex flex-col overflow-hidden"
    >
      {/* Use flex-1 instead of h-full for proper flex sizing */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Tab Navigation for Physical/Virtual */}
        <div className="flex border-b border-gray-200 px-4 pt-3 flex-shrink-0">
          <button
            onClick={() => {
              setActiveTab('physical');
              setSelectedInterface(null);
            }}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'physical'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Physical Interface
          </button>
          <button
            onClick={() => {
              setActiveTab('virtual');
              setSelectedInterface(null);
            }}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'virtual'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Virtual Interface
          </button>
        </div>

        {/* Interface Badges/Tabs */}
        <div className="px-4 py-3 border-b border-gray-200 overflow-x-auto flex-shrink-0">
          <div className="flex gap-2 min-w-max">
            {currentData.length > 0 ? (
              currentData.map((network) => (
                <button
                  key={network.interface}
                  onClick={() => setSelectedInterface(network.interface)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-700 rounded-lg whitespace-nowrap text-sm font-medium transition-colors flex-shrink-0 ${
                    activeInterface === network.interface
                      ? 'border border-blue-400 bg-blue-100'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      network.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                  {network.interface}
                </button>
              ))
            ) : (
              <div className="text-gray-500 text-sm whitespace-nowrap">
                {activeTab === 'physical'
                  ? 'No physical networks found'
                  : 'No virtual networks found'}
              </div>
            )}
          </div>
        </div>

        {/* Selected Interface Details - min-h-0 prevents flex child from expanding beyond container */}
        <div className="flex-1 overflow-auto min-h-0">
          {selectedNetworkData ? (
            <div className="divide-y divide-gray-200">
              <div className="px-4 py-3 flex flex-col flex-row items-center justify-between gap-2 bg-white">
                <div className="text-xs font-semibold text-gray-500  ">Interface</div>
                <div className="text-sm font-medium text-gray-800">
                  {selectedNetworkData.interface}
                </div>
              </div>
              <div className="px-4 py-3 flex flex-col flex-row items-center justify-between gap-2 bg-gray-50">
                <div className="text-xs font-semibold text-gray-500  ">MAC</div>
                <div className="text-sm font-medium text-gray-800 break-all  text-right">
                  {selectedNetworkData.mac || 'N/A'}
                </div>
              </div>
              <div className="px-4 py-3 flex flex-col flex-row items-center justify-between gap-2 bg-white">
                <div className="text-xs font-semibold text-gray-500  ">Status</div>
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
                    selectedNetworkData.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedNetworkData.status === 'active' ? 'bg-emerald-600' : 'bg-red-600'
                    }`}
                  />
                  {selectedNetworkData.status}
                </div>
              </div>
              {selectedNetworkData.ip && (
                <div
                  className={`px-4 py-3 flex flex-col flex-row items-center justify-between gap-2 ${selectedNetworkData.ip ? 'bg-gray-50' : 'bg-white'}`}
                >
                  <div className="text-xs font-semibold text-gray-500  ">IP</div>
                  <div className="text-sm font-medium text-gray-800  text-right">
                    {selectedNetworkData.ip}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              {activeTab === 'physical'
                ? 'No physical networks found'
                : 'No virtual networks found'}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
