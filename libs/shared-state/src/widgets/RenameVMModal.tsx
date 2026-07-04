import React from 'react';
import Modal from './Modal';

export interface RenameVMModalProps {
  isOpen: boolean;
  onClose: () => void;
  vmName: string;
  newVmName: string;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirm: () => void;
  nameValidationError: string;
  renameError: string;
}

export const RenameVMModal: React.FC<RenameVMModalProps> = ({
  isOpen,
  onClose,
  vmName,
  newVmName,
  onNameChange,
  onConfirm,
  nameValidationError,
  renameError,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={vmName ? vmName : 'Rename VM'}>
      <div className="p-4 pt-0">
        <label className="block text-sm text-slate-800 mb-[19px] font-lexend text-xl leading-[140%] tracking-normal">
          Enter new VM name
        </label>
        <input
          type="text"
          value={newVmName}
          onChange={onNameChange}
          className={`mt-1 block w-full p-2 border rounded-md shadow-sm focus:outline-none focus:ring-karios-blue ${
            nameValidationError
              ? 'border-red-500 focus:border-red-500'
              : 'border-gray-300 focus:border-karios-blue'
          }`}
          placeholder="New VM name"
        />

        {nameValidationError && <p className="mt-2 text-sm text-red-600">{nameValidationError}</p>}

        {renameError && <p className="mt-2 text-sm text-red-600">{renameError}</p>}

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
            className={`inline-flex justify-center px-[29px] py-[12px] border border-transparent shadow-sm text-sm font-medium rounded-sm text-white ${
              nameValidationError || !newVmName.trim() || newVmName === vmName
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-sky-500 hover:bg-sky-600'
            }`}
            onClick={onConfirm}
            disabled={!!nameValidationError || !newVmName.trim() || newVmName === vmName}
          >
            Rename
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default RenameVMModal;
