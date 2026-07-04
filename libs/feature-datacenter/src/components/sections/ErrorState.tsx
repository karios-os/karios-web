import React from 'react';
import { CloseCircle } from 'iconsax-react';

interface ErrorStateProps {
  error: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error }) => {
  return (
    <div className="p-6 bg-gray-50">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-4xl mx-auto">
        <div className="flex items-start gap-3">
          <CloseCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 text-sm">Error Loading Hardware Inventory</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorState;
