import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

export interface ServerOption {
  ip: string;
  fqdn?: string;
  name: string;
}

interface ServerDropdownProps {
  servers: ServerOption[];
  selectedServer?: ServerOption | null;
  onServerSelect: (serverIp: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxNameLength?: number;
}

export default function ServerDropdown({
  servers,
  selectedServer,
  onServerSelect,
  placeholder = 'Select Server',
  disabled = false,
  className = '',
  maxNameLength = 25,
}: ServerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Format server name for display - removes brackets and their content, then truncates long names
  const formatServerName = (name: string) => {
    // Remove brackets and their content (e.g., "test-1 (192.168.116.93)" becomes "test-1")
    let cleanedName = name.replace(/\s*\([^)]*\)/g, '').trim();

    if (cleanedName.length <= maxNameLength) {
      return cleanedName;
    }

    // Truncate at maxNameLength
    return cleanedName.substring(0, maxNameLength) + '...';
  };

  // Calculate dropdown position
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 2,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        updateDropdownPosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      updateDropdownPosition();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  const handleServerSelect = (server: ServerOption) => {
    onServerSelect(server.ip);
    setIsOpen(false);
  };

  const displayName = selectedServer ? formatServerName(selectedServer.name) : null;

  return (
    <>
      {/* Dropdown Button */}
      <div
        ref={buttonRef}
        onClick={handleToggle}
        className={`relative border border-gray-300 bg-white text-gray-700 rounded-md py-1.5 pl-2.5 pr-7 appearance-none focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 cursor-pointer transition-colors h-[32px] flex items-center ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'
        } ${className}`}
      >
        <div className="flex-1 overflow-hidden">
          {selectedServer ? (
            <span className="text-xs truncate block">{displayName as string}</span>
          ) : (
            <span className="text-xs text-gray-500 truncate block">
              {servers.length === 0 ? 'No servers available' : placeholder}
            </span>
          )}
        </div>

        {/* Dropdown Arrow */}
        <div className="pointer-events-none flex items-center text-gray-500 ml-1.5">
          {isOpen ? (
            <i className="w-3 h-3">{React.createElement(FaChevronUp as any, { size: 12 })}</i>
          ) : (
            <i className="w-3 h-3">{React.createElement(FaChevronDown as any, { size: 12 })}</i>
          )}
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen &&
        servers.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed bg-white shadow-xl z-[9999] border border-gray-200 rounded-md max-h-60 overflow-y-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
            {servers.map((server) => {
              const formattedName = formatServerName(server.name);
              const isSelected = (selectedServer?.fqdn || selectedServer?.ip) === server.ip;

              return (
                <div
                  key={server.ip}
                  onClick={() => handleServerSelect(server)}
                  className={`px-2.5 py-1.5 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
                    isSelected ? 'bg-slate-500 text-white' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-xs">{formattedName}</span>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
