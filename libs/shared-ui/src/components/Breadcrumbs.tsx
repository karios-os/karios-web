import React from 'react';
import { MdArrowBack } from 'react-icons/md';

const ArrowBackIcon = MdArrowBack as React.ComponentType<{ size: number }>;

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onBack?: () => void;
  className?: string;
  separator?: string;
  showBackButton?: boolean;
}

/**
 * Reusable Breadcrumbs component for navigation hierarchy
 *
 * @example
 * ```tsx
 * <Breadcrumbs
 *   items={[
 *     { label: 'Distributions', onClick: () => navigate('/distributions') },
 *     { label: 'OpenShift', onClick: () => navigate('/distributions/openshift') },
 *     { label: 'cluster-name', isActive: true }
 *   ]}
 *   onBack={() => window.history.back()}
 * />
 * ```
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  onBack,
  className = '',
  separator = '›',
  showBackButton = true,
}) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-lg text-gray-800 ${className}`}>
      {/* Back Button */}
      {showBackButton && onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          aria-label="Go back"
        >
          <ArrowBackIcon size={24} />
        </button>
      )}

      {/* Breadcrumb Items */}
      <div className="flex items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isActive = item.isActive ?? isLast;

          return (
            <React.Fragment key={index}>
              {/* Breadcrumb Item */}
              {item.onClick && !isActive ? (
                <button
                  onClick={item.onClick}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {item.label}
                </button>
              ) : (
                <span className={isActive ? 'font-semibold' : 'text-gray-600'}>{item.label}</span>
              )}

              {/* Separator */}
              {!isLast && (
                <span className="text-gray-400" aria-hidden="true">
                  {separator}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default Breadcrumbs;
