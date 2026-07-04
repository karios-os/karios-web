import React from 'react';

interface PublicBadgeProps {
  private: string;
  className?: string;
}

export default function PublicBadge({
  private: isPrivate,
  className = '',
}: PublicBadgeProps): React.ReactElement {
  const isPrivateMode = isPrivate === 'yes';

  return (
    <span
      className={`text-xs px-2 py-1 rounded-full ${
        isPrivateMode ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-400 text-white'
      } ${className}`}
    >
      {isPrivateMode ? 'Private' : 'Public'}
    </span>
  );
}
