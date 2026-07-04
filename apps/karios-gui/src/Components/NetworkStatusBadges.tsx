import React from 'react';
import ActiveBadge from './ActiveBadge';
import PublicBadge from './PublicBadge';

interface NetworkStatusBadgesProps {
  active: string;
  private: string;
  className?: string;
}

export default function NetworkStatusBadges({
  active,
  private: isPrivate,
  className = '',
}: NetworkStatusBadgesProps): React.ReactElement {
  return (
    <div className={`flex gap-2 ${className}`}>
      <ActiveBadge active={active} />
      {/* <PublicBadge private={isPrivate} /> */}
    </div>
  );
}
