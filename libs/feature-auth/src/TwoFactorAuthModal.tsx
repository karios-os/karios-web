import React, { useState, useEffect } from 'react';
import { FaPlus, FaTimes, FaQrcode, FaKey, FaTrash, FaSpinner, FaCopy } from 'react-icons/fa';
import jwt_decode from 'jwt-decode';
import {
  usePermissions,
  createComponentLogger,
} from '@karios-monorepo/shared-state';
import envConfig from '../../../runtime-config';

interface JwtPayload {
  permissions: string[];
  username: string;
  requires_approval: boolean;
  approvers: string[];
  exp: number;
  email?: string;
  isSeed?: boolean;
}

interface Device2FA {
  id: number;
  device_id: string;
  device_name: string;
  primary_device: boolean;
  totp_secret: string;
  attempts_remaining: number;
  lockout_until: string | null;
  backup_codes: string[];
  last_login_ip: string;
  last_login_at: string;
  configured_on: string;
}

interface DevicesResponse {
  devices: Device2FA[];
}

interface TwoFactorAuthModalProps {
  isOpen: boolean;
  onComplete: (token?: string) => void;
  onClose?: () => void;
  customToken?: string; // For forgot password flow
  isPasswordReset?: boolean; // Flag to identify password reset flow
  setAdditionalAuthRequired?: (required: boolean) => void; // For license validation flow
}

const TwoFactorAuthModal: React.FC<TwoFactorAuthModalProps> = ({
  isOpen,
  onComplete,
  onClose,
  customToken,
  isPasswordReset = false,
  setAdditionalAuthRequired,
}) => {
  const logger = createComponentLogger('TwoFactorAuthModal');
  const { updatePermissions } = usePermissions();
  const [devices, setDevices] = useState<Device2FA[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Add device states
  const [newDeviceName, setNewDeviceName] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [setupCode, setSetupCode] = useState<string>('');
  const [addingDevice, setAddingDevice] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [newDeviceId, setNewDeviceId] = useState<string | null>(null);

  // Helper function to update permissions from JWT token
  const updatePermissionsFromToken = (accessToken: string) => {
    try {
      const decodedToken = jwt_decode<JwtPayload>(accessToken);
      const userPermissions = decodedToken.permissions || [];

      // Convert array of permission strings to an object
      const permissionsObject = userPermissions.reduce((obj: any, perm: string) => {
        obj[perm] = true;
        return obj;
      }, {});

      updatePermissions(permissionsObject);
      logger.debug('Permissions updated from 2FA token');
    } catch (error) {
      logger.error('Error updating permissions from 2FA token', { error: error.message });
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
    }
  }, [isOpen]);

  // Clear verification code and focus input when device selection changes
  useEffect(() => {
    if (selectedDeviceId !== null && selectedDeviceId !== undefined) {
      setVerificationCode('');
      // Focus the verification input after a short delay to ensure it's rendered
      setTimeout(() => {
        const verificationInput = document.getElementById('verification-code');
        if (verificationInput) {
          verificationInput.focus();
        }
      }, 100);
    }
  }, [selectedDeviceId]);

  const fetchDevices = async () => {
    setLoading(true);
    setError('');
    try {
      // Use customToken if provided (for password reset), otherwise use stored accessToken
      const token = customToken || localStorage.getItem('accessToken');

      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/devices`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.status}`);
      }

      const data: DevicesResponse = await response.json();
      logger.debug('Fetched 2FA devices', { deviceCount: data.devices?.length || 0 });
      const devicesList = data.devices || [];

      // Sort devices to put primary device at the top
      const sortedDevices = devicesList.sort((a, b) => {
        const aPrimary = a.primary_device || (a as any).primary;
        const bPrimary = b.primary_device || (b as any).primary;

        // Primary devices come first (true > false)
        if (aPrimary && !bPrimary) return -1;
        if (!aPrimary && bPrimary) return 1;
        return 0; // Keep original order for devices with same priority
      });

      setDevices(sortedDevices);

      // Auto-select primary device if it exists
      const primaryDevice = sortedDevices.find((device) => {
        // Check both primary_device and primary fields to handle API response variations
        return device.primary_device || (device as any).primary;
      });

      if (primaryDevice) {
        logger.debug('Auto-selected primary 2FA device', { deviceName: primaryDevice.device_name });
        setSelectedDeviceId(primaryDevice.device_id);
      }
    } catch (err) {
      logger.error('Error fetching 2FA devices', { error: err.message });
      setError('Failed to load 2FA devices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    if (!newDeviceName.trim()) {
      setError('Please enter a device name');
      return;
    }

    setAddingDevice(true);
    setError(''); // Clear any previous errors
    try {
      // Use customToken if provided (for password reset), otherwise use stored accessToken
      const token = customToken || localStorage.getItem('accessToken');

      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/add_device`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            device_name: newDeviceName,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        logger.error('Failed to add 2FA device', {
          status: response.status,
          error: errorData?.message,
        });
        throw new Error(
          `Failed to add device: ${response.status} - ${errorData?.message || 'Unknown error'}`
        );
      }

      const data = await response.json();
      setQrCode(data.qr_code_url);
      setTotpSecret(data.manual_code);
      setBackupCodes(data.backup_codes || []);

      // Get device_id from response - note that 0 is a valid device ID
      const rawDeviceId =
        data.device_id !== undefined
          ? data.device_id
          : data.id !== undefined
            ? data.id
            : data.deviceId;
      const deviceId =
        rawDeviceId !== undefined && rawDeviceId !== null ? String(rawDeviceId) : null;
      setNewDeviceId(deviceId);

      if (deviceId === undefined || deviceId === null) {
        logger.warn('No device ID found in add device response');
        setError('Device was created but no ID was returned. Please try again.');
      }
    } catch (err) {
      logger.error('Error adding 2FA device', { error: err.message });
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

    if (newDeviceId === null || newDeviceId === undefined) {
      logger.error('Device verification failed: missing device ID');
      setError('Device ID not found. Please try adding the device again.');
      return;
    }

    setVerifying(true);
    try {
      // Use customToken if provided (for password reset), otherwise use stored accessToken
      const token = customToken || localStorage.getItem('accessToken');

      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/validate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            code: setupCode,
            device_id: newDeviceId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        logger.error('2FA device verification failed', {
          status: response.status,
          error: errorData?.message,
        });
        throw new Error(
          `Failed to verify device: ${response.status} - ${errorData?.message || 'Unknown error'}`
        );
      }
      if (response.status === 201) {
        // 2FA verification successful - extract tokens and store them
        const data = await response.json();

        if (isPasswordReset) {
          // For password reset, pass the new token to onComplete
          onComplete(data.access_token);
        } else {
          // For regular login, store tokens in localStorage first
          if (data.access_token) {
            localStorage.setItem('accessToken', data.access_token);
            // Update permissions from the new token
            updatePermissionsFromToken(data.access_token);
          }
          if (data.refresh_token) {
            localStorage.setItem('refreshToken', data.refresh_token);
          }

        }
      }

      // Reset form and refresh devices
      setShowAddDevice(false);
      setNewDeviceName('');
      setQrCode('');
      setTotpSecret('');
      setSetupCode('');
      setBackupCodes([]);
      setNewDeviceId(null);
      await fetchDevices();
    } catch (err) {
      logger.error('Error verifying 2FA device', { error: err.message });
      setError('Invalid verification code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode.trim() || selectedDeviceId === null || selectedDeviceId === undefined) {
      setError('Please select a device and enter verification code');
      return;
    }

    setVerifying(true);
    setError(''); // Clear any previous errors

    try {
      // Use customToken if provided (for password reset), otherwise use stored accessToken
      const token = customToken || localStorage.getItem('accessToken');

      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/validate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            code: verificationCode,
            device_id: selectedDeviceId,
          }),
        }
      );

      // Only allow access if response is exactly 200
      if (response.status === 201) {
        // 2FA verification successful - extract tokens and store them
        const data = await response.json();

        if (isPasswordReset) {
          // For password reset, pass the new token to onComplete
          onComplete(data.access_token);
        } else {
          // For regular login, store tokens in localStorage first
          if (data.access_token) {
            localStorage.setItem('accessToken', data.access_token);
            // Update permissions from the new token
            updatePermissionsFromToken(data.access_token);
          }
          if (data.refresh_token) {
            localStorage.setItem('refreshToken', data.refresh_token);
          }
        }
      } else if (response.status === 401) {
        // Handle invalid token/code specifically
        const errorData = await response.json().catch(() => null);
        let errorMessage = errorData?.message || 'Invalid 2FA code';

        // Add attempts remaining information
        if (errorData?.attempts_remaining !== undefined) {
          errorMessage += ` (${errorData.attempts_remaining} attempt${errorData.attempts_remaining !== 1 ? 's' : ''} remaining)`;
        }

        // Add lockout information if present
        if (errorData?.lockout_until) {
          const lockoutDate = new Date(errorData.lockout_until);
          errorMessage += ` - Account locked until ${lockoutDate.toLocaleString()}`;
        }

        setError(errorMessage);
      } else {
        // Block access for any other non-200 response
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.message || errorData?.error || 'Verification failed. Please try again.';
        setError(errorMessage);
      }
    } catch (err) {
      logger.error('Error verifying 2FA', { error: err.message });
      setError('Network error. Please check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!window.confirm('Are you sure you want to remove this device?')) {
      return;
    }

    try {
      // Use customToken if provided (for password reset), otherwise use stored accessToken
      const token = customToken || localStorage.getItem('accessToken');

      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/2fa/devices/${deviceId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete device: ${response.status}`);
      }

      await fetchDevices();
    } catch (err) {
      logger.error('Error deleting 2FA device', { error: err.message });
      setError('Failed to remove device. Please try again.');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show a simple success message without external toast library
      const notification = document.createElement('div');
      notification.className =
        'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[10001]';
      notification.textContent = 'Copied to clipboard!';
      document.body.appendChild(notification);

      setTimeout(() => {
        document.body.removeChild(notification);
      }, 2000);
    } catch (err) {
      logger.warn('Failed to copy to clipboard', { error: err.message });
      // Show error message
      const notification = document.createElement('div');
      notification.className =
        'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-[10001]';
      notification.textContent = 'Failed to copy to clipboard';
      document.body.appendChild(notification);

      setTimeout(() => {
        document.body.removeChild(notification);
      }, 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] backdrop-blur-sm bg-black/50 flex items-center justify-center p-2">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {qrCode && devices.length === 0 ? 'Setup 2FA' : 'Two-Factor Authentication'}
          </h2>
          <button
            onClick={() => {
              if (onClose) {
                onClose();
              } else {
                // Fallback: reload the page to go back to login
                window.location.reload();
              }
            }}
            className="text-gray-400 hover:text-gray-600"
            title="Close"
          >
            <FaTimes size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Fixed content - Error messages */}
          {error && (
            <div className="p-4 pb-0 flex-shrink-0">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <FaSpinner className="animate-spin text-blue-500 mr-2" />
                <span className="text-gray-600">Loading 2FA devices...</span>
              </div>
            ) : (
              <>
                {devices.length === 0 ? (
                  <div className={qrCode ? 'py-4' : 'py-8'}>
                    {!qrCode && (
                      <div className="text-center mb-6">
                        <FaKey className="mx-auto text-4xl text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No 2FA devices configured
                        </h3>
                        <p className="text-gray-600">
                          You need to set up two-factor authentication to continue accessing your
                          account.
                        </p>
                      </div>
                    )}

                    {/* Show device name input directly */}
                    {!qrCode ? (
                      <div className="space-y-4 max-w-md mx-auto">
                        <div>
                          <label
                            htmlFor="device-name"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Device Name
                          </label>
                          <input
                            id="device-name"
                            type="text"
                            value={newDeviceName}
                            onChange={(e) => setNewDeviceName(e.target.value)}
                            placeholder="e.g., iPhone, Android"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={handleAddDevice}
                          disabled={!newDeviceName.trim() || addingDevice}
                          className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                          {addingDevice && <FaSpinner className="animate-spin" />}
                          Generate QR Code
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 max-w-md mx-auto">
                        <div className="text-center">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">
                            Setup Two-Factor Authentication
                          </h4>
                          <p className="text-xs text-gray-600 mb-3">
                            Use any authenticator app on your mobile device to scan this QR code
                          </p>
                          <div className="bg-white p-2 border rounded inline-block">
                            <img src={qrCode} alt="2FA QR Code" className="w-32 h-32" />
                          </div>

                          <div className="mt-3 p-2 bg-gray-50 rounded">
                            <p className="text-xs text-gray-600 mb-1">Or enter manually:</p>
                            <div className="flex items-center gap-2 justify-center">
                              <code className="bg-white px-3 py-1 rounded border text-sm font-mono">
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
                          <div className="border-t pt-3">
                            <h4 className="text-sm font-medium text-gray-900 mb-1">Backup Codes</h4>
                            <p className="text-xs text-gray-600 mb-2">
                              Save these codes securely for account recovery.
                            </p>
                            <div className="bg-gray-50 rounded p-2 flex items-start justify-between gap-2">
                              <div className="text-xs font-mono text-gray-700 break-all flex-1">
                                {backupCodes.join(', ')}
                              </div>
                              <button
                                onClick={() => copyToClipboard(backupCodes.join('\n'))}
                                className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 flex items-center gap-1 flex-shrink-0"
                              >
                                <FaCopy size={10} />
                                Copy
                              </button>
                            </div>
                          </div>
                        )}

                        <div>
                          <label
                            htmlFor="setup-code"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Enter authenticator code
                          </label>
                          <input
                            id="setup-code"
                            type="text"
                            value={setupCode}
                            onChange={(e) =>
                              setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                            }
                            placeholder="6-digit code"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
                            maxLength={6}
                          />
                        </div>

                        <button
                          onClick={handleVerifyDevice}
                          disabled={!setupCode.trim() || verifying}
                          className="w-full bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                          {verifying && <FaSpinner className="animate-spin" />}
                          Verify & Add Device
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Device Selection - Hide when QR code is being displayed */}
                    {!qrCode && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Select a device</h3>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {devices.map((device) => (
                            <div
                              key={device.id}
                              className={`border rounded-lg p-2 cursor-pointer transition-colors ${
                                selectedDeviceId === device.device_id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-400 hover:border-gray-800'
                              }`}
                              onClick={() => setSelectedDeviceId(device.device_id)}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-gray-900">
                                      {device.device_name}
                                    </h4>
                                    {device.primary_device && (
                                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 mt-1">
                                    Last used: {new Date(device.last_login_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Add Device Modal - Only show when devices exist and user explicitly wants to add another */}
            {devices.length > 0 && showAddDevice && (
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Add New Authenticator Device
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddDevice(false);
                      setNewDeviceName('');
                      setQrCode('');
                      setTotpSecret('');
                      setSetupCode('');
                      setBackupCodes([]);
                      setNewDeviceId(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes size={16} />
                  </button>
                </div>

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
                        onChange={(e) => setNewDeviceName(e.target.value)}
                        placeholder="e.g., iPhone, Android Phone"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleAddDevice}
                      disabled={!newDeviceName.trim() || addingDevice}
                      className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      {addingDevice && <FaSpinner className="animate-spin" />}
                      Generate QR Code
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        Setup New Authenticator Device
                      </h4>
                      <p className="text-xs text-gray-600 mb-3">
                        Use any authenticator app on your mobile device to scan this QR code
                      </p>
                      <div className="bg-white p-2 border rounded inline-block">
                        <img src={qrCode} alt="2FA QR Code" className="w-32 h-32" />
                      </div>

                      <div className="mt-3 p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-600 mb-1">Or enter manually:</p>
                        <div className="flex items-center gap-2 justify-center">
                          <code className="bg-white px-3 py-1 rounded border text-sm font-mono">
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
                      <div className="border-t pt-3">
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Backup Codes</h4>
                        <p className="text-xs text-gray-600 mb-2">
                          Save these codes securely for account recovery.
                        </p>
                        <div className="bg-gray-50 rounded p-2 flex items-start justify-between gap-2">
                          <div className="text-xs font-mono text-gray-700 break-all flex-1">
                            {backupCodes.join(', ')}
                          </div>
                          <button
                            onClick={() => copyToClipboard(backupCodes.join('\n'))}
                            className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 flex items-center gap-1 flex-shrink-0"
                          >
                            <FaCopy size={10} />
                            Copy
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="setup-code"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Enter authenticator code
                      </label>
                      <input
                        id="setup-code"
                        type="text"
                        value={setupCode}
                        onChange={(e) =>
                          setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="6-digit code"
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
                        maxLength={6}
                      />
                    </div>

                    <button
                      onClick={handleVerifyDevice}
                      disabled={!setupCode.trim() || verifying}
                      className="w-full bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      {verifying && <FaSpinner className="animate-spin" />}
                      Verify & Add Device
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fixed bottom content - Verification input when device is selected */}
          {devices.length > 0 &&
            !qrCode &&
            selectedDeviceId !== null &&
            selectedDeviceId !== undefined && (
              <div className="p-4 pt-0 border-t border-gray-200 flex-shrink-0 space-y-4">
                <div>
                  <label
                    htmlFor="verification-code"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Enter verification code from your authenticator app
                  </label>
                  <input
                    id="verification-code"
                    type="text"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleVerify2FA}
                  disabled={verificationCode.length !== 6 || verifying}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying && <FaSpinner className="animate-spin" />}
                  Verify & Continue
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorAuthModal;
