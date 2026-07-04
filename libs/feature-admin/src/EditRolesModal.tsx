import React, { useState, useEffect } from 'react';
import { MdClose } from 'react-icons/md';
import RoleSelector from './RoleSelector';
import { useAppState, createComponentLogger } from '@karios-monorepo/shared-state';

interface Role {
  id: number;
  name: string;
}

interface User {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: Role[];
  approvers: string[];
  requires_approval: boolean;
  user_id: number;
}

interface EditRolesModalProps {
  user: User;
  onClose: () => void;
  onRefresh: () => void;
}

export default function EditRolesModal({ user, onClose, onRefresh }: EditRolesModalProps) {
  const logger = createComponentLogger('EditRolesModal');
  const [form, setForm] = useState<User>({ ...user });
  const [selectedRole, setSelectedRole] = useState<number | null>(
    user.roles && user.roles.length > 0 ? user.roles[0].id : null
  );

  // Use shared state for user management
  const { updateSelectedUserRoles } = useAppState();

  const handleSave = async (): Promise<void> => {
    try {
      // Update user roles using the shared state function
      // Convert single role to array format as expected by the API
      const rolesToUpdate = selectedRole ? [selectedRole.toString()] : [];
      await updateSelectedUserRoles(user.username, rolesToUpdate);
      onRefresh(); // Refresh user list after saving
    } catch (error) {
      logger.error('Error updating user roles', {
        username: user.username,
        selectedRole,
        error: error.message,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center">
      {/* Blurred Background */}
      <div className="absolute inset-0 bg-opacity-50 backdrop-blur-sm"></div>

      <div className="bg-white p-6 rounded shadow-lg w-[500px] relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Edit Role for User : <span className="font-semibold">{form.username}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <MdClose size={24} />
          </button>
        </div>

        <div className="space-y-2">
          <RoleSelector selectedRole={selectedRole} setSelectedRole={setSelectedRole} />
        </div>
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
