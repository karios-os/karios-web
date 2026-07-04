import React, { useState } from 'react';

interface CreateDatasetProps {
  poolName: string;
  datasetName: string;
  setDatasetName: (name: string) => void;
  datasetEncryption: boolean;
  setDatasetEncryption: (encryption: boolean) => void;
  datasetPassphrase: string;
  setDatasetPassphrase: (passphrase: string) => void;
  createDataset: (poolName: string) => void;
  setCreatingDataset: (value: string | null) => void;
}

const CreateDataset: React.FC<CreateDatasetProps> = ({
  poolName,
  datasetName,
  setDatasetName,
  datasetEncryption = false,
  setDatasetEncryption = () => {},
  datasetPassphrase = '',
  setDatasetPassphrase = () => {},
  createDataset,
  setCreatingDataset,
}) => {
  // Local state as fallback if props don't work
  const [localEncryption, setLocalEncryption] = useState(false);
  const [localPassphrase, setLocalPassphrase] = useState('');
  const [passphraseError, setPassphraseError] = useState('');

  // For now, let's force using local state to ensure it works
  const actualEncryption = localEncryption;
  const actualPassphrase = localPassphrase;

  const handleEncryptionChange = (checked: boolean) => {
    setLocalEncryption(checked);
    // Also update the parent context if the setter exists
    if (typeof setDatasetEncryption === 'function') {
      setDatasetEncryption(checked);
    }
  };

  const handlePassphraseChange = (value: string) => {
    setLocalPassphrase(value);

    // Clear any existing error when user is typing
    setPassphraseError('');

    // Also update the parent context if the setter exists
    if (typeof setDatasetPassphrase === 'function') {
      setDatasetPassphrase(value);
    }
  };
  const isValidZfsName = (name: string): boolean => {
    const trimmed = name.trim();
    const regex = /^[a-zA-Z][a-zA-Z0-9_.\-/]*$/; // Allows "/", but not "'"
    return regex.test(trimmed);
  };

  const handleCreate = () => {
    const trimmedName = datasetName.trim();
    if (!isValidZfsName(trimmedName)) {
      alert(
        'Invalid dataset name.\n\nRules:\n- Must begin with a letter\n- Only letters, numbers, dashes (-), underscores (_), dots (.), or slashes (/) are allowed'
      );
      return;
    }

    // Validate encryption passphrase if encryption is enabled
    if (actualEncryption && (!actualPassphrase || actualPassphrase.length < 8)) {
      setPassphraseError('Passphrase must be at least 8 characters long');
      return;
    }

    createDataset(poolName);
  };

  return (
    <div className="mt-2 bg-gray-100 p-2 sm:p-4 rounded relative w-full mx-auto">
      {/* Acknowledgment Message */}
      <div className="text-xs sm:text-sm text-gray-700 mb-2 bg-white p-2 sm:p-3 rounded shadow-sm border border-gray-200 relative">
        {/* Close Button */}
        <button
          className="bg-red-700 text-white px-2 py-1 rounded absolute top-2 right-2"
          onClick={() => setCreatingDataset(null)}
        >
          ✖
        </button>
        <p className="mb-1">
          <strong>Note:</strong> You can organize your ZFS datasets within directories by specifying
          a relative path after the pool name.
        </p>
        <p className="mb-1">
          For example, to create a dataset under <code>zroot/vm/</code>, enter the name as:
        </p>
        <p className="font-mono text-xs sm:text-sm text-blue-600 ml-2">vm/mydataset</p>
        <p className="mt-2">
          This will create the full dataset path as <code>zroot/vm/mydataset</code>.
        </p>
      </div>

      {/* Input Field */}
      <div className="flex flex-col gap-3 w-full">
        {/* Dataset Name Input */}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <input
            type="text"
            placeholder="Dataset Name"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            className="w-full px-2 py-1 border rounded"
          />
        </div>

        {/* Encryption Section */}
        <div className="flex flex-col gap-2 bg-white p-3 rounded border border-gray-200">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="encryption-toggle"
              checked={actualEncryption}
              onChange={(e) => {
                handleEncryptionChange(e.target.checked);
              }}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="encryption-toggle" className="text-sm font-medium text-gray-700">
              Enable Encryption
            </label>
          </div>

          {actualEncryption && (
            <div className="mt-2">
              <input
                type="password"
                placeholder="Enter passphrase (minimum 8 characters)"
                value={actualPassphrase}
                onChange={(e) => handlePassphraseChange(e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm"
                minLength={8}
              />
              {passphraseError && (
                <div className="mt-1 text-red-600 text-xs">{passphraseError}</div>
              )}
            </div>
          )}
        </div>

        {/* Create Button */}
        <button
          className="px-3 py-2 bg-karios-green text-white rounded hover:bg-green-700 w-full sm:w-auto"
          onClick={handleCreate}
        >
          Create
        </button>
      </div>
    </div>
  );
};

export default CreateDataset;
