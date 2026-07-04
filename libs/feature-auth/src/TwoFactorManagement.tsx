import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSpinner, FaCopy } from 'react-icons/fa';
import { toast } from 'react-toastify';
import envConfig from '../../../runtime-config';
import DataTable from '../../shared-state/src/widgets/DataTable';
import LoadingState from '../../shared-state/src/widgets/LoadingState';
import { createComponentLogger } from '@karios-monorepo/shared-state';

interface Device2FA {
  device_id: string;
  id?: string; // For DataTable row selection
  device_name: string;
  primary: boolean;
  last_login_at: string;
  configured_on: string;
}

interface DevicesResponse {
  devices: Device2FA[];
}

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceAdded: () => void;
  existingDevices?: Device2FA[];
}

const AddDeviceModal: React.FC<AddDeviceModalProps> = ({
  isOpen,
  onClose,
  onDeviceAdded,
  existingDevices = [],
}) => {
  const logger = createComponentLogger('AddDeviceModal');
  const [newDeviceName, setNewDeviceName] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [setupCode, setSetupCode] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [addingDevice, setAddingDevice] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string>('');
  const [setPrimary, setSetPrimary] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string>('');

  const resetModal = () => {
    setNewDeviceName('');
    setQrCode('');
    setTotpSecret('');
    setSetupCode('');
    setBackupCodes([]);
    setError('');
    setSetPrimary(false);
    setDeviceId(null);
    setNameError('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const validateDeviceName = (name: string) => {
    if (!name.trim()) {
      setNameError('');
      return;
    }

    const trimmedName = name.trim();
    const isDuplicate = existingDevices.some(
      (device) => device.device_name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setNameError('Device name already exists');
    } else {
      setNameError('');
    }
  };

  const handleDeviceNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewDeviceName(value);
    validateDeviceName(value);
  };

  const handleAddDevice = async () => {
    if (!newDeviceName.trim()) {
      setError('Please enter a device name');
      return;
    }

    if (nameError) {
      setError('Please fix the device name error before proceeding.');
      return;
    }

    setAddingDevice(true);
    setError('');

    try {
      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/add_device`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            device_name: newDeviceName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to add device: ${response.status}`);
      }

      const data = await response.json();
      setQrCode(data.qr_code_url);
      setTotpSecret(data.manual_code);
      setBackupCodes(data.backup_codes || []);
      setDeviceId(data.device_id);
    } catch (err) {
      logger.error('Error adding 2FA device', { deviceName: newDeviceName, error: err.message });
      setError('Failed to add device. Please try again.');
    } finally {
      setAddingDevice(false);
    }
  };

  const handleVerifyDevice = async () => {
    if (!setupCode.trim()) {
      setError('Please enter the verification code from your authenticator app');
      return;
    }

    if (!deviceId) {
      setError('Device ID not found. Please try adding the device again.');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/validate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            code: setupCode,
            device_id: deviceId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to verify device: ${response.status}`);
      }

      toast.success('Device added successfully!');
      onDeviceAdded();
      handleClose();
    } catch (err) {
      logger.error('Error verifying 2FA device', { deviceName: newDeviceName, error: err.message });
      setError('Invalid verification code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (err) {
      logger.warn('Failed to copy to clipboard', { error: err.message });
      toast.error('Failed to copy to clipboard');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 backdrop-blur-sm bg-black/50 flex items-center justify-center p-2 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm md:max-w-2xl max-h-[98vh] overflow-y-auto my-auto">
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Add New 2FA Device</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl md:text-3xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {!qrCode ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="device-name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Device Name
                </label>
                <input
                  id="device-name"
                  type="text"
                  value={newDeviceName}
                  onChange={handleDeviceNameChange}
                  placeholder="e.g., iPhone, Android Phone"
                  className={`w-full px-3 md:px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm md:text-base ${
                    nameError
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {nameError && <p className="text-red-500 text-xs md:text-sm mt-1">{nameError}</p>}
              </div>
              <button
                onClick={handleAddDevice}
                disabled={!newDeviceName.trim() || addingDevice || !!nameError}
                className="w-full bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {addingDevice && <FaSpinner className="animate-spin" />}
                Generate QR Code
              </button>
            </div>
          ) : (
            <div className="space-y-4 md:space-y-6">
              <div className="text-center">
                <h4 className="font-medium text-gray-900 mb-3 md:mb-4 text-sm md:text-base">
                  Scan QR Code with your authenticator app
                </h4>
                <div className="bg-white p-3 md:p-4 border rounded-lg inline-block">
                  <img src={qrCode} alt="2FA QR Code" className="w-40 h-40 md:w-48 md:h-48" />
                </div>

                <div className="mt-3 md:mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs md:text-sm text-gray-600 mb-2">
                    Or enter this code manually:
                  </p>
                  <div className="flex flex-col md:flex-row items-center gap-2 justify-center">
                    <code className="bg-white px-2 md:px-3 py-1 rounded border text-xs md:text-sm font-mono">
                      {totpSecret}
                    </code>
                    <button
                      onClick={() => copyToClipboard(totpSecret)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Copy to clipboard"
                    >
                      <FaCopy size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Backup Codes Section */}
              {backupCodes.length > 0 && (
                <div className="border-t pt-3 md:pt-4">
                  <h4 className="font-medium text-gray-900 mb-2 text-sm md:text-base">
                    Backup Codes
                  </h4>
                  <p className="text-xs md:text-sm text-gray-600 mb-3">
                    Save these backup codes in a secure place. You can use them to access your
                    account if you lose your device.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {backupCodes.map((code, index) => (
                        <div
                          key={index}
                          className="bg-white px-2 md:px-3 py-1 rounded border text-center font-mono text-xs md:text-sm"
                        >
                          {code}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => copyToClipboard(backupCodes.join('\n'))}
                      className="w-full bg-gray-600 text-white px-3 md:px-4 py-2 rounded hover:bg-gray-700 flex items-center justify-center gap-2 text-sm md:text-base"
                    >
                      <FaCopy size={14} />
                      Copy All Backup Codes
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="setup-code"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Enter the code from your authenticator app
                </label>
                <input
                  id="setup-code"
                  type="text"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg md:text-xl font-mono"
                  maxLength={6}
                />
              </div>

              <button
                onClick={handleVerifyDevice}
                disabled={!setupCode.trim() || verifying}
                className="w-full bg-green-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {verifying && <FaSpinner className="animate-spin" />}
                Verify & Add Device
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TwoFactorManagement: React.FC = () => {
  const logger = createComponentLogger('TwoFactorManagement');
  const [devices, setDevices] = useState<Device2FA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device2FA | null>(null);
  const [editName, setEditName] = useState('');
  const [editSetPrimary, setEditSetPrimary] = useState<boolean>(false);
  const [editNameError, setEditNameError] = useState<string>('');

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/devices`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.status}`);
      }

      const data: DevicesResponse = await response.json();
      const devicesWithId = (data.devices || []).map((device) => ({
        ...device,
        id: device.device_id,
      }));
      setDevices(devicesWithId);
    } catch (err) {
      logger.error('Error fetching 2FA devices', { error: err.message });
      setError('Failed to load 2FA devices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string, isPrimary: boolean) => {
    if (isPrimary) {
      toast.error('Cannot delete primary device');
      return;
    }

    if (!window.confirm('Are you sure you want to remove this device?')) {
      return;
    }

    try {
      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/remove_device/${deviceId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete device: ${response.status}`);
      }

      toast.success('Device removed successfully!');
      fetchDevices();
    } catch (err) {
      logger.error('Error deleting 2FA device', { deviceId, error: err.message });
      toast.error('Failed to remove device. Please try again.');
    }
  };

  const handleEditDevice = (device: Device2FA) => {
    setEditingDevice(device);
    setEditName(device.device_name);
    setEditSetPrimary(device.primary);
    setEditNameError('');
  };

  const validateEditName = (name: string) => {
    if (!name.trim()) {
      setEditNameError('');
      return;
    }

    const trimmedName = name.trim();
    const isDuplicate = devices.some(
      (device) =>
        device.device_id !== editingDevice?.device_id &&
        device.device_name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setEditNameError('Device name already exists');
    } else {
      setEditNameError('');
    }
  };

  const handleEditNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditName(value);
    validateEditName(value);
  };

  const handleSaveEdit = async () => {
    if (!editingDevice || !editName.trim()) return;

    // Check for duplicate device names (case-insensitive)
    const trimmedName = editName.trim();
    const isDuplicate = devices.some(
      (device) =>
        device.device_id !== editingDevice.device_id &&
        device.device_name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      toast.error('Device name already exists. Please choose a different name.');
      return;
    }

    try {
      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/update_device/${editingDevice.device_id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            device_name: editName,
            set_primary: editSetPrimary,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update device: ${response.status}`);
      }

      toast.success('Device updated successfully!');
      setEditingDevice(null);
      fetchDevices();
    } catch (err) {
      logger.error('Error updating 2FA device', {
        deviceId: editingDevice.device_id,
        deviceName: editName,
        error: err.message,
      });
      toast.error('Failed to update device. Please try again.');
    }
  };

  const handleSetPrimary = async (deviceId: string, deviceName?: string) => {
    if (deviceName && !window.confirm(`Set "${deviceName}" as your primary 2FA device?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/update_device/${deviceId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            ...(deviceName ? { device_name: deviceName } : {}),
            set_primary: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to set primary device: ${response.status}`);
      }

      toast.success('Primary device updated successfully!');
      fetchDevices();
    } catch (err) {
      logger.error('Error setting primary device', { deviceId, error: err.message });
      toast.error('Failed to set primary device. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return (
        new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString()
      );
    } catch {
      return 'Invalid date';
    }
  };

  // Column definitions for DataTable
  const columns = [
    {
      key: 'device_name',
      header: 'Device Name',
      className: 'px-6 py-4 whitespace-nowrap',
      headerClassName:
        'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50',
      render: (value: string, item: Device2FA) =>
        editingDevice?.device_id === item.device_id ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editName}
              onChange={handleEditNameChange}
              className={`border rounded px-2 py-1 text-sm w-full transition-colors ${
                editNameError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500 focus:bg-red-50'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200 focus:bg-blue-50'
              }`}
              onKeyPress={(e) => e.key === 'Enter' && !editNameError && handleSaveEdit()}
            />
            {editNameError && <p className="text-red-500 text-xs">{editNameError}</p>}
            <div className="flex items-center">
              <input
                id={`edit-primary-${item.device_id}`}
                type="checkbox"
                checked={editSetPrimary}
                onChange={(e) => setEditSetPrimary(e.target.checked)}
                className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor={`edit-primary-${item.device_id}`}
                className="ml-1 block text-xs text-gray-700"
              >
                Set as primary
              </label>
            </div>
          </div>
        ) : (
          <div className="text-sm font-medium text-gray-900">{value}</div>
        ),
    },
    {
      key: 'primary',
      header: 'Status',
      className: 'px-6 py-4 whitespace-nowrap',
      headerClassName:
        'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50',
      render: (value: boolean) =>
        value ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Primary
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Secondary
          </span>
        ),
    },
    {
      key: 'last_login_at',
      header: 'Last Login',
      className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500',
      headerClassName:
        'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50',
      render: (value: string) => formatDate(value),
    },
    {
      key: 'configured_on',
      header: 'Configured On',
      className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500',
      headerClassName:
        'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50',
      render: (value: string) => formatDate(value),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'px-6 py-4 whitespace-nowrap text-sm font-medium',
      headerClassName:
        'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50',
      render: (value: any, item: Device2FA) => (
        <div className="flex items-center space-x-2">
          {editingDevice?.device_id === item.device_id ? (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={!!editNameError || !editName.trim()}
                className={`${
                  editNameError || !editName.trim()
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-green-600 hover:text-green-900'
                }`}
              >
                Save
              </button>
              <button
                onClick={() => setEditingDevice(null)}
                className="text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleEditDevice(item)}
                className="text-blue-600 hover:text-blue-900"
              >
                <FaEdit />
              </button>
              {!item.primary && (
                <button
                  onClick={() => handleDeleteDevice(item.device_id, item.primary)}
                  className="text-red-600 hover:text-red-900"
                  title="Delete device"
                >
                  <FaTrash />
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingState message="Loading 2FA devices..." size="md" showMessage={true} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Two-Factor Authentication Management</h1>
          <p className="text-gray-600 mt-1">Manage your 2FA devices and security settings</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-karios-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <FaPlus size={14} />
          Add Device
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-auto">
        {devices.length === 0 ? (
          <div className="px-6 py-4 text-center text-gray-500">No 2FA devices configured</div>
        ) : (
          <DataTable
            data={devices}
            columns={columns}
            hoverable={true}
            showAllData={true}
            className="bg-white"
            maxHeight="none"
            selectedItemId={editingDevice?.device_id}
            selectedRowClassName="bg-blue-50 border-l-4 border-blue-500"
          />
        )}
      </div>

      <AddDeviceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onDeviceAdded={fetchDevices}
        existingDevices={devices}
      />
    </div>
  );
};

export default TwoFactorManagement;
