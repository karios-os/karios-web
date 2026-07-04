import React from 'react';
import Card from '../../../shared-state/src/widgets/Card';
import { InfoCircle } from 'iconsax-react';

interface SystemInformationCardProps {
  data: Record<string, string>;
}

export default function SystemInformationCard({ data }: SystemInformationCardProps) {
  const entries = Object.entries(data);

  return (
    <Card
      title="System Information"
      description="Hardware Specifications and Configurations"
      icon={InfoCircle}
      iconColor="#AD43FD"
      iconSize={24}
      className="rounded-lg bg-white w-full h-full border border-gray-200 flex flex-col overflow-hidden"
    >
      {/* Wrapper to fill available height */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Max height for 7 visible rows (7 * 48px = 336px) */}
        <div className="flex-1 overflow-auto min-h-0 max-h-[336px]">
          <div className="w-full">
            {entries.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {entries.map(([key, value], index) => (
                  <div
                    key={key}
                    className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <div className="text-sm text-gray-600 flex-shrink-0">{key}</div>
                    <div className="text-sm font-medium text-gray-800 break-words sm:text-right">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 text-gray-600 text-center">Unavailable</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
