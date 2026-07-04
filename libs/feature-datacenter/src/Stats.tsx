import React, { useEffect, useState, useRef } from 'react';
import { useAppState } from '../../shared-state/src/AppStateContext';
// import { fetchVmMetricsLoadAnalysis } from '../../shared-state/src/utils/statsApiService';
import { ArrowRight2, ArrowLeft2, Element3, RowVertical, Grid1 } from 'iconsax-react';
import './styles.css';
import { useWebSocket } from '../../shared-state/src/AppStateContext';

interface StatsProps {}

const Stats: React.FC<StatsProps> = () => {
  const { state, dispatch } = useAppState();
  const {
    selectedDataCenter,
    stats = {
      loadAnalysis: null,
      isLoading: false,
      error: null,
    },
  } = state || {};
  const { loadAnalysis, isLoading, error } = stats;

  // Added state for node filtering
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const [selectedLoadLevel, setSelectedLoadLevel] = useState<string>('all');
  const [availableNodes, setAvailableNodes] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);

  // View mode state: 'card' (default), 'grid', or 'tiles'
  const [viewMode, setViewMode] = useState<'card' | 'grid' | 'tiles'>('grid');

  // Refs for scrolling functionality
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Scroll functions for horizontal navigation
  const scrollNext = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const cardWidth = container.querySelector('.card')?.clientWidth || 0;
      const scrollAmount = cardWidth * 3; // Scroll 3 cards at a time

      container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth',
      });

      const newIndex = Math.min(currentIndex + 3, filteredData.length - 3);
      setCurrentIndex(newIndex);

      // Update arrow visibility
      setShowLeftArrow(newIndex > 0);
      setShowRightArrow(newIndex < filteredData.length - 3);
    }
  };

  const scrollPrevious = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const cardWidth = container.querySelector('.card')?.clientWidth || 0;
      const scrollAmount = cardWidth * 3; // Scroll 3 cards at a time

      container.scrollBy({
        left: -scrollAmount,
        behavior: 'smooth',
      });

      const newIndex = Math.max(currentIndex - 3, 0);
      setCurrentIndex(newIndex);

      // Update arrow visibility
      setShowLeftArrow(newIndex > 0);
      setShowRightArrow(newIndex < filteredData.length - 3);
    }
  };

  // Check scroll position to update arrow visibility
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const isAtStart = container.scrollLeft <= 10;
      const isAtEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth - 10;

      setShowLeftArrow(!isAtStart);
      setShowRightArrow(!isAtEnd);
    }
  };

  useEffect(() => {
    // Fetch VM metrics load analysis when component mounts
    if (selectedDataCenter) {
      // fetchVmMetricsLoadAnalysis(dispatch);
    }
  }, [selectedDataCenter, dispatch]);

  // Extract unique nodes and set up filtered data
  // Step 1: Extract unique nodes when loadAnalysis changes
  useEffect(() => {
    // Extract unique nodes from load analysis data for filtering
    if (loadAnalysis && Array.isArray(loadAnalysis)) {
      const nodes = Array.from(new Set(loadAnalysis.map((vm) => vm.node)));
      setAvailableNodes(nodes);
    }
  }, [loadAnalysis]);

  // Step 2: Filter data when node selection, load level, or loadAnalysis changes
  useEffect(() => {
    // Filter data based on selected node and load level
    if (loadAnalysis && Array.isArray(loadAnalysis)) {
      // Apply both filters in a single pass for better performance
      const newFilteredData = loadAnalysis.filter((vm) => {
        // Check node filter condition
        const nodeMatches = selectedNode === 'all' || vm.node === selectedNode;

        // Check load level filter condition
        const loadMatches =
          selectedLoadLevel === 'all' ||
          (vm.recommendation && vm.recommendation.toLowerCase().includes('high'));

        // Return true only if both conditions are satisfied
        return nodeMatches && loadMatches;
      });

      // Sort the filtered data to show high load VMs first
      const sortedFilteredData = [...newFilteredData].sort((a, b) => {
        // Check if VM has high load recommendation
        const aIsHigh = a.recommendation && a.recommendation.toLowerCase().includes('high');
        const bIsHigh = b.recommendation && b.recommendation.toLowerCase().includes('high');

        // High load VMs come first
        if (aIsHigh && !bIsHigh) return -1;
        if (!aIsHigh && bIsHigh) return 1;

        // If both have same load level status, maintain original order
        return 0;
      });

      setFilteredData(sortedFilteredData);
    }
  }, [loadAnalysis, selectedNode, selectedLoadLevel]); // Step 3: Handle UI updates when filtered data changes
  useEffect(() => {
    // Reset scroll position and update arrows
    setCurrentIndex(0);
    setShowLeftArrow(false);
    setShowRightArrow(filteredData.length > 3);

    // Ensure we scroll to the beginning to show high load VMs first
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [filteredData.length]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">VM Load Analysis</h1>

          {!isLoading && availableNodes.length > 0 && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <label htmlFor="loadLevelFilter" className="mr-2 text-sm text-gray-600">
                  Load Level:
                </label>
                <select
                  id="loadLevelFilter"
                  value={selectedLoadLevel}
                  onChange={(e) => setSelectedLoadLevel(e.target.value)}
                  className="form-select rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 p-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex items-center">
                {/* <label htmlFor="nodeFilter" className="mr-2 text-sm text-gray-600">Node:</label> */}
                <select
                  id="nodeFilter"
                  value={selectedNode}
                  onChange={(e) => setSelectedNode(e.target.value)}
                  className="form-select rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 p-2 text-sm"
                >
                  <option value="all">All Nodes</option>
                  {availableNodes.map((node) => (
                    <option key={node} value={node}>
                      {node}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center pl-2 space-x-2">
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                  aria-label="Switch to card view"
                  title="Switch to card view"
                >
                  <RowVertical size={20} color={viewMode === 'card' ? '#3B82F6' : '#000000'} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                  aria-label="Switch to grid view"
                  title="Switch to grid view"
                >
                  <Element3 size={20} color={viewMode === 'grid' ? '#3B82F6' : '#000000'} />
                </button>
                <button
                  onClick={() => setViewMode('tiles')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'tiles' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                  aria-label="Switch to tiles view"
                  title="Switch to tiles view"
                >
                  <Grid1 size={20} color={viewMode === 'tiles' ? '#3B82F6' : '#000000'} />
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div
            className="bg-red-100 border-l-4 border-[#FF5349] text-[#FF5349] p-4 mb-4"
            role="alert"
          >
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-xl text-gray-500">Loading...</div>
          </div>
        ) : !error && loadAnalysis && Array.isArray(loadAnalysis) && loadAnalysis.length > 0 ? (
          <div className="space-y-6">
            <div className="text-sm text-gray-500">Data as of: {new Date().toLocaleString()}</div>

            {/* Node filter */}
            {/* <div className="mb-4">
              <label className="text-sm text-gray-600 mr-2">Filter by Node:</label>
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="border rounded-md p-2 text-sm"
              >
                <option value="all">All Nodes</option>
                {availableNodes.map((node) => (
                  <option key={node} value={node}>{node}</option>
                ))}
              </select>
            </div> */}

            <div className="relative">
              {/* Left Navigation Button - Only show in card view */}
              {filteredData.length > 0 && viewMode === 'card' && (
                <button
                  onClick={scrollPrevious}
                  className={`absolute -left-4 top-1/2 transform -translate-y-1/2 z-10 bg-white/90 rounded-full p-2 shadow-md transition-opacity duration-300 hover:bg-gray-100 ${
                    showLeftArrow ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  aria-label="Previous cards"
                >
                  <ArrowLeft2 size={24} color="#4B5563" />
                </button>
              )}

              {filteredData.length > 0 ? (
                <div
                  ref={scrollContainerRef}
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto max-h-[calc(100vh-250px)]'
                      : viewMode === 'tiles'
                        ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 overflow-y-auto max-h-[calc(100vh-250px)]'
                        : 'flex overflow-x-auto pb-1 hide-scrollbar snap-x gap-4'
                  }
                  style={
                    viewMode === 'card'
                      ? {
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                          scrollSnapType: 'x mandatory',
                        }
                      : { scrollbarWidth: 'thin' }
                  }
                  onScroll={viewMode === 'card' ? handleScroll : undefined}
                >
                  {filteredData.map((vm, index) => {
                    // Check if VM has high load
                    const isHighLoad =
                      vm.recommendation && vm.recommendation.toLowerCase().includes('high');

                    // For tiles view, we only render a simple tile with VM name and high load indicator
                    if (viewMode === 'tiles') {
                      return (
                        <div
                          key={`${vm.vm_name}-${index}`}
                          className={`flex items-center justify-center rounded-lg shadow-sm tile-card overflow-hidden 
                                    ${isHighLoad ? 'bg-[#FF5349] text-white' : 'bg-[#2AFEB7] text-black'}
                                    hover:shadow-md transition-shadow p-1`}
                        >
                          <span className="truncate text-center font-medium">{vm.vm_name}</span>
                        </div>
                      );
                    }

                    // For card and grid views, use the existing layout with modifications
                    return (
                      <div
                        key={`${vm.vm_name}-${index}`}
                        className={`bg-gray-50 rounded-lg shadow card ${
                          viewMode === 'grid' ? 'p-1 text-xs' : 'p-2 flex-shrink-0 w-80 snap-start'
                        }`}
                      >
                        <h3
                          className={`${viewMode === 'grid' ? 'text-sm' : 'text-lg'} font-semibold mb-1 p-1 rounded ${isHighLoad ? 'bg-[#FF5349] text-white' : 'bg-[#2AFEB7] text-black'}`}
                        >
                          {vm.vm_name}
                        </h3>
                        <div className={viewMode === 'grid' ? 'space-y-0.5' : 'space-y-2'}>
                          <div className="flex justify-between">
                            <span
                              className={`text-gray-600 ${viewMode === 'grid' ? 'text-xs' : 'text-sm'}`}
                            >
                              Node:
                            </span>
                            <span className={viewMode === 'grid' ? 'text-xs' : 'text-sm'}>
                              {vm.node}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span
                              className={`text-gray-600 ${viewMode === 'grid' ? 'text-xs' : 'text-sm'}`}
                            >
                              CPU:
                            </span>
                            <span className={viewMode === 'grid' ? 'text-xs' : 'text-sm'}>
                              {formatPercentage(vm.avg_cpu_relative_percent)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span
                              className={`text-gray-600 ${viewMode === 'grid' ? 'text-xs' : 'text-sm'}`}
                            >
                              Mem:
                            </span>
                            <span className={viewMode === 'grid' ? 'text-xs' : 'text-sm'}>
                              {formatPercentage(vm.avg_memory_relative_percent)}
                            </span>
                          </div>

                          {viewMode === 'card' && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600 text-xs">7-Day Trend:</span>
                                <span className="text-xs">{vm['7_day_trend']}</span>
                              </div>
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="font-medium mb-2">Node Capacity:</div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>Total vCPUs: {vm.node_capacity.total_vcpu}</div>
                                  <div>Used vCPUs: {vm.node_capacity.used_vcpu}</div>
                                  <div>Free vCPUs: {vm.node_capacity.free_vcpu}</div>
                                  <div>
                                    Total Memory:{' '}
                                    {(vm.node_capacity.total_memory_mb / 1024).toFixed(2)} GB
                                  </div>
                                  <div>
                                    Used Memory:{' '}
                                    {(vm.node_capacity.used_memory_mb / 1024).toFixed(2)} GB
                                  </div>
                                  <div>
                                    Free Memory:{' '}
                                    {(vm.node_capacity.free_memory_mb / 1024).toFixed(2)} GB
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          <div
                            className={`${viewMode === 'grid' ? 'mt-1 pt-1' : 'mt-3 pt-3'} border-t border-gray-200`}
                          >
                            {viewMode === 'card' && (
                              <div className="font-medium mb-1">Recommendation:</div>
                            )}
                            <div
                              className={`${viewMode === 'grid' ? 'text-xs line-clamp-2' : 'text-sm'} ${isHighLoad ? 'text-[#FF5349]' : 'text-green-400'}`}
                            >
                              {viewMode === 'grid'
                                ? isHighLoad
                                  ? '⚠️ High Load'
                                  : '✓ Normal'
                                : vm.recommendation}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-md text-center">
                  <p className="text-md text-yellow-700 font-medium">
                    No high-load VMs are currently available
                    {selectedNode !== 'all' ? ` on node ${selectedNode}` : ''}.
                  </p>
                </div>
              )}

              {/* Right Navigation Button - Only show in card view */}
              {filteredData.length > 0 && viewMode === 'card' && (
                <button
                  onClick={scrollNext}
                  className={`absolute -right-4 top-1/2 transform -translate-y-1/2 z-10 bg-white/90 rounded-full p-2 shadow-md transition-opacity duration-300 hover:bg-gray-100 ${
                    showRightArrow ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  aria-label="Next cards"
                >
                  <ArrowRight2 size={24} color="#4B5563" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-xl text-gray-500">
              {loadAnalysis === null
                ? 'No load analysis data available'
                : !Array.isArray(loadAnalysis)
                  ? 'VM analysis data structure is invalid'
                  : loadAnalysis.length === 0
                    ? 'No VMs found in the analysis data'
                    : 'No load analysis data available'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;
