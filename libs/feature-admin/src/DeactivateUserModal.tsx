import React, { useState } from 'react';
import { useAppState, createComponentLogger } from '@karios-monorepo/shared-state';
import Modal from '../../shared-state/src/widgets/Modal';

interface User {
  username: string;
}

interface DeactivateUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function DeactivateUserModal({
  isOpen,
  user,
  onClose,
  onRefresh,
}: DeactivateUserModalProps) {
  const logger = createComponentLogger('DeactivateUserModal');
  const { toggleUserActiveStatus } = useAppState();
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handleClose = (): void => {
    if (isDeactivating) return;
    onClose();
  };

  const handleConfirm = async (): Promise<void> => {
    if (!user) return;
    setIsDeactivating(true);
    try {
      await toggleUserActiveStatus(user.username, false);
      onRefresh();
      onClose();
    } catch (error) {
      logger.error('Error deactivating user', { username: user.username, error: error.message });
      alert('Failed to deactivate user. Please try again.');
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Deactivate User" width="400px">
      <div>
        <p className="text-sm text-gray-700 mb-4">
          Are you sure you want to deactivate{' '}
          <span className="font-semibold">{user?.username}</span>? They will no longer be able to
          log in.
        </p>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeactivating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeactivating}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDeactivating ? 'Deactivating...' : 'Deactivate'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
