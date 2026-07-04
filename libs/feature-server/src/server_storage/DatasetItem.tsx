import React, { useState } from 'react';
import { useServer, useStorage, api, createComponentLogger } from '@karios-monorepo/shared-state';
import { useApprovalFlow } from '../../../shared-state/src/hooks/useApprovalFlow';
import ApprovalModal from '../../../shared-state/src/components/ApprovalModal';
import { Trash, Gallery, Lock, Unlock, Key } from 'iconsax-react';
import Modal from '../../../shared-state/src/widgets/Modal';
import envConfig from '../../../../runtime-config';

const DatasetItem = ({ dataset, poolName, selectedDatasetType }) => {
  const logger = createComponentLogger('DatasetItem');
  const [snapshotName, setSnapshotName] = useState('');
  const [isSnapshoting, setIsSnapshoting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [showUnloadKeyModal, setShowUnloadKeyModal] = useState(false);
  const [unloadKeyDatasetName, setUnloadKeyDatasetName] = useState('');
  const [unloadKeyZpoolName, setUnloadKeyZpoolName] = useState('');
  const [isUnloadingKey, setIsUnloadingKey] = useState(false);
  const [showLoadKeyModal, setShowLoadKeyModal] = useState(false);
  const [loadKeyDatasetName, setLoadKeyDatasetName] = useState('');
  const [loadKeyZpoolName, setLoadKeyZpoolName] = useState('');
  const [loadKeyPassphrase, setLoadKeyPassphrase] = useState('');
  const [isLoadingKey, setIsLoadingKey] = useState(false);

  const { selectedServer } = useServer();
  const {
    deduplicationStatus,
    isTogglingDeduplication,
    compressionStatus,
    isTogglingCompression,
    handleDeduplicationToggle,
    handleCompressionToggle,
    deleteDataset,
    takeZfsSnapshot,
    unloadDatasetKey,
    loadDatasetKey,
  } = useStorage();

  // Approval flow hook for dataset deletion
  const datasetDeletionApprovalFlow = useApprovalFlow({
    title: 'Dataset/ZVOL Deletion Approval Required',
    message:
      'This dataset or ZVOL deletion requires approval. Please select an approver from the list below.',
  });

  const takeSnapshot = async () => {
    if (!snapshotName.trim()) {
      alert('Please enter a snapshot name');
      return;
    }

    try {
      setIsSnapshoting(true);
      const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
      await takeZfsSnapshot(serverAddress, dataset.name, snapshotName);
      setSnapshotName('');
      alert('Snapshot created successfully');
    } catch (err) {
      logger.error('Snapshot creation failed', err);
      alert(err.message || 'Failed to create snapshot. Please try again.');
    } finally {
      setIsSnapshoting(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteModal(true);
    setConfirmationText(''); // Reset confirmation text when opening modal
  };

  const handleUnloadKey = () => {
    setShowUnloadKeyModal(true);
    // Auto-populate with current dataset information
    setUnloadKeyDatasetName(dataset.name);
    setUnloadKeyZpoolName(poolName);
  };

  const handleLoadKey = () => {
    setShowLoadKeyModal(true);
    // Auto-populate with current dataset information
    setLoadKeyDatasetName(dataset.name);
    setLoadKeyZpoolName(poolName);
    setLoadKeyPassphrase('');
  };

  const confirmUnloadKey = async () => {
    // Dataset name and zpool name are pre-populated, so no validation needed
    try {
      setIsUnloadingKey(true);
      setShowUnloadKeyModal(false);

      const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
      await unloadDatasetKey(serverAddress, unloadKeyDatasetName, unloadKeyZpoolName);
    } catch (err) {
      logger.error('Dataset key unload failed', err);
      alert(err.message || 'Failed to unload dataset key. Please try again.');
    } finally {
      setIsUnloadingKey(false);
    }
  };

  const confirmLoadKey = async () => {
    // Only validate passphrase since dataset name and zpool name are pre-populated
    if (!loadKeyPassphrase.trim()) {
      alert('Please enter a passphrase.');
      return;
    }

    try {
      setIsLoadingKey(true);
      setShowLoadKeyModal(false);

      const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
      await loadDatasetKey(serverAddress, loadKeyDatasetName, loadKeyZpoolName, loadKeyPassphrase);
    } catch (err) {
      logger.error('Dataset key load failed', err);
      alert(err.message || 'Failed to load dataset key. Please try again.');
    } finally {
      setIsLoadingKey(false);
    }
  };

  const confirmDelete = async () => {
    const performDeletion = async (approver?: string) => {
      try {
        setIsDeleting(true);
        setShowDeleteModal(false);

        if (approver) {
          // Call API directly when approver is provided
          const requestBody = {
            dataset_name: dataset.name,
            pool_name: poolName,
          };

          const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
          let url = `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/destroy_dataset`;
          url += `?approver=${encodeURIComponent(approver)}`;

          const response = await api.fetch(url, {
            method: 'DELETE',
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData?.error || 'Failed to delete dataset');
          }
        } else {
          // Use the existing deleteDataset function when no approver is needed
          const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
          await deleteDataset(serverAddress, poolName, dataset.name);
        }
      } catch (err) {
        logger.error('Dataset deletion failed', err);
        alert(err.message || 'Failed to delete dataset. Please try again.');
      } finally {
        setIsDeleting(false);
      }
    };

    // Use approval flow if user requires approval
    if (datasetDeletionApprovalFlow.requiresApproval) {
      await datasetDeletionApprovalFlow.executeWithApproval(performDeletion, 'Delete Dataset/ZVOL');
    } else {
      await performDeletion();
    }
  };

  const getLockIcon = (keystatus: string | null | undefined) => {
    if (!keystatus) return null;

    return keystatus === 'available' ? (
      <Unlock size={16} color="#10b981" />
    ) : (
      <Lock size={16} color="#dc2626" />
    );
  };

  return (
    <>
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="⚠️ Critical Warning"
        width="500px"
      >
        <div className="mb-4">
          <p className="text-gray-700 mb-4">
            Deleting your root ZFS volume will render the system inoperable. This operation cannot
            be reversed. Are you absolutely sure?
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Dataset: <span className="font-mono font-bold">{dataset.name}</span>
          </p>
          <p className="text-sm text-gray-700 mb-2">
            Type the name of the dataset in the text box to complete the deletion:
          </p>
          <input
            type="text"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder={dataset.name}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-red-500 font-mono"
            disabled={isDeleting}
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowDeleteModal(false)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            disabled={isDeleting || confirmationText !== dataset.name}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showUnloadKeyModal}
        onClose={() => setShowUnloadKeyModal(false)}
        title="Unload Dataset Key"
        width="500px"
      >
        <div className="mb-4">
          <p className="text-gray-700 mb-4">
            Unloading the dataset key will unmount the dataset and make it inaccessible until the
            key is loaded again.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            This action will be performed on the selected dataset:
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Dataset Name:</label>
              <input
                type="text"
                value={unloadKeyDatasetName}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-gray-700 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Zpool Name:</label>
              <input
                type="text"
                value={unloadKeyZpoolName}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-gray-700 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowUnloadKeyModal(false)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            disabled={isUnloadingKey}
          >
            Cancel
          </button>
          <button
            onClick={confirmUnloadKey}
            disabled={isUnloadingKey}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUnloadingKey ? 'Unloading...' : 'Unload Key'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showLoadKeyModal}
        onClose={() => setShowLoadKeyModal(false)}
        title="Load Dataset Key"
        width="500px"
      >
        <div className="mb-4">
          <p className="text-gray-700 mb-4">
            Loading the dataset key will mount the dataset and make it accessible again.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            This action will be performed on the selected dataset. Please enter the passphrase:
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Dataset Name:</label>
              <input
                type="text"
                value={loadKeyDatasetName}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-gray-700 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Zpool Name:</label>
              <input
                type="text"
                value={loadKeyZpoolName}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-gray-700 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Passphrase:</label>
              <input
                type="password"
                value={loadKeyPassphrase}
                onChange={(e) => setLoadKeyPassphrase(e.target.value)}
                placeholder="Enter passphrase (min 8 characters)"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                disabled={isLoadingKey}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowLoadKeyModal(false)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            disabled={isLoadingKey}
          >
            Cancel
          </button>
          <button
            onClick={confirmLoadKey}
            disabled={isLoadingKey || !loadKeyPassphrase.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingKey ? 'Loading...' : 'Load Key'}
          </button>
        </div>
      </Modal>

      <div className="flex flex-col sm:flex-row justify-between border border-gray-100 p-3 sm:p-4 rounded-2xl mb-1 relative mt-5 gap-2 sm:gap-0">
        {/* Dataset Info */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base sm:text-lg break-all">{dataset.name}</p>
          <p className="text-xs sm:text-md text-gray-500 max-w-full sm:w-[400px] truncate">
            Used: {dataset.used} | Available: {dataset.avail} | Mount: {dataset.mount}
          </p>
          {selectedDatasetType !== 'snapshot' && (
            <div className="flex flex-col sm:flex-row mt-3 sm:mt-5 gap-2 sm:gap-5">
              {/* Deduplication Toggle */}
              <div className="flex items-center">
                <span className="font-medium text-md mr-2">Deduplication:</span>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={deduplicationStatus[dataset.name] || false}
                    onChange={() =>
                      handleDeduplicationToggle(
                        selectedServer?.fqdn || selectedServer?.ip,
                        dataset.name,
                        poolName
                      )
                    }
                    disabled={isTogglingDeduplication[dataset.name]}
                    className="cursor-pointer w-3 h-3"
                    data-testid="dataset-dedup-checkbox"
                  />
                  <span className="ml-2 text-md">
                    {isTogglingDeduplication[dataset.name]
                      ? '...'
                      : deduplicationStatus[dataset.name]
                        ? 'ON'
                        : 'OFF'}
                  </span>
                </label>
              </div>

              {/* Compression Toggle */}
              <div className="flex items-center gap-1">
                <span className="font-medium text-md">Compression:</span>
                {(() => {
                  // Define available compression options
                  const compressionOptions = ['lz4']; // Currently only lz4 is supported

                  // If only one option, display as text
                  if (compressionOptions.length === 1) {
                    return (
                      <span className="text-md px-1 py-0.5 border border-gray-200 rounded bg-gray-50">
                        {compressionOptions[0]}
                      </span>
                    );
                  } else {
                    // If multiple options, display as dropdown
                    return (
                      <select
                        value="lz4"
                        disabled
                        className="border border-gray-200 rounded px-1 py-0.5 text-md"
                      >
                        {compressionOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    );
                  }
                })()}
                <label className="flex items-center ml-1">
                  <input
                    type="checkbox"
                    checked={compressionStatus[dataset.name] || false}
                    onChange={() =>
                      handleCompressionToggle(
                        selectedServer?.fqdn || selectedServer?.ip,
                        dataset.name,
                        poolName
                      )
                    }
                    disabled={isTogglingCompression[dataset.name]}
                    className="cursor-pointer w-3 h-3"
                    data-testid="dataset-compression-checkbox"
                  />
                  <span className="ml-2 text-md">
                    {isTogglingCompression[dataset.name]
                      ? '...'
                      : compressionStatus[dataset.name]
                        ? 'ON'
                        : 'OFF'}
                  </span>
                </label>
              </div>

              {/* Encryption Display */}
              {dataset.encryption && dataset.encryption !== 'off' && (
                <div className="flex items-center gap-1">
                  <span className="font-medium text-md">Encryption:</span>
                  <span className="text-md px-1 py-0.5 border border-gray-200 rounded bg-gray-50">
                    {dataset.encryption}
                  </span>
                  {getLockIcon(dataset.keystatus)}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Action Buttons: Snapshot + Unload Key + Delete */}

        <div className="mt-2 w-full sm:w-auto flex flex-col sm:flex-row justify-end gap-1">
          {/* Snapshot Input + Button */}
          {selectedDatasetType !== 'snapshot' && (
            <>
              <input
                type="text"
                placeholder="Snapshot name"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                className="text-md px-1 py-0.5 border border-gray-100 rounded w-full sm:w-auto h-[38px] sm:h-[45px]"
                disabled={isSnapshoting}
                data-testid="snapshot-name-input"
              />
              <button
                onClick={takeSnapshot}
                disabled={isSnapshoting}
                className="flex items-center bg-lime-500 text-white text-md px-2 py-0.5 h-[38px] sm:h-[45px] rounded disabled:opacity-50"
                data-testid="create-snapshot-button"
              >
                <Gallery size={24} color="#FFFFFF" />
              </button>
            </>
          )}

          {/* Load/Unload Key Buttons - Only show for encrypted datasets */}
          {dataset.encryption && dataset.encryption !== 'off' && (
            <>
              {/* Show Load Key button if key is not available (red lock) */}
              {(!dataset.keystatus ||
                dataset.keystatus === 'unavailable' ||
                dataset.keystatus === '-' ||
                dataset.keystatus === 'null' ||
                dataset.keystatus === '') && (
                <button
                  onClick={selectedDatasetType === 'snapshot' ? undefined : handleLoadKey}
                  disabled={isLoadingKey || selectedDatasetType === 'snapshot'}
                  className={`flex items-center px-2 py-2 h-[38px] sm:h-[45px] bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 ${selectedDatasetType === 'snapshot' ? 'cursor-not-allowed' : ''}`}
                  title={
                    selectedDatasetType === 'snapshot'
                      ? 'You can not load or unload keys in the snapshot datasets'
                      : 'Load encryption key'
                  }
                >
                  <Unlock size={24} color="#FFFFFF" />
                </button>
              )}

              {/* Show Unload Key button if key is available (green lock) */}
              {dataset.keystatus === 'available' && (
                <button
                  onClick={selectedDatasetType === 'snapshot' ? undefined : handleUnloadKey}
                  disabled={isUnloadingKey || selectedDatasetType === 'snapshot'}
                  className={`flex items-center px-2 py-2 h-[38px] sm:h-[45px] bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 ${selectedDatasetType === 'snapshot' ? 'cursor-not-allowed' : ''}`}
                  title={
                    selectedDatasetType === 'snapshot'
                      ? 'You can not load or unload keys in the snapshot datasets'
                      : 'Unload encryption key'
                  }
                >
                  <Lock size={24} color="#FFFFFF" />
                </button>
              )}
            </>
          )}

          {/* Delete Dataset Button */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-2 py-2 h-[38px] sm:h-[45px] bg-red-700 text-white rounded hover:bg-red-900 disabled:opacity-50"
            data-testid="delete-dataset-button"
          >
            <Trash size={24} color="#FFFFFF" />
          </button>
        </div>
      </div>

      {/* Dataset/ZVOL Deletion Approval Modal */}
      <ApprovalModal
        isOpen={datasetDeletionApprovalFlow.isModalOpen}
        onClose={datasetDeletionApprovalFlow.closeModal}
        approvers={datasetDeletionApprovalFlow.approvers}
        title="Approve Dataset/ZVOL Deletion"
        message={`Please approve the deletion of the dataset/ZVOL "${dataset.name}".`}
        {...datasetDeletionApprovalFlow.modalProps}
      />
    </>
  );
};

export default DatasetItem;
