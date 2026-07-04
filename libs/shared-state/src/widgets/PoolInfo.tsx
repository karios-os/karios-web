import React from 'react';

interface PoolInfoProps {
  poolName: string;
  poolSize: string;
  state: string;
  free: string;
  allocated: string;
  normalizeValue: (value: string) => number;
}

export default function PoolInfo({
  poolName,
  poolSize,
  state,
  free,
  allocated,
  normalizeValue,
}: PoolInfoProps) {
  const getCapacityPercentage = () => {
    if (!free || !allocated) return 0;
    const freeBytes = normalizeValue(free);
    const allocBytes = normalizeValue(allocated);
    const total = freeBytes + allocBytes;
    return total > 0 ? Math.max((allocBytes / total) * 100, 0.5) : 0;
  };

  const getCapacityColor = () => {
    const percentage = getCapacityPercentage();
    return percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h4 className="text-lg sm:text-xl font-medium">
          {poolName}
          <span className="text-xs sm:text-sm text-gray-500 ml-2">({poolSize})</span>
        </h4>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            Status:{' '}
            <span
              className={`font-medium ${state === 'ONLINE' ? 'text-green-600' : 'text-red-600'}`}
            >
              {state}
            </span>
          </span>
          <span>
            Free: {free} | Allocated: {allocated}
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${getCapacityColor()}`}
            style={{ width: `${getCapacityPercentage()}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
