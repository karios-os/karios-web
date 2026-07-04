import React, { useState, useEffect, useRef } from 'react';
import api from '../../../shared-state/src/utils/interceptor';
import { useAppState, createComponentLogger } from '@karios-monorepo/shared-state';
import envConfig from '../../../../runtime-config';

interface StoragePool {
  NAME: string;
  [key: string]: any;
}

interface ZfsDataset {
  name: string;
  used: string;
  avail: string;
  mount: string;
  [key: string]: any;
}

interface CreateDatastoreProps {
  storagePools: StoragePool[];
  onClose: () => void;
  fetchDatastores: () => void;
  selectedServer?: any;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

const CreateDatastore: React.FC<CreateDatastoreProps> = ({
  storagePools,
  onClose,
  fetchDatastores,
  onError,
  onSuccess,
}) => {
  const logger = createComponentLogger('CreateDatastore');
  const [datastoreName, setDatastoreName] = useState('');
  const [selectedPool, setSelectedPool] = useState(storagePools[0]?.NAME || '');
  const [datasetsList, setDatasetsList] = useState<ZfsDataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [datasetsFetched, setDatasetsFetched] = useState(false);
  const [showDatasetDropdown, setShowDatasetDropdown] = useState(false);
  const datasetsRef = useRef<ZfsDataset[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { state, fetchZfsDatasetWrapper } = useAppState();
  const { selectedServer } = state;

  // Fetch datasets only when dropdown is opened
  const handleDatasetDropdownOpen = async () => {
    setShowDatasetDropdown(true);

    if (datasetsFetched || isLoadingDatasets || !selectedPool) {
      return;
    }

    try {
      setIsLoadingDatasets(true);
      const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
      const data = await fetchZfsDatasetWrapper(serverAddress, selectedPool);
      logger.info('Datasets fetched:', data);
      setDatasetsList(data || []);
      datasetsRef.current = data || [];
      setDatasetsFetched(true);
    } catch (error) {
      logger.error('Error fetching datasets:', error);
      setDatasetsList([]);
    } finally {
      setIsLoadingDatasets(false);
    }
  };

  // Handle dataset selection
  const handleSelectDataset = (datasetName: string) => {
    setSelectedDataset(datasetName);
    setShowDatasetDropdown(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDatasetDropdown(false);
      }
    };

    if (showDatasetDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [showDatasetDropdown]);

  // Reset datasets when pool changes
  const handlePoolChange = (e: any) => {
    setSelectedPool(e.target.value);
    setDatasetsList([]);
    setSelectedDataset('');
    setDatasetsFetched(false);
    setShowDatasetDropdown(false);
    datasetsRef.current = [];
  };

  const isValidZfsName = (name: string): boolean => {
    const regex = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;
    return regex.test(name.trim());
  };

  const handleCreateDatastore = async () => {
    const trimmedName = datastoreName.trim();

    if (!trimmedName) {
      alert('Please fill datastore name.');
      return;
    }

    if (!isValidZfsName(trimmedName)) {
      alert(
        'Invalid datastore name.\n\nRules:\n- Must begin with a letter\n- Only letters, numbers, dashes (-), underscores (_), or dots (.) are allowed'
      );
      return;
    }

    if (!selectedPool) {
      alert('Please select a storage pool.');
      return;
    }

    if (!selectedDataset) {
      alert('Please select a ZFS dataset.');
      return;
    }

    const existingDatastores = storagePools.map((pool: StoragePool) => pool.NAME);
    if (existingDatastores.includes(trimmedName)) {
      alert('Datastore name already exists. Please choose a different name.');
      return;
    }

    // Get the selected dataset to extract mount path
    const dataset = datasetsList.find((d) => d.name === selectedDataset);
    if (!dataset) {
      alert('Invalid dataset selection.');
      return;
    }

    const requestBody = {
      name: trimmedName,
      datastore_type: 'zfs',
      datastore_path: dataset.mount,
    };

    try {
      const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/datastores/add`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || 'Bad Request: Please check your input.');
      }

      alert('Datastore created successfully!');
      fetchDatastores(); // Fetch updated datastores after creation
      setDatastoreName(''); // Clear the input field
      onClose();
    } catch (error: any) {
      logger.error('Datastore creation failed', error);
      alert(error.message || 'An error occurred while creating the datastore.');
    }
  };

  return (
    <>
      <div className="p-2 sm:p-4 border border-gray-200 rounded-lg bg-white w-full mx-auto" data-testid="create-datastore-form">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
          <h2 className="text-base sm:text-lg font-bold">Create Datastore</h2>
          <button
            className="bg-red-700 text-white px-1 py-1 rounded mt-2 sm:mt-0"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <input
          type="text"
          value={datastoreName}
          onChange={(e) => setDatastoreName(e.target.value)}
          placeholder="Enter datastore name"
          className="border border-gray-200 p-2 w-full mb-4"
          data-testid="datastore-name-input"
        />
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Select Pool:</h3>
          <select
            value={selectedPool}
            onChange={handlePoolChange}
            className="border border-gray-200 p-2 w-full bg-white text-black"
            data-testid="datastore-pool-select"
          >
            {storagePools.map((pool: StoragePool) => (
              <option key={pool.NAME} value={pool.NAME}>
                {pool.NAME}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Select Dataset:</h3>
          <div ref={dropdownRef} className="relative">
            <button
              onClick={handleDatasetDropdownOpen}
              disabled={!selectedPool}
              className="border border-gray-200 p-2 w-full bg-white text-black text-left disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50 flex justify-between items-center"
              data-testid="datastore-dataset-dropdown"
            >
              <span>
                {selectedDataset ||
                  (isLoadingDatasets ? 'Loading datasets...' : 'Choose a dataset')}
              </span>
              <span>▼</span>
            </button>

            {showDatasetDropdown && selectedPool && (
              <div
                className="absolute top-full left-0 right-0 mt-1 border border-gray-200 bg-white shadow-lg z-50"
                style={{ maxHeight: '400px', overflowY: 'auto' }}
              >
                {isLoadingDatasets ? (
                  <div className="p-3 text-gray-500 text-center">Loading datasets...</div>
                ) : datasetsList.length === 0 ? (
                  <div className="p-3 text-gray-500 text-center">No datasets found</div>
                ) : (
                  <ul>
                    {datasetsList.map((dataset: ZfsDataset) => (
                      <li
                        key={dataset.name}
                        onClick={() => handleSelectDataset(dataset.name)}
                        className="p-3 cursor-pointer hover:bg-blue-100 border-b border-gray-100 text-sm"
                      >
                        <div className="text-black">
                          {dataset.name} (Used: {dataset.used}, Available: {dataset.avail})
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleCreateDatastore}
          className="bg-karios-blue text-white p-2 rounded hover:bg-blue-600 w-full"
          data-testid="create-datastore-button"
        >
          Create Datastore
        </button>
      </div>
    </>
  );
};

export default CreateDatastore;
