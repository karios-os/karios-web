import React from 'react';

// TypeScript interface for Card props
interface CardProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; size?: string | number; color?: string }>;
  iconColor?: string;
  iconSize?: number;
  iconPosition?: 'left' | 'right';
  className?: string;
  titleExtra?: React.ReactNode;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  title,
  description,
  children,
  icon: Icon,
  iconColor = '#000000',
  iconSize = 20,
  iconPosition = 'left',
  className = '',
  titleExtra,
  onClick,
}) => {
  return (
    <div
      className={className}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {(title || description || Icon) && (
        <div className="top-0 z-4 flex flex-col items-start justify-between bg-white-50 p-3 rounded-t-lg">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              {Icon && iconPosition === 'left' && (
                <Icon className="flex-shrink-0" size={iconSize} color={iconColor} />
              )}
              <div className="flex flex-col gap-0">
                {title && <h2 className="text-xl font-bold z-2">{title}</h2>}
                {description && <div className="text-sm text-gray-500">{description}</div>}
              </div>
            </div>
            {titleExtra && <div className="flex items-center">{titleExtra}</div>}
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
