import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown2 } from 'iconsax-react';

export interface DropdownItem {
  id: string;
  label: string;
  subtitle?: string;
  file?: string;
}

interface MultiSelectDropdownProps {
  items: DropdownItem[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  isDisabled: boolean;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  maxHeight?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  items,
  selectedIds,
  onSelectionChange,
  isDisabled,
  placeholder = 'Select items',
  emptyText = 'No items available',
  className = '',
  maxHeight = 'max-h-80',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleItemToggle = (itemId: string) => {
    if (isDisabled) return;

    const newSelections = selectedIds.includes(itemId)
      ? selectedIds.filter((id) => id !== itemId)
      : [...selectedIds, itemId];

    onSelectionChange(newSelections);
  };

  const getDisplayText = () => {
    if (selectedIds.length === 0) return placeholder;
    if (selectedIds.length === 1) {
      const selectedItem = items.find((item) => item.id === selectedIds[0]);
      return selectedItem?.label || placeholder;
    }
    return `${selectedIds.length} items selected`;
  };

  // Check if there are any available items
  const hasItems = items && items.length > 0;

  if (!hasItems) {
    return <div className={`text-sm text-gray-400 italic ${className}`}>{emptyText}</div>;
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`flex items-center justify-between w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
          isDisabled ? 'opacity-30 cursor-not-allowed grayscale blur-[0.5px]' : 'opacity-100'
        }`}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
      >
        <span className="truncate">{getDisplayText()}</span>
        <ArrowDown2
          size={16}
          className={`ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && !isDisabled && (
        <div
          className={`absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg ${maxHeight} overflow-auto`}
        >
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className="flex items-start px-3 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => handleItemToggle(item.id)}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5 flex-shrink-0"
                  checked={isSelected}
                  onChange={() => {}} // Handled by parent div onClick
                />
                <div className="ml-2 text-sm">
                  <div className="text-gray-900 font-medium">
                    {item.label}
                    {item.subtitle && ` (${item.subtitle})`}
                  </div>
                  {item.file && (
                    <div className="text-xs text-gray-500 truncate mt-0.5">{item.file}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
