import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import VmStorage from './VmStorage';

describe('VmStorage', () => {
  const mockSetSelectedPool = jest.fn();
  const mockHandleDiskSizeChange = jest.fn();

  const mockPermissions = {
    VM_VIEW: true,
    VM_MANAGE: true,
    VM_BACKUP: true,
    LOGS_VIEW: true,
    ZFS_MANAGE: true,
    ZFS_VIEW: true,
    NETWORK_MANAGE: true,
    NETWORK_VIEW: true,
    UM_ADMIN: true,
  };

  const defaultProps = {
    selectedPool: '',
    setSelectedPool: mockSetSelectedPool,
    disk0Size: 20,
    handleDiskSizeChange: mockHandleDiskSizeChange,
    pools: [
      { NAME: 'pool1', FREE: '100G', SIZE: '1T' },
      { NAME: 'pool2', FREE: '200G', SIZE: '2T' },
    ],
    permissions: mockPermissions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form elements', () => {
    render(
      <BrowserRouter>
        <VmStorage {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByLabelText('ZPool:')).toBeInTheDocument();
    expect(screen.getByLabelText(/Disk Size \(GB\):/)).toBeInTheDocument();
  });

  it('displays storage pool options', () => {
    render(
      <BrowserRouter>
        <VmStorage {...defaultProps} />
      </BrowserRouter>
    );

    defaultProps.pools.forEach((pool) => {
      expect(screen.getByText(`${pool.NAME} (Free: ${pool.FREE}G)`)).toBeInTheDocument();
    });
  });

  it('shows pool size information', () => {
    render(
      <BrowserRouter>
        <VmStorage {...defaultProps} selectedPool="pool1" />
      </BrowserRouter>
    );

    const poolOption = screen.getByText(/pool1.*100G/);
    expect(poolOption).toBeInTheDocument();
  });

  it('handles pool selection change', () => {
    render(
      <BrowserRouter>
        <VmStorage {...defaultProps} />
      </BrowserRouter>
    );

    const poolSelect = screen.getByLabelText('ZPool:');
    fireEvent.change(poolSelect, { target: { value: 'pool2' } });

    expect(mockSetSelectedPool).toHaveBeenCalledWith('pool2');
  });

  it('handles disk size change', () => {
    render(
      <BrowserRouter>
        <VmStorage {...defaultProps} />
      </BrowserRouter>
    );

    const diskSizeInput = screen.getByLabelText(/Disk Size \(GB\):/);
    fireEvent.change(diskSizeInput, { target: { value: '30' } });

    expect(mockHandleDiskSizeChange).toHaveBeenCalledWith(30);
  });

  it('shows close button', () => {
    render(
      <BrowserRouter>
        <VmStorage {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});
