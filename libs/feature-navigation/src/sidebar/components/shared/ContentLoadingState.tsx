import React from 'react';

interface ContentLoadingStateProps {
  isTransitioning: boolean;
  hasData: boolean;
  dataType: 'control-center' | 'clusters';
  errorMessage?: string | null;
}

/**
 * ContentLoadingState Component
 * Displays loading, empty, or error states for sidebar content
 */
export const ContentLoadingState: React.FC<ContentLoadingStateProps> = ({
  isTransitioning,
  hasData,
  dataType,
  errorMessage,
}) => {
  if (isTransitioning) {
    return (
      <div className="p-2 sm:p-4 text-center flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1 text-blue-600">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs">Loading...</span>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="p-2 sm:p-4 text-center">
        <div className="text-xs sm:text-sm text-gray-500">
          {errorMessage ||
            (dataType === 'control-center' ? 'No data centers available' : 'No clusters available')}
        </div>
      </div>
    );
  }

  return null;
};

export default ContentLoadingState;
