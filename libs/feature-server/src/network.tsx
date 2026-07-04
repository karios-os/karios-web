import React, { useEffect, useState } from 'react';
import { useAppState, useApprovalFlow, ApprovalModal } from '@karios-monorepo/shared-state';
import { logger } from '../../shared-state/src/utils/logger';
import { ArrowRight, Add as IconPlus, Trash } from 'iconsax-react';
import { FaChevronDown } from 'react-icons/fa';
import Modal from '../../shared-state/src/widgets/Modal';
import api from '../../shared-state/src/utils/interceptor';
import NetworkStatusBadges from '../../../apps/karios-gui/src/Components/NetworkStatusBadges';
import envConfig from '../../../runtime-config';

// TypeScript interfaces
interface NetworkInterface {
  id: string;
  name: string;
  associatedSwitches?: NetworkSwitch[];
}

interface NetworkSwitch {
  name: string;
  private: string;
  active: string;
  interface: string;
}

interface NetworkState {
  interfaces: NetworkInterface[];
  switches: NetworkSwitch[];
  dropdownSelection: string;
  loadingInterfaces: boolean;
  loadingSwitches: boolean;
  showCreateSwitchForm: boolean;
  switchName: string;
  selectedInterface: string;
}

export default function Network(): React.ReactElement {
  const { state } = useAppState();
  const selectedServer = state.selectedServer;

  // Approval flow hook
  const { executeWithApproval, isModalOpen, modalProps, requiresApproval } = useApprovalFlow();

  // Local state management for network functionality
  const [network, setNetwork] = useState<NetworkState>({
    interfaces: [],
    switches: [],
    dropdownSelection: 'interfaces',
    loadingInterfaces: false,
    loadingSwitches: false,
    showCreateSwitchForm: false,
    switchName: '',
    selectedInterface: '',
  });

  // Local functions to replace missing shared-state functions
  const fetchNetworkInterfaces = async (serverIp: string) => {
    setNetwork((prev) => ({ ...prev, loadingInterfaces: true }));
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/interfaces`
      );
      if (!response.ok) throw new Error('Failed to fetch network interfaces');
      const data = await response.json();
      // Transform the array of interface names into objects with id and name
      const interfacesData = data.map((interfaceName: string, index: number) => ({
        id: `interface-${index}`,
        name: interfaceName,
      }));
      setNetwork((prev) => ({ ...prev, interfaces: interfacesData, loadingInterfaces: false }));
    } catch (error) {
      logger.error('Error fetching network interfaces:', error);
      setNetwork((prev) => ({ ...prev, loadingInterfaces: false }));
    }
  };

  const fetchSwitches = async (serverIp: string) => {
    setNetwork((prev) => ({ ...prev, loadingSwitches: true }));
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switches`
      );
      if (!response.ok) throw new Error('Failed to fetch switches');
      const data = await response.json();
      setNetwork((prev) => ({ ...prev, switches: data, loadingSwitches: false }));
    } catch (error) {
      logger.error('Error fetching switches:', error);
      setNetwork((prev) => ({ ...prev, loadingSwitches: false }));
    }
  };

  const createSwitch = async (
    serverIp: string,
    switchName: string,
    selectedInterface: string,
    existingSwitches: NetworkSwitch[],
    approver?: string
  ) => {
    try {
      let apiUrl = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch`;

      // Add approver as query parameter if provided
      if (approver) {
        const urlParams = new URLSearchParams();
        urlParams.append('approver', approver);
        apiUrl += `?${urlParams.toString()}`;
      }

      const response = await api.fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: switchName,
          interface: selectedInterface,
        }),
      });
      if (!response.ok) throw new Error('Failed to create switch');
      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  };

  const deleteSwitch = async (serverIp: string, switchName: string, approver?: string) => {
    try {
      let apiUrl = `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/switch/${switchName}`;

      // Add approver as query parameter if provided
      if (approver) {
        const urlParams = new URLSearchParams();
        urlParams.append('approver', approver);
        apiUrl += `?${urlParams.toString()}`;
      }

      const response = await api.fetch(apiUrl, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete switch');
      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  };

  const setNetworkDropdown = (value: string) => {
    setNetwork((prev) => ({ ...prev, dropdownSelection: value }));
  };

  const setShowCreateSwitchForm = (show: boolean) => {
    setNetwork((prev) => ({ ...prev, showCreateSwitchForm: show }));
  };

  const setSwitchName = (name: string) => {
    setNetwork((prev) => ({ ...prev, switchName: name }));
  };

  const setSelectedInterface = (interfaceName: string) => {
    setNetwork((prev) => ({ ...prev, selectedInterface: interfaceName }));
  };

  // Fetch interfaces and switches on mount or when server changes
  useEffect(() => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (serverAddress) {
      fetchNetworkInterfaces(serverAddress);
      fetchSwitches(serverAddress);
    }
  }, [selectedServer?.fqdn, selectedServer?.ip]);

  // Helper to build interfaces with associated switches
  const interfacesWithSwitches = network.interfaces.map(
    (iface: NetworkInterface, index: number) => {
      const associatedSwitches = network.switches.filter(
        (sw: NetworkSwitch) => sw.interface === iface.name
      );
      return { ...iface, associatedSwitches };
    }
  );

  // Handler for creating a switch
  const handleCreateSwitch = async () => {
    if (!network.switchName.trim() || !network.selectedInterface) {
      alert('Please provide both switch name and interface.');
      return;
    }

    try {
      // Execute create with approval flow
      await executeWithApproval(
        async (approver?: string) => {
          const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
          if (!serverAddress) return;

          const result = await createSwitch(
            serverAddress,
            network.switchName,
            network.selectedInterface,
            network.switches,
            approver
          );
          if (result?.error) {
            throw new Error(result.error);
          }

          // Clear form and refresh data after successful API call
          setSwitchName('');
          setSelectedInterface('');
          fetchNetworkInterfaces(serverAddress);
          fetchSwitches(serverAddress);
          setShowCreateSwitchForm(false);

          // Show success alert after successful API call
          alert('Switch created successfully!');
        },
        'Create Switch',
        `Are you sure you want to create the switch "${network.switchName}"?`
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to create switch: ${errorMessage}`);
    }
  };

  // Handler for deleting a switch
  const handleDeleteSwitch = async (switchName: string) => {
    if (!window.confirm(`Are you sure you want to delete the switch "${switchName}"?`)) return;

    try {
      // Execute delete with approval flow
      await executeWithApproval(
        async (approver?: string) => {
          const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
          if (!serverAddress) return;

          const result = await deleteSwitch(serverAddress, switchName, approver);
          if (result?.error) {
            throw new Error(result.error);
          }

          // Refresh the lists after successful API call
          fetchNetworkInterfaces(serverAddress);
          fetchSwitches(serverAddress);

          // Show success alert after successful API call
          alert(`Switch "${switchName}" deleted successfully.`);
        },
        'Delete Switch',
        `Are you sure you want to delete the switch "${switchName}"?`
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to delete switch: ${errorMessage}`);
    }
  };

  return (
    <>
      <div className="p-6 bg-white shadow-md rounded-2xl" data-testid="server-network-container">
        {/* Header with Dropdown */}
        <div className="flex flex-row items-center mb-4" data-testid="server-network-header">
          <div className="ml-auto relative">
            <select
              value={network.dropdownSelection}
              onChange={(e) => setNetworkDropdown(e.target.value)}
              className="border border-gray-300 bg-white text-black rounded-md py-3 pl-4 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px] text-sm font-medium"
              data-testid="server-network-view-select"
            >
              <option value="interfaces">Interface</option>
              <option value="switches">Switches</option>
            </select>

            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
              <FaChevronDown className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Interface View */}
        {network.dropdownSelection === 'interfaces' && (
          <div data-testid="server-network-interfaces-view">
            <h3 className="text-xl font-medium mb-4" data-testid="server-network-interfaces-title">Network Management - Interface</h3>
            {network.loadingInterfaces ? (
              <p className="text-gray-500" data-testid="server-network-interfaces-loading">Loading interfaces...</p>
            ) : interfacesWithSwitches.length > 0 ? (
              <div className="space-y-4" data-testid="server-network-interfaces-list">
                {interfacesWithSwitches.map((iface: NetworkInterface) => (
                  <div
                    key={iface.id}
                    className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
                    data-testid={`server-network-interface-item-${iface.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-gray-100 p-5 rounded-lg">
                        <ArrowRight color="#4b5563" size={18} />
                      </div>
                      <div>
                        <div className="text-lg font-medium text-black">
                          Interface : {iface.name}
                        </div>
                        {(iface.associatedSwitches?.length ?? 0) > 0 ? (
                          <div>
                            <div className="text-sm text-karios-blue mb-1">
                              Switch: {iface.associatedSwitches?.[0]?.name}
                            </div>
                            <NetworkStatusBadges
                              active={iface.associatedSwitches?.[0]?.active || 'no'}
                              private={iface.associatedSwitches?.[0]?.private || 'no'}
                            />
                            {(iface.associatedSwitches?.length ?? 0) > 1 && (
                              <div className="text-xs text-gray-500 mt-1">
                                +{(iface.associatedSwitches?.length ?? 0) - 1} more switch
                                {(iface.associatedSwitches?.length ?? 0) > 2 ? 'es' : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-karios-blue">No Associated Switches</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No interfaces available.</p>
            )}
          </div>
        )}

        {/* Switch View */}
        {network.dropdownSelection === 'switches' && (
          <div data-testid="server-network-switches-view">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium" data-testid="server-network-switches-title">Network Management - Switches</h3>

              <button
                onClick={() => setShowCreateSwitchForm(true)}
                className="flex items-center gap-2  hover:border-gray-600 text-black px-4 py-2 rounded-md border border-gray-300"
                data-testid="server-network-create-switch-button"
              >
                <p className="text-sm flex items-center gap-2 border border-gray-900 hover:bg-gray-100 px-1 py-1 rounded-md">
                  <IconPlus className="w-4 h-4" size={22} color="#000000" />
                </p>
                Create Switch
              </button>
            </div>

            {network.loadingSwitches ? (
              <p className="text-gray-500" data-testid="server-network-switches-loading">Loading switches...</p>
            ) : network.switches.length > 0 ? (
              <div className="space-y-4" data-testid="server-network-switches-list">
                {network.switches.map((sw: NetworkSwitch, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
                    data-testid={`server-network-switch-item-${index}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-gray-100 p-5 rounded-lg">
                        <ArrowRight color="#4b5563" size={18} />
                      </div>
                      <div>
                        <div className="text-lg font-medium text-black">{sw.name}</div>
                        <div className="text-sm text-karios-blue">Interface : {sw.interface}</div>
                        <NetworkStatusBadges
                          active={sw.active}
                          private={sw.private}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteSwitch(sw.name)}
                      className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-md"
                      data-testid={`server-network-switch-delete-button-${index}`}
                    >
                      <Trash size={18} color="#ffffff" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500" data-testid="server-network-switches-empty">No switches available.</p>
            )}

            {/* Create Switch Modal */}
            <Modal
              isOpen={network.showCreateSwitchForm}
              onClose={() => setShowCreateSwitchForm(false)}
              title="Create Switch"
              width="500px"
              data-testid="server-network-create-switch-modal"
            >
              <div className="p-4">
                <label className="block text-md font-medium text-gray-700 mt-2 mb-4">
                  Enter Switch Name
                </label>
                <input
                  type="text"
                  value={network.switchName}
                  onChange={(e) => setSwitchName(e.target.value)}
                  placeholder="Enter switch name"
                  className="w-full border border-gray-300 px-4 py-3 mb-4 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="server-network-switch-name-input"
                />
                <label className="block text-md mt-2 font-medium text-gray-700 mb-4">
                  Select Interface
                </label>
                <div className="relative mb-4">
                  <select
                    value={network.selectedInterface}
                    onChange={(e) => setSelectedInterface(e.target.value)}
                    className="w-full border border-gray-300 px-4 py-3 rounded-md bg-white text-black appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                    data-testid="server-network-switch-interface-select"
                  >
                    <option value="">Select Interface</option>
                    {network.interfaces.map((iface: NetworkInterface) => (
                      <option key={iface.id} value={iface.name}>
                        {iface.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                    <FaChevronDown className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowCreateSwitchForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    data-testid="server-network-switch-create-cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSwitch}
                    className="px-4 py-2 bg-karios-blue hover:bg-blue-700 text-white rounded-md"
                    data-testid="server-network-switch-create-submit-button"
                  >
                    Create Switch
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {isModalOpen && <ApprovalModal {...modalProps} />}
    </>
  );
}
