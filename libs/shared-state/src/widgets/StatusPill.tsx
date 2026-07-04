import React from 'react';

interface StatusPillProps {
  status: string;
  className?: string;
}

const StatusPill: React.FC<StatusPillProps> = ({ status, className = '' }) => {
  const getStatusStyles = (status: string) => {
    const normalizedStatus = status.toLowerCase();

    switch (normalizedStatus) {
      case 'available':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'unavailable':
      case 'offline':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'pending':
      case 'in progress':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'active':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'inactive':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusStyles(
        status
      )} ${className}`}
    >
      {status}
    </span>
  );
};

export default StatusPill;
