import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import SMBStorage from './SMBStorage';

// Mock the runtime configuration
jest.mock('../../../../runtime-config', () => ({
  __esModule: true,
  default: () => ({
    ENVIRONMENT: 'test',
    PROTOCOL: 'http',
    CONTROL_NODE_IP: {
      URL: '192.168.1.100',
      PORT: ':8080',
    },
  }),
}));

// Mock the API module
jest.mock('@karios-monorepo/shared-state', () => ({
  api: {
    fetch: jest.fn(),
  },
}));

// Mock the approval flow hook
jest.mock('../../../shared-state/src/hooks/useApprovalFlow', () => ({
  useApprovalFlow: jest.fn(),
}));

// Mock the ApprovalModal component
jest.mock('../../../shared-state/src/components/ApprovalModal', () => {
  return function MockApprovalModal(props: any) {
    return null;
  };
});

// Mock the Modal and DataTable components
jest.mock('../../../feature-server/src/widgets/Modal', () => {
  return function MockModal({ isOpen, onClose, title, children, width }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid={`modal-${title.replace(/\s+/g, '-').toLowerCase()}`} data-width={width}>
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
        {children}
      </div>
    );
  };
});

jest.mock('../../../feature-server/src/widgets/DataTable', () => {
  return function MockDataTable({ data, columns, hoverable, className, maxHeight }: any) {
    return (
      <div
        data-testid="data-table"
        data-hoverable={hoverable}
        data-classname={className}
        data-maxheight={maxHeight}
      >
        {data.map((item: any, index: number) => (
          <div key={index} data-testid={`table-row-${index}`}>
            {columns.map((col: any, colIndex: number) => (
              <div key={colIndex} data-testid={`cell-${col.key}`}>
                {col.render ? col.render(item[col.key], item) : item[col.key]}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('../../../feature-server/src/widgets/Tooltip', () => {
  return function MockTooltip({ text }: any) {
    return (
      <span data-testid="tooltip" title={text}>
        ?
      </span>
    );
  };
});

// Mock Trash icon from iconsax-react
jest.mock('iconsax-react', () => ({
  Trash: ({ color, size }: any) => (
    <div data-testid="trash-icon" data-color={color} data-size={size}>
      🗑️
    </div>
  ),
}));

// Import mocked modules
const { api } = require('@karios-monorepo/shared-state');
const { useApprovalFlow } = require('../../../shared-state/src/hooks/useApprovalFlow');

describe('SMBStorage Component - Comprehensive Test Suite', () => {
  const mockStorageData = [
    {
      user: 'testuser',
      netbios: 'DESKTOP-TEST',
      share: '/test/share',
      size: '100GB',
      used: '50GB',
      available: '50GB',
      capacity: '50%',
      mounted_on: '/mnt/smb1',
    },
    {
      user: 'testuser2',
      netbios: 'DESKTOP-TEST2',
      share: ' /test/share2 ', // Test trimming
      size: '200GB',
      used: '100GB',
      available: '100GB',
      capacity: '50%',
      mounted_on: '0',
    },
    {
      // Test item with missing fields
      user: '',
      netbios: null,
      share: '',
      size: null,
      used: undefined,
      available: '',
      capacity: '',
      mounted_on: null,
    },
    {
      // Test legacy field names
      user: 'legacy-user',
      netbios: 'LEGACY-PC',
      share: '/legacy/share',
      size: '500GB',
      used: '250GB',
      available: '250GB',
      capacity: '50%',
      mount_point: '/mnt/legacy',
      filesystem: 'cifs',
      fstype: 'cifs',
      options: 'rw,relatime',
      source: '//192.168.1.200/legacy',
    },
  ];

  const mockExecuteWithApproval = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock api.fetch
    api.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockStorageData),
    });

    // Mock useApprovalFlow hook
    useApprovalFlow.mockReturnValue({
      executeWithApproval: mockExecuteWithApproval.mockImplementation((callback) => callback()),
      isModalOpen: false,
      modalProps: {},
    });
  });

  // Test 1: Initial render and component structure
  test('renders component with all essential elements', async () => {
    render(<SMBStorage />);

    expect(screen.getByText('SMB Storage')).toBeInTheDocument();
    expect(screen.getByText('Mount SMB/CIFS Storage')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledWith('http://192.168.1.100:8080/api/v1/storageclient/smb');
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // Test 2: Handle 204 No Content response
  test('handles empty storage data (204 status)', async () => {
    api.fetch.mockResolvedValue({
      ok: true,
      status: 204,
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByText('No SMB storage items found')).toBeInTheDocument();
    });
  });

  // Test 3: Handle API errors and non-array responses
  test('handles fetch errors and non-array responses', async () => {
    // Test non-array response first
    api.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'Not an array' }),
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByText('No SMB storage items found')).toBeInTheDocument();
    });
  });

  // Test 4: Handle network errors
  test('handles network errors during data fetch', async () => {
    api.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load SMB storage data/)).toBeInTheDocument();
    });
  });

  // Test 5: Mount modal opening and form structure
  test('opens mount modal with correct form elements', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    expect(screen.getByTestId('modal-mount-smb-storage')).toBeInTheDocument();
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Mount SMB Storage');
    expect(screen.getByLabelText('ID')).toBeInTheDocument();
    expect(screen.getByLabelText('NetBIOS Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Server')).toBeInTheDocument();
    expect(screen.getByLabelText('Share')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  // Test 6: Form submission with successful mount
  test('submits mount form successfully', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    await user.type(screen.getByLabelText('ID'), 'testid');
    await user.type(screen.getByLabelText('NetBIOS Name'), 'TEST-PC');
    await user.type(screen.getByLabelText('Server'), '192.168.1.100');
    await user.type(screen.getByLabelText('Share'), 'shared-folder');
    await user.type(screen.getByLabelText('Username'), 'testuser');
    await user.type(screen.getByLabelText('Password'), 'testpass');

    api.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await user.click(screen.getByText('Submit'));

    expect(mockExecuteWithApproval).toHaveBeenCalledWith(expect.any(Function), 'Mount SMB Storage');
  });

  // Test 7: Handle mount form submission error
  test('handles mount form submission error', async () => {
    const user = userEvent.setup();

    // Mock the approval flow to execute the callback and throw an error
    mockExecuteWithApproval.mockImplementationOnce(async (callback) => {
      api.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      await callback();
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    await user.type(screen.getByLabelText('ID'), 'test-id');
    await user.type(screen.getByLabelText('NetBIOS Name'), 'TEST-PC');
    await user.type(screen.getByLabelText('Server'), '192.168.1.100');
    await user.type(screen.getByLabelText('Share'), 'shared-folder');
    await user.type(screen.getByLabelText('Username'), 'testuser');
    await user.type(screen.getByLabelText('Password'), 'testpass');

    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-error')).toBeInTheDocument();
    });
  });

  // Test 8: Unmount confirmation modal functionality
  test('opens unmount modal with correct content', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    const unmountButtons = screen.getAllByLabelText('Unmount');
    await user.click(unmountButtons[0]);

    expect(screen.getByTestId('modal-confirm-unmount')).toBeInTheDocument();
    expect(screen.getByText('Confirm Unmount')).toBeInTheDocument();
    expect(screen.getAllByText('/mnt/smb1')).toHaveLength(2);
    expect(screen.getByLabelText('Force unmount')).toBeInTheDocument();
  });

  // Test 9: Force unmount toggle functionality
  test('toggles force unmount checkbox correctly', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    const unmountButtons = screen.getAllByLabelText('Unmount');
    await user.click(unmountButtons[0]);

    const forceCheckbox = screen.getByLabelText('Force unmount');
    expect(forceCheckbox).not.toBeChecked();

    await user.click(forceCheckbox);
    expect(forceCheckbox).toBeChecked();
  });

  // Test 10: Successful unmount operation
  test('performs unmount operation successfully', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    const unmountButtons = screen.getAllByLabelText('Unmount');
    await user.click(unmountButtons[0]);

    const forceCheckbox = screen.getByLabelText('Force unmount');
    await user.click(forceCheckbox);

    api.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    await user.click(screen.getByText('Unmount'));

    expect(mockExecuteWithApproval).toHaveBeenCalledWith(
      expect.any(Function),
      'Unmount SMB Storage'
    );
  });

  // Test 11: Cancel unmount operation
  test('cancels unmount operation correctly', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    const unmountButtons = screen.getAllByLabelText('Unmount');
    await user.click(unmountButtons[0]);

    expect(screen.getByTestId('modal-confirm-unmount')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('modal-confirm-unmount')).not.toBeInTheDocument();
  });

  // Test 12: Close unmount modal with X button
  test('closes unmount modal with close button', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    const unmountButtons = screen.getAllByLabelText('Unmount');
    await user.click(unmountButtons[0]);

    expect(screen.getByTestId('modal-confirm-unmount')).toBeInTheDocument();

    await user.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('modal-confirm-unmount')).not.toBeInTheDocument();
  });

  // Test 13: Storage type change functionality
  test('handles storage type change when callback provided', async () => {
    const mockOnStorageTypeChange = jest.fn();
    const user = userEvent.setup();

    render(<SMBStorage onStorageTypeChange={mockOnStorageTypeChange} currentStorageType="smb" />);

    const selectElement = screen.getByDisplayValue('SMB/CIFS');
    await user.selectOptions(selectElement, 'nfs');

    expect(mockOnStorageTypeChange).toHaveBeenCalledWith('nfs');
  });

  // Test 14: Render without storage type change functionality
  test('renders correctly without storage type change callback', async () => {
    render(<SMBStorage />);

    expect(screen.getByText('SMB Storage')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('SMB/CIFS')).not.toBeInTheDocument();
  });

  // Test 15: Table rendering with different mount states
  test('renders table with correct mount/unmount buttons', async () => {
    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Check mounted item shows unmount button
    const unmountButtons = screen.getAllByLabelText('Unmount');
    expect(unmountButtons).toHaveLength(1);

    // Check unmounted items show mount button
    const mountButtons = screen
      .getAllByText('Mount')
      .filter((button) => button.className.includes('border-gray-300'));
    expect(mountButtons).toHaveLength(3);
  });

  // Test 16: Handle unmount error
  test('handles unmount error correctly', async () => {
    const user = userEvent.setup();

    // Mock the approval flow to execute callback and simulate error
    mockExecuteWithApproval.mockImplementationOnce(async (callback) => {
      api.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      await callback();
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    const unmountButtons = screen.getAllByLabelText('Unmount');
    await user.click(unmountButtons[0]);

    await user.click(screen.getByText('Unmount'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-error')).toBeInTheDocument();
    });
  });

  // Test 17: Close alert modal functionality
  test('closes alert modal correctly', async () => {
    const user = userEvent.setup();

    // Mock error in mount operation
    mockExecuteWithApproval.mockImplementationOnce(async (callback) => {
      api.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      await callback();
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    await user.type(screen.getByLabelText('ID'), 'test-id');
    await user.type(screen.getByLabelText('NetBIOS Name'), 'TEST-PC');
    await user.type(screen.getByLabelText('Server'), '192.168.1.100');
    await user.type(screen.getByLabelText('Share'), 'shared-folder');
    await user.type(screen.getByLabelText('Username'), 'testuser');
    await user.type(screen.getByLabelText('Password'), 'testpass');

    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-error')).toBeInTheDocument();
    });

    await user.click(screen.getByText('OK'));
    expect(screen.queryByTestId('modal-error')).not.toBeInTheDocument();
  });

  // Test 18: Handle data with missing fields
  test('handles storage data with missing and null fields', async () => {
    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Check that empty values are rendered as dashes
    const dashElements = screen.getAllByText('-');
    expect(dashElements.length).toBeGreaterThan(0);
  });

  // Test 19: Handle trimmed share names
  test('handles and trims share names correctly', async () => {
    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // The share with spaces should be trimmed in the render
    expect(screen.getByText('/test/share2')).toBeInTheDocument();
  });

  // Test 20: Test legacy field compatibility
  test('handles legacy field names for backward compatibility', async () => {
    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Check that legacy user is displayed
    expect(screen.getByText('legacy-user')).toBeInTheDocument();
  });

  // Test 21: Test loading state
  test('displays loading state correctly', async () => {
    // Mock a delayed response
    api.fetch.mockReturnValue(new Promise(() => {})); // Never resolves

    render(<SMBStorage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // Test 22: Test successful API response with success alert
  test('shows success alert after successful mount', async () => {
    const user = userEvent.setup();

    // Mock successful mount with alert
    mockExecuteWithApproval.mockImplementationOnce(async (callback) => {
      api.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
      await callback();
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    await user.type(screen.getByLabelText('ID'), 'testid');
    await user.type(screen.getByLabelText('NetBIOS Name'), 'TEST-PC');
    await user.type(screen.getByLabelText('Server'), '192.168.1.100');
    await user.type(screen.getByLabelText('Share'), 'shared-folder');
    await user.type(screen.getByLabelText('Username'), 'testuser');
    await user.type(screen.getByLabelText('Password'), 'testpass');

    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-success')).toBeInTheDocument();
    });
  });

  // Test 23: Test checkbox state management
  test('manages checkbox states correctly in mount form', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    const autoMountCheckbox = screen.getByRole('checkbox', { name: 'Auto Mount on Restart' });
    const datastoreCheckbox = screen.getByRole('checkbox', { name: /Add to Datastore/ });

    expect(autoMountCheckbox).toBeChecked();
    expect(datastoreCheckbox).toBeChecked();

    await user.click(autoMountCheckbox);
    expect(autoMountCheckbox).not.toBeChecked();

    await user.click(datastoreCheckbox);
    expect(datastoreCheckbox).not.toBeChecked();
  });

  // Test 24: Test tooltip presence
  test('renders tooltips for form fields', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    const tooltips = screen.getAllByTestId('tooltip');
    expect(tooltips.length).toBeGreaterThan(0);
  });

  // Test 25: Test mount button for unmounted items
  test('handles mount button click for unmounted items', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Click mount button for unmounted item
    const mountButtons = screen
      .getAllByText('Mount')
      .filter((button) => button.className.includes('border-gray-300'));

    await user.click(mountButtons[0]);

    expect(screen.getByTestId('modal-mount-smb-storage')).toBeInTheDocument();
  });

  // Test 26: Test error state display
  test('displays error state correctly', async () => {
    api.fetch.mockRejectedValueOnce(new Error('Connection failed'));

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load SMB storage data/)).toBeInTheDocument();
    });
  });

  // Test 27: Test successful unmount with success alert
  test('shows success alert after successful unmount', async () => {
    const user = userEvent.setup();

    // Mock successful unmount
    mockExecuteWithApproval.mockImplementationOnce(async (callback) => {
      api.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      await callback();
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    const unmountButtons = screen.getAllByLabelText('Unmount');
    await user.click(unmountButtons[0]);

    await user.click(screen.getByText('Unmount'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-success')).toBeInTheDocument();
    });
  });

  // Test 28: Test form input validation
  test('validates required form inputs', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    const idInput = screen.getByLabelText('ID');
    const netbiosInput = screen.getByLabelText('NetBIOS Name');
    const serverInput = screen.getByLabelText('Server');
    const shareInput = screen.getByLabelText('Share');
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');

    expect(idInput).toHaveAttribute('required');
    expect(netbiosInput).toHaveAttribute('required');
    expect(serverInput).toHaveAttribute('required');
    expect(shareInput).toHaveAttribute('required');
    expect(usernameInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('required');
  });

  // Test 29: Test mount status display for different scenarios
  test('displays mount status correctly for different scenarios', async () => {
    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Check mounted status
    expect(screen.getByText('/mnt/smb1')).toHaveTextContent('/mnt/smb1');

    // Check not mounted status
    const notMountedElements = screen.getAllByText('Not Mounted');
    expect(notMountedElements.length).toBeGreaterThan(0);
  });

  // Test 30: Test component re-render and state persistence
  test('maintains state correctly during re-renders', async () => {
    const { rerender } = render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Re-render with props
    rerender(<SMBStorage currentStorageType="nfs" />);

    // Component should still render correctly
    expect(screen.getByText('SMB Storage')).toBeInTheDocument();
  });

  // Test 31: Test modal close functionality
  test('closes mount modal correctly', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    expect(screen.getByTestId('modal-mount-smb-storage')).toBeInTheDocument();

    await user.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('modal-mount-smb-storage')).not.toBeInTheDocument();
  });

  // Test 32: Test empty data array handling
  test('handles empty data array correctly', async () => {
    api.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByText('No SMB storage items found')).toBeInTheDocument();
    });
  });

  // Test 33: Test API response with non-OK status
  test('handles non-OK API responses', async () => {
    api.fetch.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load SMB storage data/)).toBeInTheDocument();
    });
  });

  // Test 34: Test approval flow with approver parameter
  test('handles approval flow with approver parameter', async () => {
    const user = userEvent.setup();

    // Mock approval flow that passes approver
    mockExecuteWithApproval.mockImplementationOnce(async (callback) => {
      await callback('test-approver');
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    await user.type(screen.getByLabelText('ID'), 'testid');
    await user.type(screen.getByLabelText('NetBIOS Name'), 'TEST-PC');
    await user.type(screen.getByLabelText('Server'), '192.168.1.100');
    await user.type(screen.getByLabelText('Share'), 'shared-folder');
    await user.type(screen.getByLabelText('Username'), 'testuser');
    await user.type(screen.getByLabelText('Password'), 'testpass');

    api.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledWith(
        expect.stringContaining('approver=test-approver'),
        expect.any(Object)
      );
    });
  });

  // Test 35: Test unmount with approver parameter
  test('handles unmount with approval flow and approver', async () => {
    const user = userEvent.setup();

    // Mock approval flow that passes approver
    mockExecuteWithApproval.mockImplementationOnce(async (callback) => {
      await callback('test-approver');
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    const unmountButtons = screen.getAllByLabelText('Unmount');
    await user.click(unmountButtons[0]);

    api.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    await user.click(screen.getByText('Unmount'));

    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledWith(
        expect.stringContaining('approver=test-approver'),
        expect.any(Object)
      );
    });
  });

  // Test 36: Test data table columns configuration
  test('renders data table with correct column configuration', async () => {
    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Check that data table is rendered with correct attributes
    const dataTable = screen.getByTestId('data-table');
    expect(dataTable).toHaveAttribute('data-hoverable', 'true');
    expect(dataTable).toHaveAttribute('data-classname', 'p-0');
    expect(dataTable).toHaveAttribute('data-maxheight', '500px');
  });

  // Test 37: Test storage options availability
  test('renders all storage type options when callback provided', async () => {
    const mockOnStorageTypeChange = jest.fn();

    render(<SMBStorage onStorageTypeChange={mockOnStorageTypeChange} currentStorageType="smb" />);

    const selectElement = screen.getByDisplayValue('SMB/CIFS');

    // Check that all options are present
    expect(screen.getByRole('option', { name: 'MooseFS' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'S3' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'iSCSI' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'NFS' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SMB/CIFS' })).toBeInTheDocument();
  });

  // Test 38: Test trash icon rendering
  test('renders trash icon in unmount buttons', async () => {
    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    const trashIcon = screen.getByTestId('trash-icon');
    expect(trashIcon).toBeInTheDocument();
    expect(trashIcon).toHaveAttribute('data-color', '#FFFFFF');
    expect(trashIcon).toHaveAttribute('data-size', '16');
  });

  // Test 39: Test form reset on modal open
  test('resets form when opening modal for new mount', async () => {
    const user = userEvent.setup();

    render(<SMBStorage />);

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    // Fill form
    await user.type(screen.getByLabelText('ID'), 'test-id');

    // Close modal
    await user.click(screen.getByTestId('modal-close'));

    // Reopen modal
    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    // Check that ID field is empty (defaultValue="")
    expect(screen.getByLabelText('ID')).toHaveValue('');
  });

  // Test 40: Test console error logging
  test('logs console errors for failed operations', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const user = userEvent.setup();

    // Mock error in mount operation
    mockExecuteWithApproval.mockImplementationOnce(async (callback) => {
      const error = new Error('Mount failed');
      api.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      await callback();
    });

    render(<SMBStorage />);

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mount SMB/CIFS Storage'));

    await user.type(screen.getByLabelText('ID'), 'test-id');
    await user.type(screen.getByLabelText('NetBIOS Name'), 'TEST-PC');
    await user.type(screen.getByLabelText('Server'), '192.168.1.100');
    await user.type(screen.getByLabelText('Share'), 'shared-folder');
    await user.type(screen.getByLabelText('Username'), 'testuser');
    await user.type(screen.getByLabelText('Password'), 'testpass');

    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error mounting SMB storage:',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });
});
