import React, { useState, useEffect } from 'react';
import { useAppState, createComponentLogger } from '@karios-monorepo/shared-state';
import api from '../../../shared-state/src/utils/interceptor';
import envConfig from '../../../../runtime-config';
import Modal from '../../../shared-state/src/widgets/Modal';

const logger = createComponentLogger('CreateZpool');

interface Disk {
  name: string;
  mediasize: string;
  [key: string]: any;
}

interface ExistingPool {
  NAME: string;
  [key: string]: any;
}

interface CreateZPoolProps {
  existingPools: ExistingPool[];
  setCreatingZpool: (value: boolean) => void;
  fetchAvailableDisks: () => void;
  fetchStoragePools: () => void;
}

type RaidType = 'raidz1' | 'raidz2' | 'raidz3' | 'mirror' | 'striped';

const CreateZPool: React.FC<CreateZPoolProps> = ({
  existingPools,
  setCreatingZpool,
  fetchAvailableDisks,
  fetchStoragePools,
}) => {
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<RaidType>('raidz1');
  const [availableDisks, setAvailableDisks] = useState<Disk[]>([]);
  const [selectedDisks, setSelectedDisks] = useState<string[]>([]);

  // Modal state for data destruction warning
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingCreation, setPendingCreation] = useState<{
    name: string;
    disks: string[];
    type: RaidType;
  } | null>(null);

  // State for showing on-screen message
  const [showMessage, setShowMessage] = useState(false);
  const [messageInfo, setMessageInfo] = useState<{ description: string } | null>(null);

  const { state } = useAppState();
  const { selectedServer } = state;

  const raidTypes: Record<RaidType, number> = {
    raidz1: 2,
    raidz2: 3,
    raidz3: 4,
    mirror: 2,
    striped: 1,
  };

  useEffect(() => {
    const fetchDisks = async () => {
      try {
        const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/available_disks`
        );
        const data = await response.json();
        setAvailableDisks(data.available);
      } catch (error) {
        logger.error('Failed to fetch available disks', error);
      }
    };
    fetchDisks();
  }, [selectedServer?.fqdn, selectedServer?.ip]);

  // Auto-select valid RAID type based on available disks
  useEffect(() => {
    const validRaidTypes = Object.keys(raidTypes).filter(
      (raid) => raidTypes[raid as RaidType] <= availableDisks.length
    ) as RaidType[];

    if (validRaidTypes.length > 0 && !validRaidTypes.includes(type)) {
      setType(validRaidTypes[0]);
    }
  }, [availableDisks.length, type]);

  const handleDiskSelection = (diskName: string) => {
    setSelectedDisks((prev) =>
      prev.includes(diskName) ? prev.filter((d) => d !== diskName) : [...prev, diskName]
    );
  };

  const hasDifferentDiskSizes = (disks: Disk[]): boolean => {
    if (disks.length <= 1) return false;
    const firstDiskSize = disks[0].mediasize;
    return disks.some((disk: Disk) => disk.mediasize !== firstDiskSize);
  };

  const isValidZfsName = (value: string): boolean => {
    const regex = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;
    return regex.test(value.trim());
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();

    // Check if there are no available disks
    if (availableDisks.length === 0) {
      setMessageInfo({
        description:
          'No disks available for ZPool creation. Please ensure there are unused disks available on the system.',
      });
      setShowMessage(true);
      // Auto-hide message after 5 seconds
      setTimeout(() => setShowMessage(false), 5000);
      return;
    }

    if (!trimmedName) {
      setMessageInfo({
        description: 'Please enter a pool name before creating the ZPool.',
      });
      setShowMessage(true);
      // Auto-hide message after 5 seconds
      setTimeout(() => setShowMessage(false), 5000);
      return;
    }

    if (!isValidZfsName(trimmedName)) {
      alert(
        'Invalid pool name.\n\nAllowed format:\n- Must begin with a letter\n- Only letters, numbers, dashes (-), underscores (_), or dots (.) are allowed'
      );
      return;
    }

    if (Object.keys(raidTypes).includes(trimmedName.toLowerCase())) {
      alert('Pool name cannot match a RAID type. Choose a unique name.');
      return;
    }

    const normalizedExisting = Array.isArray(existingPools)
      ? existingPools
          .filter((pool) => typeof pool.NAME === 'string')
          .map((pool) => pool.NAME.toLowerCase().trim())
      : [];

    if (normalizedExisting.includes(trimmedName.toLowerCase())) {
      alert('Pool name already exists. Choose a different name.');
      return;
    }

    if (selectedDisks.length < raidTypes[type]) {
      setMessageInfo({
        description: `Minimum required disks for ${type} is ${raidTypes[type]}. You have selected ${selectedDisks.length} disk${selectedDisks.length !== 1 ? 's' : ''}. Please select more disks.`,
      });
      setShowMessage(true);
      // Auto-hide message after 5 seconds
      setTimeout(() => setShowMessage(false), 5000);
      return;
    }

    const selectedDiskObjects = availableDisks.filter((disk) => selectedDisks.includes(disk.name));

    if (hasDifferentDiskSizes(selectedDiskObjects)) {
      const proceed = window.confirm(
        'Warning: Selected disks have different sizes. This may reduce performance. Do you want to continue?'
      );
      if (!proceed) return;
    }

    // Show data destruction warning modal
    setPendingCreation({
      name: trimmedName,
      disks: selectedDisks,
      type: type,
    });
    setShowWarningModal(true);
  };

  const handleConfirmCreation = async () => {
    if (!pendingCreation) return;

    setShowWarningModal(false);

    try {
      const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/create_pool`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: pendingCreation.name,
            disks: pendingCreation.disks,
            raid_level: pendingCreation.type,
            Type: pendingCreation.type, // Adding the required 'Type' field that the API expects
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error?.includes('pool already exists')) {
          alert('Pool name already exists. Choose a different name.');
        } else if (errorData.error?.includes('pool name may have been omitted')) {
          alert('Pool name cannot be the same as a RAID type. Please choose a unique name.');
        } else {
          alert(errorData?.error || 'Bad Request: Please check your input.');
        }
        return;
      }

      alert('ZPool created successfully!');
      fetchAvailableDisks();
      fetchStoragePools();
      setCreatingZpool(false);
    } catch (error) {
      logger.error('ZPool creation failed', error);
      alert('An unexpected error occurred while creating the ZPool.');
    } finally {
      setPendingCreation(null);
    }
  };

  const handleCancelCreation = () => {
    setShowWarningModal(false);
    setPendingCreation(null);
  };

  return (
    <>
      <div className="p-2 sm:p-4 border border-gray-200 rounded-lg bg-white w-full mx-auto" data-testid="create-zpool-form">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
          <h2 className="text-base sm:text-lg font-bold">Create ZPool</h2>
          <button
            className="bg-red-700 text-white px-2 py-1 rounded mt-2 sm:mt-0"
            onClick={() => setCreatingZpool(false)}
          >
            Close
          </button>
        </div>

        <div className="flex flex-col sm:flex-row justify-start items-center sm:space-x-2 mb-4 gap-2 w-full">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter pool name"
            className="border border-gray-200 p-2 rounded w-full sm:w-60"
            data-testid="zpool-name-input"
          />
          <button
            onClick={handleSubmit}
            disabled={availableDisks.length === 0}
            className={`p-2 rounded w-full sm:w-auto mt-2 sm:mt-0 ${
              availableDisks.length === 0
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-karios-blue text-white hover:bg-blue-600'
            }`}
            data-testid="create-zpool-button"
          >
            {availableDisks.length === 0 ? 'No Disks Available' : 'Create ZPool'}
          </button>
        </div>

        {/* Simple message below input */}
        {showMessage && messageInfo && (
          <div className="mb-4">
            <p className="text-red-600 text-sm">{messageInfo.description}</p>
          </div>
        )}

        <div className="mb-4">
          <h3 className="font-semibold mb-2">Select RAID Type:</h3>
          <div className="flex flex-wrap items-center gap-4">
            {Object.keys(raidTypes)
              .filter((raid) => raidTypes[raid as RaidType] <= availableDisks.length)
              .map((raid) => (
                <label key={raid} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="raidType"
                    value={raid}
                    checked={type === raid}
                    onChange={(e) => setType(e.target.value as RaidType)}
                  />
                  <span className="text-black">{raid}</span>
                </label>
              ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="font-semibold">Available Disks:</h3>
            {availableDisks.length === 0 && (
              <div className="relative group">
                <div className="flex items-center justify-center w-4 h-4 bg-blue-100 text-blue-600 rounded-full text-xs font-bold cursor-help">
                  i
                </div>
                <div className="absolute left-6 top-0 bg-gray-800 text-white text-sm px-3 py-2 rounded shadow-lg z-10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  No disks are available
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-800"></div>
                </div>
              </div>
            )}
          </div>
          {availableDisks.length === 0 ? (
            <div className="text-gray-500 text-sm bg-gray-50 p-3 rounded border">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-100 text-yellow-600 rounded-full text-xs font-bold flex items-center justify-center">
                  !
                </div>
                <span className="font-medium">No disks available for ZPool creation</span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                Please ensure there are unused disks available on the system that are not already
                part of existing storage pools.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableDisks.map((disk) => (
                <label key={disk.name} className="flex items-center space-x-2 mb-1">
                  <input
                    type="checkbox"
                    value={disk.name}
                    checked={selectedDisks.includes(disk.name)}
                    onChange={() => handleDiskSelection(disk.name)}
                  />
                  <span>
                    {disk.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Data Destruction Warning Modal */}
      <Modal
        isOpen={showWarningModal}
        onClose={handleCancelCreation}
        title={<span className="text-red-600 font-bold">Create ZFS Pool</span>}
        width="500px"
      >
        <div className="space-y-4">
          <div className="text-gray-700">
            <p className="text-sm mb-4">
              Warning: Creating ZFS pool &quot;{pendingCreation?.name}&quot; will destroy all
              existing data on the following disk{pendingCreation?.disks.length > 1 ? 's' : ''}:
            </p>

            <div className="bg-gray-100 p-3 rounded mb-4">
              <ul className="text-sm space-y-1">
                {pendingCreation?.disks.map((disk, index) => (
                  <li key={index}>{disk}</li>
                ))}
              </ul>
            </div>

            <p className="text-sm">
              This action cannot be undone. Are you sure you want to continue?
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={handleCancelCreation}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmCreation}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium text-sm"
            >
              Yes, Create Pool
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CreateZPool;
