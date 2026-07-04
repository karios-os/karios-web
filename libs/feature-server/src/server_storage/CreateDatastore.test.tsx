import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateDatastore from './CreateDatastore';

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

const mockUsePermissions = require('@karios-monorepo/shared-state').usePermissions as jest.Mock;
const mockUseAppState = require('@karios-monorepo/shared-state').useAppState as jest.Mock;
const mockApi = require('../../../shared-state/src/utils/interceptor') as { fetch: jest.Mock };

describe('CreateDatastore', () => {
  const mockOnClose = jest.fn();
  const mockFetchDatastores = jest.fn();

  const mockStoragePools = [
    { NAME: 'pool1', SIZE: '1T', USED: '500G' },
    { NAME: 'pool2', SIZE: '2T', USED: '1T' },
  ];

  const mockSelectedServer = {
    ip: '192.168.1.100',
    name: 'test-server',
  };

  const defaultProps = {
    storagePools: mockStoragePools,
    onClose: mockOnClose,
    fetchDatastores: mockFetchDatastores,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePermissions.mockReturnValue({
      permissions: { ZFS_MANAGE: true },
    });

    mockUseAppState.mockReturnValue({
      state: { selectedServer: mockSelectedServer },
    });
  });

  afterEach(() => {
    mockConsoleError.mockClear();
  });

  // Test 1: Component renders correctly when user has permissions
  it('renders all form elements when user has ZFS_MANAGE permission', () => {
    render(<CreateDatastore {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Create Datastore' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter datastore name')).toBeInTheDocument();
    expect(screen.getByText('Select Pool:')).toBeInTheDocument();
    expect(screen.getByDisplayValue('pool1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Datastore' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  // Test 2: Component does not render when user lacks permissions
  it('does not render when user lacks ZFS_MANAGE permission', () => {
    mockUsePermissions.mockReturnValue({
      permissions: { ZFS_MANAGE: false },
    });

    render(<CreateDatastore {...defaultProps} />);

    expect(screen.queryByText('Create Datastore')).not.toBeInTheDocument();
  });

  // Test 3: Input field updates datastore name
  it('updates datastore name when user types in input field', () => {
    render(<CreateDatastore {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter datastore name');
    fireEvent.change(input, { target: { value: 'testdatastore' } });

    expect(input).toHaveValue('testdatastore');
  });

  // Test 4: Pool selection updates selected pool
  it('updates selected pool when user selects different pool', () => {
    render(<CreateDatastore {...defaultProps} />);

    const select = screen.getByDisplayValue('pool1');
    fireEvent.change(select, { target: { value: 'pool2' } });

    expect(select).toHaveValue('pool2');
  });

  // Test 5: Close button calls onClose function
  it('calls onClose when close button is clicked', () => {
    render(<CreateDatastore {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // Test 6: Empty datastore name shows validation error
  it('shows error alert for empty datastore name', () => {
    render(<CreateDatastore {...defaultProps} />);

    const createButton = screen.getByRole('button', { name: 'Create Datastore' });
    fireEvent.click(createButton);

    expect(mockAlert).toHaveBeenCalledWith('Please fill datastore name.');
  });

  // Test 7: Invalid datastore name shows validation error
  it('shows error alert for invalid datastore name', () => {
    render(<CreateDatastore {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter datastore name');
    fireEvent.change(input, { target: { value: '123invalid' } });

    const createButton = screen.getByRole('button', { name: 'Create Datastore' });
    fireEvent.click(createButton);

    expect(mockAlert).toHaveBeenCalledWith(
      'Invalid datastore name.\n\nRules:\n- Must begin with a letter\n- Only letters, numbers, dashes (-), underscores (_), or dots (.) are allowed'
    );
  });

  // Test 8: Duplicate datastore name shows error
  it('shows error alert for duplicate datastore name', () => {
    render(<CreateDatastore {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter datastore name');
    fireEvent.change(input, { target: { value: 'pool1' } }); // Same as existing pool name

    const createButton = screen.getByRole('button', { name: 'Create Datastore' });
    fireEvent.click(createButton);

    expect(mockAlert).toHaveBeenCalledWith(
      'Datastore name already exists. Please choose a different name.'
    );
  });

  // Test 9: Successful datastore creation
  it('creates datastore successfully with valid inputs', async () => {
    mockApi.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<CreateDatastore {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter datastore name');
    fireEvent.change(input, { target: { value: 'newdatastore' } });

    const createButton = screen.getByRole('button', { name: 'Create Datastore' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockApi.fetch).toHaveBeenCalledWith(
        'http://192.168.1.100:8080/api/v1/storage/zfs/datastore/add',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'newdatastore',
            pool: 'pool1',
          }),
        }
      );
    });

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Datastore created successfully!');
      expect(mockFetchDatastores).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    // Check that input is cleared
    expect(input).toHaveValue('');
  });

  // Test 10: API error handling
  it('handles API errors gracefully', async () => {
    const errorResponse = {
      ok: false,
      json: async () => ({ error: 'Pool not found' }),
    };
    mockApi.fetch.mockResolvedValueOnce(errorResponse);

    render(<CreateDatastore {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter datastore name');
    fireEvent.change(input, { target: { value: 'testdatastore' } });

    const createButton = screen.getByRole('button', { name: 'Create Datastore' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Pool not found');
    });

    // Ensure cleanup functions are not called on error
    expect(mockFetchDatastores).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
