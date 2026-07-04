import React from 'react';
import { BsHdd, BsBoxArrowUpRight } from 'react-icons/bs';

interface StorageController {
  model: string;
  disks: Array<{
    device: string;
    model: string;
    firmware_version: string;
    size: string;
    health: 'Healthy' | 'Degraded' | 'Warning' | 'Unsupported by SMART';
  }>;
}

interface StorageTableProps {
  title: string;
  data: StorageController[];
  onModelClick?: (modelName: string, deviceName: string) => void;
}

// Health indicator component - matches NetworkCard active pill style
function HealthIndicator({
  health,
}: {
  health: 'Healthy' | 'Degraded' | 'Warning' | 'Unsupported by SMART';
}) {
  const getHealthStyles = (health: string) => {
    switch (health) {
      case 'Healthy':
        return {
          bgColor: 'bg-emerald-100',
          textColor: 'text-emerald-700',
          dotColor: 'bg-emerald-600',
        };
      case 'Warning':
        return {
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-700',
          dotColor: 'bg-orange-600',
        };
      case 'Degraded':
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          dotColor: 'bg-red-600',
        };
      case 'Unsupported by SMART':
        return {
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          dotColor: 'bg-gray-400',
        };
      default:
        return {
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          dotColor: 'bg-gray-500',
        };
    }
  };

  const styles = getHealthStyles(health);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${styles.bgColor} ${styles.textColor}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${styles.dotColor}`} />
      <span
        className={health === 'Unsupported by SMART' ? 'whitespace-pre-line leading-tight' : ''}
      >
        {health === 'Unsupported by SMART' ? 'Unsupported\nby SMART' : health}
      </span>
    </div>
  );
}

export default function StorageTable({ title, data, onModelClick }: StorageTableProps) {
  // Group disks by model name
  const groupedData = data.reduce(
    (acc, controller) => {
      const modelName = controller.model;
      if (!acc[modelName]) {
        acc[modelName] = [];
      }
      acc[modelName].push(...controller.disks);
      return acc;
    },
    {} as Record<
      string,
      Array<{
        device: string;
        model: string;
        firmware_version: string;
        size: string;
        health: 'Healthy' | 'Degraded' | 'Warning' | 'Unsupported by SMART';
      }>
    >
  );

  return (
    <div className="space-y-3">
      {Object.keys(groupedData).length > 0 ? (
        Object.entries(groupedData)
          .map(([modelName, disks]) =>
            disks.map((disk, diskIndex) => (
              <div
                key={`${modelName}-${diskIndex}`}
                className="pb-3 border-b border-gray-200 last:border-0 last:pb-0"
              >
                {diskIndex === 0 && (
                  <div className="text-sm font-semibold text-gray-800 mb-3">{modelName}</div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div
                        className={`text-sm break-words ${
                          disk.health === 'Unsupported by SMART'
                            ? 'text-gray-500 cursor-not-allowed'
                            : 'text-blue-500 hover:text-blue-700 cursor-pointer hover:underline'
                        }`}
                        onClick={() => {
                          if (disk.health !== 'Unsupported by SMART') {
                            onModelClick?.(modelName, disk.device);
                          }
                        }}
                        title={
                          disk.health === 'Unsupported by SMART'
                            ? 'SMART data not available for this device'
                            : `Click to view details for ${disk.device}`
                        }
                      >
                        {disk.device} - {disk.model}
                        <div
                          className={`text-sm ${
                            disk.health === 'Unsupported by SMART'
                              ? 'text-gray-500'
                              : 'text-blue-500'
                          }`}
                        >
                          {disk.size}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (disk.health !== 'Unsupported by SMART') {
                            onModelClick?.(modelName, disk.device);
                          }
                        }}
                        className={`p-0.5 flex-shrink-0 ${
                          disk.health === 'Unsupported by SMART'
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-blue-500 hover:text-blue-700'
                        }`}
                        title={
                          disk.health === 'Unsupported by SMART'
                            ? 'SMART data not available for this device'
                            : 'View details'
                        }
                      >
                        <BsBoxArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-shrink-0 sm:ml-2">
                    {disk.health ? (
                      <HealthIndicator health={disk.health} />
                    ) : (
                      <div className="text-gray-500 text-sm">----</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )
          .flat()
      ) : title.includes('NVMe') ? (
        <div className="text-center text-gray-500 text-sm py-4">No NVMe controllers found</div>
      ) : (
        <></>
      )}
    </div>
  );
}
