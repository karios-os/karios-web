import React from 'react';
import Modal from '../../../shared-state/src/widgets/Modal';

interface DeletePoolModalProps {
  isOpen: boolean;
  poolToDelete: string | null;
  poolConfirmationText: string;
  storagePools: any[];
  deletingPool: string | null;
  onClose: () => void;
  onConfirmationTextChange: (text: string) => void;
  onConfirmDelete: () => void;
}

export default function DeletePoolModal({
  isOpen,
  poolToDelete,
  poolConfirmationText,
  storagePools,
  deletingPool,
  onClose,
  onConfirmationTextChange,
  onConfirmDelete,
}: DeletePoolModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Pool" width="500px">
      <div className="p-4">
        {storagePools.length === 1 ? (
          // Show warning when it's the only pool
          <>
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete the pool `&apos;`{poolToDelete}`&apos;`?
            </p>
            <p className="text-red-600 font-bold mb-4">Note: The root pool cannot be deleted.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                disabled
                className="px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed opacity-50"
              >
                Delete Pool
              </button>
            </div>
          </>
        ) : (
          // Show normal deletion flow when multiple pools exist
          <>
            <p className="text-gray-700 mb-4">
              Deleting this storage pool will permanently destroy all data within it, including all
              datasets, zvols, and snapshots. This operation cannot be reversed. Are you absolutely
              sure?
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Pool: <span className="font-mono font-bold">{poolToDelete}</span>
            </p>
            <p className="text-sm text-gray-700 mb-2">
              Type the name of the pool in the text box to complete the deletion:
            </p>
            <input
              type="text"
              value={poolConfirmationText}
              onChange={(e) => onConfirmationTextChange(e.target.value)}
              placeholder={poolToDelete || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-red-500 font-mono mb-4"
              disabled={deletingPool === poolToDelete}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                disabled={deletingPool === poolToDelete}
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={deletingPool === poolToDelete || poolConfirmationText !== poolToDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingPool === poolToDelete ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
