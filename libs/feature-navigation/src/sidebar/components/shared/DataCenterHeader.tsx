import React, { useState } from 'react';
import { SearchNormal } from 'iconsax-react';

interface DataCenterHeaderProps {
  name: string;
  activeSection: 'control-center' | 'clusters' | 'migrate' | 'licenses';
  onSearchChange?: (value: string) => void;
}

/**
 * DataCenterHeader Component
 * Displays the header for a data center in the sidebar content area
 * Shows the data center name, current section type (Nodes or Kubernetes), and search box
 */
export const DataCenterHeader: React.FC<DataCenterHeaderProps> = ({
  name,
  activeSection,
  onSearchChange,
}) => {
  const [searchValue, setSearchValue] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearchChange?.(value);
  };

  return (
    <div className="p-2 sm:p-3 border-b border-gray-200 bg-white flex-shrink-0">
      {/* Search Box */}
      <div className="relative">
        <SearchNormal
          size={16}
          color="#9CA3AF"
          className="absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search..."
          value={searchValue}
          onChange={handleSearchChange}
          className="w-full pl-7 pr-2 py-1.5 text-xs sm:text-sm bg-white border-2 border-gray-300 rounded focus:outline-none focus:border-blue-600 transition-colors duration-200"
        />
      </div>
    </div>
  );
};

export default DataCenterHeader;
