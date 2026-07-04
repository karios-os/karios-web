import React from 'react';
import Modal from '../../../shared-state/src/widgets/Modal';
import type { VirtualMachine } from '../SideBar-types';

interface PCIeDevice {
  device: string;
  bdf: string;
  category: string;
  vendor: string;
}

interface CloneVMModalProps {
  isOpen: boolean;
  currentCloneVm: VirtualMachine | null;
  cloneModalMode: 'powered-on' | 'input' | 'name-exists' | 'pcie-warning' | 'error';
  newCloneVmName: string;
  pcieDevicesList: PCIeDevice[];
  cloneErrorMessage: string;
  onClose: () => void;
  onNewCloneVmNameChange: (name: string) => void;
  onConfirmClone: () => void;
  onProceedAfterPcieWarning: () => void;
}

export const CloneVMModal: React.FC<CloneVMModalProps> = ({
  isOpen,
  currentCloneVm,
  cloneModalMode,
  newCloneVmName,
  pcieDevicesList,
  cloneErrorMessage,
  onClose,
  onNewCloneVmNameChange,
  onConfirmClone,
  onProceedAfterPcieWarning,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentCloneVm ? `Clone ${currentCloneVm.name}` : 'Clone VM'}
    >
      <div className="p-4 pt-0">
        {cloneModalMode === 'powered-on' && (
          <div>
            <div className="mb-[19px] text-slate-800 font-lexend text-xl leading-[140%] tracking-normal">
              Please turn off the VM before cloning
            </div>
            <p className="text-sm text-red-600 mb-3">
              The VM must be powered off before it can be cloned.
            </p>

            <div className="mt-7 flex justify-center">
              <button
                type="button"
                className="inline-flex justify-center px-[29px] py-[12px] shadow-sm text-sm text-white font-medium rounded-sm bg-red-700 hover:bg-red-900"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {cloneModalMode === 'input' && (
          <div>
            <label className="block text-sm text-slate-800 mb-[19px] font-lexend text-xl leading-[140%] tracking-normal">
              Enter new clone name
            </label>
            <input
              type="text"
              value={newCloneVmName}
              onChange={(e) => onNewCloneVmNameChange(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-karios-blue focus:border-karios-blue"
              placeholder="New clone name"
            />

            <div className="mt-7 flex justify-end">
              <button
                type="button"
                className="mr-2 inline-flex justify-center px-[29px] py-[12px] shadow-sm text-sm text-white font-medium rounded-sm bg-red-700 hover:bg-red-900"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex justify-center px-[29px] py-[12px] border border-transparent shadow-sm text-sm font-medium rounded-sm text-white bg-sky-500 hover:bg-sky-600"
                onClick={onConfirmClone}
              >
                Clone
              </button>
            </div>
          </div>
        )}

        {cloneModalMode === 'name-exists' && (
          <div>
            <div className="mb-[19px] text-slate-800 font-lexend text-xl leading-[140%] tracking-normal">
              VM name already exists
            </div>
            <p className="text-sm text-red-600 mb-3">
              Please choose a different name for the clone.
            </p>

            <input
              type="text"
              value={newCloneVmName}
              onChange={(e) => onNewCloneVmNameChange(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-karios-blue focus:border-karios-blue"
              placeholder="New clone name"
            />

            <div className="mt-7 flex justify-end">
              <button
                type="button"
                className="mr-2 inline-flex justify-center px-[29px] py-[12px] shadow-sm text-sm text-white font-medium rounded-sm bg-red-700 hover:bg-red-900"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex justify-center px-[29px] py-[12px] border border-transparent shadow-sm text-sm font-medium rounded-sm text-white bg-sky-500 hover:bg-sky-600"
                onClick={onConfirmClone}
              >
                Clone
              </button>
            </div>
          </div>
        )}

        {cloneModalMode === 'pcie-warning' && (
          <div>
            <div className="mb-[19px] text-slate-800 font-lexend text-xl leading-[140%] tracking-normal">
              PCIe Device Warning
            </div>
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="mb-3">
                <p className="text-sm text-gray-700 mb-3">
                  The VM <strong>{currentCloneVm?.name}</strong> has {pcieDevicesList.length} PCIe
                  device{pcieDevicesList.length !== 1 ? 's' : ''} attached. Cloning will copy these
                  devices to the new VM, which may cause conflicts when both VMs try to use the same
                  devices.
                </p>
                <div className="text-xs text-gray-600 mb-2">
                  <strong>Attached Devices:</strong>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {pcieDevicesList.map((device, index) => (
                    <div
                      key={index}
                      className="text-xs bg-white p-2 rounded border border-gray-200"
                    >
                      <div className="font-medium text-gray-800">{device.device}</div>
                      <div className="text-gray-600">
                        BDF: {device.bdf} • {device.category} • {device.vendor}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="text-xs text-yellow-800">
                    <strong>Note:</strong> You may need to detach PCIe devices from one VM before
                    starting the other.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 flex justify-end">
              <button
                type="button"
                className="mr-2 inline-flex justify-center px-[29px] py-[12px] shadow-sm text-sm text-white font-medium rounded-sm bg-red-700 hover:bg-red-900"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex justify-center px-[29px] py-[12px] border border-transparent shadow-sm text-sm font-medium rounded-sm text-white bg-sky-500 hover:bg-sky-600"
                onClick={onProceedAfterPcieWarning}
              >
                I Understand - Proceed
              </button>
            </div>
          </div>
        )}

        {cloneModalMode === 'error' && (
          <div>
            <div className="mb-[19px] text-slate-800 font-lexend text-xl leading-[140%] tracking-normal">
              Failed to clone VM
            </div>
            <p className="text-sm text-red-600 mb-3">{cloneErrorMessage}</p>

            <div className="mt-7 flex justify-center">
              <button
                type="button"
                className="inline-flex justify-center px-[29px] py-[12px] shadow-sm text-sm text-white font-medium rounded-sm bg-red-700 hover:bg-red-900"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
