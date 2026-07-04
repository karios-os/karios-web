import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppState } from '@karios-monorepo/shared-state';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import { TwoFactorManagement } from '@karios-monorepo/feature-auth';
import { IoPerson } from 'react-icons/io5';

interface Tab {
  id: string;
  label: string;
  component: React.ReactNode;
}

const AccountInfo: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, fetchRolesData, fetchAllUsers } = useAppState();
  const { roles, allUsers } = state;

  // Get tab from URL path (e.g., /account-info/2fa -> '2fa')
  const getActiveTabFromPath = () => {
    const pathParts = location.pathname.split('/');
    const tabPath = pathParts[pathParts.length - 1];
    if (['roles', 'users', '2fa'].includes(tabPath)) {
      return tabPath;
    }
    return 'roles'; // default
  };

  const [activeTab, setActiveTab] = useState<string>(getActiveTabFromPath());

  useEffect(() => {
    fetchRolesData();
    fetchAllUsers();
  }, []);

  // Update active tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [location.pathname]);

  const tabs: Tab[] = [
    {
      id: 'roles',
      label: 'Role Management',
      component: <RoleManagement />,
    },
    {
      id: 'users',
      label: 'User Management',
      component: <UserManagement />,
    },
    {
      id: '2fa',
      label: '2FA Management',
      component: <TwoFactorManagement />,
    },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    navigate(`/account-info/${tabId}`);
  };

  return (
    <div className="w-full bg-white-50 min-h-screen flex flex-col">
      {/* Header Section - Sticky */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-1 sm:py-2">
          {/* Title with Icon */}
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="bg-blue-500 text-white p-1.5 sm:p-2 rounded-lg flex-shrink-0">
              <IoPerson size={20} className="sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">User & Roles</h1>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 sm:gap-2 overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
            {tabs.map((tab) => (
              <div key={tab.id} className="relative group">
                <button
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 lg:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm border-b-2 transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                  title={tab.label}
                >
                  {/* Icons for each tab */}
                  {tab.id === 'roles' ? (
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  ) : tab.id === 'users' ? (
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  ) : tab.id === '2fa' ? (
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  ) : null}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>

                {/* Tooltip - visible on hover on mobile when only icon shows */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 pointer-events-none sm:group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap sm:hidden">
                  {tab.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-8">
        {tabs.find((tab) => tab.id === activeTab)?.component}
      </div>
    </div>
  );
};

export default AccountInfo;
