import React from 'react';

interface StatsCardProps {
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: string | number;
  description?: string;
  backgroundColor?: string;
  borderColor?: string;
  iconColor?: string;
  tooltip?: React.ReactNode;
  tooltipPosition?: 'top' | 'bottom';
  className?: string;
}

/**
 * Reusable Stats Card Component
 * Displays a single metric with icon, label, and value
 * Supports optional tooltip on hover
 */
const StatsCard: React.FC<StatsCardProps> = ({
  icon: Icon,
  label,
  value,
  description,
  backgroundColor = 'bg-blue-50',
  borderColor = 'border-blue-200',
  iconColor = 'text-blue-600',
  tooltip,
  tooltipPosition = 'bottom',
  className = '',
}) => {
  return (
    <div
      className={`${backgroundColor} rounded-lg border ${borderColor} p-3 ${className} relative group`}
    >
      {/* Header with Icon and Label */}
      <div className="flex items-center gap-1 mb-1">
        {Icon && <Icon size={16} className={iconColor} />}
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</div>
      </div>

      {/* Value */}
      <div className="text-xl font-bold text-gray-900 mb-1">{value}</div>

      {/* Description */}
      {description && <div className="text-xs text-gray-600">{description}</div>}

      {/* Tooltip */}
      {tooltip && (
        <div
          className={`absolute ${
            tooltipPosition === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'
          } right-0 w-80 bg-gray-900 text-white text-sm rounded-lg p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50`}
        >
          {tooltip}
          {tooltipPosition === 'top' && (
            <div className="absolute right-4 -bottom-1.5 w-3 h-3 bg-gray-900 rotate-45"></div>
          )}
          {tooltipPosition === 'bottom' && (
            <div className="absolute right-4 -top-1.5 w-3 h-3 bg-gray-900 rotate-45"></div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatsCard;
