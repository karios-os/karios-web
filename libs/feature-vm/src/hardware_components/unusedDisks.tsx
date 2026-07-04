import React, { FC, useState, useEffect } from 'react';
import { FaHdd, FaServer, FaDatabase } from 'react-icons/fa';
import { Trash, AddCircle } from 'iconsax-react';
import {
  useVm,
  useServer,
  useAppState,
  logger,
  attachDiskToVm,
  destroyZfsDataset,
  fetchVmInfo,
} from '@karios-monorepo/shared-state';
import { useApprovalFlow } from '../../../shared-state/src/hooks/useApprovalFlow';
import ApprovalModal from '../../../shared-state/src/components/ApprovalModal';

// Props for UnusedDisks component
interface UnusedDisksProps {
  vmDetails: any;
  fetchUnusedDisks: () => Promise<void>;
  unusedDisks: any[];
  setVmDetails: (details: any) => void;
  getVmInfo?: (retry?: boolean, reason?: string) => Promise<void>;
}

const UnusedDisks: FC<UnusedDisksProps> = ({
  vmDetails,
  fetchUnusedDisks,
  unusedDisks,
  setVmDetails,
  getVmInfo,
}) => {
  const { selectedVm } = useVm();
  // Access user permissions
  const { selectedServer } = useServer();
  const { deleteDataset } = useAppState();

  // Approval flow hook for unused disk deletion
  const diskDeletionApprovalFlow = useApprovalFlow({
    title: 'Unused Disk Deletion Approval Required',
    message:
      'This unused disk deletion requires approval. Please select an approver from the list below.',
  });

  const handleAttachDiskFromUnused = async (disk: any): Promise<void> => {
    const serverAddress = selectedServer?.fqdn || selectedServer.ip;

    // 1. Calculate next available disk number for the VM - use current vmDetails to avoid duplicate API call
    const currentDisks = vmDetails['virtual-disk'] || [];
    const diskNo = currentDisks.length;

    // 2. Prepare the payload
    const payload = {
      vmname: selectedVm.name,
      datastore: vmDetails.datastore,
      size: disk.disk_size,
      zvol_path: disk.zfs_disk.split('/')[0],
      zvol_name: disk.zfs_disk.split('/').pop(), // Get the last part after the final "/"
      disk_no: diskNo,
      disk_type: 'virtio-blk',
      disk_dev: 'custom',
    };
    // 3. Call the attach API using service function
    try {
      await attachDiskToVm(serverAddress, payload);
      alert('Disk attached successfully!');
      await fetchUnusedDisks();

      // Use getVmInfo from shared-state instead of direct API call - ensures single point of management
      if (getVmInfo) {
        await getVmInfo(true, 'disk_attached_from_unused');
      } else {
        // Fallback if getVmInfo not provided
        const updatedVm = await fetchVmInfo(serverAddress, selectedVm.name);
        setVmDetails({ ...updatedVm });
      }
    } catch (error) {
      const err = error as any;
      alert(err.message || 'Failed to attach disk.');
    }
  };

  // Use global action for disk deletion
  const handleDeleteDisk = async (datasetName: string): Promise<void> => {
    // Check if the user confirmed the deletion
    if (!window.confirm('Are you sure you want to delete this disk?')) {
      return; // Exit if the user cancels
    }

    const performDeletion = async (approver?: string) => {
      try {
        const serverAddress = selectedServer?.fqdn || selectedServer.ip;
        // Extract pool name from dataset path
        const poolName = datasetName.split('/')[0];

        if (approver) {
          // Call service function when approver is provided
          await destroyZfsDataset(serverAddress, datasetName, poolName, approver);
          alert('Disk deleted successfully!');
          await fetchUnusedDisks();
        } else {
          // Use the existing deleteDataset function when no approver is needed
          const success = await deleteDataset(serverAddress, poolName, datasetName);
          if (success) {
            alert('Disk deleted successfully!');
            await fetchUnusedDisks();
          } else {
            alert('Failed to delete disk.');
          }
        }
      } catch (error) {
        logger.error('Error deleting unused disk', error);
        alert('Failed to delete disk. Please try again.');
      }
    };

    // Use approval flow if user requires approval
    if (diskDeletionApprovalFlow.requiresApproval) {
      await diskDeletionApprovalFlow.executeWithApproval(performDeletion, 'Delete Unused Disk');
    } else {
      await performDeletion();
    }
  };
  // Add useEffect to call fetchUnusedDisks
  useEffect(() => {
    fetchUnusedDisks();
  }, [fetchUnusedDisks, vmDetails]);
  return (
    <>
      {unusedDisks?.length > 0 && (
        <section className="rounded-xl p-6 w-full mx-auto space-y-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium flex items-center">Unused Disks</h3>
          </div>
          <div className="space-y-3">
            {unusedDisks.map((disk, index) => (
              <div
                key={index}
                className="flex items-center justify-between border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                    <FaHdd size={20} color="#3B82F6" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 font-medium">Disk Name:</span>
                      <span className="ml-2 font-semibold">{disk.disk_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">ZFS Path:</span>
                      <span className="ml-2 text-black-600 font-medium">{disk.zfs_disk}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Size:</span>
                      <span className="ml-2 font-medium">{disk.disk_size}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAttachDiskFromUnused(disk)}
                    className="bg-white border-2 border-karios-green text-karios-green hover:bg-karios-green hover:text-white px-4 py-2 rounded-md text-sm flex items-center font-medium transition-colors"
                    title="Attach Disk"
                  >
                    <AddCircle size={20} className="mr-2" variant="Bold" color="currentColor" />{' '}
                    Attach
                  </button>

                  <button
                    onClick={() => handleDeleteDisk(disk.zfs_disk)}
                    className="border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-md flex items-center font-medium transition-colors"
                    title="Delete Disk"
                  >
                    <Trash size={20} className="mr-2" variant="Bold" color="currentColor" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Unused Disk Deletion Approval Modal */}
      <ApprovalModal
        isOpen={diskDeletionApprovalFlow.isModalOpen}
        onClose={diskDeletionApprovalFlow.closeModal}
        approvers={diskDeletionApprovalFlow.approvers}
        title="Approve Unused Disk Deletion"
        message="Please approve the deletion of this unused disk."
        {...diskDeletionApprovalFlow.modalProps}
      />
    </>
  );
};

export default UnusedDisks;
