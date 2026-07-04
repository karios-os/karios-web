import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApproversModal from './ApproversModal';

const mockUpdateUserApprovers = jest.fn();
const mockFetchApproversForUser = jest.fn();
const mockAllUsers = [
  {
    username: 'approver1',
    email: 'approver1@test.com',
    first_name: 'Approver',
    last_name: 'One',
    roles: [],
    approvers: [],
    requires_approval: false,
    user_id: 2,
    is_active: true,
  },
  {
    username: 'approver2',
    email: 'approver2@test.com',
    first_name: 'Approver',
    last_name: 'Two',
    roles: [],
    approvers: [],
    requires_approval: false,
    user_id: 3,
    is_active: true,
  },
  {
    username: 'approver3',
    email: 'approver3@test.com',
    first_name: 'Approver',
    last_name: 'Three',
    roles: [],
    approvers: [],
    requires_approval: false,
    user_id: 4,
    is_active: true,
  },
  {
    username: 'approver4',
    email: 'approver4@test.com',
    first_name: 'Approver',
    last_name: 'Four',
    roles: [],
    approvers: [],
    requires_approval: false,
    user_id: 5,
    is_active: true,
  },
];

jest.mock('@karios-monorepo/shared-state', () => ({
  useAppState: () => ({
    updateUserApprovers: mockUpdateUserApprovers,
    fetchApproversForUser: mockFetchApproversForUser,
    state: {
      allUsers: mockAllUsers,
    },
  }),
}));

describe('ApproversModal', () => {
  const mockUser = {
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    roles: [],
    approvers: [],
    requires_approval: false,
    user_id: 1,
    is_active: true,
  };

  const mockOnClose = jest.fn();
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchApproversForUser.mockResolvedValue({
      existing_approvals: [],
      remaining_approvers: ['approver1', 'approver2', 'approver3', 'approver4'],
    });
  });

  it('renders modal with correct title', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.getByText(/Manage Approvers:/)).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('loads and displays available approvers', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Approver One')).toBeInTheDocument();
      expect(screen.getByText('Approver Two')).toBeInTheDocument();
    });
  });

  it('toggles requires approval checkbox', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    expect(requiresApprovalCheckbox).not.toBeChecked();

    fireEvent.click(requiresApprovalCheckbox);
    expect(requiresApprovalCheckbox).toBeChecked();
  });

  it('shows approver selection when requires approval is enabled', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('0/3 selected')).toBeInTheDocument();
      expect(screen.getByText('Available:')).toBeInTheDocument();
    });
  });

  it('allows selecting approvers up to maximum limit', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Approver One')).toBeInTheDocument();
    });

    const approver1Checkbox = screen.getByLabelText(/Approver One/);
    const approver2Checkbox = screen.getByLabelText(/Approver Two/);
    const approver3Checkbox = screen.getByLabelText(/Approver Three/);

    fireEvent.click(approver1Checkbox);
    fireEvent.click(approver2Checkbox);
    fireEvent.click(approver3Checkbox);

    expect(screen.getByText('Max 3 reached')).toBeInTheDocument();
  });

  it('prevents selecting more than maximum approvers', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Approver One')).toBeInTheDocument();
    });

    const approver1Checkbox = screen.getByLabelText(/Approver One/);
    const approver2Checkbox = screen.getByLabelText(/Approver Two/);
    const approver3Checkbox = screen.getByLabelText(/Approver Three/);
    const approver4Checkbox = screen.getByLabelText(/Approver Four/);

    fireEvent.click(approver1Checkbox);
    fireEvent.click(approver2Checkbox);
    fireEvent.click(approver3Checkbox);

    expect(approver4Checkbox).toBeDisabled();
  });

  it('allows deselecting approvers', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Approver One')).toBeInTheDocument();
    });

    const approver1Checkbox = screen.getByLabelText(/Approver One/);
    fireEvent.click(approver1Checkbox);
    expect(screen.getByText('1/3 selected')).toBeInTheDocument();

    fireEvent.click(approver1Checkbox);
    expect(screen.getByText('0/3 selected')).toBeInTheDocument();
  });

  it('clears selected approvers when requires approval is disabled', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Approver One')).toBeInTheDocument();
    });

    const approver1Checkbox = screen.getByLabelText(/Approver One/);
    fireEvent.click(approver1Checkbox);

    fireEvent.click(requiresApprovalCheckbox);
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('0/3 selected')).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel button is clicked', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('saves approvers successfully', async () => {
    mockUpdateUserApprovers.mockResolvedValue({});

    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Approver One')).toBeInTheDocument();
    });

    const approver1Checkbox = screen.getByLabelText(/Approver One/);
    fireEvent.click(approver1Checkbox);

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateUserApprovers).toHaveBeenCalledWith(
        'testuser',
        ['approver1'],
        true,
        true,
        1
      );
      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('handles save error gracefully', async () => {
    mockUpdateUserApprovers.mockRejectedValue(new Error('Save failed'));
    window.alert = jest.fn();

    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to update approvers. Please try again.');
    });
  });

  it('displays existing approvers correctly', async () => {
    mockFetchApproversForUser.mockResolvedValue({
      existing_approvals: ['approver1'],
      remaining_approvers: ['approver2', 'approver3'],
    });

    const userWithRequiredApproval = { ...mockUser, requires_approval: true };
    render(
      <ApproversModal
        user={userWithRequiredApproval}
        onClose={mockOnClose}
        onRefresh={mockOnRefresh}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Current:')).toBeInTheDocument();
      expect(screen.getByText('Available:')).toBeInTheDocument();
    });
  });

  it('handles fetch approvers error gracefully', async () => {
    mockFetchApproversForUser.mockRejectedValue(new Error('Fetch failed'));

    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Approver One')).toBeInTheDocument();
    });
  });

  it('shows no users available when no approvers data is found', async () => {
    mockFetchApproversForUser.mockResolvedValue({
      existing_approvals: [],
      remaining_approvers: [],
    });

    const userWithRequiredApproval = { ...mockUser, requires_approval: true };
    render(
      <ApproversModal
        user={userWithRequiredApproval}
        onClose={mockOnClose}
        onRefresh={mockOnRefresh}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('No users available.')).toBeInTheDocument();
  });

  it('shows no users available when no data loaded', async () => {
    const originalMock = require('@karios-monorepo/shared-state');
    jest.doMock('@karios-monorepo/shared-state', () => ({
      useAppState: () => ({
        updateUserApprovers: mockUpdateUserApprovers,
        fetchApproversForUser: mockFetchApproversForUser,
        state: { allUsers: [] },
      }),
    }));

    mockFetchApproversForUser.mockResolvedValue({
      existing_approvals: [],
      remaining_approvers: [],
    });

    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.getByText('No users available.')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    jest.doMock('@karios-monorepo/shared-state', () => originalMock);
  });

  it('initializes with user existing approvers', async () => {
    const userWithApprovers = {
      ...mockUser,
      approvers: ['approver1'],
      requires_approval: true,
    };

    render(
      <ApproversModal user={userWithApprovers} onClose={mockOnClose} onRefresh={mockOnRefresh} />
    );

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /requires approval/i })).toBeChecked();
    });
  });

  it('prevents selecting already disabled approvers at maximum limit', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Approver One')).toBeInTheDocument();
    });

    const approver1Checkbox = screen.getByLabelText(/Approver One/);
    const approver2Checkbox = screen.getByLabelText(/Approver Two/);
    const approver3Checkbox = screen.getByLabelText(/Approver Three/);

    fireEvent.click(approver1Checkbox);
    fireEvent.click(approver2Checkbox);
    fireEvent.click(approver3Checkbox);

    const approver4Checkbox = screen.getByLabelText(/Approver Four/);
    expect(approver4Checkbox).toBeDisabled();

    fireEvent.click(approver4Checkbox);
    expect(approver4Checkbox).not.toBeChecked();
  });

  it('updates selected approvers count correctly', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('0/3 selected')).toBeInTheDocument();
    });

    const approver1Checkbox = screen.getByLabelText(/Approver One/);
    fireEvent.click(approver1Checkbox);

    expect(screen.getByText('1/3 selected')).toBeInTheDocument();
  });

  it('handles canSelectApprover function correctly', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Approver One')).toBeInTheDocument();
    });

    const approver1Checkbox = screen.getByLabelText(/Approver One/);
    expect(approver1Checkbox).toBeEnabled();

    fireEvent.click(approver1Checkbox);
    expect(approver1Checkbox).toBeChecked();
    expect(approver1Checkbox).toBeEnabled();
  });

  it('prevents adding approver when at maximum limit', async () => {
    render(<ApproversModal user={mockUser} onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const requiresApprovalCheckbox = screen.getByRole('checkbox', { name: /requires approval/i });
    fireEvent.click(requiresApprovalCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Approver One')).toBeInTheDocument();
    });

    const approver1Checkbox = screen.getByLabelText(/Approver One/);
    const approver2Checkbox = screen.getByLabelText(/Approver Two/);
    const approver3Checkbox = screen.getByLabelText(/Approver Three/);
    const approver4Checkbox = screen.getByLabelText(/Approver Four/);

    fireEvent.click(approver1Checkbox);
    fireEvent.click(approver2Checkbox);
    fireEvent.click(approver3Checkbox);

    expect(screen.getByText('Max 3 reached')).toBeInTheDocument();

    fireEvent.click(approver4Checkbox);
    expect(approver4Checkbox).not.toBeChecked();
    expect(screen.getByText('Max 3 reached')).toBeInTheDocument();
  });
});
