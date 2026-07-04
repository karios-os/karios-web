import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { Chart2, KeyboardOpen, Monitor, ArrowDown2, ArrowUp2 } from 'iconsax-react';
import { FcSupport } from 'react-icons/fc';
import { VscDebugAlt } from 'react-icons/vsc';
import { NavItem } from './ServerTopBar';

interface DiagnosticsOption {
  key: string;
  label: string;
  path: string;
  icon: React.ElementType;
}

interface DiagnosticsDropdownProps {
  serverName: string;
  currentView: string;
  onOptionSelect: (view: string) => void;
  isActive: boolean;
}

const diagnosticsOptions: DiagnosticsOption[] = [
  {
    key: 'monitoring',
    label: 'Monitoring',
    path: 'monitoring',
    icon: Chart2,
  },
  {
    key: 'SystemLogs',
    label: 'System Logs',
    path: 'SystemLogs',
    icon: KeyboardOpen,
  },
  {
    key: 'event-logs',
    label: 'Event Logs',
    path: 'event-logs',
    icon: Monitor,
  },
  {
    key: 'debugging',
    label: 'Debug Tools',
    path: 'debugging',
    icon: VscDebugAlt,
  },
  {
    key: 'support-bundle',
    label: 'Ondemand Services',
    path: 'support-bundle',
    icon: FcSupport,
  },
];

export default function DiagnosticsDropdown({
  serverName,
  currentView,
  onOptionSelect,
  isActive,
}: DiagnosticsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = diagnosticsOptions.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate dropdown position based on button position
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 2, // 2px gap below button
        left: rect.left + window.scrollX,
      });
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        updateDropdownPosition();
      }
    };

    const handleResize = () => {
      if (isOpen) {
        updateDropdownPosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      updateDropdownPosition();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (option: DiagnosticsOption) => {
    onOptionSelect(option.key);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Diagnostics tab is active if any of the diagnostic views is the current view
  const isDiagnosticsActive =
    ['monitoring', 'SystemLogs', 'event-logs', 'debugging', 'support-bundle'].includes(
      currentView
    ) || isActive;

  // Dynamic icon color logic similar to NavItem components
  const getIconColor = () => {
    if (isDiagnosticsActive) return 'var(--karios-blue)'; // Active blue
    if (isHovered) return 'var(--karios-blue)'; // Hover blue
    return '#4B5563'; // Default gray-600
  };

  return (
    <>
      {/* Main Diagnostics Tab Button */}
      <div
        ref={buttonRef}
        className="flex items-center cursor-pointer"
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative">
          <div
            className={`flex items-center gap-2 text-sm px-3 pt-4 pb-0 transition-colors ${
              isDiagnosticsActive ? 'text-karios-green' : 'text-gray-700 hover:text-cyan-500'
            }`}
          >
            <div className="flex items-center mb-1">
              <span className="flex items-center justify-center">
                <VscDebugAlt size={20} color={getIconColor()} />
              </span>
              <span className="ml-1">Diagnostics</span>
              {isOpen ? (
                <ArrowUp2 size={16} className="ml-1" color={getIconColor()} />
              ) : (
                <ArrowDown2 size={16} className="ml-1" color={getIconColor()} />
              )}
            </div>
          </div>
          {isDiagnosticsActive && (
            <div
              className="absolute bottom-0 left-0 right-0 h-[2px]"
              style={{ backgroundColor: 'var(--karios-blue)' }}
            ></div>
          )}
        </div>
      </div>

      {/* Dropdown Menu - Rendered via Portal outside component tree */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed bg-white shadow-xl z-[9999] p-2.5 min-w-[200px] rounded-lg border border-gray-200"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
            }}
          >
            {/* Search Bar */}
            <div className="mb-3 pb-3 border-b border-gray-100">
              <input
                type="text"
                placeholder="Search diagnostics..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            {/* Options List */}
            <div className="space-y-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div key={option.key}>
                    <NavItem
                      to={`/server/${serverName}/${option.path}`}
                      icon={option.icon}
                      label={option.label}
                      onClick={() => handleOptionClick(option)}
                      isActive={currentView === option.key}
                    />
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500 text-center">No options found</div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
