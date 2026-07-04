import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import VmDetails from './VmDetails';
import { useAppState } from '@karios-monorepo/shared-state';

// Static test configuration instead of importing env.config
const TEST_CONFIG = {
  CONTROL_NODE_IP: '192.168.1.100',
  ENVIRONMENT: 'test',
};

// Mock dependencies
jest.mock('@karios-monorepo/shared-state', () => ({
  useAppState: jest.fn(),
}));

// Mock navigate function
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('VmDetails', () => {
  const mockHandleVmNameChange = jest.fn();
  const mockSetLoader = jest.fn();
  const mockSetUefiVars = jest.fn();
  const mockSetOsType = jest.fn();
  const mockSetSelectedServerIp = jest.fn();

  const mockDataCenters = [
    {
      id: 'dc1',
      name: 'Test DC',
      servers: [
        {
          id: 'server1',
          name: 'Test Server',
          ip: TEST_CONFIG.CONTROL_NODE_IP,
        },
        {
          id: 'server2',
          name: 'Test Server 2',
          ip: '192.168.116.114',
        },
      ],
    },
  ];

  const mockPermissions = {
    VM_MANAGE: true,
    VM_VIEW: true,
    LOGS_VIEW: true,
    ZFS_MANAGE: true,
    ZFS_VIEW: true,
    NETWORK_MANAGE: true,
    NETWORK_VIEW: true,
    UM_ADMIN: true,
    VM_BACKUP: true,
  };

  const defaultProps = {
    vmName: 'testvm',
    handleVmNameChange: mockHandleVmNameChange,
    nameError: '',
    loader: 'uefi',
    setLoader: mockSetLoader,
    setUefiVars: mockSetUefiVars,
    osType: '',
    setOsType: mockSetOsType,
    selectedServerIp: '',
    setSelectedServerIp: mockSetSelectedServerIp,
    permissions: mockPermissions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAppState as jest.Mock).mockReturnValue({
      dataCenters: mockDataCenters,
    });
  });

  it('renders nothing when VM_MANAGE permission is false', () => {
    render(
      <BrowserRouter>
        <VmDetails
          {...defaultProps}
          permissions={{
            ...mockPermissions,
            VM_MANAGE: false,
          }}
        />
      </BrowserRouter>
    );

    expect(screen.queryByText('VM Details')).not.toBeInTheDocument();
  });

  it('renders VM Details section when VM_MANAGE permission is true', () => {
    render(
      <BrowserRouter>
        <VmDetails {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('VM Details')).toBeInTheDocument();
  });

  it('displays default nodes when no servers in dataCenters', () => {
    (useAppState as jest.Mock).mockReturnValue({
      dataCenters: [],
    });

    render(
      <BrowserRouter>
        <VmDetails {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('Node 1')).toBeInTheDocument();
    expect(screen.getByText('Node 2')).toBeInTheDocument();
  });

  it('handles server selection', () => {
    render(
      <BrowserRouter>
        <VmDetails {...defaultProps} />
      </BrowserRouter>
    );

    const serverSelect = screen.getByRole('combobox', { name: 'Server:' });
    fireEvent.change(serverSelect, { target: { value: TEST_CONFIG.CONTROL_NODE_IP } });

    expect(mockSetSelectedServerIp).toHaveBeenCalledWith(TEST_CONFIG.CONTROL_NODE_IP);
  });

  it('handles VM name change', () => {
    render(
      <BrowserRouter>
        <VmDetails {...defaultProps} />
      </BrowserRouter>
    );

    const vmNameInput = screen.getByRole('textbox');
    fireEvent.change(vmNameInput, { target: { value: 'newvm' } });

    expect(mockHandleVmNameChange).toHaveBeenCalled();
  });

  it('displays name error when provided', () => {
    const errorMessage = 'Invalid VM name';
    render(
      <BrowserRouter>
        <VmDetails {...defaultProps} nameError={errorMessage} />
      </BrowserRouter>
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('handles OS type change', () => {
    render(
      <BrowserRouter>
        <VmDetails {...defaultProps} />
      </BrowserRouter>
    );

    const osSelect = screen.getByRole('combobox', { name: 'Operating System:' });
    fireEvent.change(osSelect, { target: { value: 'windows' } });

    expect(mockSetOsType).toHaveBeenCalledWith('windows');
  });
});
