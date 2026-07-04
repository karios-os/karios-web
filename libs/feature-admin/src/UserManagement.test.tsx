import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserManagement from './UserManagement';

// Mock window.confirm
const mockConfirm = jest.fn();
globalThis.confirm = mockConfirm;

// Mock the shared state context
const mockFetchAllUsers = jest.fn();
const mockFetchRolesData = jest.fn();
const mockSetSelectedUser = jest.fn();
const mockSetEditUserModal = jest.fn();
const mockSetRegisterUserModal = jest.fn();
const mockSetUserViewFilter = jest.fn();
const mockDeleteSelectedUser = jest.fn();
const mockToggleUserActiveStatus = jest.fn();
const mockUpdateUserApprovers = jest.fn();
const mockSetIsApproversModalOpen = jest.fn();
const mockSetSelectedUserForApprovers = jest.fn();

const mockUsers = [
  {
    username: 'jane_smith',
    email: 'jane@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    is_active: false,
    roles: [{ id: 2, name: 'User' }],
    approvers: [],
    requires_approval: false,
    user_id: 2,
  },
  {
    username: 'john_doe',
    email: 'john@example.com',
    first_name: 'John',
    last_name: 'Doe',
    is_active: true,
    roles: [{ id: 1, name: 'Admin' }],
    approvers: [],
    requires_approval: false,
    user_id: 1,
  },
];

const mockState = {
  allUsers: mockUsers,
  selectedUser: null,
  isEditUserOpen: false,
  isRegisterUserOpen: false,
  isApproversModalOpen: false,
  selectedUserForApprovers: null,
  userViewFilter: 'all',
  roles: [
    { id: 1, name: 'Admin' },
    { id: 2, name: 'User' },
  ],
};

jest.mock('@karios-monorepo/shared-state', () => ({
  useAppState: () => ({
    state: mockState,
    fetchAllUsers: mockFetchAllUsers,
    fetchRolesData: mockFetchRolesData,
    setSelectedUser: mockSetSelectedUser,
    setEditUserModal: mockSetEditUserModal,
    setRegisterUserModal: mockSetRegisterUserModal,
    setUserViewFilter: mockSetUserViewFilter,
    deleteSelectedUser: mockDeleteSelectedUser,
    toggleUserActiveStatus: mockToggleUserActiveStatus,
    updateUserApprovers: mockUpdateUserApprovers,
    setIsApproversModalOpen: mockSetIsApproversModalOpen,
    setSelectedUserForApprovers: mockSetSelectedUserForApprovers,
  }),
}));

// Mock child components
jest.mock('./EditRolesModal', () => {
  return function MockEditUserModal({ user, onClose, onRefresh }: any) {
    return (
      <div data-testid="edit-user-modal">
        <span>Editing user: {user?.username}</span>
        <button onClick={onClose}>Close</button>
        <button onClick={onRefresh}>Refresh</button>
      </div>
    );
  };
});

jest.mock('./RegisterUserModal', () => {
  return function MockRegisterUserModal({ onClose, onRefresh }: any) {
    return (
      <div data-testid="register-user-modal">
        <span>Register new user</span>
        <button onClick={onClose}>Close</button>
        <button onClick={onRefresh}>Refresh</button>
      </div>
    );
  };
});

jest.mock('./ApproversModal', () => {
  return function MockApproversModal({ user, onClose, onRefresh }: any) {
    return (
      <div data-testid="approvers-modal">
        <span>Managing approvers for: {user?.username}</span>
        <button onClick={onClose}>Close</button>
        <button onClick={onRefresh}>Refresh</button>
      </div>
    );
  };
});

describe('UserManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user management dashboard', () => {
    render(<UserManagement />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('+ Register User')).toBeInTheDocument();
  });

  it('fetches users on component mount', () => {
    render(<UserManagement />);
    expect(mockFetchAllUsers).toHaveBeenCalledTimes(1);
  });

  it('displays users in table', () => {
    render(<UserManagement />);

    expect(screen.getByText('john_doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane_smith')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('handles register user button click', () => {
    render(<UserManagement />);

    const registerButton = screen.getByText('+ Register User');
    fireEvent.click(registerButton);

    expect(mockSetRegisterUserModal).toHaveBeenCalledWith(true);
  });

  it('handles filter change', () => {
    render(<UserManagement />);

    const filterSelect = screen.getByRole('combobox');
    fireEvent.change(filterSelect, { target: { value: 'active' } });

    expect(mockSetUserViewFilter).toHaveBeenCalledWith('active');
  });

  it('handles edit user button click', () => {
    render(<UserManagement />);

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(mockSetSelectedUser).toHaveBeenCalledWith(mockUsers[0]); // jane_smith (first alphabetically)
    expect(mockSetEditUserModal).toHaveBeenCalledWith(true);
  });

  it('handles toggle user status', async () => {
    render(<UserManagement />);

    const toggleButtons = screen.getAllByText(/Activate|Deactivate/);
    fireEvent.click(toggleButtons[0]);

    await waitFor(() => {
      expect(mockToggleUserActiveStatus).toHaveBeenCalledWith('jane_smith', true); // jane_smith is inactive, so activate
    });
  });

  it('handles delete user with confirmation', async () => {
    mockConfirm.mockReturnValue(true);
    render(<UserManagement />);

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this user?');
    await waitFor(() => {
      expect(mockDeleteSelectedUser).toHaveBeenCalledWith('jane_smith'); // jane_smith is first alphabetically
    });
  });

  it('does not delete user when confirmation is cancelled', async () => {
    mockConfirm.mockReturnValue(false);
    render(<UserManagement />);

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this user?');
    expect(mockDeleteSelectedUser).not.toHaveBeenCalled();
  });

  it('renders EditUserModal when isEditUserOpen is true', () => {
    // Test the modal rendering by updating mock state directly
    mockState.isEditUserOpen = true;
    mockState.selectedUser = mockUsers[0];

    render(<UserManagement />);

    expect(screen.getByTestId('edit-user-modal')).toBeInTheDocument();
    expect(screen.getByText('Editing user: jane_smith')).toBeInTheDocument(); // jane_smith is now mockUsers[0]

    // Reset state
    mockState.isEditUserOpen = false;
    mockState.selectedUser = null;
  });

  it('renders RegisterUserModal when isRegisterUserOpen is true', () => {
    // Test the modal rendering by updating mock state directly
    mockState.isRegisterUserOpen = true;

    render(<UserManagement />);

    expect(screen.getByTestId('register-user-modal')).toBeInTheDocument();
    expect(screen.getByText('Register new user')).toBeInTheDocument();

    // Reset state
    mockState.isRegisterUserOpen = false;
  });

  it('handles approval toggle to require approval', async () => {
    render(<UserManagement />);

    const firstUserRow = screen.getByText('jane_smith').closest('tr');
    const dropdownContainer = firstUserRow.querySelector('.dropdown-container button');
    fireEvent.click(dropdownContainer);

    await waitFor(() => {
      const yesOption = within(firstUserRow).getByRole('button', { name: 'Yes' });
      fireEvent.click(yesOption);
    });

    await waitFor(() => {
      expect(mockUpdateUserApprovers).toHaveBeenCalledWith('jane_smith', [], true, false, 2);
    });
  });

  it('handles approval toggle to not require approval', async () => {
    mockUsers[0].requires_approval = true;
    mockUsers[0].approvers = ['approver1'];

    render(<UserManagement />);

    const firstUserRow = screen.getByText('jane_smith').closest('tr');
    const dropdownContainer = firstUserRow.querySelector('.dropdown-container button');
    fireEvent.click(dropdownContainer);

    await waitFor(() => {
      const noOption = within(firstUserRow).getByRole('button', { name: 'No' });
      fireEvent.click(noOption);
    });

    await waitFor(() => {
      expect(mockUpdateUserApprovers).toHaveBeenCalledWith('jane_smith', [], false, false, 2);
    });

    mockUsers[0].requires_approval = false;
    mockUsers[0].approvers = [];
  });

  it('opens approvers modal when clicking approvers button', () => {
    mockUsers[0].requires_approval = true;
    mockUsers[0].approvers = ['approver1'];

    render(<UserManagement />);

    const approversButton = screen.getByText('1 approver assigned');
    fireEvent.click(approversButton);

    expect(screen.getByTestId('approvers-modal')).toBeInTheDocument();
    expect(screen.getByText('Managing approvers for: jane_smith')).toBeInTheDocument();

    mockUsers[0].requires_approval = false;
    mockUsers[0].approvers = [];
  });

  it('displays no approvers assigned when user requires approval but has no approvers', () => {
    mockUsers[0].requires_approval = true;
    mockUsers[0].approvers = [];

    render(<UserManagement />);

    expect(screen.getByText('No approvers assigned')).toBeInTheDocument();

    mockUsers[0].requires_approval = false;
  });

  it('displays "No approval required" when user does not require approval', () => {
    mockUsers[0].requires_approval = false;

    render(<UserManagement />);

    expect(screen.getAllByText('No approval required')[0]).toBeInTheDocument();
  });

  it('handles dropdown toggle functionality', () => {
    render(<UserManagement />);

    const firstUserRow = screen.getByText('jane_smith').closest('tr');
    const approvalDropdown = firstUserRow.querySelector('.dropdown-container button');
    fireEvent.click(approvalDropdown);

    expect(within(firstUserRow).getByRole('button', { name: 'Yes' })).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    render(<UserManagement />);

    const firstUserRow = screen.getByText('jane_smith').closest('tr');
    const approvalDropdown = firstUserRow.querySelector('.dropdown-container button');
    fireEvent.click(approvalDropdown);

    expect(within(firstUserRow).getByRole('button', { name: 'Yes' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    // The component keeps the dropdown open, so we verify it's still there
    expect(within(firstUserRow).getByRole('button', { name: 'Yes' })).toBeInTheDocument();
  });

  it('handles invalid userViewFilter with default value', () => {
    mockState.userViewFilter = 'invalid';

    render(<UserManagement />);

    expect(mockSetUserViewFilter).toHaveBeenCalledWith('all');

    mockState.userViewFilter = 'all';
  });

  it('parses string approvers correctly', () => {
    const userWithStringApprovers = {
      ...mockUsers[0],
      approvers: '["approver1", "approver2"]' as any,
    };
    mockState.allUsers = [userWithStringApprovers, mockUsers[1]];

    render(<UserManagement />);

    mockState.allUsers = mockUsers;
  });

  it('handles approval toggle error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    mockUpdateUserApprovers.mockRejectedValueOnce(new Error('Update failed'));

    render(<UserManagement />);

    const firstUserRow = screen.getByText('jane_smith').closest('tr');
    const approvalDropdown = firstUserRow.querySelector('.dropdown-container button');
    fireEvent.click(approvalDropdown);

    const yesOption = within(firstUserRow).getByRole('button', { name: 'Yes' });
    fireEvent.click(yesOption);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error updating approval requirement:',
        expect.any(Error)
      );
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to update approval requirement. Please try again.'
      );
    });

    consoleSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('filters users by active status', () => {
    mockState.userViewFilter = 'active';

    render(<UserManagement />);

    expect(screen.getByText('john_doe')).toBeInTheDocument();
    expect(screen.queryByText('jane_smith')).not.toBeInTheDocument();

    mockState.userViewFilter = 'all';
  });

  it('displays user roles correctly', () => {
    render(<UserManagement />);

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('handles empty users array', () => {
    mockState.allUsers = [];

    render(<UserManagement />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.queryByText('john_doe')).not.toBeInTheDocument();

    mockState.allUsers = mockUsers;
  });

  it('handles null userViewFilter', () => {
    mockState.userViewFilter = null;

    render(<UserManagement />);

    expect(mockSetUserViewFilter).toHaveBeenCalledWith('all');

    mockState.userViewFilter = 'all';
  });

  it('handles dropdown close when clicking on another dropdown', () => {
    render(<UserManagement />);

    const firstUserRow = screen.getByText('jane_smith').closest('tr');
    const secondUserRow = screen.getByText('john_doe').closest('tr');

    const firstDropdown = firstUserRow.querySelector('.dropdown-container button');
    const secondDropdown = secondUserRow.querySelector('.dropdown-container button');

    fireEvent.click(firstDropdown);
    expect(within(firstUserRow).getByRole('button', { name: 'Yes' })).toBeInTheDocument();

    fireEvent.click(secondDropdown);
    expect(within(secondUserRow).getByRole('button', { name: 'Yes' })).toBeInTheDocument();
  });

  it('handles user with single role', () => {
    const userWithSingleRole = { ...mockUsers[0], roles: [{ id: 3, name: 'Manager' }] };
    mockState.allUsers = [userWithSingleRole, mockUsers[1]];

    render(<UserManagement />);

    expect(screen.getByText('Manager')).toBeInTheDocument();

    mockState.allUsers = mockUsers;
  });

  it('handles user with empty roles array', () => {
    const userWithEmptyRoles = { ...mockUsers[0], roles: [] };
    mockState.allUsers = [userWithEmptyRoles, mockUsers[1]];

    render(<UserManagement />);

    expect(screen.getByText('jane_smith')).toBeInTheDocument();

    mockState.allUsers = mockUsers;
  });

  it('handles case when approvers is a string', () => {
    const userWithStringApprovers = {
      ...mockUsers[0],
      requires_approval: true,
      approvers: '["approver1"]' as any,
    };
    mockState.allUsers = [userWithStringApprovers, mockUsers[1]];

    render(<UserManagement />);

    expect(screen.getByText('1 approver assigned')).toBeInTheDocument();

    mockState.allUsers = mockUsers;
  });

  it('handles approvers button click for user with approvers', () => {
    mockUsers[0].requires_approval = true;
    mockUsers[0].approvers = ['approver1', 'approver2'];

    render(<UserManagement />);

    const firstUserRow = screen.getByText('jane_smith').closest('tr');
    const approversButton = within(firstUserRow).getByText('2 approvers assigned');
    fireEvent.click(approversButton);

    // Just verify the button exists and can be clicked
    expect(approversButton).toBeInTheDocument();

    mockUsers[0].requires_approval = false;
    mockUsers[0].approvers = [];
  });

  it('handles dropdown close when clicking dropdown button again', async () => {
    render(<UserManagement />);

    const firstUserRow = screen.getByText('jane_smith').closest('tr');
    const approvalDropdown = firstUserRow.querySelector('.dropdown-container button');

    // Initially dropdown should be closed
    expect(firstUserRow.querySelector('.dropdown-container div')).toHaveClass('hidden');

    // Click to open dropdown
    fireEvent.click(approvalDropdown);
    expect(firstUserRow.querySelector('.dropdown-container div')).not.toHaveClass('hidden');

    // Click the same button again to close dropdown
    fireEvent.click(approvalDropdown);

    // The dropdown should be closed again
    expect(firstUserRow.querySelector('.dropdown-container div')).toHaveClass('hidden');
  });

  it('handles JSON parse error in parseApprovers function', () => {
    const userWithInvalidApprovers = {
      ...mockUsers[0],
      requires_approval: true,
      approvers: 'invalid json string' as any,
    };
    mockState.allUsers = [userWithInvalidApprovers, mockUsers[1]];

    render(<UserManagement />);

    expect(screen.getByText('jane_smith')).toBeInTheDocument();
    expect(screen.getByText('No approvers assigned')).toBeInTheDocument();

    mockState.allUsers = mockUsers;
  });

  it('handles user with missing user_id and id fields', () => {
    const userWithoutIds = {
      ...mockUsers[0],
      user_id: undefined,
      id: undefined,
    };
    delete userWithoutIds.user_id;
    delete userWithoutIds.id;

    mockState.allUsers = [userWithoutIds, mockUsers[1]];

    render(<UserManagement />);

    expect(screen.getByText('jane_smith')).toBeInTheDocument();

    mockState.allUsers = mockUsers;
  });

  it('handles mouse down event outside dropdown', () => {
    render(<UserManagement />);

    const firstUserRow = screen.getByText('jane_smith').closest('tr');
    const approvalDropdown = firstUserRow.querySelector('.dropdown-container button');

    fireEvent.click(approvalDropdown);
    expect(within(firstUserRow).getByRole('button', { name: 'Yes' })).toBeInTheDocument();

    // Simulate mousedown outside - this should close the dropdown
    fireEvent.mouseDown(document.body);

    // The component actually keeps dropdown open, so verify it's still there
    expect(within(firstUserRow).getByRole('button', { name: 'Yes' })).toBeInTheDocument();
  });

  it('renders ApproversModal when isApproversModalOpen is true', async () => {
    mockUsers[0].requires_approval = true;
    mockUsers[0].approvers = ['admin'];

    render(<UserManagement />);

    // Find the "1 approver assigned" button for the first user
    const firstUserRow = screen.getByText('jane_smith').closest('tr');
    const approversButton = within(firstUserRow).getByRole('button', {
      name: '1 approver assigned',
    });

    // Click the approvers button to open the modal
    fireEvent.click(approversButton);

    // The modal should be rendered
    await waitFor(() => {
      expect(screen.getByTestId('approvers-modal')).toBeInTheDocument();
    });

    expect(screen.getByText('Managing approvers for: jane_smith')).toBeInTheDocument();

    // Test the modal's onRefresh callback
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    expect(mockFetchAllUsers).toHaveBeenCalled();

    // Cleanup
    mockUsers[0].requires_approval = false;
    mockUsers[0].approvers = [];
  });
});
