import React, { useEffect, useState } from 'react';
import { useAppState } from '../../../../shared-state/src/AppStateContext';

interface CloudInitBasicProps {
  vmName: string;
  handleVmNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  nameError: string;
  osType: string;
  setOsType: (value: string) => void;
  selectedServerIp: string;
  setSelectedServerIp: (value: string) => void;
  availableImages: string[];
  selectedImage: string;
  setSelectedImage: (value: string) => void;
  imagesLoading: boolean;
  // VM name validation callback
  onVmNameValidation?: (isValid: boolean, isChecking: boolean) => void;
}

export default function CloudInitBasic({
  vmName,
  handleVmNameChange,
  nameError,
  osType,
  setOsType,
  selectedServerIp,
  setSelectedServerIp,
  availableImages,
  selectedImage,
  setSelectedImage,
  imagesLoading,
  onVmNameValidation,
}: CloudInitBasicProps): React.ReactElement {
  // Get existing VM names from global state (already fetched via persistent WebSocket connections)
  const { dataCenters } = useAppState();
  const [existingVmNames, setExistingVmNames] = useState<string[]>([]);

  // Extract VM names from dataCenters (no WebSocket needed - data is already available)
  useEffect(() => {
    if (dataCenters && dataCenters.length > 0) {
      // Collect all VM names from all servers in all data centers
      const allVmNames: string[] = [];
      dataCenters.forEach((dc) => {
        if (dc.servers && Array.isArray(dc.servers)) {
          dc.servers.forEach((server) => {
            if (server.vms && Array.isArray(server.vms)) {
              server.vms.forEach((vm) => {
                if (vm.name) {
                  allVmNames.push(vm.name.toLowerCase());
                }
              });
            }
          });
        }
      });
      setExistingVmNames(allVmNames);
    }
  }, [dataCenters]);

  // Notify parent component about VM name validation state
  useEffect(() => {
    if (onVmNameValidation) {
      const vmNameExists = vmName.trim() && existingVmNames.includes(vmName.trim().toLowerCase());
      const isReservedName =
        vmName.trim().toLowerCase() === 'admin' || vmName.trim().toLowerCase() === 'root';
      // VM is valid if name doesn't exist and is not reserved (data is instantly available from global state)
      const isValid = !vmNameExists && !isReservedName;
      onVmNameValidation(isValid, false); // false = not checking (data already available)
    }
  }, [vmName, existingVmNames, onVmNameValidation]);

  // Check if VM name already exists or is reserved
  const vmNameExists = vmName.trim() && existingVmNames.includes(vmName.trim().toLowerCase());
  const isReservedName =
    vmName.trim().toLowerCase() === 'admin' || vmName.trim().toLowerCase() === 'root';
  const showVmNameError =
    nameError ||
    (isReservedName
      ? 'VM name cannot be "admin" or "root". Please choose a different name.'
      : '') ||
    (vmNameExists ? 'VM name already exists. Please choose a different name.' : '');

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold mb-6">Basic Configuration</h2>

      {/* Server Selection */}
      <div>
        <label htmlFor="serverSelect" className="block text-sm font-medium text-gray-700 mb-2">
          Select Server *
        </label>
        <select
          id="serverSelect"
          value={selectedServerIp}
          onChange={(e) => setSelectedServerIp(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
        >
          <option value="">Select a server</option>
          {dataCenters &&
            dataCenters.length > 0 &&
            dataCenters.flatMap((dc) =>
              (dc.servers || []).map((server) => (
                <option key={server.fqdn || server.ip} value={server.fqdn || server.ip}>
                  {server.name || server.fqdn || server.ip}
                </option>
              ))
            )}
        </select>
      </div>

      {/* Basic VM Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col">
          <label htmlFor="vmName" className="block text-sm font-medium text-gray-700 mb-2">
            VM Name *
          </label>
          <div className="relative">
            <input
              type="text"
              id="vmName"
              value={vmName}
              onChange={handleVmNameChange}
              className={`w-full px-3 py-2.5 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm ${
                showVmNameError ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter VM name"
            />
            {/* No loading spinner needed - VM data is already available from global state */}
          </div>
          {showVmNameError && <p className="mt-1 text-sm text-red-600">{showVmNameError}</p>}
          {vmNameExists && !isReservedName && (
            <p className="mt-1 text-sm text-amber-600">
              This VM name is already in use on the server
            </p>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="osType" className="block text-sm font-medium text-gray-700 mb-2">
            Operating System *
          </label>
          <select
            id="osType"
            value={osType}
            onChange={(e) => setOsType(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
          >
            <option value="">Select OS Type</option>
            <option value="freebsd">FreeBSD</option>
            <option value="ubuntu-server">Ubuntu Server</option>
          </select>
        </div>
      </div>

      {/* Image Selection */}
      <div>
        <label htmlFor="imageSelect" className="block text-sm font-medium text-gray-700 mb-2">
          Select the image *
        </label>
        <select
          id="imageSelect"
          value={selectedImage}
          onChange={(e) => setSelectedImage(e.target.value)}
          disabled={imagesLoading || availableImages.length === 0}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue disabled:bg-gray-100 disabled:cursor-not-allowed h-11 bg-white text-gray-900 text-sm"
        >
          {imagesLoading ? (
            <option value="">Loading images...</option>
          ) : availableImages.length === 0 ? (
            <option value="">No images available</option>
          ) : (
            <>
              <option value="">Select an image</option>
              {availableImages.map((image) => (
                <option key={image} value={image}>
                  {image}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    </div>
  );
}
