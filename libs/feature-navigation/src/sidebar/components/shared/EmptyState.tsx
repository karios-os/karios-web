import React from 'react';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

/**
 * EmptyState Component
 * Displays a message when no data is available
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ message, icon }) => {
  return (
    <div className="p-2 sm:p-4 text-center flex-1 flex flex-col items-center justify-center gap-2">
      {icon}
      <div className="text-xs sm:text-sm text-gray-500">{message}</div>
    </div>
  );
};
