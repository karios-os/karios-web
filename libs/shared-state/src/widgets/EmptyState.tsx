import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, className = '' }) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="bg-gray-50 rounded-lg p-8 border-2 border-dashed border-gray-300">
        {icon && <div className="flex justify-center mb-4">{icon}</div>}
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500">{description}</p>
      </div>
    </div>
  );
};

export default EmptyState;
