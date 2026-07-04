import React, { useEffect, useState } from 'react';
import {
  useVm,
  usePermissions,
  useServer,
  useAppState,
  configureVmStartOnBoot,
  mountIsoForInstallation,
  logger,
  fetchVmInfo,
} from '@karios-monorepo/shared-state';

interface AttachDriveFormProps {
  setVmDetails: (vmDetails: any) => void;
  refreshVmDetails?: () => Promise<void>;
  onClose: () => void;
  vmDetails?: any;
}

const AttachDriveForm = ({
  setVmDetails,
  refreshVmDetails,
  onClose,
  vmDetails,
}: AttachDriveFormProps) => {
  const { selectedVm } = useVm();
  const { permissions } = usePermissions();
  const { selectedServer } = useServer();
  const {
    storage,
    fetchVmDisks,
    setDiskFormField,
    attachDisk,
    fetchIsoList,
    iso,
    setIsoField,
    dispatch,
    performVmActionWebSocket,
  } = useAppState();

  // Get VM state from selectedVm (updated via WebSocket)
  const vmState = selectedVm?.state || vmDetails?.state || 'Unknown';
  const isVmStopped = vmState.toLowerCase() === 'stopped';

  // Local state for UI only (not persisted)
  const [isOsInstall, setIsOsInstall] = useState(false);
  const [startOnBoot, setStartOnBoot] = useState(false);
  const [startVm, setStartVm] = useState(false);

  // Add status message states
  const [attachStatus, setAttachStatus] = useState({ type: '', message: '' });
  const [bootStatus, setBootStatus] = useState({ type: '', message: '' });
  const [startVmStatus, setStartVmStatus] = useState({ type: '', message: '' });

  // Add loading states
  const [isAttaching, setIsAttaching] = useState(false);
  const [isStartingVm, setIsStartingVm] = useState(false);

  useEffect(() => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (serverAddress && selectedVm?.name) {
      fetchIsoList(serverAddress);
      fetchVmDisks(serverAddress, selectedVm.name);
    }
  }, [selectedServer?.ip, selectedServer?.fqdn, selectedVm?.name]);

  useEffect(() => {
    if (storage.vmDisks) {
      setDiskFormField('diskNo', storage.vmDisks.length);
    }
  }, [storage.vmDisks]);

  // Clear status messages after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (attachStatus.message) setAttachStatus({ type: '', message: '' });
      if (bootStatus.message) setBootStatus({ type: '', message: '' });
      if (startVmStatus.message) setStartVmStatus({ type: '', message: '' });
    }, 5000);
    return () => clearTimeout(timer);
  }, [attachStatus.message, bootStatus.message, startVmStatus.message]);

  const handleAttachIso = async () => {
    if (!iso.selectedIso) {
      setAttachStatus({ type: 'error', message: 'Please select an ISO to attach.' });
      return;
    }

    setIsAttaching(true); // Set loading state

    try {
      const serverAddress = selectedServer?.fqdn || selectedServer.ip;

      // Check and mount for OS installation if needed
      if (isOsInstall) {
        await mountIsoForInstallation(
          serverAddress,
          selectedVm.name,
          iso.selectedIso,
          dispatch,
          vmDetails?.datastore
        );
      }

      // Attach the ISO disk
      const payload = {
        vmname: selectedVm.name,
        datastore: vmDetails?.datastore || 'default',
        disk_type: 'ahci-cd',
        disk_dev: 'custom',
        disk_no: storage.diskForm.diskNo,
        iso: iso.selectedIso,
      };
      const result = await attachDisk(serverAddress, payload);
      if (result?.error) throw new Error(result.error);

      setIsoField('selectedIso', '');
      fetchVmDisks(serverAddress, selectedVm.name);

      // Refresh VM details to show the newly attached drive
      if (refreshVmDetails) {
        await refreshVmDetails();
      } else if (setVmDetails) {
        // Fallback if refreshVmDetails is not provided
        try {
          const updatedVmData = await fetchVmInfo(serverAddress, selectedVm.name);
          setVmDetails(updatedVmData);
        } catch (refreshErr) {
          logger.error('Error refreshing VM details', refreshErr);
        }
      }

      setAttachStatus({
        type: 'success',
        message: `Successfully attached ISO ${iso.selectedIso}${isOsInstall ? ' in installation mode' : ''}`,
      });

      // Start VM if checkbox is selected and VM is currently stopped
      if (startVm && isVmStopped) {
        try {
          setIsStartingVm(true); // Set VM starting loading state
          setStartVmStatus({ type: 'info', message: 'Starting VM...' });

          await performVmActionWebSocket(serverAddress, selectedVm.name, 'start', (status) => {
            // Handle VM start status updates
            if (status.is_final) {
              setIsStartingVm(false); // Clear VM starting loading state
              if (status.error) {
                setStartVmStatus({ type: 'error', message: status.status || 'Failed to start VM' });
              } else {
                setStartVmStatus({ type: 'success', message: 'VM started successfully' });
                // Close modal after successful VM start
                setTimeout(() => {
                  onClose();
                }, 1500);
              }
            }
          });
        } catch (startError) {
          setIsStartingVm(false); // Clear VM starting loading state on error
          setStartVmStatus({ type: 'error', message: startError.message || 'Failed to start VM' });
        }
      }

      // Auto-close modal after 1.5 seconds to show success message briefly
      // But only if VM starting is not in progress
      if (!isStartingVm) {
        setTimeout(() => {
          setIsAttaching(false); // Clear attach loading state
          onClose();
        }, 1500);
      } else {
        // If VM is starting, just clear the attach loading state
        setIsAttaching(false);
      }
    } catch (err) {
      setIsAttaching(false); // Clear attach loading state on error
      setIsStartingVm(false); // Clear VM starting loading state on error
      setAttachStatus({ type: 'error', message: err.message || 'Error attaching ISO' });
    }
  };

  // UI rendering
  return (
    <div className="bg-white rounded-lg">
      <div className="mb-5">
        <label className="block text-gray-700 font-medium mb-2">Select ISO:</label>
        <select
          value={iso.selectedIso || ''}
          onChange={(e) => setIsoField('selectedIso', e.target.value)}
          disabled={isAttaching || isStartingVm}
          className={`w-full p-3 border border-gray-300 rounded-lg transition-all duration-200 ${
            isAttaching || isStartingVm
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 focus:ring-2 focus:ring-karios-blue focus:border-karios-blue'
          }`}
        >
          <option value="">-- Select an ISO --</option>
          {(iso.isoList || []).map((isoName, idx) => (
            <option key={idx} value={isoName}>
              {isoName}
            </option>
          ))}
        </select>

        {/* Debug info for VM state */}
        {selectedVm && (
          <div className="mt-2 text-xs text-gray-500">
            VM: {selectedVm.name} | State: {vmState} | Can Start: {isVmStopped ? 'Yes' : 'No'}
          </div>
        )}

        <div className="mt-5">
          {/* <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <label className="inline-flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isOsInstall}
                onChange={e => setIsOsInstall(e.target.checked)}
                className="form-checkbox h-5 w-5 text-karios-blue rounded border-gray-300 focus:ring-karios-blue transition duration-150 ease-in-out"
              />
              <span className="text-sm font-medium text-gray-700">Mount ISO in installation mode</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 pl-8">Prepares the ISO for OS installation</p>
          </div> */}

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 w-full">
            <label
              className={`inline-flex items-center space-x-3 ${isAttaching || isStartingVm ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                id="startOnBoot"
                checked={startOnBoot}
                disabled={!permissions.VM_MANAGE || isAttaching || isStartingVm}
                onChange={async (e) => {
                  const isChecked = e.target.checked;
                  try {
                    const serverAddress = selectedServer?.fqdn || selectedServer.ip;
                    const success = await configureVmStartOnBoot(
                      serverAddress,
                      selectedVm.name,
                      isChecked,
                      dispatch
                    );
                    if (success) {
                      setStartOnBoot(isChecked);
                      setBootStatus({
                        type: 'success',
                        message: isChecked
                          ? `VM ${selectedVm.name} will start on host restart`
                          : `VM ${selectedVm.name} will no longer start on host restart`,
                      });
                    }
                  } catch (error) {
                    setBootStatus({ type: 'error', message: error.message });
                  }
                }}
                className="form-checkbox h-5 w-5 text-karios-blue rounded border-gray-300 focus:ring-karios-blue transition duration-150 ease-in-out"
              />
              <span className="text-sm font-medium text-gray-700">Start VM on Host Restart</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 pl-8">
              VM will automatically start when host reboots
            </p>
          </div>

          {/* Start VM checkbox - only show if VM is stopped */}
          {/* {isVmStopped && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 w-full">
              <label className={`inline-flex items-center space-x-3 ${isAttaching || isStartingVm ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  id="startVm"
                  checked={startVm}
                  disabled={!permissions.VM_MANAGE || isAttaching || isStartingVm}
                  onChange={(e) => setStartVm(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-karios-blue rounded border-gray-300 focus:ring-karios-blue transition duration-150 ease-in-out"
                />
                <span className="text-sm font-medium text-gray-700">Start VM</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 pl-8">VM will start after attaching the ISO</p>
            </div>
          )} */}
        </div>
      </div>

      {/* Status Messages */}
      <div className="mb-6 space-y-2">
        {/* Loading status when operations are in progress */}
        {isAttaching && !startVm && (
          <div className="p-3 rounded-md text-sm flex items-center bg-blue-50 text-blue-700 border-l-4 border-blue-500">
            <div className="w-2 h-2 rounded-full mr-2 bg-blue-500 animate-pulse"></div>
            Attaching ISO...
          </div>
        )}
        {isAttaching && startVm && isVmStopped && (
          <div className="p-3 rounded-md text-sm flex items-center bg-blue-50 text-blue-700 border-l-4 border-blue-500">
            <div className="w-2 h-2 rounded-full mr-2 bg-blue-500 animate-pulse"></div>
            Attaching ISO and preparing to start VM...
          </div>
        )}
        {isStartingVm && (
          <div className="p-3 rounded-md text-sm flex items-center bg-blue-50 text-blue-700 border-l-4 border-blue-500">
            <div className="w-2 h-2 rounded-full mr-2 bg-blue-500 animate-pulse"></div>
            Starting VM...
          </div>
        )}

        {attachStatus.message && (
          <div
            className={`p-3 rounded-md text-sm flex items-center ${
              attachStatus.type === 'success'
                ? 'bg-green-50 text-karios-green border-l-4 border-karios-green'
                : 'bg-red-50 text-red-700 border-l-4 border-red-500'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${attachStatus.type === 'success' ? 'bg-karios-green' : 'bg-red-500'}`}
            ></div>
            {attachStatus.message}
          </div>
        )}
        {bootStatus.message && (
          <div
            className={`p-3 rounded-md text-sm flex items-center ${
              bootStatus.type === 'success'
                ? 'bg-green-50 text-karios-green border-l-4 border-karios-green'
                : 'bg-red-50 text-red-700 border-l-4 border-red-500'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${bootStatus.type === 'success' ? 'bg-karios-green' : 'bg-red-500'}`}
            ></div>
            {bootStatus.message}
          </div>
        )}
        {startVmStatus.message && (
          <div
            className={`p-3 rounded-md text-sm flex items-center ${
              startVmStatus.type === 'success'
                ? 'bg-green-50 text-karios-green border-l-4 border-karios-green'
                : startVmStatus.type === 'info'
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                  : 'bg-red-50 text-red-700 border-l-4 border-red-500'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                startVmStatus.type === 'success'
                  ? 'bg-karios-green'
                  : startVmStatus.type === 'info'
                    ? 'bg-blue-500'
                    : 'bg-red-500'
              }`}
            ></div>
            {startVmStatus.message}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-4 items-center pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          disabled={isAttaching || isStartingVm}
          className={`px-5 py-2.5 font-medium rounded-lg transition-colors border-2 focus:outline-none focus:ring-2 ${
            isAttaching || isStartingVm
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 focus:ring-gray-300'
          }`}
        >
          Cancel
        </button>
        <button
          onClick={handleAttachIso}
          disabled={isAttaching || isStartingVm}
          className={`px-5 py-2.5 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 ${
            isAttaching || isStartingVm
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-karios-blue text-white hover:bg-blue-700 focus:ring-blue-500 focus:ring-offset-2'
          }`}
        >
          {isAttaching ? 'Attaching...' : isStartingVm ? 'Starting VM...' : 'Attach'}
        </button>
      </div>
    </div>
  );
};

export default AttachDriveForm;
