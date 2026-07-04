import React from 'react';
import DatasetItem from '../server_storage/DatasetItem';

interface DatasetsViewProps {
  poolName: string;
  datasets: any;
  selectedDatasetTypes: Record<string, string>;
  loadingDatasets: string | null;
  onDatasetTypeChange: (poolName: string, type: string | null) => void;
  onCloseDatasetsView: (poolName: string) => void;
}

export default function DatasetsView({
  poolName,
  datasets,
  selectedDatasetTypes,
  loadingDatasets,
  onDatasetTypeChange,
  onCloseDatasetsView,
}: DatasetsViewProps) {
  const poolDatasets = datasets[poolName];

  if (!poolDatasets) return null;

  return (
    <div className="mt-3 bg-white p-2 rounded relative">
      <div className="flex justify-between items-center mb-2 gap-2">
        <h4 className="text-lg font-semibold">Datasets</h4>
        <div className="flex items-center gap-2">
          <select
            value={selectedDatasetTypes[poolName] || ''}
            onChange={(e) => {
              const newType = e.target.value || null;
              onDatasetTypeChange(poolName, newType);
            }}
            className="text-lg border border-gray-100 rounded px-4 py-1"
          >
            <option value="">All Types</option>
            <option value="filesystem">Filesystem</option>
            <option value="volume">Volume</option>
            <option value="snapshot">Snapshot</option>
          </select>
          <button
            onClick={() => onCloseDatasetsView(poolName)}
            className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
            title="Close datasets view"
          >
            ×
          </button>
        </div>
      </div>

      {loadingDatasets === poolName ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading datasets...</span>
        </div>
      ) : poolDatasets && poolDatasets.length > 0 ? (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {poolDatasets.map((dataset: any, index: number) => (
            <DatasetItem
              key={index}
              dataset={dataset}
              poolName={poolName}
              selectedDatasetType={selectedDatasetTypes[poolName]}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500">
          No datasets found
          {selectedDatasetTypes[poolName] && (
            <div className="text-sm mt-1">for type: {selectedDatasetTypes[poolName]}</div>
          )}
        </div>
      )}
    </div>
  );
}
