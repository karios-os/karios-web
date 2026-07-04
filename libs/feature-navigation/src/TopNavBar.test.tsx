import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as router from 'react-router-dom';
import TopNavBar from './TopNavBar';

// Mock the dependencies
jest.mock('@karios-monorepo/shared-state', () => ({
  usePermissions: jest.fn(),
  useAppState: jest.fn(),
  useNotifications: jest.fn(),
  useWebSocket: jest.fn(),
  api: {
    get: jest.fn(),
  },
  ActionTypes: {
    SET_SELECTED_SERVER: 'SET_SELECTED_SERVER',
    SET_SELECTED_VM: 'SET_SELECTED_VM',
  },
}));

// Mock the AppStateContext hooks
jest.mock('../../../libs/shared-state/src/AppStateContext', () => ({
  useNotifications: jest.fn(),
  useWebSocket: jest.fn(),
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock the runtime configuration with complete structure
jest.mock('../../../runtime-config', () => ({
  __esModule: true,
  default: () => ({
    ENVIRONMENT: 'development',
    CONTROL_NODE_IP: {
      URL: '192.168.1.100',
      PORT: '8080',
    },
    PROVISIONING_API: {
      URL: '192.168.1.101',
      PORT: '8081',
    },
  }),
}));

// Mock Modal component
jest.mock('../../feature-server/src/widgets/Modal', () => {
  return function MockModal({
    children,
    isOpen,
    title,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
    title: string;
  }) {
    if (!isOpen) return null;
    return (
      <div data-testid="modal">
        <h2>{title}</h2>
        {children}
      </div>
    );
  };
});

describe('TopNavBar', () => {
  const mockDispatch = jest.fn();

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    // Get the mocked functions
    const { usePermissions, useAppState } = require('@karios-monorepo/shared-state');
    const {
      useNotifications,
      useWebSocket,
    } = require('../../../libs/shared-state/src/AppStateContext');

    // Setup default mocks
    (usePermissions as jest.MockedFunction<any>).mockReturnValue({
      userName: 'Test User',
      handleLogout: jest.fn(),
      permissions: {
        VM_MANAGE: true,
        UM_ADMIN: true,
      },
      seedUser: false,
    });

    (useAppState as jest.MockedFunction<any>).mockReturnValue({
      state: {
        notifications: [
          {
            id: 1,
            title: 'Release 2.3.1',
            message: 'The system has been updated successfully.',
            time: '10 minutes ago',
            read: false,
          },
        ],
      },
      dispatch: mockDispatch,
    });

    (useNotifications as jest.MockedFunction<any>).mockReturnValue({
      notifications: [
        {
          id: 1,
          title: 'Release 2.3.1',
          message: 'The system has been updated successfully.',
          time: '10 minutes ago',
          read: false,
        },
      ],
      notificationMessages: [
        JSON.stringify({
          id: 1,
          title: 'Release 2.3.1',
          message: 'The system has been updated successfully.',
          time: '10 minutes ago',
          read: false,
        }),
      ],
      hasNotifications: true,
      setHasNotifications: jest.fn(),
      clearNotificationMessages: jest.fn(),
      connectNotificationWebSocket: jest.fn(),
      closeNotificationWebSocket: jest.fn(),
      markAsRead: jest.fn(),
      clearNotifications: jest.fn(),
    });

    (useWebSocket as jest.MockedFunction<any>).mockReturnValue({
      isConnected: true,
      connect: jest.fn(),
      disconnect: jest.fn(),
      connectWebSocket: jest.fn(),
      closeConnection: jest.fn(),
      closeNotificationWebSocket: jest.fn(),
      connectNotificationWebSocket: jest.fn(),
    });
  });

  it('renders without crashing', () => {
    render(
      <router.BrowserRouter>
        <TopNavBar />
      </router.BrowserRouter>
    );
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows environment label when not in production', () => {
    render(
      <router.BrowserRouter>
        <TopNavBar />
      </router.BrowserRouter>
    );
    expect(screen.getByText('development')).toBeInTheDocument();
  });

  it('toggles user dropdown menu', async () => {
    render(
      <router.BrowserRouter>
        <TopNavBar />
      </router.BrowserRouter>
    );
    const profileButton = screen.getByText('Test User');
    await act(async () => {
      fireEvent.click(profileButton);
    });
    expect(screen.getByText('Role Management')).toBeInTheDocument();
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('handles role management navigation', async () => {
    render(
      <router.BrowserRouter>
        <TopNavBar />
      </router.BrowserRouter>
    );
    // Open dropdown first
    await act(async () => {
      fireEvent.click(screen.getByText('Test User'));
    });
    // Click role management
    await act(async () => {
      fireEvent.click(screen.getByText('Role Management'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/role-management');
  });

  it('handles user management navigation', async () => {
    render(
      <router.BrowserRouter>
        <TopNavBar />
      </router.BrowserRouter>
    );
    // Open dropdown first
    await act(async () => {
      fireEvent.click(screen.getByText('Test User'));
    });
    // Click user management
    await act(async () => {
      fireEvent.click(screen.getByText('User Management'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/user-management');
  });

  it.skip('shows notification badge and handles notification click', async () => {
    render(
      <router.BrowserRouter>
        <TopNavBar />
      </router.BrowserRouter>
    );

    const notificationIcon = screen.getByTestId('notification-icon');
    await act(async () => {
      fireEvent.click(notificationIcon);
      // Wait for the async operations and timeout in the click handler
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    // expect(screen.getByText('View all notifications')).toBeInTheDocument();
  });

  it.skip('closes notifications when clicking outside', async () => {
    render(
      <router.BrowserRouter>
        <TopNavBar />
      </router.BrowserRouter>
    );

    // Open notifications
    const notificationIcon = screen.getByTestId('notification-icon');
    await act(async () => {
      fireEvent.click(notificationIcon);
      // Wait for the async operations and timeout in the click handler
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Verify notification is shown
    expect(screen.getByText('Notifications')).toBeInTheDocument();

    // Click outside
    await act(async () => {
      fireEvent.mouseDown(document.body);
    });

    // Verify notification is hidden
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
  });

  it('navigates home when clicking logo', async () => {
    render(
      <router.BrowserRouter>
        <TopNavBar />
      </router.BrowserRouter>
    );

    const logo = screen.getByAltText('Karios Logo');
    await act(async () => {
      fireEvent.click(logo.parentElement!);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
}); // end of describe block
