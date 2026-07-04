import React from 'react';

interface ActiveBadgeProps {
  active: string;
  className?: string;
}

export default function ActiveBadge({
  active,
  className = '',
}: ActiveBadgeProps): React.ReactElement {
  const isActive = active === 'yes';

  return (
    <span
      className={`text-xs px-2 py-1 rounded-full ${
        isActive ? 'bg-lime-500 text-white' : 'bg-red-500 text-red-800'
      } ${className}`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}
