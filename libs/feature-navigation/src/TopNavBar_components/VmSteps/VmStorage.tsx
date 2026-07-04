import React from 'react';
import { useNavigate } from 'react-router-dom';
import { VmStorageProps, StoragePool } from './vm-types';

export default function VmStorage({
  selectedPool,
  setSelectedPool,
  disk0Size,
  handleDiskSizeChange,
  pools,
}: Omit<VmStorageProps, 'permissions'>): React.ReactElement {
  const navigate = useNavigate();
  const [diskInput, setDiskInput] = React.useState<string>(disk0Size?.toString() || '');

  // Sync local state when prop changes
  React.useEffect(() => {
    setDiskInput(disk0Size?.toString() || '');
  }, [disk0Size]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDiskInput(val);

    if (val === '') {
      handleDiskSizeChange(undefined);
    } else {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) {
        handleDiskSizeChange(parsed);
      }
    }
  };

  const handleBlur = () => {
    const parsed = parseInt(diskInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      // Reset to minimum valid value on blur if invalid
      setDiskInput('20');
      handleDiskSizeChange(20);
    }
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold mb-4">Storage</h2>
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>
        <div className="mb-4">
          <label htmlFor="zpool" className="block mb-2">
            ZPool:
          </label>
          <select
            id="zpool"
            value={selectedPool}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPool(e.target.value)}
            className="w-full p-2 border rounded-md"
          >
            <option value="">Select ZPool</option>
            {pools.map((pool: StoragePool, index: number) => (
              <option key={index} value={pool.name || pool.NAME}>
                {pool.name || pool.NAME} (Free: {pool.available || pool.free || pool.FREE})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label htmlFor="diskSize" className="block mb-2">
            Disk Size (GB): <span className="text-red-500">*</span>
          </label>
          <input
            id="diskSize"
            type="number"
            value={diskInput}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className="w-full p-2 border rounded-md"
            required
            min="1"
          />
        </div>
      </div>
    </>
  );
}
