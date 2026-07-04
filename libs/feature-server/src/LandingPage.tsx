import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { TbVector } from 'react-icons/tb';
import { Timer1, CpuSetting, Coin } from 'iconsax-react';
import {
  useServer,
  useWebSocket,
  useAppState,
  api,
  createComponentLogger,
} from '@karios-monorepo/shared-state';
import envConfig from '../../../runtime-config';

import { HiMiniCpuChip } from 'react-icons/hi2';
import { PiMemoryDuotone } from 'react-icons/pi';
import { BsGrid3X3, BsGrid } from 'react-icons/bs';

// New component imports
import StatusCardsGrid from './components/StatusCardsGrid';
import SystemInformationCard from './components/SystemInformationCard';
import AddinCardsDisplay from './components/AddinCardsDisplay';
import NetworkCard from './components/NetworkCard';
import StorageCards from './components/StorageCards';
import ChassisViewCard from './components/ChassisViewCard';
import InfoModal from './components/InfoModal';
import StorageModelModal from './components/StorageModelModal';

// TypeScript interfaces
interface NetworkData {
  interface: string;
  type: 'physical' | 'virtual' | 'other';
  mac: string;
  ip?: string;
  model?: string;
  status: string;
}

interface SystemInfo {
  Made: string | null;
  Model: string | null;
  ModelName: string | null;
}

interface NodeMetrics {
  uptime?: string;
  efficiency?: string;
  cpu?: {
    total_usage_percent?: number;
  };
  storage?: number;
  memory?: number;
  security_score?: number;
}

interface PowerMetrics {
  Current?: string;
  Energy?: string;
  Power?: string;
  Voltage?: string;
  isConnected?: boolean;
}

interface FanMetrics {
  Fans?: Array<{
    Name: string;
    Reading: number;
    ReadingUnit: string;
  }>;
  Temperatures?: Array<{
    Name: string;
    ReadingCelsius: number;
  }>;
}

interface InventoryData {
  ip: string;
  vendor: string;
  username: string;
  password: string;
}

interface AddinCard {
  slot: string;
  device: string;
}

interface Disk {
  device: string;
  model: string;
  firmware_version: string;
  size: string;
  health: 'Healthy' | 'Degraded' | 'Warning';
}

interface StorageController {
  name: string;
  vendor: string;
  model: string;
  disks: Disk[];
}

interface PowerSupply {
  '80_plus_rating': string;
}

interface NodeTopInfo {
  timestamp: string;
  system: {
    load_averages: {
      '1min': number;
      '5min': number;
      '15min': number;
    };
    cpu_usage: {
      user: number;
      system: number;
      interrupt: number;
      idle: number;
    };
    memory_usage: {
      active: string;
      inactive: string;
      wired: string;
      buf: string;
      free: string;
    };
  };
  processes: Array<{
    pid: number;
    user: string;
    command: string;
    cpu_percent: number;
    memory_res: string;
    threads: number;
    state: string;
  }>;
}

// Power supply efficiency rating images
const bronzeImg = '/Bronze.png';
const silverImg = '/silver.png';
const goldImg = '/gold.png';
const platinumImg = '/platinum.png';
const titaniumImg = '/Titanium.png';

// Get runtime configuration for control node
const config = envConfig();
const nodeIP = `${config.CONTROL_NODE_IP.URL}${config.CONTROL_NODE_IP.PORT}`;

// Helper function to get color classes based on metric values
export function getMetricColorClasses(
  metric: string | number | undefined,
  type: 'cpu' | 'memory' | 'storage' | 'efficiency' | 'uptime'
): {
  bgColor: string;
  textColor: string;
  iconColor: string;
  borderColor: string;
  progressBarColor: string;
} {
  const defaultColors = {
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    iconColor: 'var(--color-gray-300)',
    borderColor: 'border-gray-200',
    progressBarColor: 'bg-gray-500',
  };

  // If metric is undefined or not a valid number, return default colors
  if (metric === undefined || metric === null || metric === '----' || metric === 'N/A') {
    return defaultColors;
  }

  // Extract numeric value if it's a string with % sign
  let numericValue: number;
  if (typeof metric === 'string') {
    // Remove any % sign and convert to number
    numericValue = parseFloat(metric.replace('%', ''));
    if (isNaN(numericValue)) {
      return defaultColors; // If not a valid number, return default
    }
  } else {
    numericValue = metric;
  }

  // For metrics where lower is better (CPU, memory, storage)
  // >= 80 red, >= 60 orange, < 60 green
  if (type === 'cpu' || type === 'memory' || type === 'storage') {
    if (numericValue >= 80) {
      return {
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        iconColor: 'var(--color-red-500)',
        borderColor: 'border-red-200',
        progressBarColor: 'bg-red-500',
      };
    } else if (numericValue >= 60) {
      return {
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        iconColor: 'var(--color-amber-500)',
        borderColor: 'border-amber-200',
        progressBarColor: 'bg-amber-500',
      };
    } else {
      return {
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        iconColor: 'var(--color-emerald-500)',
        borderColor: 'border-emerald-200',
        progressBarColor: 'bg-emerald-500',
      };
    }
  }

  // For efficiency where higher is better
  // >= 80 emerald (good), >= 40 amber (medium), < 40 red (bad)
  if (type === 'efficiency') {
    if (numericValue >= 80) {
      return {
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        iconColor: 'var(--color-emerald-500)',
        borderColor: 'border-emerald-200',
        progressBarColor: 'bg-emerald-500',
      };
    } else if (numericValue >= 40) {
      return {
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        iconColor: 'var(--color-amber-500)',
        borderColor: 'border-amber-200',
        progressBarColor: 'bg-amber-500',
      };
    } else {
      return {
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        iconColor: 'var(--color-red-500)',
        borderColor: 'border-red-200',
        progressBarColor: 'bg-red-500',
      };
    }
  }

  // For uptime - white card with subtle blue stroke and blue icon
  return {
    bgColor: 'bg-white',
    textColor: 'text-slate-600',
    iconColor: 'var(--color-blue-500)',
    borderColor: 'border-blue-200',
    progressBarColor: 'bg-blue-500',
  };
}

// Helper functions for power supply efficiency ratings
function getEfficiencyRatingImage(rating: string): string {
  const lowerRating = rating.toLowerCase();
  if (lowerRating.includes('bronze')) return bronzeImg;
  if (lowerRating.includes('silver')) return silverImg;
  if (lowerRating.includes('gold')) return goldImg;
  if (lowerRating.includes('platinum')) return platinumImg;
  if (lowerRating.includes('titanium')) return titaniumImg;
  return goldImg; // Default fallback
}
function LandingPage(): React.ReactElement {
  // Initialize logger for this component
  const logger = createComponentLogger('LandingPage');

  const { selectedServer } = useServer();
  const {
    nodeTopInfo,
    fetchNodeTopInfo,
    serverData,
    fetchServerInventory,
    fetchServerSystemInfo,
    fetchServerAddinCards,
    fetchServerStorageCards,
  } = useAppState();
  const navigate = useNavigate();
  const { closeConnection, connectWebSocket } = useWebSocket();

  // Get server data from shared state instead of local state
  const addinCards = serverData?.addinCards;
  const loadingAddinCards = serverData?.loading?.addinCards || false;

  const storageCards = serverData?.storageCards;
  const loadingStorageCards = serverData?.loading?.storageCards || false;
  const storageCardsError = serverData?.errors?.storageCards;

  const systemInfo = serverData?.systemInfo;
  const inventoryData = serverData?.inventoryData;

  // Keep local state for WebSocket data that isn't managed by shared state
  const [physicalNetworkData, setPhysicalNetworkData] = useState<NetworkData[]>([]);
  const [virtualNetworkData, setVirtualNetworkData] = useState<NetworkData[]>([]);
  const [networkDataForTable, setNetworkDataForTable] = useState<Record<string, string>>({});

  const [nodeMetrics, setNodeMetrics] = useState<NodeMetrics | null>(null);
  const [powerMetrics, setPowerMetrics] = useState<PowerMetrics | null>(null);
  const [fanMetrics, setFanMetrics] = useState<FanMetrics | null>(null);
  const [showBack, setShowBack] = useState<boolean>(false);
  const [cardLayout, setCardLayout] = useState<'3x3' | '2x2'>('3x3');

  const [efficiency, setEfficiency] = useState<string | null>(null);

  // Initialize WebSocket connections
  useEffect((): (() => void) | void => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (!serverAddress) return;
    logger.info('Initializing WebSocket connections', { serverAddress });

    // Connect to metrics websockets
    const authToken = localStorage.getItem('accessToken');

    connectWebSocket(
      `${envConfig().WS_PROTOCOL}://${serverAddress}${
        envConfig().CONTROL_NODE_IP.PORT
      }/api/v1/metrics/node/system/metrics/ws?token=${authToken}`,
      {
        onMessage: (data: any) => {
          const { cpu, storage, memory, security_score, uptime } = data;
          setNodeMetrics({
            cpu,
            storage,
            memory,
            security_score,
            uptime,
          });
        },
      }
    );

    // Connect to efficiency-specific WebSocket
    connectWebSocket(
      `${envConfig().WS_PROTOCOL}://${serverAddress}${
        envConfig().CONTROL_NODE_IP.PORT
      }/api/v1/metrics/node/system/efficiency/ws?token=${authToken}`,
      {
        onMessage: (data: any) => {
          setEfficiency(data.efficiency);
        },
      }
    );

    // Connect to network data WebSocket - try direct WebSocket creation for better debugging
    const networkWsUrl = `${envConfig().WS_PROTOCOL}://${serverAddress}${
      envConfig().CONTROL_NODE_IP.PORT
    }/api/v1/metrics/node/system/network/ws?token=${authToken}`;

    try {
      const networkWs = new WebSocket(networkWsUrl);

      networkWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle the data
          const networkData: NetworkData[] = Array.isArray(data) ? data : [data];

          const physicalNetworks = networkData.filter(
            (network: NetworkData) => network.type === 'physical'
          );
          const virtualNetworks = networkData.filter(
            (network: NetworkData) => network.type === 'virtual'
          );

          setPhysicalNetworkData(physicalNetworks);
          setVirtualNetworkData(virtualNetworks);

          const networksWithIPs = networkData.filter((network: NetworkData) => network.ip !== null);
          const networkDataForTable: Record<string, string> = {};
          networksWithIPs.forEach((network: NetworkData) => {
            networkDataForTable[network.interface] = network.mac
              ? `${network.ip} (${network.mac})`
              : network.ip;
          });

          setNetworkDataForTable(networkDataForTable);
        } catch (error) {
          logger.error('Failed to parse Network WebSocket message', error);
        }
      };

      networkWs.onerror = (error) => {
        logger.error('Network WebSocket connection error', error);
      };

      networkWs.onclose = (event) => {
        if (event.code === 1008) {
          logger.error('Network WebSocket authentication failed - Invalid token');
        } else if (event.code === 1006) {
          logger.error('Network WebSocket connection lost unexpectedly');
        } else if (event.code !== 1000) {
          logger.error('Network WebSocket closed with error', {
            code: event.code,
            reason: event.reason || 'Unknown reason',
          });
        }
      };
    } catch (error) {
      logger.error('Failed to create Network WebSocket connection', error);
    }

    if (!inventoryData) return;
    connectWebSocket(
      `${envConfig().WS_PROTOCOL}://${serverAddress}${
        envConfig().CONTROL_NODE_IP.PORT
      }/api/v1/metrics/node/system/thermal/ws?ip=${inventoryData.ip}&vendor=${
        inventoryData.vendor
      }&user=${inventoryData.username}&password=${inventoryData.password}&token=${authToken}`,
      {
        onMessage: (data: any) => {
          setFanMetrics(data);
        },
      }
    );

    return () => {
      // Clean up WebSocket connections when unmounting
      closeConnection();
    };
  }, [selectedServer?.fqdn, selectedServer?.ip, inventoryData]);

  // Use shared-state API functions instead of direct fetch calls
  useEffect(() => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (!serverAddress) return;
    logger.info('Fetching server data', { serverAddress });

    // Fetch all server data using shared-state API functions
    fetchServerInventory(serverAddress);
    fetchServerSystemInfo(serverAddress);
    fetchServerAddinCards(serverAddress);
    fetchServerStorageCards(serverAddress);
  }, [selectedServer?.fqdn, selectedServer?.ip]); // Remove function dependencies to prevent infinite calls

  function transformAddinCardsData(apiData: AddinCard[] | null): Record<string, string> {
    if (loadingAddinCards) return { 'Add-In Card': 'Loading...' };
    if (!apiData || !Array.isArray(apiData)) return {};

    return apiData.reduce((acc: Record<string, string>, card: AddinCard) => {
      const device = card.device.replace(/'/g, '');
      acc[card.slot] = device || 'Available';
      return acc;
    }, {});
  }

  const data = {
    ...(systemInfo && {
      ...(systemInfo.Made &&
        systemInfo.Made !== 'To be filled by O.E.M.' && { Make: systemInfo.Made }),
      ...(systemInfo.Model &&
        systemInfo.Model !== 'To be filled by O.E.M.' &&
        systemInfo.Model !== 'System Product Name' && { Model: systemInfo.Model }),
      ...(systemInfo.ModelName &&
        systemInfo.ModelName !== 'To be filled by O.E.M.' &&
        systemInfo.ModelName !== 'unknown' && { 'Model Name': systemInfo.ModelName }),
    }),
    ...(fanMetrics
      ? {
          ...(fanMetrics.Fans?.reduce(
            (
              acc: Record<string, string>,
              fan: { Name: string; Reading: number; ReadingUnit: string }
            ) => ({
              ...acc,
              [fan.Name]: `${fan.Reading}${fan.ReadingUnit === 'Percent' ? '%' : fan.ReadingUnit}`,
            }),
            {}
          ) || {}),
          ...(fanMetrics.Temperatures?.reduce(
            (acc: Record<string, string>, temp: { Name: string; ReadingCelsius: number }) => {
              const simplifiedNames: Record<string, string> = {
                '01-Inlet Ambient': 'Inlet',
                '02-CPU 1 PkgTmp': 'CPU',
                '04-VR P1': 'VR',
              };
              if (simplifiedNames[temp.Name]) {
                return {
                  ...acc,
                  [simplifiedNames[temp.Name]]: `${temp.ReadingCelsius}C`,
                };
              }
              return acc;
            },
            {}
          ) || {}),
        }
      : {}),
    ...(networkDataForTable || { 'Network Status': 'Loading...' }),
  };

  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    content: string;
  }>({
    title: '',
    content: '',
  });

  const [showStorageModelModal, setShowStorageModelModal] = useState<boolean>(false);
  const [storageModelData, setStorageModelData] = useState<any>(null);
  const [loadingStorageModel, setLoadingStorageModel] = useState<boolean>(false);
  const [storageModelError, setStorageModelError] = useState<string | null>(null);

  const openInfoModal = (title: string, content: string, fetchNodeInfo: boolean = false) => {
    setModalContent({ title, content });
    setShowInfoModal(true);

    // Fetch node top info when requested and the server is selected
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (fetchNodeInfo && serverAddress) {
      // Add a small delay to ensure the modal is visible before loading starts
      setTimeout(() => {
        fetchNodeTopInfo(serverAddress);
      }, 100);
    }
  };

  const fetchStorageModelDetails = async (modelName: string, deviceName: string) => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (!serverAddress) return;

    setLoadingStorageModel(true);
    setStorageModelError(null);
    setShowStorageModelModal(true);

    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${serverAddress}${
          envConfig().CONTROL_NODE_IP.PORT
        }/api/v1/metrics/node/system/smart/${encodeURIComponent(deviceName)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setStorageModelData(data);
    } catch (error) {
      logger.error('Failed to fetch storage model details', { modelName, deviceName, error });
      setStorageModelError((error as Error).message || 'Failed to fetch storage model details');
    } finally {
      setLoadingStorageModel(false);
    }
  };

  // Get color classes for each metric
  const uptimeColors = getMetricColorClasses(nodeMetrics?.uptime, 'uptime');
  const efficiencyColors = getMetricColorClasses(efficiency, 'efficiency');
  const cpuColors = getMetricColorClasses(nodeMetrics?.cpu?.total_usage_percent, 'cpu');
  const storageColors = getMetricColorClasses(nodeMetrics?.storage, 'storage');
  const memoryColors = getMetricColorClasses(nodeMetrics?.memory, 'memory');

  const statusCards = [
    {
      icon: TbVector,
      metric: nodeMetrics?.uptime || '----',
      text: 'Uptime',
      detail: 'Since last restart',
      className: `${uptimeColors.bgColor} rounded-lg`,
      metricsColor: uptimeColors.textColor,
      iconColor: uptimeColors.iconColor,
      metricSize: 'text-lg',
    },
    {
      icon: CpuSetting,
      metric: efficiency ? efficiency : '----',
      text: 'Efficiency',
      detail: 'System Optimization',
      className: `${efficiencyColors.bgColor} rounded-lg`,
      metricsColor: efficiencyColors.textColor,
      iconColor: efficiencyColors.iconColor,
      showProgressBar: true,
      progressValue: efficiency ? parseInt(efficiency) : 0,
      progressBarColor: efficiencyColors.progressBarColor,
      metricSize: 'text-lg',
      info: `<div class="text-sm">
<div class="font-bold text-lg mb-2">Workload Efficiency Formula:</div>
CPU Usage (50%) – Most important metric, represents processor utilization, contributes up to 50 points.<br>
Memory Usage (30%) – Represents RAM utilization, contributes up to 30 points.<br>
Storage Usage (20%) – Represents disk space utilization, contributes up to 20 points.

<div class="font-bold text-lg mt-3 mb-2">Calculation:</div>
Efficiency = (CPU × 0.5) + (Memory × 0.3) + (Storage × 0.2)<br>
<span class="text-xs text-gray-600">Score is rounded to the nearest integer between 0–100.</span>

<div class="font-bold text-lg mt-3 mb-2">Interpretation:</div>
<ul class="list-disc ml-5">
  <li>Low resource utilization, high efficiency → Node is mostly idle or underperforming</li>
  <li>High resource utilization, low efficiency → Node is doing useful work efficiently</li>
</ul>
</div>`,
      onInfoClick: () =>
        openInfoModal(
          'Efficiency Information',
          `<div class="text-sm ">
<div class="font-bold text-lg mb-2">Workload Efficiency Formula:</div>
CPU Usage (50%) – Most important metric, represents processor utilization, contributes up to 50 points.<br>
Memory Usage (30%) – Represents RAM utilization, contributes up to 30 points.<br>
Storage Usage (20%) – Represents disk space utilization, contributes up to 20 points.

<div class="font-bold text-lg mt-3 mb-2">Calculation:</div>
Efficiency = (CPU × 0.5) + (Memory × 0.3) + (Storage × 0.2)<br>
<span class="text-xs text-gray-600">Score is rounded to the nearest integer between 0–100.</span>

<div class="font-bold text-lg mt-3 mb-2">Interpretation:</div>
<ul class="list-disc ml-5">
  <li>Low resource utilization, high efficiency → Node is mostly idle or underperforming</li>
  <li>High resource utilization, low efficiency → Node is doing useful work efficiently</li>
</ul>
</div>`,
          true
        ),
    },
    {
      icon: HiMiniCpuChip,
      metric: nodeMetrics?.cpu?.total_usage_percent
        ? `${nodeMetrics.cpu.total_usage_percent}%`
        : '----',
      text: 'CPU Usage',
      detail: 'Current Load',
      progressValue: nodeMetrics?.cpu?.total_usage_percent,
      showProgressBar: true,
      className: `${cpuColors.bgColor} rounded-lg cursor-pointer hover:shadow-md transition-shadow`,
      metricsColor: cpuColors.textColor,
      iconColor: cpuColors.iconColor,
      progressBarColor: cpuColors.progressBarColor,
      metricSize: 'text-lg',
      onClick: () => {
        if (selectedServer?.name) {
          navigate(`/server/${selectedServer.name}/monitoring?tab=CPU`);
        }
      },
    },
    {
      icon: Coin,
      metric: nodeMetrics?.storage ? `${nodeMetrics.storage}%` : '----',
      text: 'Storage',
      detail: 'Disk Utilization',
      className: `${storageColors.bgColor} rounded-lg cursor-pointer hover:shadow-md transition-shadow`,
      metricsColor: storageColors.textColor,
      iconColor: storageColors.iconColor,
      showProgressBar: true,
      progressValue: nodeMetrics?.storage,
      progressBarColor: storageColors.progressBarColor,
      metricSize: 'text-lg',
      onClick: () => {
        if (selectedServer?.name) {
          navigate(`/server/${selectedServer.name}/monitoring?tab=usage`);
        }
      },
    },
    {
      icon: PiMemoryDuotone,
      metric: nodeMetrics?.memory ? `${nodeMetrics.memory}%` : '-----',
      text: 'Memory',
      detail: 'RAM Usage',
      className: `${memoryColors.bgColor} rounded-lg cursor-pointer hover:shadow-md transition-shadow`,
      metricsColor: memoryColors.textColor,
      iconColor: memoryColors.iconColor,
      showProgressBar: true,
      progressValue: nodeMetrics?.memory,
      progressBarColor: memoryColors.progressBarColor,
      metricSize: 'text-lg',
      onClick: () => {
        if (selectedServer?.name) {
          navigate(`/server/${selectedServer.name}/monitoring?tab=Memory`);
        }
      },
    },
  ];

  // Helper function to get image for rating
  const getRatingImage = (rating: string) => {
    switch (rating?.toLowerCase()) {
      case 'bronze':
        return bronzeImg;
      case 'silver':
        return silverImg;
      case 'gold':
        return goldImg;
      case 'platinum':
        return platinumImg;
      case 'titanium':
        return titaniumImg;
      default:
        return null;
    }
  };

  // Helper function to get efficiency description for rating
  const getRatingDescription = (rating: string) => {
    switch (rating?.toLowerCase()) {
      case 'bronze':
        return 'Up to 85% efficiency at typical load (50%).';
      case 'silver':
        return 'Delivers 88% efficiency at 50% load.';
      case 'gold':
        return 'Achieves 90% efficiency at 50% load.';
      case 'platinum':
        return 'Reaches 92% efficiency at 50% load.';
      case 'titanium':
        return 'Tops at 94% efficiency at 50% load and 90% at 10%.';
      default:
        return `${rating} efficiency`;
    }
  };

  if (!selectedServer) {
    return <div className="text-center p-8">Please select a server to view dashboard</div>;
  }

  // Determine chassis images based on systemInfo.Made
  const made = systemInfo?.Made?.toLowerCase();
  let frontImage = '/sm_front.png';
  let backImage = '/sm_back.png';

  if (made === 'dell inc.') {
    frontImage = '/Dell_Front.png';
    backImage = '/Dell_Back.jpg';
  } else if (made === 'hpe') {
    frontImage = '/HPE_front.jpg';
    backImage = '/HPE_back.png';
  } else if (made === 'protectli') {
    frontImage = '/protectli_front.png';
    backImage = '/protectli_back.png';
  } else if (made === 'supermicro') {
    frontImage = '/supermicro_back.png';
    backImage = '/supermicro_front.png';
  } else if (made === 'eps') {
    frontImage = '/MSI_front.png';
    backImage = '/MSI_back.png';
  } else if (made === 'micro computer (hk) tech limited') {
    frontImage = '/minisforum_front.png';
    backImage = '/minisforum_back.png';
  }

  return (
    <div className="space-y-4 rounded-lg" data-testid="landing-page-container">
      <StatusCardsGrid
        statusCards={statusCards}
        serverName={selectedServer.name.split('.')[0]}
        data-testid="status-cards-grid"
      />

      {/* Layout Toggle and Node Metrics Title */}
      <div className="flex items-center justify-between" data-testid="node-metrics-header">
        <h2 className="text-xl font-bold text-gray-900" data-testid="node-metrics-title">
          Node Metrics
        </h2>
        <div className="flex items-center gap-2" data-testid="layout-toggle-buttons">
          {/* 3x3 Grid Icon */}
          <button
            onClick={() => setCardLayout('3x3')}
            className={`p-2 rounded-lg border transition-all ${
              cardLayout === '3x3'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
            title="3x3 Grid Layout"
            aria-label="3x3 Grid Layout"
            data-testid="grid-3x3-button"
          >
            <BsGrid3X3
              className={`w-5 h-5 ${cardLayout === '3x3' ? 'text-blue-600' : 'text-gray-400'}`}
            />
          </button>

          {/* 2x2 Grid Icon */}
          <button
            onClick={() => setCardLayout('2x2')}
            className={`p-2 rounded-lg border transition-all ${
              cardLayout === '2x2'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
            title="2x2 Grid Layout"
            aria-label="2x2 Grid Layout"
            data-testid="grid-2x2-button"
          >
            <BsGrid
              className={`w-5 h-5 ${cardLayout === '2x2' ? 'text-blue-600' : 'text-gray-400'}`}
            />
          </button>
        </div>
      </div>

      {/* Cards Grid: System Information | Add-In Cards | Network | Power | Storage | Chassis View */}
      <div
        className={`grid grid-cols-1 gap-4 items-stretch ${cardLayout === '3x3' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}
        data-testid="node-metrics-grid"
      >
        {/* System Information column */}
        <div className="w-full h-full overflow-hidden" data-testid="system-information-container">
          <SystemInformationCard data={data} data-testid="system-information-card" />
        </div>

        {/* Add-In Card + PCIe Devices */}
        <div className="w-full h-full overflow-hidden" data-testid="addin-cards-container">
          <AddinCardsDisplay
            addinCards={addinCards}
            loadingAddinCards={loadingAddinCards}
            data-testid="addin-cards-display"
          />
        </div>

        {/* Network Card */}
        <div className="w-full h-full overflow-hidden" data-testid="network-card-container">
          <NetworkCard
            physicalNetworkData={physicalNetworkData}
            virtualNetworkData={virtualNetworkData}
            data-testid="network-card"
          />
        </div>

        {/* Storage Controllers */}
        <div className="w-full h-full overflow-hidden" data-testid="storage-cards-container">
          <StorageCards
            loadingStorageCards={loadingStorageCards}
            storageCardsError={storageCardsError}
            storageCards={storageCards}
            onModelClick={fetchStorageModelDetails}
            data-testid="storage-cards"
          />
        </div>

        {/* Chassis View Card */}
        <div className="w-full h-full overflow-hidden" data-testid="chassis-view-container">
          <ChassisViewCard
            frontImage={frontImage}
            backImage={backImage}
            made={made}
            showBack={showBack}
            onToggleView={() => setShowBack(!showBack)}
            data-testid="chassis-view-card"
          />
        </div>
      </div>

      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={modalContent.title}
        content={modalContent.content}
        nodeTopInfo={nodeTopInfo}
        data-testid="info-modal"
      />

      <StorageModelModal
        isOpen={showStorageModelModal}
        onClose={() => setShowStorageModelModal(false)}
        storageModelData={storageModelData}
        loadingStorageModel={loadingStorageModel}
        storageModelError={storageModelError}
        data-testid="storage-model-modal"
      />
    </div>
  );
}

export default LandingPage;
