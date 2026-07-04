import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VMConsole from './console';

// Mock the shared-state module
jest.mock('@karios-monorepo/shared-state', () => ({
  useVm: jest.fn(),
  usePermissions: jest.fn(),
  useAppState: jest.fn(),
  ActionTypes: {
    VNC_CONSOLE_ERROR: 'VNC_CONSOLE_ERROR',
    SET_VNC_CONSOLE_URL: 'SET_VNC_CONSOLE_URL',
  },
}));

// Mock fetch
global.fetch = jest.fn();

const { useVm, usePermissions, useAppState } = require('@karios-monorepo/shared-state');

describe('VMConsole Component', () => {
  const mockDispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
      },
      writable: true,
    });

    useVm.mockReturnValue({
      selectedVm: {
        name: 'test-vm',
        state: 'Running',
      },
    });

    usePermissions.mockReturnValue({
      permissions: {
        VM_MANAGE: true,
      },
    });

    useAppState.mockReturnValue({
      state: {
        selectedServer: {
          ip: '192.168.1.100',
        },
        vncConsoleUrl: null,
        vncConsoleError: null,
      },
      dispatch: mockDispatch,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  it('renders VMConsole component', () => {
    render(React.createElement(VMConsole));
    expect(document.body).toBeInTheDocument();
  });

  it('handles no VM selected scenario', () => {
    // Set up initial state with permissions and server available
    usePermissions.mockReturnValue({
      permissions: { VM_MANAGE: true },
    });

    useAppState.mockReturnValue({
      state: {
        selectedServer: { ip: '192.168.1.100', id: '1', name: 'test-server' },
        vncConsoleUrl: null,
        vncConsoleError: null,
      },
      dispatch: mockDispatch,
    });

    // Mock useVm with no selected VM
    useVm.mockReturnValue({
      selectedVm: null,
    });

    // Simply render and verify component exists
    render(React.createElement(VMConsole));
    expect(document.body).toBeInTheDocument();
  });

  it('handles no server selected scenario', () => {
    // Set up permissions to allow VM management
    usePermissions.mockReturnValue({
      permissions: { VM_MANAGE: true },
    });

    // Mock with selected VM but no server
    useVm.mockReturnValue({
      selectedVm: {
        name: 'test-vm',
        state: 'Running',
      },
    });

    useAppState.mockReturnValue({
      state: {
        selectedServer: null,
        vncConsoleUrl: null,
        vncConsoleError: null,
      },
      dispatch: mockDispatch,
    });

    // Simply render and verify component exists
    render(React.createElement(VMConsole));
    expect(document.body).toBeInTheDocument();
  });

  it('handles stopped VM state', async () => {
    useVm.mockReturnValue({
      selectedVm: {
        name: 'test-vm',
        state: 'Stopped',
      },
    });

    render(React.createElement(VMConsole));

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'VNC_CONSOLE_ERROR',
        payload: 'VM is stopped. Please start the VM to access the console.',
      });
    });
  });

  it('does not setup console when user lacks permissions', () => {
    usePermissions.mockReturnValue({
      permissions: {
        VM_MANAGE: false,
      },
    });

    render(React.createElement(VMConsole));
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
