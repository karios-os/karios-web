import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Network from './network';

// Mock dependencies
jest.mock('@karios-monorepo/shared-state', () => ({
  usePermissions: jest.fn(),
  useAppState: jest.fn(),
}));

jest.mock('../../shared-state/src/utils/interceptor', () => ({
  fetch: jest.fn(),
}));

jest.mock('./widgets/Modal', () => {
  return function MockModal({ isOpen, onClose, title, children }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <button onClick={onClose} data-testid="modal-close">
          Close
        </button>
        {children}
      </div>
    );
  };
});

jest.mock('../../../apps/karios-gui/src/Components/NetworkStatusBadges', () => {
  return function MockNetworkStatusBadges({ active, private: isPrivate }: any) {
    return (
      <div data-testid="network-status-badges">
        <span data-testid="active-status">{active}</span>
        <span data-testid="private-status">{isPrivate}</span>
      </div>
    );
  };
});

// Mock window.alert and window.confirm
const mockAlert = jest.fn();
const mockConfirm = jest.fn();
global.alert = mockAlert;
global.confirm = mockConfirm;

const mockUsePermissions = require('@karios-monorepo/shared-state').usePermissions as jest.Mock;
const mockUseAppState = require('@karios-monorepo/shared-state').useAppState as jest.Mock;
const mockApi = require('../../shared-state/src/utils/interceptor') as { fetch: jest.Mock };

describe('Network', () => {
  const mockSelectedServer = {
    ip: '192.168.1.100',
    name: 'test-server',
  };

  const mockInterfaces = ['eth0', 'eth1', 'wlan0'];
  const mockSwitches = [
    {
      name: 'vmbr0',
      private: 'yes',
      active: 'yes',
      interface: 'eth0',
    },
    {
      name: 'vmbr1',
      private: 'no',
      active: 'no',
      interface: 'eth1',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePermissions.mockReturnValue({
      permissions: {
        NETWORK_VIEW: true,
        NETWORK_MANAGE: true,
      },
    });

    mockUseAppState.mockReturnValue({
      state: { selectedServer: mockSelectedServer },
    });

    // Mock successful API responses
    mockApi.fetch.mockImplementation((url: string) => {
      if (url.includes('/interfaces')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockInterfaces,
        });
      }
      if (url.includes('/switches')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSwitches,
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  // Test 1: Component renders correctly when user has NETWORK_VIEW permission
  it('renders network management interface when user has NETWORK_VIEW permission', async () => {
    await act(async () => {
      render(<Network />);
    });

    expect(screen.getByText('Network Management - Interface')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Interface')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Interface : eth0')).toBeInTheDocument();
    });
  });

  // Test 2: Component does not render when user lacks NETWORK_VIEW permission
  it('does not render when user lacks NETWORK_VIEW permission', () => {
    mockUsePermissions.mockReturnValue({
      permissions: { NETWORK_VIEW: false },
    });

    render(<Network />);

    expect(screen.queryByText('Network Management - Interface')).not.toBeInTheDocument();
  });

  // Test 3: Dropdown switches between interfaces and switches view
  it('switches between interfaces and switches view when dropdown changes', async () => {
    await act(async () => {
      render(<Network />);
    });

    await waitFor(() => {
      expect(screen.getByText('Network Management - Interface')).toBeInTheDocument();
    });

    const dropdown = screen.getByDisplayValue('Interface');
    await act(async () => {
      fireEvent.change(dropdown, { target: { value: 'switches' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Network Management - Switches')).toBeInTheDocument();
    });
  });

  // Test 4: Interfaces are fetched and displayed correctly
  it('fetches and displays network interfaces correctly', async () => {
    await act(async () => {
      render(<Network />);
    });

    await waitFor(() => {
      expect(mockApi.fetch).toHaveBeenCalledWith(
        'http://192.168.1.100:8080/api/v1/network/interfaces'
      );
      expect(screen.getByText('Interface : eth0')).toBeInTheDocument();
      expect(screen.getByText('Interface : eth1')).toBeInTheDocument();
      expect(screen.getByText('Interface : wlan0')).toBeInTheDocument();
    });
  });

  // Test 5: Switches are fetched and displayed correctly in switches view
  it('fetches and displays switches correctly in switches view', async () => {
    await act(async () => {
      render(<Network />);
    });

    const dropdown = screen.getByDisplayValue('Interface');
    await act(async () => {
      fireEvent.change(dropdown, { target: { value: 'switches' } });
    });

    await waitFor(() => {
      expect(mockApi.fetch).toHaveBeenCalledWith(
        'http://192.168.1.100:8080/api/v1/network/switches'
      );
      expect(screen.getByText('vmbr0')).toBeInTheDocument();
      expect(screen.getByText('vmbr1')).toBeInTheDocument();
      expect(screen.getByText('Interface : eth0')).toBeInTheDocument();
      expect(screen.getByText('Interface : eth1')).toBeInTheDocument();
    });
  });

  // Test 6: Create Switch button shows modal when user has NETWORK_MANAGE permission
  it('shows create switch modal when create button is clicked', async () => {
    render(<Network />);

    const dropdown = screen.getByDisplayValue('Interface');
    fireEvent.change(dropdown, { target: { value: 'switches' } });

    await waitFor(() => {
      const createButton = screen.getByText('Create Switch');
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Create Switch');
    });
  });

  // Test 7: Create Switch button is hidden when user lacks NETWORK_MANAGE permission
  it('hides create switch button when user lacks NETWORK_MANAGE permission', async () => {
    mockUsePermissions.mockReturnValue({
      permissions: {
        NETWORK_VIEW: true,
        NETWORK_MANAGE: false,
      },
    });

    render(<Network />);

    const dropdown = screen.getByDisplayValue('Interface');
    fireEvent.change(dropdown, { target: { value: 'switches' } });

    await waitFor(() => {
      expect(screen.queryByText('Create Switch')).not.toBeInTheDocument();
    });
  });

  // Test 8: Create switch form validation and successful creation
  it('creates switch successfully with valid inputs', async () => {
    mockApi.fetch.mockImplementation((url: string, options?: any) => {
      if (options?.method === 'POST' && url.includes('/switch')) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      if (url.includes('/interfaces')) {
        return Promise.resolve({ ok: true, json: async () => mockInterfaces });
      }
      if (url.includes('/switches')) {
        return Promise.resolve({ ok: true, json: async () => mockSwitches });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await act(async () => {
      render(<Network />);
    });

    const dropdown = screen.getByDisplayValue('Interface');
    await act(async () => {
      fireEvent.change(dropdown, { target: { value: 'switches' } });
    });

    await waitFor(() => {
      const createButton = screen.getByText('Create Switch');
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('enter');
      const interfaceSelect = screen.getByDisplayValue('Select Interface');

      fireEvent.change(nameInput, { target: { value: 'test-switch' } });
      fireEvent.change(interfaceSelect, { target: { value: 'eth0' } });
    });

    // Use more specific selector for the modal's create button
    const buttons = screen.getAllByRole('button', { name: 'Create Switch' });
    const modalButton = buttons.find((button) => button.className.includes('bg-karios-blue'));

    await act(async () => {
      fireEvent.click(modalButton!);
    });

    await waitFor(() => {
      expect(mockApi.fetch).toHaveBeenCalledWith(
        'http://192.168.1.100:8080/api/v1/network/switch',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'test-switch',
            interface: 'eth0',
          }),
        })
      );
      expect(mockAlert).toHaveBeenCalledWith('Switch created successfully!');
    });
  });

  // Test 9: Create switch form validation for empty inputs
  it('shows error alert for empty switch name or interface', async () => {
    await act(async () => {
      render(<Network />);
    });

    const dropdown = screen.getByDisplayValue('Interface');
    await act(async () => {
      fireEvent.change(dropdown, { target: { value: 'switches' } });
    });

    await waitFor(() => {
      const createButton = screen.getByText('Create Switch');
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: 'Create Switch' });
      const modalButton = buttons.find((button) => button.className.includes('bg-karios-blue'));
      fireEvent.click(modalButton!);
    });

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Please provide both switch name and interface.');
    });
  });

  // Test 10: Delete switch functionality with confirmation
  it('deletes switch successfully after confirmation', async () => {
    mockConfirm.mockReturnValue(true);
    mockApi.fetch.mockImplementation((url: string, options?: any) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      if (url.includes('/interfaces')) {
        return Promise.resolve({ ok: true, json: async () => mockInterfaces });
      }
      if (url.includes('/switches')) {
        return Promise.resolve({ ok: true, json: async () => mockSwitches });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await act(async () => {
      render(<Network />);
    });

    const dropdown = screen.getByDisplayValue('Interface');
    await act(async () => {
      fireEvent.change(dropdown, { target: { value: 'switches' } });
    });

    await waitFor(() => {
      // Find the first delete button (for vmbr0)
      const deleteButtons = screen
        .getAllByRole('button')
        .filter((button) => button.className.includes('bg-red-600'));
      expect(deleteButtons.length).toBeGreaterThan(0);
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to delete the switch "vmbr0"?'
      );
      expect(mockApi.fetch).toHaveBeenCalledWith(
        'http://192.168.1.100:8080/api/v1/network/switch/vmbr0',
        { method: 'DELETE' }
      );
      expect(mockAlert).toHaveBeenCalledWith('Switch "vmbr0" deleted successfully.');
    });
  });
});
