import React from 'react';

interface OmniIconProps {
  className?: string;
  size?: number;
}

export const OmniIcon: React.FC<OmniIconProps> = ({ className = '', size = 16 }) => {
  return (
    <img
      src="/om.png"
      alt="Omni Logo"
      width={size}
      height={size}
      className={className}
      style={{
        objectFit: 'contain',
        display: 'inline-block',
      }}
    />
  );
};

export default OmniIcon;
