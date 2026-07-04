import React, { useState } from 'react';
import api from '../../../shared-state/src/utils/interceptor';
import { useAppState, createComponentLogger } from '@karios-monorepo/shared-state';
import envConfig from '../../../../runtime-config';

const logger = createComponentLogger('CreateZvol');

// Define interfaces for types
interface Pool {
  NAME: string;
  FREE: string;
}

interface Zvol {
  name: string;
}

interface CreateZvolProps {
  pool: Pool;
  zvolName: string;
  setZvolName: (name: string) => void;
  zvolSize: any;
  setZvolSize: (size: any) => void;
  createZvol: (name: string, size: string) => Promise<any>;
  setZvolPool: (pool: Pool | null) => void;
  creatingZvol: boolean;
}

const CreateZvol: React.FC<CreateZvolProps> = ({
  pool,
  zvolName,
  setZvolName,
  zvolSize,
  setZvolSize,
  createZvol,
  setZvolPool,
  creatingZvol,
}) => {
  const [sizeUnit, setSizeUnit] = useState<string>('GB');
  const numberRegex = /^\d*\.?\d*$/;

  const { state } = useAppState();
  const { selectedServer } = state;

  const handleSizeChange = (value: string): void => {
    const formatted = value.replace(/[^0-9.]/g, '');
    if (formatted === '' || numberRegex.test(formatted)) {
      setZvolSize(formatted);
    }
  };

  const convertToGB = (value: string, unit: string): number => {
    const size = parseFloat(value);
    switch (unit.toUpperCase()) {
      case 'TB':
        return size * 1024;
      case 'MB':
        return size / 1024;
      case 'GB':
      default:
        return size;
    }
  };

  const isValidZfsName = (name: string): boolean => {
    const regex = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;
    return regex.test(name);
  };

  const handleCreate = async () => {
    const trimmedName = zvolName.trim();

    if (!trimmedName || !isValidZfsName(trimmedName)) {
      alert(
        'Invalid Zvol name.\n\nMust start with a letter and can only contain letters, numbers, dashes (-), underscores (_), or dots (.)'
      );
      return;
    }

    if (!zvolSize || parseFloat(zvolSize) <= 0) {
      alert('Zvol size must be greater than 0.');
      return;
    }

    try {
      const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/list?pool=${pool.NAME}&type=volume`
      );
      const existingZvols = await response.json();

      // Check if ZVOL name already exists
      const nameExists = existingZvols.some((z: Zvol) => z.name.split('/').pop() === trimmedName);

      if (nameExists) {
        alert('Zvol name already exists in this pool.');
        return;
      }

      // Parse pool free space for size validation
      const poolFreeMatch = pool.FREE.match(/^([\d.]+)([A-Za-z]+)$/);
      if (!poolFreeMatch) throw new Error('Invalid pool FREE format');

      const [, freeSize, freeUnit] = poolFreeMatch;
      const availableGB = convertToGB(freeSize, freeUnit);
      const requestedGB = convertToGB(zvolSize, sizeUnit);

      if (requestedGB > availableGB) {
        alert(`Requested size exceeds available space (${pool.FREE})`);
        return;
      }

      // Call the create function with properly formatted size
      const result = await createZvol(trimmedName, `${parseFloat(zvolSize)}${sizeUnit}`);

      if (result) {
        // Reset the form fields on successful creation
        setZvolName('');
        setZvolSize('1');
      }
    } catch (err) {
      logger.error('Zvol creation error:', err);
      alert('An error occurred while validating or creating the zvol.');
    }
  };

  return (
    <>
      <div className="mt-2 bg-white border border-gray-200 p-2 sm:p-4 rounded relative w-full mx-auto">
        <input
          type="text"
          placeholder="Zvol Name"
          value={zvolName}
          onChange={(e) => setZvolName(e.target.value)}
          className="w-full px-2 py-1 border border-gray-200 rounded mb-2"
        />
        <div className="flex flex-col sm:flex-row gap-2 mb-2 w-full">
          <input
            type="text"
            placeholder="Size"
            value={zvolSize}
            onChange={(e) => handleSizeChange(e.target.value)}
            className="flex-1 px-2 py-1 border border-gray-200 rounded"
          />
          <select
            value={sizeUnit}
            onChange={(e) => setSizeUnit(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded"
          >
            <option value="GB">GB</option>
            <option value="TB">TB</option>
            <option value="MB">MB</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2 w-full">
          <button
            className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 w-full sm:w-auto"
            onClick={handleCreate}
            disabled={creatingZvol}
          >
            {creatingZvol ? 'Creating...' : 'Create Zvol'}
          </button>
          <button
            className="bg-red-700 text-white px-2 py-1 rounded w-full sm:w-auto"
            onClick={() => setZvolPool(null)}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

export default CreateZvol;
