import React from 'react';
import { FaDatabase, FaPlus, FaHdd, FaEye, FaServer, FaTrash } from 'react-icons/fa';
import { Add, Eye, FolderAdd, Trash } from 'iconsax-react';
import Button from '../../../shared-state/src/widgets/Button';
import Tooltip from '../../../shared-state/src/widgets/Tooltip';
import PerformanceConfigDropdown from './PerformanceConfigDropdown';
import DatasetsView from './DatasetsView';
import CreateDataset from '../server_storage/CreateDataset';
import CreateZvol from '../server_storage/CreateZvol';

interface StoragePoolsViewProps {
  storagePools: any[];
  canManage: boolean;
  availableDisks: any[];
  zpoolStatus: Record<string, any>;
  datasets: Record<string, any>;
  selectedDatasetTypes: Record<string, string>;
  loadingDatasets: string | null;
  showingDatasets: Record<string, boolean>;
  performanceDropdownOpen: Record<string, boolean>;
  deletingPool: string | null;
  creatingDataset: string | null;
  zvolPool: string | null;
  creatingZvol: boolean;

  // Dataset creation props
  datasetName: string;
  datasetEncryption: boolean;
  datasetPassphrase: string;

  // Zvol creation props
  zvolName: string;
  zvolSize: any;

  // Device addition states
  addingL2Arc: string | null;
  selectedL2ArcDevices: string[];
  loadingL2Arc: boolean;
  addingSlog: string | null;
  selectedSlogDevices: string[];
  loadingSlog: boolean;
  slogMirrorEnabled: boolean;
  removingDevices: string | null;
  selectedRemoveDevices: string[];
  loadingRemoveDevices: boolean;

  // Event handlers
  onCreateDataset: (poolName: string) => void;
  onDeletePool: (poolName: string) => void;
  onViewDatasets: (poolName: string) => void;
  onCreateZvol: (poolName: string) => void;
  onTogglePerformanceDropdown: (poolName: string) => void;
  onAddL2Arc: (poolName: string) => void;
  onAddSlog: (poolName: string) => void;
  onRemoveDevices: (poolName: string) => void;
  onDatasetTypeChange: (poolName: string, type: string | null) => void;
  onCloseDatasetsView: (poolName: string) => void;

  // Dataset creation handlers
  onDatasetNameChange: (name: string) => void;
  onDatasetEncryptionChange: (encryption: boolean) => void;
  onDatasetPassphraseChange: (passphrase: string) => void;
  onDatasetCreate: (poolName: string) => void;
  onCancelDatasetCreation: () => void;

  // Zvol creation handlers
  onZvolNameChange: (name: string) => void;
  onZvolSizeChange: (size: any) => void;
  onZvolCreate: (name: string, size: string) => Promise<any>;
  onCancelZvolCreation: () => void;

  // Device handlers
  onL2ArcDeviceSelection: (deviceName: string, isSelected: boolean) => void;
  onSlogDeviceSelection: (deviceName: string, isSelected: boolean) => void;
  onRemoveDeviceSelection: (deviceName: string, isSelected: boolean) => void;
  onCancelL2Arc: () => void;
  onCancelSlog: () => void;
  onCancelRemoveDevices: () => void;
  onConfirmL2Arc: (poolName: string) => void;
  onConfirmSlog: (poolName: string) => void;
  onConfirmRemoveDevices: (poolName: string) => void;
  onSlogMirrorToggle: (enabled: boolean) => void;
}

export default function StoragePoolsView(props: StoragePoolsViewProps) {
  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatPoolCapacity = (size: string, alloc: string, free: string) => {
    const parseSize = (sizeStr: string) => {
      const num = parseFloat(sizeStr);
      const unit = sizeStr.slice(-1).toUpperCase();
      const multipliers: Record<string, number> = {
        K: 1024,
        M: 1024 ** 2,
        G: 1024 ** 3,
        T: 1024 ** 4,
      };
      return num * (multipliers[unit] || 1);
    };

    const sizeBytes = parseSize(size);
    const allocBytes = parseSize(alloc);
    const percentage = sizeBytes > 0 ? (allocBytes / sizeBytes) * 100 : 0;

    return { percentage: percentage.toFixed(1), allocated: alloc, total: size, free };
  };

  return (
    <div className="p-2 sm:p-4">
      <h3 className="text-lg sm:text-2xl font-semibold text-primary flex items-center mb-3 sm:mb-5">
        <FaDatabase className="mr-2" /> Storage Pools
      </h3>
      <div className="space-y-6 sm:space-y-10">
        {props.storagePools.map((pool, index) => {
          const capacity = formatPoolCapacity(pool.SIZE, pool.ALLOC, pool.FREE);
          const status = props.zpoolStatus[pool.NAME];

          return (
            <div
              key={index}
              className="border border-gray-100 rounded-md bg-white text-black p-2 sm:p-4 flex flex-col"
            >
              <div className="flex flex-col lg:flex-row justify-between gap-2 md:gap-0">
                <div className="w-full">
                  <div className="flex justify-between items-start">
                    <span className="text-lg sm:text-xl">
                      {pool.NAME} <span className="text-xs sm:text-sm">({pool.SIZE})</span>
                    </span>

                    {/* Performance Configuration */}
                    <PerformanceConfigDropdown
                      poolName={pool.NAME}
                      isOpen={props.performanceDropdownOpen[pool.NAME] || false}
                      onToggle={() => props.onTogglePerformanceDropdown(pool.NAME)}
                      canManage={props.canManage}
                      availableDisks={props.availableDisks}
                      onAddL2Arc={() => props.onAddL2Arc(pool.NAME)}
                      onAddSlog={() => props.onAddSlog(pool.NAME)}
                      onRemoveDevices={() => props.onRemoveDevices(pool.NAME)}
                    />
                  </div>

                  {/* Pool Status and Capacity */}
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600">Status:</span>
                      <span
                        className={`font-medium ${
                          pool.HEALTH === 'ONLINE' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {pool.HEALTH}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Capacity</span>
                        <span>
                          {capacity.allocated} / {capacity.total} ({capacity.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            parseFloat(capacity.percentage) > 80
                              ? 'bg-red-500'
                              : parseFloat(capacity.percentage) > 60
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${capacity.percentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Pool Details */}
                    {status && (
                      <div className="text-xs text-gray-500 space-y-1 mt-3">
                        {status.vdevs && status.vdevs.length > 0 && (
                          <div>
                            <span className="font-medium">VDevs:</span> {status.vdevs.length}
                          </div>
                        )}
                        {status.cache && status.cache.length > 0 && (
                          <div>
                            <span className="font-medium">L2ARC:</span>{' '}
                            {status.cache.map((c: any) => c.name).join(', ')}
                          </div>
                        )}
                        {status.logs && status.logs.length > 0 && (
                          <div>
                            <span className="font-medium">SLOG:</span>{' '}
                            {status.logs.map((l: any) => l.name).join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Device Management Sections */}
              {/* L2ARC Device Addition */}
              {props.addingL2Arc === pool.NAME && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <h5 className="text-sm font-medium text-blue-800 mb-2">
                    Add L2ARC Device to {pool.NAME}
                  </h5>
                  <div className="space-y-2 mb-3">
                    {props.availableDisks.map((disk, diskIndex) => (
                      <label key={diskIndex} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={props.selectedL2ArcDevices.includes(disk.name)}
                          onChange={(e) =>
                            props.onL2ArcDeviceSelection(disk.name, e.target.checked)
                          }
                          className="w-3 h-3 border border-gray-300 rounded focus:outline-none"
                        />
                        <span className="ml-2 text-sm text-gray-800">
                          {disk.name} ({disk.mediasize})
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                      onClick={props.onCancelL2Arc}
                      disabled={props.loadingL2Arc}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
                      onClick={() => props.onConfirmL2Arc(pool.NAME)}
                      disabled={props.loadingL2Arc || props.selectedL2ArcDevices.length === 0}
                    >
                      {props.loadingL2Arc ? 'Adding...' : 'Add L2ARC'}
                    </Button>
                  </div>
                </div>
              )}

              {/* SLOG Device Addition */}
              {props.addingSlog === pool.NAME && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                  <h5 className="text-sm font-medium text-green-800 mb-2">
                    Add SLOG Device to {pool.NAME}
                  </h5>
                  <div className="space-y-2 mb-3">
                    {props.availableDisks.map((disk, diskIndex) => (
                      <label key={diskIndex} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={props.selectedSlogDevices.includes(disk.name)}
                          onChange={(e) => props.onSlogDeviceSelection(disk.name, e.target.checked)}
                          className="w-3 h-3 border border-gray-300 rounded focus:outline-none"
                        />
                        <span className="ml-2 text-sm text-gray-800">
                          {disk.name} ({disk.mediasize})
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mb-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={props.slogMirrorEnabled}
                        onChange={(e) => props.onSlogMirrorToggle(e.target.checked)}
                        className="w-3 h-3 border border-gray-300 rounded focus:outline-none"
                      />
                      <span className="ml-2 text-sm text-gray-800">
                        Enable mirror (requires 2+ devices)
                      </span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                      onClick={props.onCancelSlog}
                      disabled={props.loadingSlog}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
                      onClick={() => props.onConfirmSlog(pool.NAME)}
                      disabled={props.loadingSlog || props.selectedSlogDevices.length === 0}
                    >
                      {props.loadingSlog ? 'Adding...' : 'Add SLOG'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Remove Devices */}
              {props.removingDevices === pool.NAME && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                  <h5 className="text-sm font-medium text-red-800 mb-2">
                    Remove Devices from {pool.NAME}
                  </h5>
                  {/* Device removal logic would go here - simplified for brevity */}
                  <div className="flex gap-2">
                    <Button
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                      onClick={props.onCancelRemoveDevices}
                      disabled={props.loadingRemoveDevices}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-50"
                      onClick={() => props.onConfirmRemoveDevices(pool.NAME)}
                      disabled={
                        props.loadingRemoveDevices || props.selectedRemoveDevices.length === 0
                      }
                    >
                      {props.loadingRemoveDevices ? 'Removing...' : 'Remove Devices'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="my-4 flex flex-col md:flex-row space-x-2 space-y-2">
                {props.canManage && (
                  <Button
                    className="px-1 py-2 gap-1 h-full w-full lg:w-auto lg:h-auto text-white bg-emerald-600 rounded hover:bg-emerald-700 flex items-center"
                    onClick={() => props.onCreateDataset(pool.NAME)}
                  >
                    <Add size={24} color="#FFFFFF" /> Create Dataset
                    <Tooltip
                      iconColor="#FFFFFF"
                      text="Creating a ZFS dataset establishes a logical container within a pool for storing data, allowing you to apply specific properties like quotas, compression, and snapshots independently from the overall pool."
                    />
                  </Button>
                )}

                <Button
                  className="px-1 py-2 gap-2 text-white bg-karios-blue rounded hover:bg-blue-700 transition-opacity duration-200 flex items-center"
                  onClick={() => props.onViewDatasets(pool.NAME)}
                  disabled={props.loadingDatasets === pool.NAME}
                >
                  <Eye size={24} color="#FFFFFF" />
                  {props.loadingDatasets === pool.NAME ? 'Loading...' : 'View Datasets'}
                  <Tooltip
                    iconColor="#FFFFFF"
                    text="This will display Karios dataset, usage statistics, and other details, providing insight into its configuration and health within the ZFS storage system. You may also turn features like data deduplication and compression on/off here."
                  />
                </Button>

                {props.canManage && (
                  <Button
                    className="px-1 py-2 gap-2 text-white h-full w-full lg:w-auto lg:h-auto bg-yellow-500 rounded hover:bg-yellow-700 flex items-center"
                    onClick={() => props.onCreateZvol(pool.NAME)}
                  >
                    <FolderAdd size={24} color="#FFFFFF" /> Create Zvol
                    <Tooltip
                      iconColor="#FFFFFF"
                      text="Creating a ZVOL in ZFS establishes a block-level device within a pool, allowing you to present it as a virtual disk for applications like databases or virtualization."
                    />
                  </Button>
                )}

                {props.canManage && (
                  <Button
                    className="px-1 py-2 gap-2 h-full w-full lg:w-auto lg:h-full text-white bg-red-600 rounded hover:bg-red-700 flex items-center"
                    onClick={() => props.onDeletePool(pool.NAME)}
                    disabled={props.deletingPool === pool.NAME}
                  >
                    <Trash size={24} color="#FFFFFF" />
                    {props.deletingPool === pool.NAME ? 'Deleting...' : 'Delete Pool'}
                    <Tooltip
                      iconColor="#FFFFFF"
                      text="Deleting a ZFS pool permanently removes all data and metadata stored within it, effectively destroying the entire storage volume."
                    />
                  </Button>
                )}
              </div>

              {/* Dataset Creation Form */}
              {props.creatingDataset === pool.NAME && (
                <CreateDataset
                  poolName={pool.NAME}
                  datasetName={props.datasetName}
                  setDatasetName={props.onDatasetNameChange}
                  datasetEncryption={props.datasetEncryption}
                  setDatasetEncryption={props.onDatasetEncryptionChange}
                  datasetPassphrase={props.datasetPassphrase}
                  setDatasetPassphrase={props.onDatasetPassphraseChange}
                  createDataset={() => props.onDatasetCreate(pool.NAME)}
                  setCreatingDataset={props.onCancelDatasetCreation}
                />
              )}

              {/* Zvol Creation Form */}
              {props.zvolPool === pool.NAME && (
                <CreateZvol
                  pool={pool}
                  zvolName={props.zvolName}
                  setZvolName={props.onZvolNameChange}
                  zvolSize={props.zvolSize}
                  setZvolSize={props.onZvolSizeChange}
                  createZvol={(name, size) => props.onZvolCreate(name, size.toString())}
                  setZvolPool={props.onCancelZvolCreation}
                  creatingZvol={props.creatingZvol}
                />
              )}

              {/* Datasets View */}
              {props.showingDatasets[pool.NAME] && props.datasets[pool.NAME] && (
                <DatasetsView
                  poolName={pool.NAME}
                  datasets={props.datasets}
                  selectedDatasetTypes={props.selectedDatasetTypes}
                  loadingDatasets={props.loadingDatasets}
                  onDatasetTypeChange={props.onDatasetTypeChange}
                  onCloseDatasetsView={props.onCloseDatasetsView}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
