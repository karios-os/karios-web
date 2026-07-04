import React from 'react';

interface SeverityBadgeProps {
  severity: string;
  className?: string;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, className = '' }) => {
  const getBadgeClasses = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-red-300 text-red-600';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'CRITICAL':
        return 'bg-red-400 text-red-800';
      case 'LOW':
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <span
      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getBadgeClasses(severity)} ${className}`}
    >
      {severity}
    </span>
  );
};

export default SeverityBadge;
