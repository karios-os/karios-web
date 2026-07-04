import { ActionTypes } from './actionTypes';
import api from './interceptor';
import envConfig from '../../../../runtime-config';
import { logger } from './logger';

export interface NodeStatsHistory {
  node_ip: string;
  cpu_cap: number;
  cpu_usage: number;
  cpu_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
  mem_cap: number;
  mem_usage: number;
  mem_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
  power: number;
  power_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
  uptime: string;
  overall_flag: 'NORMAL' | 'HIGH' | 'CRITICAL';
  timestamp: string;
}

export const fetchNodeStatsHistory = async (
  serverIp: string,
  startTime: string,
  endTime: string,
  dispatch: any
) => {
  dispatch({ type: ActionTypes.FETCH_NODE_STATS_HISTORY_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/recommendations/nodestats/average?start_time=${startTime}&end_time=${endTime}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch node stats history');
    }

    const data = await response.json();
    dispatch({ type: ActionTypes.FETCH_NODE_STATS_HISTORY_SUCCESS, payload: data });
    return data;
  } catch (error) {
    logger.error('Error fetching node stats history:', error);
    dispatch({ type: ActionTypes.FETCH_NODE_STATS_HISTORY_FAILURE, payload: error.message });
    return null;
  }
};

export const fetchNodeStatsRecommendations = async (
  startTime: string,
  endTime: string,
  dispatch: any
) => {
  dispatch({ type: ActionTypes.FETCH_NODE_STATS_RECOMMENDATIONS_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/recommendations/nodestats/average?start_time=${startTime}&end_time=${endTime}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const recommendations = Array.isArray(data) ? data : [];

    dispatch({
      type: ActionTypes.FETCH_NODE_STATS_RECOMMENDATIONS_SUCCESS,
      payload: recommendations,
    });

    return recommendations;
  } catch (error) {
    logger.error('Error fetching node stats recommendations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch recommendations';
    dispatch({
      type: ActionTypes.FETCH_NODE_STATS_RECOMMENDATIONS_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};

export const fetchHistoricalVmStats = async (
  nodeIp: string,
  startTime: string,
  endTime: string,
  dispatch: any
) => {
  dispatch({ type: ActionTypes.FETCH_HISTORICAL_VM_STATS_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${nodeIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/recommendations/vmstats/recommend?start=${startTime}&end=${endTime}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const vmStats = Array.isArray(data) ? data : [];

    dispatch({
      type: ActionTypes.FETCH_HISTORICAL_VM_STATS_SUCCESS,
      payload: { nodeIp, vmStats },
    });

    return vmStats;
  } catch (error) {
    logger.error('Error fetching historical VM stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch VM statistics';
    dispatch({
      type: ActionTypes.FETCH_HISTORICAL_VM_STATS_FAILURE,
      payload: errorMessage,
    });
    throw error;
  }
};
