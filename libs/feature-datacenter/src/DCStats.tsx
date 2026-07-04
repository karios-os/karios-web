import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '../../shared-state/src/widgets/DataTable';
import ExpandableTable from '../../shared-state/src/widgets/ExpandableTable';
import { useAppState } from '@karios-monorepo/shared-state';
import { useWebSocket } from '../../shared-state/src/AppStateContext';
import { VMRecommendation, NodeStats, VMStats } from '../../shared-state/src/types/AppState.types';
import {
  getLevelColorClass,
  getActionColorClass,
} from '../../shared-state/src/utils/vmRecommendationsApiService';
import { createComponentLogger } from '../../shared-state/src/utils/logger';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import envConfig from '../../../runtime-config';

// Shimmer loading component removed - now using DataTable component for better UX

const getFlagColorClass = (flag: string): string => {
  switch (flag.toUpperCase()) {
    case 'NORMAL':
      return 'text-green-600';
    case 'HIGH':
      return 'text-yellow-600';
    case 'CRITICAL':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

// Helper function to get node name from configured nodes
const getNodeName = (nodeIp: string, configuredNodes: any[]): string => {
  const configuredNode = configuredNodes?.find(
    (node) => node.nodeIP === nodeIp || node.ip === nodeIp
  );
  return configuredNode?.nodeHostname || nodeIp;
};

// Helper function to get the correct WebSocket protocol based on HTTP protocol
const getWebSocketProtocol = (): string => {
  const httpProtocol = envConfig().PROTOCOL;
  // If HTTP protocol is https, use wss (secure WebSocket), otherwise use ws
  return httpProtocol === 'https' ? 'wss' : 'ws';
};

// Column definitions for the Live Stats DataTable
const getLiveStatsColumns = (state: any) => [
  {
    key: 'nodeName',
    header: 'Node Name',
    render: (value: any, item: NodeStats) => (
      <span className="hover:text-blue-600">
        {getNodeName(item.node_ip, state.configuredNodes)}
      </span>
    ),
    className: 'text-left',
  },
  {
    key: 'cpu',
    header: 'CPU %',
    render: (value: any, item: NodeStats) => (
      <span className={getFlagColorClass(item.cpu_flag)}>
        {item.cpu_usage}% ({item.cpu_cap} CPU&apos;s)
      </span>
    ),
    className: 'text-left',
  },
  {
    key: 'memory',
    header: 'Memory %',
    render: (value: any, item: NodeStats) => (
      <span className={getFlagColorClass(item.mem_flag)}>
        {item.mem_usage}% ({item.mem_cap} GB)
      </span>
    ),
    className: 'text-left',
  },
  {
    key: 'uptime',
    header: 'Uptime',
    render: (value: any, item: NodeStats) => item.uptime,
    className: 'text-left',
  },
  {
    key: 'status',
    header: 'Status',
    render: (value: any, item: NodeStats) => (
      <span className={`font-medium ${getFlagColorClass(item.overall_flag)}`}>
        {item.overall_flag}
      </span>
    ),
    className: 'text-left',
  },
];

// Column definitions for the VM Stats DataTable
const getVMStatsColumns = () => [
  {
    key: 'name',
    header: 'VM Name',
    headerClassName: 'text-left px-6 py-4 align-middle',
    render: (value: any, item: VMStats) => (
      <span className="font-medium text-gray-900">{item.name}</span>
    ),
    className: 'text-left px-6 py-4 text-sm align-middle',
  },
  {
    key: 'cpu_pct',
    header: 'CPU %',
    headerClassName: 'text-left px-6 py-4 align-middle',
    render: (value: any, item: VMStats) => <span className="text-gray-900">{item.cpu_pct}%</span>,
    className: 'text-left px-6 py-4 text-sm align-middle',
  },
  {
    key: 'memory_pct',
    header: 'Memory %',
    headerClassName: 'text-left px-6 py-4 align-middle',
    render: (value: any, item: VMStats) => (
      <span className="text-gray-900">{item.memory_pct}%</span>
    ),
    className: 'text-left px-6 py-4 text-sm align-middle',
  },
  {
    key: 'power',
    header: 'Power',
    headerClassName: 'text-left px-6 py-4 align-middle',
    render: (value: any, item: VMStats) => <span className="text-gray-500">N/A</span>,
    className: 'text-left px-6 py-4 text-sm align-middle',
  },
  {
    key: 'uptime',
    header: 'Uptime',
    headerClassName: 'text-left px-6 py-4 align-middle',
    render: (value: any, item: VMStats) => <span className="text-gray-900">{item.uptime}</span>,
    className: 'text-left px-6 py-4 text-sm align-middle',
  },
  {
    key: 'status',
    header: 'Status',
    headerClassName: 'text-left px-6 py-4 align-middle',
    render: (value: any, item: VMStats) => (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          item.status === 'Running'
            ? 'bg-green-100 text-green-600'
            : item.status === 'Stopped'
              ? 'bg-red-100 text-red-800'
              : item.status === 'Locked'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-600'
        }`}
      >
        {item.status}
      </span>
    ),
    className: 'text-left px-6 py-4 text-sm align-middle',
  },
];

// Function to render expanded Live VM stats content
const renderLiveVMStatsContent = (
  vmStats: VMStats[],
  vmStatsLoading: boolean,
  vmError: string | null
) => {
  if (vmStatsLoading) {
    return (
      <div className="bg-blue-50 text-center py-8">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-600">Loading VM stats...</span>
        </div>
      </div>
    );
  }

  if (vmError) {
    return (
      <div className="bg-blue-50">
        <div className="text-red-500 text-sm mb-3 p-2 bg-red-50 rounded mx-4 mt-4">{vmError}</div>
      </div>
    );
  }

  const sortedVMStats = [...vmStats].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-blue-50">
      <div className="p-2">
        <DataTable
          data={sortedVMStats}
          columns={getVMStatsColumns()}
          striped={false}
          hoverable={true}
          maxHeight="300px"
          showAllData={true}
          className="bg-white"
        />
        {sortedVMStats.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-500 bg-white rounded-lg border border-gray-100">
            No VM stats available
          </div>
        )}
      </div>
    </div>
  );
};

// Column definitions for the Recommendations DataTable
const getRecommendationsColumns = (state: any) => [
  {
    key: 'nodeName',
    header: 'Node Name',
    render: (value: any, item: any) => (
      <span className="hover:text-blue-600">
        {getNodeName(item.node_ip, state.configuredNodes)}
      </span>
    ),
    className: 'text-left',
  },
  {
    key: 'cpu',
    header: 'CPU %',
    render: (value: any, item: any) => (
      <span className={getFlagColorClass(item.cpu_flag)}>{item.cpu_usage}%</span>
    ),
    className: 'text-left',
  },
  {
    key: 'memory',
    header: 'Memory %',
    render: (value: any, item: any) => (
      <span className={getFlagColorClass(item.mem_flag)}>{item.mem_usage}%</span>
    ),
    className: 'text-left',
  },
  {
    key: 'status',
    header: 'Status',
    render: (value: any, item: any) => (
      <span className={`font-medium ${getFlagColorClass(item.overall_flag)}`}>
        {item.overall_flag}
      </span>
    ),
    className: 'text-left',
  },
];

// Column definitions for the VM Recommendations DataTable
const getVMRecommendationsColumns = () => [
  {
    key: 'name',
    header: 'VM Name',
    headerClassName: 'text-left pl-4 pr-3 py-2 align-middle',
    render: (value: any, item: VMRecommendation) => (
      <span className="font-medium text-gray-900">{item.name}</span>
    ),
    className: 'text-left pl-4 pr-3 py-2 text-xs align-middle',
  },
  {
    key: 'cpu_usage',
    header: 'CPU Usage',
    headerClassName: 'text-left px-3 py-2 align-middle',
    render: (value: any, item: VMRecommendation) => (
      <span className="text-gray-900">
        {item.cpu_mean.toFixed(2)}% ({item.vcpu} CPU`s)
      </span>
    ),
    className: 'text-left px-3 py-2 text-xs align-middle',
  },
  {
    key: 'memory_usage',
    header: 'Memory Usage',
    headerClassName: 'text-left px-3 py-2 align-middle',
    render: (value: any, item: VMRecommendation) => (
      <span className="text-gray-900">
        {item.mem_mean.toFixed(2)}% ({item.mem_assigned_gb} GB)
      </span>
    ),
    className: 'text-left px-3 py-2 text-xs align-middle',
  },
  {
    key: 'action',
    header: 'Action',
    headerClassName: 'text-left px-3 py-2 align-middle',
    render: (value: any, item: VMRecommendation) => (
      <span className={`text-xs font-medium ${getActionColorClass(item.recommendation.action)}`}>
        {item.recommendation.action}
      </span>
    ),
    className: 'text-left px-3 py-2 text-xs align-middle',
  },
  {
    key: 'recommendation',
    header: 'Recommendation',
    headerClassName: 'text-left px-3 py-2 align-middle',
    render: (value: any, item: VMRecommendation) => (
      <div className="space-y-1 max-w-md">
        <div className="text-gray-700">
          <span className="font-medium">CPU:</span>
          <span
            className={
              item.recommendation.cpu_change > 0
                ? 'text-green-600 font-medium'
                : item.recommendation.cpu_change < 0
                  ? 'text-red-600 font-medium'
                  : 'text-gray-600'
            }
          >
            {item.recommendation.cpu_change > 0 ? '+' : ''}
            {item.recommendation.cpu_change}
          </span>
        </div>
        <div className="text-gray-700">
          <span className="font-medium">Memory:</span>
          <span
            className={
              item.recommendation.mem_change_gb > 0
                ? 'text-green-600 font-medium'
                : item.recommendation.mem_change_gb < 0
                  ? 'text-red-600 font-medium'
                  : 'text-gray-600'
            }
          >
            {item.recommendation.mem_change_gb > 0 ? '+' : ''}
            {item.recommendation.mem_change_gb}GB
          </span>
        </div>
      </div>
    ),
    className: 'text-left px-3 py-2 text-xs align-middle',
  },
  {
    key: 'justification',
    header: 'Justification',
    headerClassName: 'text-left px-3 py-2 align-middle',
    render: (value: any, item: VMRecommendation) => (
      <div className="text-wrap break-words max-w-md text-gray-700">
        {item.recommendation.justification}
      </div>
    ),
    className: 'text-left px-3 py-2 text-xs align-middle',
  },
  {
    key: 'status',
    header: 'Status',
    headerClassName: 'text-left pl-3 pr-4 py-2 align-middle',
    render: (value: any, item: VMRecommendation) => (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          item.level === 'normal'
            ? 'bg-green-100 text-green-600'
            : item.level === 'high'
              ? 'bg-yellow-100 text-yellow-800'
              : item.level === 'critical'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
        }`}
      >
        {item.level.toUpperCase()}
      </span>
    ),
    className: 'text-left pl-3 pr-4 py-2 text-xs align-middle',
  },
];

// Function to render expanded VM recommendations content
const renderVMRecommendationsContent = (
  vmRecommendations: VMRecommendation[],
  vmRecommendationsLoading: boolean,
  vmRecommendationsError: string | null,
  expandedNodeIp: string,
  configuredNodes: any[]
) => {
  if (vmRecommendationsLoading) {
    return (
      <div className="bg-blue-50 border-t border-gray-200 p-4">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-600">Loading VM recommendations...</span>
        </div>
      </div>
    );
  }

  if (vmRecommendationsError) {
    return (
      <div className="bg-blue-50 border-t border-gray-200">
        <div className="text-red-500 text-sm mb-3 p-2 bg-red-50 rounded mx-4 mt-4">
          {vmRecommendationsError}
        </div>
      </div>
    );
  }

  if (vmRecommendations.length === 0) {
    return (
      <div className="bg-blue-50 border-t border-gray-200 p-4">
        <div className="text-center text-sm text-gray-500">
          No VM recommendations available for this node
        </div>
      </div>
    );
  }

  const sortedVMRecommendations = [...vmRecommendations].sort((a, b) => {
    const levelPriority = { critical: 3, high: 2, normal: 1 };
    return (levelPriority[b.level] || 0) - (levelPriority[a.level] || 0);
  });

  return (
    <div className="bg-blue-50 border-t border-gray-200">
      <div className="p-2">
        <DataTable
          data={sortedVMRecommendations}
          columns={getVMRecommendationsColumns()}
          striped={false}
          hoverable={true}
          maxHeight="300px"
          showAllData={true}
          className="bg-white rounded-lg"
        />
      </div>
    </div>
  );
};

const DCStats: React.FC = () => {
  const logger = createComponentLogger('DCStats');
  const [nodeStats, setNodeStats] = useState<NodeStats[]>([]);
  const [expandedNodeIp, setExpandedNodeIp] = useState<string | null>(null);
  const [vmStats, setVmStats] = useState<VMStats[]>([]);
  const [vmStatsLoading, setVmStatsLoading] = useState(false);
  const [vmError, setVmError] = useState<string | null>(null);
  const { connectWebSocket, closeConnection, error: wsError } = useWebSocket();
  const [isConnecting, setIsConnecting] = useState<boolean>(true); // Start with loading state
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [showError, setShowError] = useState<boolean>(false); // Control error display
  const [connectionTimeout, setConnectionTimeout] = useState<number | null>(null); // Timeout for auto-showing error
  const [startDate, setStartDate] = useState('2025-06-24T00:00:00Z');
  const [endDate, setEndDate] = useState('2025-06-24T23:59:59Z');
  const [recStartDate, setRecStartDate] = useState(new Date('2025-06-24T00:00:00Z'));
  const [recEndDate, setRecEndDate] = useState(new Date('2025-06-24T23:59:59Z'));
  const [selectedTimeRange, setSelectedTimeRange] = useState('custom');
  const [expandedRecommendationNodeIp, setExpandedRecommendationNodeIp] = useState<string | null>(
    null
  );

  // Tab management state - 'live' by default
  const [currentTab, setCurrentTab] = useState<'live' | 'recommendations'>('live');

  // Use shared-state instead of local state
  const {
    dispatch,
    state,
    // DCStats state and functions
    nodeStatsHistory,
    isLoadingNodeStatsHistory,
    nodeStatsHistoryError,
    fetchNodeStatsHistory,
    nodeStatsRecommendations,
    isLoadingNodeStatsRecommendations,
    nodeStatsRecommendationsError,
    fetchNodeStatsRecommendations,
    historicalVmStats,
    isLoadingHistoricalVmStats,
    historicalVmStatsError,
    fetchHistoricalVmStats,
    vmRecommendations,
    isLoadingVmRecommendations,
    vmRecommendationsError,
    fetchVMRecommendations,
  } = useAppState();

  const handleTimeRangeChange = useCallback((range: string) => {
    setSelectedTimeRange(range);

    if (range === 'custom') {
      return; // Don't change dates for custom selection
    }

    const now = new Date();
    const endDate = new Date(now);
    let startDate: Date;

    switch (range) {
      case '1week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '2weeks':
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case '1month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '2months':
        startDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }

    setRecStartDate(startDate);
    setRecEndDate(endDate);

    // Auto-fetch recommendations when a predefined range is selected
    setTimeout(async () => {
      try {
        await fetchNodeStatsRecommendations(startDate.toISOString(), endDate.toISOString());
      } catch (error) {
        logger.error('Auto-fetch recommendations failed', { error });
      }
    }, 100);
  }, []);

  const handleFetchHistory = useCallback(async () => {
    await fetchNodeStatsHistory(envConfig().CONTROL_NODE_IP.URL, startDate, endDate);
  }, [fetchNodeStatsHistory, startDate, endDate]);

  const handleFetchRecommendations = useCallback(async () => {
    try {
      await fetchNodeStatsRecommendations(recStartDate.toISOString(), recEndDate.toISOString());
    } catch (error) {
      logger.error('Fetch recommendations failed', { error });
    }
  }, [fetchNodeStatsRecommendations, recStartDate, recEndDate]);

  const fetchVMRecommendationsForNode = useCallback(
    async (nodeIp: string) => {
      try {
        await fetchVMRecommendations(nodeIp, recStartDate.toISOString(), recEndDate.toISOString());
      } catch (error) {
        logger.error('Fetch VM recommendations failed', { error });
      }
    },
    [fetchVMRecommendations, recStartDate, recEndDate]
  );

  const handleRecommendationRowClick = useCallback(
    (nodeIp: string) => {
      // Toggle expansion - if already expanded, collapse it
      if (expandedRecommendationNodeIp === nodeIp) {
        setExpandedRecommendationNodeIp(null);
        return;
      }

      // Expand this node and fetch VM recommendations
      setExpandedRecommendationNodeIp(nodeIp);
      fetchVMRecommendationsForNode(nodeIp);
    },
    [fetchVMRecommendationsForNode, expandedRecommendationNodeIp]
  );

  // Fetch data when dates change or live mode toggles
  useEffect(() => {
    if (!isLive) {
      handleFetchHistory();
    }
  }, [startDate, endDate, isLive, handleFetchHistory]);

  // Connect to WebSocket when component mounts or live mode changes
  useEffect(() => {
    if (isLive) {
      // Clear any existing error state when starting fresh
      setError(null);
      setShowError(false);

      const authToken = localStorage.getItem('accessToken');
      const wsUrl = `${getWebSocketProtocol()}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/recommendations/ws/nodestats?token=${authToken}`;

      // Set timeout to show error after 15 seconds if still connecting
      const timeout = setTimeout(() => {
        setIsConnecting((prevConnecting) => {
          if (prevConnecting) {
            setError('Error connecting to server');
            setShowError(true);
          }
          return false; // Stop showing connecting state
        });
      }, 15000);
      setConnectionTimeout(timeout as any);

      const wsConnection = connectWebSocket(wsUrl, {
        onConnect: () => {
          setIsConnecting(false);
          setError(null);
          setShowError(false);
          // Clear timeout on successful connection
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            setConnectionTimeout(null);
          }
        },
        onMessage: (message) => {
          try {
            const parsedData = typeof message === 'string' ? JSON.parse(message) : message;
            setNodeStats(Array.isArray(parsedData) ? parsedData : []);
            setIsConnecting(false);
            setError(null);
            setShowError(false);
            // Clear timeout on successful message
            if (connectionTimeout) {
              clearTimeout(connectionTimeout);
              setConnectionTimeout(null);
            }
          } catch (e) {
            logger.error('WebSocket data processing failed', { error: e });
            setError('Failed to process data from server');
            setShowError(true);
            setIsConnecting(false);
            // Clear timeout on error
            if (connectionTimeout) {
              clearTimeout(connectionTimeout);
              setConnectionTimeout(null);
            }
          }
        },
        onError: (e) => {
          logger.error('WebSocket connection error', { error: e });
          // Don't set error immediately - let the timeout handle it
          // This prevents the error button from showing up right away
        },
        onClose: () => {
          logger.debug('Node Stats WebSocket disconnected');
          // Don't show error on close - WebSocket will attempt reconnection
        },
        reconnect: true,
        reconnectInterval: 5000,
      });

      return () => {
        if (wsConnection) {
          wsConnection.close();
        }
        // Clear timeout on cleanup
        if (timeout) {
          clearTimeout(timeout);
        }
      };
    } else {
      closeConnection();
      setNodeStats([]);
      setIsConnecting(false);
      setError(null);
      setShowError(false);
      // Clear timeout when switching to history mode
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        setConnectionTimeout(null);
      }
      // Return empty cleanup function for consistency
      return () => {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]); // Only depend on isLive to avoid infinite loops

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
    };
  }, [connectionTimeout]);

  const handleFetchHistoricalVmStats = useCallback(
    async (nodeIp: string) => {
      try {
        setVmStatsLoading(true);
        setVmError(null);
        const result = await fetchHistoricalVmStats(nodeIp, startDate, endDate);
        // Set local VM stats for the current expanded node
        setVmStats(result || []);
      } catch (error) {
        logger.error('Fetch historical VM stats failed', { nodeIp, error });
        setVmError('Failed to fetch VM statistics');
        setVmStats([]);
      } finally {
        setVmStatsLoading(false);
      }
    },
    [fetchHistoricalVmStats, startDate, endDate]
  );

  const handleNodeClick = useCallback(
    async (nodeIp: string) => {
      // Toggle expansion - if already expanded, collapse it
      if (expandedNodeIp === nodeIp) {
        setExpandedNodeIp(null);
        setVmStats([]);
        setVmError(null);
        closeConnection(); // Close any WebSocket connections
        return;
      }

      // Expand this node
      setExpandedNodeIp(nodeIp);
      setVmStatsLoading(true);
      setVmStats([]); // Clear previous VM data immediately when starting to load
      setVmError(null); // Clear any previous error

      // Close existing WebSocket connection if any
      if (expandedNodeIp && expandedNodeIp !== nodeIp) {
        closeConnection();
      }

      if (isLive) {
        // Live mode: Use WebSocket
        const authToken = localStorage.getItem('accessToken');
        
        // Use the control node's FQDN for VM stats WebSocket
        // The API routes the request to the appropriate node based on the nodeIp parameter
        const wsUrl = `${getWebSocketProtocol()}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/recommendations/ws/vmstats?token=${authToken}`;
        connectWebSocket(wsUrl, {
          onConnect: () => {
            setVmStatsLoading(false);
          },
          onMessage: (message) => {
            try {
              const parsedData = typeof message === 'string' ? JSON.parse(message) : message;
              setVmStats(Array.isArray(parsedData) ? parsedData : []);
              setVmStatsLoading(false); // Stop loading when data is received
            } catch (e) {
              logger.error('VM WebSocket data processing failed', { error: e });
              setVmStats([]);
              setVmStatsLoading(false);
            }
          },
          onError: (e) => {
            logger.error('VM WebSocket connection error', { error: e });
            setVmStatsLoading(false);
          },
          onClose: () => {
            setVmStatsLoading(false);
          },
          reconnect: true,
          reconnectInterval: 5000,
        });
      } else {
        // History mode: Use REST API
        await handleFetchHistoricalVmStats(nodeIp);
      }
    },
    [isLive, expandedNodeIp, connectWebSocket, closeConnection, handleFetchHistoricalVmStats]
  );

  // Use WebSocket error or local error, but only display if showError is true
  const displayError =
    showError && (error || wsError) ? error || 'WebSocket connection error' : null;

  // Show error state only if explicitly requested or after user action
  if (displayError) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-600 text-md">Error: {displayError}</p>
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          onClick={() => {
            setError(null);
            setShowError(false);
            setIsConnecting(true);
            const authToken = localStorage.getItem('accessToken');
            const wsUrl = `${getWebSocketProtocol()}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/recommendations/ws/nodestats?token=${authToken}`;
            connectWebSocket(wsUrl, {
              onConnect: () => {
                setIsConnecting(false);
                setError(null);
                setShowError(false);
              },
              onMessage: (message) => {
                try {
                  const parsedData = typeof message === 'string' ? JSON.parse(message) : message;
                  setNodeStats(parsedData);
                  setIsConnecting(false);
                  setError(null);
                  setShowError(false);
                } catch (e) {
                  logger.error('Retry WebSocket data processing failed', { error: e });
                  setError('Failed to process data from server');
                  setShowError(true);
                  setIsConnecting(false);
                }
              },
              onError: (e) => {
                logger.error('Retry WebSocket connection error', { error: e });
                setError('Error connecting to server');
                setShowError(true);
                setIsConnecting(false);
              },
              reconnect: true,
            });
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white min-h-screen overflow-x-hidden" data-testid="dcstats-container">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-semibold text-gray-800 flex items-center gap-3"
          data-testid="dcstats-title"
        >
          Node & VM Stats
          <div className="relative flex items-center group cursor-pointer">
            <svg
              className="w-4 h-4 text-gray-400 hover:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="invisible group-hover:visible absolute left-full ml-3 top-1/2 -translate-y-1/2 w-64 p-3 text-sm text-gray-500 bg-white border border-gray-100 rounded-lg shadow-xl z-50 font-normal pointer-events-none">
              <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-2 h-2 bg-white border-l border-t border-gray-100 rotate-45"></div>
              Live & Historical Node & VM recommendation stats
            </div>
          </div>
        </h1>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-8 mb-6 border-b border-gray-200" data-testid="dcstats-tabs">
        <button
          onClick={() => setCurrentTab('live')}
          className={`pb-2 text-sm font-medium transition-colors ${
            currentTab === 'live'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Live
        </button>
        <button
          onClick={() => {
            setCurrentTab('recommendations');
            // Auto-set filter to "1 week" when switching to recommendations tab
            if (currentTab !== 'recommendations' && selectedTimeRange === 'custom') {
              handleTimeRangeChange('1week');
            }
          }}
          className={`pb-2 text-sm font-medium transition-colors ${
            currentTab === 'recommendations'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Recommendations
        </button>
      </div>

      {/* Live Tab Content */}
      {currentTab === 'live' && (
        <div>
          <div className="p-0">
            <div className="flex justify-between items-center mb-0">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  {error && !showError && !isConnecting && nodeStats.length === 0 && (
                    <button
                      onClick={() => setShowError(true)}
                      className="flex items-center gap-2 px-4 py-2 border border-red-500 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                    >
                      Show Connection Error
                    </button>
                  )}
                </div>
              </div>
            </div>

            {showError && error && (
              <div className="text-red-500 text-md mb-4 p-3 bg-red-50 rounded flex justify-between items-center">
                <span>{error}</span>
                <button
                  onClick={() => setShowError(false)}
                  className="text-red-600 hover:text-red-800 ml-2"
                >
                  ×
                </button>
              </div>
            )}

            {expandedNodeIp && vmError && (
              <div className="text-red-500 text-md mb-4">{vmError}</div>
            )}

            {isConnecting && nodeStats.length === 0 ? (
              // Show loading state
              <div className="text-center py-8">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Connecting to server...</span>
                </div>
              </div>
            ) : (
              <ExpandableTable
                data={[...nodeStats]
                  .filter((node: NodeStats) => {
                    const configuredNodeIPs =
                      state.configuredNodes?.map(
                        (configNode) => configNode.nodeIP || configNode.ip
                      ) || [];
                    const configuredNodeNames =
                      state.configuredNodes?.map((configNode) => configNode.nodeHostname) || [];
                    // Accept both IP addresses and FQDN names
                    return (
                      configuredNodeIPs.includes(node.node_ip) ||
                      configuredNodeNames.includes(node.node_ip) ||
                      configuredNodeIPs.includes(envConfig().CONTROL_NODE_IP.URL) ||
                      node.node_ip === envConfig().CONTROL_NODE_IP.URL
                    );
                  })
                  .sort((a, b) => {
                    const priorityMap = { CRITICAL: 3, HIGH: 2, NORMAL: 1 };
                    return (priorityMap[b.overall_flag] || 0) - (priorityMap[a.overall_flag] || 0);
                  })}
                columns={getLiveStatsColumns(state)}
                expandedRowId={expandedNodeIp}
                onRowClick={(node: NodeStats) => handleNodeClick(node.node_ip)}
                renderExpandedContent={() =>
                  renderLiveVMStatsContent(vmStats, vmStatsLoading, vmError)
                }
                getRowId={(node: NodeStats) => node.node_ip}
                loading={false}
                loadingText="Connecting to server..."
                emptyText="No node stats available"
                className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                maxHeight="600px"
              />
            )}
          </div>
        </div>
      )}

      {/* Recommendations Tab Content */}
      {currentTab === 'recommendations' && (
        <div>
          <div className="p-4 mb-4 border border-gray-200 rounded-lg bg-white">
            {/* Date Selection */}
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-md text-gray-600">Time Range:</span>
                <select
                  value={selectedTimeRange}
                  onChange={(e) => handleTimeRangeChange(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-md w-32"
                >
                  <option value="1week">1 Week</option>
                  <option value="2weeks">2 Weeks</option>
                  <option value="1month">1 Month</option>
                  <option value="2months">2 Months</option>
                  <option value="3months">3 Months</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {selectedTimeRange === 'custom' && (
                <div className="flex flex-row items-center gap-1 whitespace-nowrap">
                  <label className="inline-flex items-center gap-1">
                    <span className="text-md text-gray-600 whitespace-nowrap">From:</span>
                    <DatePicker
                      selected={recStartDate}
                      onChange={(date: Date | null) => {
                        if (date) {
                          setRecStartDate(date);
                          setSelectedTimeRange('custom');
                        }
                      }}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="yyyy-MM-dd HH:mm"
                      timeCaption="Time"
                      className="border border-gray-300 rounded px-1 py-1 text-md w-[150px] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 bg-white z-50"
                      placeholderText="Select start date & time"
                      maxDate={recEndDate}
                      selectsStart
                      startDate={recStartDate}
                      endDate={recEndDate}
                      popperClassName="!z-[50]"
                      popperPlacement="bottom-start"
                      calendarStartDay={0}
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      enableTabLoop={false}
                      injectTimes={[]}
                    />
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <span className="text-md text-gray-600 whitespace-nowrap">To:</span>
                    <DatePicker
                      selected={recEndDate}
                      onChange={(date: Date | null) => {
                        if (date) {
                          setRecEndDate(date);
                          setSelectedTimeRange('custom');
                        }
                      }}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={15}
                      dateFormat="yyyy-MM-dd HH:mm"
                      timeCaption="Time"
                      className="border border-gray-300 rounded px-1 py-1 text-md w-[150px] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 bg-white z-50"
                      placeholderText="Select end date & time"
                      minDate={recStartDate}
                      selectsEnd
                      startDate={recStartDate}
                      endDate={recEndDate}
                      popperClassName="!z-[50]"
                      popperPlacement="bottom-start"
                      calendarStartDay={0}
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      enableTabLoop={false}
                      injectTimes={[]}
                    />
                  </label>
                </div>
              )}
              <button
                onClick={handleFetchRecommendations}
                disabled={isLoadingNodeStatsRecommendations}
                className={`px-2 sm:px-4 py-1 sm:py-2 border rounded transition-colors w-24 sm:w-auto text-sm sm:text-base ${
                  isLoadingNodeStatsRecommendations
                    ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isLoadingNodeStatsRecommendations ? 'Loading...' : 'Apply'}
              </button>
            </div>

            {/* Error Display */}
            {nodeStatsRecommendationsError && (
              <div className="text-red-500 text-md mb-4 p-3 bg-red-50 rounded">
                {nodeStatsRecommendationsError}
              </div>
            )}

            {/* Instruction Text */}
            <div className="text-md text-gray-600 mb-4 p-3 bg-blue-50 rounded border border-blue-200">
              <span className="font-medium">💡 Tip:</span> Click on any row to expand and view
              detailed VM recommendations for that node inline.
            </div>
          </div>

          {/* Data Display - Using ExpandableTable for Inline Expansion */}
          <ExpandableTable
            data={[...nodeStatsRecommendations]
              .filter((node: any) => {
                const configuredNodeIPs =
                  state.configuredNodes?.map((configNode) => configNode.nodeIP || configNode.ip) ||
                  [];
                const configuredNodeNames =
                  state.configuredNodes?.map((configNode) => configNode.nodeHostname) || [];
                // Accept both IP addresses and FQDN names
                return (
                  configuredNodeIPs.includes(node.node_ip) ||
                  configuredNodeNames.includes(node.node_ip) ||
                  configuredNodeIPs.includes(envConfig().CONTROL_NODE_IP.URL) ||
                  node.node_ip === envConfig().CONTROL_NODE_IP.URL
                );
              })
              .sort((a, b) => {
                const priorityMap = { CRITICAL: 3, HIGH: 2, NORMAL: 1 };
                return (priorityMap[b.overall_flag] || 0) - (priorityMap[a.overall_flag] || 0);
              })}
            columns={getRecommendationsColumns(state)}
            expandedRowId={expandedRecommendationNodeIp}
            onRowClick={(node: any) => handleRecommendationRowClick(node.node_ip)}
            renderExpandedContent={(node: any) =>
              renderVMRecommendationsContent(
                vmRecommendations,
                isLoadingVmRecommendations,
                vmRecommendationsError,
                node.node_ip,
                state.configuredNodes
              )
            }
            getRowId={(node: any) => node.node_ip}
            loading={isLoadingNodeStatsRecommendations}
            loadingText="Loading recommendations..."
            emptyText="No recommendation data available"
            className="border border-gray-200 rounded-lg bg-white overflow-hidden"
            maxHeight="600px"
          />
        </div>
      )}
    </div>
  );
};

export default DCStats;
