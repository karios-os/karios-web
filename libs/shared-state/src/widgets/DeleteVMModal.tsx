import React, { useRef } from 'react';
import Modal from './Modal';

export interface DeleteVMModalProps {
  isOpen: boolean;
  onClose: () => void;
  vmName: string;
  isVmOn: boolean;
  onConfirm: () => void;
  isDeleting: boolean;
  deleteButtonClicked: boolean;
}

export const DeleteVMModal: React.FC<DeleteVMModalProps> = ({
  isOpen,
  onClose,
  vmName,
  isVmOn,
  onConfirm,
  isDeleting,
  deleteButtonClicked,
}) => {
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) {
          onClose();
        }
      }}
      title={vmName ? `Delete ${vmName}` : 'Delete VM'}
    >
      <div className="p-4 pt-0">
        {isVmOn ? (
          // Content for powered on VM
          <div>
            <div className="mb-[19px] text-slate-800 font-lexend text-xl leading-[140%] tracking-normal">
              Please turn off the VM before deleting
            </div>
            <p className="text-sm text-red-600 mb-3">
              The VM must be powered off before it can be deleted.
            </p>

            <div className="mt-7 flex justify-center">
              <button
                type="button"
                className="inline-flex justify-center px-[29px] py-[12px] shadow-sm text-sm text-white font-medium rounded-sm bg-red-700 hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onClose}
                disabled={isDeleting}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          // Content for powered off VM
          <div>
            <div className="mb-[19px] text-slate-800 font-lexend text-xl leading-[140%] tracking-normal">
              Are you sure you want to delete this VM?
            </div>
            <p className="text-sm text-gray-600 mb-3">
              All disks and snapshots will be permanently destroyed.
            </p>

            <div className="mt-7 flex justify-end">
              <button
                type="button"
                className="mr-2 inline-flex justify-center px-[29px] py-[12px] shadow-sm text-sm text-white font-medium rounded-sm bg-red-700 hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onClose}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                ref={deleteButtonRef}
                type="button"
                className={`inline-flex justify-center px-[29px] py-[12px] border border-transparent shadow-sm text-sm font-medium rounded-sm text-white ${
                  deleteButtonClicked
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-sky-500 hover:bg-sky-600'
                }`}
                onClick={onConfirm}
                disabled={deleteButtonClicked}
              >
                {deleteButtonClicked ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DeleteVMModal;
