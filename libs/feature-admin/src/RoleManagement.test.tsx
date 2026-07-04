import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RoleManagement from './RoleManagement';

// Mock window.confirm
const mockConfirm = jest.fn();
global.confirm = mockConfirm;

// Mock the shared state context
const mockFetchRolesData = jest.fn();
const mockFetchPermissionsData = jest.fn();
const mockUpdateRoleForm = jest.fn();
const mockClearRoleForm = jest.fn();
const mockTogglePermission = jest.fn();
const mockSaveRole = jest.fn();
const mockRemoveRole = jest.fn();
const mockStartEditingRole = jest.fn();

const mockState = {
  roles: [
    { id: 1, name: 'Admin', role: 'administrator', description: 'Full access', default: false },
    { id: 2, name: 'User', role: 'user', description: 'Limited access', default: false },
  ],
  permissions: [
    { id: 1, name: 'read', description: 'Read permission' },
    { id: 2, name: 'write', description: 'Write permission' },
    { id: 3, name: 'delete', description: 'Delete permission' },
  ],
  roleForm: {
    name: '',
    role: '',
    description: '',
    Permissions: [],
  },
  editingRoleId: null,
};

jest.mock('@karios-monorepo/shared-state', () => ({
  useAppState: () => ({
    state: mockState,
    fetchRolesData: mockFetchRolesData,
    fetchPermissionsData: mockFetchPermissionsData,
    updateRoleForm: mockUpdateRoleForm,
    clearRoleForm: mockClearRoleForm,
    togglePermission: mockTogglePermission,
    saveRole: mockSaveRole,
    removeRole: mockRemoveRole,
    startEditingRole: mockStartEditingRole,
  }),
}));

describe('RoleManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockClear();

    // Reset mock state
    mockState.roles = [
      { id: 1, name: 'Admin', role: 'administrator', description: 'Full access', default: false },
      { id: 2, name: 'User', role: 'user', description: 'Limited access', default: false },
    ];
    mockState.permissions = [
      { id: 1, name: 'read', description: 'Read permission' },
      { id: 2, name: 'write', description: 'Write permission' },
      { id: 3, name: 'delete', description: 'Delete permission' },
    ];
    mockState.roleForm = {
      name: '',
      role: '',
      description: '',
      Permissions: [],
    };
    mockState.editingRoleId = null;
  });

  it('renders role management interface', () => {
    render(<RoleManagement />);

    expect(screen.getByText('Role Management')).toBeInTheDocument();
    expect(screen.getAllByText('Create Role')).toHaveLength(2); // heading and button
    expect(screen.getByText('Existing Roles')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Role Slug')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description')).toBeInTheDocument();
  });

  it('fetches roles and permissions data on mount', () => {
    render(<RoleManagement />);

    expect(mockFetchRolesData).toHaveBeenCalledTimes(1);
    expect(mockFetchPermissionsData).toHaveBeenCalledTimes(1);
  });

  it('displays existing roles', () => {
    render(<RoleManagement />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    // The role description and role slug are not displayed in the table, only the name
  });

  it('displays permissions checkboxes', () => {
    render(<RoleManagement />);

    expect(screen.getByLabelText('read')).toBeInTheDocument();
    expect(screen.getByLabelText('write')).toBeInTheDocument();
    expect(screen.getByLabelText('delete')).toBeInTheDocument();
  });

  it('updates role form when name input changes', () => {
    render(<RoleManagement />);

    const nameInput = screen.getByPlaceholderText('Name');
    fireEvent.change(nameInput, { target: { value: 'New Role' } });

    expect(mockUpdateRoleForm).toHaveBeenCalledWith({
      name: 'New Role',
      role: '',
      description: '',
      Permissions: [],
    });
  });

  it('updates role form when role slug input changes', () => {
    render(<RoleManagement />);

    const roleSlugInput = screen.getByPlaceholderText('Role Slug');
    fireEvent.change(roleSlugInput, { target: { value: 'new-role-slug' } });

    expect(mockUpdateRoleForm).toHaveBeenCalledWith({
      name: '',
      role: 'new-role-slug',
      description: '',
      Permissions: [],
    });
  });

  it('updates role form when description input changes', () => {
    render(<RoleManagement />);

    const descriptionInput = screen.getByPlaceholderText('Description');
    fireEvent.change(descriptionInput, { target: { value: 'New description' } });

    expect(mockUpdateRoleForm).toHaveBeenCalledWith({
      name: '',
      role: '',
      description: 'New description',
      Permissions: [],
    });
  });

  it('toggles permission when checkbox is clicked', () => {
    render(<RoleManagement />);

    const readCheckbox = screen.getByLabelText('read');
    fireEvent.click(readCheckbox);

    expect(mockTogglePermission).toHaveBeenCalledWith(1, 'read');
  });

  it('calls saveRole when create role button is clicked', async () => {
    mockSaveRole.mockResolvedValue({ success: true });

    render(<RoleManagement />);

    const createRoleButton = screen.getByRole('button', { name: 'Create Role' });
    fireEvent.click(createRoleButton);

    await waitFor(() => {
      expect(mockSaveRole).toHaveBeenCalledTimes(1);
    });
  });

  it('starts editing role when edit button is clicked', () => {
    render(<RoleManagement />);

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(mockStartEditingRole).toHaveBeenCalledWith({
      description: 'Full access',
      id: 1,
      name: 'Admin',
      role: 'administrator',
      default: false,
    });
  });

  it('shows delete confirmation and calls removeRole when confirmed', async () => {
    mockConfirm.mockReturnValue(true);
    mockRemoveRole.mockResolvedValue({ success: true });

    render(<RoleManagement />);

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this role?');

    await waitFor(() => {
      expect(mockRemoveRole).toHaveBeenCalledWith(1);
    });
  });

  it('does not call removeRole when delete is cancelled', () => {
    mockConfirm.mockReturnValue(false);

    render(<RoleManagement />);

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this role?');
    expect(mockRemoveRole).not.toHaveBeenCalled();
  });

  it('shows edit form when editing a role', () => {
    mockState.editingRoleId = 1;
    mockState.roleForm = {
      name: 'Admin',
      role: 'administrator',
      description: 'Full access',
      Permissions: [1, 2],
    };

    render(<RoleManagement />);

    expect(screen.getByText('Edit Role')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Admin')).toBeInTheDocument();
    expect(screen.getByDisplayValue('administrator')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Full access')).toBeInTheDocument();
  });

  it('displays form values from state', () => {
    mockState.roleForm = {
      name: 'Test Role',
      role: 'test-role',
      description: 'Test description',
      Permissions: [1, 3],
    };

    render(<RoleManagement />);

    expect(screen.getByDisplayValue('Test Role')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-role')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
  });

  it('shows selected permissions as checked', () => {
    mockState.roleForm = {
      name: '',
      role: '',
      description: '',
      Permissions: [
        { id: 1, name: 'read' },
        { id: 3, name: 'delete' },
      ], // read and delete permissions as objects
    };

    render(<RoleManagement />);

    const readCheckbox = screen.getByLabelText('read') as HTMLInputElement;
    const writeCheckbox = screen.getByLabelText('write') as HTMLInputElement;
    const deleteCheckbox = screen.getByLabelText('delete') as HTMLInputElement;

    expect(readCheckbox.checked).toBe(true);
    expect(writeCheckbox.checked).toBe(false);
    expect(deleteCheckbox.checked).toBe(true);
  });

  it('handles empty roles array', () => {
    mockState.roles = [];

    render(<RoleManagement />);

    expect(screen.getByText('Role Management')).toBeInTheDocument();
    expect(screen.getByText('Existing Roles')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('handles empty permissions array', () => {
    mockState.permissions = [];

    render(<RoleManagement />);

    expect(screen.getByText('Permissions:')).toBeInTheDocument();
    expect(screen.queryByLabelText('read')).not.toBeInTheDocument();
  });

  it('displays disabled edit and delete buttons for default roles', () => {
    mockState.roles = [
      { id: 1, name: 'Admin', role: 'administrator', description: 'Full access', default: true },
    ];

    render(<RoleManagement />);

    const editButton = screen.getByRole('button', { name: /edit/i });
    const deleteButton = screen.getByRole('button', { name: /delete/i });

    expect(editButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
    expect(editButton).toHaveClass('cursor-not-allowed');
    expect(deleteButton).toHaveClass('cursor-not-allowed');
  });

  it('displays enabled edit and delete buttons for non-default roles', () => {
    mockState.roles = [
      { id: 1, name: 'Admin', role: 'administrator', description: 'Full access', default: false },
    ];

    render(<RoleManagement />);

    const editButton = screen.getByRole('button', { name: /edit/i });
    const deleteButton = screen.getByRole('button', { name: /delete/i });

    expect(editButton).not.toBeDisabled();
    expect(deleteButton).not.toBeDisabled();
  });

  it('shows Update Role button text when editing', () => {
    mockState.editingRoleId = 1;

    render(<RoleManagement />);

    expect(screen.getByRole('button', { name: 'Update Role' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Role' })).not.toBeInTheDocument();
  });

  it('shows Cancel button when editing role', () => {
    mockState.editingRoleId = 1;

    render(<RoleManagement />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls clearRoleForm when Cancel button is clicked', () => {
    mockState.editingRoleId = 1;

    render(<RoleManagement />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(mockClearRoleForm).toHaveBeenCalledTimes(1);
  });

  it('does not show Cancel button when creating new role', () => {
    mockState.editingRoleId = null;

    render(<RoleManagement />);

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('displays No roles found message when roles array is empty', () => {
    mockState.roles = [];

    render(<RoleManagement />);

    expect(screen.getByText('No roles found.')).toBeInTheDocument();
  });
});
