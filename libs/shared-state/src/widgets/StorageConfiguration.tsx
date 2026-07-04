import React from 'react';
import { getStorageBreakdown, StorageBreakdown } from '../utils/storageCalculations';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

interface VM {
  disks: Array<{ label: string; capacityGB: number }>;
  selectedDisks?: string[];
}

interface Datastore {
  name: string;
  available?: string | number;
}

interface Node {
  ip?: string;
  id?: string;
  uuid?: string;
  system_type?: string;
  systemType?: string;
  type?: string;
  hostType?: string;
}

interface StorageConfigurationProps {
  datastores: Datastore[];
  selectedDatastore: string;
  onDatastoreChange: (datastore: string) => void;
  isLoadingDatastores: boolean;
  selectedTargetNode: string;
  availableNodes: Node[];
  selectedVMs: VM[];
  storageError: string;
}

const StorageConfiguration: React.FC<StorageConfigurationProps> = ({
  datastores,
  selectedDatastore,
  onDatastoreChange,
  isLoadingDatastores,
  selectedTargetNode,
  availableNodes,
  selectedVMs,
  storageError,
}) => {
  const breakdown = getStorageBreakdown(selectedVMs, datastores, selectedDatastore);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Storage Datastore</label>
      <select
        value={selectedDatastore || ''}
        onChange={(e) => onDatastoreChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
          storageError ? 'border-red-300 bg-red-50' : 'border-gray-300'
        }`}
        disabled={isLoadingDatastores}
      >
        <option value="">Select Storage Datastore</option>
        {datastores.map((datastore) => {
          const selectedNodeObj = availableNodes.find(
            (node) => (node.ip || node.id || node.uuid) === selectedTargetNode
          );
          // Debug log to see node structure
          const systemType =
            selectedNodeObj?.system_type ||
            selectedNodeObj?.systemType ||
            selectedNodeObj?.type ||
            selectedNodeObj?.hostType ||
            'Unknown';
          return (
            <option key={datastore.name} value={datastore.name}>
              {datastore.name} - {datastore.available || 'Available space'}
            </option>
          );
        })}
      </select>

      {/* Storage summary when valid */}
      {selectedDatastore && !storageError && selectedVMs.length > 0 && (
        <div className="space-y-2">
          {/* Storage breakdown display */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-green-600 mb-2">
              <FaCheckCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Storage allocation valid</span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="text-center">
                <div className="font-medium text-gray-900">
                  {breakdown.totalAvailable.toFixed(2)} GB
                </div>
                <div className="text-gray-600">Total Available</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-orange-700">
                  {breakdown.totalNeeded.toFixed(2)} GB
                </div>
                <div className="text-gray-600">Will be Occupied</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-green-700">
                  {breakdown.remainingAfterMigration.toFixed(2)} GB
                </div>
                <div className="text-gray-600">Remaining Free</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced storage error with breakdown */}
      {storageError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-red-600 mb-2">
            <FaExclamationCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{storageError}</span>
          </div>

          {(() => {
            const shortfall = breakdown.totalNeeded - breakdown.totalAvailable;
            return (
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-medium text-gray-900">
                    {breakdown.totalAvailable.toFixed(2)} GB
                  </div>
                  <div className="text-gray-600">Available</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-red-700">
                    {breakdown.totalNeeded.toFixed(2)} GB
                  </div>
                  <div className="text-gray-600">Required</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-red-700">-{shortfall.toFixed(2)} GB</div>
                  <div className="text-gray-600">Shortfall</div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {isLoadingDatastores && <div className="text-xs text-gray-500">Loading datastores...</div>}
      {datastores.length === 0 && selectedTargetNode && !isLoadingDatastores && (
        <div className="text-xs text-gray-500">No datastores found</div>
      )}
    </div>
  );
};

export default StorageConfiguration;
