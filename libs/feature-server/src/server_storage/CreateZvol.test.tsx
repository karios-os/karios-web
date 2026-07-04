import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateZvol from './CreateZvol';

// Mock dependencies
jest.mock('@karios-monorepo/shared-state', () => ({
  usePermissions: jest.fn(),
  useAppState: jest.fn(),
}));

jest.mock('../../../shared-state/src/utils/interceptor', () => ({
  fetch: jest.fn(),
}));

// Mock window.alert
const mockAlert = jest.fn();
global.alert = mockAlert;

const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

const mockUsePermissions = require('@karios-monorepo/shared-state').usePermissions as jest.Mock;
const mockUseAppState = require('@karios-monorepo/shared-state').useAppState as jest.Mock;
const mockApi = require('../../../shared-state/src/utils/interceptor') as { fetch: jest.Mock };

describe('CreateZvol', () => {
  const mockSetZvolName = jest.fn();
  const mockSetZvolSize = jest.fn();
  const mockCreateZvol = jest.fn();
  const mockSetZvolPool = jest.fn();

  const mockPool = {
    NAME: 'testpool',
    FREE: '500GB',
  };

  const mockSelectedServer = {
    ip: '192.168.1.100',
    name: 'test-server',
  };

  const defaultProps = {
    pool: mockPool,
    zvolName: '',
    setZvolName: mockSetZvolName,
    zvolSize: '1',
    setZvolSize: mockSetZvolSize,
    createZvol: mockCreateZvol,
    setZvolPool: mockSetZvolPool,
    creatingZvol: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePermissions.mockReturnValue({
      permissions: { ZFS_MANAGE: true },
    });

    mockUseAppState.mockReturnValue({
      state: { selectedServer: mockSelectedServer },
    });

    // Mock API response for existing zvols check
    mockApi.fetch.mockResolvedValue({
      ok: true,
      json: async () => [], // Empty array = no existing zvols
    });
  });

  afterEach(() => {
    mockConsoleError.mockClear();
    mockConsoleLog.mockClear();
  });

  // Test 1: Component renders correctly when user has permissions
  it('renders all form elements when user has ZFS_MANAGE permission', () => {
    render(<CreateZvol {...defaultProps} />);

    expect(screen.getByPlaceholderText('Zvol Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Size')).toBeInTheDocument();
    expect(screen.getByDisplayValue('GB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Zvol' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // Test 2: Component does not render when user lacks permissions
  it('does not render when user lacks ZFS_MANAGE permission', () => {
    mockUsePermissions.mockReturnValue({
      permissions: { ZFS_MANAGE: false },
    });

    render(<CreateZvol {...defaultProps} />);

    expect(screen.queryByPlaceholderText('Zvol Name')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Size')).not.toBeInTheDocument();
  });

  // Test 3: Zvol name input updates correctly
  it('updates zvol name when user types in input field', () => {
    render(<CreateZvol {...defaultProps} />);

    const nameInput = screen.getByPlaceholderText('Zvol Name');
    fireEvent.change(nameInput, { target: { value: 'testzvol' } });

    expect(mockSetZvolName).toHaveBeenCalledWith('testzvol');
  });

  // Test 4: Size input validation and updates
  it('updates size with numeric validation', () => {
    render(<CreateZvol {...defaultProps} />);

    const sizeInput = screen.getByPlaceholderText('Size');

    // Valid numeric input
    fireEvent.change(sizeInput, { target: { value: '10.5' } });
    expect(mockSetZvolSize).toHaveBeenCalledWith('10.5');

    // Invalid input (letters) should be filtered
    fireEvent.change(sizeInput, { target: { value: '10abc' } });
    expect(mockSetZvolSize).toHaveBeenCalledWith('10');
  });

  // Test 5: Size unit selection functionality
  it('updates size unit when user selects different option', () => {
    render(<CreateZvol {...defaultProps} />);

    const unitSelect = screen.getByDisplayValue('GB');
    fireEvent.change(unitSelect, { target: { value: 'TB' } });

    // Component uses internal state for unit, so we check if select updates
    expect(unitSelect).toHaveValue('TB');
  });

  // Test 6: Cancel button functionality
  it('calls setZvolPool with null when cancel button is clicked', () => {
    render(<CreateZvol {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(mockSetZvolPool).toHaveBeenCalledWith(null);
  });

  // Test 7: Empty or invalid zvol name validation
  it('shows error alert for empty or invalid zvol name', async () => {
    const propsWithEmptyName = { ...defaultProps, zvolName: '' };
    render(<CreateZvol {...propsWithEmptyName} />);

    const createButton = screen.getByRole('button', { name: 'Create Zvol' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Invalid Zvol name.\n\nMust start with a letter and can only contain letters, numbers, dashes (-), underscores (_), or dots (.)'
      );
    });
  });

  // Test 8: Invalid size validation
  it('shows error alert for invalid size', async () => {
    const propsWithInvalidSize = { ...defaultProps, zvolName: 'testzvol', zvolSize: '0' };
    render(<CreateZvol {...propsWithInvalidSize} />);

    const createButton = screen.getByRole('button', { name: 'Create Zvol' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Zvol size must be greater than 0.');
    });
  });

  // Test 9: Duplicate zvol name validation
  it('shows error alert for duplicate zvol name', async () => {
    // Mock API to return existing zvol with same name
    mockApi.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ name: 'testpool/testzvol' }],
    });

    const propsWithDuplicateName = { ...defaultProps, zvolName: 'testzvol', zvolSize: '10' };
    render(<CreateZvol {...propsWithDuplicateName} />);

    const createButton = screen.getByRole('button', { name: 'Create Zvol' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Zvol name already exists in this pool.');
    });
  });

  // Test 10: Successful zvol creation with proper size validation
  it('creates zvol successfully with valid inputs', async () => {
    // Mock successful API response for existing zvols check
    mockApi.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [], // No existing zvols
    });

    mockCreateZvol.mockResolvedValueOnce({ success: true });

    const propsWithValidInputs = {
      ...defaultProps,
      zvolName: 'testzvol',
      zvolSize: '10',
    };
    render(<CreateZvol {...propsWithValidInputs} />);

    const createButton = screen.getByRole('button', { name: 'Create Zvol' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockApi.fetch).toHaveBeenCalledWith(
        'http://192.168.1.100:8080/api/v1/storage/zfs/list?pool=testpool&type=volume'
      );
    });

    // Then wait for the creation to complete
    await waitFor(() => {
      expect(mockCreateZvol).toHaveBeenCalledWith('testzvol', '10GB');
      expect(mockSetZvolName).toHaveBeenCalledWith('');
      expect(mockSetZvolSize).toHaveBeenCalledWith('1');
    });
  });
});
