import React from 'react';
import { AddSquare, ElementPlus } from 'iconsax-react';
import { FaChevronDown } from 'react-icons/fa';
import Button from '../../../shared-state/src/widgets/Button';

interface StorageHeaderProps {
  canManage: boolean;
  selectedView: string;
  dropdownOpen: boolean;
  setCreatingDatastore: (creating: boolean) => void;
  setCreatingZpool: (creating: boolean) => void;
  setDropdownOpen: (open: boolean) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  onViewChange: (view: string) => void;
}

export default function StorageHeader({
  canManage,
  selectedView,
  dropdownOpen,
  setCreatingDatastore,
  setCreatingZpool,
  setDropdownOpen,
  dropdownRef,
  onViewChange,
}: StorageHeaderProps) {
  const getViewDisplayName = (view: string) => {
    switch (view) {
      case 'storage_pools':
        return 'Storage Pools';
      case 'datastores':
        return 'Datastores';
      case 'available_disks':
        return 'Available Disks';
      default:
        return 'Storage Pools';
    }
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-3 bg-white rounded-lg h-auto min-h-[70px] p-2 sm:p-4 mx-0 sm:mx-3 gap-2 sm:gap-0">
      <h2 className="text-xl sm:text-2xl font-semibold text-black">Storage Management</h2>

      <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Create Pool Button */}
          {canManage && (
            <Button
              className="flex items-center text-primary px-2 py-1 rounded-[10px] border border-gray-200 h-[50px] gap-[10px] hover:bg-gray-100"
              onClick={() => {
                setCreatingDatastore(false);
                setCreatingZpool(true);
              }}
            >
              <AddSquare size={24} color="#000000" />
              Create Pool
            </Button>
          )}

          {/* Create Datastore Button */}
          {canManage && (
            <Button
              className="flex items-center text-primary px-2 py-1 rounded-[10px] border border-gray-200 h-[50px] gap-[10px] hover:bg-gray-100"
              onClick={() => {
                setCreatingZpool(false);
                setCreatingDatastore(true);
              }}
            >
              <ElementPlus size={24} color="#000000" />
              Create Datastore
            </Button>
          )}
        </div>

        {/* View Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <Button
            className="flex items-center text-primary px-2 py-1 rounded-[10px] border border-gray-200 h-[50px] gap-[10px] hover:bg-gray-100"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span>{getViewDisplayName(selectedView)}</span>
            <FaChevronDown className="ml-2" />
          </Button>

          {dropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <div className="py-1">
                <button
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${selectedView === 'storage_pools' ? 'bg-gray-100' : ''}`}
                  onClick={() => {
                    onViewChange('storage_pools');
                    setDropdownOpen(false);
                  }}
                >
                  Storage Pools
                </button>
                <button
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${selectedView === 'datastores' ? 'bg-gray-100' : ''}`}
                  onClick={() => {
                    onViewChange('datastores');
                    setDropdownOpen(false);
                  }}
                >
                  Datastores
                </button>
                <button
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${selectedView === 'available_disks' ? 'bg-gray-100' : ''}`}
                  onClick={() => {
                    onViewChange('available_disks');
                    setDropdownOpen(false);
                  }}
                >
                  Available Disks
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
