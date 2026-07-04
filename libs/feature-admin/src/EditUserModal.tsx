import React, { useState, useEffect } from 'react';
import { MdClose, MdToggleOn, MdToggleOff } from 'react-icons/md';
import { createComponentLogger, useAppState } from '@karios-monorepo/shared-state';
import EditRolesModal from './EditRolesModal';

interface Role {
  id: number;
  name: string;
}

interface User {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  roles: Role[];
  approvers: string[];
  requires_approval: boolean;
  user_id: number;
  is_2fa_required?: boolean;
  id?: string;
}

interface EditUserModalProps {
  user: User;
  onClose: () => void;
  onStatusToggle: (user: User, newStatus: boolean) => Promise<void>;
  on2FAToggle: (user: User, is2FARequired: boolean) => Promise<void>;
  onApprovalToggle: (user: User, requiresApproval: boolean) => Promise<void>;
  onOpenApproversModal: (user: User) => void;
  onRefresh?: () => void;
}

export default function EditUserModal({
  user,
  onClose,
  onStatusToggle,
  on2FAToggle,
  onApprovalToggle,
  onOpenApproversModal,
  onRefresh,
}: EditUserModalProps) {
  const logger = createComponentLogger('EditUserModal');
  const [isLoading, setIsLoading] = useState(false);
  const [localUser, setLocalUser] = useState<User>(user);
  const [isEditRolesOpen, setIsEditRolesOpen] = useState(false);

  // Update local user when prop changes
  useEffect(() => {
    setLocalUser(user);
  }, [user]);

  const handleStatusToggle = async () => {
    try {
      setIsLoading(true);
      // Optimistically update UI
      setLocalUser((prev) => ({ ...prev, is_active: !prev.is_active }));
      await onStatusToggle(user, !user.is_active);
      setIsLoading(false);
    } catch (error) {
      logger.error('Error toggling user status', error);
      // Revert on error
      setLocalUser(user);
      setIsLoading(false);
    }
  };

  const handle2FAToggle = async () => {
    try {
      setIsLoading(true);
      // Optimistically update UI
      setLocalUser((prev) => ({ ...prev, is_2fa_required: !(prev.is_2fa_required || false) }));
      await on2FAToggle(user, !(user.is_2fa_required || false));
      setIsLoading(false);
    } catch (error) {
      logger.error('Error toggling 2FA', error);
      // Revert on error
      setLocalUser(user);
      setIsLoading(false);
    }
  };

  const handleApprovalToggle = async () => {
    try {
      setIsLoading(true);
      // Optimistically update UI
      setLocalUser((prev) => ({ ...prev, requires_approval: !prev.requires_approval }));
      await onApprovalToggle(user, !user.requires_approval);
      setIsLoading(false);
    } catch (error) {
      logger.error('Error toggling approval', error);
      // Revert on error
      setLocalUser(user);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 z-10">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Edit User</h2>
            <p className="text-xs text-gray-600 mt-0.5">Update user information</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 flex-shrink-0 ml-2"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-4">
          {/* User Info Summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-600 font-medium">Username</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{localUser.username}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-600 font-medium">Email</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{localUser.email}</p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-600 font-medium">Full Name</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {localUser.first_name} {localUser.last_name}
              </p>
            </div>
          </div>

          {/* Account Status */}
          <div className="border-b border-gray-200 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-gray-900">Account Status</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  {localUser.is_active
                    ? 'Active - can access system'
                    : 'Inactive - blocked from system'}
                </p>
              </div>
              <button
                onClick={handleStatusToggle}
                disabled={isLoading}
                className="ml-3 flex-shrink-0 focus:outline-none transition-opacity disabled:opacity-50"
                title={localUser.is_active ? 'Deactivate User' : 'Activate User'}
              >
                {localUser.is_active ? (
                  <MdToggleOn size={32} className="text-green-600" />
                ) : (
                  <MdToggleOff size={32} className="text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Security Settings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">Security Settings</h3>
              <button
                onClick={() => setIsEditRolesOpen(true)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors flex-shrink-0"
              >
                Assign Role
              </button>
            </div>

            {/* 2FA Required */}
            <label className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={localUser.is_2fa_required || false}
                onChange={handle2FAToggle}
                disabled={isLoading}
                className="mt-0.5 h-4 w-4 accent-blue-600 rounded cursor-pointer disabled:opacity-50 flex-shrink-0"
              />
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Enhanced security with verification code
                </p>
              </div>
            </label>

            {/* Approval Required */}
            <label className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={localUser.requires_approval}
                onChange={handleApprovalToggle}
                disabled={isLoading}
                className="mt-0.5 h-4 w-4 accent-blue-600 rounded cursor-pointer disabled:opacity-50 flex-shrink-0"
              />
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Approval Required</p>
                <p className="text-xs text-gray-600 mt-0.5">Actions need approver permission</p>
              </div>
            </label>

            {/* Approvers Section */}
            {localUser.requires_approval && (
              <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 font-medium mb-2">Assigned Approvers</p>
                {localUser.approvers && localUser.approvers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {localUser.approvers.map((approver, index) => (
                      <div
                        key={index}
                        className="px-2 py-1 bg-white border border-blue-200 rounded text-xs font-medium text-gray-700"
                      >
                        {approver}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mb-3">No approvers assigned</p>
                )}
                <button
                  onClick={() => onOpenApproversModal(user)}
                  className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                >
                  {localUser.approvers && localUser.approvers.length > 0
                    ? 'Edit Approvers'
                    : 'Add Approvers'}
                </button>
              </div>
            )}
          </div>

          {/* Roles */}
          {localUser.roles && localUser.roles.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-sm text-gray-900 mb-2">Assigned Roles</h3>
              <div className="flex flex-wrap gap-1.5">
                {localUser.roles.map((role) => (
                  <span
                    key={role.id}
                    className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {role.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 px-4 sm:px-6 py-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium text-sm hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Roles Modal */}
      {isEditRolesOpen && (
        <EditRolesModal
          user={localUser}
          onClose={() => {
            setIsEditRolesOpen(false);
          }}
          onRefresh={() => {
            setIsEditRolesOpen(false);
            // Refresh the parent and update localUser with new roles
            if (onRefresh) {
              onRefresh();
              // Re-fetch the user to get updated roles
              setTimeout(() => {
                // The parent component will update selectedUserForEdit which will trigger the useEffect
              }, 100);
            }
          }}
        />
      )}
    </div>
  );
}
