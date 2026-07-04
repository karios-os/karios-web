import React from 'react';
import { HiChevronRight } from 'react-icons/hi2';
import Button from './Button';

// TypeScript interfaces
interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  isClickable?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

interface BreadcrumbItemComponentProps {
  item: BreadcrumbItem;
  index: number;
  isLast: boolean;
  isClickable: boolean;
}

// Reusable BreadcrumbItem component for individual list items
const BreadcrumbItemComponent: React.FC<BreadcrumbItemComponentProps> = ({
  item,
  index,
  isLast,
  isClickable,
}) => {
  return (
    <li className="flex items-center">
      {index > 0 && <HiChevronRight className="flex-shrink-0 h-4 w-4 text-gray-400 mx-2" />}
      {isClickable && item.onClick ? (
        <Button
          onClick={item.onClick}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer p-0 border-0 bg-transparent"
        >
          {item.label}
        </Button>
      ) : (
        <span className={`text-sm font-medium ${isLast ? 'text-gray-900' : 'text-gray-500'}`}>
          {item.label}
        </span>
      )}
    </li>
  );
};

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isClickable =
            item.isClickable !== undefined ? item.isClickable : !isLast && index > 0;

          return (
            <BreadcrumbItemComponent
              key={index}
              item={item}
              index={index}
              isLast={isLast}
              isClickable={isClickable}
            />
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
export { BreadcrumbItemComponent };
export type { BreadcrumbItem, BreadcrumbProps, BreadcrumbItemComponentProps };
