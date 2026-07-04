import React from 'react';

interface StatusIndicatorProps {
  status: string;
  label?: string;
  className?: string;
}

export default function StatusIndicator({
  status,
  label,
  className = 'w-2 h-2 rounded-full mr-2',
}: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status.toLowerCase()) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-red-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unavailable':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="flex items-center">
      <div className={`${className} ${getStatusColor()}`} title={status}></div>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </div>
  );
}
