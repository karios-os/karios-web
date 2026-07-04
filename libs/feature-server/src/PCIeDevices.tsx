import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { BsPciCardNetwork } from 'react-icons/bs';
import { useServer, api } from '@karios-monorepo/shared-state';
import { logger } from '../../shared-state/src/utils/logger';
import envConfig from '../../../runtime-config';
import LoadingState from '../../shared-state/src/widgets/LoadingState';

// TypeScript interfaces for PCIe devices data structure
interface PCIeFunction {
  name: string;
  bdf: string;
  pci_id: string;
  vendor_id: string;
  device_id: string;
  vendor: string;
  device: string;
  class_hex: string;
  class: string;
  subclass: string;
  is_integrated: boolean;
  is_active: boolean;
  guest_vms: string[];
  iov_dev_name: string;
  sriov_support: boolean;
  vfs?: number;
}

interface PCIeDevice {
  category: string;
  vendor: string;
  vendor_id: string;
  funcs: Record<string, PCIeFunction>;
}

interface PCIeDevicesData {
  [key: string]: PCIeDevice;
}

// Enhanced interfaces for hierarchical view
interface DeviceWithSeparatedFunctions {
  physicalFunctions: PCIeFunction[];
  virtualFunctions: PCIeFunction[];
  deviceInfo: PCIeDevice;
}

function PCIeDevices(): React.ReactElement {
  const { selectedServer } = useServer();
  const [pcieData, setPcieData] = useState<PCIeDevicesData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [enablingSriov, setEnablingSriov] = useState<Set<string>>(new Set());
  const [showVfsModal, setShowVfsModal] = useState<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [vfsCount, setVfsCount] = useState<number>();
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());

  // Fetch PCIe devices data
  useEffect(() => {
    const fetchPCIeDevices = async () => {
      if (!selectedServer?.fqdn && !selectedServer?.ip) return;

      try {
        setLoading(true);
        setError(null);

        // Make API call to get PCIe devices
        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/get_pci_sliceable`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setPcieData(data);
      } catch (error) {
        logger.error('Failed to fetch PCIe devices', {
          serverAddress: selectedServer?.fqdn || selectedServer?.ip,
          error,
        });
        setError('Failed to load PCIe devices');
      } finally {
        setLoading(false);
      }
    };

    fetchPCIeDevices();
  }, [selectedServer?.fqdn, selectedServer?.ip]);

  // Toggle device expansion
  const toggleDeviceExpansion = (deviceKey: string) => {
    setExpandedDevices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(deviceKey)) {
        newSet.delete(deviceKey);
      } else {
        newSet.add(deviceKey);
      }
      return newSet;
    });
  };

  // Helper function to identify if a function is a VF based on device-level SR-IOV support
  const isVirtualFunction = (func: PCIeFunction, allDeviceFunctions: PCIeFunction[]): boolean => {
    // Check if any function in the device has SR-IOV support
    const deviceHasSriovSupport = allDeviceFunctions.some((f) => f.sriov_support);

    if (!deviceHasSriovSupport) {
      // If device doesn't have at least one SR-IOV support → all are physical functions
      return false;
    } else {
      // If device has at least one SR-IOV support true →
      // all true are physical functions, all false are virtual functions
      return !func.sriov_support;
    }
  };

  // Transform PCIe data into hierarchical structure with separated PFs and VFs
  const organizeHierarchicalData = React.useCallback((data: PCIeDevicesData) => {
    const organizedData: {
      [deviceKey: string]: DeviceWithSeparatedFunctions;
    } = {};

    // Group by main device keys from JSON
    Object.entries(data).forEach(([deviceKey, device]) => {
      const physicalFunctions: PCIeFunction[] = [];
      const virtualFunctions: PCIeFunction[] = [];

      // Get all functions for this device
      const allFunctions: (PCIeFunction & { category: string; vendor: string })[] = [];
      Object.entries(device.funcs).forEach(([_funcKey, func]) => {
        allFunctions.push({ ...func, category: device.category, vendor: device.vendor });
      });

      // Separate PFs and VFs for this device using the new logic
      allFunctions.forEach((func: any) => {
        const isVF = isVirtualFunction(func, allFunctions);

        if (isVF) {
          virtualFunctions.push(func);
        } else {
          physicalFunctions.push(func);
        }
      });

      organizedData[deviceKey] = {
        physicalFunctions,
        virtualFunctions,
        deviceInfo: device,
      };
    });

    return organizedData;
  }, []);

  // Show VFS selection modal
  const showVfsSelectionModal = (deviceFunc: any, initialCount?: number) => {
    setSelectedDevice(deviceFunc);
    if (typeof initialCount === 'number') {
      setVfsCount(Math.max(1, initialCount));
    } else {
      // Ensure minimum value is 1, fallback to 4 if undefined/null/0
      setVfsCount(Math.max(1, deviceFunc.vfs ?? 4));
    }
    setShowVfsModal(true);
  };

  // Check if a PF currently has any VFs (based on hierarchical data)
  const pfHasAnyVfs = (pf: any): boolean => {
    if (!hierarchicalData) return false;

    // Find the device that contains this PF
    for (const [_deviceKey, deviceData] of Object.entries(hierarchicalData)) {
      const { virtualFunctions } = deviceData;

      // Check if this PF exists in this device and if the device has any VFs
      const pfExists = deviceData.physicalFunctions.some((pfInDevice) => pfInDevice.bdf === pf.bdf);
      if (pfExists && virtualFunctions.length > 0) {
        return true;
      }
    }

    return false;
  };

  // Directly delete all VFs (set to 0) without opening modal
  const deleteAllVfsForPf = async (pf: any) => {
    if (!selectedServer?.fqdn && !selectedServer?.ip) return;

    // Block if any VF is attached to VMs
    const hasAssignedVfs = (() => {
      if (!pcieData) return false;
      for (const [_key, dev] of Object.entries(pcieData)) {
        const allFunctions: any[] = Object.values((dev as any).funcs || {});
        const containsPf = allFunctions.some((f: any) => f.bdf === pf.bdf);
        if (!containsPf) continue;
        const assigned = allFunctions.filter(
          (f: any) =>
            isVirtualFunction(f as any, allFunctions) &&
            Array.isArray(f.guest_vms) &&
            f.guest_vms.length > 0
        );
        return assigned.length > 0;
      }
      return false;
    })();
    if (hasAssignedVfs) {
      toast.error('Cannot delete VFs: one or more VFs are attached to VMs. Detach them first.', {
        toastId: 'delete-vfs-blocked',
      });
      return;
    }

    const deviceKey = pf.pci_id;
    setEnablingSriov((prev) => new Set([...prev, deviceKey]));

    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/spawn_vfs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dev_name: pf.iov_dev_name || pf.name,
            vfs: '0',
            bdf: pf.bdf,
          }),
        }
      );

      if (response.ok) {
        const refreshResponse = await api.fetch(
          `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/get_pci_sliceable`
        );
        if (refreshResponse.ok) {
          const refreshedData = await refreshResponse.json();
          setPcieData(refreshedData);
        }
      } else {
        // Let API layer surface its own toast/messages
        logger.error('Delete VFs operation failed', {
          status: response.status,
          deviceName: pf.iov_dev_name || pf.name,
          bdf: pf.bdf,
        });
      }
    } catch (err) {
      logger.error('Failed to delete VFs', {
        deviceName: pf.iov_dev_name || pf.name,
        bdf: pf.bdf,
        error: err,
      });
    } finally {
      setEnablingSriov((prev) => {
        const newSet = new Set(prev);
        newSet.delete(deviceKey);
        return newSet;
      });
    }
  };

  // Enable SR-IOV for a specific device
  const enableSrIov = async () => {
    if ((!selectedServer?.fqdn && !selectedServer?.ip) || !selectedDevice) return;

    const deviceKey = selectedDevice.pci_id;
    setEnablingSriov((prev) => new Set([...prev, deviceKey]));
    setShowVfsModal(false); // Close modal

    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/spawn_vfs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dev_name: selectedDevice.iov_dev_name || selectedDevice.name,
            vfs: vfsCount.toString(),
            bdf: selectedDevice.bdf,
          }),
        }
      );

      if (!response.ok) {
        // Try to extract server error message for better UX
        let serverMessage = '';
        try {
          const text = await response.text();
          serverMessage = text || '';
        } catch {
          // ignore
        }
        const msg = serverMessage || `HTTP error! status: ${response.status}`;
        throw new Error(msg);
      }

      const result = await response.json();

      // Refresh the PCIe devices data to get updated state
      const refreshResponse = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/get_pci_sliceable`
      );

      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setPcieData(refreshedData);
      }
    } catch (error) {
      // Let the API layer handle user-facing toasts; keep the page as-is
      logger.error('Failed to enable SR-IOV', {
        deviceName: selectedDevice?.iov_dev_name || selectedDevice?.name,
        bdf: selectedDevice?.bdf,
        vfsCount,
        error,
      });
    } finally {
      setEnablingSriov((prev) => {
        const newSet = new Set(prev);
        newSet.delete(deviceKey);
        return newSet;
      });
      setSelectedDevice(null);
    }
  };

  // Get organized hierarchical data
  const hierarchicalData = React.useMemo(() => {
    if (!pcieData) return {};
    return organizeHierarchicalData(pcieData);
  }, [pcieData, organizeHierarchicalData]);

  // Get filtered hierarchical data by device keys
  const filteredHierarchicalData = React.useMemo(() => {
    if (!pcieData) return {};

    const filtered: { [deviceKey: string]: DeviceWithSeparatedFunctions } = {};

    Object.entries(hierarchicalData).forEach(([deviceKey, deviceData]) => {
      const device = deviceData.deviceInfo;

      // Show all GPU devices regardless of is_integrated status
      // Previous filtering logic removed to allow display of all GPU devices

      // Apply category filter
      if (selectedCategoryFilter !== 'all' && device.category !== selectedCategoryFilter) {
        return;
      }

      filtered[deviceKey] = deviceData;
    });

    return filtered;
  }, [hierarchicalData, selectedCategoryFilter, pcieData]);

  // Get available categories for the filter dropdown
  const availableCategories = React.useMemo(() => {
    if (!pcieData) return [];

    const categories = new Set<string>();
    Object.values(pcieData).forEach((device) => {
      // Always include GPU category in the filter (we filter specific devices, not the entire category)
      categories.add(device.category);
    });

    return Array.from(categories).sort();
  }, [pcieData]);

  // Render Physical Function Card
  const renderPFCard = (pf: PCIeFunction & { category?: string }) => {
    const isEnabling = enablingSriov.has(pf.pci_id);
    const isNetworkDevice = pf.category === 'network';

    // Check if this function is integrated
    const isIntegrated = pf.is_integrated === true;

    // Determine if function should be disabled based on requirements:
    // Only disable if is_integrated: true (regardless of category)
    const shouldDisable = isIntegrated;

    return (
      <div
        key={pf.bdf}
        className={`border rounded-lg px-4 py-3 transition-all ${
          shouldDisable
            ? 'bg-gray-50 border-gray-200 opacity-60'
            : 'bg-white border-blue-200 hover:border-blue-300 hover:shadow-sm'
        }`}
        style={{
          backgroundColor: shouldDisable ? '#f9fafb' : undefined,
          opacity: shouldDisable ? '0.6' : '1',
          border: shouldDisable ? '1px solid #d1d5db' : undefined,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{pf.name}</h3>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-karios-blue font-mono">
                {pf.bdf}
              </span>
              {isNetworkDevice && pf.sriov_support && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-green-100 text-karios-green font-medium">
                  SR-IOV
                </span>
              )}
              {isIntegrated && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-200 text-gray-700 font-medium">
                  Host Integrated
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 truncate mt-1">{pf.device}</p>

            {/* SR-IOV Information for Network Devices */}
            {isNetworkDevice && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-gray-500">SR-IOV Support:</span>
                  <span
                    className={`font-medium ${pf.sriov_support ? 'text-karios-green' : 'text-gray-500'}`}
                  >
                    {pf.sriov_support ? 'Enabled' : 'Not Available'}
                  </span>
                </div>
                {pf.sriov_support && pf.iov_dev_name && (
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-gray-500">IOV Device:</span>
                    <span className="font-medium text-gray-700 font-mono">{pf.iov_dev_name}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center ml-4 space-x-2">
            {pf.sriov_support && (
              <>
                <button
                  onClick={() => showVfsSelectionModal(pf)}
                  disabled={isEnabling}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isEnabling
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-karios-blue hover:bg-karios-blue text-white shadow-sm'
                  }`}
                >
                  {isEnabling ? (
                    <>
                      <div className="-ml-1 mr-2">
                        <LoadingState size="sm" />
                      </div>
                      Creating
                    </>
                  ) : (
                    'Create VFs'
                  )}
                </button>
                {/* Temporarily disabled Delete VFs button */}
                {/* {pfHasAnyVfs(pf) && (
                  <button
                    onClick={() => deleteAllVfsForPf(pf)}
                    disabled={isEnabling}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors border ${
                      isEnabling
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-200'
                        : 'bg-white text-red-600 border-red-200 hover:border-red-300 hover:bg-red-50'
                    }`}
                    title="Delete all VFs (set to 0)"
                  >
                    Delete VFs
                  </button>
                )} */}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render Virtual Function Card
  const renderVFCard = (vf: PCIeFunction & { category?: string }) => {
    const isNetworkDevice = vf.category === 'network';

    return (
      <div
        key={vf.bdf}
        className="bg-white border border-green-200 rounded-lg px-4 py-3 hover:border-green-300 hover:shadow-sm transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{vf.name}</h3>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-green-100 text-karios-green font-mono">
                {vf.bdf}
              </span>
              {isNetworkDevice && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-700 font-medium">
                  Virtual Function
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 truncate mt-1">{vf.device}</p>

            {/* Network VF Information */}
            {isNetworkDevice && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-gray-500">Type:</span>
                  <span className="font-medium text-blue-700">SR-IOV Virtual Function</span>
                </div>
                {vf.iov_dev_name && (
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-gray-500">IOV Device:</span>
                    <span className="font-medium text-gray-700 font-mono">{vf.iov_dev_name}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center ml-4">
            {vf.guest_vms && vf.guest_vms.length > 0 && (
              <div className="flex items-center space-x-2 bg-green-50 px-3 py-1 rounded-md">
                <svg className="w-4 h-4 text-karios-green" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-karios-green">
                  {vf.guest_vms.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 bg-white p-6 rounded-lg border border-gray-100">
        <div className="flex items-center justify-center h-48">
          <LoadingState size="md" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 bg-white p-6 rounded-lg border border-gray-100">
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Unable to Load PCIe Devices
            </h3>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white p-6 rounded-lg border border-gray-100">
      {/* Page Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center">
          <BsPciCardNetwork size={32} className="text-karios-blue" />
          <div className="ml-3">
            <h1 className="text-2xl font-bold text-gray-900">PCIe Devices</h1>
            <p className="text-gray-600 text-sm mt-1">
              View and manage PCIe devices with their physical and virtual functions
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          {/* Category Filter */}
          <div className="flex items-center space-x-2">
            <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
              Category:
            </label>
            <select
              id="category-filter"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue bg-white"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-col gap-6">
        <div className="space-y-4">
          {Object.entries(filteredHierarchicalData).length > 0 ? (
            Object.entries(filteredHierarchicalData).map(([deviceKey, deviceData]) => {
              const { physicalFunctions, virtualFunctions, deviceInfo } = deviceData;
              const isExpanded = expandedDevices.has(deviceKey);

              return (
                <div
                  key={deviceKey}
                  className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm"
                >
                  {/* Device Key Header - Clickable */}
                  <button
                    onClick={() => toggleDeviceExpansion(deviceKey)}
                    className="w-full bg-white px-4 py-4 hover:bg-gray-50 transition-colors text-left rounded-t-lg border-b border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <svg
                          className={`w-4 h-4 text-karios-blue transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">
                            {(() => {
                              // Try to get device name from physical functions first
                              const deviceName =
                                physicalFunctions.length > 0
                                  ? physicalFunctions[0].device
                                  : virtualFunctions.length > 0
                                    ? virtualFunctions[0].device
                                    : '';

                              // If device name is empty, get all unique class names from all functions
                              if (!deviceName || deviceName.trim() === '') {
                                const allFunctions = [...physicalFunctions, ...virtualFunctions];
                                const uniqueClasses = new Set<string>();

                                allFunctions.forEach((func) => {
                                  if (func.class && func.class.trim() !== '') {
                                    uniqueClasses.add(func.class);
                                  }
                                });

                                // If we have class names, capitalize first letter and join them with commas
                                if (uniqueClasses.size > 0) {
                                  return (
                                    Array.from(uniqueClasses)
                                      .map((cls) => cls.charAt(0).toUpperCase() + cls.slice(1))
                                      .join(', ') + ' Device'
                                  );
                                }
                              }

                              // Return device name if it exists, otherwise fallback to deviceKey
                              return deviceName || deviceKey;
                            })()}
                          </h2>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-sm text-gray-600">{deviceInfo.vendor}</span>
                            <span className="text-sm text-gray-400">•</span>
                            <span className="text-sm text-gray-600">
                              {deviceInfo.category.charAt(0).toUpperCase() +
                                deviceInfo.category.slice(1)}
                            </span>
                            <span className="text-sm text-gray-400">•</span>
                            <span className="text-xs text-gray-500 font-mono">{deviceKey}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1 bg-blue-100 px-3 py-1 rounded-md">
                          <span className="text-karios-blue font-medium text-sm">
                            {physicalFunctions.length} PF{physicalFunctions.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {virtualFunctions.length > 0 && (
                          <div className="flex items-center space-x-1 bg-green-100 px-3 py-1 rounded-md">
                            <span className="text-karios-green font-medium text-sm">
                              {virtualFunctions.length} VF{virtualFunctions.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expandable Content */}
                  {isExpanded && (
                    <div className="px-4 py-4 space-y-6 bg-gray-50">
                      {/* Physical Functions Section */}
                      {physicalFunctions.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-karios-blue rounded-full"></div>
                            <h3 className="text-sm font-semibold text-karios-blue">
                              Physical Functions
                            </h3>
                            <span className="text-sm text-gray-500">
                              ({physicalFunctions.length})
                            </span>
                          </div>
                          <div className="space-y-2">
                            {physicalFunctions.map((pf) => renderPFCard(pf))}
                          </div>
                        </div>
                      )}

                      {/* Virtual Functions Section */}
                      {virtualFunctions.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-karios-green rounded-full"></div>
                            <h3 className="text-sm font-semibold text-karios-green">
                              Virtual Functions
                            </h3>
                            <span className="text-sm text-gray-500">
                              ({virtualFunctions.length})
                            </span>
                          </div>
                          <div className="space-y-2">
                            {virtualFunctions.map((vf) => renderVFCard(vf))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BsPciCardNetwork size={24} className="text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No PCIe Devices Found</h3>
              <p className="text-gray-600 text-sm mb-4">
                {selectedCategoryFilter === 'all'
                  ? 'No PCIe devices are currently available.'
                  : `No devices found in the ${selectedCategoryFilter.charAt(0).toUpperCase() + selectedCategoryFilter.slice(1)} category.`}
              </p>
              {selectedCategoryFilter !== 'all' && (
                <button
                  onClick={() => setSelectedCategoryFilter('all')}
                  className="px-4 py-2 bg-karios-blue text-white rounded-md text-sm hover:bg-karios-blue transition-colors shadow-sm"
                >
                  Show All Categories
                </button>
              )}
            </div>
          )}
        </div>

        {/* VFS Selection Modal */}
        {showVfsModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded border border-slate-200 shadow-xl w-full max-w-sm mx-4">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-50 to-green-50 px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-800">Create Virtual Functions</h3>
                <p className="text-xs text-slate-600 mt-0.5">Configure SR-IOV virtual functions</p>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-3">
                {/* Device Info */}
                <div className="bg-blue-50 border border-blue-100 rounded p-3">
                  <p className="text-xs font-semibold text-slate-800">{selectedDevice?.name}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="px-1.5 py-0.5 bg-blue-200 text-karios-blue rounded text-xs font-mono">
                      {selectedDevice?.bdf}
                    </span>
                    <span className="text-xs text-slate-600">{selectedDevice?.device}</span>
                  </div>
                </div>

                {/* Destructive Action Notice */}
                <div className="flex items-start gap-2 p-3 rounded border border-amber-200 bg-amber-50">
                  <svg
                    className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    <span className="font-semibold">Important:</span> Creating virtual functions
                    will delete all existing VFs and recreate them. It is not an incremental add or
                    update.
                  </p>
                </div>

                {/* VF Count Input */}
                <div className="space-y-1.5">
                  <label htmlFor="vfs-count" className="block text-xs font-semibold text-slate-800">
                    Number of Virtual Functions
                  </label>
                  <input
                    id="vfs-count"
                    type="number"
                    min="1"
                    max="64"
                    value={vfsCount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setVfsCount(1);
                        return;
                      }
                      const num = parseInt(raw, 10);
                      if (!isNaN(num)) {
                        const bounded = Math.max(1, Math.min(64, num));
                        setVfsCount(bounded);
                      }
                    }}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue bg-white"
                    placeholder="Enter number of VFs (1-64)"
                  />
                  <p className="text-xs text-slate-500">
                    Each virtual function will appear as a separate PCIe device.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-4 py-3 flex justify-end space-x-2 border-t border-slate-200">
                <button
                  onClick={() => {
                    setShowVfsModal(false);
                    setSelectedDevice(null);
                  }}
                  className="px-2 py-1 text-xs text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={enableSrIov}
                  className="px-2 py-1 text-xs text-white bg-karios-green rounded hover:bg-karios-green transition-colors shadow-sm font-medium"
                >
                  Create VFs
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PCIeDevices;
