import React from 'react';
import { FaChevronDown } from 'react-icons/fa';

interface PerformanceConfigDropdownProps {
  poolName: string;
  isOpen: boolean;
  onToggle: () => void;
  canManage: boolean;
  availableDisks: any[];
  onAddL2Arc: () => void;
  onAddSlog: () => void;
  onRemoveDevices: () => void;
}

export default function PerformanceConfigDropdown({
  poolName,
  isOpen,
  onToggle,
  canManage,
  availableDisks,
  onAddL2Arc,
  onAddSlog,
  onRemoveDevices,
}: PerformanceConfigDropdownProps) {
  if (!canManage) return null;

  return (
    <div className="relative performance-dropdown">
      <button
        className="flex items-center px-4 py-2 rounded-md border transition-colors min-w-[140px] justify-between text-gray-700 border-gray-300 bg-white hover:bg-gray-50"
        onClick={onToggle}
      >
        <span>Actions</span>
        <FaChevronDown className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[200px]">
          <div className="py-1">
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onAddL2Arc}
              disabled={availableDisks.length === 0}
              title={
                availableDisks.length === 0
                  ? 'No available disks for L2ARC'
                  : 'Add L2ARC device to improve read performance'
              }
            >
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
              Add L2ARC Device
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onAddSlog}
              disabled={availableDisks.length === 0}
              title={
                availableDisks.length === 0
                  ? 'No available disks for SLOG'
                  : 'Add SLOG device to improve write performance'
              }
            >
              <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
              Add SLOG Device
            </button>
            <hr className="my-1" />
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center text-red-600"
              onClick={onRemoveDevices}
              title="Remove devices from pool"
            >
              <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
              Remove Devices
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
