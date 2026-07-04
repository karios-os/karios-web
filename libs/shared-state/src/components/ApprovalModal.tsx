import React, { useState } from 'react';
import Modal from '../widgets/Modal';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (selectedApprover: string) => void;
  approvers: string[];
  title: string;
  message: string;
}

export default function ApprovalModal({
  isOpen,
  onClose,
  onSubmit,
  approvers,
  title,
  message,
}: ApprovalModalProps) {
  const [selectedApprover, setSelectedApprover] = useState<string>('');

  const handleSubmit = () => {
    if (selectedApprover) {
      onSubmit(selectedApprover);
      setSelectedApprover(''); // Reset selection
    }
  };

  const handleClose = () => {
    setSelectedApprover(''); // Reset selection on close
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} width="400px">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{message}</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select an approver:
          </label>
          <div className="space-y-2">
            {(approvers || []).map((approver) => (
              <label key={approver} className="flex items-center">
                <input
                  type="radio"
                  name="approver"
                  value={approver}
                  checked={selectedApprover === approver}
                  onChange={(e) => setSelectedApprover(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">{approver}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedApprover}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Submit Request
          </button>
        </div>
      </div>
    </Modal>
  );
}
