import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  Home,
  Coin,
  DocumentText,
  Chart2,
  ShieldSecurity,
  KeyboardOpen,
  Electricity,
  Monitor,
  Code,
} from 'iconsax-react';
import { MdElectricBolt } from 'react-icons/md'; // Keeping this for PowerMetrics
import { FaBug } from 'react-icons/fa'; // Keeping this for PowerMetrics
import Debugging from '../../feature-server/src/Debugging'; // Import the Debugging component
import { BsPciCardNetwork } from 'react-icons/bs'; // For PCIe devices tab
import { CiDatabase } from 'react-icons/ci';
import { FaCogs } from 'react-icons/fa';
import { useAppState, usePermissions } from '@karios-monorepo/shared-state'; // Import from shared-state
import { createComponentLogger } from '../../shared-state/src/utils/logger';
import api from '../../shared-state/src/utils/interceptor'; // Import api with relative path
import envConfig from '../../../runtime-config'; // Import environment config

import { ScrollableContent } from '@karios-monorepo/shared-ui'; // Import ScrollableContent
import { useContext } from 'react';
import { Server, AppStateContext } from './ServerTopBar-types';

import Notification from '../../feature-datacenter/src/Notification'; // Add import for event logs with shared state
import { FcSupport } from 'react-icons/fc';
import { VscDebugAlt } from 'react-icons/vsc';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}

// Import server components from feature-server
import {
  ISO,
  LandingPage,
  PowerMetrics,
  SystemLogs,
  metrics as Monitoring,
  network as Network,
  storage as StorageDetails,
  powerMonitoring as PowerMonitoring,
  ServerFirewall,
} from '@karios-monorepo/feature-server';


// Temporary direct import until module export is recognized
import ServerConsole from '../../feature-server/src/ServerConsole';

import PCIeDevices from '../../feature-server/src/PCIeDevices';
import SupportBundle from './SupportBundle';
import DiagnosticsDropdown from './DiagnosticsDropdown';

// WebSocket functionality is handled by components themselves

export default function ServerTopBar() {
  const logger = createComponentLogger('ServerTopBar');

  const { state, setServerView } = useAppState() as AppStateContext; // Access global state
  const { selectedServer, currentServerView } = state; // Get server and current view from global state

  const { permissions } = usePermissions(); // Use the usePermissions hook directly

  // State for fetched vendor from inventory API
  const [inventoryVendor, setInventoryVendor] = useState<string | null>(null);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [isControlNode, setIsControlNode] = useState<boolean>(false);
  const [isPiKVMConnected, setIsPiKVMConnected] = useState<boolean>(false);

  // Consolidated ref for DOM element and preventing concurrent requests
  const topBarRef = React.useRef<HTMLDivElement>(null);
  const [topBarHeight, setTopBarHeight] = useState<string>('120px'); // Default fallback

  // Ref to prevent concurrent requests for the same server
  const ongoingInventoryFetchRef = useRef<{ [key: string]: Promise<void> }>({});

  const serverId = selectedServer?.id; // Get the server ID
  const serverName = selectedServer?.name; // Get the server name
  const location = useLocation(); // Get current location
  const isServerBasePath = location.pathname === `/server/${serverId}`; // Check if on base path

  // Function to fetch vendor from inventory API - prevents concurrent requests only
  const fetchInventoryVendor = async (osIp: string) => {
    try {
      // Prevent concurrent requests for the same server
      if (ongoingInventoryFetchRef.current[osIp]) {
        return ongoingInventoryFetchRef.current[osIp];
      }

      setVendorLoading(true);

      const requestPromise = (async () => {
        try {
          const config = envConfig();
          const url = `${config.PROTOCOL}://${config.CONTROL_NODE_IP.URL}${config.CONTROL_NODE_IP.PORT}/api/v1/controlnode/inventory?os_ip=${osIp}`;

          const response = await api.fetch(url, {
            method: 'GET',
          });

          if (!response.ok) {
            throw new Error('Failed to fetch inventory data');
          }

          const data = await response.json();

          // Extract vendor from the first inventory item
          if (data.inventory && data.inventory.length > 0) {
            const inventoryItem = data.inventory[0];
            setInventoryVendor(inventoryItem.vendor || null);
            setIsControlNode(inventoryItem.is_control_node || false);
            setIsPiKVMConnected(inventoryItem.is_pikvm_connected || false);
          } else {
            setInventoryVendor(null);
            setIsControlNode(false);
            setIsPiKVMConnected(false);
          }
        } catch (error) {
          logger.error('Error fetching inventory vendor:', error);
          setInventoryVendor(null);
          setIsControlNode(false);
          setIsPiKVMConnected(false);
        } finally {
          setVendorLoading(false);
          delete ongoingInventoryFetchRef.current[osIp];
        }
      })();

      ongoingInventoryFetchRef.current[osIp] = requestPromise;
      return requestPromise;
    } catch (error) {
      logger.error('Error in fetchInventoryVendor:', error);
      setVendorLoading(false);
    }
  };

  // Fetch vendor when selectedServer changes
  useEffect(() => {
    if (selectedServer?.ip) {
      const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
      fetchInventoryVendor(serverAddress);
    } else {
      setInventoryVendor(null);
      setIsControlNode(false);
      setIsPiKVMConnected(false);
    }
  }, [selectedServer?.ip, selectedServer?.fqdn]);

  // Calculate dynamic top bar height
  useEffect(() => {
    const calculateTopBarHeight = () => {
      if (topBarRef.current) {
        const height = topBarRef.current.offsetHeight;
        setTopBarHeight(`${height}px`);
      }
    };

    // Calculate initial height
    calculateTopBarHeight();

    // Create ResizeObserver to handle window resizing and zoom changes
    const resizeObserver = new ResizeObserver(() => {
      calculateTopBarHeight();
    });

    if (topBarRef.current) {
      resizeObserver.observe(topBarRef.current);
    }

    // Also listen for window resize as backup
    const handleResize = () => {
      setTimeout(calculateTopBarHeight, 100); // Small delay to ensure layout is updated
    };

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedServer, isPiKVMConnected, isControlNode]); // Recalculate when tabs change

  // Update global state when route changes
  useEffect(() => {
    if (location.pathname.includes('/server/') && setServerView) {
      // Extract view from path
      const pathParts = location.pathname.split('/');
      const viewIndex = pathParts.findIndex((part) => part === serverName) + 1;
      if (viewIndex < pathParts.length) {
        setServerView(pathParts[viewIndex]);
      }
    }
  }, [location.pathname, serverName]);

  // Handle tab switching with global state
  const handleTabChange = (view: string) => {
    if (setServerView) {
      setServerView(view);
    }
  };

  // Check if no server is selected
  if (!selectedServer) {
    return <div className="text-center p-6">No server selected</div>;
  }

  return (
    <div className="overflow-auto h-full">
      {/* Display selected server name */}

      <div className="flex items-center justify-between text-lg font-bold text-gray-800 mt-3">
        <div className="flex items-center">
          <span className="text-karios-blue">Selected Server:</span>
          <span className="ml-2">{serverName}</span>
        </div>
      </div>
      <div className="flex flex-col mt-4 rounded-lg">
        {/* Server Navigation Tabs */}
        <div
          ref={topBarRef}
          className="sticky top-0 z-30 flex items-center mb-5 gap-4 bg-gray-100 rounded-lg flex-wrap border border-gray-100"
        >

          <NavItem
            to={`/server/${serverName}/home`}
            icon={Home}
            label="Home"
            onClick={() => handleTabChange('home')}
            isActive={currentServerView === 'home'}
          />

          <NavItem
            to={`/server/${serverName}/iso`}
            icon={CiDatabase}
            label="ISO"
            onClick={() => handleTabChange('iso')}
            isActive={currentServerView === 'iso'}
          />

          {/* Console Tab - placed next to Home */}
          <NavItem
            to={`/server/${serverName}/console`}
            icon={Code}
            label="Console"
            onClick={() => handleTabChange('console')}
            isActive={currentServerView === 'console'}
          />

          {/* PCIe Devices Tab - placed after ISO */}
          <NavItem
            to={`/server/${serverName}/pcie-devices`}
            icon={BsPciCardNetwork}
            label="PCIe Devices"
            onClick={() => handleTabChange('pcie-devices')}
            isActive={currentServerView === 'pcie-devices'}
          />

          <NavItem
            to={`/server/${serverName}/storage`}
            icon={DocumentText}
            label="Storage"
            onClick={() => handleTabChange('storage')}
            isActive={currentServerView === 'storage'}
          />

          <NavItem
            to={`/server/${serverName}/network`}
            icon={Chart2}
            label="Network"
            onClick={() => handleTabChange('network')}
            isActive={currentServerView === 'network'}
          />

          <NavItem
            to={`/server/${serverName}/firewall`}
            icon={ShieldSecurity}
            label="Firewall"
            onClick={() => handleTabChange('firewall')}
            isActive={currentServerView === 'firewall'}
          />

          <DiagnosticsDropdown
            serverName={serverName || ''}
            currentView={currentServerView || ''}
            onOptionSelect={handleTabChange}
            isActive={[
              'monitoring',
              'SystemLogs',
              'event-logs',
              'debugging',
              'support-bundle',
            ].includes(currentServerView || '')}
          />
        </div>

        {/* Redirect to Home by Default */}
        {isServerBasePath && <Navigate to={`/server/${serverName}/home`} replace />}

        {/* Server Routes */}
        <ScrollableContent hasTopBar={true} topBarHeight={topBarHeight} maxHeight="100%">
          {/* Redirect to Home by Default */}
          {isServerBasePath && <Navigate to={`/server/${serverName}/home`} replace />}
          <Routes>
            <Route path="iso" element={<ISO />} />
            <Route path="console" element={<ServerConsole />} />
            <Route path="storage" element={<StorageDetails />} />
            <Route path="monitoring" element={<Monitoring />} />
            <Route path="network" element={<Network />} />
            <Route path="firewall" element={<ServerFirewall />} />
            <Route path="SystemLogs" element={<SystemLogs />} />
            <Route path="home" element={<LandingPage />} />
            <Route path="pcie-devices" element={<PCIeDevices />} />
            <Route
              path="event-logs"
              element={<Notification host={selectedServer?.fqdn || selectedServer.ip} />}
            />
            <Route path="debugging" element={<Debugging />} />
            <Route path="support-bundle" element={<SupportBundle />} />
          </Routes>
        </ScrollableContent>
      </div>
    </div>
  );
}

// Reusable NavItem Component with state management
export function NavItem({ to, icon: Icon, label, onClick, isActive: forcedActive }: NavItemProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const active = ({ isActive }: { isActive: boolean }) => forcedActive || isActive;

  return (
    <NavLink
      to={to}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={({ isActive }) =>
        `flex items-center gap-2 text-sm px-3 pt-4 pb-0 transition-colors ${
          active({ isActive }) ? 'text-karios-green' : 'text-gray-700 hover:text-cyan-500'
        }`
      }
    >
      <div className="relative ">
        <div className="flex items-center mb-1">
          {/* Icon wrapper with dynamic color */}
          <span className="flex items-center justify-center">
            {Icon === MdElectricBolt ? (
              <Icon
                size={20}
                className={
                  active({ isActive: forcedActive ?? false })
                    ? 'text-karios-blue'
                    : isHovered
                      ? 'text-karios-blue'
                      : 'text-gray-700'
                }
              />
            ) : (
              <Icon
                size={20}
                color={
                  active({ isActive: forcedActive ?? false })
                    ? 'var(--karios-blue)'
                    : isHovered
                      ? 'var(--karios-blue)'
                      : '#4B5563'
                }
              />
            )}
          </span>
          <span className="ml-1">{label}</span>
        </div>
        {active({ isActive: forcedActive ?? false }) && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ backgroundColor: 'var(--karios-blue)' }}
          ></div>
        )}
      </div>
    </NavLink>
  );
}
