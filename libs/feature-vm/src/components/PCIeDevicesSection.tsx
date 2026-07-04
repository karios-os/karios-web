import React, { FC, JSX } from 'react';
import { BsGpuCard, BsPciCardNetwork, BsFillNvmeFill } from 'react-icons/bs';
import { FaMicrochip } from 'react-icons/fa';
import { FaCheck } from 'react-icons/fa6';
import { IoIosAttach } from 'react-icons/io';
import { Export, Refresh, ArrowDown } from 'iconsax-react';
import { Modal } from '@karios-monorepo/shared-state';
import { Card } from '@karios-monorepo/shared-state';

interface PCIeDevicesSectionProps {
  selectedVm: any;
  pcieLoading: boolean;
  pcieError: string | null;
  groupedAttachedPcie: any[];
  showPcieForm: boolean;
  setShowPcieForm: (value: boolean) => void;
  availableGroupedPcieDevices: any[];
  inUseGroupedPcieDevices: any[];
  selectedPcieDevices: string[];
  expandedDevices: Set<string>;
  isPciePending: boolean;
  onDetachPcie: (bdf: string) => Promise<void>;
  onAttachPcie: () => void;
  onToggleGroupSelection: (deviceKey: string) => void;
  onToggleExpansion: (deviceKey: string) => void;
  isPhysicalFunctionWithExistingVfs: (func: any, deviceKey?: string) => boolean;
  onAttachConfirm: () => Promise<void>;
  isAttaching: boolean;
}

const PCIeAttachModal: FC<{
  showForm: boolean;
  onClose: () => void;
  availableGroupedPcieDevices: any[];
  inUseGroupedPcieDevices: any[];
  selectedPcieDevices: string[];
  expandedDevices: Set<string>;
  isPciePending: boolean;
  onToggleGroupSelection: (deviceKey: string) => void;
  onToggleExpansion: (deviceKey: string) => void;
  isPhysicalFunctionWithExistingVfs: (func: any, deviceKey?: string) => boolean;
  onAttach: () => void;
  isAttaching: boolean;
  groupedPcieDevices: any[];
}> = ({
  showForm,
  onClose,
  availableGroupedPcieDevices,
  inUseGroupedPcieDevices,
  selectedPcieDevices,
  expandedDevices,
  isPciePending,
  onToggleGroupSelection,
  onToggleExpansion,
  onAttach,
}) => {
  const availableGpuDevices = availableGroupedPcieDevices.filter((g) => g.category === 'gpu');
  const inUseGpuDevices = inUseGroupedPcieDevices.filter((g) => g.category === 'gpu');
  const availableNetworkDevices = availableGroupedPcieDevices.filter(
    (g) => g.category === 'network'
  );
  const inUseNetworkDevices = inUseGroupedPcieDevices.filter(
    (g) => g.category === 'network' && !g.isIntegrated
  );
  const integratedNetworkDevices = inUseGroupedPcieDevices.filter(
    (g) => g.category === 'network' && g.isIntegrated
  );
  const availableStorageDevices = availableGroupedPcieDevices.filter(
    (g) => g.category === 'storage'
  );
  const inUseStorageDevices = inUseGroupedPcieDevices.filter((g) => g.category === 'storage');

  const hasGpuDevices = availableGpuDevices.length > 0 || inUseGpuDevices.length > 0;
  const hasNetworkDevices =
    availableNetworkDevices.length > 0 ||
    inUseNetworkDevices.length > 0 ||
    integratedNetworkDevices.length > 0;
  const hasStorageDevices = availableStorageDevices.length > 0 || inUseStorageDevices.length > 0;

  const deviceCategoryCount = [hasGpuDevices, hasNetworkDevices, hasStorageDevices].filter(
    (b) => b
  ).length;

  const gridClass =
    deviceCategoryCount === 1
      ? 'lg:grid-cols-1'
      : deviceCategoryCount === 2
        ? 'lg:grid-cols-2'
        : 'lg:grid-cols-3';

  const widthClass =
    deviceCategoryCount === 1 ? 'max-w-2xl' : deviceCategoryCount === 2 ? 'max-w-4xl' : 'max-w-6xl';

  return (
    <Modal
      isOpen={showForm}
      onClose={onClose}
      title="Attach PCIe Devices (You can select multiple PCIe devices to attach)"
      width={widthClass}
    >
      <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
        <div>
          <div className={`grid grid-cols-1 gap-6 ${gridClass}`}>
            {/* GPU Section */}
            {hasGpuDevices && (
              <div className="flex flex-col min-h-0">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center justify-center gap-2">
                  <BsGpuCard size={16} className="text-purple-600" />
                  GPU Devices
                  {inUseGpuDevices.length > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      {inUseGpuDevices.length} in use
                    </span>
                  )}
                </h4>
                <div className="space-y-2">
                  {availableGpuDevices.map((group) => (
                    <PCIeDeviceItem
                      key={group.key}
                      group={group}
                      isSelected={selectedPcieDevices.some((bdf) => group.allBdfs.includes(bdf))}
                      isExpanded={expandedDevices.has(group.key)}
                      onToggleSelect={() => onToggleGroupSelection(group.key)}
                      onToggleExpand={() => onToggleExpansion(group.key)}
                    />
                  ))}
                  {inUseGpuDevices.map((group) => (
                    <PCIeDeviceItem
                      key={group.key}
                      group={group}
                      isSelected={false}
                      isExpanded={expandedDevices.has(group.key)}
                      onToggleSelect={() => {}}
                      onToggleExpand={() => onToggleExpansion(group.key)}
                      isDisabled={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Network Section */}
            {hasNetworkDevices && (
              <div className="flex flex-col min-h-0">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center justify-center gap-2">
                  <BsPciCardNetwork size={16} className="text-blue-600" />
                  Network Devices
                </h4>
                <div className="space-y-2">
                  {availableNetworkDevices.map((group) => (
                    <PCIeDeviceItem
                      key={group.key}
                      group={group}
                      isSelected={selectedPcieDevices.some((bdf) => group.allBdfs.includes(bdf))}
                      isExpanded={expandedDevices.has(group.key)}
                      onToggleSelect={() => onToggleGroupSelection(group.key)}
                      onToggleExpand={() => onToggleExpansion(group.key)}
                    />
                  ))}
                  {inUseNetworkDevices.map((group) => (
                    <PCIeDeviceItem
                      key={group.key}
                      group={group}
                      isSelected={false}
                      isExpanded={expandedDevices.has(group.key)}
                      onToggleSelect={() => {}}
                      onToggleExpand={() => onToggleExpansion(group.key)}
                      isDisabled={true}
                    />
                  ))}
                  {integratedNetworkDevices.map((group) => (
                    <PCIeDeviceItem
                      key={group.key}
                      group={group}
                      isSelected={false}
                      isExpanded={expandedDevices.has(group.key)}
                      onToggleSelect={() => {}}
                      onToggleExpand={() => onToggleExpansion(group.key)}
                      isDisabled={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Storage Section */}
            {hasStorageDevices && (
              <div className="flex flex-col min-h-0">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center justify-center gap-2">
                  <BsFillNvmeFill size={16} className="text-green-600" />
                  Storage Devices
                  {inUseStorageDevices.length > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      {inUseStorageDevices.length} in use
                    </span>
                  )}
                </h4>
                <div className="space-y-2">
                  {availableStorageDevices.map((group) => (
                    <PCIeDeviceItem
                      key={group.key}
                      group={group}
                      isSelected={selectedPcieDevices.some((bdf) => group.allBdfs.includes(bdf))}
                      isExpanded={expandedDevices.has(group.key)}
                      onToggleSelect={() => onToggleGroupSelection(group.key)}
                      onToggleExpand={() => onToggleExpansion(group.key)}
                    />
                  ))}
                  {inUseStorageDevices.map((group) => (
                    <PCIeDeviceItem
                      key={group.key}
                      group={group}
                      isSelected={false}
                      isExpanded={expandedDevices.has(group.key)}
                      onToggleSelect={() => {}}
                      onToggleExpand={() => onToggleExpansion(group.key)}
                      isDisabled={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-gray-700 font-medium rounded-md hover:bg-gray-100 transition-colors border border-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              await onAttach();
              onClose();
            }}
            disabled={isPciePending || selectedPcieDevices.length === 0}
            className="px-4 py-2 bg-karios-blue text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Attach {selectedPcieDevices.length > 0 ? `(${selectedPcieDevices.length})` : ''}
            {selectedPcieDevices.length !== 1 ? 's' : ''} Device
            {selectedPcieDevices.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const PCIeDeviceItem: FC<{
  group: any;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  isDisabled?: boolean;
}> = ({ group, isSelected, isExpanded, onToggleSelect, onToggleExpand, isDisabled = false }) => {
  const hasIntegrated = group.funcs.some((fn: any) => fn.is_integrated === true);

  return (
    <div
      className={`relative border rounded-lg transition-all duration-200 ${
        isDisabled
          ? 'border-gray-300 bg-gray-100 opacity-60'
          : isSelected
            ? 'border-karios-green bg-green-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2 p-2">
        {!hasIntegrated && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isDisabled) onToggleSelect();
            }}
            disabled={isDisabled}
            className={`w-3 h-3 rounded border-2 flex items-center justify-center transition-colors ${
              isDisabled
                ? 'bg-gray-300 border-gray-400 cursor-not-allowed'
                : isSelected
                  ? 'bg-karios-blue border-karios-blue'
                  : 'bg-white border-gray-300 hover:border-blue-400'
            }`}
          >
            {isSelected && <FaCheck size={8} color="white" />}
          </button>
        )}

        <div
          className={`flex items-center justify-between flex-grow ${
            hasIntegrated || isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
          onClick={() => !hasIntegrated && !isDisabled && onToggleExpand()}
        >
          <div className="flex items-center gap-2 flex-grow min-w-0 max-w-xs">
            <div className="flex-grow min-w-0">
              <div
                className={`font-medium text-xs break-words flex items-center gap-2 ${
                  isDisabled ? 'text-gray-600' : 'text-gray-800'
                }`}
              >
                {group.vendor}
                <span className={`text-gray-400 font-mono ${isDisabled ? 'text-gray-500' : ''}`}>
                  ({group.allBdfs.join(', ')})
                </span>
                {hasIntegrated && (
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                    Host Integrated
                  </span>
                )}
                {isDisabled && (
                  <span className="text-xs bg-gray-300 text-gray-700 px-2 py-0.5 rounded">
                    In Use
                  </span>
                )}
              </div>
              <div
                className={`text-xs break-words ${isDisabled ? 'text-gray-500' : 'text-gray-500'}`}
              >
                {group.funcs[0]?.device}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isDisabled ? 'bg-gray-400' : hasIntegrated ? 'bg-gray-400' : 'bg-green-500'
                }`}
              ></div>
              <ArrowDown
                size={12}
                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                color={isDisabled ? '#9CA3AF' : hasIntegrated ? '#D1D5DB' : '#9CA3AF'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      {isExpanded && (
        <div className="px-2 pb-2 border-t border-gray-100">
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-medium ${isDisabled ? 'text-gray-500' : 'text-gray-600'}`}
              >
                Functions:
              </span>
              <span className={`text-xs ${isDisabled ? 'text-gray-600' : 'text-gray-800'}`}>
                {group.funcs.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-medium ${isDisabled ? 'text-gray-500' : 'text-gray-600'}`}
              >
                BDFs:
              </span>
              <div className="flex flex-wrap gap-1">
                {group.funcs.slice(0, 3).map((fn: any, index: number) => (
                  <span
                    key={index}
                    className={`inline-block text-xs px-1 py-0.5 rounded border ${
                      isDisabled
                        ? 'bg-gray-200 text-gray-600 border-gray-300'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {fn.bdf}
                  </span>
                ))}
                {group.funcs.length > 3 && (
                  <span className={`text-xs ${isDisabled ? 'text-gray-500' : 'text-gray-500'}`}>
                    +{group.funcs.length - 3}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-medium ${isDisabled ? 'text-gray-500' : 'text-gray-600'}`}
              >
                Vendor ID:
              </span>
              <span
                className={`text-xs font-mono ${isDisabled ? 'text-gray-600' : 'text-gray-800'}`}
              >
                {group.vendor_id}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PCIeDevicesSection: FC<PCIeDevicesSectionProps> = ({
  pcieLoading,
  pcieError,
  groupedAttachedPcie,
  showPcieForm,
  setShowPcieForm,
  availableGroupedPcieDevices,
  inUseGroupedPcieDevices,
  selectedPcieDevices,
  expandedDevices,
  isPciePending,
  onDetachPcie,
  onAttachPcie,
  onToggleGroupSelection,
  onToggleExpansion,
  isPhysicalFunctionWithExistingVfs,
  isAttaching,
}): JSX.Element => {
  const attachButton =
    !pcieLoading && pcieError === null ? (
      <button
        className="text-karios-green hover:text-green-700 text-sm flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => setShowPcieForm(true)}
        disabled={pcieLoading || pcieError !== null}
      >
        <IoIosAttach size="20" className="mr-2" /> Attach
      </button>
    ) :null;

  return (
    <Card
      title="Add-In card and PCIe Devices"
      icon={BsGpuCard}
      iconColor="#f59e0b"
      iconSize={24}
      titleExtra={
        <>
          {pcieLoading && (
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <Refresh className="animate-spin" color="currentColor" size={16} />
              <span className="hidden sm:inline">Loading PCIe devices...</span>
            </div>
          )}
          {attachButton}
        </>
      }
      className="border border-gray-200 rounded-lg min-w-0 order-3"
    >
      <div className="bg-white rounded-lg p-3 sm:p-4 space-y-3 overflow-y-auto max-h-[250px]">
        {/* Loading state */}
        {pcieLoading && (
          <div className="flex items-center justify-center p-8 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <Refresh className="animate-spin" size={24} color="#3B82F6" />
              <p className="text-gray-600">Loading PCIe devices...</p>
            </div>
          </div>
        )}
        {/* Error state */}
        {pcieError && !pcieLoading && (
          <div className="flex items-center justify-center p-8 bg-red-50 rounded-xl">
            <div className="flex flex-col items-center gap-3">
              <p className="text-red-600 font-medium">Failed to load PCIe devices</p>
              <p className="text-red-500 text-sm text-center">{pcieError}</p>
            </div>
          </div>
        )}
        {/* Attached Devices */}
        {!pcieLoading && !pcieError && groupedAttachedPcie.length > 0 ? (
          <div>
            {groupedAttachedPcie.map((group) => (
              <div
                key={group.key}
                className="flex flex-col lg:flex-row lg:items-center justify-between border-2 border-gray-300 p-4 rounded-lg gap-4 bg-stone-50"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 flex-grow">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0">
                    {group.category === 'network' ? (
                      <BsPciCardNetwork size={20} color="#3B82F6" />
                    ) : group.category === 'gpu' ? (
                      <BsGpuCard size={20} color="#7C3AED" />
                    ) : group.category === 'storage' ? (
                      <BsFillNvmeFill size={20} color="#10B981" />
                    ) : (
                      <FaMicrochip size={20} color="#7C3AED" />
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-2 text-sm flex-grow min-w-0">
                    <div className="min-w-0">
                      <span className="text-gray-500 font-medium">Device:</span>
                      <span className="ml-2 font-semibold break-words block">
                        {group.funcs[0]?.device || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Category:</span>
                      <span className="ml-2 text-karios-blue font-medium">{group.category}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Vendor:</span>
                      <span className="ml-2 text-gray-800 font-medium">{group.vendor}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
                  <button
                    onClick={() => onDetachPcie(group.allBdfs[0])}
                    className="bg-karios-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm flex items-center justify-center font-medium transition-colors"
                  >
                    <Export size="20" variant="Bold" className="mr-2" color="#ffffff" />
                    {group.isNetworkFunction ? 'Detach Function' : 'Detach'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !pcieLoading && !pcieError ? (
          <div className="border border-gray-200 p-6 rounded-lg bg-white text-center shadow-sm">
            <FaMicrochip size={32} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500 font-medium">No PCIe devices attached</p>
            <p className="text-gray-400 text-sm mt-1">
              Use the &apos;Attach&apos; button to add a PCIe device
            </p>
          </div>
        ) : null}{' '}
      </div>
      <PCIeAttachModal
        showForm={showPcieForm}
        onClose={() => setShowPcieForm(false)}
        availableGroupedPcieDevices={availableGroupedPcieDevices}
        inUseGroupedPcieDevices={inUseGroupedPcieDevices}
        selectedPcieDevices={selectedPcieDevices}
        expandedDevices={expandedDevices}
        isPciePending={isPciePending}
        onToggleGroupSelection={onToggleGroupSelection}
        onToggleExpansion={onToggleExpansion}
        isPhysicalFunctionWithExistingVfs={isPhysicalFunctionWithExistingVfs}
        onAttach={onAttachPcie}
        isAttaching={isAttaching}
        groupedPcieDevices={groupedAttachedPcie}
      />
    </Card>
  );
};

export default PCIeDevicesSection;
