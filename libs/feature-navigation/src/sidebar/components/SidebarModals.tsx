import React from 'react';
import { RenameVMModal, DeleteVMModal, CloneVMModal, ActionResultModal } from '../../modals';
import ApprovalModal from '../../../../shared-state/src/components/ApprovalModal';
import type { VirtualMachine } from '../../SideBar-types';

interface SidebarModalsProps {
  // Rename Modal
  isRenameModalOpen: boolean;
  currentRenameVm?: VirtualMachine;
  newVmName: string;
  nameValidationError: string;
  renameError: string;
  onCloseRenameModal: () => void;
  onVmNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirmRename: () => void;

  // Delete Modal
  isDeleteModalOpen: boolean;
  currentDeleteVm?: VirtualMachine;
  isDeleting: boolean;
  deleteButtonClicked: boolean;
  onCloseDeleteModal: () => void;
  onConfirmDelete: () => void;

  // Clone Modal
  isCloneModalOpen: boolean;
  currentCloneVm?: VirtualMachine;
  cloneModalMode: 'powered-on' | 'input' | 'name-exists' | 'pcie-warning' | 'error';
  newCloneVmName: string;
  pcieDevicesList: any[];
  cloneErrorMessage: string;
  onCloseCloneModal: () => void;
  onNewCloneVmNameChange: (name: string) => void;
  onConfirmClone: () => void;
  onProceedAfterPcieWarning: () => void;

  // Action Modal
  isActionModalOpen: boolean;
  actionModalTitle: string;
  actionModalMessage: string;
  actionModalType: 'success' | 'error';
  onCloseActionModal: () => void;

  // Approval Modal
  isApprovalModalOpen: boolean;
  approvalModalProps?: any;
}

export const SidebarModals: React.FC<SidebarModalsProps> = ({
  // Rename Modal
  isRenameModalOpen,
  currentRenameVm,
  newVmName,
  nameValidationError,
  renameError,
  onCloseRenameModal,
  onVmNameChange,
  onConfirmRename,

  // Delete Modal
  isDeleteModalOpen,
  currentDeleteVm,
  isDeleting,
  deleteButtonClicked,
  onCloseDeleteModal,
  onConfirmDelete,

  // Clone Modal
  isCloneModalOpen,
  currentCloneVm,
  cloneModalMode,
  newCloneVmName,
  pcieDevicesList,
  cloneErrorMessage,
  onCloseCloneModal,
  onNewCloneVmNameChange,
  onConfirmClone,
  onProceedAfterPcieWarning,

  // Action Modal
  isActionModalOpen,
  actionModalTitle,
  actionModalMessage,
  actionModalType,
  onCloseActionModal,

  // Approval Modal
  isApprovalModalOpen,
  approvalModalProps,
}) => {
  return (
    <>
      <RenameVMModal
        isOpen={isRenameModalOpen}
        currentRenameVm={currentRenameVm}
        newVmName={newVmName}
        nameValidationError={nameValidationError}
        renameError={renameError}
        onClose={onCloseRenameModal}
        onVmNameChange={onVmNameChange}
        onConfirmRename={onConfirmRename}
      />

      <DeleteVMModal
        isOpen={isDeleteModalOpen}
        currentDeleteVm={currentDeleteVm}
        isDeleting={isDeleting}
        deleteButtonClicked={deleteButtonClicked}
        onClose={onCloseDeleteModal}
        onConfirmDelete={onConfirmDelete}
      />

      <CloneVMModal
        isOpen={isCloneModalOpen}
        currentCloneVm={currentCloneVm}
        cloneModalMode={cloneModalMode}
        newCloneVmName={newCloneVmName}
        pcieDevicesList={pcieDevicesList}
        cloneErrorMessage={cloneErrorMessage}
        onClose={onCloseCloneModal}
        onNewCloneVmNameChange={onNewCloneVmNameChange}
        onConfirmClone={onConfirmClone}
        onProceedAfterPcieWarning={onProceedAfterPcieWarning}
      />

      <ActionResultModal
        isOpen={isActionModalOpen}
        title={actionModalTitle}
        message={actionModalMessage}
        type={actionModalType}
        onClose={onCloseActionModal}
      />

      {isApprovalModalOpen && <ApprovalModal {...approvalModalProps} />}
    </>
  );
};

export default SidebarModals;
