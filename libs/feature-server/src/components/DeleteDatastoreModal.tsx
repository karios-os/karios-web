import React from 'react';
import Modal from '../../../shared-state/src/widgets/Modal';

interface DeleteDatastoreModalProps {
  isOpen: boolean;
  datastoreToDelete: string | null;
  onClose: () => void;
  onConfirmDelete: () => void;
}

export default function DeleteDatastoreModal({
  isOpen,
  datastoreToDelete,
  onClose,
  onConfirmDelete,
}: DeleteDatastoreModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Datastore" width="400px">
      <div className="p-4">
        <p className="text-gray-700 mb-4">
          Are you sure you want to delete the datastore `&apos;`{datastoreToDelete}`&apos;`?
        </p>
        <p className="text-sm text-red-600 mb-6">This action cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmDelete}
            disabled={datastoreToDelete === 'default'}
            className={`px-4 py-2 text-white rounded ${
              datastoreToDelete === 'default'
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            Delete Datastore
          </button>
        </div>
      </div>
    </Modal>
  );
}
