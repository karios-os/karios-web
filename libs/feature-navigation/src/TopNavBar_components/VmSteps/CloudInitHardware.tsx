import React, { useState, useEffect } from 'react';

interface CloudInitHardwareProps {
  value: number;
  setValue: (value: number) => void;
  memory: number;
  setMemory: (value: number) => void;
  disk0Size: number | undefined;
  handleDiskSizeChange: (value: number | undefined) => void;
}

export default function CloudInitHardware({
  value,
  setValue,
  memory,
  setMemory,
  disk0Size,
  handleDiskSizeChange,
}: CloudInitHardwareProps): React.ReactElement {
  // Local state for input values to allow empty field during editing
  const [cpuInput, setCpuInput] = useState<string>(value.toString());
  const [memoryInput, setMemoryInput] = useState<string>(memory.toString());
  const [diskInput, setDiskInput] = useState<string>(disk0Size?.toString() || '');

  // Sync local state when props change from outside
  useEffect(() => {
    setCpuInput(value.toString());
  }, [value]);

  useEffect(() => {
    setMemoryInput(memory.toString());
  }, [memory]);

  useEffect(() => {
    setDiskInput(disk0Size?.toString() || '');
  }, [disk0Size]);

  const handleCpuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCpuInput(val);
    const parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
      setValue(parsed);
    }
  };

  const handleCpuBlur = () => {
    const parsed = parseInt(cpuInput);
    if (isNaN(parsed) || parsed < 1) {
      setCpuInput('1');
      setValue(1);
    }
  };

  const handleMemoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMemoryInput(val);
    const parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
      setMemory(parsed);
    }
  };

  const handleMemoryBlur = () => {
    const parsed = parseInt(memoryInput);
    if (isNaN(parsed) || parsed < 1) {
      setMemoryInput('1');
      setMemory(1);
    }
  };

  const handleDiskChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDiskInput(val);

    if (val === '') {
      handleDiskSizeChange(undefined); // Allow clearing
    } else {
      const parsed = parseInt(val);
      if (!isNaN(parsed)) {
        handleDiskSizeChange(parsed);
      }
    }
  };

  const handleDiskBlur = () => {
    const parsed = parseInt(diskInput);
    if (isNaN(parsed) || parsed < 1) {
      setDiskInput('20');
      handleDiskSizeChange(20);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold mb-6">Hardware Configuration</h2>

      {/* Hardware Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col">
          <label htmlFor="cpu" className="block text-sm font-medium text-gray-700 mb-2">
            CPU Cores *
          </label>
          <input
            type="number"
            id="cpu"
            value={cpuInput}
            onChange={handleCpuChange}
            onBlur={handleCpuBlur}
            min="1"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
          />
          <p className="mt-1 text-sm text-gray-600">Number of CPU cores to allocate to the VM</p>
        </div>

        <div className="flex flex-col">
          <label htmlFor="memory" className="block text-sm font-medium text-gray-700 mb-2">
            Memory (GB) *
          </label>
          <input
            type="number"
            id="memory"
            value={memoryInput}
            onChange={handleMemoryChange}
            onBlur={handleMemoryBlur}
            min="1"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
          />
          <p className="mt-1 text-sm text-gray-600">Amount of RAM in gigabytes</p>
        </div>

        <div className="flex flex-col">
          <label htmlFor="diskSize" className="block text-sm font-medium text-gray-700 mb-2">
            Disk Size (GB) *
          </label>
          <input
            type="number"
            id="diskSize"
            value={diskInput}
            onChange={handleDiskChange}
            onBlur={handleDiskBlur}
            min="1"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
          />
          <p className="mt-1 text-sm text-gray-600">Primary disk size in gigabytes</p>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Hardware Recommendations</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>• Minimum 1 CPU core and 1GB RAM for basic operation</p>
              <p>• Consider the workload requirements when sizing resources</p>
              <p>• Cloud-init VMs typically require at least 10GB disk space</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
