/**
 * HoverZoneTrigger Component
 * Renders invisible mouse trigger zones for sidebar expand/collapse behavior
 */
import React from 'react';

export interface HoverZoneTriggerProps {
  type: 'hidden-trigger' | 'expanded-hover-zone';
  onMouseEnter: () => void;
  onMouseLeave?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const HoverZoneTrigger: React.FC<HoverZoneTriggerProps> = ({
  type,
  onMouseEnter,
  onMouseLeave,
  className = '',
  style = {},
}) => {
  const defaultStyle = {
    top: '60px',
    height: 'calc(100vh - 60px)',
  };

  const typeClasses = {
    'hidden-trigger': 'fixed left-0 w-4 z-40 bg-transparent',
    'expanded-hover-zone':
      'fixed left-0 w-2 z-60 bg-transparent transition-all duration-[1000ms] ease-in-out',
  };

  return (
    <div
      className={`${typeClasses[type]} ${className}`}
      style={{ ...defaultStyle, ...style }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
};

export default HoverZoneTrigger;
