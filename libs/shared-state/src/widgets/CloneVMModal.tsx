import React from 'react';
import Modal from './Modal';

export interface PCIeDevice {
  device: string;
  bdf: string;
  category: string;
  vendor: string;
}

export interface CloneVMModalProps {
  isOpen: boolean;
  onClose: () => void;
  vmName: string;
  modalMode: 'powered-on' | 'input' | 'name-exists' | 'pcie-warning' | 'error';
  newCloneVmName: string;
  onNameChange: (value: string) => void;
  onConfirm: () => void;
  onProceedAfterWarning: () => void;
  errorMessage: string;
  pcieDevices: PCIeDevice[];
}

export const CloneVMModal: React.FC<CloneVMModalProps> = ({
  isOpen,
  onClose,
  vmName,
  modalMode,
  newCloneVmName,
  onNameChange,
  onConfirm,
  onProceedAfterWarning,
  errorMessage,
  pcieDevices,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={vmName ? `Clone ${vmName}` : 'Clone VM'}>
      <div className="p-4 pt-0">
        {modalMode === 'powered-on' && (
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

        {modalMode === 'input' && (
          <div>
            <label className="block text-sm text-slate-800 mb-[19px] font-lexend text-xl leading-[140%] tracking-normal">
              Enter new clone name
            </label>
            <input
              type="text"
              value={newCloneVmName}
              onChange={(e) => onNameChange(e.target.value)}
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
                onClick={onConfirm}
              >
                Clone
              </button>
            </div>
          </div>
        )}

        {modalMode === 'name-exists' && (
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
              onChange={(e) => onNameChange(e.target.value)}
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
                onClick={onConfirm}
              >
                Clone
              </button>
            </div>
          </div>
        )}

        {modalMode === 'pcie-warning' && (
          <div>
            <div className="mb-[19px] text-slate-800 font-lexend text-xl leading-[140%] tracking-normal">
              PCIe Device Warning
            </div>
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="mb-3">
                <p className="text-sm text-gray-700 mb-3">
                  The VM <strong>{vmName}</strong> has {pcieDevices.length} PCIe device
                  {pcieDevices.length !== 1 ? 's' : ''} attached. Cloning will copy these devices to
                  the new VM, which may cause conflicts when both VMs try to use the same devices.
                </p>
                <div className="text-xs text-gray-600 mb-2">
                  <strong>Attached Devices:</strong>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {pcieDevices.map((device, index) => (
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
                onClick={onProceedAfterWarning}
              >
                I Understand - Proceed
              </button>
            </div>
          </div>
        )}

        {modalMode === 'error' && (
          <div>
            <div className="mb-[19px] text-slate-800 font-lexend text-xl leading-[140%] tracking-normal">
              Failed to clone VM
            </div>
            <p className="text-sm text-red-600 mb-3">{errorMessage}</p>

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

export default CloneVMModal;
