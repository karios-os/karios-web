import { useState, useCallback } from 'react';
import { VirtualMachine } from '../SideBar-types';

export interface ModalStateReturn {
  // Rename Modal
  isRenameModalOpen: boolean;
  currentRenameVm: VirtualMachine | null;
  currentServerIp: string | null;
  newVmName: string;
  renameError: string | null;
  nameValidationError: string | null;
  setIsRenameModalOpen: (value: boolean) => void;
  setCurrentRenameVm: (vm: VirtualMachine | null) => void;
  setCurrentServerIp: (ip: string | null) => void;
  setNewVmName: (name: string) => void;
  setRenameError: (error: string | null) => void;
  setNameValidationError: (error: string | null) => void;
  resetRenameModal: () => void;

  // Delete Modal
  isDeleteModalOpen: boolean;
  currentDeleteVm: VirtualMachine | null;
  isDeleting: boolean;
  deleteButtonClicked: boolean;
  setIsDeleteModalOpen: (value: boolean) => void;
  setCurrentDeleteVm: (vm: VirtualMachine | null) => void;
  setIsDeleting: (value: boolean) => void;
  setDeleteButtonClicked: (value: boolean) => void;
  resetDeleteModal: () => void;

  // Clone Modal
  isCloneModalOpen: boolean;
  cloneModalMode:
    | 'clone'
    | 'edit'
    | 'powered-on'
    | 'pcie-warning'
    | 'input'
    | 'error'
    | 'name-exists';
  cloneErrorMessage: string | null;
  newCloneVmName: string;
  currentCloneVm: VirtualMachine | null;
  pcieDevicesList: any[];
  setIsCloneModalOpen: (value: boolean) => void;
  setCloneModalMode: (
    mode: 'clone' | 'edit' | 'powered-on' | 'pcie-warning' | 'input' | 'error' | 'name-exists'
  ) => void;
  setCloneErrorMessage: (error: string | null) => void;
  setNewCloneVmName: (name: string) => void;
  setCurrentCloneVm: (vm: VirtualMachine | null) => void;
  setPcieDevicesList: (list: any[]) => void;
  resetCloneModal: () => void;

  // Action Result Modal
  isActionModalOpen: boolean;
  actionModalTitle: string;
  actionModalMessage: string;
  actionModalType: 'success' | 'error';
  setIsActionModalOpen: (value: boolean) => void;
  setActionModalTitle: (title: string) => void;
  setActionModalMessage: (message: string) => void;
  setActionModalType: (type: 'success' | 'error') => void;
  resetActionModal: () => void;

  // Reset all modals
  resetAllModals: () => void;
}

export function useModalState(): ModalStateReturn {
  // Rename Modal States
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [currentRenameVm, setCurrentRenameVm] = useState<VirtualMachine | null>(null);
  const [currentServerIp, setCurrentServerIp] = useState<string | null>(null);
  const [newVmName, setNewVmName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [nameValidationError, setNameValidationError] = useState<string | null>(null);

  // Delete Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentDeleteVm, setCurrentDeleteVm] = useState<VirtualMachine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteButtonClicked, setDeleteButtonClicked] = useState(false);

  // Clone Modal States
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneModalMode, setCloneModalMode] = useState<
    'clone' | 'edit' | 'powered-on' | 'pcie-warning' | 'input' | 'error' | 'name-exists'
  >('clone');
  const [cloneErrorMessage, setCloneErrorMessage] = useState<string | null>(null);
  const [newCloneVmName, setNewCloneVmName] = useState('');
  const [currentCloneVm, setCurrentCloneVm] = useState<VirtualMachine | null>(null);
  const [pcieDevicesList, setPcieDevicesList] = useState<any[]>([]);

  // Action Result Modal States
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionModalTitle, setActionModalTitle] = useState('');
  const [actionModalMessage, setActionModalMessage] = useState('');
  const [actionModalType, setActionModalType] = useState<'success' | 'error'>('success');

  // Reset functions
  const resetRenameModal = useCallback(() => {
    setIsRenameModalOpen(false);
    setCurrentRenameVm(null);
    setCurrentServerIp(null);
    setNewVmName('');
    setRenameError(null);
    setNameValidationError(null);
  }, []);

  const resetDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setCurrentDeleteVm(null);
    setIsDeleting(false);
    setDeleteButtonClicked(false);
  }, []);

  const resetCloneModal = useCallback(() => {
    setIsCloneModalOpen(false);
    setCloneModalMode('clone');
    setCloneErrorMessage(null);
    setNewCloneVmName('');
    setCurrentCloneVm(null);
    setPcieDevicesList([]);
  }, []);

  const resetActionModal = useCallback(() => {
    setIsActionModalOpen(false);
    setActionModalTitle('');
    setActionModalMessage('');
    setActionModalType('success');
  }, []);

  const resetAllModals = useCallback(() => {
    resetRenameModal();
    resetDeleteModal();
    resetCloneModal();
    resetActionModal();
  }, [resetRenameModal, resetDeleteModal, resetCloneModal, resetActionModal]);

  return {
    // Rename Modal
    isRenameModalOpen,
    currentRenameVm,
    currentServerIp,
    newVmName,
    renameError,
    nameValidationError,
    setIsRenameModalOpen,
    setCurrentRenameVm,
    setCurrentServerIp,
    setNewVmName,
    setRenameError,
    setNameValidationError,
    resetRenameModal,

    // Delete Modal
    isDeleteModalOpen,
    currentDeleteVm,
    isDeleting,
    deleteButtonClicked,
    setIsDeleteModalOpen,
    setCurrentDeleteVm,
    setIsDeleting,
    setDeleteButtonClicked,
    resetDeleteModal,

    // Clone Modal
    isCloneModalOpen,
    cloneModalMode,
    cloneErrorMessage,
    newCloneVmName,
    currentCloneVm,
    pcieDevicesList,
    setIsCloneModalOpen,
    setCloneModalMode,
    setCloneErrorMessage,
    setNewCloneVmName,
    setCurrentCloneVm,
    setPcieDevicesList,
    resetCloneModal,

    // Action Result Modal
    isActionModalOpen,
    actionModalTitle,
    actionModalMessage,
    actionModalType,
    setIsActionModalOpen,
    setActionModalTitle,
    setActionModalMessage,
    setActionModalType,
    resetActionModal,

    // Reset all
    resetAllModals,
  };
}
