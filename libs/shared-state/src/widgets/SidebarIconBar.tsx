/**
 * Sidebar Icon Bar Component
 * Displays the fixed left bar with pin, control-center, and kubernetes toggle buttons
 * Maintains all original styles and functionality with improved Figma-aligned styling
 */
import React from 'react';
import { Driver, Cpu } from 'iconsax-react';
import { GrCubes } from 'react-icons/gr';
import { FaArrowsSplitUpAndLeft, FaKey } from 'react-icons/fa6';

export interface SidebarIconBarProps {
  isPinned: boolean;
  activeSection: string | null;
  lastActiveSection: string | null;
  onPinClick: () => void;
  onControlCenterClick: () => void;
  onKubernetesClick: () => void;
  onMigrateClick?: () => void;
  onLicenseClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  sidebarState?: 'hidden' | 'small' | 'expanded';
  showBothOptions?: boolean;
}

export const SidebarIconBar: React.FC<SidebarIconBarProps> = ({
  isPinned,
  activeSection,
  lastActiveSection,
  onPinClick,
  onControlCenterClick,
  onKubernetesClick,
  onMigrateClick,
  onLicenseClick,
  onMouseEnter,
  onMouseLeave,
  sidebarState = 'small',
  showBothOptions = false,
}) => {
  return (
    <div
      className="bg-gray-100 flex flex-col transition-all duration-[1000ms] ease-in-out overflow-hidden w-10 sm:w-12 opacity-100"
      style={{ height: 'calc(100vh - 60px)' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Collapse/Menu Icon at top */}
      <div className="p-1 sm:p-2 relative flex items-center justify-center">
        <Driver
          size={18}
          data-testid="sidebar-pin-button"
          color={isPinned ? '#2563eb' : '#6B7280'}
          variant="Bold"
          className={`cursor-pointer hover:text-blue-600 transition-colors duration-300 ${
            isPinned ? 'text-blue-600' : 'text-gray-600'
          }`}
          onClick={onPinClick}
        />
      </div>

      {/* Top - Control Center */}
      <div
        className={`flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ease-in-out py-3 px-2 gap-1 ${
          activeSection === 'control-center' ||
          (!activeSection && lastActiveSection === 'control-center')
            ? 'bg-blue-100'
            : 'hover:bg-gray-200'
        }`}
        onClick={onControlCenterClick}
        title="Control Center"
      >
        <Cpu
          size={20}
          color={
            activeSection === 'control-center' ||
            (!activeSection && lastActiveSection === 'control-center')
              ? '#2563eb'
              : '#6B7280'
          }
          className="transition-colors duration-300"
        />
        <span
          className={`text-[8px] font-medium text-center transition-colors duration-300 leading-tight ${
            activeSection === 'control-center' ||
            (!activeSection && lastActiveSection === 'control-center')
              ? 'text-blue-600'
              : 'text-gray-700'
          }`}
        >
          Control
          <br />
          Center
        </span>
      </div>

      {/* Small spacer between icons */}
      <div className="h-2"></div>

      {/* Bottom - Clusters/Nodes */}
      <div
        className={`flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ease-in-out py-3 px-2 gap-1 ${
          activeSection === 'clusters' || (!activeSection && lastActiveSection === 'clusters')
            ? 'bg-blue-100'
            : 'hover:bg-gray-300'
        }`}
        onClick={onKubernetesClick}
        title="Kubernetes"
      >
        <GrCubes
          size={20}
          color={
            activeSection === 'clusters' || (!activeSection && lastActiveSection === 'clusters')
              ? '#2563eb'
              : '#6B7280'
          }
          className="transition-colors duration-300"
        />
        <span
          className={`text-[8px] font-medium text-center transition-colors duration-300 ${
            activeSection === 'clusters' || (!activeSection && lastActiveSection === 'clusters')
              ? 'text-blue-600'
              : 'text-gray-700'
          }`}
        >
          kubernetes
        </span>
      </div>

      {/* Small spacer between icons */}
      <div className="h-2"></div>

      {/* Migrate Section */}
      {onMigrateClick && (
        <div
          className={`flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ease-in-out py-3 px-2 gap-1 ${
            activeSection === 'migrate' || (!activeSection && lastActiveSection === 'migrate')
              ? 'bg-blue-100'
              : 'hover:bg-gray-300'
          }`}
          onClick={onMigrateClick}
          title="Migrate"
        >
          <FaArrowsSplitUpAndLeft
            size={18}
            color={
              activeSection === 'migrate' || (!activeSection && lastActiveSection === 'migrate')
                ? '#2563eb'
                : '#6B7280'
            }
            className="transition-colors duration-300"
          />
          <span
            className={`text-[8px] font-medium text-center transition-colors duration-300 leading-tight ${
              activeSection === 'migrate' || (!activeSection && lastActiveSection === 'migrate')
                ? 'text-blue-600'
                : 'text-gray-700'
            }`}
          >
            Migrate
          </span>
        </div>
      )}

      {/* Small spacer between icons */}
      <div className="h-2"></div>

      {/* License Section */}
      {onLicenseClick && (
        <div
          className={`flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ease-in-out py-3 px-2 gap-1 ${
            activeSection === 'licenses' || (!activeSection && lastActiveSection === 'licenses')
              ? 'bg-blue-100'
              : 'hover:bg-gray-300'
          }`}
          onClick={onLicenseClick}
          title="Licenses"
        >
          <FaKey
            size={18}
            color={
              activeSection === 'licenses' || (!activeSection && lastActiveSection === 'licenses')
                ? '#2563eb'
                : '#6B7280'
            }
            className="transition-colors duration-300"
          />
          <span
            className={`text-[8px] font-medium text-center transition-colors duration-300 ${
              activeSection === 'licenses' || (!activeSection && lastActiveSection === 'licenses')
                ? 'text-blue-600'
                : 'text-gray-700'
            }`}
          >
            License
          </span>
        </div>
      )}

      {/* Flexible spacer to push everything up */}
      <div className="flex-1 min-h-0"></div>
    </div>
  );
};

export default SidebarIconBar;
