import React from 'react';

interface ArcMemoryManagementProps {
  arcInfo: any;
  loadingArcInfo: boolean;
  isDragging: boolean;
  tempArcValue: number | null;
  pendingArcChange: any;
  formatMemorySize: (bytes: number) => string;
  parseMemorySize: (memString: string) => number;
  formatPercentage: (current: number, total: number) => string;
  onSliderMouseDown: (e: React.MouseEvent) => void;
  onCancelArcChange: () => void;
  onSubmitArcChange: () => void;
  onApplyPendingChange: () => void;
  onDiscardPendingChange: () => void;
  onRetryFetchArcInfo: () => void;
}

const calculateSliderPosition = (percent: number, offset: number) => {
  return `calc(${percent}% - ${offset}px)`;
};

const calculatePositions = (
  currentPercent: number,
  pendingPercent: number,
  recommendedPercent: number
) => {
  return {
    currentLeft: calculateSliderPosition(currentPercent, 8),
    pendingLeft: calculateSliderPosition(pendingPercent, 6),
    currentWidth: `${currentPercent}%`,
    pendingWidth: `${pendingPercent}%`,
    recommendedLeft: `${recommendedPercent}%`,
    recommendedPercent,
  };
};

export default function ArcMemoryManagement({
  arcInfo,
  loadingArcInfo,
  isDragging,
  tempArcValue,
  pendingArcChange,
  formatMemorySize,
  parseMemorySize,
  formatPercentage,
  onSliderMouseDown,
  onCancelArcChange,
  onSubmitArcChange,
  onApplyPendingChange,
  onDiscardPendingChange,
  onRetryFetchArcInfo,
}: ArcMemoryManagementProps) {
  if (loadingArcInfo) {
    return (
      <div className="bg-white rounded-lg p-4">
        <div className="text-center py-4 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          Loading ARC information...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg" data-testid="arc-memory-management-card">
      <div className="p-4">
        <h3 className="text-lg font-semibold text-black mb-4">ARC Memory Management</h3>

        {arcInfo && arcInfo.availabe_ram && arcInfo.arc_max ? (
          <div className="space-y-4 text-sm">
            {/* Current Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-gray-50 rounded">
              <div>
                <div className="text-xs text-gray-500">Available RAM</div>
                <div className="font-medium">{arcInfo.availabe_ram}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Current ARC Max</div>
                <div className="font-medium">{arcInfo.arc_max}</div>
              </div>
              {/* Pending Change Alert */}
              <div>
                <div className="text-xs text-gray-500">Revised Arc</div>
                <div className="font-medium">{pendingArcChange && pendingArcChange.arc_max}</div>
              </div>
              {/* Reboot Required Note */}
              {pendingArcChange && (
                <div className="col-span-full bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                  <span className="font-semibold">Note:</span> System reboot is required to apply
                  the new ARC configuration.
                </div>
              )}
            </div>

            {/* Visual Slider */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                ARC Max Size:{' '}
                {tempArcValue !== null ? formatMemorySize(tempArcValue) : arcInfo.arc_max}
                {tempArcValue !== null && (
                  <span className="text-blue-600 ml-2">
                    ({formatPercentage(tempArcValue, parseMemorySize(arcInfo.availabe_ram))})
                  </span>
                )}
              </div>

              <div
                className="relative w-full h-4 bg-gray-200 rounded cursor-pointer select-none"
                onMouseDown={onSliderMouseDown}
                data-testid="arc-slider"
              >
                {(() => {
                  const currentPercent = Math.min(
                    tempArcValue !== null
                      ? (tempArcValue / parseMemorySize(arcInfo.availabe_ram)) * 100
                      : (parseMemorySize(arcInfo.arc_max) / parseMemorySize(arcInfo.availabe_ram)) *
                          100,
                    100
                  );
                  const pendingPercent = Math.min(
                    (parseMemorySize(pendingArcChange?.arc_max) /
                      parseMemorySize(arcInfo.availabe_ram)) *
                      100,
                    100
                  );
                  const recommendedPercent = Math.min(
                    (parseMemorySize(arcInfo.recommended_arc_max) /
                      parseMemorySize(arcInfo.availabe_ram)) *
                      100,
                    100
                  );
                  const positions = calculatePositions(
                    currentPercent,
                    pendingPercent,
                    recommendedPercent
                  );

                  return (
                    <>
                      <div
                        className="absolute top-0 h-4 bg-lime-500 rounded transition-all duration-150 z-5"
                        style={{ width: positions.currentWidth }}
                      />
                      {/* Pending ARC Change bar - light grey showing new value after reboot */}
                      {pendingArcChange && pendingArcChange.arc_max && (
                        <div
                          className="absolute top-0 h-4 bg-gray-400 rounded transition-all duration-150 z-4"
                          style={{ width: positions.pendingWidth }}
                        />
                      )}
                      <div
                        className="absolute top-0 w-0.5 h-4 bg-blue-600 z-10"
                        style={{ left: positions.recommendedLeft }}
                      />
                      <div
                        className={`absolute top-1/2 w-4 h-4 bg-green-600 border-2 border-white rounded-full -translate-y-1/2 cursor-grab hover:bg-green-700 hover:scale-125 z-20 transition-transform group ${isDragging ? 'cursor-grabbing' : ''}`}
                        style={{
                          left: positions.currentLeft,
                        }}
                        title="Current ARC"
                      />
                      {/* Pending ARC Change dot - grey dot showing new value position */}
                      {pendingArcChange && pendingArcChange.arc_max && (
                        <div
                          className="absolute top-1/2 w-3 h-3 bg-gray-500 border-2 border-gray-300 rounded-full -translate-y-1/2 hover:bg-gray-600 hover:scale-125 z-[15] transition-transform"
                          style={{
                            left: positions.pendingLeft,
                          }}
                          title="New ARC Max after Reboot"
                        />
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="relative text-xs text-gray-500 mt-1">
                {/* Start label (0) */}
                <span className="absolute left-0">0</span>

                {/* Recommended ARC max label - positioned at the blue line */}
                <span
                  className="absolute transform -translate-x-1/2"
                  style={{
                    left: `${Math.min((parseMemorySize(arcInfo.recommended_arc_max) / parseMemorySize(arcInfo.availabe_ram)) * 100, 100)}%`,
                  }}
                >
                  Recommended ({formatMemorySize(parseMemorySize(arcInfo.recommended_arc_max))})
                </span>

                {/* Available RAM label (end) */}
                <span className="absolute right-0">{arcInfo.availabe_ram}</span>
              </div>
            </div>

            {/* Action Area */}
            {tempArcValue !== null && (
              <div className="mt-8 flex justify-between items-center p-2 bg-blue-50 rounded text-xs">
                <span>
                  <strong>New:</strong> {formatMemorySize(tempArcValue)} (
                  {((tempArcValue / parseMemorySize(arcInfo.availabe_ram)) * 100).toFixed(1)}%)
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={onCancelArcChange}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSubmitArcChange}
                    className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            <p>Unable to load ARC information.</p>
            <button
              onClick={onRetryFetchArcInfo}
              className="mt-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
