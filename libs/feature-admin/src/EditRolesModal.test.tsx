import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EditRolesModal from './EditRolesModal';

const mockUpdateSelectedUserRoles = jest.fn();
jest.mock('@karios-monorepo/shared-state', () => ({
  useAppState: () => ({
    updateSelectedUserRoles: mockUpdateSelectedUserRoles,
  }),
}));

jest.mock('./RoleSelector', () => {
  return function MockRoleSelector({ selectedRole, setSelectedRole }: any) {
    return (
      <div data-testid="role-selector">
        <button onClick={() => setSelectedRole(3)} data-testid="select-role-button">
          Select Role
        </button>
        <div data-testid="selected-role">{selectedRole || 'none'}</div>
      </div>
    );
  };
});

describe('EditRolesModal', () => {
  const mockUser = {
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    roles: [{ id: 1, name: 'Admin' }],
    approvers: [],
    requires_approval: false,
    user_id: 1,
  };

  const mockOnClose = jest.fn();
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with correct structure', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.getByText(/Edit Role for User/)).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByTestId('role-selector')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('initializes with first role when user has roles', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.getByTestId('selected-role')).toHaveTextContent('1');
  });

  it('initializes with null when user has no roles', () => {
    const userWithNoRoles = { ...mockUser, roles: [] };
    render(
      <EditRolesModal user={userWithNoRoles} onClose={mockOnClose} onRefresh={mockOnRefresh} />
    );

    expect(screen.getByTestId('selected-role')).toHaveTextContent('none');
  });

  it('initializes with null when user roles is undefined', () => {
    const userWithUndefinedRoles = { ...mockUser, roles: undefined as any };
    render(
      <EditRolesModal
        user={userWithUndefinedRoles}
        onClose={mockOnClose}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByTestId('selected-role')).toHaveTextContent('none');
  });

  it('displays user form data correctly', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('updates selected role when RoleSelector changes', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const selectRoleButton = screen.getByTestId('select-role-button');
    fireEvent.click(selectRoleButton);

    expect(screen.getByTestId('selected-role')).toHaveTextContent('3');
  });

  it('closes modal when Cancel button is clicked', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls updateSelectedUserRoles with selected role when Save is clicked', async () => {
    mockUpdateSelectedUserRoles.mockResolvedValue({ success: true });

    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const selectRoleButton = screen.getByTestId('select-role-button');
    fireEvent.click(selectRoleButton);

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateSelectedUserRoles).toHaveBeenCalledWith('testuser', ['3']);
    });

    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('calls updateSelectedUserRoles with empty array when no role selected', async () => {
    mockUpdateSelectedUserRoles.mockResolvedValue({ success: true });
    const userWithNoRoles = { ...mockUser, roles: [] };

    render(
      <EditRolesModal user={userWithNoRoles} onClose={mockOnClose} onRefresh={mockOnRefresh} />
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateSelectedUserRoles).toHaveBeenCalledWith('testuser', []);
    });

    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('handles save error gracefully and logs error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Save failed');
    mockUpdateSelectedUserRoles.mockRejectedValue(error);

    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateSelectedUserRoles).toHaveBeenCalled();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error updating user:', error);
    expect(mockOnRefresh).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('renders blurred background overlay', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const overlay = document.querySelector('.backdrop-blur-sm');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass('bg-opacity-50');
  });

  it('renders modal with proper styling classes', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const modal = document.querySelector('.bg-gray-100');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveClass('rounded', 'shadow-lg', 'w-[500px]');
  });

  it('renders Cancel button with proper styling', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toHaveClass('px-4', 'py-2', 'bg-gray-300', 'rounded');
  });

  it('renders Save button with proper styling', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const saveButton = screen.getByText('Save');
    expect(saveButton).toHaveClass('px-4', 'py-2', 'bg-karios-green', 'text-white', 'rounded');
  });

  it('handles multiple role changes before saving', async () => {
    mockUpdateSelectedUserRoles.mockResolvedValue({ success: true });

    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const selectRoleButton = screen.getByTestId('select-role-button');
    fireEvent.click(selectRoleButton);
    fireEvent.click(selectRoleButton);

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateSelectedUserRoles).toHaveBeenCalledWith('testuser', ['3']);
    });
  });

  it('preserves user data in form state during interactions', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const selectRoleButton = screen.getByTestId('select-role-button');
    fireEvent.click(selectRoleButton);

    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('handles user with multiple roles correctly', () => {
    const userWithMultipleRoles = {
      ...mockUser,
      roles: [
        { id: 1, name: 'Admin' },
        { id: 2, name: 'User' },
        { id: 3, name: 'Moderator' },
      ],
    };

    render(
      <EditRolesModal
        user={userWithMultipleRoles}
        onClose={mockOnClose}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByTestId('selected-role')).toHaveTextContent('1');
  });

  it('handles async save operation correctly', async () => {
    const savePromise = Promise.resolve({ success: true });
    mockUpdateSelectedUserRoles.mockReturnValue(savePromise);

    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await savePromise;

    expect(mockUpdateSelectedUserRoles).toHaveBeenCalledTimes(1);
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders heading with proper text structure', () => {
    render(<EditRolesModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const heading = screen.getByRole('heading');
    expect(heading).toHaveTextContent('Edit Role for User : testuser');
    expect(heading).toHaveClass('text-xl', 'font-semibold', 'mb-2');
  });
});
