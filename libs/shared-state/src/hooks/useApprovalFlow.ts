import { useState, useCallback } from 'react';
import { useAppState } from '../AppStateContext';

interface UseApprovalFlowOptions {
  title?: string;
  message?: string;
}

export function useApprovalFlow(options: UseApprovalFlowOptions = {}) {
  const { requiresApproval, approvers } = useAppState();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<((approver: string) => void) | null>(null);
  const {
    title = 'Approval Required',
    message = 'This action requires approval. Please select an approver from the list below.',
  } = options;

  // Function to execute an action with approval flow
  const executeWithApproval = useCallback(
    (
      action: (approverParam?: string) => void | Promise<void>,
      actionTitle?: string,
      actionMessage?: string
    ) => {
      if (!requiresApproval || !approvers || approvers.length === 0) {
        // No approval required, execute action directly
        action();
      } else {
        // Approval required, show modal
        const wrappedAction = (selectedApprover: string) => {
          action(selectedApprover);
          setIsModalOpen(false);
          setPendingAction(null);
        };

        setPendingAction(() => wrappedAction);
        setIsModalOpen(true);
      }
    },
    [requiresApproval, approvers]
  );

  // Function to handle modal submission
  const handleModalSubmit = useCallback(
    (selectedApprover: string) => {
      if (pendingAction) {
        pendingAction(selectedApprover);
      }
    },
    [pendingAction]
  );

  // Function to close modal
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setPendingAction(null);
  }, []);

  // Helper function to add approver to URL params
  const addApproverToParams = useCallback((url: string, approver?: string) => {
    if (!approver) return url;

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}approver=${encodeURIComponent(approver)}`;
  }, []);

  // Helper function to add approver to URLSearchParams
  const addApproverToSearchParams = useCallback((params: URLSearchParams, approver?: string) => {
    if (approver) {
      params.append('approver', approver);
    }
    return params;
  }, []);

  return {
    // State
    requiresApproval,
    approvers,
    isModalOpen,

    // Modal props
    modalProps: {
      isOpen: isModalOpen,
      onClose: handleModalClose,
      onSubmit: handleModalSubmit,
      approvers: approvers || [],
      title,
      message,
    },

    // Functions
    executeWithApproval,
    addApproverToParams,
    addApproverToSearchParams,
    closeModal: handleModalClose,
  };
}
