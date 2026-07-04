import React, { useState, useEffect, useRef } from 'react';
import { IoMdDesktop } from 'react-icons/io';
import { TbLogout } from 'react-icons/tb';
import { IoPerson } from 'react-icons/io5';
import { BiBell } from 'react-icons/bi';
import { GrUbuntu } from 'react-icons/gr';
import { SiRedhatopenshift, SiK3S, SiTalos } from 'react-icons/si';
import { useNavigate } from 'react-router-dom';

import { useAppState, ActionTypes, usePermissions } from '@karios-monorepo/shared-state';
import { createComponentLogger } from '../../shared-state/src/utils/logger';
import { OmniIcon } from '../../shared-ui/src/components/OmniIcon';
import AnthosIcon from '../../../public/SVG/anthosIcon';

import { useNotifications } from '../../../libs/shared-state/src/AppStateContext';
import { useWebSocket } from '../../../libs/shared-state/src/AppStateContext';
import { api } from '../../../libs/shared-state/src';
import Modal from '../../shared-state/src/widgets/Modal';
import SideroWebSocketModal from './components/SideroWebSocketModal';
import envConfig from '../../../runtime-config';
// hasPermission is available through usePermissions hook, not as a direct import
// Define interfaces for our components
interface NotificationProps {
  className?: string;
}

interface NotificationDetail {
  version: string;
  components: string[];
  status: string;
  duration: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  date: string;
  activity: string;
  details: NotificationDetail;
  username: string;
}

// Notification component
const Notification: React.FC<NotificationProps> = ({ className }) => {
  const logger = createComponentLogger('TopNavBar.Notification');

  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [currentNotification, setCurrentNotification] = useState<NotificationItem | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  // Use centralized notification state
  const {
    notificationMessages,
    hasNotifications,
    setHasNotifications,
    clearNotificationMessages,
    connectNotificationWebSocket,
    closeNotificationWebSocket,
  } = useNotifications();

  const { closeConnection, connectWebSocket } = useWebSocket();

  // Helper to format notification payload
  const formatNotification = (payload: any, idx: number): NotificationItem => {
    let parsedPayload = payload;
    if (typeof payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        parsedPayload = {};
      }
    }
    payload = parsedPayload;
    if (!payload || typeof payload !== 'object') {
      return {
        id: '',
        title: `Notification #${idx + 1}`,
        message: 'Unknown notification',
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        details: {
          version: '',
          components: [],
          status: '',
          duration: '',
        },
        activity: '',
        username: '',
      };
    }
    return {
      id: payload.id,
      title: payload.activity,
      message: payload.activity || 'No activity',
      time: payload.end_time
        ? new Date(payload.end_time).toLocaleTimeString()
        : new Date().toLocaleTimeString(),
      date: payload.end_time
        ? new Date(payload.end_time).toLocaleDateString()
        : new Date().toLocaleDateString(),
      details: {
        version: payload.vm_name || '',
        components: [payload.component_type || ''],
        status: payload.status || '',
        duration:
          payload.start_time && payload.end_time
            ? `${((new Date(payload.end_time).getTime() - new Date(payload.start_time).getTime()) / 1000).toFixed(2)}s`
            : '',
      },
      activity: '',
      username: payload.username,
    };
  };

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNotificationClick = async (notification: NotificationItem) => {
    // Call read-notification API when a notification is clicked
    try {
      if (notification.id) {
        await api.fetch(
          `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/read-notification?logId=${notification.id}`,
          {
            method: 'GET',
          }
        );
      }
    } catch (err) {
      // Optionally handle error (e.g., log or show toast)
      logger.error('Failed to mark notification as read:', err);
    }
    setCurrentNotification(notification);
    setIsModalOpen(true);
    setShowNotifications(false);
  };

  const closeModal = async () => {
    setIsModalOpen(false);

    // 1. Close websocket connection
    closeConnection();
    closeNotificationWebSocket();

    // 2. Clear the notificationMessages state
    clearNotificationMessages();

    // Wait a bit to ensure cleanup is complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 3. Connect websocket connection again
    const authToken = localStorage.getItem('accessToken');
    if (authToken) {
      const controlNodeConfig = envConfig().CONTROL_NODE_IP;
      const wsUrl = `${envConfig().WS_PROTOCOL}://${controlNodeConfig.URL}${controlNodeConfig.PORT}/api/v1/user/ws?token=${authToken}`;
      connectWebSocket(wsUrl);
      connectNotificationWebSocket();
    }
  };

  return (
    <div className="relative" ref={notificationRef}>
      <BiBell
        data-testid="notification-icon"
        className={`${className} cursor-pointer`}
        onClick={async () => {
          if (!showNotifications) {
            // Re-establish websocket connection when opening dropdown
            closeConnection();
            closeNotificationWebSocket();
            await new Promise((resolve) => setTimeout(resolve, 100));
            const authToken = localStorage.getItem('accessToken');
            if (authToken) {
              const controlNodeConfig = envConfig().CONTROL_NODE_IP;
              const wsUrl = `${envConfig().WS_PROTOCOL}://${controlNodeConfig.URL}${controlNodeConfig.PORT}/api/v1/user/ws?token=${authToken}`;
              connectWebSocket(wsUrl);
              connectNotificationWebSocket();
            }
          }
          setShowNotifications(!showNotifications);
        }}
      />
      {hasNotifications && (
        <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 transform translate-x-1/2 -translate-y-1/2"></span>
      )}

      {showNotifications && (
        <div className="fixed top-[70px] right-4 w-80 bg-white z-50 rounded-lg shadow-2xl overflow-hidden border-2 border-gray-200">
          <div className="py-2 px-3 bg-gray-100 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-800">Notifications</p>
          </div>
          <div className="bg-white max-h-64 overflow-y-auto">
            {notificationMessages.length === 0 ? (
              <div className="p-3 text-gray-500">No notifications yet.</div>
            ) : (
              [...notificationMessages]
                .map((msg) => {
                  // Parse each message to object for id access
                  if (typeof msg === 'string') {
                    try {
                      return JSON.parse(msg);
                    } catch {
                      return {};
                    }
                  }
                  return msg;
                })
                .filter((msg) => msg && msg.id)
                .sort((a, b) => {
                  // Descending order by id (assuming id is string, can be cast to number if needed)
                  if (a.id > b.id) return -1;
                  if (a.id < b.id) return 1;
                  return 0;
                })
                .filter((msg, idx, arr) => arr.findIndex((m) => m.id === msg.id) === idx)
                .map((msg, idx) => {
                  const notification = formatNotification(msg, idx);
                  return (
                    <div
                      key={notification.id}
                      className="p-3 hover:bg-gray-50 border-b border-gray-100 cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <p className="text-sm font-medium text-gray-800">
                        <span className="text-gray-500">#{notification.id}</span>{' '}
                        {notification.title.length > 60
                          ? `${notification.title.substring(0, 60)}...`
                          : notification.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {notification.date} {notification.time}
                      </p>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={currentNotification?.title || 'Notification'}
        width="389px"
      >
        {currentNotification && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="mt-3">
                <h5 className="font-bold text-gray-700 mb-1 text-bold">Message</h5>
                <div className="text-sm text-gray-600 pl-2">{currentNotification.message}</div>
              </div>
              <div className="mt-3">
                <h5 className="font-bold text-gray-700 mb-1 text-bold">Details</h5>
                <div className="text-sm text-gray-600 pl-2">
                  <div>
                    <strong>Component:</strong> {currentNotification.details.components.join(', ')}
                  </div>
                  <div>
                    <strong>Status:</strong> {currentNotification.details.status}
                  </div>
                  <div>
                    <strong>Username:</strong> {currentNotification.username}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center mt-10"></div>
          </div>
        )}
      </Modal>
    </div>
  );
};

interface TopNavBarProps {
  sidebarWidth?: number;
}

interface OmniPrereqs {
  Certs: boolean;
  Keycloak: boolean;
  OmniServer: boolean;
}

const TopNavBar: React.FC<TopNavBarProps> = ({ sidebarWidth = 0 }) => {
  const logger = createComponentLogger('TopNavBar');

  // Get state and dispatch from main app state
  const { state, dispatch } = useAppState();

  // Get permissions, userName, and handleLogout from permissions hook
  const { permissions, hasPermission, userName, handleLogout } = usePermissions();

  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isVmDropdownOpen, setIsVmDropdownOpen] = useState<boolean>(false);
  const [isClusterDropdownOpen, setIsClusterDropdownOpen] = useState<boolean>(false);
  const [isSideroModalOpen, setIsSideroModalOpen] = useState<boolean>(false);
  const [omniPrereqs, setOmniPrereqs] = useState<OmniPrereqs | null>(null);
  const [isLoadingOmniPrereqs, setIsLoadingOmniPrereqs] = useState<boolean>(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const vmDropdownRef = useRef<HTMLDivElement | null>(null);
  const clusterDropdownRef = useRef<HTMLDivElement | null>(null);

  // Function to check Omni prerequisites
  const checkOmniPrereqs = async () => {
    if (isLoadingOmniPrereqs) return; // Prevent multiple concurrent calls

    setIsLoadingOmniPrereqs(true);
    try {
      const url = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/check/omni_prereqs`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setOmniPrereqs(result);
      } else {
        logger.error('Failed to check Omni prerequisites:', response.status);
        // Set default values if API fails
        setOmniPrereqs({ Certs: false, Keycloak: false, OmniServer: false });
      }
    } catch (error) {
      logger.error('Error checking Omni prerequisites:', error);
      // Set default values if API fails
      setOmniPrereqs({ Certs: false, Keycloak: false, OmniServer: false });
    } finally {
      setIsLoadingOmniPrereqs(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (vmDropdownRef.current && !vmDropdownRef.current.contains(event.target as Node)) {
        setIsVmDropdownOpen(false);
      }
      if (
        clusterDropdownRef.current &&
        !clusterDropdownRef.current.contains(event.target as Node)
      ) {
        setIsClusterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Navigation handlers
  const handleStandardVmSetupClick = () => {
    // Reset server and VM selections when navigating to VM Setup
    dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: null });
    dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: null });
    navigate('/vm-setup?type=standard');
    setIsVmDropdownOpen(false);
  };

  const handleCloudInitVmSetupClick = () => {
    // Reset server and VM selections when navigating to VM Setup
    dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: null });
    dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: null });
    navigate('/vm-setup?type=cloudinit');
    setIsVmDropdownOpen(false);
  };

  const handleOpenShiftClusterClick = () => {
    // Navigate to set k8s page with OpenShift type
    navigate('/set-k8s?type=openshift');
    setIsClusterDropdownOpen(false);
  };

  const handleUbuntuClusterClick = () => {
    // Navigate to set k8s page with Ubuntu type
    navigate('/set-k8s?type=ubuntu');
    setIsClusterDropdownOpen(false);
  };

  const handleK3sClusterClick = () => {
    // Navigate to set k8s page with K3S type
    navigate('/set-k8s?type=k3s');
    setIsClusterDropdownOpen(false);
  };

  const handleOmniClick = async () => {
    setIsClusterDropdownOpen(false);

    // Make fresh API call to get latest prerequisites
    await checkOmniPrereqs();

    // Wait a moment for state to update
    setTimeout(() => {
      // Store the current prerequisites state for OmniProvisionPage
      if (omniPrereqs) {
        localStorage.setItem('omniPrerequisites', JSON.stringify(omniPrereqs));
      }

      // Set the appropriate page based on Certs status
      if (omniPrereqs?.Certs === true) {
        // If Certs are true, skip TLS upload and go directly to Create Omni Server
        localStorage.setItem('omniCurrentPage', 'setup');
        localStorage.setItem('omniSkipTLS', 'true');
      } else {
        // If Certs are false, show TLS upload first
        localStorage.setItem('omniCurrentPage', 'setup');
        localStorage.setItem('omniSkipTLS', 'false');
      }

      navigate('/omni-provision');
    }, 100);
  };

  const handleOmniVMClick = () => {
    navigate('/provision/omni-vm');
    setIsClusterDropdownOpen(false);
  };

  // DISABLED: Google Anthos
  /* const handleGoogleAnthosClick = () => {
    navigate("/set-k8s?type=anthos");
    setIsClusterDropdownOpen(false);
  }; */

  const handleAccountInfoClick = () => {
    navigate('/account-info');
    setIsDropdownOpen(false);
  };

  return (
    <>
      <div
        className={`fixed top-0 left-0 w-full h-15 flex items-center z-[60] ${envConfig().ENVIRONMENT === 'production' ? 'bg-gray-100' : 'bg-blue-100'}`}
      >
        {/* Left section - Karios Logo */}
        <div className="flex items-center mr-2 sm:mr-4">
          <div className="flex flex-row items-center">
            <img src="/Karios-2025.svg" alt="Karios Logo" className="h-16 sm:h-18 md:h-20 w-auto" />
            {envConfig().ENVIRONMENT !== 'production' && (
              <span className="text-sm md:text-md text-gray-500 mt-0 ml-0 hidden sm:inline">
                {envConfig().ENVIRONMENT}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4 ml-auto">
          {/* Setup VM Button with Dropdown */}
          <div ref={vmDropdownRef} className="relative">
            <button
              className="bg-karios-blue hover:bg-blue-600 hover:opacity-70 text-white text-xs sm:text-sm font-medium px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg transition-opacity duration-200 flex items-center"
              onClick={() => setIsVmDropdownOpen(!isVmDropdownOpen)}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
              <span className="hidden sm:inline">Setup VM</span>
              <span className="sm:hidden">VM</span>
              <svg
                className={`w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2 transition-transform ${isVmDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* VM dropdown menu */}
            {isVmDropdownOpen && (
              <div className="absolute right-0 mt-2 w-auto min-w-max bg-white rounded-md shadow-lg z-50 py-1">
                <button
                  onClick={handleStandardVmSetupClick}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                >
                  <div className="w-4 h-4 mr-2 bg-karios-blue rounded-full flex items-center justify-center">
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  Standard VM
                </button>
                <button
                  onClick={handleCloudInitVmSetupClick}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                >
                  <div className="w-4 h-4 mr-2 bg-karios-green rounded-full flex items-center justify-center">
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  CloudInit
                </button>
              </div>
            )}
          </div>

          {/* Setup Kubernetes Button with Dropdown */}
          <div ref={clusterDropdownRef} className="relative">
            <button
              className="bg-karios-blue hover:bg-blue-600 hover:opacity-70 text-white text-xs sm:text-sm font-medium px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg transition-opacity duration-200 flex items-center"
              onClick={async () => {
                if (!isClusterDropdownOpen) {
                  // Check Omni prerequisites when opening dropdown
                  await checkOmniPrereqs();
                }
                setIsClusterDropdownOpen(!isClusterDropdownOpen);
              }}
            >
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="hidden sm:inline">Setup Kubernetes</span>
              <span className="sm:hidden">K8s</span>
              <svg
                className={`w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2 transition-transform ${isClusterDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Cluster dropdown menu */}
            {isClusterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-auto min-w-max bg-white rounded-md shadow-lg z-50 py-1">
                <button
                  onClick={handleOpenShiftClusterClick}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                >
                  <SiRedhatopenshift className="w-4 h-4 mr-2" style={{ color: '#DC2626' }} />
                  OpenShift
                </button>
                <button
                  onClick={handleUbuntuClusterClick}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                >
                  <GrUbuntu className="w-4 h-4 mr-2" style={{ color: '#EA580C' }} />
                  Ubuntu
                </button>
                <button
                  onClick={handleK3sClusterClick}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                >
                  <SiK3S className="w-4 h-4 mr-2" style={{ color: '#EAB308' }} />
                  K3S
                </button>
                {/* Conditionally show Omni buttons based on prerequisites */}
                {isLoadingOmniPrereqs ? (
                  <div className="flex items-center w-full px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                    Checking prerequisites...
                  </div>
                ) : omniPrereqs ? (
                  <>
                    {/* Show Omni Server button if any prerequisite is false */}
                    {(!omniPrereqs.Certs || !omniPrereqs.Keycloak || !omniPrereqs.OmniServer) && (
                      <button
                        onClick={handleOmniClick}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                      >
                        <SiTalos className="w-4 h-4 mr-2" style={{ color: '#F97316' }} />
                        OmniServer
                      </button>
                    )}

                    {/* Show Omni button only if all prerequisites are true */}
                    {omniPrereqs.Certs && omniPrereqs.Keycloak && omniPrereqs.OmniServer && (
                      <button
                        onClick={handleOmniVMClick}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                      >
                        <SiTalos className="w-4 h-4 mr-2" style={{ color: '#F97316' }} />
                        Omni
                      </button>
                    )}
                  </>
                ) : (
                  /* Fallback: show Omni Server button if prerequisites check failed */
                  <button
                    onClick={handleOmniClick}
                    className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                  >
                    <SiTalos className="w-4 h-4 mr-2" style={{ color: '#F97316' }} />
                    Omni Server
                  </button>
                )}

                {/* Google Anthos Button */}
                {/* <button
                onClick={handleGoogleAnthosClick}
                className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
              >
                <AnthosIcon className="w-4 h-4 mr-2" />
                Google Anthos
              </button> */}
              </div>
            )}
          </div>

          <Notification className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
          <div ref={dropdownRef} className="relative ml-1 sm:ml-2">
            <div
              className="flex items-center space-x-1 sm:space-x-4 cursor-pointer"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="flex items-center">
                <span className="text-xs sm:text-sm font-medium text-gray-900 hidden sm:inline">
                  {userName}
                </span>
                <span className="text-xs sm:text-sm font-medium text-gray-900 sm:hidden">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <svg
                  className={`w-3 h-3 sm:w-4 sm:h-4 ml-1 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* User dropdown menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 py-1">
                {/* Account Info - only show for admin users */}
                {hasPermission('USER_MANAGE') && (
                  <>
                    <button
                      onClick={handleAccountInfoClick}
                      className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <IoPerson className="w-4 h-4 mr-2" />
                      Account Info
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <SideroWebSocketModal
        isOpen={isSideroModalOpen}
        onClose={() => setIsSideroModalOpen(false)}
      />
    </>
  );
};

export default TopNavBar;
