import React from 'react';
import { DirectNormal, Save2 } from 'iconsax-react';

interface AvailableDisksViewProps {
  availableDisks: Array<{
    name: string;
    mediasize: string;
    source?: string;
    type?: string;
  }>;
}

export default function AvailableDisksView({ availableDisks }: AvailableDisksViewProps) {
  return (
    <div className="bg-white p-4 rounded-lg" data-testid="available-disks-container">
      <h3 className="text-lg font-semibold text-black flex items-center mb-3" data-testid="available-disks-heading">
        <DirectNormal className="mr-2" color="#000000" size={20} /> Available Disks
      </h3>
      {availableDisks.length === 0 ? (
        <div className="text-gray-400 text-center py-6 text-sm">No disks available</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" data-testid="available-disks-grid">
          {availableDisks.map((disk, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded bg-white hover:bg-blue-50 transition-colors p-3"
              data-testid={`disk-card-${disk.name}`}
            >
              <div className="flex items-start gap-2 mb-2">
                <Save2 size={18} color="#2563eb" className="flex-shrink-0 mt-0.5" />
                <div className="flex-grow min-w-0">
                  <h4 className="font-semibold text-sm text-black truncate">{disk.name}</h4>
                  <p className="text-xs text-gray-600">{disk.mediasize}</p>
                </div>
              </div>
              {disk.source && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Source</p>
                  <p className="text-xs text-blue-600 font-medium truncate">{disk.source}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
