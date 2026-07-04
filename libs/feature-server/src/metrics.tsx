import React, { useEffect, useState, useRef } from 'react';
import { useServer, createComponentLogger } from '@karios-monorepo/shared-state';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import envConfig from '../../../runtime-config';
import api from '../../shared-state/src/utils/interceptor';
import LoadingState from '../../shared-state/src/widgets/LoadingState';

const GrafanaEmbed = () => {
  // Initialize logger for this component
  const logger = createComponentLogger('MetricsMonitoring');

  const { selectedServer } = useServer();

  // State for metrics data
  const [metricsData, setMetricsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1m');
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);

  // Refs for auto-scroll
  const cpuRef = useRef(null);
  const memoryRef = useRef(null);
  const storageRef = useRef(null);

  // Time range options
  const timeRangeOptions = [
    { label: 'Last 1h', value: '1h', minutes: 60 },
    { label: 'Last 30m', value: '30m', minutes: 30 },
    { label: 'Last 15m', value: '15m', minutes: 15 },
    { label: 'Last 5m', value: '5m', minutes: 5 },
    { label: 'Last 1m', value: '1m', minutes: 1 },
    // { label: 'Custom Range', value: 'custom', isCustom: true },
  ];

  // Get start and end times based on selected range
  const getTimeRange = () => {
    if (selectedTimeRange === 'custom') {
      if (!customStartTime || !customEndTime) {
        // Default to last hour if custom times not set
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        return {
          start: oneHourAgo.toISOString(),
          end: now.toISOString(),
        };
      }
      return {
        start: new Date(customStartTime).toISOString(),
        end: new Date(customEndTime).toISOString(),
      };
    }

    const now = new Date();
    const option = timeRangeOptions.find((opt) => opt.value === selectedTimeRange);

    let startTime;
    if (option && option.minutes) {
      startTime = new Date(now.getTime() - option.minutes * 60 * 1000);
    } else {
      // Default to 1 hour if option not found
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
    }

    return {
      start: startTime.toISOString(),
      end: now.toISOString(),
    };
  };

  // Handle time range selection
  const handleTimeRangeChange = (value) => {
    setSelectedTimeRange(value);
    if (value === 'custom') {
      setShowCustomRange(true);
      // Set default values for custom range (last hour)
      if (!customStartTime || !customEndTime) {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        setCustomStartTime(oneHourAgo.toISOString().slice(0, 16)); // Format for datetime-local input
        setCustomEndTime(now.toISOString().slice(0, 16));
      }
    } else {
      setShowCustomRange(false);
    }
  };

  // Apply custom time range
  const applyCustomRange = () => {
    if (customStartTime && customEndTime) {
      const startDate = new Date(customStartTime);
      const endDate = new Date(customEndTime);

      if (startDate >= endDate) {
        logger.warn('Invalid custom time range - start time must be before end time', {
          startTime: customStartTime,
          endTime: customEndTime,
        });
        setError('Start time must be before end time');
        return;
      }

      // Trigger data fetch by updating the dependency
      setSelectedTimeRange('custom');
    }
  };

  // Fetch metrics from the new API
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!selectedServer?.fqdn && !selectedServer?.ip) return;

      setLoading(true);
      setError(null);

      try {
        const { start, end } = getTimeRange();
        const url = `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/graph/history?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
        const response = await api.fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Transform the data for chart display
        const transformedData = data.map((item) => ({
          timestamp: new Date(item.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          fullTimestamp: new Date(item.timestamp).getTime(),
          cpu: item.cpu,
          memory: item.memory,
          storage: item.storage,
        }));

        setMetricsData(transformedData);
      } catch (error) {
        logger.error('Failed to fetch metrics data', {
          serverAddress: selectedServer?.fqdn || selectedServer?.ip,
          timeRange: selectedTimeRange,
          error,
        });
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [selectedServer?.fqdn, selectedServer?.ip, selectedTimeRange, customStartTime, customEndTime]);

  // Auto-scroll to chart based on ?tab= query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) {
      if (tab.toLowerCase() === 'cpu' && cpuRef.current) {
        cpuRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (tab.toLowerCase() === 'memory' && memoryRef.current) {
        memoryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (tab.toLowerCase() === 'usage' && storageRef.current) {
        storageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  if (loading)
    return (
      <div className="flex justify-center p-2 sm:p-4 md:p-6" data-testid="metrics-loading">
        <LoadingState size="md" />
      </div>
    );
  if (error)
    return (
      <div
        className="text-center p-2 sm:p-4 md:p-6 text-xs sm:text-sm md:text-base text-red-500"
        data-testid="metrics-error"
      >
        Error fetching data
      </div>
    );

  return (
    <>
      {/* Time Range Selector */}
      <div className="w-full px-2 sm:px-4 md:px-6 mb-4" data-testid="time-range-selector-container">
        <div className="bg-white rounded-lg shadow p-4" data-testid="time-range-selector">
          <h3 className="text-sm font-medium text-gray-700 mb-3" data-testid="time-range-title">
            Time Range
          </h3>
          <div className="flex flex-wrap gap-2" data-testid="time-range-buttons">
            {timeRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleTimeRangeChange(option.value)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedTimeRange === option.value
                    ? 'bg-karios-blue text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid={`time-range-button-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {showCustomRange && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg" data-testid="custom-range-picker">
              <h4
                className="text-sm font-medium text-gray-700 mb-3"
                data-testid="custom-range-title"
              >
                Select Custom Range
              </h4>
              <div
                className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
                data-testid="custom-range-inputs"
              >
                <div data-testid="start-time-field">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    data-testid="start-time-input"
                  />
                </div>
                <div data-testid="end-time-field">
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    data-testid="end-time-input"
                  />
                </div>
                <div data-testid="apply-range-button-container">
                  <button
                    onClick={applyCustomRange}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                    data-testid="apply-range-button"
                  >
                    Apply Range
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Charts */}
      <div
        className="w-full px-2 sm:px-4 md:px-6 mb-6 space-y-6"
        data-testid="metrics-charts-container"
      >
        {/* CPU Chart */}
        <div
          ref={cpuRef}
          className="bg-white rounded-lg shadow p-4"
          data-testid="cpu-chart-container"
        >
          <h3 className="text-lg font-semibold mb-4 text-gray-800" data-testid="cpu-chart-title">
            CPU Usage (%)
          </h3>
          <ResponsiveContainer width="100%" height={300} data-testid="cpu-chart">
            <AreaChart data={metricsData}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis
                domain={[0, (dataMax) => Math.min(dataMax + 5, 100)]}
                tickFormatter={(value) => Math.round(value).toString()}
              />
              <Tooltip
                labelFormatter={(value) => `Time: ${value}`}
                formatter={(value, name) => [
                  `${typeof value === 'number' ? value.toFixed(2) : value}%`,
                  'CPU Usage',
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#cpuGradient)"
                name="CPU %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Memory Chart */}
        <div
          ref={memoryRef}
          className="bg-white rounded-lg shadow p-4"
          data-testid="memory-chart-container"
        >
          <h3 className="text-lg font-semibold mb-4 text-gray-800" data-testid="memory-chart-title">
            Memory Usage (%)
          </h3>
          <ResponsiveContainer width="100%" height={300} data-testid="memory-chart">
            <AreaChart data={metricsData}>
              <defs>
                <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis
                domain={[0, (dataMax) => Math.min(dataMax + 5, 100)]}
                tickFormatter={(value) => Math.round(value).toString()}
              />
              <Tooltip
                labelFormatter={(value) => `Time: ${value}`}
                formatter={(value, name) => [
                  `${typeof value === 'number' ? value.toFixed(2) : value}%`,
                  'Memory Usage',
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="memory"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#memoryGradient)"
                name="Memory %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Storage Chart */}
        <div
          ref={storageRef}
          className="bg-white rounded-lg shadow p-4"
          data-testid="storage-chart-container"
        >
          <h3
            className="text-lg font-semibold mb-4 text-gray-800"
            data-testid="storage-chart-title"
          >
            Storage Usage (%)
          </h3>
          <ResponsiveContainer width="100%" height={300} data-testid="storage-chart">
            <AreaChart data={metricsData}>
              <defs>
                <linearGradient id="storageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis
                domain={[0, (dataMax) => Math.min(dataMax + 5, 100)]}
                tickFormatter={(value) => Math.round(value).toString()}
              />
              <Tooltip
                labelFormatter={(value) => `Time: ${value}`}
                formatter={(value, name) => [
                  `${typeof value === 'number' ? value.toFixed(2) : value}%`,
                  'Storage Usage',
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="storage"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#storageGradient)"
                name="Storage %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};

export default function Monitoring() {
  return (
    <div
      className="flex flex-col items-center min-h-screen w-full max-w-full overflow-x-hidden"
      data-testid="monitoring-container"
    >
      <GrafanaEmbed />
    </div>
  );
}
