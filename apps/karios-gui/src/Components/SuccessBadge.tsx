// SuccessBadge.jsx
import React from 'react';

const SuccessBadge = ({ className = '' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <span>Success</span>
    </div>
  );
};

export default SuccessBadge;
