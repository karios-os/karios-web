// FailureBadge.jsx
import React from 'react';

const FailureBadge = ({ className = '' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <span>Failure</span>
    </div>
  );
};

export default FailureBadge;
