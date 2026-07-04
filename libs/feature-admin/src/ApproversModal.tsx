import React, { useState, useEffect } from 'react';
import { useAppState } from '@karios-monorepo/shared-state';
import { createComponentLogger } from '@karios-monorepo/shared-state';

interface User {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: any[];
  approvers: string[];
  requires_approval: boolean;
  user_id: number;
  is_active: boolean;
}

interface ApproversModalProps {
  user: User;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ApproversModal({ user, onClose, onRefresh }: ApproversModalProps) {
  const MAX_APPROVERS = 3;
  const logger = createComponentLogger('ApproversModal');

  const [selectedApprovers, setSelectedApprovers] = useState<string[]>(user.approvers || []);
  const [requiresApproval, setRequiresApproval] = useState<boolean>(
    user.requires_approval || false
  );
  const [availableApprovers, setAvailableApprovers] = useState<any[]>([]);
  const [existingApprovers, setExistingApprovers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const { updateUserApprovers, fetchApproversForUser, state } = useAppState();
  const { allUsers } = state;

  // Fetch available approvers when component mounts
  useEffect(() => {
    const loadApproversData = async () => {
      try {
        setLoading(true);
        const response = await fetchApproversForUser(user.username);
        const existingApprovalsUsernames = response.existing_approvals || [];
        const remainingApproversUsernames = response.remaining_approvers || [];

        // Get full user objects for existing approvers
        const existingApproverUsers = allUsers.filter(
          (u: any) =>
            existingApprovalsUsernames.includes(u.username) && u.username !== user.username
        );

        // Get full user objects for remaining approvers
        const availableApproverUsers = allUsers.filter(
          (u: any) =>
            remainingApproversUsernames.includes(u.username) && u.username !== user.username
        );

        // Update selected approvers to include existing ones
        const allSelectedApprovers = [
          ...new Set([...selectedApprovers, ...existingApprovalsUsernames]),
        ];
        setSelectedApprovers(allSelectedApprovers);

        setExistingApprovers(existingApproverUsers);
        setAvailableApprovers(availableApproverUsers);
      } catch (error) {
        logger.error('Error fetching approvers', { username: user.username, error: error.message });
        // Fallback to showing all users except current user
        const filteredUsers = allUsers.filter((u: any) => u.username !== user.username);
        setAvailableApprovers(filteredUsers);
        setExistingApprovers([]);
      } finally {
        setLoading(false);
      }
    };

    loadApproversData();
  }, [user.username, allUsers]);

  const handleSave = async (): Promise<void> => {
    try {
      await updateUserApprovers(
        user.username,
        selectedApprovers,
        requiresApproval,
        user.is_active,
        user.user_id
      );
      onRefresh();
      onClose();
    } catch (error) {
      logger.error('Error updating user approvers', {
        username: user.username,
        error: error.message,
      });
      alert('Failed to update approvers. Please try again.');
    }
  };

  const handleApproverToggle = (approverUsername: string, checked: boolean) => {
    if (checked) {
      // Prevent selection if maximum approvers limit is reached
      if (selectedApprovers.length >= MAX_APPROVERS) {
        return;
      }
      setSelectedApprovers((prev) => [...prev, approverUsername]);
    } else {
      setSelectedApprovers((prev) => prev.filter((a) => a !== approverUsername));
    }
  };

  // Check if an approver can be selected (not at limit or already selected)
  const canSelectApprover = (approverUsername: string) => {
    return selectedApprovers.length < MAX_APPROVERS || selectedApprovers.includes(approverUsername);
  };

  const handleApprovalToggle = (checked: boolean) => {
    setRequiresApproval(checked);
    if (!checked) {
      setSelectedApprovers([]);
    }
  };

  // Use the fetched available approvers

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center">
      {/* Blurred Background */}
      <div className="absolute inset-0 bg-opacity-50 backdrop-blur-sm"></div>

      <div className="bg-gray-100 p-4 rounded shadow-lg w-[400px] relative z-10">
        <h2 className="text-lg font-semibold mb-3">
          Manage Approvers: <span className="font-medium">{user.username}</span>
        </h2>

        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        ) : existingApprovers.length > 0 || availableApprovers.length > 0 ? (
          <>
            <div className="mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => handleApprovalToggle(e.target.checked)}
                />
                <span className="text-sm font-medium">Requires approval</span>
              </label>
            </div>

            {requiresApproval && (
              <div className="space-y-2">
                {/* Approver limit info */}
                <div
                  className={`text-xs px-2 py-1 rounded ${
                    selectedApprovers.length >= MAX_APPROVERS
                      ? 'text-orange-700 bg-orange-50 border border-orange-200'
                      : 'text-gray-600 bg-gray-50 border border-gray-200'
                  }`}
                >
                  {selectedApprovers.length >= MAX_APPROVERS
                    ? `Max ${MAX_APPROVERS} reached`
                    : `${selectedApprovers.length}/${MAX_APPROVERS} selected`}
                </div>
                {/* Existing Approvers Section */}
                {existingApprovers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current:</label>
                    <div className="space-y-1">
                      {existingApprovers.map((approverUser: any) => {
                        const canSelect = canSelectApprover(approverUser.username);
                        const isSelected = selectedApprovers.includes(approverUser.username);
                        return (
                          <label
                            key={`existing-${approverUser.username}`}
                            className={`flex items-center gap-2 px-2 py-1 text-sm border border-gray-200 rounded ${canSelect ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!canSelect && !isSelected}
                              onChange={(e) =>
                                handleApproverToggle(approverUser.username, e.target.checked)
                              }
                            />
                            <span
                              className={
                                canSelect || isSelected ? 'text-gray-900' : 'text-gray-500'
                              }
                            >
                              {approverUser.first_name} {approverUser.last_name}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-1 py-0.5 rounded ml-auto">
                              Current
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Available Approvers Section */}
                {availableApprovers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {existingApprovers.length > 0 ? 'Available:' : 'Available:'}
                    </label>
                    <div className="space-y-1">
                      {availableApprovers.map((approverUser: any) => {
                        const canSelect = canSelectApprover(approverUser.username);
                        const isSelected = selectedApprovers.includes(approverUser.username);
                        return (
                          <label
                            key={`available-${approverUser.username}`}
                            className={`flex items-center gap-2 px-2 py-1 text-sm border border-gray-200 rounded ${canSelect ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!canSelect && !isSelected}
                              onChange={(e) =>
                                handleApproverToggle(approverUser.username, e.target.checked)
                              }
                            />
                            <span
                              className={
                                canSelect || isSelected ? 'text-gray-900' : 'text-gray-500'
                              }
                            >
                              {approverUser.first_name} {approverUser.last_name}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-1 py-0.5 rounded ml-auto">
                              Available
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No approvers available */}
                {existingApprovers.length === 0 && availableApprovers.length === 0 && (
                  <div className="text-center py-2 text-sm text-gray-500">
                    No approvers available.
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex justify-end space-x-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-karios-green text-white rounded hover:bg-green-600"
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center py-4 text-sm text-gray-500">No users available.</div>

            <div className="mt-3 flex justify-end">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm bg-gray-300 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
