import React from 'react';

interface ConnectionStatusIndicatorProps {
  isConnected: boolean;
  isConnecting?: boolean;
  error?: string | null;
  nodeId?: string | number;
  statusCount?: number;
  className?: string;
}

const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  isConnected,
  isConnecting = false,
  error,
  nodeId,
  statusCount,
  className = '',
}) => {
  if (isConnected) {
    return (
      <div className={`flex items-center gap-1 text-green-600 text-xs ${className}`}>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Live Status {statusCount !== undefined && `(${statusCount} VMs tracked)`}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-1 text-red-600 text-xs ${className}`}>
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span>Connection Error</span>
      </div>
    );
  }

  if (isConnecting && nodeId) {
    return (
      <div className={`flex items-center gap-1 text-yellow-600 text-xs ${className}`}>
        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"></div>
        <span>Connecting to Node {nodeId}...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-gray-500 text-xs ${className}`}>
      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
      <span>No Node Selected</span>
    </div>
  );
};

export default ConnectionStatusIndicator;
