import React, { useEffect, useRef, useState } from 'react';
import { AiOutlineEdit } from 'react-icons/ai';
import {
  MdToggleOff,
  MdToggleOn,
  MdPeople,
  MdCheckCircle,
  MdCancel,
  MdOutlineAdminPanelSettings,
  MdPerson,
  MdPersonOff,
} from 'react-icons/md';
import { IoSearch } from 'react-icons/io5';
import ReactDOM from 'react-dom';
import EditUserModal from './EditUserModal';
import RegisterUserModal from './RegisterUserModal';
import ApproversModal from './ApproversModal';
import { useAppState, createComponentLogger } from '@karios-monorepo/shared-state';
import DataTable from '../../shared-state/src/widgets/DataTable';
import StatusCard from '../../shared-state/src/widgets/StatusCard';
import DeactivateUserModal from './DeactivateUserModal';

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

// Dropdown component rendered via portal to avoid table overflow clipping
interface ApprovalDropdownProps {
  item: User;
  value: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onApprovalToggle: (user: User, requiresApproval: boolean) => Promise<void>;
  dropdownButtonRef?: React.MutableRefObject<Map<string, HTMLButtonElement>>;
}

const ApprovalDropdown: React.FC<ApprovalDropdownProps> = ({
  item,
  value,
  isOpen,
  onToggle,
  onApprovalToggle,
  dropdownButtonRef,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (dropdownButtonRef && buttonRef.current) {
      dropdownButtonRef.current.set(`approval-${item.username}`, buttonRef.current);
    }
    return () => {
      if (dropdownButtonRef) {
        dropdownButtonRef.current.delete(`approval-${item.username}`);
      }
    };
  }, [item.username, dropdownButtonRef]);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  const handleApprovalChange = (requiresApproval: boolean) => {
    onApprovalToggle(item, requiresApproval);
    onToggle();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
      >
        <span className="text-gray-700">{value ? 'Yes' : 'No'}</span>
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen &&
        ReactDOM.createPortal(
          <div
            data-dropdown-menu
            className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-1"
            style={{
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              width: `${dropdownPos.width}px`,
            }}
          >
            <button
              type="button"
              onClick={() => handleApprovalChange(true)}
              className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-50 transition-colors ${
                value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => handleApprovalChange(false)}
              className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-50 transition-colors ${
                !value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              No
            </button>
          </div>,
          document.body
        )}
    </>
  );
};

export default function UserManagementDashboard() {
  const logger = createComponentLogger('UserManagement');

  // Use shared state for user management
  const {
    state,
    fetchAllUsers,
    fetchRolesData,
    setSelectedUser,
    setEditUserModal,
    setRegisterUserModal,
    setUserViewFilter,
    toggleUserActiveStatus,
    updateUserApprovers,
  } = useAppState();

  const { allUsers, selectedUser, isEditUserOpen, isRegisterUserOpen, userViewFilter, roles } =
    state;

  // State for approvers modal
  const [isApproversModalOpen, setIsApproversModalOpen] = React.useState(false);
  const [selectedUserForApprovers, setSelectedUserForApprovers] = React.useState<User | null>(null);

  // State for edit user modal
  const [isEditUserModalOpen, setIsEditUserModalOpen] = React.useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = React.useState<User | null>(null);

  // State for deactivate user confirmation modal
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = React.useState(false);
  const [userToDeactivate, setUserToDeactivate] = React.useState<User | null>(null);

  // State to track which dropdown is currently open
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);
  const dropdownButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Function to handle dropdown toggle
  const toggleDropdown = (username: string) => {
    if (openDropdown === username) {
      setOpenDropdown(null); // Close current dropdown
    } else {
      setOpenDropdown(username); // Open new dropdown, closing any other
    }
  };

  // Function to close dropdown
  const closeDropdown = () => {
    setOpenDropdown(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openDropdown) return;

      const button = dropdownButtonsRef.current.get(openDropdown);
      const target = event.target as Element;

      // Check if click is on the button or inside a dropdown menu
      const isClickOnButton = button && button.contains(target);
      const isClickOnDropdown = target.closest('[data-dropdown-menu]');

      if (!isClickOnButton && !isClickOnDropdown) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  // Helper function to parse approvers from API response
  const parseApprovers = (approvers: any): string[] => {
    if (typeof approvers === 'string') {
      try {
        return JSON.parse(approvers);
      } catch {
        return [];
      }
    }
    return Array.isArray(approvers) ? approvers : [];
  };

  // Helper function to get processed user data
  const getProcessedUser = (user: any): User => ({
    ...user,
    approvers: parseApprovers(user.approvers),
    requires_approval: user.requires_approval || false,
    user_id: user.user_id || user.id || 0,
    is_2fa_required: user.is_2fa_required || false,
  });

  useEffect(() => {
    fetchAllUsers();
    fetchRolesData(); // Ensure roles are loaded for the EditRolesModal
  }, []);

  // Ensure userViewFilter has a valid default value
  useEffect(() => {
    if (!userViewFilter || (userViewFilter !== 'active' && userViewFilter !== 'all')) {
      setUserViewFilter('all');
    }
  }, [userViewFilter, setUserViewFilter]);

  const handleEditUser = (user: User): void => {
    setSelectedUserForEdit(user);
    setIsEditUserModalOpen(true);
  };

  const handleOpenApproversModal = (user: User): void => {
    setSelectedUserForApprovers(user);
    setIsApproversModalOpen(true);
  };

  const handleDeactivateUser = (user: User): void => {
    setUserToDeactivate(user);
    setIsDeactivateModalOpen(true);
  };

  const closeDeactivateModal = (): void => {
    setIsDeactivateModalOpen(false);
    setUserToDeactivate(null);
  };

  const handleToggleUserStatus = async (user: User, newStatus: boolean): Promise<void> => {
    await toggleUserActiveStatus(user.username, newStatus);
  };

  const handleApprovalToggle = async (user: User, requiresApproval: boolean): Promise<void> => {
    try {
      // If no approval required, clear the approvers array
      const approvers = requiresApproval ? user.approvers : [];
      await updateUserApprovers(
        user.username,
        approvers,
        requiresApproval,
        user.is_active,
        user.user_id
      );
    } catch (error) {
      logger.error('Error updating approval requirement', {
        username: user.username,
        requiresApproval,
        error: error.message,
      });
      alert('Failed to update approval requirement. Please try again.');
    }
  };

  const handleApproversChange = async (user: User, approvers: string[]): Promise<void> => {
    try {
      const requiresApproval = approvers.length > 0;
      await updateUserApprovers(
        user.username,
        approvers,
        requiresApproval,
        user.is_active,
        user.user_id
      );
    } catch (error) {
      logger.error('Error updating approvers', {
        username: user.username,
        approvers,
        error: error.message,
      });
      alert('Failed to update approvers. Please try again.');
    }
  };

  const handle2FAToggle = async (user: User, is2FARequired: boolean): Promise<void> => {
    try {
      // Use the same updateUserApprovers function but add is_2fa_required to the payload
      await (updateUserApprovers as any)(
        user.username,
        user.approvers,
        user.requires_approval,
        user.is_active,
        user.user_id,
        is2FARequired
      );
    } catch (error) {
      logger.error('Error updating 2FA requirement', {
        username: user.username,
        is2FARequired,
        error: error.message,
      });
      alert('Failed to update 2FA requirement. Please try again.');
    }
  };

  const displayedUsers: User[] =
    userViewFilter === 'active'
      ? allUsers
          .filter((u: any) => u.is_active)
          .map(getProcessedUser)
          .sort((a, b) => a.username.localeCompare(b.username))
          .map((user, index) => ({ ...user, id: `${user.user_id || index}-${user.username}` }))
      : allUsers
          .map(getProcessedUser)
          .sort((a, b) => a.username.localeCompare(b.username))
          .map((user, index) => ({ ...user, id: `${user.user_id || index}-${user.username}` }));

  // Column definitions for DataTable
  const columns = [
    {
      key: 'username',
      header: 'Username',
      className: 'px-6 py-4 text-sm font-medium text-gray-900',
      headerClassName: 'px-6 py-4 text-left text-sm font-semibold text-gray-700 bg-gray-50',
    },
    {
      key: 'email',
      header: 'Email',
      className: 'px-6 py-4 text-sm text-gray-600',
      headerClassName: 'px-6 py-4 text-left text-sm font-semibold text-gray-700 bg-gray-50',
    },
    {
      key: 'fullName',
      header: 'Full Name',
      className: 'px-4 sm:px-6 py-4 text-xs sm:text-sm text-gray-600',
      headerClassName:
        'px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 bg-gray-50',
      render: (value: any, item: User) => `${item.first_name} ${item.last_name}`,
    },
    {
      key: 'is_active',
      header: 'Status',
      className: 'px-4 sm:px-6 py-4 text-xs sm:text-sm',
      headerClassName:
        'px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 bg-gray-50',
      render: (value: boolean) => (
        <span
          className={`inline-flex px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
            value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      className: 'px-4 sm:px-6 py-4 text-xs sm:text-sm text-gray-600',
      headerClassName:
        'px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 bg-gray-50',
      render: (value: Role[]) => (
        <div className="flex flex-wrap gap-1">
          {value.map((role: Role) => (
            <span
              key={role.id}
              className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
            >
              {role.name}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'px-4 sm:px-6 py-4 text-xs sm:text-sm text-center',
      headerClassName:
        'px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-gray-700 bg-gray-50',
      render: (value: any, item: User) => (
        <div className="flex space-x-2 sm:space-x-3 justify-center">
          <button
            onClick={() => handleEditUser(item)}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
            title="Edit User"
          >
            <AiOutlineEdit size={20} />
          </button>
          {item.is_active && (
            <button
              onClick={() => handleDeactivateUser(item)}
              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
              title="Deactivate User"
            >
              <MdPersonOff size={20} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full min-h-screen">
      {/* Status Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <StatusCard
          metric={allUsers.length.toString()}
          text="Total Users"
          icon={MdPeople}
          iconColor="#10B981"
          iconSize={20}
          className="bg-white border border-gray-200 rounded-lg transition-shadow duration-200 hover:shadow-md"
          metricsColor="text-gray-900"
          metricSize="text-base xl:text-xl"
          textSize="text-sm xl:text-base"
          textBesideIcon={true}
        />
        <StatusCard
          metric={allUsers.filter((u) => u.is_active).length.toString()}
          text="Active Users"
          icon={MdPerson}
          iconColor="#10B981"
          iconSize={20}
          className="bg-white border border-gray-200 rounded-lg transition-shadow duration-200 hover:shadow-md"
          metricsColor="text-gray-900"
          metricSize="text-base xl:text-xl"
          textSize="text-sm xl:text-base"
          textBesideIcon={true}
        />
        <StatusCard
          metric={allUsers.filter((u) => !u.is_active).length.toString()}
          text="Inactive Users"
          icon={MdPersonOff}
          iconColor="#EF4444"
          iconSize={20}
          className="bg-white border border-gray-200 rounded-lg transition-shadow duration-200 hover:shadow-md"
          metricsColor="text-gray-900"
          metricSize="text-base xl:text-xl"
          textSize="text-sm xl:text-base"
          textBesideIcon={true}
        />
      </div>

      {/* Table Section */}
      <div className="overflow-hidden">
        <div className="px-6 py-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Users ({displayedUsers.length})</h3>
          <div className="flex items-center space-x-2">
            <select
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              value={userViewFilter || 'all'}
              onChange={(e) => setUserViewFilter(e.target.value)}
            >
              <option value="active">Active Users</option>
              <option value="all">All Users</option>
            </select>
            <button
              onClick={() => setRegisterUserModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium text-xs transition-colors duration-200"
            >
              + Register User
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <DataTable
            data={displayedUsers}
            columns={columns}
            hoverable={true}
            showAllData={true}
            className="bg-white"
            maxHeight="none"
          />
        </div>
      </div>

      {isRegisterUserOpen && (
        <RegisterUserModal onClose={() => setRegisterUserModal(false)} onRefresh={fetchAllUsers} />
      )}

      {isEditUserModalOpen && selectedUserForEdit && (
        <EditUserModal
          user={selectedUserForEdit}
          onClose={() => {
            setIsEditUserModalOpen(false);
            setSelectedUserForEdit(null);
            fetchAllUsers();
          }}
          onStatusToggle={handleToggleUserStatus}
          on2FAToggle={handle2FAToggle}
          onApprovalToggle={handleApprovalToggle}
          onOpenApproversModal={handleOpenApproversModal}
          onRefresh={fetchAllUsers}
        />
      )}

      {isApproversModalOpen && selectedUserForApprovers && (
        <ApproversModal
          user={selectedUserForApprovers}
          onClose={() => {
            setIsApproversModalOpen(false);
            setSelectedUserForApprovers(null);
          }}
          onRefresh={fetchAllUsers}
        />
      )}

      <DeactivateUserModal
        isOpen={isDeactivateModalOpen}
        user={userToDeactivate}
        onClose={closeDeactivateModal}
        onRefresh={fetchAllUsers}
      />
    </div>
  );
}
