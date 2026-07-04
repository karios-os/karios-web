import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CreateDataset from './CreateDataset';

// Mock window.alert
const mockAlert = jest.fn();
global.alert = mockAlert;

describe('CreateDataset', () => {
  const mockSetDatasetName = jest.fn();
  const mockCreateDataset = jest.fn();
  const mockSetCreatingDataset = jest.fn();
  const mockSetDatasetEncryption = jest.fn();
  const mockSetDatasetPassphrase = jest.fn();

  const defaultProps = {
    poolName: 'testpool',
    datasetName: '',
    setDatasetName: mockSetDatasetName,
    datasetEncryption: false,
    setDatasetEncryption: mockSetDatasetEncryption,
    datasetPassphrase: '',
    setDatasetPassphrase: mockSetDatasetPassphrase,
    createDataset: mockCreateDataset,
    setCreatingDataset: mockSetCreatingDataset,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Component renders with all required elements
  it('renders all form elements correctly', () => {
    render(<CreateDataset {...defaultProps} />);

    // Check for input field
    expect(screen.getByPlaceholderText('Dataset Name')).toBeInTheDocument();

    // Check for Create button
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();

    // Check for Close button
    expect(screen.getByRole('button', { name: '✖' })).toBeInTheDocument();

    // Check for informational note
    expect(
      screen.getByText(/You can organize your ZFS datasets within directories/)
    ).toBeInTheDocument();

    // Check for example text
    expect(screen.getByText('vm/mydataset')).toBeInTheDocument();
  });

  // Test 2: Input field updates dataset name when typed
  it('updates dataset name when user types in input field', () => {
    render(<CreateDataset {...defaultProps} />);

    const input = screen.getByPlaceholderText('Dataset Name');
    fireEvent.change(input, { target: { value: 'mydataset' } });

    expect(mockSetDatasetName).toHaveBeenCalledWith('mydataset');
  });

  // Test 3: Close button calls setCreatingDataset with null
  it('calls setCreatingDataset with null when close button is clicked', () => {
    render(<CreateDataset {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: '✖' });
    fireEvent.click(closeButton);

    expect(mockSetCreatingDataset).toHaveBeenCalledWith(null);
  });

  // Test 4: Valid dataset name creation succeeds
  it('creates dataset when valid name is provided', () => {
    render(<CreateDataset {...defaultProps} datasetName="validDataset" />);

    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    expect(mockCreateDataset).toHaveBeenCalledWith('testpool');
    expect(mockAlert).not.toHaveBeenCalled();
  });

  // Test 5: Invalid dataset name starting with number shows error
  it('shows error alert for dataset name starting with number', () => {
    render(<CreateDataset {...defaultProps} datasetName="123invalid" />);

    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    expect(mockAlert).toHaveBeenCalledWith(
      'Invalid dataset name.\n\nRules:\n- Must begin with a letter\n- Only letters, numbers, dashes (-), underscores (_), dots (.), or slashes (/) are allowed'
    );
    expect(mockCreateDataset).not.toHaveBeenCalled();
  });

  // Test 6: Dataset name with special characters shows error
  it('shows error alert for dataset name with invalid special characters', () => {
    render(<CreateDataset {...defaultProps} datasetName="invalid@name" />);

    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    expect(mockAlert).toHaveBeenCalledWith(
      'Invalid dataset name.\n\nRules:\n- Must begin with a letter\n- Only letters, numbers, dashes (-), underscores (_), dots (.), or slashes (/) are allowed'
    );
    expect(mockCreateDataset).not.toHaveBeenCalled();
  });

  // Test 7: Valid dataset name with allowed special characters works
  it('accepts valid dataset name with allowed special characters', () => {
    render(<CreateDataset {...defaultProps} datasetName="valid_dataset-name.test/sub" />);

    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    expect(mockCreateDataset).toHaveBeenCalledWith('testpool');
    expect(mockAlert).not.toHaveBeenCalled();
  });

  // Test 8: Empty dataset name shows validation error
  it('shows error alert for empty dataset name', () => {
    render(<CreateDataset {...defaultProps} datasetName="" />);

    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    expect(mockAlert).toHaveBeenCalledWith(
      'Invalid dataset name.\n\nRules:\n- Must begin with a letter\n- Only letters, numbers, dashes (-), underscores (_), dots (.), or slashes (/) are allowed'
    );
    expect(mockCreateDataset).not.toHaveBeenCalled();
  });

  // Test 9: Whitespace-only dataset name shows validation error
  it('shows error alert for whitespace-only dataset name', () => {
    render(<CreateDataset {...defaultProps} datasetName="   " />);

    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    expect(mockAlert).toHaveBeenCalledWith(
      'Invalid dataset name.\n\nRules:\n- Must begin with a letter\n- Only letters, numbers, dashes (-), underscores (_), dots (.), or slashes (/) are allowed'
    );
    expect(mockCreateDataset).not.toHaveBeenCalled();
  });

  // Test 10: Dataset name with leading/trailing whitespace is trimmed and validated
  it('trims whitespace from dataset name before validation and creation', () => {
    render(<CreateDataset {...defaultProps} datasetName="  validDataset  " />);

    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    expect(mockCreateDataset).toHaveBeenCalledWith('testpool');
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
