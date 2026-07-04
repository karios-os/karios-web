import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import VmHardware from './VmHardware';

describe('VmHardware', () => {
  const mockSetSockets = jest.fn();
  const mockSetValue = jest.fn();
  const mockSetMemory = jest.fn();

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
    sockets: 1,
    setSockets: mockSetSockets,
    value: 1,
    setValue: mockSetValue,
    memory: 1,
    setMemory: mockSetMemory,
    nodeLimits: {
      sockets: 2,
      cpus: 8,
      memoryGB: 16,
    },
    permissions: mockPermissions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });
  // ...existing code...

  it('renders all form elements', () => {
    render(
      <BrowserRouter>
        <VmHardware {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('CPU & Memory')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Sockets:/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Memory \(GB\):/)).toBeInTheDocument();
  });

  it('shows available resources in labels', () => {
    render(
      <BrowserRouter>
        <VmHardware {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText(`(Available: ${defaultProps.nodeLimits.sockets})`)).toBeInTheDocument();
    expect(
      screen.getByText(`(Available: ${defaultProps.nodeLimits.memoryGB}GB)`)
    ).toBeInTheDocument();
  });

  it('handles socket input change', () => {
    render(
      <BrowserRouter>
        <VmHardware {...defaultProps} />
      </BrowserRouter>
    );

    const socketsInput = screen.getByLabelText(/^Sockets:/);
    fireEvent.change(socketsInput, { target: { value: '2' } });

    expect(mockSetSockets).toHaveBeenCalledWith(2);
  });

  it('handles memory input change', () => {
    render(
      <BrowserRouter>
        <VmHardware {...defaultProps} />
      </BrowserRouter>
    );

    const memoryInput = screen.getByLabelText(/^Memory \(GB\):/);
    fireEvent.change(memoryInput, { target: { value: '4' } });

    expect(mockSetMemory).toHaveBeenCalledWith(4);
  });

  it('disables inputs when VM_MANAGE permission is false', () => {
    render(
      <BrowserRouter>
        <VmHardware {...defaultProps} permissions={{ ...mockPermissions, VM_MANAGE: false }} />
      </BrowserRouter>
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows error when sockets exceed limit', () => {
    render(
      <BrowserRouter>
        <VmHardware {...defaultProps} sockets={3} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Must not exceed 2/)).toBeInTheDocument();
  });

  it('shows error when memory exceeds limit', () => {
    render(
      <BrowserRouter>
        <VmHardware {...defaultProps} memory={20} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Must not exceed 16GB/)).toBeInTheDocument();
  });

  it('shows error when sockets is less than 1', () => {
    render(
      <BrowserRouter>
        <VmHardware {...defaultProps} sockets={0} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Sockets must be at least 1/)).toBeInTheDocument();
  });

  it('shows error when memory is less than 1', () => {
    render(
      <BrowserRouter>
        <VmHardware {...defaultProps} memory={0} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Memory must be at least 1GB/)).toBeInTheDocument();
  });

  it('shows close button', () => {
    render(
      <BrowserRouter>
        <VmHardware {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  describe('CPU handling', () => {
    it('handles CPU value input change', () => {
      render(
        <BrowserRouter>
          <VmHardware {...defaultProps} />
        </BrowserRouter>
      );

      const cpuInput = screen.getByLabelText(/^Cores/);
      fireEvent.change(cpuInput, { target: { value: '4' } });

      expect(mockSetValue).toHaveBeenCalledWith(4);
    });

    it('shows error when CPUs exceed limit', () => {
      render(
        <BrowserRouter>
          <VmHardware {...defaultProps} value={9} />
        </BrowserRouter>
      );

      expect(
        screen.getByText(`Must not exceed ${defaultProps.nodeLimits.cpus}.`)
      ).toBeInTheDocument();
    });

    it('shows error when CPUs is less than 1', () => {
      render(
        <BrowserRouter>
          <VmHardware {...defaultProps} value={0} />
        </BrowserRouter>
      );

      expect(screen.getByText("CPU's must be at least 1.")).toBeInTheDocument();
    });
    it('shows available CPU resources in label', () => {
      render(
        <BrowserRouter>
          <VmHardware {...defaultProps} />
        </BrowserRouter>
      );

      expect(screen.getByText(`(Available: ${defaultProps.nodeLimits.cpus})`)).toBeInTheDocument();
    });
  });

  // Add tests for input validation
  describe('Input validation', () => {
    it('handles non-numeric input for sockets', () => {
      render(
        <BrowserRouter>
          <VmHardware {...defaultProps} />
        </BrowserRouter>
      );

      const socketsInput = screen.getByLabelText(/^Sockets:/);
      fireEvent.change(socketsInput, { target: { value: 'abc' } });

      expect(mockSetSockets).toHaveBeenCalledWith(0);
    });

    it('handles non-numeric input for CPUs', () => {
      render(
        <BrowserRouter>
          <VmHardware {...defaultProps} />
        </BrowserRouter>
      );

      const cpuInput = screen.getByLabelText(/^Cores/);
      fireEvent.change(cpuInput, { target: { value: 'abc' } });

      expect(mockSetValue).toHaveBeenCalledWith(0);
    });

    it('handles non-numeric input for memory', () => {
      render(
        <BrowserRouter>
          <VmHardware {...defaultProps} />
        </BrowserRouter>
      );

      const memoryInput = screen.getByLabelText(/^Memory \(GB\):/);
      fireEvent.change(memoryInput, { target: { value: 'abc' } });

      expect(mockSetMemory).toHaveBeenCalledWith(0);
    });
  });
});
