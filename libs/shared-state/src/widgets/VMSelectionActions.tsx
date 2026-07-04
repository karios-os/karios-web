import React from 'react';

interface VMSelectionActionsProps {
  selectedCount: number;
  totalCount: number;
  filteredCount?: number;
  searchTerm?: string;
  onBack: () => void;
  onContinue: () => void;
  continueText?: string;
  className?: string;
}

const VMSelectionActions: React.FC<VMSelectionActionsProps> = ({
  selectedCount,
  totalCount,
  filteredCount,
  searchTerm,
  onBack,
  onContinue,
  continueText,
  className = '',
}) => {
  const displayContinueText =
    continueText || `Continue with ${selectedCount} VM${selectedCount !== 1 ? 's' : ''}`;

  return (
    <div className={`bg-white px-6 py-4 border-t border-gray-200 ${className}`}>
      {/* VM count information - positioned above buttons */}
      <div className="flex items-center gap-6 mb-3">
        <div className="text-sm text-gray-700">
          Selected:{' '}
          <span className="font-semibold text-blue-600">
            {selectedCount} VM{selectedCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Total:{' '}
          <span className="font-medium">
            {totalCount} VM{totalCount !== 1 ? 's' : ''}
          </span>
        </div>
        {searchTerm && filteredCount !== undefined && (
          <div className="text-sm text-gray-500">
            • Showing:{' '}
            <span className="font-medium">
              {filteredCount} VM{filteredCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Buttons - clean left/right layout */}
      <div className="flex items-center justify-between">
        {/* Left side - Previous button */}
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-medium"
          >
            Previous
          </button>
        </div>

        {/* Right side - Continue button */}
        <div className="flex items-center">
          <button
            onClick={onContinue}
            disabled={selectedCount === 0}
            className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-medium shadow-sm"
          >
            {displayContinueText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VMSelectionActions;
