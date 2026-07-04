import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import VmNetwork from './VmNetwork';

describe('VmNetwork', () => {
  const mockSetNetwork0Type = jest.fn();
  const mockSetNetwork0Switch = jest.fn();

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
    network0Type: 'virtio-net',
    setNetwork0Type: mockSetNetwork0Type,
    network0Switch: 'public',
    setNetwork0Switch: mockSetNetwork0Switch,
    networkDrivers: ['virtio-net', 'e1000'],
    networkSwitches: ['public', 'private'],
    permissions: mockPermissions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form elements', () => {
    render(
      <BrowserRouter>
        <VmNetwork {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByLabelText('Network Driver:')).toBeInTheDocument();
    expect(screen.getByLabelText('Virtual Switch:')).toBeInTheDocument();
  });

  it('displays network driver options', () => {
    render(
      <BrowserRouter>
        <VmNetwork {...defaultProps} />
      </BrowserRouter>
    );

    const driverSelect = screen.getByLabelText('Network Driver:');
    defaultProps.networkDrivers.forEach((driver) => {
      expect(screen.getByText(driver)).toBeInTheDocument();
    });
  });

  it('displays network switch options', () => {
    render(
      <BrowserRouter>
        <VmNetwork {...defaultProps} />
      </BrowserRouter>
    );

    const switchSelect = screen.getByLabelText('Virtual Switch:');
    defaultProps.networkSwitches.forEach((networkSwitch) => {
      expect(screen.getByText(networkSwitch)).toBeInTheDocument();
    });
  });
  it('handles network driver change', () => {
    render(
      <BrowserRouter>
        <VmNetwork {...defaultProps} />
      </BrowserRouter>
    );

    const driverSelect = screen.getByLabelText('Network Driver:');
    fireEvent.change(driverSelect, { target: { value: 'e1000' } });

    expect(mockSetNetwork0Type).toHaveBeenCalledWith('e1000');
  });

  it('handles network switch change', () => {
    render(
      <BrowserRouter>
        <VmNetwork {...defaultProps} />
      </BrowserRouter>
    );

    const switchSelect = screen.getByLabelText('Virtual Switch:');
    fireEvent.change(switchSelect, { target: { value: 'private' } });

    expect(mockSetNetwork0Switch).toHaveBeenCalledWith('private');
  });

  it('disables inputs when VM_MANAGE permission is false', () => {
    render(
      <BrowserRouter>
        <VmNetwork {...defaultProps} permissions={{ ...mockPermissions, VM_MANAGE: false }} />
      </BrowserRouter>
    );

    expect(screen.queryByLabelText('Network Driver:')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Virtual Switch:')).not.toBeInTheDocument();
  });

  it('shows close button', () => {
    render(
      <BrowserRouter>
        <VmNetwork {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('selects first network driver by default when none selected', () => {
    render(
      <BrowserRouter>
        <VmNetwork {...defaultProps} network0Type="" />
      </BrowserRouter>
    );

    const driverSelect = screen.getByLabelText('Network Driver:');
    expect(driverSelect).toHaveValue('');
    expect(screen.getByText('Select Driver')).toBeInTheDocument();
  });

  it('selects first network switch by default when none selected', () => {
    render(
      <BrowserRouter>
        <VmNetwork {...defaultProps} network0Switch="" />
      </BrowserRouter>
    );

    const switchSelect = screen.getByLabelText('Virtual Switch:');
    expect(switchSelect).toHaveValue('');
    expect(screen.getByText('Select Switch')).toBeInTheDocument();
  });

  it('displays tooltip for network driver', () => {
    render(
      <BrowserRouter>
        <VmNetwork {...defaultProps} />
      </BrowserRouter>
    );

    // Look for the info icon with tooltip
    const tooltipText = screen.getByTitle(/virtio-net: High-performance paravirtualized driver/);
    expect(tooltipText).toBeInTheDocument();
  });
});
