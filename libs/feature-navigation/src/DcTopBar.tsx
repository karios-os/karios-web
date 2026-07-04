import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { FaCogs, FaTerminal, FaBolt, FaChartBar, FaBell } from 'react-icons/fa';
import { DC_Console } from '@karios-monorepo/feature-datacenter'; // Components from feature-datacenter
import DcISO from '../../feature-datacenter/src/DcISO';
import Storage from '../../feature-datacenter/src/ClientStorage';
import DCStats from '../../feature-datacenter/src/DCStats';
import Notification from '../../feature-datacenter/src/Notification';
import ApprovalsPage from '../../feature-datacenter/src/ApprovalsPage';
import { useAppState } from '@karios-monorepo/shared-state';
import { ScrollableContent } from '@karios-monorepo/shared-ui';
import { Code1, Driver, Coin } from 'iconsax-react';
import { AppStateContext, NavItemProps } from './DcTopBar-types';
import { NavItem } from './ServerTopBar';
import envConfig from '../../../runtime-config';

export default function DataCenterTopBar() {

  const { state, setDataCenterView } = useAppState() as AppStateContext; // Use AppStateContext with setDataCenterView and dispatch
  const { selectedDataCenter, currentDataCenterView } = state; // Get both datacenter, current view and seaweedMasterConfig
  const dataCenterId = selectedDataCenter?.id; // Get the Data Center ID
  const location = useLocation(); // Get the current location
  const isDataCenterBasePath = location.pathname === `/dc/${dataCenterId}`; // Check if the user is on the base path

  // Update global state when route changes
  useEffect(() => {
    let newView: string | null = null;
    if (location.pathname.includes('/console')) {
      newView = 'console';
    } else if (location.pathname.includes('/storage')) {
      newView = 'storage';
    } else if (location.pathname.includes('/stats')) {
      newView = 'stats';
    } else if (location.pathname.includes('/notifications')) {
      newView = 'notifications';
    } else if (location.pathname.includes('/approvals')) {
      newView = 'approvals';
    } else if (location.pathname.includes('/iso')) {
      newView = 'iso';
    }
    if (newView && newView !== currentDataCenterView) {
      setDataCenterView(newView);
    }
  }, [location.pathname, setDataCenterView, currentDataCenterView]);

  // Handle tab switching - let NavLink routing handle navigation
  const handleTabChange = (view: string) => {
    // Do nothing - NavLink will handle navigation and pathname change
    // The useEffect watching location.pathname will update the state
  };

  // If no Data Center is selected, show a message
  if (!selectedDataCenter) {
    return <div className="text-center p-6">No Data Center selected</div>;
  }

  return (
    <div className="overflow-auto h-full w-full">
      {/* Display selected Data Center name */}

      <div className="px-4 w-full">
        <div className="">
          <div className="flex items-center gap-2">
            <span className="text-gray-800 break-words">{selectedDataCenter.name}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col mt-0 rounded-lg w-full">
          <div className="sticky top-0 z-40 flex items-center gap-2 bg-gray-100 rounded-lg flex-wrap w-full">
            {/* Modified order to match pasted code, but preserving global state functionality */}
            <NavItem
              to={`/dc/${dataCenterId}/storage`}
              icon={Driver}
              label="Storage"
              onClick={() => handleTabChange('storage')}
              isActive={currentDataCenterView === 'storage'}
            />
            {envConfig().ENABLE_SEAWEED && (
              <NavItem
                to={`/dc/${dataCenterId}/seaweed`}
                icon={Coin}
                label="Seaweed"
                onClick={() => handleTabChange('seaweed')}
                isActive={currentDataCenterView === 'seaweed'}
              />
            )}
            <NavItem
              to={`/dc/${dataCenterId}/iso`}
              icon={Coin}
              label="ISO"
              onClick={() => handleTabChange('iso')}
              isActive={currentDataCenterView === 'iso'}
            />
            <NavItem
              to={`/dc/${dataCenterId}/notifications`}
              icon={FaBell}
              label="Event logs"
              onClick={() => handleTabChange('notifications')}
              isActive={currentDataCenterView === 'notifications'}
            />

            <NavItem
              to={`/dc/${dataCenterId}/approvals`}
              icon={FaCogs}
              label="Approvals"
              onClick={() => handleTabChange('approvals')}
              isActive={currentDataCenterView === 'approvals'}
            />

            <NavItem
              to={`/dc/${dataCenterId}/stats`}
              icon={FaChartBar}
              label="Stats"
              onClick={() => handleTabChange('stats')}
              isActive={currentDataCenterView === 'stats'}
            />
          </div>

          {/* Route Content */}
          <ScrollableContent hasTopBar={true} topBarHeight="120px" maxHeight="100%">
            {/* Redirect to default view based on global state */}
            {isDataCenterBasePath && (
              <Navigate to={`/dc/${dataCenterId}/${currentDataCenterView}`} replace />
            )}
            <Routes>
              <Route path="console" element={<DC_Console />} />
              <Route path="storage" element={<Storage />} />
              <Route
                path="notifications"
                element={<Notification host={envConfig().CONTROL_NODE_IP.URL} />}
              />
              <Route
                path="approvals"
                element={<ApprovalsPage host={envConfig().CONTROL_NODE_IP.URL} />}
              />
              <Route path="stats" element={<DCStats />} />
              <Route path="iso" element={<DcISO />} />
              <Route path="*" element={<Navigate to="stats" replace />} />
            </Routes>
          </ScrollableContent>
        </div>
      </div>

    </div>
  );
}
