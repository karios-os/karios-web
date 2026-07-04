import React, { FC, JSX, useState, useCallback } from 'react';
import { FaWifi } from 'react-icons/fa6';
import { IoIosAttach } from 'react-icons/io';
import { ArrowRotateRight, Trash } from 'iconsax-react';
import { toast } from 'react-toastify';
import { Modal } from '@karios-monorepo/shared-state';
import { Tooltip, Card } from '@karios-monorepo/shared-state';
import {
  attachNetworkSwitch,
  updateNetworkSwitch,
  detachNetworkSwitch,
} from '../utils/networkService';

interface NetworkSectionProps {
  selectedVm: any;
  selectedServer: any;
  interfacesWithPorts: any[];
  networkDrivers: any[];
  switchesWithPorts: any[];
  datastore: string;
  onRefresh: () => void;
  onFormVisibilityChange?: (isVisible: boolean) => void;
}

const NetworkSection: FC<NetworkSectionProps> = ({
  selectedVm,
  selectedServer,
  interfacesWithPorts,
  networkDrivers,
  switchesWithPorts,
  datastore,
  onRefresh,
  onFormVisibilityChange,
}): JSX.Element => {
  const [showSwitchForm, setShowSwitchForm] = useState(false);
  const [formMode, setFormMode] = useState<'attach' | 'update'>('attach');
  const [selectedSwitch, setSelectedSwitch] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [interfaceToUpdate, setInterfaceToUpdate] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [interfaceToDelete, setInterfaceToDelete] = useState<any>(null);

  // Notify parent when form visibility changes
  React.useEffect(() => {
    onFormVisibilityChange?.(showSwitchForm);
  }, [showSwitchForm, onFormVisibilityChange]);

  const handleSwitchAction = useCallback(async () => {
    if (!selectedSwitch || !selectedDriver) {
      toast.error('Please select a switch and network driver.');
      return;
    }

    if (formMode === 'update' && interfaceToUpdate === null) {
      toast.error('Please select an interface number for update.');
      return;
    }

    const networkInterfaceNumber =
      formMode === 'attach' ? interfacesWithPorts.length : interfaceToUpdate;

    if (formMode === 'attach') {
      const existingSwitch = interfacesWithPorts.find(
        (i) => i['virtual-switch'] === selectedSwitch
      );
      if (existingSwitch) {
        toast.warning('Switch already exists. Choose a different one.');
        return;
      }

      try {
        const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
        await attachNetworkSwitch(
          serverAddress,
          selectedVm.name,
          selectedSwitch,
          selectedDriver,
          networkInterfaceNumber
        );
        toast.success('Switch attached successfully!');
        onRefresh();
        setShowSwitchForm(false);
      } catch (err) {
        toast.error('An error occurred while attaching the switch.');
      }
    } else {
      const targetInterface = interfacesWithPorts.find(
        (iface) => iface.number === interfaceToUpdate
      );
      if (
        targetInterface &&
        targetInterface['virtual-switch'] === selectedSwitch &&
        targetInterface['driver'] === selectedDriver
      ) {
        toast.warning(
          'This switch and driver are already assigned to the selected interface. Please choose a different switch.'
        );
        return;
      }

      try {
        const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
        await updateNetworkSwitch(
          serverAddress,
          selectedVm.name,
          selectedSwitch,
          selectedDriver,
          networkInterfaceNumber,
          datastore
        );
        toast.success('Switch updated successfully!');
        onRefresh();
        setShowSwitchForm(false);
      } catch (err) {
        toast.error('An error occurred while updating the switch.');
      }
    }
  }, [
    selectedSwitch,
    selectedDriver,
    interfaceToUpdate,
    formMode,
    selectedVm,
    selectedServer,
    interfacesWithPorts,
    datastore,
    onRefresh,
  ]);

  const handleDeleteSwitch = useCallback((iface: any) => {
    setInterfaceToDelete(iface);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDeleteSwitch = useCallback(
    async (iface: any) => {
      try {
        const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
        await detachNetworkSwitch(serverAddress, selectedVm.name, iface.number, datastore);
        toast.success('Switch deleted successfully!');
        onRefresh();
        setShowDeleteConfirm(false);
        setInterfaceToDelete(null);
      } catch (err) {
        toast.error('An error occurred while deleting the switch.');
      }
    },
    [selectedVm, selectedServer, datastore, onRefresh]
  );

  const attachButton = (
    <button
      className="text-karios-green hover:text-green-700 text-sm flex items-center justify-center font-medium transition-colors"
      onClick={() => {
        setFormMode('attach');
        setShowSwitchForm(true);
        setSelectedSwitch('');
        setSelectedDriver('');
        setInterfaceToUpdate(null);
      }}
    >
      <IoIosAttach size="20" className="mr-2" /> Attach
    </button>
  ) 

  return (
    <Card
      title="Manage VM Network - Attached Switches"
      icon={FaWifi}
      iconColor="#3b82f6"
      iconSize={24}
      titleExtra={attachButton}
      className="border border-gray-200 rounded-lg min-w-0 order-5"
    >
      <div className="bg-white rounded-lg p-3 sm:p-4 space-y-3 overflow-y-auto max-h-[250px]">
        {interfacesWithPorts.length > 0 ? (
          interfacesWithPorts.map((iface, index) => (
            <div
              key={index}
              className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-2 border-gray-300 p-4 rounded-lg gap-4 min-w-0"
            >
              <div className="flex items-center gap-4 flex-grow min-w-0">
                <div className="flex items-center justify-center w-12 h-12 bg-white rounded-lg flex-shrink-0 border-2 border-gray-300">
                  <FaWifi size={24} color="#3B82F6" />
                </div>
                <div className="text-sm flex-grow min-w-0">
                  <div className="flex flex-col">
                    <span className="text-gray-500 font-medium">Switch</span>
                    <span className="font-semibold text-lg text-gray-800 break-all">
                      {iface['virtual-switch']}
                      {iface.physicalPorts ? (
                        <span className="font-normal text-gray-700"> ({iface.physicalPorts})</span>
                      ) : (
                        <span className="font-normal text-gray-700"> -</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 bg-black-50 text-black-700 px-3 py-1 rounded-full text-xs font-medium inline-block">
                    Interface #{iface.number}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {(
                  <>
                    <button
                      onClick={() => {
                        setFormMode('update');
                        setShowSwitchForm(true);
                        setSelectedSwitch(iface['virtual-switch']);
                        setSelectedDriver(iface.driver || '');
                        setInterfaceToUpdate(iface.number);
                      }}
                      className="bg-white border-2 border-karios-blue text-karios-blue hover:bg-karios-blue hover:text-white px-3 py-2 rounded-md flex items-center justify-center font-medium transition-colors text-sm whitespace-nowrap"
                    >
                      <ArrowRotateRight
                        size="16"
                        variant="Bold"
                        className="mr-1"
                        color="currentColor"
                      />
                      Update
                    </button>
                    <button
                      onClick={() => handleDeleteSwitch(iface)}
                      className="border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-3 py-2 rounded-md flex items-center justify-center font-medium transition-colors text-sm whitespace-nowrap"
                    >
                      <Trash size="16" variant="Bold" className="mr-1" color="currentColor" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="border border-gray-200 p-6 rounded-lg bg-white text-center shadow-sm">
            <FaWifi size={32} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500 font-medium">No switches attached to this VM</p>
            <p className="text-gray-400 text-sm mt-1">
              Use the &apos;Attach&apos; button to connect a network switch
            </p>
          </div>
        )}

        <Modal
          isOpen={showSwitchForm}
          onClose={() => setShowSwitchForm(false)}
          title={formMode === 'attach' ? 'Attach New Switch' : 'Update Switch'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Switch Name:</label>
              <select
                value={selectedSwitch}
                onChange={(e) => setSelectedSwitch(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="">Select a switch</option>
                {(switchesWithPorts || []).map((sw) => (
                  <option key={sw.name} value={sw.name}>
                    {sw.name}
                    {sw.physicalPorts ? ` (${sw.physicalPorts})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-gray-700 font-medium">Network Driver:</label>
                <Tooltip
                  text="virtio-net: High-performance paravirtualized driver that reduces overhead and provides near-native network speed in virtual machines."
                  position="right"
                />
              </div>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="">Select network driver</option>
                {networkDrivers
                  .filter((driver) => driver !== 'e1000')
                  .map((driver) => (
                    <option key={driver} value={driver}>
                      {driver}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
              <button
                onClick={() => setShowSwitchForm(false)}
                className="px-4 py-2 bg-white text-gray-700 font-medium rounded-md hover:bg-gray-100 transition-colors border-2 border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSwitchAction}
                className="px-4 py-2 bg-karios-blue text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                {formMode === 'attach' ? 'Attach' : 'Update'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Confirm Delete"
        >
          <div className="space-y-4">
            <p className="text-gray-700">Are you sure you want to delete this switch?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-white text-gray-700 font-medium rounded-md hover:bg-gray-100 transition-colors border-2 border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeleteSwitch(interfaceToDelete)}
                className="px-4 py-2 bg-red-500 text-white font-medium rounded-md hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </Card>
  );
};

export default NetworkSection;
