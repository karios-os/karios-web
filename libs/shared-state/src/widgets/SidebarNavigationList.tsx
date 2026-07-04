/**
 * Sidebar Navigation List Component
 * Reusable component for displaying navigable lists in sidebar
 */
import React, { useState } from 'react';
import { ArrowDown2, ArrowUp2 } from 'iconsax-react';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
  isLoading?: boolean;
  hasChildren?: boolean;
  children?: SidebarNavItem[];
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

export interface SidebarNavigationListProps {
  items: SidebarNavItem[];
  title?: string;
  className?: string;
  itemClassName?: string;
  onItemClick?: (item: SidebarNavItem) => void;
}

export const SidebarNavigationList: React.FC<SidebarNavigationListProps> = ({
  items,
  title,
  className = 'flex flex-col gap-1',
  itemClassName = 'p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors',
}) => {
  return (
    <div className={className}>
      {title && <h3 className="text-sm font-semibold px-2 py-1 text-gray-600">{title}</h3>}
      {items.map((item) => (
        <div key={item.id}>
          <div
            className={`${itemClassName} ${item.isActive ? 'bg-blue-100 text-blue-600' : ''} ${
              item.isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={() => !item.isLoading && item.onClick()}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </span>
              {item.hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onToggleExpand?.();
                  }}
                  className="ml-auto"
                >
                  {item.isExpanded ? <ArrowUp2 size={16} /> : <ArrowDown2 size={16} />}
                </button>
              )}
            </div>
          </div>
          {item.isExpanded && item.children && (
            <div className="pl-4 flex flex-col gap-1">
              {item.children.map((child) => (
                <div
                  key={child.id}
                  className={`${itemClassName} ${child.isActive ? 'bg-blue-100 text-blue-600' : ''}`}
                  onClick={child.onClick}
                >
                  <span className="flex items-center gap-2">
                    {child.icon && <span>{child.icon}</span>}
                    {child.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SidebarNavigationList;
