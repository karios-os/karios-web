import React, { useState } from 'react';
import Card from '../../../shared-state/src/widgets/Card';
import { BsPlus } from 'react-icons/bs';

interface AddinCard {
  slot: string;
  device: string;
}

interface AddinCardsDisplayProps {
  addinCards: AddinCard[] | null;
  loadingAddinCards: boolean;
  onNavigate?: () => void;
}

export default function AddinCardsDisplay({
  addinCards,
  onNavigate,
}: AddinCardsDisplayProps) {
  const [activeTab, setActiveTab] = useState<'available' | 'occupied'>('occupied');

  // Separate cards into available and occupied
  const getAvailableCards = () => {
    if (!addinCards || !Array.isArray(addinCards)) return {};
    return addinCards
      .filter((card) => !card.device || card.device.includes('Available'))
      .reduce((acc: Record<string, string>, card: AddinCard) => {
        acc[card.slot] = 'Available';
        return acc;
      }, {});
  };

  const getOccupiedCards = () => {
    if (!addinCards || !Array.isArray(addinCards)) return {};
    return addinCards
      .filter((card) => card.device && !card.device.includes('Available'))
      .reduce((acc: Record<string, string>, card: AddinCard) => {
        const device = card.device.replace(/'/g, '');
        acc[card.slot] = device;
        return acc;
      }, {});
  };

  const availableCount = Object.keys(getAvailableCards()).length;
  const occupiedCount = Object.keys(getOccupiedCards()).length;

  return (
    <Card
      title="Add-in Card and PCIe Devices"
      description="Expansion Slots Status"
      icon={BsPlus}
      iconColor="green"
      iconSize={24}
      className="rounded-lg bg-white w-full h-full border border-gray-200 flex flex-col overflow-hidden"
      onClick={onNavigate}
    >
      {/* Use flex-1 instead of h-full for proper flex sizing */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-4 pt-3 flex-shrink-0">
          <button
            onClick={() => setActiveTab('occupied')}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'occupied'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Occupied {occupiedCount > 0 && <span className="ml-1">({occupiedCount})</span>}
          </button>
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'available'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Available {availableCount > 0 && <span className="ml-1">({availableCount})</span>}
          </button>
        </div>

        {/* Tab Content - min-h-0 prevents flex child from expanding beyond container */}
        {/* Max height for 5 visible rows (5 * 48px = 240px) */}
        <div className="flex-1 overflow-auto min-h-0 max-h-[240px]">
          <div className="w-full">
            {activeTab === 'available' && (
              <>
                {Object.keys(getAvailableCards()).length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {Object.entries(getAvailableCards()).map(([slot, device], index) => (
                      <div
                        key={slot}
                        className={`px-4 py-3 flex flex-col  flex-row  items-center  justify-between gap-2 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <div className="text-sm text-gray-600 flex-shrink-0">{slot}</div>
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium  ml-auto">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
                          Available
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-gray-600 text-center">No available slots</p>
                )}
              </>
            )}
            {activeTab === 'occupied' && (
              <>
                {Object.keys(getOccupiedCards()).length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {Object.entries(getOccupiedCards()).map(([slot, device], index) => (
                      <div
                        key={slot}
                        className={`px-4 py-3 flex flex-col  flex-row items-center justify-between gap-2 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <div className="text-sm text-gray-600 flex-shrink-0">{slot}</div>
                        <div className="text-sm font-medium text-gray-800 break-words text-right">
                          {device}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-gray-600 text-center">No occupied slots</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
