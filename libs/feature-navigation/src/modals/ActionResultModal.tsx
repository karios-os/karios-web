import React from 'react';
import Modal from '../../../shared-state/src/widgets/Modal';

interface ActionResultModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const ActionResultModal: React.FC<ActionResultModalProps> = ({
  isOpen,
  title,
  message,
  type,
  onClose,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="p-4 pt-0">
        <div className={`mb-3 text-sm ${type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </div>

        <div className="mt-7 flex justify-center">
          <button
            type="button"
            className="inline-flex justify-center px-[29px] py-[12px] shadow-sm text-sm text-white font-medium rounded-sm bg-sky-500 hover:bg-sky-600"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
};
